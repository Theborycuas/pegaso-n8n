# Galería de trabajos: a pedido, por material y con la cotización

Estado: V3.37 publicada (commit bbca5f8). **V3.38 en local, sin publicar ni commit**: la galería deja de salir tras cireles, ciudad o cualquier respuesta que mencione el material. Se activa al cargar la fila `GALERIA_TRABAJOS` en `configuracion_bot`. Sin esa fila el flujo se comporta igual que antes.

## Qué hace

En las conversaciones de etiquetas, el bot envía una galería de fotos y videos de trabajos del mismo tipo de producto del prospecto.

### Cuando el prospecto pide fotos o muestras (V3.37)

«¿Tiene imágenes de muestra?», «Puede enviarme fotos de trabajos…», «tienen videos?», «quisiera ver sus trabajos». La regla `MUESTRAS_TRABAJOS` lo atiende sin IA. Mensajes como «Le envié la foto de mi diseño» no cuentan como petición.

| Situación | El bot responde |
|---|---|
| Su producto ya se conoce (lo dijo en este mensaje o antes) | «Claro, con gusto 🤗.», la galería de su producto y «Le adjunto varios de nuestros trabajos. Quedamos atentos de las medidas exactas para cotizarle por favor.» |
| No se sabe su producto | «Con gusto le compartimos fotos de nuestros trabajos 🤗. ¿Para qué producto son sus etiquetas?» |
| Responde el producto | «Perfecto 👌.», la galería de ese producto y el mismo cierre. Si nombra un producto sin palabra conocida, sale la galería predeterminada (AGUA) |
| Ya recibió esa galería y vuelve a pedir | «Más arriba le compartimos varios de nuestros trabajos 👆.» sin repetirla |
| Ya recibió una galería y pide la de otro producto | Sale la del otro producto |

Si las medidas ya se conocen, el cierre no vuelve a pedirlas. En el turno en que pide fotos de etiquetas de agua, la galería tiene prioridad sobre las medidas sugeridas para botellas y bidones. Ese bloque de precios sigue saliendo cuando pregunta el precio sin medidas.

### Pregunta por el material o recibe la cotización (V3.38)

Los asesores no sueltan fotos a discreción. Fuera de la petición de muestras, la galería sale solo en estos dos momentos y **solo si el producto se conoce**:

| Momento | Se reconoce por |
|---|---|
| El prospecto pregunta por el material | Su mensaje: «material», «¿de qué están hechas?», «¿son de papel?», «¿resisten el agua / la refrigeración?», «¿se despegan?», «impermeables» |
| Se le envía la cotización de etiquetas | La acción `COTIZAR_P4`, y en «Preparar envío WhatsApp» que la cotización haya salido producible |

En los dos casos sale después de la respuesta, sin texto adicional, y cierra con «Le adjunto varios de nuestros trabajos.».

Ya **no** sale:
- tras responder cireles o desde qué ciudad escribimos;
- porque una respuesta mencione el Polipropileno, por ejemplo al pedir medidas tras «¿Precio de las etiquetas adhesivas?»;
- si no se conoce el producto: no queda pendiente ni sale más tarde. Solo la pregunta «¿Para qué producto son sus etiquetas?», que el bot hace cuando piden fotos, espera la respuesta, y solo en el turno siguiente.

El orden es el mismo que usan los asesores en WhatsApp Business:

1. la respuesta;
2. la galería;
3. «Le adjunto varios de nuestros trabajos.».

**Una sola vez cada galería.** El envío queda registrado en `contexto_comercial.galeria_trabajos` (`clave`, `motivo`, `medios`, `claves_enviadas`, `pendiente_producto`, `enviada_at`). Tampoco se envía si en el historial reciente un asesor ya escribió «Le adjunto varios de nuestros trabajos», como en las capturas.

**No se envía** en estos casos:
- derivaciones a humano o datos de pago;
- cotizaciones no producibles;
- tarjetas, flyers y otros productos de catálogo;
- respuestas omitidas, por ejemplo cuando la respuesta automática del anuncio ya contestó;
- si en ese mismo turno salen la imagen `IMAGEN_TRABAJOS` o un catálogo.

**La galería corresponde al producto del prospecto.** Primero se busca en el mensaje actual y después en lo que escribió antes, la primera galería cuyas palabras aparezcan:
- **LACTEOS** cubre lácteos y alimentos: embutidos, tortillas, comida, pan, salsas, café…
- **AGUA** cubre aguas, detergentes, líquidos, jugos, aceites…

LACTEOS va primero, así que «botellas de leche» elige lácteos.

## Cómo se envía sin volverse lento ni colgarse

- **No usa IA ni tokens.** Todo es código y configuración.
- **Un solo nodo HTTP para todas las fotos.** `Preparar galería trabajos` convierte la lista en un item por medio. `YCloud Enviar galería trabajos` los envía de uno en uno, cada 600 ms y en orden. Diez medios tardan unos 6 segundos.
- **Sin caption,** para que WhatsApp los agrupe como galería.
- **Cada request tiene un timeout de 20 s y continúa ante error:** un link roto no detiene los demás ni el flujo.
- **La misma guardia de salida que el resto de mensajes, una vez por medio y otra antes del cierre** (`Autorizar salida WhatsApp 9` y `10`). Si el cliente escribe o un humano toma la conversación, no sale nada más.
- **El cierre sale una sola vez** (`Esperar cierre galería` con `executeOnce`), 4 s después del último medio.
- **Máximo 15 medios por galería** y solo links `https`.

Sobre la agrupación: la API envía cada foto como un mensaje. WhatsApp agrupa en galería los medios consecutivos sin texto, pero la forma de mostrarlos depende de la app del cliente. Las fotos llegan igual aunque no se agrupen.

## Cómo cargar los links

Ejecutar en PostgreSQL con los links que subiste al servidor. Las `palabras` se comparan sin tildes ni mayúsculas y aceptan plural: «botellon» reconoce «botellones». El tipo sale de la extensión (`.mp4`, `.mov` o `.3gp` = video). Si un link no tiene extensión, usa `{"url": "...", "tipo": "video"}`.

```sql
INSERT INTO pegaso.configuracion_bot (clave, valor_json, actualizado_at)
VALUES (
  'GALERIA_TRABAJOS',
  '{
    "activo": true,
    "texto_cierre": "Le adjunto varios de nuestros trabajos.",
    "galerias": [
      {
        "clave": "AGUA",
        "palabras": ["agua", "botella", "botellon", "bidon", "galon", "purificada", "alcalina"],
        "medios": [
          "https://pegasoadhesivos.com/wp-content/uploads/AAAA/MM/<agua-1>.jpg",
          "https://pegasoadhesivos.com/wp-content/uploads/AAAA/MM/<agua-2>.mp4"
        ]
      },
      {
        "clave": "LACTEOS",
        "palabras": ["leche", "yogurt", "yogur", "queso", "lacteo", "kumis"],
        "medios": [
          "https://pegasoadhesivos.com/wp-content/uploads/AAAA/MM/<lacteos-1>.jpg"
        ]
      },
      {
        "clave": "GENERAL",
        "predeterminada": true,
        "medios": [
          "https://pegasoadhesivos.com/wp-content/uploads/AAAA/MM/<general-1>.jpg"
        ]
      }
    ]
  }'::jsonb,
  NOW()
)
ON CONFLICT (clave) DO UPDATE
SET valor_json = EXCLUDED.valor_json,
    actualizado_at = NOW();
```

Para agregar o quitar fotos después basta con actualizar esta fila. No hay que tocar el flujo. Para apagar la galería, cambiar `"activo"` a `false`.

## Cambios por nodo

Detalle en [FLUJO-WORKFLOW-PEGASO.md §23](../FLUJO-WORKFLOW-PEGASO.md#23-galería-de-trabajos).

| Nodo | Cambio |
|---|---|
| Obtener configuración MODO_PRUEBA | Lee también `GALERIA_TRABAJOS` |
| Resolver contexto comercial | V3.35 → **V3.38**. Decide la galería con el módulo `code/preventa/galeria-trabajos.js`, ajusta el texto (petición, pregunta del producto, ya compartida) y la registra en el contexto. Las medidas sugeridas de agua no ocupan el turno de una petición de fotos. V3.38: solo petición, pregunta de material o cotización; emite `galeria_trabajos_motivo` |
| Preparar contexto IA | Incluye el módulo de galería para la regla pre-IA `MUESTRAS_TRABAJOS` (`code/preventa/preguntas-frecuentes.js`) |
| Preparar envío WhatsApp | V3.7 → **V3.9**. Arma los cuerpos YCloud de la galería y del cierre. V3.9: con la cotización, solo si `Construir mensaje comercial` la dejó producible |
| 9 nodos nuevos | `IF: ¿Enviar galería trabajos?`, `Preparar galería trabajos` (Code), `Autorizar salida WhatsApp 9`, `IF permiso salida WhatsApp 9`, `YCloud Enviar galería trabajos`, `Esperar cierre galería`, `Autorizar salida WhatsApp 10`, `IF permiso salida WhatsApp 10` y `YCloud Enviar cierre galería`. Cuelgan de la rama falsa de `IF: ¿Enviar nota IVA?`, que estaba libre, y usan la credencial existente YCloud API. Las guardias siguen la convención que exige la prueba «Cada envío YCloud tiene una guardia SQL…» |

## Límites

- El envío se registra en el contexto antes de salir. Si en ese momento la guardia bloquea la salida porque el cliente escribió de nuevo, o la respuesta se omite por duplicada, la galería no se vuelve a intentar en esa conversación.
- La detección de una galería enviada a mano mira los últimos mensajes del historial que recibe el bot, que son 10.
- Las galerías de tarjetas y flyers siguen con sus videos e imágenes propios.

## Verificación

```powershell
node --test tests/preventa.test.mjs tests/eficiencia-preventa.test.mjs tests/ubicacion.test.mjs tests/consumo-ia.test.mjs tests/galeria-trabajos.test.mjs tests/insistencia-leads.test.mjs tests/insistencia-rutina.test.mjs
node scripts/inject-code.mjs
node scripts/validate-workflow.mjs
node scripts/prepare-update.mjs
node scripts/check-encoding.mjs
```

- Pasan las 198 pruebas del repositorio. Las de PostgreSQL 17 temporal se ejecutan por archivo (30 + 47): en paralelo, dos archivos con contenedor compiten entre sí. Hay 19 pruebas en `tests/galeria-trabajos.test.mjs`:
  - reconocer la petición de fotos y no confundirla con «le envié la foto de mi diseño»;
  - reconocer la pregunta de material;
  - la regla pre-IA `MUESTRAS_TRABAJOS`;
  - las conversaciones de las capturas: fotos de agua → galería AGUA; «¿tiene imágenes de muestra?» → pregunta del producto → «yogurt» → LÁCTEOS; «¿Precio de las etiquetas adhesivas?», «Me ayuda con la ubicación» y «¿En qué ciudad se encuentran?» → sin galería;
  - material y cotización solo con producto conocido; un pendiente antiguo se limpia sin enviar;
  - una sola vez por galería, también si la envió un asesor;
  - otra galería si pide otro producto;
  - derivación y datos de pago excluidos; cotización no producible excluida;
  - cuerpos YCloud sin caption;
  - un item por medio;
  - cableado del flujo: lotes de 1, `executeOnce` y la guardia de salida antes de cada envío (también lo comprueba «Cada envío YCloud tiene una guardia SQL…», con 11 envíos).
- Validadores correctos: 74 Code Nodes compilados, 258 nodos. El flujo no cambia de nodos ni conexiones.

## Pasos para publicar

1. Con autorización, ejecutar `push.ps1`. La fila `GALERIA_TRABAJOS` no cambia.
2. Probar desde un número de prueba:
   - «¿Precio de las etiquetas adhesivas?» y «¿En qué ciudad se encuentran?»: respuesta sin galería;
   - «Puede enviarme fotos de trabajos de etiquetas de agua?»: «Claro, con gusto 🤗.», galería AGUA y cierre;
   - en otro número, «¿Tiene imágenes de muestra?»: pregunta del producto; «para embutidos»: galería LACTEOS;
   - repetir la pregunta: la galería no se repite;
   - en otro número, «Precio de etiquetas para botellones» seguido de «¿Qué material son?»: galería AGUA;
   - en otro número, etiquetas para yogurt con medidas y cantidad: cotización, galería LACTEOS y cierre.
