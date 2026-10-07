# Modelo de datos (PostgreSQL)

> Deducido de los campos que leen y escriben los nodos Code. El repo todavía no tiene el SQL de las tablas ni la configuración de los nodos Postgres; cuando se exporte el workflow (`workflows/pegaso-whatsapp.json`) o se agregue el esquema, hay que confirmar nombres y tipos aquí.

El esquema es `pegaso` (por ejemplo `pegaso.prospectos`).

## contactos

Personas ya conocidas; si tienen `cliente_id` son clientes registrados y el bot no les responde.

`id`, `cliente_id`, `nombre`, `telefono`.

## prospectos

Personas que escriben y aún no son clientes.

| Columna | Notas |
|---|---|
| `id` | |
| `telefono`, `canal`, `nombre_whatsapp` | `canal = WHATSAPP` |
| `estado` | ver [reglas-comerciales.md §11](reglas-comerciales.md#11-estados-del-prospecto) |
| `producto_interes`, `ciudad`, `provincia` | |
| `ultima_intencion`, `ultima_accion` | última decisión de la IA |
| `requiere_humano` | `true` = el bot deja de responder |
| `clasificacion` | A/B/C (hoy no se persiste, ver pendientes) |
| `contexto_comercial` | JSON, lo actualiza "Guardar contexto handoff" |

## conversaciones

| Columna | Notas |
|---|---|
| `id` | |
| `estado` | `ACTIVA` por defecto |
| `cliente_id`, `contacto_id`, `prospecto_id` | |
| `contexto_comercial` | JSON: memoria comercial (ver abajo) |
| actividad (fecha de último mensaje) | la actualizan "Actualizar actividad conversación…" |

## mensajes

| Columna | Notas |
|---|---|
| `id`, `conversacion_id`, `cliente_id` | |
| `direccion` | `ENTRANTE` / `SALIENTE` |
| `tipo` | `TEXTO` (solo este tipo se envía por WhatsApp) |
| `contenido` | |
| `mensaje_externo_id` | id de WhatsApp/YCloud del mensaje entrante |
| `enviado_at` | el historial se ordena por esta columna |
| procesado | "Marcar mensaje entrante procesado" |

## cotizaciones

`id`, `cliente_id`, `subtotal`, `iva`, `total`, `descuento_total`.

## cotizacion_detalles

`id`, `cotizacion_id`, `diseno_id`, `producto_id`, `material_id`, `cantidad`, `cantidad_original`, `ancho_cm`, `alto_cm`, `forma`, `nombre`, `sabor`, `descuento`, `observaciones`, `precio_1000`, `precio_unitario`, `precio_total`, `subtotal`, `iva`, `total`.

## disenos

`id`, `cliente_id`, `material_id`, `nombre`, `ancho_cm`, `alto_cm`, `forma`, `activo`.

## configuración

Fila con clave `MODO_PRUEBA` y columna `valor_json` (`jsonb`):

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
