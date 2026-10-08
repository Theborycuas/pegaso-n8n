// ======================================================
// NODO N8N: Preparar entrada WhatsApp
// ARCHIVO: code/01-entrada/preparar-entrada-whatsapp.js
// VERSION: 2.0
// RESPONSABILIDAD:
// - Validar que exista evento_whatsapp procesable con telefono_cliente y mensaje_id (lanza error si no)
// - Traducir tipo_mensaje de WhatsApp a enum interno (TEXTO, IMAGEN, AUDIO, VIDEO, DOCUMENTO, STICKER, UBICACION, CONTACTO, INTERACTIVO, DESCONOCIDO)
// - Texto: mensaje = body. Imagen/audio/video/documento: mensaje = descriptor controlado que se guarda en mensajes.contenido
//   (línea 1 "[IMAGEN] caption"; línea 2 "[MEDIA_PENDIENTE] {json}" si es JPEG/PNG/WebP con enlace YCloud permitido,
//   o una línea de revisión / archivo no procesable en los demás casos)
// - Aceptar enlaces de descarga solo de https://api.ycloud.com/v2/whatsapp/media/download/ (anti-SSRF: la credencial YCloud nunca sale a otro host)
// - Convertir el timestamp Unix a fecha ISO y agrupar datos extra en meta_whatsapp (incluido media)
// - Emitir el contrato compatible con "Mensaje entrante TEST" (telefono, nombre_whatsapp, mensaje, tipo, canal, mensaje_externo_id)
// - Calcular apto_para_flujo_texto (solo texto), apto_para_flujo_conversacional (texto o imagen/audio/video/documento) y requiere_procesamiento_media
// - NO filtrar el flujo (lo decide el IF siguiente "¿Apto para flujo de texto?", que evalúa apto_para_flujo_conversacional)
// - NO descargar ni analizar multimedia (lo hace la etapa 03 en el turno ganador)
// ======================================================

const MIME_IMAGEN_SOPORTADOS = ['image/jpeg', 'image/png', 'image/webp'];

const LINK_YCLOUD_PERMITIDO =
  /^https:\/\/api\.ycloud\.com\/v2\/whatsapp\/media\/download\/[A-Za-z0-9_-]+(\?[A-Za-z0-9%._~&=+-]*)?$/;

const LARGO_MAXIMO_LINK = 2048;
const LARGO_MAXIMO_CAPTION = 1000;

const input = $input.first().json;
const evento = input.evento_whatsapp ?? null;

// ------------------------------------------------------
// VALIDACIONES BÁSICAS
// ------------------------------------------------------

if (!evento) {
  throw new Error(
    'PREPARAR ENTRADA WHATSAPP: no existe evento_whatsapp.'
  );
}

if (!evento.procesable) {
  throw new Error(
    'PREPARAR ENTRADA WHATSAPP: el evento no está marcado como procesable.'
  );
}

if (!evento.telefono_cliente) {
  throw new Error(
    'PREPARAR ENTRADA WHATSAPP: no existe telefono_cliente.'
  );
}

if (!evento.mensaje_id) {
  throw new Error(
    'PREPARAR ENTRADA WHATSAPP: no existe mensaje_id.'
  );
}

// ------------------------------------------------------
// NORMALIZAR TIPO
// ------------------------------------------------------

const tipoOriginal = String(evento.tipo_mensaje ?? '')
  .trim()
  .toLowerCase();

let tipoMensaje = 'DESCONOCIDO';

switch (tipoOriginal) {
  case 'text':
    tipoMensaje = 'TEXTO';
    break;

  case 'image':
    tipoMensaje = 'IMAGEN';
    break;

  case 'audio':
    tipoMensaje = 'AUDIO';
    break;

  case 'video':
    tipoMensaje = 'VIDEO';
    break;

  case 'document':
    tipoMensaje = 'DOCUMENTO';
    break;

  case 'sticker':
    tipoMensaje = 'STICKER';
    break;

  case 'location':
    tipoMensaje = 'UBICACION';
    break;

  case 'contacts':
    tipoMensaje = 'CONTACTO';
    break;

  case 'interactive':
    tipoMensaje = 'INTERACTIVO';
    break;
}

// ------------------------------------------------------
// TEXTO UTILIZABLE
// ------------------------------------------------------

let mensaje = null;

if (tipoOriginal === 'text') {
  mensaje = evento.texto ?? null;
}

// Si posteriormente llega una imagen/documento/video con caption,
// conservamos ese texto para poder procesarlo.
if (
  !mensaje &&
  ['image', 'video', 'document'].includes(tipoOriginal)
) {
  mensaje = evento.caption ?? null;
}

if (typeof mensaje === 'string') {
  mensaje = mensaje.trim();

  if (!mensaje) {
    mensaje = null;
  }
}

// ------------------------------------------------------
// TIMESTAMP
// ------------------------------------------------------

let fechaMensaje = null;

if (evento.timestamp) {
  const timestampNumero = Number(evento.timestamp);

  if (Number.isFinite(timestampNumero)) {
    fechaMensaje = new Date(timestampNumero * 1000).toISOString();
  }
}

// ------------------------------------------------------
// CONTROL DE MULTIMEDIA
// ------------------------------------------------------

const esMultimedia = [
  'image',
  'audio',
  'video',
  'document',
  'sticker'
].includes(tipoOriginal);

const requiereProcesamientoMedia =
  esMultimedia && !!evento.media_id;

const aptoParaFlujoTexto =
  tipoOriginal === 'text' &&
  mensaje !== null;

// ------------------------------------------------------
// DESCRIPTOR MULTIMEDIA
// ------------------------------------------------------
//
// El caption se aplana a una sola línea: así el cliente no puede
// fabricar una línea "[MEDIA_PENDIENTE]" o "[CONTEXTO DE IMAGEN …]".
// Los stickers quedan fuera del flujo (no aportan información y
// derivarlos a un asesor sería ruido).
// ------------------------------------------------------

const TIPOS_FLUJO_MEDIA = ['image', 'audio', 'video', 'document'];

const entraComoMedia =
  TIPOS_FLUJO_MEDIA.includes(tipoOriginal);

const mimeType =
  typeof evento.media_mime_type === 'string'
    ? evento.media_mime_type.trim().toLowerCase().split(';')[0]
    : null;

const linkMedia =
  typeof evento.media_link === 'string'
    ? evento.media_link.trim()
    : null;

const linkPermitido =
  !!linkMedia &&
  linkMedia.length <= LARGO_MAXIMO_LINK &&
  LINK_YCLOUD_PERMITIDO.test(linkMedia);

const imagenSoportada =
  tipoOriginal === 'image' &&
  MIME_IMAGEN_SOPORTADOS.includes(mimeType);

let mediaSoportada = false;
let motivoMediaNoProcesable = null;
let lineaMedia = null;

if (entraComoMedia) {
  if (imagenSoportada && linkPermitido) {
    mediaSoportada = true;

    lineaMedia =
      '[MEDIA_PENDIENTE] ' +
      JSON.stringify({
        mime_type: mimeType,
        media_id: evento.media_id ?? null,
        link: linkMedia
      });
  } else if (imagenSoportada) {
    motivoMediaNoProcesable = 'IMAGEN_NO_DESCARGABLE';

    lineaMedia =
      '[CONTEXTO DE IMAGEN · revision=SI · motivo=IMAGEN_NO_DESCARGABLE] ' +
      'No se pudo obtener la imagen para revisarla automáticamente.';
  } else {
    motivoMediaNoProcesable =
      tipoOriginal === 'image'
        ? 'FORMATO_IMAGEN_NO_SOPORTADO'
        : 'TIPO_ARCHIVO_NO_SOPORTADO';

    lineaMedia =
      `[ARCHIVO NO PROCESABLE · tipo=${tipoMensaje} · mime=${mimeType ?? 'desconocido'}] ` +
      'El bot no puede revisar este archivo automáticamente.';
  }

  const caption =
    typeof evento.caption === 'string'
      ? evento.caption.replace(/\s+/g, ' ').trim().slice(0, LARGO_MAXIMO_CAPTION)
      : '';

  mensaje =
    `[${tipoMensaje}]${caption ? ` ${caption}` : ''}\n${lineaMedia}`;
}

const aptoParaFlujoConversacional =
  aptoParaFlujoTexto || entraComoMedia;

// ------------------------------------------------------
// SALIDA
// ------------------------------------------------------

return [
  {
    json: {
      // ===============================================
      // CONTRATO COMPATIBLE CON "Mensaje entrante TEST"
      // ===============================================

      telefono: String(evento.telefono_cliente),

      nombre_whatsapp:
        evento.nombre_cliente ?? null,

      mensaje,

      tipo: tipoMensaje,

      canal: 'WHATSAPP',

      mensaje_externo_id:
        evento.mensaje_id,

      // ===============================================
      // INFORMACIÓN EXTRA DE META
      // La conservamos para futuras mejoras.
      // ===============================================

      meta_whatsapp: {
        wa_id:
          evento.wa_id ?? null,

        user_id:
          evento.user_id ?? null,

        phone_number_id:
          evento.phone_number_id ?? null,

        display_phone_number:
          evento.display_phone_number ?? null,

        timestamp:
          evento.timestamp ?? null,

        fecha_mensaje:
          fechaMensaje,

        tipo_original:
          tipoOriginal || null,

        media: {
          presente:
            esMultimedia,

          requiere_procesamiento:
            requiereProcesamientoMedia,

          id:
            evento.media_id ?? null,

          mime_type:
            evento.media_mime_type ?? null,

          sha256:
            evento.media_sha256 ?? null,

          caption:
            evento.caption ?? null,

          link_permitido:
            linkPermitido,

          soportada:
            mediaSoportada,

          motivo_no_procesable:
            motivoMediaNoProcesable
        }
      },

      // ===============================================
      // CONTROL
      // ===============================================

      entrada_whatsapp_preparada: true,

      apto_para_flujo_texto:
        aptoParaFlujoTexto,

      apto_para_flujo_conversacional:
        aptoParaFlujoConversacional,

      media_soportada:
        mediaSoportada,

      requiere_procesamiento_media:
        requiereProcesamientoMedia
    }
  }
];