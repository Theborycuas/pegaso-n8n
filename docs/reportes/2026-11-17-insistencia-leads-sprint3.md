# Insistencia a leads de anuncio · Sprint 3: purga a 180 días

Estado: preparado en local el 17 de noviembre de 2026. **No publicado en n8n ni commiteado.** Los Sprints 1 y 2 tampoco están publicados ([Sprint 1](2026-11-17-insistencia-leads-sprint1.md) · [Sprint 2](2026-11-17-insistencia-leads-sprint2.md)). Pegaso ya ejecutó `schema/seguimientos-leads.sql`.

**La purga nace apagada y en simulación.** Publicar no borra nada. Con `activo: true` y `simulacion: true` solo cuenta candidatos. Borra recién con `simulacion: false`.

**Antes de publicar** hay que ejecutar [`schema/purga-leads.sql`](../../schema/purga-leads.sql) en PostgreSQL. Es idempotente y ya trae el ajuste de la secuencia de `configuracion_bot` que hizo falta en el Sprint 2.

## 1. Qué quedó hecho y qué espera al piloto

| Parte del Sprint 3 | Estado |
|---|---|
| Fase 5: purga y anonimización a 180 días | **Hecha en local** (este reporte) |
| Ajustes de horario, texto y criterio de candidatos | Espera las métricas del piloto de una semana (Sprint 2, sección 6) |
| Ampliar a quien abandona a mitad de conversación | Decisión de Pegaso, mejor con datos del piloto |
| Rechazo escrito = rechazo definitivo | Decisión de Pegaso |

## 2. Qué hace la purga

Una vez al día, a las 03:00 de Ecuador, revisa los leads de anuncio que la insistencia cerró sin conversación: su último seguimiento es `SIN_RESPUESTA`, `RECHAZADO` o `EXPIRADO`. Si llevan 180 días sin mensajes, los anonimiza en una sola sentencia:

| Tabla | Acción |
|---|---|
| `mensajes` de sus conversaciones | Se borran |
| `ia_llamadas` (guardan resúmenes del texto del cliente) | Se borran |
| `notificaciones_humano` (el payload trae datos de contacto) | Se borran |
| `conversaciones` | Se conserva la fila con `telefono = ANON-<prospecto>` y `contexto_comercial = {}` |
| `prospectos` | Se conserva la fila con `telefono = ANON-<id>`; se borran nombre, ciudad, provincia y `ultimo_ctwa_clid` (id del clic en el anuncio); queda `activo = false` y `anonimizado_at` con la fecha |
| `seguimientos_prospecto`, `metricas_preventa` | Se conservan: no tienen datos personales y sirven para medir los anuncios |

**No toca** a ningún prospecto que:
- tenga mensajes en los últimos 180 días;
- haya respondido la insistencia;
- tenga cliente o contacto registrado;
- tenga cotización o derivación;
- haya recibido mensajes de una persona de Pegaso;
- tenga `requiere_humano`.

Procesa como máximo 500 por día (`lote`). La rutina de insistencia envía como máximo 20 al día, así que el lote sobra.

Si la persona vuelve a escribir algún día, entra como prospecto nuevo: su número ya no coincide con el anonimizado.

### Por qué así

- **`EXPIRADO` también entra.** Son leads de un solo toque a los que no se alcanzó a enviar la insistencia. Están en la misma situación que los que no respondieron.
- **Una vez al día con disparador cada hora.** La zona horaria de la instancia de n8n no está fijada en el workflow. El disparador corre cada hora y la consulta solo actúa cuando en Ecuador es la `hora_local` configurada. El resto de las horas devuelve ceros.
- **`activo = false` es seguro aquí.** En el Sprint 2 se evitó `activo = false` porque "Crear prospecto" chocaría con el índice único del teléfono. Al anonimizar, el teléfono pasa a `ANON-<id>`, así que ya no hay choque. La prueba lo comprueba creando de nuevo el mismo número.

## 3. Cambios

| Archivo | Cambio |
|---|---|
| [`schema/purga-leads.sql`](../../schema/purga-leads.sql) (**nuevo**) | Columna `prospectos.anonimizado_at`; índice `ix_ia_llamadas_conversacion`; ajuste de la secuencia de `configuracion_bot`; fila `PURGA_DATOS_LEADS` (`activo: false`, `simulacion: true`, `dias_inactividad: 180`, `lote: 500`, `hora_local: 3`) |
| `workflows/sistema-automatizado-pegaso.edit.json` | Nodos **Purga leads cada hora** (Schedule Trigger) y **Anonimizar leads inactivos** (Postgres, credencial existente) |
| `code/_extraidos/manifest.json` | Conteo de nodos actualizado |
| `tests/insistencia-postgres.test.mjs` | 11 pruebas de la purga y la migración nueva en la preparación |
| [FLUJO-WORKFLOW-PEGASO.md §22](../FLUJO-WORKFLOW-PEGASO.md#purga-a-180-días), [ROADMAP](../ROADMAP-INSISTENCIA-LEADS-ANUNCIO.md) | Documentación de los nodos, la fase 5 y las decisiones pendientes |

`dias_inactividad` tiene un mínimo de 30 en la consulta, para que un error de configuración no borre conversaciones recientes.

## 4. Verificación

| Prueba | Resultado |
|---|---|
| `tests/insistencia-postgres.test.mjs` contra el esquema real en PostgreSQL 17 temporal: 36 del Sprint 2 + 11 nuevas | 47/47 OK |
| `insistencia-leads`, `insistencia-rutina`, `preventa`, `eficiencia-preventa`, `consumo-ia`, `ubicacion`, `galeria-trabajos` | Todas OK |
| `tests/preventa-postgres.test.mjs` | 29/30: falla "Cada envío YCloud tiene una guardia SQL…" (ver sección 5) |
| `inject-code`, `validate-workflow`, `prepare-update`, `check-encoding` | OK, 256 nodos |

Las pruebas nuevas cubren:

- nace apagada y en simulación;
- en simulación solo cuenta;
- fuera de la hora configurada no actúa;
- anonimización completa: conteos, prospecto, conversación, tablas borradas y conservadas;
- es idempotente;
- el mismo número puede volver como prospecto nuevo;
- `RECHAZADO` y `EXPIRADO` también entran;
- seis exclusiones: mensaje reciente, respondió la insistencia, cotización, cliente registrado, intervención humana y `requiere_humano`.

## 5. Aviso: trabajo en paralelo en el repo

Mientras se hacía este sprint, otra sesión agregó la **galería de trabajos** al mismo workflow: 7 nodos, dos de ellos "YCloud Enviar…". Por eso falla la prueba "Cada envío YCloud tiene una guardia SQL y una condición de permiso", que espera 9 nodos de envío. Ese cambio y su prueba corresponden a esa entrega; aquí no se tocaron.

Conviene commitear la galería por separado de los tres sprints de la insistencia.

## 6. Pasos para publicar y activar

1. Ejecutar `schema/purga-leads.sql` en PostgreSQL.
2. `.\scripts\push.ps1` (publica los tres sprints juntos si no se publicaron antes).
3. **Simulación.** Activar solo el conteo:

   ```sql
   UPDATE pegaso.configuracion_bot
   SET valor_json = valor_json || '{"activo": true}'::jsonb, actualizado_at = now()
   WHERE clave = 'PURGA_DATOS_LEADS';
   ```

   Al día siguiente, la ejecución de las 03:00 en n8n muestra `simulacion = true` y el número de `candidatos`. Hasta 180 días después del primer cierre de la insistencia será 0, lo que es esperado.

4. **Purga real**, cuando el conteo tenga sentido:

   ```sql
   UPDATE pegaso.configuracion_bot
   SET valor_json = valor_json || '{"simulacion": false}'::jsonb, actualizado_at = now()
   WHERE clave = 'PURGA_DATOS_LEADS';
   ```

5. Commit y push.

## 7. Decisiones pendientes de Pegaso

1. ¿Un "no gracias" **escrito** después de la insistencia debe bloquear para siempre, como el botón? Hoy bloquea 30 días.
2. ¿Se amplía la insistencia a quien conversó y abandonó a mitad (por ejemplo, recibió la cotización y no respondió)?
3. ¿Se purgan también los leads de anuncio **anteriores** a la insistencia? No tienen seguimiento ni `origen = ANUNCIO_META`. Habría que reconocerlos por el texto precargado del anuncio.
