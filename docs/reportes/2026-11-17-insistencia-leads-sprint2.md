# Insistencia a leads de anuncio · Sprint 2: rutina programada, respuesta del cliente y estados de entrega

Estado: preparado en local el 17 de noviembre de 2026. **No publicado en n8n ni commiteado.** Incluye el Sprint 1, que tampoco está publicado ([reporte Sprint 1](2026-11-17-insistencia-leads-sprint1.md)).

**La rutina nace apagada.** Publicar no envía nada a ningún cliente hasta poner `activo: true` en la clave `INSISTENCIA_LEADS` de `configuracion_bot` (sección 6).

**Antes de publicar** hay que ejecutar [`schema/seguimientos-leads.sql`](../../schema/seguimientos-leads.sql) en PostgreSQL. Es el mismo archivo del Sprint 1, ampliado; se puede ejecutar más de una vez.

Roadmap: [ROADMAP-INSISTENCIA-LEADS-ANUNCIO.md](../ROADMAP-INSISTENCIA-LEADS-ANUNCIO.md). Detalle nodo por nodo: [FLUJO-WORKFLOW-PEGASO.md §22](../FLUJO-WORKFLOW-PEGASO.md#22-insistencia-a-leads-de-anuncio).

## 1. Resultado

| Qué | Cómo queda |
|---|---|
| Insistencia | Cada 15 min la rutina busca leads de anuncio "de un solo toque" que llevan 4 h o más sin responder, y les envía **una** insistencia en la primera franja tranquila (10:00–12:30, 15:00–16:00, 18:30–20:30, hora de Ecuador), siempre dentro de la ventana de 24 h. Si no hay franja a tiempo, no se envía |
| Mensaje | *"{Buenos días / Buenas tardes / Buenas noches} 👋 Nos escribió por etiquetas adhesivas, ¿aún le interesa? Si nos indica el ancho y alto en centímetros le cotizamos de inmediato."* con los botones **Sí, quiero cotizar** / **Ya no, gracias**. Mensaje interactivo directo, sin plantilla |
| El cliente toca "Ya no, gracias" | El seguimiento queda `RECHAZADO` y no se le vuelve a escribir. El bot responde sin IA: *"Cualquier duda o inquietud hágamela saber, estamos para servirle."* |
| El cliente toca "Sí, quiero cotizar" | `RESPONDIDO`. El bot responde sin IA pidiendo las medidas: *"Gracias. Para cotizar sus etiquetas solo nos falta el ancho y alto en centímetros."* |
| El cliente escribe otra cosa | `RESPONDIDO` y sigue el flujo normal (cotización, preguntas, etc.) |
| Sin respuesta en 48 h | `SIN_RESPUESTA` (cierre lógico). Si escribe después, pasa a `RESPONDIDO` |
| Costo | Los webhooks de estado registran en cada insistencia la entrega, la categoría y el precio que cobró Meta |
| Control | Interruptor, lista de teléfonos para pruebas, límites diario y por corrida, espera, franjas y texto, todo en `configuracion_bot` sin volver a publicar. También respeta `MODO_PRUEBA` y el comando STOP |

## 2. Decisiones de este sprint

1. **El estado de la insistencia vive solo en `seguimientos_prospecto`.** El roadmap proponía marcar `prospectos.estado` como `SIN_RESPUESTA` / `DESCARTADO`. Al revisarlo encontré que "Actualizar prospecto comercial" reescribe ese campo en cada turno con el valor que "Resolver prospecto" leyó al inicio. Cualquier cambio hecho a mitad del turno se pierde. Por eso `prospectos` no se toca.
2. **Textos de respuesta aprobados.** El roadmap proponía una despedida nueva. "Resolver contexto comercial" ya tiene textos aprobados para el rechazo ("no gracias") y para cuando las medidas ya se pidieron, los mismos que se ven en los chats reales, y los aplica después de la regla nueva. Se respetan para mantener la misma voz.
3. **La insistencia se guarda en `mensajes` sin `mensaje_externo_id`.** Así se guardan todos los mensajes del bot. "Autorizar salida WhatsApp", "Preparar contexto IA" y la detección de intervención humana tratan un saliente **con** id externo como un mensaje escrito por una persona de Pegaso. El id de YCloud se guarda en `seguimientos_prospecto`.
4. **Sin reintentos.** Si YCloud rechaza el envío, o una reserva vence sin confirmación, el seguimiento queda `ERROR`. Reintentar podría duplicar el mensaje, y la regla es una sola insistencia.
5. **Guardia propia antes del envío.** Todo nodo "YCloud Enviar…" del workflow tiene una consulta de autorización y un IF justo antes (lo comprueba un test). La insistencia no responde a un mensaje entrante, así que tiene su propia guardia: "Autorizar insistencia lead".

## 3. Cambios

### Nodos nuevos (12) · workflow de 235 a 247 nodos

| Nodo | Tipo |
|---|---|
| Insistencia leads cada 15 min | Schedule Trigger |
| Programar insistencias leads | Postgres |
| Reservar insistencias leads | Postgres |
| Preparar insistencia lead | Code ([preparar-insistencia-lead.js](../../code/_extraidos/preparar-insistencia-lead.js)) |
| Autorizar insistencia lead | Postgres |
| IF permiso insistencia lead | IF |
| YCloud Enviar insistencia lead | HTTP (credencial existente "YCloud API") |
| Confirmar insistencia enviada | Postgres |
| Registrar error insistencia lead | Postgres |
| Cancelar insistencia lead | Postgres |
| IF: ¿Estado de envío YCloud? | IF, en la rama falsa de "If: ¿Evento WhatsApp procesable?" (antes vacía) |
| Registrar estado insistencia lead | Postgres |

El Code Node nuevo se agregó a `code/_extraidos/manifest.json` a mano, igual que se hizo con "Extraer consumo IA" en la entrega anterior. El siguiente `pull.ps1` lo regenera.

### Nodos modificados

| Nodo | Cambio |
|---|---|
| Normalizar evento WhatsApp (v2.5) | Los webhooks `whatsapp.message.updated` exponen `estado_mensaje` {id, wamid, status, pricing_category, pricing_type, total_price, currency, error}. Siguen sin ser procesables como conversación |
| Preparar conversación | Expone `respuesta_boton_id` (id del botón tocado en este mensaje) |
| Guardar mensaje entrante | Nuevo CTE `seguimiento`: la respuesta del cliente marca la insistencia `ENVIADO` o `SIN_RESPUESTA` de los últimos 30 días como `RECHAZADO` (`SEG_NO`) o `RESPONDIDO`. Nuevo parámetro `$9`. Un webhook duplicado no vuelve a marcarla |
| Preparar contexto IA (v4.25) | Reglas `INSISTENCIA_RECHAZADA` e `INSISTENCIA_ACEPTADA`: si el último saliente es la insistencia y el cliente solo rechaza o acepta, responde sin IA. Con medidas, archivos o más texto sigue el flujo normal |

### Módulo nuevo

[`code/preventa/insistencia-leads.js`](../../code/preventa/insistencia-leads.js): saludo por hora, texto, botones, textos de respuesta y la clasificación de la respuesta del cliente. Lo usan "Preparar insistencia lead" y "Preparar contexto IA".

### Base de datos

[`schema/seguimientos-leads.sql`](../../schema/seguimientos-leads.sql), ampliado:

- Columnas de entrega y precio en `seguimientos_prospecto`: `wamid`, `estado_entrega`, `categoria_precio`, `precio_total` y `moneda`, con sus índices.
- Fila `INSISTENCIA_LEADS` en `configuracion_bot` con `activo: false`. Se inserta solo si no existe.

## 4. Verificación

| Prueba | Resultado |
|---|---|
| `tests/insistencia-postgres.test.mjs` (**nuevo**, 35 casos). Corre contra el esquema real (`pegaso_schema.sql` + migraciones) en PostgreSQL 17 temporal | 35/35 OK |
| `tests/insistencia-rutina.test.mjs` (**nuevo**, 21 casos) | 21/21 OK |
| `tests/preventa-postgres.test.mjs`. Ahora espera 9 nodos "YCloud Enviar…" (el nuevo con su guardia propia) y pasa el parámetro `$9` | 30/30 OK |
| `insistencia-leads`, `preventa`, `eficiencia-preventa`, `consumo-ia`, `ubicacion` | 9, 23, 22, 8 y 19 OK |
| `inject-code.mjs`, `validate-workflow.mjs`, `prepare-update.mjs`, `check-encoding.mjs` | OK: 247 nodos; el módulo queda compilado en los dos nodos que lo usan; sin mojibake; saltos LF |

**Qué cubre `insistencia-postgres`:**

- **Migración:** es idempotente y la rutina nace apagada.
- **Horarios:** 21:07 → 10:00 del día siguiente; 07:48 → envío dentro de la franja; 12:00 → espera a las 18:30; sin franja a tiempo → `EXPIRADO`.
- **Exclusiones (8 casos):** origen orgánico, cotización, medidas, derivación, otro producto, más de 2 mensajes, humano y `requiere_humano`.
- **Una sola insistencia:** respeta el rechazo previo y los 30 días; un `CANCELADO` no bloquea.
- **Permisos:** teléfonos permitidos y `MODO_PRUEBA`.
- **Reservas:** solo dentro de franja y con la rutina activa; respeta los límites; ventana por cerrar → `EXPIRADO`; cierre a 48 h; reservas vencidas → `ERROR`.
- **Envío:** los 6 motivos de la guardia; confirmación idempotente con el saliente sin id externo; error sin reintento; estado de entrega que no retrocede y guarda el precio.
- **Respuesta del cliente:** botón "Ya no" → `RECHAZADO`; botón "Sí" → `RESPONDIDO`; respuesta tardía → `RESPONDIDO`; webhook duplicado no vuelve a marcarla.

**Qué cubre `insistencia-rutina`:**

- Saludos por hora, texto exacto y botones de 20 caracteres o menos.
- 9 respuestas posibles del cliente.
- El cuerpo YCloud para varias filas.
- El estado de entrega del normalizador.
- El botón en "Preparar conversación".
- Una prueba de punta a punta "Preparar contexto IA" → "Resolver contexto comercial" para "Ya no, gracias", "Sí, quiero cotizar", "Sí, de 5x5 cm" y un "No gracias" sin insistencia previa.

Falta la prueba funcional en producción (sección 6).

## 5. Riesgos y puntos a confirmar en la prueba real

| Punto | Por qué | Cómo se confirma |
|---|---|---|
| Formato del mensaje interactivo en YCloud | El cuerpo sigue el formato de botones de la Cloud API, que YCloud acepta en `/v2/whatsapp/messages`, pero todavía no se envió uno real | Prueba con un número propio (sección 6). Si YCloud lo rechaza, el seguimiento queda `ERROR` con el mensaje de YCloud en `ultimo_error`, sin afectar al cliente |
| Campos del webhook de estado | La documentación de YCloud muestra `status`, `pricingCategory`, `totalPrice` y `currency`. `pricingType` y los errores se leen si llegan | Revisar las columnas de precio tras el primer envío. El webhook debe tener activado el evento `whatsapp.message.updated` |
| Anuncios en Estados de WhatsApp | Puede que no abran la ventana gratuita del anuncio | `precio_total` de esos envíos. Aunque no la abran, entran en los 1.000 mensajes gratis del mes |
| Respuestas escritas de rechazo | Solo el botón marca `RECHAZADO` (nunca más). Un "no gracias" escrito queda `RESPONDIDO`, que bloquea 30 días | Aceptado para la primera versión. Se puede revisar en el Sprint 3 |

## 6. Pasos para publicar y probar

1. Ejecutar `schema/seguimientos-leads.sql` en PostgreSQL.
2. `.\scripts\push.ps1`. Si cancela porque producción cambió, no forzar: traer producción y revisar.
3. En n8n:
   - comprobar los 12 nodos nuevos, la rama falsa de "If: ¿Evento WhatsApp procesable?" y las versiones nuevas de los Code Nodes;
   - en YCloud, confirmar que el webhook tenga activado el evento `whatsapp.message.updated`.
4. **Prueba con un número propio.** Desde un celular que no haya escrito antes, tocar un anuncio activo y enviar el mensaje precargado. Dejar que el bot responda y no contestar. Para no esperar 4 h ni una franja, encender la rutina solo para ese número con espera 0 y franja de todo el día:

   ```sql
   UPDATE pegaso.configuracion_bot
   SET valor_json = valor_json || '{"activo": true, "telefonos_permitidos": ["5939XXXXXXXX"],
     "espera_minima_horas": 0, "franjas": [["00:00", "23:59"]]}'::jsonb, actualizado_at = now()
   WHERE clave = 'INSISTENCIA_LEADS';
   ```

   En menos de 15 min debe llegar la insistencia con los dos botones. Probar los tres caminos: un número toca "Sí, quiero cotizar", otro toca "Ya no, gracias" y otro no responde. Para cada número, revisar:

   ```sql
   SELECT id, estado, respuesta, estado_entrega, categoria_precio, precio_total, ultimo_error,
     programado_para AT TIME ZONE 'America/Guayaquil' AS programado, enviado_at AT TIME ZONE 'America/Guayaquil' AS enviado
   FROM pegaso.seguimientos_prospecto ORDER BY id DESC LIMIT 10;
   ```

5. **Restaurar la configuración del piloto** y dejarla apagada hasta decidir el inicio:

   ```sql
   UPDATE pegaso.configuracion_bot
   SET valor_json = valor_json || '{"activo": false, "telefonos_permitidos": [], "espera_minima_horas": 4,
     "franjas": [["10:00", "12:30"], ["15:00", "16:00"], ["18:30", "20:30"]]}'::jsonb, actualizado_at = now()
   WHERE clave = 'INSISTENCIA_LEADS';
   ```

6. **Piloto de una semana** (fase 6 del roadmap): `activo: true` con `telefonos_permitidos: []` y `limite_diario: 20`. Revisar la *quality rating* del número al inicio y al final. Resumen de la semana:

   ```sql
   SELECT estado, respuesta, count(*) AS insistencias,
     count(*) FILTER (WHERE estado_entrega IN ('delivered', 'read')) AS entregadas,
     count(*) FILTER (WHERE estado_entrega = 'read') AS leidas,
     sum(precio_total) AS costo
   FROM pegaso.seguimientos_prospecto
   WHERE creado_at > now() - interval '7 days'
   GROUP BY estado, respuesta ORDER BY estado, respuesta;
   ```

7. `git add`, `git commit` y `git push` de los archivos de los dos sprints.

### Archivos

- **Código:**
  - `code/preventa/insistencia-leads.js` y `code/_extraidos/preparar-insistencia-lead.js` (nuevos)
  - `code/_extraidos/normalizar-evento-whatsapp.js`, `preparar-conversacion.js`, `preparar-contexto-ia.js` y `manifest.json`
  - Del Sprint 1: `preparar-entrada-whatsapp.js`
- **Workflow:** `workflows/sistema-automatizado-pegaso.edit.json` (12 nodos nuevos, "Guardar mensaje entrante" y la rama falsa de "If: ¿Evento WhatsApp procesable?")
- **Base de datos:** `schema/seguimientos-leads.sql`
- **Pruebas:** `tests/insistencia-postgres.test.mjs` y `tests/insistencia-rutina.test.mjs` (nuevos), `tests/preventa-postgres.test.mjs`; del Sprint 1, `tests/insistencia-leads.test.mjs`
- **Documentación:** `docs/FLUJO-WORKFLOW-PEGASO.md` (§4, §8, §11, §17 y §22 nueva), `docs/ROADMAP-INSISTENCIA-LEADS-ANUNCIO.md`, los reportes de ambos sprints y el índice de reportes

## 7. Pendiente

- **Pegaso (fase 0):**
  - confirmar el método de pago activo en Meta/YCloud;
  - anotar la *quality rating* del número;
  - activar el evento `whatsapp.message.updated` en el webhook de YCloud.
- **Piloto de una semana** con métricas (sección 6).
- **Sprint 3:**
  - ajustes según el piloto;
  - purga y anonimización a 180 días, con candidatos tomados de `seguimientos_prospecto`;
  - decidir si un rechazo escrito también cuenta como `RECHAZADO`;
  - decidir si se amplía a quien abandona a mitad de la conversación.
