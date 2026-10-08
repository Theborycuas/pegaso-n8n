# Etapa 01 · Entrada

Recibe el webhook de YCloud y lo convierte en un mensaje normalizado (texto, o descriptor controlado si es imagen, audio, video o documento). Es la única puerta de entrada del bot (más el trigger manual de pruebas). Aquí **no** se descarga ni se analiza la media: eso lo hace la etapa 03 en la ejecución que gana el turno ([Imágenes del turno](03-conversacion.md#imágenes-del-turno)).

```mermaid
flowchart LR
    W[Webhook YCloud] --> N[Normalizar evento WhatsApp]
    N --> I1{¿Evento WhatsApp<br/>procesable?}
    I1 -->|false| X1((fin))
    I1 -->|true| P[Preparar entrada WhatsApp]
    P --> I2{IF: ¿Entrada soportada<br/>por el flujo?<br/>texto OR media}
    I2 -->|true| M[Normalizar mensaje]
    I2 -->|false| NS[Preparar entrada no soportada]
    NS -->|reacción, sticker, vacío| X2((fin))
    NS -->|derivacion_directa = true| M
    T[Execute workflow] --> S[Mensaje entrante TEST] --> M
    M --> E02[Etapa 02]
```

Las entradas no soportadas (ubicación, contacto, interactivo, tipo desconocido, media sin `media_id`) **no se pierden**: pasan por identidad y se guardan como cualquier mensaje, y en la etapa 03 "IF: ¿Derivación directa por entrada?" las manda a "Preparar derivación humana" sin pasar por la IA. El IF de derivación está en la etapa 03 y no aquí porque la derivación necesita `prospecto_id` y `conversacion_id`.

## Nodos

### Webhook YCloud · Webhook

| Parámetro | Valor |
|---|---|
| HTTP Method | `POST` |
| Path | `whatsapp-ycloud` |
| URL producción | `https://n8npegaso.cognisoftone.com/webhook/whatsapp-ycloud` |
| URL prueba | `https://n8npegaso.cognisoftone.com/webhook-test/whatsapp-ycloud` |
| Authentication | `None` ⚠️ (ver [pendientes técnicos](../pendientes-tecnicos.md)) |
| Respond | `Immediately` (responde 200 a YCloud sin esperar a que termine el flujo) |

Salida: `{ headers, params, query, body }`. El evento de YCloud viene en `body`.

### Normalizar evento WhatsApp · Code

Archivo: [`code/01-entrada/normalizar-evento-whatsapp.js`](../../code/01-entrada/normalizar-evento-whatsapp.js)

Detecta el proveedor y produce un objeto `evento_whatsapp` uniforme:

- **YCloud**: `body.type === 'whatsapp.inbound_message.received'` y existe `body.whatsappInboundMessage`.
- **Meta Cloud API directo**: `body.entry` es un arreglo (soportado por compatibilidad).
- Cualquier otro evento (estados de entrega, lecturas…) queda con `procesable: false`.

Campos de `evento_whatsapp`: `procesable`, `origen` (`YCLOUD` / `META_CLOUD_API`), `telefono_cliente` (solo dígitos, ej. `593987654321`), `nombre_cliente`, `mensaje_id` (wamid), `timestamp` (Unix en segundos), `tipo_mensaje` (`text`, `image`…), `texto`, `caption`, `media_id`, `media_mime_type`, `media_sha256`, `media_link` (v1.1, solo YCloud: `image.link`, `audio.link`, etc.), `display_phone_number` (número de Pegaso), `waba_id`, `canal: WHATSAPP`, `proveedor_evento_id`. También guarda el body completo en `payload_original`.

`media_link` tiene la forma `https://api.ycloud.com/v2/whatsapp/media/download/{id}?sig=…&payload=…`. Según YCloud se puede bajar sin credencial durante unos minutos y **con la cabecera `X-API-Key` durante 30 días**. Meta Cloud API directo no trae enlace (solo `id`), así que esas imágenes van a revisión humana.

### IF: ¿Evento WhatsApp procesable? · IF

Condición: `{{ $json.evento_whatsapp.procesable }}` **is true** (boolean, sin conversión de tipos).
La rama `false` no tiene conexión: el evento se ignora en silencio.

### Preparar entrada WhatsApp · Code

Archivo: [`code/01-entrada/preparar-entrada-whatsapp.js`](../../code/01-entrada/preparar-entrada-whatsapp.js)

Traduce el evento al mismo contrato que usa "Mensaje entrante TEST" y decide si sigue el flujo de texto.

| `tipo_mensaje` de WhatsApp | `tipo` interno |
|---|---|
| text | `TEXTO` |
| image | `IMAGEN` |
| audio | `AUDIO` |
| video | `VIDEO` |
| document | `DOCUMENTO` |
| sticker | `STICKER` |
| location | `UBICACION` |
| contacts | `CONTACTO` |
| interactive | `INTERACTIVO` |
| otro | `DESCONOCIDO` |

Salida (v2.1): `telefono`, `nombre_whatsapp`, `mensaje`, `tipo`, `canal`, `mensaje_externo_id`, `meta_whatsapp` (datos extra y multimedia, con `media.link_permitido`, `media.soportada`, `media.motivo_no_procesable`), `apto_para_flujo_texto` (solo `text` con mensaje no vacío), `apto_para_flujo_conversacional` (texto, o imagen/audio/video/documento), `media_soportada`, `requiere_procesamiento_media` (imagen/audio/video/documento **con `media_id`**; nunca sticker) y **`entrada_soportada_flujo`** = `apto_para_flujo_texto OR requiere_procesamiento_media` (la misma condición del IF siguiente, útil para depurar).

`mensaje` según el tipo (es lo que se guarda en `mensajes.contenido`; formato en [modelo-datos.md](../modelo-datos.md#contenido-de-mensajes-con-media)):

| Caso | `mensaje` |
|---|---|
| Texto | el texto |
| Imagen JPEG/PNG/WebP con enlace YCloud permitido | `[IMAGEN] caption` + `\n[MEDIA_PENDIENTE] {"mime_type","media_id","link"}` |
| Imagen soportada sin enlace válido (Meta, host distinto) | `[IMAGEN] caption` + `\n[CONTEXTO DE IMAGEN · revision=SI · motivo=IMAGEN_NO_DESCARGABLE] …` |
| Imagen de otro formato, audio, video, documento | `[TIPO] caption` + `\n[ARCHIVO NO PROCESABLE · tipo=… · mime=…] …` |
| Sticker, ubicación, contacto, interactivo | `[TIPO]` o vacío; no entra al flujo directo: lo procesa "Preparar entrada no soportada" |

Seguridad:

- Solo se acepta un enlace que cumpla `^https://api\.ycloud\.com/v2/whatsapp/media/download/<id>(?<query>)?$`, tenga como máximo 2048 caracteres y, parseado con `URL`, sea `https`, host `api.ycloud.com`, sin puerto ni usuario/contraseña. Así la credencial de YCloud nunca se envía a otro host: cubre el SSRF y trucos como `https://api.ycloud.com@otro-host/…`. La query firmada (`sig`, `payload`) se acepta tal cual.
- El caption se aplana a una línea (máx. 1000 caracteres): el cliente no puede fabricar una línea `[MEDIA_PENDIENTE]` ni `[CONTEXTO DE IMAGEN …]`.
- Los stickers quedan fuera a propósito: no aportan información y derivarlos a un asesor sería ruido.

Lanza error si el evento no es procesable o le falta teléfono o `mensaje_id`.

### IF: ¿Entrada soportada por el flujo? · IF

| Campo | Valor |
|---|---|
| NOMBRE | `IF: ¿Entrada soportada por el flujo?` (antes "IF: ¿Apto para flujo de texto?") |
| VA DESPUÉS DE | Preparar entrada WhatsApp |
| VA ANTES DE | `true` → Normalizar mensaje · `false` → Preparar entrada no soportada |
| CONFIGURACIÓN | **dos** condiciones *Boolean* → **is true**, combinadas con **OR** (no AND: una imagen tiene `apto_para_flujo_texto = false` y debe pasar) |
| EXPRESIONES | 1) `{{ $json.apto_para_flujo_texto }}` · 2) `{{ $json.requiere_procesamiento_media }}` |
| EQUIVALENTE | una sola condición `{{ $json.entrada_soportada_flujo }}` **is true** da el mismo resultado |

Texto procesable e imágenes/audios/videos/documentos con `media_id` siguen al flujo. Lo demás va a "Preparar entrada no soportada".

### Preparar entrada no soportada · Code — NUEVO

Archivo: [`code/01-entrada/preparar-entrada-no-soportada.js`](../../code/01-entrada/preparar-entrada-no-soportada.js)

| Campo | Valor |
|---|---|
| NOMBRE | `Preparar entrada no soportada` |
| TIPO | **Code** (JavaScript, *Run Once for All Items*) |
| VA DESPUÉS DE | IF: ¿Entrada soportada por el flujo? (rama **false**) |
| VA ANTES DE | Normalizar mensaje (tercera entrada del nodo) |
| CONFIGURACIÓN | pegar el archivo (o `npm run build` cuando el nodo exista) |
| CREDENCIAL | ninguna |
| SALIDA ESPERADA | el contrato de "Preparar entrada WhatsApp" con `mensaje` controlado y la derivación fijada; **sin item** para reacciones, stickers y textos vacíos |

| Entrada | `mensaje` | `derivacion_motivo` | `derivacion_clasificacion` |
|---|---|---|---|
| Reacción, sticker, texto vacío | — (no sale item: fin en silencio) | — | — |
| Imagen sin `media_id` | el descriptor de imagen de la etapa 01 | `IMAGEN_REQUIERE_REVISION` | `REVISION_IMAGEN` |
| Audio, video, documento sin `media_id` | el descriptor `[ARCHIVO NO PROCESABLE …]` | `ARCHIVO_NO_PROCESABLE` | `REVISION_ARCHIVO` |
| Ubicación, contacto, interactivo, desconocido | `[TIPO]\n[ENTRADA NO SOPORTADA · tipo=… · original=…] El bot no puede revisar este tipo de mensaje automáticamente.` | `ENTRADA_NO_SOPORTADA` | `REVISION_COMERCIAL` |

Además: `entrada_soportada_flujo: false`, `derivacion_directa: true`, `derivacion_directa_motivo: ENTRADA_NO_SOPORTADA`, `origen_derivacion: ENTRADA_NO_SOPORTADA`, `derivacion_prioridad: MEDIA`. "Preparar derivación humana" toma esos datos de `$('Normalizar mensaje')`.

### When clicking 'Execute workflow' + Mensaje entrante TEST · Trigger manual + Set

Permite probar el flujo desde el editor sin WhatsApp. El nodo Set debe entregar el mismo contrato que "Preparar entrada WhatsApp": `telefono`, `nombre_whatsapp`, `mensaje` y opcionalmente `tipo`, `canal`.

En estas ejecuciones el mensaje **se guarda pero no se envía** por WhatsApp (ver etapa 08).

### Normalizar mensaje · Code

Archivo: [`code/01-entrada/normalizar-mensaje.js`](../../code/01-entrada/normalizar-mensaje.js)

Une las tres entradas (real soportada, entrada no soportada y prueba) en el contrato mínimo. Conserva el resto de campos de la entrada (`...data`) y expone `derivacion_directa` siempre como booleano (y `derivacion_directa_motivo`, o `null`): lo lee "IF: ¿Derivación directa por entrada?" en la etapa 03.

| Campo | Regla |
|---|---|
| `telefono` | sin espacios, guiones, paréntesis ni `+`; si empieza con `0` se reemplaza por `593` (`0987654321` → `593987654321`) |
| `nombre_whatsapp` | `nombre_whatsapp` o `nombre` |
| `mensaje` | recortado; `''` si no viene |
| `tipo` | en mayúsculas, por defecto `TEXTO` |
| `canal` | en mayúsculas, por defecto `WHATSAPP` |
| `mensaje_externo_id` | wamid del mensaje |
| `recibido_at` | hora de ejecución en n8n (ISO) |

## Contrato de salida de la etapa

```json
{
  "telefono": "593987654321",
  "nombre_whatsapp": "Ana Pérez",
  "mensaje": "Hola, necesito etiquetas de 10x5 cm",
  "tipo": "TEXTO",
  "canal": "WHATSAPP",
  "mensaje_externo_id": "wamid.TEST001",
  "recibido_at": "2026-10-07T23:00:01.000Z",
  "derivacion_directa": false,
  "derivacion_directa_motivo": null
}
```

## Pruebas

`tests/fixtures/01-*.json` (ejecutar con `npm test`): texto, imagen (con `media_link`) y evento no procesable de YCloud; preparación de texto, imagen con enlace, imagen sin caption, imagen GIF, audio, enlace no permitido con caption malicioso y sticker (con `entrada_soportada_flujo`); entrada no soportada (ubicación, audio sin `media_id`, sticker ignorado); normalización con teléfono local.
