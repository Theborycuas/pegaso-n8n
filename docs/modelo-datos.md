# Modelo de datos (PostgreSQL)

Esquema `pegaso`, credencial de n8n **Postgres account 2**.

Las tablas marcadas ✅ tienen sus columnas confirmadas con la configuración de los nodos Postgres (etapas 01–08). El resto se deduce de los campos que usan los nodos Code y debe confirmarse cuando se agregue el SQL del esquema.

## contactos

Personas ya conocidas; si tienen `cliente_id` son clientes registrados y el bot no les responde.

| Columna | Notas |
|---|---|
| `id` | |
| `whatsapp` | ✅ filtro de "Buscar Contacto"; debe estar como `5939…` (solo dígitos) |
| `cliente_id` | si tiene valor, es cliente registrado |
| `nombre` | |

## prospectos ✅

Personas que escriben y aún no son clientes. Columnas completas según "Crear prospecto":

| Columna | Valor al crear | Notas |
|---|---|---|
| `id` | automático | |
| `telefono` | teléfono normalizado | |
| `nombre_whatsapp` | nombre del perfil | |
| `canal` | `WHATSAPP` | |
| `origen` | `WHATSAPP` | |
| `fuente` | vacío | |
| `estado` | `NUEVO` | ver [reglas-comerciales.md §11](reglas-comerciales.md#11-estados-del-prospecto) |
| `producto_interes`, `ciudad`, `provincia` | vacío | los actualiza "Actualizar prospecto comercial" |
| `ultima_intencion`, `ultima_accion` | vacío | última decisión de la IA |
| `requiere_humano` | `false` | `true` = el bot deja de responder |
| `activo` | `true` | |
| `creado_at`, `actualizado_at` | `null` | |

No existe columna de clasificación A/B/C ni `contexto_comercial` en esta tabla.

Quién la actualiza después de crearla:

| Nodo | Columnas |
|---|---|
| Actualizar prospecto comercial (04) | `estado`, `producto_interes`, `ciudad`, `provincia`, `ultima_intencion`, `ultima_accion`, `requiere_humano`, `actualizado_at` (⚠️ pendiente técnico 36) |
| Actualizar estado prospecto (05) | `estado`, `actualizado_at` |
| Marcar prospecto requiere humano (06) | `ultima_accion = DERIVAR_HUMANO`, `requiere_humano = true`, `actualizado_at` |
| Actualizar prospecto cotizado (07) | `estado = COTIZADO`, `ultima_intencion = SOLICITAR_COTIZACION`, `ultima_accion = COTIZAR_P4` (fijos), `actualizado_at` (⚠️ también si la medida no era producible, pendiente 5) |

## conversaciones

Columnas confirmadas por "Crear conversación prospecto" (la captura no muestra todas):

| Columna | Valor al crear | Notas |
|---|---|---|
| `id` | automático | |
| `cliente_id`, `contacto_id` | vacío | |
| `telefono` | teléfono normalizado | |
| `canal` | `WHATSAPP` | |
| `estado` | `ACTIVA` | |
| `ultimo_mensaje_at` | `recibido_at` | lo actualizan "Guardar contexto comercial", "Actualizar actividad conversación", "Guardar contexto handoff", "Actualizar actividad conversación cotización" y "Guardar contexto post cotización" |
| `creada_at` | vacío | |
| `prospecto_id` | id del prospecto | |
| `contexto_comercial` | (por confirmar al crear) | ✅ existe: JSON (se escribe con `JSON.stringify`) con la memoria comercial (ver abajo) |

## mensajes ✅

Columnas completas según "Guardar mensaje entrante":

| Columna | Entrante | Notas |
|---|---|---|
| `id` | automático | |
| `conversacion_id` | id de la conversación | filtro de "Recuperar historial conversación" |
| `cliente_id` | `null` en prospectos | |
| `direccion` | `ENTRANTE` | `SALIENTE` para respuestas del bot |
| `tipo` | `TEXTO`, `IMAGEN`, `AUDIO`, `VIDEO`, `DOCUMENTO` o, en entradas no soportadas, el tipo que traiga la etapa 01 (p. ej. `UBICACION`, `CONTACTO`, `INTERACTIVO`, `DESCONOCIDO`) | los salientes siempre son `TEXTO` (solo `TEXTO` se envía por WhatsApp). *Verificar* que no exista un `CHECK` que limite la columna: un valor fuera de la lista haría fallar "Guardar mensaje entrante" |
| `contenido` | texto del mensaje; en media, el descriptor de abajo | |
| `mensaje_externo_id` | wamid de WhatsApp | `null` en ejecuciones con "Mensaje entrante TEST"; un valor repetido = reenvío del webhook |
| `enviado_at` | `recibido_at` | el historial se ordena por esta columna ASC |
| `procesado` | `false` | ver semántica abajo |

`id` es el **orden de llegada** que usa el debounce: el último ENTRANTE de la conversación (sin contar reenvíos) es el que responde.

Mensajes salientes: "Guardar mensaje saliente" (05), "Guardar mensaje transición humano" (06) y "Guardar mensaje comercial" (07) guardan `direccion = SALIENTE`, `tipo = TEXTO`, `enviado_at = $now` y `mensaje_externo_id` vacío. Desde ahí van a la etapa 08, que los envía por YCloud.

### Contenido de mensajes con media

Sin columnas nuevas: imagen, audio, video y documento se guardan como **texto controlado** en `contenido`, en dos líneas. Así viajan por el turno, el historial y el correo sin cambiar los nodos de la etapa 02, que filtran campos.

| Línea | Formato | Quién la escribe |
|---|---|---|
| 1 | `[IMAGEN] caption` (o `[AUDIO]`, `[VIDEO]`, `[DOCUMENTO]`; sin caption: solo la etiqueta). El caption va en una línea, máx. 1000 caracteres | "Preparar entrada WhatsApp" (01) |
| 2 · pendiente | `[MEDIA_PENDIENTE] {"mime_type":"image/jpeg","media_id":"…","link":"https://api.ycloud.com/v2/whatsapp/media/download/…"}` | "Preparar entrada WhatsApp" (01), solo imágenes JPEG/PNG/WebP con enlace permitido |
| 2 · analizada | `[CONTEXTO DE IMAGEN · proveedor=GROQ · contenido=ENVASE_O_PRODUCTO · confianza=ALTA · revision=NO] Botella de vidrio… Sin medidas visibles.` (`proveedor` = `GROQ`, `DEEPSEEK` u `OPENAI`) | "Validar análisis imagen Groq / DeepSeek / OpenAI" (03) en `contenido_actualizado`; **no se guarda** en la base (no hay "Guardar análisis imagen") |
| 2 · revisión | `[CONTEXTO DE IMAGEN · revision=SI · motivo=…] La imagen no pudo revisarse automáticamente.` (motivos: `IMAGEN_NO_DESCARGABLE`, `ANALISIS_NO_DISPONIBLE`, `CONFIANZA_BAJA`, `IMAGEN_ILEGIBLE`, `IMAGEN_AMBIGUA`, `DISENO_COMPLEJO`, `OTRO`) | 01 o 03 |
| 2 · no procesable | `[ARCHIVO NO PROCESABLE · tipo=AUDIO · mime=audio/ogg] El bot no puede revisar este archivo automáticamente.` (audio, video, documento e imágenes que no son JPEG/PNG/WebP) | "Preparar entrada WhatsApp" (01) |
| 2 · no soportada | `[ENTRADA NO SOPORTADA · tipo=UBICACION · original=location] El bot no puede revisar este tipo de mensaje automáticamente.` (ubicación, contacto, interactivo, tipo desconocido) | "Preparar entrada no soportada" (01) |

Como el análisis no se persiste, la fila de la imagen conserva la línea `[MEDIA_PENDIENTE]`. "Preparar contexto IA" nunca la envía al cerebro: en el turno la reemplaza por el `contenido_actualizado` del validador, y en el historial de turnos anteriores la convierte en `[CONTEXTO DE IMAGEN · revision=SI · motivo=IMAGEN_NO_ANALIZADA] …`. `media_actualizaciones` (salida de "Preparar contexto IA") trae `mensaje_id` + `contenido_actualizado` listo para un UPDATE futuro.

Reglas:

- Las líneas de sistema solo se interpretan en filas con `tipo` distinto de `TEXTO`. Un cliente que escribe "[CONTEXTO DE IMAGEN…]" en un texto no activa derivaciones ni descargas.
- El enlace firmado (`link`) queda en `contenido` mientras la línea siga pendiente, y hoy eso es siempre (no hay UPDATE del análisis). "Preparar contexto IA" nunca lo envía al cerebro; con la API key caduca a los 30 días (pendiente técnico 56).
- No se guarda la imagen ni datos bancarios: de un comprobante solo queda "comprobante detectado".
- Los stickers y reacciones no se guardan (no entran al flujo conversacional). Ubicaciones, contactos e interactivos sí, con la línea "no soportada".

### Semántica de `procesado`

| Dirección | `true` | `false` | Quién escribe |
|---|---|---|---|
| ENTRANTE | el mensaje formó parte de un **turno confirmado** (el bot ya decidió qué hacer con él) | todavía no: bloqueado por MODO_PRUEBA, en atención humana, turno superado o fallo de IA | INSERT `false` en "Guardar mensaje entrante"; `true` **solo** en "Confirmar turno conversacional" (etapa 04) |
| SALIENTE | escrito por el bot (no implica entregado por YCloud) | — (no debería existir) | INSERT `true` en 05, 06 (tras el cambio recomendado) y 07 |

Se marca al **confirmar** el turno, no al terminar la rama: así la marca es también el candado contra respuestas duplicadas. Un ENTRANTE `false` dentro de los últimos `turno_max_antiguedad_segundos` se vuelve a incluir en el siguiente turno (por eso un fallo de IA se recupera con el siguiente mensaje del cliente).

### Índices recomendados

```sql
CREATE INDEX IF NOT EXISTS mensajes_conversacion_id_id_idx
  ON pegaso.mensajes (conversacion_id, id);

CREATE INDEX IF NOT EXISTS mensajes_mensaje_externo_id_idx
  ON pegaso.mensajes (mensaje_externo_id)
  WHERE mensaje_externo_id IS NOT NULL;
```

El primero acelera "Recuperar historial conversación" y la confirmación del turno; el segundo, la detección de reenvíos en esa misma consulta. No son obligatorios para que funcione.

### Normalización inicial (opcional, una vez al desplegar)

Hoy hay ENTRANTE `false` que ya fueron respondidos (06, 07) y SALIENTE `false` (06). El tope de 600 s ya los deja fuera del turno; esto solo deja los datos coherentes:

```sql
UPDATE pegaso.mensajes
SET procesado = true
WHERE procesado = false
  AND (direccion = 'SALIENTE' OR enviado_at < now() - interval '10 minutes');
```

## cotizaciones ✅

Columnas vistas en "Update rows in a table" y "EDT Datos cotización". El mapeo de "Insert cotización" está por documentar.

| Columna | Quién la escribe | Notas |
|---|---|---|
| `id` | automático | es el `cotizacion_id` de toda la etapa 07 |
| `cliente_id` | Insert cotización | ⚠️ hoy siempre `1` (pendiente técnico 41) |
| `contacto_id`, `estado` | Insert cotización (probable) | "EDT Datos cotización" manda `contacto_id: 1` y `estado: PENDIENTE` |
| `fecha_cotizacion` | (por confirmar) | |
| `subtotal`, `iva`, `total` | Update rows in a table | `total` = suma de detalles redondeados; IVA 15 % incluido |
| `descuento` | nadie | el resumen calcula `descuento_total`, pero no se mapea |

No tiene `prospecto_id` ni `conversacion_id`: la relación con el prospecto solo queda en `conversaciones.contexto_comercial.cotizacion.cotizacion_id`.

## cotizacion_detalles ✅

Columnas según "Insert cotizacion_detalles" y "Update cotizacion_detalles":

| Columna | Notas |
|---|---|
| `id` | automático; lo usa "Update cotizacion_detalles" |
| `cotizacion_id`, `material_id`, `diseno_id`, `producto_id` | |
| `descripcion` | siempre vacía (pendiente técnico 48) |
| `cantidad`, `ancho_cm`, `alto_cm`, `forma` | |
| `precio_unitario`, `precio_total` | `null` al insertar; los completa el UPDATE |
| `descuento`, `observaciones` | `null` |
| `requiere_cotizacion_manual` | el UPDATE la deja en `false` (pendiente técnico 47) |

Nombre, sabor, `cantidad_original` y precio por 1000 no se guardan aquí.

## disenos ✅

Columnas según "Crear diseño":

| Columna | Valor al crear |
|---|---|
| `id` | automático |
| `cliente_id` | del detalle (⚠️ hoy siempre `1`) |
| `material_id` | del catálogo |
| `nombre` | nombre del detalle o producto (p. ej. "Etiqueta 10x5 cm rectangular") |
| `codigo`, `archivo_original`, `notas` | vacíos |
| `ancho_cm`, `alto_cm`, `forma` | del detalle |
| `version` | `1` |
| `activo` | `true` |

## configuracion_bot

Tabla de configuración clave/valor. "Obtener configuración MODO_PRUEBA" busca por `clave` y "Resolver permiso automatización" usa la columna `valor_json` (objeto o texto JSON).

| `clave` | `valor_json` | Si falta la fila |
|---|---|---|
| `MODO_PRUEBA` | `{ "activo": true, "telefonos_permitidos": ["593999999999"] }` | modo prueba activo sin teléfonos (el bot no responde) |
| `DEBOUNCE_WHATSAPP` | `{ "debounce_ms": 3000, "turno_max_antiguedad_segundos": 600 }` | 3000 ms y 600 s |

Alta de la fila del debounce (opcional; ajusta la lista de columnas si la tabla tiene otras obligatorias):

```sql
INSERT INTO pegaso.configuracion_bot (clave, valor_json)
SELECT 'DEBOUNCE_WHATSAPP', '{"debounce_ms": 3000, "turno_max_antiguedad_segundos": 600}'
WHERE NOT EXISTS (
  SELECT 1 FROM pegaso.configuracion_bot WHERE clave = 'DEBOUNCE_WHATSAPP'
);
```

Para que se lea, "Obtener configuración MODO_PRUEBA" debe traer ambas claves (ver [etapas/03](etapas/03-conversacion.md#obtener-configuración-modo_prueba--postgres-select)).

## Estructura de `contexto_comercial`

JSON que se arrastra entre mensajes de la misma conversación:

```json
{
  "prospecto": { "id": 1, "estado": "COTIZADO", "clasificacion": "B", "producto_interes": null,
                 "requiere_humano": false, "ultima_intencion": "...", "ultima_accion": "..." },
  "ubicacion": { "ciudad": "Quito", "provincia": "Pichincha" },
  "diseno":    { "estado": null },
  "cotizacion": {
    "existe": true, "cotizacion_id": 10, "estado": "COTIZADA",
    "producto": null, "material": null,
    "cantidad_solicitada": 1500, "cantidad_cotizable": 2000,
    "ancho_cm": 10, "alto_cm": 5, "forma": "RECTANGULAR",
    "total": 72, "moneda": "USD", "cotizada_at": "...",
    "ultimo_intento_producible": true, "ultimo_error_produccion": null
  },
  "ultima_restriccion_comercial": { "codigo": "MEDIDA_MINIMA_NO_PRODUCIBLE", "tipo": "PRODUCCION" },
  "handoff": { "activo": true, "motivo": "SOLICITA_DATOS_PAGO", "prioridad": "ALTA",
               "requiere_notificacion": true, "iniciado_at": "..." }
}
```

Lo escriben: "Guardar contexto comercial" (etapa 04), "Guardar contexto handoff" (06) y "Guardar contexto post cotización" (07). Cada escritura **reemplaza** el JSON completo, pero parte del anterior: "Resolver conversación prospecto" lo lee de la fila, "Preparar contexto IA" lo entrega completo al cerebro y la etapa 04 hace `...contextoAnterior`, así que las claves se conservan entre turnos.

Se lee en "Buscar conversación", **antes** de la espera del turno. Un mensaje que llega mientras el turno anterior todavía cotiza puede leer la memoria sin el resultado de esa cotización (pendiente técnico 50).
