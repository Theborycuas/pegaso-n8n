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
| `tipo` | `TEXTO` | solo `TEXTO` se envía por WhatsApp |
| `contenido` | texto del mensaje | |
| `mensaje_externo_id` | wamid de WhatsApp | |
| `enviado_at` | `recibido_at` | el historial se ordena por esta columna ASC |
| `procesado` | `false` | lo pone en `true` "Marcar mensaje entrante procesado" (solo en la etapa 05) |

Mensajes salientes: "Guardar mensaje saliente" (05), "Guardar mensaje transición humano" (06) y "Guardar mensaje comercial" (07) guardan `direccion = SALIENTE`, `tipo = TEXTO`, `enviado_at = $now` y `mensaje_externo_id` vacío; `procesado` es `true` en 05 y 07 y `false` en 06 (pendiente técnico 39). Desde ahí van a la etapa 08, que los envía por YCloud.

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

Tabla de configuración clave/valor. "Obtener configuración MODO_PRUEBA" busca `clave = 'MODO_PRUEBA'` y usa la columna `valor_json`:

```json
{ "activo": true, "telefonos_permitidos": ["593999999999"] }
```

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

Lo escriben: "Guardar contexto comercial" (etapa 04), "Guardar contexto handoff" (06) y "Guardar contexto post cotización" (07). Cada escritura **reemplaza** el JSON completo; hoy el contexto anterior no llega al cerebro, así que cada mensaje lo reinicia (pendiente técnico 1).
