# Modelo de datos (PostgreSQL)

Esquema `pegaso`, credencial de n8n **Postgres account 2**.

Las tablas marcadas ✅ tienen sus columnas confirmadas con la configuración de los nodos Postgres (etapas 01–03). El resto se deduce de los campos que usan los nodos Code y debe confirmarse cuando se documenten las etapas 04–08 o se agregue el SQL del esquema.

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

## conversaciones

Columnas confirmadas por "Crear conversación prospecto" (la captura no muestra todas):

| Columna | Valor al crear | Notas |
|---|---|---|
| `id` | automático | |
| `cliente_id`, `contacto_id` | vacío | |
| `telefono` | teléfono normalizado | |
| `canal` | `WHATSAPP` | |
| `estado` | `ACTIVA` | |
| `ultimo_mensaje_at` | `recibido_at` | lo actualizan "Actualizar actividad conversación…" |
| `creada_at` | vacío | |
| `prospecto_id` | id del prospecto | |
| `contexto_comercial` | (por confirmar) | JSON: memoria comercial (ver abajo). Lo escriben las etapas 04, 06 y 07 |

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
| `procesado` | `false` | lo pone en `true` "Marcar mensaje entrante procesado" |

## cotizaciones

`id`, `cliente_id`, `subtotal`, `iva`, `total`, `descuento_total`.

## cotizacion_detalles

`id`, `cotizacion_id`, `diseno_id`, `producto_id`, `material_id`, `cantidad`, `cantidad_original`, `ancho_cm`, `alto_cm`, `forma`, `nombre`, `sabor`, `descuento`, `observaciones`, `precio_1000`, `precio_unitario`, `precio_total`, `subtotal`, `iva`, `total`.

## disenos

`id`, `cliente_id`, `material_id`, `nombre`, `ancho_cm`, `alto_cm`, `forma`, `activo`.

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

Lo escriben: "Guardar contexto comercial" (etapa 04), "Guardar contexto handoff" (06) y "Guardar contexto post cotización" (07).
