# Insistencia a leads de anuncio · Sprint 1: base de datos y respuestas de botón

Estado: preparado en local el 17 de noviembre de 2026. **No publicado en n8n ni commiteado.**

**Antes de publicar** hay que ejecutar [`schema/seguimientos-leads.sql`](../../schema/seguimientos-leads.sql) en PostgreSQL. Si se publica sin la migración, "Guardar mensaje entrante" falla en cada mensaje de un lead de anuncio.

Roadmap completo: [ROADMAP-INSISTENCIA-LEADS-ANUNCIO.md](../ROADMAP-INSISTENCIA-LEADS-ANUNCIO.md).

## 1. Resultado

Este sprint no envía nada nuevo a los clientes. Deja lista la base para el Sprint 2 (la rutina que envía la insistencia):

| Qué | Antes | Ahora |
|---|---|---|
| Lead que llega desde un anuncio de Meta | Se detectaba en la entrada, pero no se guardaba | El prospecto queda con `origen = ANUNCIO_META` (si fue su primer mensaje) y con el anuncio más reciente en `ultimo_anuncio_at`, `ultimo_anuncio_fuente` y `ultimo_ctwa_clid` |
| Cliente que toca un botón o una opción de lista | Entraba como `INTERACTIVO` sin texto y se derivaba como entrada no soportada (`MENSAJE_INTERACTIVO_NO_PROCESABLE`) | Entra como `TEXTO` con el título del botón ("Sí, quiero cotizar") y sigue el flujo normal; el id del botón queda en `meta_whatsapp.respuesta_interactiva` |
| Tabla de seguimientos | No existía | `pegaso.seguimientos_prospecto` creada y vacía, lista para el Sprint 2 |

Hoy el bot no envía mensajes con botones, así que el cambio de botones no altera ninguna conversación actual. Solo habilita las respuestas a la insistencia del Sprint 2.

## 2. Cambios por nodo

Ninguno de estos cambios crea, renombra ni reconecta nodos. Las fichas están actualizadas en [FLUJO-WORKFLOW-PEGASO.md](../FLUJO-WORKFLOW-PEGASO.md).

### Normalizar evento WhatsApp (v2.4)

[normalizar-evento-whatsapp.js](../../code/_extraidos/normalizar-evento-whatsapp.js)

- Nueva función `extraerRespuestaInteractiva`. Reconoce tres formatos:
  - `interactive.button_reply`: botón de un mensaje interactivo propio.
  - `interactive.list_reply`: opción de una lista.
  - `button`: botón de respuesta rápida de una plantilla.
- Acepta también los nombres camelCase (`buttonReply`, `listReply`), por si YCloud los entrega así.
- En las ramas YCloud entrante y Meta directo, el título pasa a ser `texto` (aplanado a una línea y con un máximo de 200 caracteres).
- Nueva salida `respuesta_interactiva` = `{tipo, id, titulo}`, o `null`.
- La rama de ecos de WhatsApp Business no cambia.

### Preparar entrada WhatsApp (v2.3)

[preparar-entrada-whatsapp.js](../../code/_extraidos/preparar-entrada-whatsapp.js)

- El tipo `button` se trata igual que `interactive`.
- Si la respuesta interactiva trae título: `tipo = TEXTO`, `mensaje` = título, `apto_para_flujo_texto` y `apto_para_flujo_conversacional` en `true`.
- Si no trae título (por ejemplo, un formulario `nfm_reply`): sigue como antes, `INTERACTIVO` no soportado.
- `meta_whatsapp.respuesta_interactiva` conserva el id del botón (`SEG_SI` / `SEG_NO`). El Sprint 2 lo usa para reconocer el "Ya no, gracias" sin depender del texto.

### Preparar conversación

[preparar-conversacion.js](../../code/_extraidos/preparar-conversacion.js)

- Nueva salida `anuncio_meta` = `{fuente, ctwa_clid}`. Se lee de "Normalizar evento WhatsApp" con `try/catch`, porque en la ruta de prueba ese nodo no existe.
- Solo se toma si el `mensaje_id` del evento coincide con el `mensaje_externo_id` del mensaje que se está guardando, para no atribuir un anuncio a otro mensaje.

### Guardar mensaje entrante

Nodo Postgres en `workflows/sistema-automatizado-pegaso.edit.json`. No se modificó `activeVersion`.

- La consulta pasa a ser un CTE:
  - `insertado`: el mismo INSERT de siempre, con el mismo `ON CONFLICT DO NOTHING`.
  - `anuncio`: un UPDATE del prospecto que solo corre si `$7` (fuente del anuncio) viene informado **y** el INSERT realmente insertó. Un webhook duplicado no vuelve a tocar el prospecto.
- `origen` pasa a `ANUNCIO_META` solo si el prospecto no tenía mensajes entrantes previos. Así `origen` refleja el primer contacto y no se pisa cuando un cliente antiguo vuelve por un anuncio.
- `queryReplacement` suma dos parámetros: `$json.anuncio_meta?.fuente ?? null` y `$json.anuncio_meta?.ctwa_clid ?? null`.
- La salida es la misma de antes (`SELECT * FROM insertado`): una fila si se insertó, ninguna si era duplicado.

## 3. Base de datos

[`schema/seguimientos-leads.sql`](../../schema/seguimientos-leads.sql) es idempotente y se ejecuta dentro de una transacción.

- `pegaso.prospectos`: columnas `ultimo_anuncio_at`, `ultimo_anuncio_fuente`, `ultimo_ctwa_clid` e índice parcial sobre `ultimo_anuncio_at`.
- `pegaso.seguimientos_prospecto`, con:
  - un índice único parcial para que haya un solo seguimiento vivo por prospecto;
  - un índice de programados;
  - un índice por prospecto y fecha.

Al final del archivo hay una consulta comentada para comprobar los leads de anuncio después de publicar.

## 4. Verificación

| Prueba | Resultado |
|---|---|
| `tests/insistencia-leads.test.mjs` (nuevo, 9 casos): botón por YCloud, nombres camelCase, lista y botón de plantilla por Meta, interactivo sin título, texto normal sin cambios, `anuncio_meta` con id coincidente, distinto y en la ruta de prueba | 9/9 OK |
| `tests/preventa-postgres.test.mjs` (Postgres 17 en Docker, aplica la migración nueva): 3 casos nuevos (primer mensaje desde anuncio → `ANUNCIO_META`; prospecto con historial conserva `origen`; webhook duplicado no vuelve a actualizar) y el caso de webhook duplicado sin anuncio, ahora con 8 parámetros | 30/30 OK |
| `preventa`, `eficiencia-preventa`, `consumo-ia`, `ubicacion` | 23, 21, 8 y 19 OK, sin fallos |
| `inject-code.mjs`, `validate-workflow.mjs`, `prepare-update.mjs` | OK (235 nodos); el build contiene los cuatro cambios |
| `check-encoding.mjs` | OK, sin mojibake; archivos con saltos LF |

Falta la prueba funcional en producción (sección 6).

## 5. Hallazgo para el Sprint 2

"Buscar prospecto" filtra `activo = true`. El roadmap original proponía cerrar a los leads sin respuesta con `activo = false`. Si uno de ellos volviera a escribir, el flujo no lo encontraría e intentaría crearlo de nuevo, y "Crear prospecto" fallaría por el índice único `(telefono, canal)`. **El roadmap ya está corregido:** el cierre lógico y la purga usan solo `estado` (`SIN_RESPUESTA` / `DESCARTADO`).

También quedó registrado en el roadmap que los webhooks de estado de YCloud (`whatsapp.message.updated`) hoy se descartan. Para guardar `tipo_precio` (si el mensaje fue gratis por la ventana del anuncio) hay que procesarlos en el Sprint 2.

## 6. Pasos para publicar

1. Ejecutar `schema/seguimientos-leads.sql` en PostgreSQL.
2. `.\scripts\push.ps1`. Si cancela porque producción cambió, no forzar: traer producción y revisar.
3. Comprobar en n8n que "Guardar mensaje entrante" muestra el CTE y que los tres Code Nodes tienen las versiones nuevas.
4. **Prueba de anuncio:** desde un celular que nunca haya escrito al número, tocar uno de los anuncios activos y enviar el mensaje precargado. Ejecutar la consulta comentada al final de la migración: debe aparecer con `origen = ANUNCIO_META`, `ultimo_anuncio_fuente = ad` y `tiene_clid = t`. El bot debe responder como siempre.
5. **Prueba de botón:** dentro de las 24 h siguientes a un mensaje de ese mismo celular, enviarle desde la API de YCloud (Postman o el panel) un mensaje interactivo con los botones del roadmap (sección 4). Tocar "Sí, quiero cotizar": en `pegaso.mensajes` debe quedar un `ENTRANTE` de tipo `TEXTO` con ese texto, y el bot debe responder pidiendo las medidas.
6. `git add` de los archivos listados abajo, `git commit` y `git push`.

### Archivos

- `code/_extraidos/normalizar-evento-whatsapp.js`
- `code/_extraidos/preparar-entrada-whatsapp.js`
- `code/_extraidos/preparar-conversacion.js`
- `workflows/sistema-automatizado-pegaso.edit.json` (solo "Guardar mensaje entrante")
- `schema/seguimientos-leads.sql` (nuevo)
- `tests/insistencia-leads.test.mjs` (nuevo), `tests/preventa-postgres.test.mjs`
- `docs/FLUJO-WORKFLOW-PEGASO.md`, `docs/ROADMAP-INSISTENCIA-LEADS-ANUNCIO.md`, este reporte y el índice de reportes

## 7. Pendientes de Pegaso (fase 0)

- Confirmar el método de pago activo en Meta/YCloud. Es obligatorio desde el 1-oct-2026 para todo el bot.
- Anotar la *quality rating* actual del número en WhatsApp Manager.
- Confirmar la zona horaria del workflow en n8n (`America/Guayaquil`).
