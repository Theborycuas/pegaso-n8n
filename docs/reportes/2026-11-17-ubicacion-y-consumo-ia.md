# Ubicación y registro del consumo de todas las IA

Estado: preparado en local el 17 de noviembre de 2026. **No publicado.** Antes de publicar hay que aplicar `schema/ia_llamadas.sql` en PostgreSQL. Para activar la lectura de tokens hay que crear la credencial de la API de n8n.

## 1. Respuestas de ubicación

### Qué pasaba

Un cliente llegó desde un anuncio de Facebook y preguntó «¿En qué ciudad se encuentran?». La respuesta automática del anuncio contestó con el texto predeterminado de Quito y Servientrega. Después el bot envió además «Sí, contamos con local físico en Quito. Los retiros se realizan los viernes…».

El flujo ya tenía una regla que detecta cuando WhatsApp Business atendió el turno. Pero la rama de ubicación de `Resolver contexto comercial` se ejecutaba después y quitaba la omisión. Como el último mensaje ya decía «ciudad de Quito», caía en una rama que siempre enviaba el texto del local.

### Qué cambia

Los textos aprobados y los patrones de ubicación están en el módulo `code/preventa/ubicacion.js`. Lo usan las FAQ, el resolver y el filtro de duplicados.

| El cliente pregunta | El bot responde |
|---|---|
| En qué ciudad están, de dónde son, dónde se encuentran | «Somos de la ciudad de Quito pero no tiene de qué preocuparse 🤗 ya que tenemos clientes a nivel nacional 🇪🇨 y les hacemos los envíos por medio de Servientrega 🚛 o por transporte depende de su requerimiento 🚌.» |
| La dirección, el local, en qué parte de Quito, si puede visitarlos, la ubicación para el mapa | Oficinas en el Valle de los Chillos (sector Capelo) y planta en Av. América y José Riofrío. *En ambas direcciones le atendemos solo bajo previa cita por favor.* Cierra con «Indíquenos, ¿cuándo tiene planificado visitarnos?» |
| Lo mismo, pero la respuesta automática del anuncio ya contestó | No repite la ubicación. En etiquetas sigue con «Para enviarle el precio indíquenos el ancho y el alto de sus etiquetas…» |
| Vuelve a preguntar después de conocer la ciudad | La dirección en Quito |
| Vuelve a preguntar después de recibir la dirección | Solo la invitación a agendar la visita, sin repetir el bloque |

En el texto de direcciones corregí dos detalles de redacción del original: «En ambas direcciones» y «Indíquenos, ¿cuándo…?».

El texto anterior del local, con retiros los viernes a las 5 PM, deja de enviarse en las respuestas de ubicación. El prompt del cerebro no cambia, porque el resolver aplica estos textos de forma determinista cuando el cliente pregunta por la ubicación.

## 2. Consumo de todas las IA

### Qué había

`Insertar log IA` solo registraba una fila por turno del cerebro comercial, con el proveedor final. Faltaban:

- el cotizador;
- el análisis de imagen;
- el audio;
- los intentos fallidos.

Los tokens llegaban siempre vacíos. El código intentaba leerlos del sub-nodo del modelo, y n8n no expone esos datos a un nodo Code. Además, el INSERT interpolaba texto dentro del SQL, así que una comilla en un mensaje de error lo rompía.

### Qué se comprobó en producción

Leí varias ejecuciones con `n8n-cli` en modo solo lectura y sin copiar mensajes de clientes:

- n8n guarda en cada ejecución los tokens reales de cada llamada de IA (`tokenUsage`), además del modelo, la duración, el nodo que la usó y el error, si lo hubo.
- El cerebro comercial consume entre 19.500 y 19.900 tokens de entrada y entre 500 y 900 de salida por turno con DeepSeek. El cotizador consume unos 3.700 de entrada.
- **Groq rechaza todas las llamadas del cerebro.** El error es «Request too large for model `openai/gpt-oss-20b` … TPM: Limit 8000, Requested 18083». El prompt del cerebro no cabe en el plan gratuito de Groq. Cada turno pierde entre 100 y 600 ms y termina en DeepSeek. El análisis de imagen en Groq también recibe límites de velocidad, aunque n8n lo reintenta.

### Qué cambia

- Un proceso nuevo, `Registrar consumo IA`, se ejecuta cada 5 minutos. Lee por la API de n8n las ejecuciones terminadas y guarda en `pegaso.ia_llamadas` una fila por cada llamada, con:
  - rol (`CEREBRO`, `COTIZADOR`, `IMAGEN` o `AUDIO`);
  - proveedor y modelo;
  - éxito, o el motivo si la respuesta no pasó la validación;
  - error del proveedor;
  - duración;
  - tokens de entrada, salida y total que devolvió el proveedor;
  - segundos de audio en Deepgram.

  Una petición rechazada no suma tokens. En el detalle queda cuántos solicitó.
- La fila resumida del flujo se mantiene hasta que el proceso procesa esa ejecución. Después se sustituye por el detalle real, para no contar dos veces. Cada ejecución se procesa una sola vez.
- `Insertar log IA` usa parámetros y guarda el `execution_id`.
- STATUSIA muestra cada IA por rol y proveedor, con tokens de entrada, salida y total.

### Activación

Los tres nodos que hablan con la API de n8n (`Registrar consumo IA`, `Listar ejecuciones n8n` y `Leer ejecución n8n`) quedan **desactivados**, porque la instancia no tiene una credencial para esa API. No se puede crear desde el repositorio sin manejar una clave. Para activarlos:

1. En n8n, ir a Settings → n8n API y crear una API key.
2. Crear una credencial **Header Auth** llamada `PEGASO - N8N API`, con nombre de cabecera `X-N8N-API-KEY` y la key como valor.
3. Asignarla a `Listar ejecuciones n8n` y a `Leer ejecución n8n`.
4. Activar los tres nodos y hacer `pull`.

Hasta entonces sigue funcionando el registro resumido del cerebro.

### Límites

- Groq Whisper responde en formato `json`, que no incluye la duración. Esas filas de audio quedan sin segundos. Para obtenerlos habría que pedir `verbose_json`, y no lo cambié para no tocar la transcripción.
- Los tokens en caché de DeepSeek y OpenAI no aparecen separados. n8n solo guarda entrada, salida y total.
- Cada ronda lee hasta 15 ejecuciones, de unos 2 MB cada una. Con el volumen observado, de unas 15 ejecuciones por hora de noche, sobra capacidad. Si de día el volumen supera 180 por hora, conviene subir el límite.
- n8n borra ejecuciones antiguas. Si una ya no existe, se marca `NO_ENCONTRADA` y no se vuelve a pedir.

## Verificación

```powershell
node --test tests/preventa.test.mjs tests/eficiencia-preventa.test.mjs tests/ubicacion.test.mjs tests/consumo-ia.test.mjs tests/preventa-postgres.test.mjs
node scripts/inject-code.mjs
node scripts/validate-workflow.mjs
node scripts/prepare-update.mjs
node scripts/check-encoding.mjs
```

- Pasan 98 pruebas: 71 de nodos y módulos y 27 SQL contra PostgreSQL 17 temporal. Las pruebas SQL aplican `schema/preventa-eficiencia.sql` y `schema/ia_llamadas.sql`.
- Las pruebas nuevas cubren:
  - clasificación de 9 preguntas de ubicación;
  - textos exactos;
  - el caso de la captura;
  - cada fila de consumo, con rol, proveedor y tokens;
  - el rechazo de Groq por TPM;
  - una validación fallida;
  - la duración del audio;
  - una ejecución borrada;
  - el SQL con comillas;
  - el guardado idempotente;
  - el reemplazo de la fila resumida;
  - STATUSIA agrupado por rol.
- `Extraer consumo IA` se probó también contra dos ejecuciones reales, con salida limitada a métricas.
- Validadores correctos. Compilan los 72 nodos Code. La extracción reconstruye todos los archivos. Los tres prompts, el cálculo de precios y los IDs son idénticos a producción.

## Pasos para publicar

1. Aplicar `schema/ia_llamadas.sql` en PostgreSQL. Es idempotente: crea la tabla si falta y añade las columnas nuevas.
2. Con autorización, ejecutar `push.ps1`.
3. Prueba funcional:
   - «¿En qué ciudad se encuentran?» desde un anuncio: el bot no repite la ubicación;
   - «¿Cuál es su dirección?»: responde con las direcciones y la cita previa;
   - el comando `STATUSIA`.
4. Crear la credencial de la API de n8n y activar el registro de consumo.

## Decisión pendiente

Groq no puede atender el cerebro comercial con el plan actual. Hay tres opciones:

1. Empezar la cascada del cerebro por DeepSeek y dejar Groq como respaldo.
2. Subir Groq al plan Dev Tier.
3. Reducir el prompt por debajo de unos 7.000 tokens, que es el prompt compacto pendiente de evaluar.

La opción 1 elimina el intento fallido en cada turno y no cambia las respuestas.
