# Roadmap: insistencia única a leads de anuncio que no responden

Muchos prospectos llegan por los anuncios de Facebook, Instagram o Estados de WhatsApp. Tocan el botón del anuncio, envían el mensaje precargado ("¿Precio de las etiquetas adhesivas?", "¡Hola! Quiero más información") y no vuelven a escribir después de que el bot les pide las medidas. Esta rutina les envía **una sola insistencia**, en un horario tranquilo y sin costo. Si no hay respuesta, cierra el prospecto y, a los 180 días, borra sus datos personales.

Documento creado el 17 de noviembre de 2026. Estado: **Sprints 1 y 2 implementados en local, sin publicar** ([reporte Sprint 1](reportes/2026-11-17-insistencia-leads-sprint1.md) · [reporte Sprint 2](reportes/2026-11-17-insistencia-leads-sprint2.md) · [reporte Sprint 3](reportes/2026-11-17-insistencia-leads-sprint3.md)). La rutina y la purga nacen apagadas. Pendientes: el piloto, los ajustes que salgan de él y tres decisiones (sección 8).

Decisiones tomadas por Pegaso:

| Tema | Decisión |
|---|---|
| Canal del mensaje | Mensaje directo desde n8n por YCloud, **sin plantilla aprobada por Meta** |
| Cantidad | Una sola insistencia por prospecto (y como máximo una cada 30 días) |
| Horario | Fuera de horas pico y del almuerzo (sección 3) |
| Sin respuesta | Cierre lógico a las 48 h del envío |
| Datos | Anonimización de los prospectos cerrados a los 180 días |

---

## 1. Reglas de Meta que aplican

### 1.1 Las dos ventanas

| Ventana | Cuándo se abre | Qué se puede enviar | Costo |
|---|---|---|---|
| **Atención al cliente (24 h)** | Cada vez que el cliente escribe. Se reinicia con cada mensaje suyo | Cualquier mensaje libre: texto, botones, imágenes. **No hace falta plantilla** | Desde el 1-oct-2026, 1.000 mensajes gratis al mes por número; después se cobra cada mensaje entregado |
| **Entrada gratuita (FEP)** | El cliente escribe desde un anuncio de clic a WhatsApp en el celular (no en web ni escritorio) **y** el negocio responde dentro de 24 h | Todo, plantillas incluidas | **Gratis** mientras está abierta, hasta 7 días según la documentación de Meta |

**Por qué no se necesita plantilla:** Meta solo exige plantilla aprobada para escribir cuando ya pasaron 24 h desde el último mensaje del cliente. Esta rutina **siempre** envía dentro de esas 24 h (la sección 3 lo demuestra). Por eso puede mandar un mensaje libre, con botones incluidos, directamente desde n8n.

**Por qué no tiene costo:** el bot responde al instante a los leads de anuncio, así que la ventana gratuita queda abierta y la insistencia sale gratis. En el peor caso, si Meta no la marca como gratuita, se descuenta de los 1.000 mensajes gratis del mes.

**Contrapartida:** si por algún motivo la ventana de 24 h se cierra antes del envío (por ejemplo, n8n estuvo caído), **ese lead se pierde**: la rutina lo marca `EXPIRADO` y no le escribe. Es una decisión consciente para no depender de plantillas.

### 1.2 Lo que hay que cuidar: la calidad del número

El riesgo real no es el costo. Si los clientes bloquean o reportan el número, Meta baja su *quality rating* y puede limitar los envíos de toda la cuenta. Las reglas de la rutina responden a eso:

- **Una sola insistencia** por prospecto y como máximo una cada 30 días. En los chats revisados hubo prospectos que tocaron el anuncio dos días seguidos; deben recibir una sola insistencia.
- **Botón "Ya no, gracias"**: le da al cliente una salida educada que no sea bloquear.
- **Solo leads de anuncio que no conversaron**: se excluye a quien habló con un humano, recibió cotización o ya es cliente.
- **Horario tranquilo**, nunca de madrugada ni en horas pico.
- Revisar la *quality rating* en WhatsApp Manager cada semana durante el primer mes.

### 1.3 Cambio de precios del 1 de octubre de 2026

- Los mensajes libres dentro de las 24 h dejaron de ser ilimitados: hay 1.000 gratis al mes por número y después se cobran.
- Debe haber un **método de pago activo** en Meta/YCloud. Sin él, los mensajes se dejan de entregar al agotar los 1.000 gratuitos (esto afecta a todo el bot, no solo a esta rutina).
- La ventana gratuita de los anuncios sigue vigente.

---

## 2. Qué existe hoy en el sistema

| Pieza | Estado | Dónde |
|---|---|---|
| Detección de lead de anuncio (`es_lead_anuncio`, `ctwa_clid`, tipo de origen) | Existía sin guardarse. **Sprint 1:** se guarda en el prospecto (`origen`, `ultimo_anuncio_*`) | [normalizar-evento-whatsapp.js](../code/_extraidos/normalizar-evento-whatsapp.js), "Guardar mensaje entrante" |
| Envío por YCloud (`POST https://api.ycloud.com/v2/whatsapp/messages`) | Existe | Nodos HTTP de salida |
| Disparador programado con reserva y reintento | Existe ("Reintentar avisos humanos"), sirve de modelo | `notificaciones_humano` en [preventa-eficiencia.sql](../schema/preventa-eficiencia.sql) |
| Respuestas de botón del cliente | Antes se derivaban como entrada no soportada (`MENSAJE_INTERACTIVO_NO_PROCESABLE`). **Sprint 1:** entran como `TEXTO` al flujo normal | [normalizar-evento-whatsapp.js](../code/_extraidos/normalizar-evento-whatsapp.js), [preparar-entrada-whatsapp.js](../code/_extraidos/preparar-entrada-whatsapp.js) |
| Columna `prospectos.origen` | Siempre `WHATSAPP`. **Sprint 1:** `ANUNCIO_META` si el primer mensaje llegó desde un anuncio | [pegaso_schema.sql](../schema/pegaso_schema.sql) |
| Dirección de mensajes | `mensajes.direccion` = `ENTRANTE` / `SALIENTE` | `pegaso.mensajes` |
| Webhooks de estado de YCloud (entregado, leído, precio) | Llegaban como `whatsapp.message.updated` y se descartaban. **Sprint 2:** se registran en el seguimiento de cada insistencia (entrega, `categoria_precio`, `precio_total`) | [normalizar-evento-whatsapp.js](../code/_extraidos/normalizar-evento-whatsapp.js) |
| "Buscar prospecto" | Filtra `activo = true`. Si un prospecto queda con `activo = false` y vuelve a escribir, "Crear prospecto" choca con el índice único `(telefono, canal)`. **Por eso el cierre lógico no usa `activo`** | Nodo "Buscar prospecto" |

---

## 3. Horario de envío

### 3.1 Franjas permitidas (hora de Ecuador, `America/Guayaquil`)

Se evitan las horas en que la gente está ocupada:

| Hora | Situación | ¿Se envía? |
|---|---|---|
| 07:00 – 10:00 | Hora pico de la mañana | No |
| **10:00 – 12:30** | Media mañana, ya instalados | **Sí: franja A** |
| 12:30 – 15:00 | Llegada al almuerzo y almuerzo (13:00 – 15:00) | No |
| **15:00 – 16:00** | Sobremesa | **Sí: franja B** |
| 16:00 – 18:30 | Hora pico de la tarde (16:00 – 18:00) y 30 min de margen por el tráfico | No |
| **18:30 – 20:30** | En casa, descansando | **Sí: franja C** |
| 20:30 – 10:00 | Noche y madrugada | No |

Los márgenes de 30 min (12:30 y 18:30) son una propuesta y quedan como parámetros configurables.

### 3.2 Cuándo se envía

1. **Espera mínima:** 4 h desde el último mensaje del bot sin respuesta del cliente.
2. Se envía en la **primera franja permitida** después de esa espera.
3. **Control de seguridad:** solo se envía si faltan al menos 30 min para que cierre la ventana de 24 h (contada desde el último mensaje del cliente). Si no, el seguimiento queda `EXPIRADO`.

**El envío siempre cae dentro de la ventana.** El hueco más largo entre franjas va de 20:30 a 10:00 (13,5 h). En el peor caso, el envío sale 4 h + 13,5 h = **17,5 h** después del mensaje del cliente, por debajo de las 23,5 h del límite con margen.

Comprobación con las horas de los chats revisados:

| Cliente escribe | Espera hasta | Se envía | Saludo | Ventana cierra |
|---|---|---|---|---|
| 01:28 | 05:28 | 10:00 (franja A) | Buenos días | 01:28 del día siguiente |
| 05:05 | 09:05 | 10:00 (A) | Buenos días | 05:05 del día siguiente |
| 07:48 | 11:48 | 11:48 (A) | Buenos días | 07:48 del día siguiente |
| 12:00 | 16:00 | 18:30 (C) | Buenas noches | 12:00 del día siguiente |
| 16:12 | 20:12 | 20:12 (C) | Buenas noches | 16:12 del día siguiente |
| 17:30 | 21:30 | 10:00 del día siguiente (A) | Buenos días | 17:30 del día siguiente |
| 21:07 | 01:07 | 10:00 del día siguiente (A) | Buenos días | 21:07 del día siguiente |
| 22:53 | 02:53 | 10:00 del día siguiente (A) | Buenos días | 22:53 del día siguiente |

### 3.3 Saludo según la hora real de envío

| Hora de envío | Saludo |
|---|---|
| antes de 12:00 | Buenos días |
| 12:00 – 17:59 | Buenas tardes |
| desde 18:00 | Buenas noches |

---

## 4. El mensaje

Mensaje interactivo con dos botones de respuesta. Dentro de la ventana de 24 h no requiere plantilla.

> **{Saludo}** 👋 Nos escribió por etiquetas adhesivas, ¿aún le interesa? Si nos indica el ancho y alto en centímetros le cotizamos de inmediato.
>
> [ Sí, quiero cotizar ]  [ Ya no, gracias ]

- "¿Aún le interesa?" reemplaza a "¿aún está interesado?" para no asumir el género del cliente.
- Los títulos de botón tienen como máximo 20 caracteres, según exige WhatsApp.
- Ids de los botones: `SEG_SI` y `SEG_NO`.

Cuerpo de referencia para YCloud:

```json
{
  "from": "<número del negocio>",
  "to": "<teléfono del cliente>",
  "type": "interactive",
  "interactive": {
    "type": "button",
    "body": { "text": "Buenas noches 👋 Nos escribió por etiquetas adhesivas, ¿aún le interesa? Si nos indica el ancho y alto en centímetros le cotizamos de inmediato." },
    "action": {
      "buttons": [
        { "type": "reply", "reply": { "id": "SEG_SI", "title": "Sí, quiero cotizar" } },
        { "type": "reply", "reply": { "id": "SEG_NO", "title": "Ya no, gracias" } }
      ]
    }
  }
}
```

### Qué pasa con cada respuesta

| El cliente… | El sistema… |
|---|---|
| Toca **"Sí, quiero cotizar"** (o escribe solo "sí", "claro", "me interesa") | Marca el seguimiento `RESPONDIDO` y responde sin IA pidiendo las medidas. Como las medidas ya se pidieron, el resolver usa su texto aprobado: *"Gracias. Para cotizar sus etiquetas solo nos falta el ancho y alto en centímetros."* |
| Toca **"Ya no, gracias"** (o escribe solo "no gracias", "no me interesa", "por ahora no") | Con el botón marca `RECHAZADO` (no se le vuelve a escribir nunca). Responde sin IA con el texto aprobado de rechazo del resolver: *"Cualquier duda o inquietud hágamela saber, estamos para servirle."* |
| Escribe cualquier otra cosa (medidas, preguntas) | Marca `RESPONDIDO` y sigue el flujo normal |
| No responde en 48 h | Marca el seguimiento `SIN_RESPUESTA`. Si vuelve a escribir algún día, el flujo normal lo atiende y el seguimiento pasa a `RESPONDIDO` |

El estado de la insistencia vive solo en `seguimientos_prospecto`. **`prospectos.estado` no se toca**: el flujo comercial reescribe ese campo en cada turno con el valor que leyó al inicio, y pisaría cualquier cambio hecho a mitad del turno.

---

## 5. Quién recibe la insistencia

Todas estas condiciones deben cumplirse:

1. El prospecto llegó por un **anuncio** (`prospectos.origen = 'ANUNCIO_META'`, ver fase 1).
2. No es cliente registrado, está `activo`, no tiene `requiere_humano = true` y no hubo intervención humana en la conversación.
3. **No conversó:** como máximo 2 mensajes entrantes en total (`max_mensajes_cliente`), sin cotización, medidas ni derivación en `contexto_comercial`, y la línea de producto es etiquetas (o no se conoce). *Primera versión, centrada en los "chats de un solo toque". Más adelante se puede ampliar a quien abandona a mitad de la conversación.*
4. El **último mensaje** de la conversación es saliente (del bot o la automatización de WhatsApp Business), pasaron al menos 4 h desde él y el cliente escribió hace menos de 24 h.
5. No recibió ninguna insistencia en los últimos **30 días** (las `CANCELADO` no cuentan) y nunca tocó "Ya no, gracias".
6. Su teléfono está permitido: `INSISTENCIA_LEADS.telefonos_permitidos` (si no está vacía) y `MODO_PRUEBA` (si está activo; el comando STOP lo activa).

### Configuración (`configuracion_bot`, clave `INSISTENCIA_LEADS`)

La migración la crea **apagada**. Se cambia con un `UPDATE` sin volver a publicar el workflow.

| Campo | Valor inicial | Para qué |
|---|---|---|
| `activo` | `false` | Interruptor general |
| `telefonos_permitidos` | `[]` | Si tiene números, solo se insiste a esos (pruebas y piloto) |
| `limite_diario` / `limite_por_corrida` | 20 / 10 | Tope de envíos por día (hora de Ecuador) y por corrida de 15 min |
| `espera_minima_horas` | 4 | Espera desde el último mensaje del bot |
| `cierre_sin_respuesta_horas` | 48 | Paso a `SIN_RESPUESTA` |
| `max_mensajes_cliente` | 2 | Máximo de mensajes del cliente para considerarlo "de un solo toque" |
| `franjas` | `[["10:00","12:30"],["15:00","16:00"],["18:30","20:30"]]` | Franjas de envío, hora de Ecuador |
| `telefono_emisor` | `593962645735` | Número de Pegaso en YCloud |
| `producto_texto` | `etiquetas adhesivas` | Texto de "Nos escribió por …" |

Encender solo para un número de prueba:

```sql
UPDATE pegaso.configuracion_bot
SET valor_json = valor_json || '{"activo": true, "telefonos_permitidos": ["5939XXXXXXXX"]}'::jsonb,
    actualizado_at = now()
WHERE clave = 'INSISTENCIA_LEADS';
```

---

## 6. Fases

### Fase 0: Prerrequisitos (sin código)

- [ ] Confirmar que hay un **método de pago activo** en Meta/YCloud (obligatorio desde el 1-oct-2026 para todo el bot).
- [ ] Anotar la *quality rating* actual del número en WhatsApp Manager, como punto de partida.
- [ ] Verificar que el webhook de YCloud tenga activado el evento **`whatsapp.message.updated`** (entregado/leído y precio). Sin él, la rutina funciona igual, pero no registra si el envío fue gratis: habría que revisarlo en el panel de YCloud.
- [ ] Confirmar la zona horaria del workflow en n8n (`America/Guayaquil`).

### Fase 1: Datos (`schema/seguimientos-leads.sql`) · Sprint 1, hecha en local

- [x] Guardar el anuncio en el prospecto desde "Guardar mensaje entrante": `origen = 'ANUNCIO_META'` si es su primer mensaje entrante, y en columnas nuevas `ultimo_anuncio_at`, `ultimo_anuncio_fuente` y `ultimo_ctwa_clid` el anuncio más reciente. Se descartó guardar el `ctwa_clid` en `contexto_comercial` porque el cerebro reescribe ese JSON en cada turno.
- [x] Nueva tabla de seguimientos, con el mismo patrón de reserva que `notificaciones_humano`:

```sql
CREATE TABLE IF NOT EXISTS pegaso.seguimientos_prospecto (
  id bigserial PRIMARY KEY,
  prospecto_id bigint NOT NULL REFERENCES pegaso.prospectos(id),
  conversacion_id bigint NOT NULL REFERENCES pegaso.conversaciones(id),
  tipo text NOT NULL DEFAULT 'INSISTENCIA_LEAD',
  estado text NOT NULL DEFAULT 'PROGRAMADO'
    CHECK (estado IN ('PROGRAMADO','ENVIANDO','ENVIADO','RESPONDIDO',
                      'RECHAZADO','SIN_RESPUESTA','EXPIRADO','CANCELADO','ERROR')),
  ultimo_mensaje_cliente_at timestamptz NOT NULL,
  ventana_cierra_at timestamptz NOT NULL,
  programado_para timestamptz NOT NULL,
  enviado_at timestamptz,
  mensaje_externo_id text,
  texto_enviado text,
  tipo_precio text,            -- free_entry_point / free_customer_service / regular
  respondido_at timestamptz,
  respuesta text,              -- SEG_SI / SEG_NO / TEXTO
  reserva text,
  reservada_hasta timestamptz,
  ultimo_error text,
  creado_at timestamptz NOT NULL DEFAULT now()
);

-- Un solo seguimiento vivo por prospecto (evita duplicados por concurrencia)
CREATE UNIQUE INDEX IF NOT EXISTS uq_seguimiento_vivo
  ON pegaso.seguimientos_prospecto (prospecto_id)
  WHERE estado IN ('PROGRAMADO','ENVIANDO','ENVIADO');

CREATE INDEX IF NOT EXISTS ix_seguimientos_programados
  ON pegaso.seguimientos_prospecto (programado_para)
  WHERE estado = 'PROGRAMADO';
```

- [x] (Sprint 2) Se descartó cambiar `prospectos.estado`: el estado vive en `seguimientos_prospecto` (sección 4). La migración suma columnas de entrega y precio (`wamid`, `estado_entrega`, `categoria_precio`, `precio_total`, `moneda`) y la configuración `INSISTENCIA_LEADS` apagada.

### Fase 2: Entrada de botones (flujo principal)

- [x] En [normalizar-evento-whatsapp.js](../code/_extraidos/normalizar-evento-whatsapp.js): para `interactive.button_reply` / `list_reply` y `button` de plantilla, usar el título como `texto` y conservar el `id` en `respuesta_interactiva` (`SEG_SI` / `SEG_NO`). *Sprint 1.*
- [x] En [preparar-entrada-whatsapp.js](../code/_extraidos/preparar-entrada-whatsapp.js): tratar el botón como `TEXTO` apto para el flujo conversacional. *Sprint 1.*
- [x] (Sprint 2) "Guardar mensaje entrante" marca el seguimiento `ENVIADO` o `SIN_RESPUESTA` de los últimos 30 días como `RECHAZADO` (botón `SEG_NO`) o `RESPONDIDO`. "Preparar contexto IA" responde sin IA al rechazo o la aceptación sola (`INSISTENCIA_RECHAZADA` / `INSISTENCIA_ACEPTADA`).

### Fase 3: Workflow programado "Insistencia a leads" · Sprint 2, hecha en local

Disparador cada 15 min. Las franjas se calculan en SQL con hora de Ecuador, sin depender de la zona horaria de n8n. Detalle nodo por nodo en [FLUJO-WORKFLOW-PEGASO.md §22](FLUJO-WORKFLOW-PEGASO.md#22-insistencia-a-leads-de-anuncio).

1. [x] **Programar:** candidatos de la sección 5 → `PROGRAMADO` en la primera franja, o `EXPIRADO` si no hay franja antes del cierre de la ventana menos 30 min.
2. [x] **Reservar:** dentro de una franja y con la rutina activa, los `PROGRAMADO` que tocan pasan a `ENVIANDO` con `reserva` (`FOR UPDATE SKIP LOCKED`), sin pasar los límites.
3. [x] **Guardia justo antes de enviar** ("Autorizar insistencia lead"): misma reserva, ventana abierta, sin atención humana, el cliente no escribió, sin intervención humana, sin cotización ni derivación. Si algo falla: `CANCELADO` o `EXPIRADO`.
4. [x] **Enviar** el mensaje interactivo por YCloud con el saludo según la hora real.
5. [x] **Registrar:** `ENVIADO`, id de YCloud y texto. Se guarda en `pegaso.mensajes` como `SALIENTE` **sin** `mensaje_externo_id`, igual que los mensajes del bot: varias consultas tratan un saliente con id externo como intervención humana.
6. [x] **Errores:** `ERROR` con `ultimo_error`, sin reintentos. Una reserva que vence sin confirmación también pasa a `ERROR` (no se sabe si salió).
7. [x] **Estados de entrega:** los webhooks `whatsapp.message.updated` (antes descartados) guardan entrega, categoría y precio de cada insistencia.

### Fase 4: Cierre lógico · Sprint 2, hecha en local

- [x] En cada corrida, los seguimientos `ENVIADO` de hace más de 48 h pasan a `SIN_RESPUESTA`. No se tocan `prospectos.estado` ni `activo` ("Buscar prospecto" filtra `activo = true` y un prospecto inactivo que vuelve a escribir haría fallar "Crear prospecto" por el índice único).
- [x] Si el cliente escribe más tarde, el seguimiento pasa a `RESPONDIDO` y el flujo normal lo atiende.

### Fase 5: Purga a los 180 días (rutina semanal, domingo de madrugada)

**Candidatos:** prospectos cuyo último seguimiento es `SIN_RESPUESTA` o `RECHAZADO`, sin mensajes en 180 días, que no son clientes y no tienen cotización, diseño ni pedido.

**Acción:** anonimizar en vez de borrar todo. Así se eliminan los datos personales y se conservan los conteos para las métricas de los anuncios.

| Tabla | Acción |
|---|---|
| `mensajes` de sus conversaciones | Borrar (es lo que más ocupa y contiene datos personales) |
| `ia_llamadas` de sus conversaciones | Borrar |
| `notificaciones_humano` | Borrar |
| `conversaciones` | Conservar la fila; `telefono = 'ANON-' \|\| prospecto_id`; `contexto_comercial = '{}'` |
| `prospectos` | Conservar la fila; `telefono = 'ANON-' \|\| id`; `nombre_whatsapp = NULL`; `ciudad = NULL`; `provincia = NULL` |
| `seguimientos_prospecto`, `metricas_preventa` | Conservar (no tienen datos personales) |

- Se procesan lotes de 500 dentro de una transacción.
- No se usa un hash del teléfono: el espacio de números es pequeño y un hash se puede revertir por fuerza bruta.
- Si la misma persona vuelve a escribir, entra como prospecto nuevo.
- Esto alinea el sistema con la **Ley Orgánica de Protección de Datos Personales** de Ecuador (no conservar datos personales más tiempo del necesario).

**Implementación (Sprint 3, hecha en local):**

- [x] `schema/purga-leads.sql`: columna `prospectos.anonimizado_at`, índice de `ia_llamadas` por conversación y configuración `PURGA_DATOS_LEADS`, que nace con `activo: false` y `simulacion: true`.
- [x] Nodos "Purga leads cada hora" y "Anonimizar leads inactivos" ([FLUJO §22](FLUJO-WORKFLOW-PEGASO.md#purga-a-180-días)). Corre una vez al día a las 03:00 de Ecuador (`hora_local`).
- [x] Además de `SIN_RESPUESTA` y `RECHAZADO`, entran los `EXPIRADO`: leads de un solo toque a los que no se alcanzó a enviar la insistencia.
- [x] También se borra `ultimo_ctwa_clid` (identificador del clic en el anuncio) y el prospecto queda `activo = false`.
- [ ] **Fuera de alcance por ahora:** los leads de anuncio anteriores a la insistencia. No tienen seguimiento ni `origen = ANUNCIO_META` (se empezó a guardar en el Sprint 1), así que la purga no los toca. Ver la decisión pendiente en la sección 8.

### Fase 6: Piloto y métricas

- [ ] Probar en modo prueba con números propios, incluidos los tres caminos (Sí, Ya no, sin respuesta) y un envío nocturno que debe pasar a las 10:00.
- [ ] Una semana real con un máximo de 20 envíos diarios.
- [ ] Medir:
  - % que responde a la insistencia
  - % que llega a cotización
  - % que toca "Ya no"
  - Tipo de precio real en los webhooks
  - Evolución de la *quality rating*

**Criterio para seguir:** la *quality rating* no baja y al menos un 5 % responde. Si la calidad baja, se pausa la rutina.

---

## 7. Riesgos y pendientes de verificar

| Riesgo o duda | Mitigación |
|---|---|
| Los anuncios de **Estados de WhatsApp** quizá no abren la ventana gratuita | Revisar el tipo de precio de los primeros envíos; aunque no la abran, el mensaje entra en los 1.000 gratis del mes |
| Leads desde **WhatsApp Web o escritorio** no abren la ventana gratuita | Mismo caso: entran en los 1.000 gratis |
| Un humano responde desde la app de WhatsApp Business (coexistencia) y la rutina no lo ve | La revalidación del paso 3 revisa la intervención humana y los mensajes salientes que no son del bot |
| n8n caído durante la ventana | El lead queda `EXPIRADO`; se acepta la pérdida |
| Ráfagas de envíos | Máximo 20 por corrida de 15 min |
| Meta cambia las reglas de precio | Revisar la página oficial de precios cada trimestre |

## 8. Plan de sprints

Se divide en tres sprints, cada uno con una entrega propia en producción:

- El sprint 1 toca el flujo principal (entrada de mensajes), así que conviene publicarlo y observarlo solo, sin cambios de comportamiento visibles para el cliente.
- El origen de anuncio empieza a guardarse recién al publicar el sprint 1. Cuanto antes salga, antes hay prospectos con los que la rutina pueda trabajar.
- La purga no tiene urgencia: los primeros prospectos cerrados por la rutina cumplen 180 días medio año después. Se arma después del piloto, con datos reales.

| Sprint | Objetivo | Incluye | Entrega verificable |
|---|---|---|---|
| **1. Base** (sin envíos a clientes) | Preparar datos y entrada | Fase 0 (Pegaso, en paralelo), fase 1 (SQL y guardar origen del lead), fase 2 (respuestas de botón en el flujo principal) | Un lead nuevo de anuncio queda con `origen = 'ANUNCIO_META'`; un botón de prueba enviado a un número propio entra al flujo con su texto |
| **2. Rutina y piloto** | Enviar la insistencia | Fase 3 (workflow programado), fase 4 (cierre a 48 h), respuesta a la insistencia (último punto de la fase 2), webhooks de estado para `tipo_precio`, pruebas en modo prueba y piloto de una semana con máximo 20 envíos diarios | Los tres caminos (Sí, Ya no, sin respuesta) probados con números propios; métricas de la semana piloto |
| **3. Ajuste y purga** | Afinar y limpiar datos | Ajustes según las métricas del piloto (horario, texto, criterio de candidatos), fase 5 (anonimización a 180 días), decidir si se amplía a quien abandona a mitad de conversación | Purga probada en una copia de la base; decisión documentada sobre la ampliación |

Cada sprint termina con un reporte en [docs/reportes/](reportes/README.md) y, si cambia nodos, la actualización de [FLUJO-WORKFLOW-PEGASO.md](FLUJO-WORKFLOW-PEGASO.md).

**Estado del Sprint 3:** la purga (fase 5) está hecha en local ([reporte](reportes/2026-11-17-insistencia-leads-sprint3.md)). Los ajustes por métricas esperan al piloto. Decisiones pendientes de Pegaso:

1. ¿Un "no gracias" **escrito** después de la insistencia bloquea para siempre, igual que el botón "Ya no, gracias"? Hoy bloquea 30 días.
2. ¿Se amplía la insistencia a quien conversó y abandonó a mitad (por ejemplo, recibió la cotización y no respondió)? Conviene decidirlo con los datos del piloto.
3. ¿Se incluyen en la purga los leads de anuncio **anteriores** a la insistencia? Habría que reconocerlos por el texto precargado del anuncio ("¿Precio de las etiquetas adhesivas?", "¡Hola! Quiero más información").

## 9. Fuentes

- [Meta: Pricing on the WhatsApp Business Platform](https://developers.facebook.com/docs/whatsapp/pricing): ventana gratuita de hasta 7 días, 1.000 mensajes gratis al mes, cambios del 1-oct-2026.
- [Meta: Pricing updates](https://developers.secure.facebook.com/docs/whatsapp/pricing/updates-to-pricing)
- [YCloud: Pricing update effective October 1, 2026](https://www.ycloud.com/blog/whatsapp-api-message-pricing-update-effective-october-1-2026)
- [respond.io: WhatsApp API pricing](https://respond.io/blog/whatsapp-business-api-pricing)
