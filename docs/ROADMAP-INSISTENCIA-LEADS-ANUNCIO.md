# Roadmap: insistencia única a leads de anuncio que no responden

Muchos prospectos llegan por los anuncios de Facebook, Instagram o Estados de WhatsApp. Tocan el botón del anuncio, envían el mensaje precargado ("¿Precio de las etiquetas adhesivas?", "¡Hola! Quiero más información") y no vuelven a escribir después de que el bot les pide las medidas. Esta rutina les envía **una sola insistencia**, en un horario tranquilo y sin costo. Si no hay respuesta, cierra el prospecto y, a los 180 días, borra sus datos personales.

Documento creado el 17 de noviembre de 2026. Estado: **diseño aprobado, pendiente de implementación**.

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
| Detección de lead de anuncio (`es_lead_anuncio`, `ctwa_clid`, tipo de origen) | Existe, **pero no se guarda** en la base | [normalizar-evento-whatsapp.js](../code/_extraidos/normalizar-evento-whatsapp.js) |
| Envío por YCloud (`POST https://api.ycloud.com/v2/whatsapp/messages`) | Existe | Nodos HTTP de salida |
| Disparador programado con reserva y reintento | Existe ("Reintentar avisos humanos"), sirve de modelo | `notificaciones_humano` en [preventa-eficiencia.sql](../schema/preventa-eficiencia.sql) |
| Respuestas de botón del cliente | **No se procesan.** Llegan como `INTERACTIVO` con texto `null` y no entran al flujo conversacional | [normalizar-evento-whatsapp.js](../code/_extraidos/normalizar-evento-whatsapp.js) solo lee `message.text.body` |
| Columnas `prospectos.origen` y `prospectos.fuente` | Existen sin uso claro; sirven para marcar el lead de anuncio | [pegaso_schema.sql](../schema/pegaso_schema.sql) |
| Dirección de mensajes | `mensajes.direccion` = `ENTRANTE` / `SALIENTE` | `pegaso.mensajes` |

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
| Toca **"Sí, quiero cotizar"** | Marca el seguimiento `RESPONDIDO` y pasa "Sí, quiero cotizar" al flujo normal; el bot pide las medidas |
| Toca **"Ya no, gracias"** | Marca `RECHAZADO`, responde *"Entendido, gracias por su tiempo. Si más adelante necesita etiquetas, aquí estaremos 🙌"* y deja el prospecto en `DESCARTADO` / `activo = false`. No se le vuelve a escribir |
| Escribe cualquier otra cosa | Marca `RESPONDIDO` y sigue el flujo normal |
| No responde en 48 h | Marca `SIN_RESPUESTA` y cierra el prospecto (`estado = SIN_RESPUESTA`, `activo = false`). Si vuelve a escribir algún día, se reactiva como siempre |

---

## 5. Quién recibe la insistencia

Todas estas condiciones deben cumplirse:

1. El prospecto llegó por un **anuncio** (`prospectos.origen = 'ANUNCIO_META'`, ver fase 1).
2. No es cliente registrado, está `activo`, no tiene `requiere_humano = true` y no hubo intervención humana en la conversación.
3. **No conversó:** como máximo 2 mensajes entrantes en total y ninguna cotización en `contexto_comercial`. *Primera versión, centrada en los "chats de un solo toque". Más adelante se puede ampliar a quien abandona a mitad de la conversación.*
4. El **último mensaje** de la conversación es del bot (`SALIENTE`) y el último del cliente tiene entre 4 h y 23,5 h de antigüedad.
5. No recibió ninguna insistencia en los últimos **30 días**.
6. El permiso de automatización (modo prueba, pausa del bot) lo permite.

---

## 6. Fases

### Fase 0: Prerrequisitos (sin código)

- [ ] Confirmar que hay un **método de pago activo** en Meta/YCloud (obligatorio desde el 1-oct-2026 para todo el bot).
- [ ] Anotar la *quality rating* actual del número en WhatsApp Manager, como punto de partida.
- [ ] Verificar si el workflow recibe los **webhooks de estado** de YCloud (entregado/leído y tipo de precio). Si no, revisar el tipo de precio en el panel de YCloud.
- [ ] Confirmar la zona horaria del workflow en n8n (`America/Guayaquil`).

### Fase 1: Datos (`schema/seguimientos-leads.sql`)

- [ ] Guardar el origen del lead al crear el prospecto: `origen = 'ANUNCIO_META'`, `fuente` = tipo de anuncio (`ad`, `post`…) y el `ctwa_clid` dentro de `contexto_comercial`.
- [ ] Nueva tabla de seguimientos, con el mismo patrón de reserva que `notificaciones_humano`:

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

- [ ] Verificar qué valores de `prospectos.estado` usa hoy el bot y añadir `SIN_RESPUESTA` y `DESCARTADO`, de forma coherente con ellos.

### Fase 2: Entrada de botones (flujo principal)

- [ ] En [normalizar-evento-whatsapp.js](../code/_extraidos/normalizar-evento-whatsapp.js): para `interactive.button_reply`, usar `title` como `texto` y conservar `id` (`SEG_SI` / `SEG_NO`).
- [ ] En [preparar-entrada-whatsapp.js](../code/_extraidos/preparar-entrada-whatsapp.js): tratar el botón como texto apto para el flujo conversacional.
- [ ] Antes del cerebro comercial: si hay un seguimiento `ENVIADO` del prospecto, marcarlo `RESPONDIDO` o `RECHAZADO`. Con `SEG_NO`, enviar la despedida y cerrar sin pasar por la IA.

### Fase 3: Workflow programado "Insistencia a leads"

Disparador cada 15 min, solo dentro de las franjas (cron `*/15 10-20 * * *` en `America/Guayaquil`; el código descarta lo que quede fuera de las franjas exactas).

1. **Programar:** buscar candidatos (sección 5) sin seguimiento, calcular `programado_para` (sección 3.2) e insertarlos como `PROGRAMADO`. Si `programado_para` cae después del cierre de la ventana menos 30 min, se inserta directamente como `EXPIRADO`.
2. **Reservar:** tomar los `PROGRAMADO` con `programado_para <= now()` (máximo 20 por corrida), pasarlos a `ENVIANDO` con `reserva` y `reservada_hasta`.
3. **Revalidar justo antes de enviar:** el cliente no escribió desde entonces, la ventana sigue abierta, no hubo intervención humana y el permiso de automatización lo permite. Si algo falla, el seguimiento pasa a `CANCELADO` o `EXPIRADO`.
4. **Enviar** el mensaje interactivo por YCloud con el saludo según la hora real.
5. **Registrar:** `ENVIADO`, `mensaje_externo_id` y `texto_enviado`. También se guarda en `pegaso.mensajes` como `SALIENTE`, para que la IA vea la insistencia en el historial cuando el cliente responda.
6. **Errores:** `ERROR` con `ultimo_error`. No hay reintentos fuera de la ventana.

### Fase 4: Cierre lógico (rutina diaria)

- [ ] Seguimientos `ENVIADO` con `enviado_at` de hace más de 48 h → `SIN_RESPUESTA`. El prospecto pasa a `estado = 'SIN_RESPUESTA'`, `activo = false`.
- [ ] Si el cliente escribe más tarde, el flujo normal lo reactiva (`activo = true`).

### Fase 5: Purga a los 180 días (rutina semanal, domingo de madrugada)

**Candidatos:** prospectos `activo = false`, con estado `SIN_RESPUESTA` o `DESCARTADO`, sin actividad en 180 días, que no son clientes y no tienen cotización, diseño ni pedido.

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

## 8. Fuentes

- [Meta: Pricing on the WhatsApp Business Platform](https://developers.facebook.com/docs/whatsapp/pricing): ventana gratuita de hasta 7 días, 1.000 mensajes gratis al mes, cambios del 1-oct-2026.
- [Meta: Pricing updates](https://developers.secure.facebook.com/docs/whatsapp/pricing/updates-to-pricing)
- [YCloud: Pricing update effective October 1, 2026](https://www.ycloud.com/blog/whatsapp-api-message-pricing-update-effective-october-1-2026)
- [respond.io: WhatsApp API pricing](https://respond.io/blog/whatsapp-business-api-pricing)
