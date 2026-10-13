// ======================================================
// N8N NODE - PEGASO
// ======================================================
// Nombre: Preparar entrada WhatsApp
// Node ID: a8c7e996-96eb-40f1-9c73-921195df970d
// TypeVersion: 2
//
// Workflow:
// SISTEMA AUTOMATIZADO PEGASO
//
// Workflow ID:
// 09OF22FOxihypeeh
//
// NOTA:
// Archivo generado automáticamente desde n8n.
// El header NO pertenece al código almacenado en n8n.
// ======================================================

// ======================================================
// NODO N8N: Preparar entrada WhatsApp
// ARCHIVO: code/01-entrada/preparar-entrada-whatsapp.js
// VERSION: 2.1
// RESPONSABILIDAD:
// - Validar que exista evento_whatsapp procesable con telefono_cliente y mensaje_id (lanza error si no)
// - Traducir tipo_mensaje de WhatsApp a enum interno
//   (TEXTO, IMAGEN, AUDIO, VIDEO, DOCUMENTO, STICKER,
//    UBICACION, CONTACTO, INTERACTIVO, DESCONOCIDO)
// - Texto: mensaje = body.
// - Imagen/audio soportados:
//   mensaje = descriptor controlado que se guarda en mensajes.contenido:
//     línea 1 "[IMAGEN] caption" o "[AUDIO]"
//     línea 2 "[MEDIA_PENDIENTE] {json}"
// - Imagen no descargable: genera contexto de revisión.
// - Audio no descargable: genera contexto de revisión.
// - Video/documento: por ahora continúan como ARCHIVO NO PROCESABLE.
// - Aceptar enlaces de descarga solo de
//   https://api.ycloud.com/v2/whatsapp/media/download/
//   (anti-SSRF: la credencial YCloud nunca sale a otro host)
// - Convertir timestamp Unix a fecha ISO.
// - Agrupar datos extra en meta_whatsapp.
// - Emitir contrato compatible con "Mensaje entrante TEST".
// - Calcular:
//      apto_para_flujo_texto
//      apto_para_flujo_conversacional
//      media_soportada
//      requiere_procesamiento_media
// - NO descargar ni analizar multimedia.
// - NO transcribir audio.
// - NO decidir acción comercial.
// ======================================================


// ======================================================
// 0. CONFIGURACIÓN
// ======================================================

const MIME_IMAGEN_SOPORTADOS = [
  'image/jpeg',
  'image/png',
  'image/webp'
];

const MIME_AUDIO_SOPORTADOS = [
  'audio/ogg',
  'audio/opus',
  'audio/mpeg',
  'audio/mp3',
  'audio/mp4',
  'audio/x-m4a',
  'audio/m4a',
  'audio/wav',
  'audio/x-wav',
  'audio/webm'
];

const LINK_YCLOUD_PERMITIDO =
  /^https:\/\/api\.ycloud\.com\/v2\/whatsapp\/media\/download\/[A-Za-z0-9_-]+(\?[A-Za-z0-9%._~&=+-]*)?$/;

const LARGO_MAXIMO_LINK = 2048;
const LARGO_MAXIMO_CAPTION = 1000;


// ======================================================
// 1. HELPERS
// ======================================================

function textoONull(valor) {
  if (
    valor === undefined ||
    valor === null
  ) {
    return null;
  }

  const limpio =
    String(valor).trim();

  return limpio !== ''
    ? limpio
    : null;
}


function mimeBase(valor) {
  if (
    valor === undefined ||
    valor === null
  ) {
    return null;
  }

  const limpio =
    String(valor)
      .trim()
      .toLowerCase();

  if (!limpio) {
    return null;
  }

  return limpio
    .split(';')[0]
    .trim() || null;
}


function normalizarCaption(valor) {
  if (
    valor === undefined ||
    valor === null
  ) {
    return '';
  }

  return String(valor)
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, LARGO_MAXIMO_CAPTION);
}


// ======================================================
// 2. INPUT
// ======================================================

const input =
  $input.first().json;

const evento =
  input.evento_whatsapp ?? null;


// ======================================================
// 3. VALIDACIONES BÁSICAS
// ======================================================

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


// ======================================================
// 4. NORMALIZAR TIPO
// ======================================================

const tipoOriginal =
  String(
    evento.tipo_mensaje ?? ''
  )
    .trim()
    .toLowerCase();

let tipoMensaje =
  'DESCONOCIDO';

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


// ======================================================
// 5. TEXTO UTILIZABLE
// ======================================================

let mensaje = null;

if (tipoOriginal === 'text') {
  mensaje =
    textoONull(
      evento.texto
    );
}


// ------------------------------------------------------
// Caption para medios que puedan traerlo.
// Audio normalmente no trae caption, pero no perjudica
// conservarlo si el proveedor alguna vez lo entrega.
// ------------------------------------------------------

if (
  !mensaje &&
  [
    'image',
    'audio',
    'video',
    'document'
  ].includes(tipoOriginal)
) {
  mensaje =
    textoONull(
      evento.caption
    );
}


// ======================================================
// 6. TIMESTAMP
// ======================================================

let fechaMensaje = null;

if (evento.timestamp) {

  const timestampNumero =
    Number(
      evento.timestamp
    );

  if (
    Number.isFinite(
      timestampNumero
    )
  ) {
    fechaMensaje =
      new Date(
        timestampNumero * 1000
      ).toISOString();
  }
}


// ======================================================
// 7. CONTROL GENERAL DE MULTIMEDIA
// ======================================================

const esMultimedia = [
  'image',
  'audio',
  'video',
  'document',
  'sticker'
].includes(
  tipoOriginal
);


const requiereProcesamientoMedia =
  esMultimedia &&
  !!evento.media_id;


const aptoParaFlujoTexto =
  tipoOriginal === 'text' &&
  mensaje !== null;


// ======================================================
// 8. DESCRIPTOR MULTIMEDIA
// ======================================================
//
// IMPORTANTE:
//
// El caption se aplana a una sola línea.
// Así el cliente no puede inyectar artificialmente:
//   [MEDIA_PENDIENTE]
//   [CONTEXTO DE IMAGEN]
//   [TRANSCRIPCION DE AUDIO]
// etc.
//
// Los stickers continúan fuera del flujo conversacional.
//
// ======================================================

const TIPOS_FLUJO_MEDIA = [
  'image',
  'audio',
  'video',
  'document'
];

const entraComoMedia =
  TIPOS_FLUJO_MEDIA.includes(
    tipoOriginal
  );


const mimeTypeOriginal =
  textoONull(
    evento.media_mime_type
  );


const mimeType =
  mimeBase(
    evento.media_mime_type
  );


const linkMedia =
  textoONull(
    evento.media_link
  );


const linkPermitido =
  !!linkMedia &&
  linkMedia.length <= LARGO_MAXIMO_LINK &&
  LINK_YCLOUD_PERMITIDO.test(
    linkMedia
  );


const imagenSoportada =
  tipoOriginal === 'image' &&
  MIME_IMAGEN_SOPORTADOS.includes(
    mimeType
  );


const audioSoportado =
  tipoOriginal === 'audio' &&
  MIME_AUDIO_SOPORTADOS.includes(
    mimeType
  );


let mediaSoportada =
  false;

let motivoMediaNoProcesable =
  null;

let lineaMedia =
  null;


// ======================================================
// 9. CONSTRUIR MENSAJE MULTIMEDIA
// ======================================================

if (entraComoMedia) {

  const caption =
    normalizarCaption(
      evento.caption
    );


  // ----------------------------------------------------
  // IMAGEN SOPORTADA + LINK VÁLIDO
  // ----------------------------------------------------

  if (
    imagenSoportada &&
    linkPermitido
  ) {

    mediaSoportada =
      true;

    lineaMedia =
      '[MEDIA_PENDIENTE] ' +
      JSON.stringify({
        tipo_media:
          'IMAGEN',

        mime_type:
          mimeType,

        mime_type_original:
          mimeTypeOriginal,

        media_id:
          evento.media_id ?? null,

        link:
          linkMedia
      });

  }


  // ----------------------------------------------------
  // AUDIO SOPORTADO + LINK VÁLIDO
  // ----------------------------------------------------

  else if (
    audioSoportado &&
    linkPermitido
  ) {

    mediaSoportada =
      true;

    lineaMedia =
      '[MEDIA_PENDIENTE] ' +
      JSON.stringify({
        tipo_media:
          'AUDIO',

        mime_type:
          mimeType,

        mime_type_original:
          mimeTypeOriginal,

        media_id:
          evento.media_id ?? null,

        link:
          linkMedia
      });

  }


  // ----------------------------------------------------
  // IMAGEN SOPORTADA PERO SIN LINK UTILIZABLE
  // ----------------------------------------------------

  else if (
    imagenSoportada
  ) {

    motivoMediaNoProcesable =
      'IMAGEN_NO_DESCARGABLE';

    lineaMedia =
      '[CONTEXTO DE IMAGEN · revision=SI · motivo=IMAGEN_NO_DESCARGABLE] ' +
      'No se pudo obtener la imagen para revisarla automáticamente.';

  }


  // ----------------------------------------------------
  // AUDIO SOPORTADO PERO SIN LINK UTILIZABLE
  // ----------------------------------------------------

  else if (
    audioSoportado
  ) {

    motivoMediaNoProcesable =
      'AUDIO_NO_DESCARGABLE';

    lineaMedia =
      '[CONTEXTO DE AUDIO · revision=SI · motivo=AUDIO_NO_DESCARGABLE] ' +
      'No se pudo obtener el audio para transcribirlo automáticamente.';

  }


  // ----------------------------------------------------
  // IMAGEN CON FORMATO NO SOPORTADO
  // ----------------------------------------------------

  else if (
    tipoOriginal === 'image'
  ) {

    motivoMediaNoProcesable =
      'FORMATO_IMAGEN_NO_SOPORTADO';

    lineaMedia =
      `[ARCHIVO NO PROCESABLE · tipo=${tipoMensaje} · mime=${mimeTypeOriginal ?? 'desconocido'}] ` +
      'El bot no puede revisar este archivo automáticamente.';

  }


  // ----------------------------------------------------
  // AUDIO CON FORMATO NO SOPORTADO
  // ----------------------------------------------------

  else if (
    tipoOriginal === 'audio'
  ) {

    motivoMediaNoProcesable =
      'FORMATO_AUDIO_NO_SOPORTADO';

    lineaMedia =
      `[ARCHIVO NO PROCESABLE · tipo=${tipoMensaje} · mime=${mimeTypeOriginal ?? 'desconocido'}] ` +
      'El bot no puede transcribir este audio automáticamente.';

  }


  // ----------------------------------------------------
  // VIDEO / DOCUMENTO
  // ----------------------------------------------------

  else {

    motivoMediaNoProcesable =
      'TIPO_ARCHIVO_NO_SOPORTADO';

    lineaMedia =
      `[ARCHIVO NO PROCESABLE · tipo=${tipoMensaje} · mime=${mimeTypeOriginal ?? 'desconocido'}] ` +
      'El bot no puede revisar este archivo automáticamente.';

  }


  // ----------------------------------------------------
  // CONTENIDO QUE SE PERSISTE EN mensajes.contenido
  // ----------------------------------------------------

  mensaje =
    `[${tipoMensaje}]` +
    (
      caption
        ? ` ${caption}`
        : ''
    ) +
    `\n${lineaMedia}`;
}


// ======================================================
// 10. APTO PARA FLUJO CONVERSACIONAL
// ======================================================
//
// Conservamos exactamente el comportamiento anterior:
//
// TEXTO:
//   sí
//
// IMAGEN/AUDIO/VIDEO/DOCUMENTO:
//   sí, incluso cuando no son procesables automáticamente,
//   porque la etapa posterior puede derivarlos a humano.
//
// STICKER:
//   no.
//
// ======================================================

const aptoParaFlujoConversacional =
  aptoParaFlujoTexto ||
  entraComoMedia;


// ======================================================
// 11. SALIDA
// ======================================================

return [
  {
    json: {

      // ===============================================
      // CONTRATO COMPATIBLE CON "Mensaje entrante TEST"
      // ===============================================

      telefono:
        String(
          evento.telefono_cliente
        ),

      nombre_whatsapp:
        evento.nombre_cliente ?? null,

      mensaje,

      tipo:
        tipoMensaje,

      canal:
        'WHATSAPP',

      mensaje_externo_id:
        evento.mensaje_id,


      // ===============================================
      // INFORMACIÓN EXTRA DE META
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


        // ---------------------------------------------
        // MULTIMEDIA
        // ---------------------------------------------

        media: {

          presente:
            esMultimedia,

          requiere_procesamiento:
            requiereProcesamientoMedia,

          id:
            evento.media_id ?? null,

          // Conservamos el MIME tal como llegó.
          mime_type:
            evento.media_mime_type ?? null,

          // Y añadimos el MIME base para lógica interna.
          mime_type_base:
            mimeType,

          sha256:
            evento.media_sha256 ?? null,

          caption:
            evento.caption ?? null,

          link:
            linkMedia,

          link_permitido:
            linkPermitido,

          soportada:
            mediaSoportada,

          tipo_media:
            mediaSoportada
              ? tipoMensaje
              : null,

          motivo_no_procesable:
            motivoMediaNoProcesable
        }
      },


      // ===============================================
      // CONTROL
      // ===============================================

      entrada_whatsapp_preparada:
        true,

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
