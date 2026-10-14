# Auditoría funcional final antes de publicar: intervención humana, clientes y concurrencia

**Fecha:** 13 de octubre de 2026 · **Workflow:** SISTEMA AUTOMATIZADO PEGASO (`09OF22FOxihypeeh`)
**Estado:** solo análisis y pruebas sobre el estado local. No se modificó código, nodos, prompts ni SQL. No se ejecutó `pull.ps1`, `push.ps1` ni `extract-code.mjs`; no hay commit ni `git push`.
**Audita:** los cambios de [Control conversacional determinístico](2026-10-13-control-conversacional.md), todavía sin publicar.

**Veredicto: LISTO PARA PUSH CON RIESGOS CONOCIDOS.**

Para prospectos, el incidente real (el bot siguió respondiendo después de que una persona de Pegaso intervino) queda cerrado durante la espera del debounce y en todos los mensajes posteriores. Quedan dos huecos, los dos anteriores a estos cambios y presentes hoy en producción:

- una ventana corta en la que la ejecución ya pasó la guardia y está generando la respuesta;
- derivaciones concurrentes que pueden enviar el "Permítame un momento…" más de una vez. Se reprodujo con el código real.

El push no empeora ninguno de los dos; elimina tres causas que hoy permiten al bot responder encima del humano.

---

## Índice

1. [Cómo se auditó](#1-cómo-se-auditó)
2. [Resultado por pregunta](#2-resultado-por-pregunta)
3. [Auditoría 1: el humano interviene durante el Wait](#3-auditoría-1-el-humano-interviene-durante-el-wait)
4. [Auditorías 2 y 3: prospecto, cliente registrado o ambos](#4-auditorías-2-y-3-prospecto-cliente-registrado-o-ambos)
5. [Auditoría 4: eco humano "Perfecto estimada"](#5-auditoría-4-eco-humano-perfecto-estimada)
6. [Auditoría 5: eco automático de WhatsApp Business](#6-auditoría-5-eco-automático-de-whatsapp-business)
7. [Auditoría 6: "Permítame un momento…" repetido](#7-auditoría-6-permítame-un-momento-repetido)
8. [Auditoría 7: quién escribe `requiere_humano`](#8-auditoría-7-quién-escribe-requiere_humano)
9. [Auditoría 8: guardia después del Wait](#9-auditoría-8-guardia-después-del-wait)
10. [Auditoría 9: lead de anuncio](#10-auditoría-9-lead-de-anuncio)
11. [Auditoría 10: ventana de concurrencia y corrección propuesta](#11-auditoría-10-ventana-de-concurrencia-y-corrección-propuesta)
12. [Auditoría 11: precios](#12-auditoría-11-precios)
13. [Riesgos residuales](#13-riesgos-residuales)
14. [Recomendación](#14-recomendación)

---

## 1. Cómo se auditó

- **Grafo real:** se recorrieron las conexiones de `workflows/sistema-automatizado-pegaso.edit.json` desde `Webhook YCloud`, con las expresiones reales de cada IF, las consultas y mapeos de cada nodo Postgres y la expresión del Wait.
- **Código real:** los nodos Code de `code/_extraidos/` se ejecutaron tal cual en un arnés local, con `$input` y `$('Nodo')` simulados. Los eventos de YCloud usan la forma real (`whatsapp.inbound_message.received`, `whatsapp.smb.message.echoes`) con teléfonos ficticios.
- **Regresiones:** se volvieron a correr las pruebas conversacionales y las de precios del cambio anterior.
- **Dónde quedó el arnés:** fuera del repo, en la carpeta temporal del equipo. No contiene datos de clientes.

| Prueba | Resultado |
|---|---|
| Auditoría (escenarios de este reporte) | Todas OK |
| Regresión conversacional (14 casos más extras) | `TODAS OK` |
| Regresión de precios | `TODOS LOS CASOS OK` |
| Diff en archivos de precio | Ninguno |

`npm test` no existe en este repo: no hay `package.json`.

---

## 2. Resultado por pregunta

| Pregunta | Respuesta |
|---|---|
| ¿Un humano que escribe durante el Wait detiene la respuesta? | **Sí**, siempre que su eco ya esté guardado cuando termina el Wait |
| ¿Se cierra el incidente para prospectos? | **Sí** durante la espera y en los mensajes siguientes; queda una ventana mientras la IA trabaja |
| ¿El bot puede responder a un cliente registrado? | **No.** Tampoco guarda sus mensajes |
| ¿Un eco humano puede entrar al cerebro? | **No** |
| ¿Un eco automático marca humano? | **No** |
| ¿Un turno normal del bot puede apagar `requiere_humano`? | **No** |
| ¿Es imposible repetir "Permítame un momento…"? | **No.** Dos ejecuciones concurrentes pueden derivar por separado |
| ¿Cambian los precios? | **No** |

---

## 3. Auditoría 1: el humano interviene durante el Wait

**Escenario:** el cliente escribe → su ejecución entra al Wait → una persona de Pegaso responde desde WhatsApp Business → llega el eco `whatsapp.smb.message.echoes` → la ejecución original despierta.

Lo que hace la ejecución del eco:
1. Pasa por la ruta humana: `IF: ¿Mensaje humano de Pegaso?` [T].
2. Levanta la bandera del prospecto.
3. Guarda el SALIENTE con su `mensaje_externo_id`. Recibe un id mayor que el del mensaje del cliente.

Lo que hace la ejecución original al despertar:
1. `Recuperar historial conversación` trae el eco.
2. `Resolver turno conversacional` devuelve `continuar_procesamiento = false`, `resultado_turno = ATENCION_HUMANA` y `motivo_no_procesamiento = HUMANO_RESPONDIO_DURANTE_ESPERA`.
3. `IF: ¿Procesar turno?` va a la rama false, que no tiene conexión: la ejecución termina ahí.

| Comprobación | Resultado |
|---|---|
| Llama al cerebro | NO (no llega a `Preparar contexto IA`) |
| Guarda una respuesta automática | NO |
| Llega a `Preparar envío WhatsApp` | NO |
| Envía | NO |

**Límite:** la guardia lee la base una sola vez, al despertar. Si el eco todavía no está guardado en ese momento (el humano escribió 1–2 s antes del final del Wait), el turno continúa. La prueba lo confirma: con el eco ausente del historial, el turno se procesa y llama al cerebro. Ese caso forma parte de la ventana de la [Auditoría 10](#11-auditoría-10-ventana-de-concurrencia-y-corrección-propuesta).

---

## 4. Auditorías 2 y 3: prospecto, cliente registrado o ambos

### 4.1 Cómo se decide la rama

`Buscar Contacto` busca en `contactos` por `whatsapp`. `Resolver contacto` calcula:

```text
es_cliente_registrado = el contacto existe Y tiene cliente_id
```

Por lo tanto, **un contacto sin `cliente_id` se trata como prospecto**. `¿Cliente existente?` evalúa `{{ $json.es_cliente_registrado }}`:
- **[T]** no tiene conexión;
- **[F]** sigue a `Buscar prospecto`.

Ambas rutas usan el teléfono en el mismo formato: dígitos con prefijo `593`.
- `Normalizar mensaje` convierte `0…` y `+593…` a `593…`.
- `Buscar prospecto intervención humana` compara `regexp_replace(telefono, '\D', '', 'g')` contra el teléfono en dígitos.

### 4.2 Tabla por tipo de actor

| | A: solo prospecto | B: solo cliente registrado | C: cliente y prospecto |
|---|---|---|---|
| Rama inicial | `¿Cliente existente?` [F] → `Buscar prospecto` | `¿Cliente existente?` [T], sin conexión | `¿Cliente existente?` [T], sin conexión |
| ENTRANTE guardado | SI | NO | NO |
| Eco humano SALIENTE guardado | SI | NO | SI, si tiene conversación de WhatsApp |
| `requiere_humano` levantado | SI | NO | SI |
| Conversación encontrada | SI | NO | SI o NO |
| Entra al Wait | Solo si la bandera estaba en false | NO | NO |
| Llama a la IA | NO (salvo la ventana) | NO | NO |
| Genera SALIENTE automático | NO | NO | NO |
| Llega a `Preparar envío WhatsApp` | NO | NO | NO |
| Puede enviar WhatsApp | NO (salvo la ventana) | NO | NO |
| Fin del mensaje del cliente | Durante la espera: `IF: ¿Procesar turno?` [F]. Después: `Finalizar mensaje atención humana` | `¿Cliente existente?` | `¿Cliente existente?` |
| Fin del eco humano | `Actualizar conversación por intervención humana` | `Buscar prospecto intervención humana` (0 filas, no emite ítems) | `Actualizar conversación por intervención humana`, o `IF ¿Conversación encontrada?` [F] |

### 4.3 Qué pasa hoy en `¿Cliente existente?` [T]

| Pregunta | Respuesta |
|---|---|
| ¿Se guarda el mensaje? | NO. `Guardar mensaje entrante` está en la rama del prospecto |
| ¿Se crea o busca conversación? | NO |
| ¿Puede llegar al cerebro? | NO |
| ¿Puede marcarse `requiere_humano`? | NO desde esta ruta. Solo en el caso C, por la ruta del eco |
| ¿Se registra una intervención humana posterior? | Solo en el caso C, y solo si el prospecto tiene una conversación de WhatsApp |
| ¿Hay alguna posibilidad de que el bot responda? | NO. No existe ningún nodo conectado |
| ¿Simplemente termina? | SÍ. Termina en `¿Cliente existente?` |

**Consecuencia:** con un cliente registrado el bot no puede hablar encima del humano, pero tampoco queda historial, contexto ni notificación interna. Ya estaba documentado en [FLUJO-WORKFLOW-PEGASO.md §18](../FLUJO-WORKFLOW-PEGASO.md), observación 2.

---

## 5. Auditoría 4: eco humano "Perfecto estimada"

| Paso | Nodo | Resultado |
|---|---|---|
| 1 | `Normalizar evento WhatsApp` | `direccion = SALIENTE`, `clasificacion_mensaje = SALIENTE_HUMANO`, `es_mensaje_humano_pegaso = true`, `es_mensaje_entrante = false` |
| 2 | `IF: ¿Comando administrador?` | [F] |
| 3 | `IF: ¿Mensaje humano de Pegaso?` | [T]: `direccion === 'SALIENTE' \|\| es_mensaje_humano_pegaso === true` |
| 4 | `Normalizar intervención humana` | `intervencion_humana = true`, `origen_mensaje = HUMANO`, teléfono solo en dígitos |
| 5 | `Buscar prospecto intervención humana` → `IF: ¿Prospecto encontrado?` | [T] si existe un prospecto activo de WhatsApp |
| 6 | `Marcar prospecto requiere humano2` | `requiere_humano = COALESCE(requiere_humano, FALSE) OR TRUE`, siempre TRUE; `ultima_accion = DERIVAR_HUMANO` |
| 7 | `Buscar conversación intervención humana` → `IF ¿Conversación encontrada?` | Conversación de WhatsApp más reciente del prospecto |
| 8 | `Preparar mensaje humano saliente` → `Guardar mensaje humano saliente` | SALIENTE con contenido "Perfecto estimada", su `mensaje_externo_id` y `procesado = true`; `ON CONFLICT DO NOTHING` |
| 9 | `Actualizar conversación por intervención humana` | Fin |

**Por qué nunca entra al cerebro:** el evento sale con `procesable = true`, pero eso no importa. El IF humano evalúa antes que `If: ¿Evento WhatsApp procesable?` y n8n envía cada ítem por una sola salida. Para llegar a la ruta del cliente, el eco tendría que perder a la vez `direccion = SALIENTE` y `es_mensaje_humano_pegaso = true`, y el normalizador fija ambos para todo eco.

---

## 6. Auditoría 5: eco automático de WhatsApp Business

Texto probado: "Claro, con mucho gusto le podemos ayudar 🤗. En qué medidas requiere sus etiquetas…".

| Comprobación | Resultado |
|---|---|
| Clasificación | `SALIENTE_AUTOMATICO` (huella `RESPUESTA_ANUNCIO_MEDIDAS`) |
| `accion_equivalente` | `PEDIR_MEDIDAS` |
| Marca humano | NO: `intervencion_humana = false`; el SQL deja FALSE en FALSE y no cambia `ultima_accion` |
| Entra al cerebro | NO, va a la ruta de salida |
| Queda en el historial | SÍ, como `[AUTOMATICO WHATSAPP BUSINESS · accion=PEDIR_MEDIDAS] Claro, con mucho gusto…` |
| `Preparar contexto IA` lo reconoce | SÍ: `ultimo_saliente.accion_equivalente = PEDIR_MEDIDAS` y `medidas_ya_solicitadas = true` |
| El siguiente mensaje real se procesa | SÍ, la guardia no lo cuenta como humano |

Con "Para envases de jugos" como siguiente mensaje, el bot envía una sola respuesta: "Gracias. Para cotizar sus etiquetas solo nos falta el ancho y alto en centímetros."

---

## 7. Auditoría 6: "Permítame un momento…" repetido

### 7.1 Rutas que llegan a la transición

```text
Enrutar acción comercial (salida 19, DERIVAR_HUMANO) ─┐
Preparar derivación imagen fallida ───────────────────┼─> Preparar derivación humana
Preparar handoff entrada no soportada ────────────────┘     -> Marcar prospecto requiere humano
  (desde IF: ¿Derivación directa por entrada?               -> Preparar contexto handoff
   y desde 4 fallos de descarga o transcripción de audio)   -> Guardar contexto handoff
                                                            -> Preparar mensaje transición humano
                                                            -> Guardar mensaje transición humano
                                                            -> Preparar envío WhatsApp
                                                            -> If:¿Enviar por WhatsApp? -> YCloud Enviar Wts
```

A `Preparar envío WhatsApp` llegan tres rutas: `Guardar mensaje saliente`, `Guardar mensaje comercial` y `Guardar mensaje transición humano`. La rama de derivación no tiene ningún anti-duplicado:
- el texto de transición es fijo;
- `Guardar mensaje transición humano` lo guarda sin `mensaje_externo_id` y con `procesado = false`;
- el ENTRANTE que originó la derivación no se marca como procesado.

`IF: ¿Derivación directa por entrada?` evalúa `puede_responder_bot` sobre la fila que devuelve `Guardar mensaje entrante`, que no tiene ese campo. En la práctica nunca va a [T].

### 7.2 Respuestas

| Pregunta | Respuesta | Evidencia |
|---|---|---|
| ¿Una sola entrada puede producir más de una transición? | Con texto, **NO**: cada nodo de la cadena usa `.first()`. Con dos o más audios que fallan en puntos distintos, **SÍ** (probabilidad baja) | `Preparar audio del turno` emite un ítem por audio, y `Preparar handoff entrada no soportada` puede ejecutarse una vez por cada rama de error |
| ¿Dos ejecuciones concurrentes pueden producirla? | **SÍ** | Reproducido con `Resolver turno conversacional` real (ver [§7.3](#73-reproducción)) |
| ¿Un eco puede volver a dispararla? | **NO** | Los ecos solo van a la ruta humana |
| ¿Una ejecución que ya estaba en el Wait puede derivar después de que otra derivó? | **SÍ** | El nodo no relee `requiere_humano` ni revisa SALIENTE del bot posteriores a su mensaje |
| ¿`mensaje_externo_id` u otro mecanismo lo evita? | **NO** | La transición no lleva `mensaje_externo_id`. El índice único solo protege ecos repetidos |

### 7.3 Reproducción

| id | Dirección | Contenido | Estado |
|---|---|---|---|
| 901 | ENTRANTE | "Quiero un precio especial por volumen" | Lo procesa la ejecución E1 (ya pasó su Wait) |
| 902 | ENTRANTE | "¿me pueden hacer descuento?" | Llega mientras E1 está en el cerebro; la ejecución E2 pasa el chequeo de bandera antes del Wait porque E1 aún no la levantó |
| 903 | SALIENTE | "Permítame un momento por favor, ya verificamos su requerimiento." | E1 la guarda después de que 902 ya está en la base |

Resultado para E2:
- `Resolver turno conversacional` devuelve `PROCESAR` con turno `[901, 902]`.
- El 901 entra en el turno porque sigue con `procesado = false`.
- La transición 903 no sirve de frontera, porque su id es mayor que 902.
- Si el cerebro vuelve a decidir `DERIVAR_HUMANO`, sale una **segunda** transición idéntica.
- Si E1 todavía no guardó su transición, el resultado es el mismo.

### 7.4 Ruta exacta que sigue abierta

El mensaje k+1 del cliente tiene que llegar:
- **después** de que la ejecución k pasó `Resolver turno conversacional`, es decir, más de 3 s después del mensaje k (si no, el debounce lo absorbe);
- **antes** de que la ejecución k ejecute `Marcar prospecto requiere humano`.

Ese margen dura lo que tarda la IA más algunos nodos Postgres: aproximadamente 1–5 s, y más si entran los modelos de respaldo. Tres mensajes seguidos con ese ritmo dan tres transiciones.

En producción existe hoy una segunda vía que **este push cierra**: `Actualizar prospecto comercial` escribía `requiere_humano` con la decisión de la IA. Una ejecución concurrente que no derivaba volvía a poner la bandera en false, y los mensajes siguientes volvían a pasar.

---

## 8. Auditoría 7: quién escribe `requiere_humano`

| Nodo | Operación | Valor | Condición | Puede poner FALSE | Puede poner TRUE |
|---|---|---|---|---|---|
| `Crear prospecto` | INSERT en `prospectos` | `false` | El teléfono no tiene prospecto activo | Solo al crear el prospecto | NO |
| `Marcar prospecto requiere humano` | UPDATE por `id` | `true` (más `ultima_accion = DERIVAR_HUMANO`) | Cualquier derivación ([§7.1](#71-rutas-que-llegan-a-la-transición)) | NO | SÍ |
| `Marcar prospecto requiere humano2` | UPDATE (SQL) | `COALESCE(requiere_humano, FALSE) OR intervencion_humana` | Cada eco con prospecto encontrado | NO (solo convierte NULL en FALSE con un eco automático) | SÍ, con un eco humano |
| `Actualizar prospecto comercial` | UPDATE | Columna quitada del mapeo (`removed: true`) | — | NO | NO |
| `Actualizar estado prospecto` | UPDATE | Columna fuera del mapeo | — | NO | NO |
| `Actualizar prospecto cotizado` | UPDATE | Columna fuera del mapeo | — | NO | NO |

**Lectores:**
- `¿Requiere atención humana?` lee `$('Unificar prospecto').first().json.prospecto_requiere_humano === true`.
- `Buscar prospecto intervención humana` devuelve la columna, pero ningún nodo la usa.

El cerebro, `Normalizar decisión IA`, `Resolver contexto comercial` y `Preparar derivación humana` manejan `requiere_humano` solo como campo del JSON del turno; ninguno escribe la columna.

**Conclusión:** ningún turno normal del bot puede deshacer una intervención humana. La bandera solo vuelve a FALSE con un cambio manual en la base.

**No verificable desde el repo:** si existen triggers de base de datos sobre esta columna. El repo no tiene el SQL del esquema.

---

## 9. Auditoría 8: guardia después del Wait

### 9.1 Reglas

- **Cuándo detiene el turno:** si existe un SALIENTE humano con id mayor que el mensaje del cliente, o si el último SALIENTE humano tiene `enviado_at` de hace 10 minutos o menos (`HUMANO_ACTIVO_MINUTOS = 10`). La hora de referencia es `Date.now()` del servidor n8n en `Resolver turno conversacional`.
- **Cómo distingue el origen** (`origenSaliente`):

| Origen | Regla | Ejemplos |
|---|---|---|
| BOT | SALIENTE sin `mensaje_externo_id` | Respuestas, cotizaciones, transiciones, marcadores de omisión |
| AUTOMATICO | Contenido que empieza con `[AUTOMATICO WHATSAPP BUSINESS` | Respuestas automáticas de la app |
| HUMANO | Cualquier otro SALIENTE con `mensaje_externo_id` | Mensajes escritos por una persona |

- `enviado_at` del eco viene del evento de YCloud (con respaldo en la hora actual). Si el eco llega tarde con una hora antigua, igual lo detecta la regla del id posterior.

### 9.2 Resultados

Escenario: el prospecto tiene la bandera ya reseteada a mano y el cliente escribe X minutos después del último mensaje humano.

| Minutos desde el humano | Guardia | Resultado |
|---|---|---|
| 2 | `INTERVENCION_HUMANA_RECIENTE` | No responde |
| 9 | `INTERVENCION_HUMANA_RECIENTE` | No responde |
| 9,99 | `INTERVENCION_HUMANA_RECIENTE` | No responde |
| 10,01 | — | Responde |
| 11 | — | Responde |
| 30 | — | Responde |
| Eco AUTOMATICO hace 1 min | — | Responde (no bloquea) |
| SALIENTE del BOT hace 1 min | — | Responde (no bloquea) |

### 9.3 Cuándo puede volver a responder el bot

Primero corta la bandera. Mientras `prospectos.requiere_humano` siga en TRUE (y el eco humano la deja así), `¿Requiere atención humana?` envía cada mensaje a `Finalizar mensaje atención humana` antes del Wait, a los 11, a los 30 o a cualquier cantidad de minutos.

El bot vuelve a responder solo cuando se cumplen las dos condiciones:
1. alguien puso `requiere_humano = false` en la base;
2. el mensaje del cliente llega más de 10 minutos después del último mensaje humano.

No existe expiración automática.

---

## 10. Auditoría 9: lead de anuncio

**Secuencia:** bienvenida automática → el cliente pregunta el precio → respuesta automática que pide medidas → el cliente responde "para envases de jugos".

| Comprobación | Resultado |
|---|---|
| Espera del primer mensaje del anuncio | 10 s (`PRIMER_CONTACTO_ANUNCIO`) |
| Ecos automáticos (bienvenida y medidas) | Ruta de salida, 0 llamadas a la IA, no levantan la bandera |
| Mensaje del precio, ecos dentro de los 10 s, IA decide `PEDIR_MEDIDAS` | 0 envíos: `MEDIDAS_YA_SOLICITADAS` |
| Mensaje del precio, ecos dentro de los 10 s, IA decide `RESPONDER_GENERAL` | 1 envío con la respuesta general; no repite la pregunta de medidas |
| "para envases de jugos" | Turno solo con ese mensaje; 1 envío: "Gracias. Para cotizar sus etiquetas solo nos falta el ancho y alto en centímetros." |
| Bloqueo humano | Ninguno |

**Caso que sí duplica:** si el eco automático de medidas llega **después** de que termina la espera, el bot no lo ve. Pregunta "¿En qué medidas necesita sus etiquetas? Indíquenos ancho y alto por favor." y el cliente recibe dos preguntas de medidas. Pasa en dos situaciones:
- en el primer mensaje, si el eco tarda más de 10 s;
- en un mensaje posterior que dispara la respuesta automática, porque espera solo 3 s: `Preparar contexto IA` actualiza `contexto_comercial.sesion.actualizado_at` en cada turno, así que el segundo mensaje ya no cuenta como primer contacto.

En ejecuciones reales ese eco tardó entre 2 y 8 s.

---

## 11. Auditoría 10: ventana de concurrencia y corrección propuesta

### 11.1 Dónde está la ventana

**Escenario:** la ejecución A llama a la IA → el humano escribe → A termina → A envía.

```text
[eco humano llega y se guarda: webhook + 5 nodos Postgres]
                    │
Recuperar historial conversación ── Resolver turno conversacional (guardia) ──► ... ──► YCloud Enviar Wts
                    └──────────────── ventana: la guardia ya no vuelve a mirar ───────────┘
```

Cuando el humano escribe, ya corrieron: `Webhook YCloud` → … → `Guardar mensaje entrante` → `Obtener configuración MODO_PRUEBA` → `Resolver permiso automatización` → `¿Requiere atención humana?` → `Wait` → `Recuperar historial conversación` → `Resolver turno conversacional`.

Lo que todavía falta en una respuesta de texto:
1. `IF: ¿Procesar turno?`, `Preparar media del turno` y `Preparar audio del turno`.
2. `Preparar contexto IA` → `IF: ¿Requiere cerebro comercial?` → `Cerebro comercial Groq`, con respaldo en DeepSeek y OpenAI.
3. `Normalizar decisión IA` → `Resolver contexto comercial` → `Aplicar reglas comerciales determinísticas`.
4. `Guardar contexto comercial` → `Preparar actualización prospecto` → `Actualizar prospecto comercial`.
5. `Recuperar decisión comercial` → `Enrutar acción comercial`.
6. `Preparar respuesta comercial` → `Guardar mensaje saliente` → `Preparar envío WhatsApp` → `If:¿Enviar por WhatsApp?` → `YCloud Enviar Wts`.

### 11.2 Duración estimada

Estimación por tipo de nodo; no se midieron ejecuciones.

| Ruta | Ventana aproximada |
|---|---|
| Reglas previas a la IA (saludo, producto no P4) | Menos de 1 s |
| Texto con cerebro | 2–5 s |
| Imagen, audio o cotización (con extractor de IA y unos 10 nodos Postgres) | 5–20 s |
| Con modelos de respaldo | Más de 20 s |

A esto se suma, antes de la guardia, el tiempo que tarda el eco en llegar y guardarse.

**Efecto máximo:** solo las ejecuciones que ya pasaron la guardia pueden enviar; normalmente es una. Los mensajes posteriores del cliente quedan cortados por la bandera.

### 11.3 Corrección mínima (documentada, sin implementar)

`Preparar envío WhatsApp` es el único punto por donde pasan las tres rutas de envío. Una verificación de último momento ahí cierra la ventana humana y las transiciones duplicadas a la vez.

1. **Nodo Postgres nuevo** "Verificar envío vigente", entre los tres `Guardar mensaje …` y `Preparar envío WhatsApp`. Devuelve la fila recién guardada más `envio_bloqueado`, que es verdadero si existe en la misma conversación:
   - un SALIENTE humano (con `mensaje_externo_id` y sin el prefijo automático) con id mayor que el último mensaje del turno; **o**
   - otro SALIENTE del bot, que no sea marcador de omisión, entre el último mensaje del turno y la fila propia (otra ejecución ya respondió ese turno).

   El último mensaje del turno se toma de `$('Resolver turno conversacional').first().json.mensaje_id`. Cuando la ruta no pasó por ese nodo, se usa `$('Guardar mensaje entrante').first().json.id`. En la misma consulta, si se bloquea, la fila se marca con el prefijo `[RESPUESTA AUTOMÁTICA OMITIDA · motivo=…]` para que no quede en el historial como enviada.
2. **`Preparar envío WhatsApp` 2.1 → 2.2:** si `envio_bloqueado`, pone `enviar_whatsapp = false` con un motivo nuevo (por ejemplo `HUMANO_O_RESPUESTA_POSTERIOR`).
3. **Documentación:** `FLUJO-WORKFLOW-PEGASO.md` (nodo nuevo y conteos) y un fixture del caso de [§7.3](#73-reproducción).

**Lo que queda después de la corrección:** el tiempo entre la consulta y la llamada HTTP a YCloud, del orden de decenas de milisegundos.

**Variante más chica, solo para el "Permítame":** convertir `Marcar prospecto requiere humano` en un `UPDATE … SET requiere_humano = TRUE WHERE id = … AND requiere_humano IS NOT TRUE RETURNING id`. Si no actualiza ninguna fila, otra ejecución ya derivó y no se envía la transición. No cubre la ventana humana.

---

## 12. Auditoría 11: precios

| Nodo | ¿Modificado? | ¿Lo necesita el cambio conversacional? |
|---|---|---|
| `Calcular precio detalle` | NO (sin diff) | NO |
| `Aplicar mínimo de impresión` | NO (sin diff) | NO |
| `Preparar mensaje cotización` | NO (sin diff) | NO |
| `Aplicar reglas comerciales determinísticas` (incluye la derivación por 6000 o más) | NO (sin diff) | NO |

Los cambios conversacionales no interfieren con la cotización:
- las reglas previas a la IA solo cubren el saludo simple y los productos que no son P4, así que `COTIZAR_P4` sigue pasando por el cerebro;
- el reemplazo de promesas de fecha excluye `COTIZAR_P4` y `DERIVAR_HUMANO`;
- la regresión de precios da `TODOS LOS CASOS OK` y la derivación por 6000 o más sigue funcionando.

---

## 13. Riesgos residuales

Solo se listan riesgos demostrables en el código actual.

| # | Riesgo | Probabilidad | ¿Existe hoy en producción? | Lo cierra |
|---|---|---|---|---|
| 1 | Ventana entre la guardia y el envío: una ejecución en curso responde después del humano | Media en conversaciones activas | SÍ, y más amplia | [§11.3](#113-corrección-mínima-documentada-sin-implementar) |
| 2 | "Permítame un momento…" duplicado por derivaciones concurrentes | Media si el cliente escribe varios mensajes con 3–8 s de separación | SÍ, más una vía adicional que el push cierra | [§11.3](#113-corrección-mínima-documentada-sin-implementar) o la variante de `Marcar prospecto requiere humano` |
| 3 | Pregunta de medidas doble si el eco automático llega después de la espera | Baja en el primer mensaje (espera de 10 s), media en mensajes posteriores (3 s) | SÍ | Pendiente; requiere una espera más larga tras un eco automático reciente |
| 4 | El humano escribe primero a un número sin prospecto: el eco se pierde, el prospecto se crea con bandera FALSE y el bot responde | Baja | SÍ | Pendiente; registrar el eco aunque no exista prospecto |
| 5 | Si cambia el texto de una plantilla automática de WhatsApp Business, su eco se cuenta como humano y bloquea al bot | Baja, solo al editar plantillas | No aplica (hoy todo eco cuenta como humano) | Mantener `AUTOMATIZACIONES_WHATSAPP_BUSINESS` al día |
| 6 | Turno con dos o más audios que fallan en puntos distintos: dos transiciones | Baja | SÍ | [§11.3](#113-corrección-mínima-documentada-sin-implementar) |
| 7 | Varias conversaciones ACTIVA del mismo prospecto: el eco se guarda en la más reciente, pero `Buscar conversación` toma una ACTIVA sin orden. La bandera sigue protegiendo; solo afecta a la guardia del historial | Baja | SÍ | Pendiente |
| 8 | Clientes registrados sin historial, sin respuesta y sin notificación | Segura para todo cliente con `cliente_id` | SÍ | Decisión de negocio pendiente ([FLUJO §18](../FLUJO-WORKFLOW-PEGASO.md), observación 2) |

---

## 14. Recomendación

**Publicar tal cual.** Retener el push mantiene en producción el código que:
- trata como humanos los ecos automáticos del anuncio;
- apaga la bandera humana en cada turno de la IA (y con eso abre otra vía para repetir el "Permítame");
- solo lee la bandera antes de la espera.

Ninguno de los riesgos de [§13](#13-riesgos-residuales) aparece por estos cambios, y los riesgos 1 y 2 se reducen.

**Siguiente cambio esencial (no bloqueante):** la verificación de último momento antes de `Preparar envío WhatsApp` ([§11.3](#113-corrección-mínima-documentada-sin-implementar)). Es un nodo nuevo y un ajuste en un nodo Code, y cierra los riesgos 1, 2 y 6. Si el negocio necesita que el "Permítame" duplicado quede resuelto antes de publicar, esta es la única corrección que debe ir primero.
