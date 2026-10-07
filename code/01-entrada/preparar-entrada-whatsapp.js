// ======================================================
// NODO N8N: Preparar entrada WhatsApp
// ARCHIVO: code/01-entrada/preparar-entrada-whatsapp.js
// VERSION: 1.0
// RESPONSABILIDAD:
// - Validar que exista evento_whatsapp procesable con telefono_cliente y mensaje_id (lanza error si no)
// - Traducir tipo_mensaje de WhatsApp a enum interno (TEXTO, IMAGEN, AUDIO, VIDEO, DOCUMENTO, STICKER, UBICACION, CONTACTO, INTERACTIVO, DESCONOCIDO)
// - Obtener el texto utilizable: body si es texto, o caption si es imagen/video/documento
// - Convertir el timestamp Unix a fecha ISO y agrupar datos extra en meta_whatsapp (incluido media)
// - Emitir el contrato compatible con "Mensaje entrante TEST" (telefono, nombre_whatsapp, mensaje, tipo, canal, mensaje_externo_id)
// - Calcular apto_para_flujo_texto y requiere_procesamiento_media
// - NO filtrar el flujo (lo decide el IF siguiente "¿Apto para flujo de texto?")
// - NO procesar multimedia (solo la marca)
// ======================================================

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

// Por ahora el MVP comercial trabaja principalmente con texto.
// Dejamos explícitamente identificado todo lo demás.
const aptoParaFlujoTexto =
  tipoOriginal === 'text' &&
  mensaje !== null;

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
            evento.caption ?? null
        }
      },

      // ===============================================
      // CONTROL
      // ===============================================

      entrada_whatsapp_preparada: true,

      apto_para_flujo_texto:
        aptoParaFlujoTexto,

      requiere_procesamiento_media:
        requiereProcesamientoMedia
    }
  }
];