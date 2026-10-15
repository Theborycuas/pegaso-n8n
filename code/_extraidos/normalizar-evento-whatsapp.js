// ======================================================
// N8N NODE - PEGASO
// ======================================================
// Nombre: Normalizar evento WhatsApp
// Node ID: 8621b5ed-b2d2-4a6d-8e22-083f9e858035
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
// NODO N8N: Normalizar evento WhatsApp
// ARCHIVO: code/01-entrada/normalizar-evento-whatsapp.js
// VERSION: 2.2
// RESPONSABILIDAD:
// - Detectar el origen del webhook:
//      1. YCloud inbound:
//         whatsapp.inbound_message.received
//
//      2. YCloud WhatsApp Business App / dispositivo:
//         whatsapp.smb.message.echoes
//
//      3. Meta Cloud API directo:
//         body.entry
//
// - Extraer cuenta Pegaso, cliente y mensaje a un objeto
//   evento_whatsapp uniforme.
//
// - Mantener compatibilidad con todo el flujo existente:
//      telefono_cliente
//      wa_id
//      user_id
//      nombre_cliente
//      mensaje_id
//      timestamp
//      tipo_mensaje
//      texto
//      caption
//      media_*
//
// - Extraer multimedia:
//      imagen
//      audio
//      documento
//      video
//
// - Identificar mensajes enviados manualmente desde
//   WhatsApp Business de Pegaso.
//
// - Clasificar cada evento en clasificacion_mensaje:
//      ENTRANTE_CLIENTE / SALIENTE_HUMANO / SALIENTE_AUTOMATICO.
//   Todo echo es direccion SALIENTE y va a la ruta de
//   salida; nunca entra como mensaje del cliente.
//   SALIENTE_AUTOMATICO = automatización de la app
//   WhatsApp Business (bienvenida / respuestas de las
//   preguntas rápidas del anuncio): se registra pero NO
//   marca atención humana.
//
// - Exponer el contexto de anuncio (referral CTWA) del
//   mensaje entrante: es_lead_anuncio y anuncio.
//
// - NO guardar mensajes.
// - NO modificar prospectos.
// - NO decidir si debe intervenir humano.
// - NO descargar multimedia.
// ======================================================

const input = $input.first().json;
const body = input.body ?? {};


// ======================================================
// 0. AUTOMATIZACIONES DE WHATSAPP BUSINESS
// ======================================================
//
// YCloud entrega los mensajes automáticos de la app
// WhatsApp Business (bienvenida, respuesta del anuncio)
// como whatsapp.smb.message.echoes, con exactamente los
// mismos campos que un mensaje escrito por una persona.
// No existe bandera que los distinga, por eso se
// reconocen por su texto configurado.
//
// Si se cambia una automatización en la app, actualizar
// aquí su texto normalizado (minúsculas, sin tildes,
// sin signos ni emojis).
//
// exacto = true: el mensaje debe ser solo esa frase.
// exacto = false: basta con que empiece por esa frase.
//
// accion_equivalente: lo que ese mensaje ya le pidió o
// dijo al cliente, para no repetirlo desde el BOT.
// ======================================================

const AUTOMATIZACIONES_WHATSAPP_BUSINESS = [
  {
    codigo: 'RESPUESTA_ANUNCIO_MEDIDAS',
    texto: 'claro con mucho gusto le podemos ayudar en que medidas requiere sus etiquetas',
    exacto: false,
    accion_equivalente: 'PEDIR_MEDIDAS'
  },
  {
    codigo: 'BIENVENIDA_PEGASO',
    texto: 'gracias por comunicarte con pegaso adhesivos le saluda borys espinoza',
    exacto: false,
    accion_equivalente: 'SALUDO'
  },
  {
    codigo: 'BIENVENIDA_ANUNCIO',
    texto: 'hola le saluda borys espinoza como puedo ayudarle',
    exacto: true,
    accion_equivalente: 'SALUDO'
  },
  {
    codigo: 'RESPUESTA_ANUNCIO_MATERIAL',
    texto: 'trabajamos con plastico polipropileno de alta adherencia',
    exacto: false,
    accion_equivalente: 'INFORMAR_MATERIAL'
  }
];


// ======================================================
// 1. HELPERS
// ======================================================

const limpiarTelefono = (valor) => {
  if (
    valor === undefined ||
    valor === null ||
    valor === ''
  ) {
    return null;
  }

  const limpio = String(valor)
    .replace(/[^\d]/g, '')
    .trim();

  return limpio || null;
};


const textoONull = (valor) => {
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
};


const isoAUnix = (valor) => {
  if (!valor) {
    return null;
  }

  const fecha =
    new Date(valor);

  if (
    Number.isNaN(
      fecha.getTime()
    )
  ) {
    return valor;
  }

  return String(
    Math.floor(
      fecha.getTime() / 1000
    )
  );
};


const normalizarHuella = (valor) =>
  String(valor ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();


const resolverAutomatizacion = (valor) => {
  const huella =
    normalizarHuella(valor);

  if (!huella) {
    return null;
  }

  return AUTOMATIZACIONES_WHATSAPP_BUSINESS.find(
    a =>
      a.exacto
        ? huella === a.texto
        : huella.startsWith(a.texto)
  ) ?? null;
};


const extraerAnuncio = (referral) => {
  if (
    !referral ||
    typeof referral !== 'object'
  ) {
    return null;
  }

  const sourceType =
    textoONull(referral.source_type)?.toLowerCase() ?? null;

  const ctwaClid =
    textoONull(referral.ctwa_clid);

  if (
    sourceType !== 'ad' &&
    !ctwaClid
  ) {
    return null;
  }

  return {
    source_type: sourceType,
    source_id: textoONull(referral.source_id),
    source_url: textoONull(referral.source_url),
    headline: textoONull(referral.headline),
    ctwa_clid: ctwaClid,
    welcome_message:
      textoONull(referral.welcome_message?.text)
  };
};


// ======================================================
// 2. DETECTAR TIPO DE EVENTO
// ======================================================

const tipoEvento =
  textoONull(
    body.type
  );


// ------------------------------------------------------
// YCLOUD - MENSAJE ENTRANTE DEL CLIENTE
// ------------------------------------------------------

const esYCloudInbound =
  tipoEvento ===
    'whatsapp.inbound_message.received' &&
  !!body.whatsappInboundMessage;


// ------------------------------------------------------
// YCLOUD - MENSAJE ENVIADO DESDE WHATSAPP BUSINESS
// ------------------------------------------------------
//
// Este evento aparece cuando alguien escribe desde:
//
// - WhatsApp Business App
// - WhatsApp Web vinculado
// - dispositivo vinculado
//
// No corresponde al webhook inbound del cliente.
//
// Ejemplo:
// from = número Pegaso
// to   = número cliente
//
// ------------------------------------------------------

const esYCloudEchoHumano =
  tipoEvento ===
    'whatsapp.smb.message.echoes' &&
  !!body.whatsappMessage;


// ------------------------------------------------------
// META CLOUD API DIRECTO
// ------------------------------------------------------

const esMeta =
  Array.isArray(
    body.entry
  );


// ======================================================
// 3. VALORES NORMALIZADOS
// ======================================================

let procesable = false;

let object = null;
let field = null;

let phoneNumberId = null;
let displayPhoneNumber = null;

let telefonoCliente = null;
let waId = null;
let userId = null;
let nombreCliente = null;

let mensajeId = null;
let timestamp = null;
let tipo = null;

let texto = null;
let caption = null;

let mediaId = null;
let mediaMimeType = null;
let mediaSha256 = null;
let mediaLink = null;

let origen = null;

let proveedorEventoId = null;
let wabaId = null;


// ======================================================
// 4. NUEVOS CAMPOS DE CONTROL
// ======================================================

let direccion = null;

let actor = null;

let esMensajeEntrante = false;

let esMensajeHumanoPegaso = false;

let esMensajeAutomaticoPegaso = false;

let clasificacionMensaje = null;

let automatizacion = null;

let anuncio = null;

let eventoConversacional = false;


// ======================================================
// 5. HELPER MULTIMEDIA YCLOUD
// ======================================================
//
// Tanto whatsappInboundMessage como whatsappMessage
// pueden contener estructuras multimedia similares.
//
// ======================================================

function extraerMediaYCloud(message, tipoMensaje) {

  if (
    !message ||
    !tipoMensaje
  ) {
    return {
      id: null,
      mimeType: null,
      sha256: null,
      caption: null,
      link: null
    };
  }


  if (
    ![
      'image',
      'audio',
      'document',
      'video',
      'sticker'
    ].includes(tipoMensaje)
  ) {
    return {
      id: null,
      mimeType: null,
      sha256: null,
      caption: null,
      link: null
    };
  }


  const media =
    message[tipoMensaje] ?? {};


  return {

    id:
      media.id ??
      media.mediaId ??
      null,

    mimeType:
      media.mimeType ??
      media.mime_type ??
      null,

    sha256:
      media.sha256 ??
      null,

    caption:
      media.caption ??
      null,

    link:
      media.link ??
      null
  };
}


// ======================================================
// 6. YCLOUD - MENSAJE ENTRANTE
// ======================================================

if (esYCloudInbound) {

  const message =
    body.whatsappInboundMessage ?? {};


  // ----------------------------------------------------
  // ORIGEN
  // ----------------------------------------------------

  origen =
    'YCLOUD';

  proveedorEventoId =
    body.id ?? null;


  // ----------------------------------------------------
  // COMPATIBILIDAD
  // ----------------------------------------------------

  object =
    'whatsapp_business_account';

  field =
    'messages';


  // ----------------------------------------------------
  // CLASIFICACIÓN
  // ----------------------------------------------------

  direccion =
    'ENTRANTE';

  actor =
    'PROSPECTO';

  esMensajeEntrante =
    true;

  esMensajeHumanoPegaso =
    false;

  clasificacionMensaje =
    'ENTRANTE_CLIENTE';

  eventoConversacional =
    true;


  // ----------------------------------------------------
  // ANUNCIO (Click to WhatsApp)
  // ----------------------------------------------------
  //
  // Meta adjunta referral al primer mensaje que llega
  // desde un anuncio. La app WhatsApp Business responde
  // sola a ese mensaje y su eco llega segundos después.
  //
  // ----------------------------------------------------

  anuncio =
    extraerAnuncio(
      message.referral
    );


  // ----------------------------------------------------
  // CUENTA PEGASO
  // ----------------------------------------------------

  wabaId =
    message.wabaId ??
    null;


  // YCloud no entrega aquí Meta phone_number_id.
  phoneNumberId =
    null;


  displayPhoneNumber =
    limpiarTelefono(
      message.to
    );


  // ----------------------------------------------------
  // CLIENTE
  // ----------------------------------------------------

  telefonoCliente =
    limpiarTelefono(
      message.from
    );


  waId =
    limpiarTelefono(
      message.from
    );


  userId =
    message.fromUserId ??
    null;


  nombreCliente =
    message.customerProfile?.name ??
    null;


  // ----------------------------------------------------
  // MENSAJE
  // ----------------------------------------------------

  mensajeId =
    message.wamid ??
    message.id ??
    null;


  timestamp =
    isoAUnix(
      message.sendTime ??
      message.createTime
    );


  tipo =
    textoONull(
      message.type
    )?.toLowerCase() ??
    null;


  // ----------------------------------------------------
  // TEXTO
  // ----------------------------------------------------

  if (
    tipo === 'text'
  ) {

    texto =
      message.text?.body ??
      null;
  }


  // ----------------------------------------------------
  // MULTIMEDIA
  // ----------------------------------------------------

  const media =
    extraerMediaYCloud(
      message,
      tipo
    );


  mediaId =
    media.id;

  mediaMimeType =
    media.mimeType;

  mediaSha256 =
    media.sha256;

  mediaLink =
    media.link;

  caption =
    media.caption;


  // ----------------------------------------------------
  // PROCESABLE
  // ----------------------------------------------------

  procesable =
    !!mensajeId &&
    !!telefonoCliente &&
    !!tipo;
}


// ======================================================
// 7. YCLOUD - MENSAJE HUMANO DE PEGASO
// ======================================================
//
// Ejemplo real:
//
// type:
// whatsapp.smb.message.echoes
//
// whatsappMessage:
// {
//   from: "+593962645735",
//   to: "+593996588558",
//   type: "text",
//   text: {
//     body: "hola otra vez"
//   }
// }
//
// IMPORTANTE:
//
// En este evento:
//
// from = PEGASO
// to   = CLIENTE
//
// Por eso telefono_cliente sale de message.to.
//
// ======================================================

else if (esYCloudEchoHumano) {

  const message =
    body.whatsappMessage ?? {};


  // ----------------------------------------------------
  // ORIGEN
  // ----------------------------------------------------

  origen =
    'YCLOUD';

  proveedorEventoId =
    body.id ?? null;


  // ----------------------------------------------------
  // COMPATIBILIDAD
  // ----------------------------------------------------
  //
  // Conservamos estos valores para no romper nodos que
  // esperan la estructura histórica.
  //
  // ----------------------------------------------------

  object =
    'whatsapp_business_account';

  field =
    'messages';


  // ----------------------------------------------------
  // CLASIFICACIÓN
  // ----------------------------------------------------

  direccion =
    'SALIENTE';

  automatizacion =
    textoONull(message.type)?.toLowerCase() === 'text'
      ? resolverAutomatizacion(
          message.text?.body
        )
      : null;

  esMensajeAutomaticoPegaso =
    automatizacion !== null;

  actor =
    esMensajeAutomaticoPegaso
      ? 'AUTOMATIZACION_WHATSAPP_BUSINESS'
      : 'HUMANO_PEGASO';

  esMensajeEntrante =
    false;

  esMensajeHumanoPegaso =
    !esMensajeAutomaticoPegaso;

  clasificacionMensaje =
    esMensajeAutomaticoPegaso
      ? 'SALIENTE_AUTOMATICO'
      : 'SALIENTE_HUMANO';

  eventoConversacional =
    true;


  // ----------------------------------------------------
  // CUENTA PEGASO
  // ----------------------------------------------------

  wabaId =
    message.wabaId ??
    null;


  phoneNumberId =
    null;


  // En echo:
  // FROM = PEGASO

  displayPhoneNumber =
    limpiarTelefono(
      message.from
    );


  // ----------------------------------------------------
  // CLIENTE
  // ----------------------------------------------------
  //
  // En echo:
  // TO = CLIENTE
  //
  // ----------------------------------------------------

  telefonoCliente =
    limpiarTelefono(
      message.to
    );


  waId =
    limpiarTelefono(
      message.to
    );


  userId =
    message.toUserId ??
    null;


  // El evento echo normalmente no trae
  // customerProfile del cliente.
  nombreCliente =
    message.customerProfile?.name ??
    null;


  // ----------------------------------------------------
  // MENSAJE
  // ----------------------------------------------------

  mensajeId =
    message.wamid ??
    message.id ??
    null;


  timestamp =
    isoAUnix(
      message.sendTime ??
      message.createTime
    );


  tipo =
    textoONull(
      message.type
    )?.toLowerCase() ??
    null;


  // ----------------------------------------------------
  // TEXTO
  // ----------------------------------------------------

  if (
    tipo === 'text'
  ) {

    texto =
      message.text?.body ??
      null;
  }


  // ----------------------------------------------------
  // MULTIMEDIA
  // ----------------------------------------------------
  //
  // Dejamos soporte también para que una persona de
  // Pegaso pueda enviar imagen/documento/video/etc.
  //
  // ----------------------------------------------------

  const media =
    extraerMediaYCloud(
      message,
      tipo
    );


  mediaId =
    media.id;

  mediaMimeType =
    media.mimeType;

  mediaSha256 =
    media.sha256;

  mediaLink =
    media.link;

  caption =
    media.caption;


  // ----------------------------------------------------
  // PROCESABLE
  // ----------------------------------------------------
  //
  // Sí es un evento conversacional válido.
  //
  // El IF "¿Mensaje humano de Pegaso?" debe interceptarlo
  // ANTES del flujo normal del prospecto.
  //
  // ----------------------------------------------------

  procesable =
    !!mensajeId &&
    !!telefonoCliente &&
    !!tipo;
}


// ======================================================
// 8. META CLOUD API DIRECTO
// ======================================================

else if (esMeta) {

  const entry =
    body.entry?.[0] ?? {};

  const change =
    entry.changes?.[0] ?? {};


  field =
    change.field ??
    null;


  const value =
    change.value ?? {};

  const metadata =
    value.metadata ?? {};

  const contacts =
    value.contacts ?? [];

  const messages =
    value.messages ?? [];


  const contact =
    contacts[0] ?? {};

  const message =
    messages[0] ?? {};


  tipo =
    textoONull(
      message.type
    )?.toLowerCase() ??
    null;


  origen =
    'META_CLOUD_API';


  object =
    body.object ??
    null;


  // ----------------------------------------------------
  // CLASIFICACIÓN
  // ----------------------------------------------------

  direccion =
    'ENTRANTE';

  actor =
    'PROSPECTO';

  esMensajeEntrante =
    messages.length > 0;

  esMensajeHumanoPegaso =
    false;

  clasificacionMensaje =
    messages.length > 0
      ? 'ENTRANTE_CLIENTE'
      : null;

  eventoConversacional =
    messages.length > 0;


  // ----------------------------------------------------
  // CUENTA PEGASO
  // ----------------------------------------------------

  phoneNumberId =
    metadata.phone_number_id ??
    null;


  displayPhoneNumber =
    limpiarTelefono(
      metadata.display_phone_number
    );


  wabaId =
    entry.id ??
    null;


  // ----------------------------------------------------
  // CLIENTE
  // ----------------------------------------------------

  telefonoCliente =
    limpiarTelefono(
      message.from ??
      contact.wa_id
    );


  waId =
    limpiarTelefono(
      contact.wa_id
    );


  userId =
    contact.user_id ??
    null;


  nombreCliente =
    contact.profile?.name ??
    null;


  // ----------------------------------------------------
  // MENSAJE
  // ----------------------------------------------------

  mensajeId =
    message.id ??
    null;


  timestamp =
    message.timestamp ??
    null;


  // ----------------------------------------------------
  // TEXTO
  // ----------------------------------------------------

  if (
    tipo === 'text'
  ) {

    texto =
      message.text?.body ??
      null;
  }


  // ----------------------------------------------------
  // IMAGEN
  // ----------------------------------------------------

  if (
    tipo === 'image'
  ) {

    mediaId =
      message.image?.id ??
      null;

    mediaMimeType =
      message.image?.mime_type ??
      null;

    mediaSha256 =
      message.image?.sha256 ??
      null;

    caption =
      message.image?.caption ??
      null;
  }


  // ----------------------------------------------------
  // AUDIO
  // ----------------------------------------------------

  if (
    tipo === 'audio'
  ) {

    mediaId =
      message.audio?.id ??
      null;

    mediaMimeType =
      message.audio?.mime_type ??
      null;

    mediaSha256 =
      message.audio?.sha256 ??
      null;
  }


  // ----------------------------------------------------
  // DOCUMENTO
  // ----------------------------------------------------

  if (
    tipo === 'document'
  ) {

    mediaId =
      message.document?.id ??
      null;

    mediaMimeType =
      message.document?.mime_type ??
      null;

    mediaSha256 =
      message.document?.sha256 ??
      null;

    caption =
      message.document?.caption ??
      null;
  }


  // ----------------------------------------------------
  // VIDEO
  // ----------------------------------------------------

  if (
    tipo === 'video'
  ) {

    mediaId =
      message.video?.id ??
      null;

    mediaMimeType =
      message.video?.mime_type ??
      null;

    mediaSha256 =
      message.video?.sha256 ??
      null;

    caption =
      message.video?.caption ??
      null;
  }


  // ----------------------------------------------------
  // PROCESABLE
  // ----------------------------------------------------

  const esEventoMessages =
    field === 'messages';


  const tieneMensaje =
    messages.length > 0;


  procesable =
    esEventoMessages &&
    tieneMensaje &&
    !!mensajeId &&
    !!telefonoCliente;
}


// ======================================================
// 9. EVENTOS NO CONVERSACIONALES / DESCONOCIDOS
// ======================================================
//
// Ejemplo:
//
// whatsapp.message.updated
//
// No debe confundirse con intervención humana.
//
// ======================================================

else {

  origen =
    tipoEvento?.startsWith('whatsapp.')
      ? 'YCLOUD'
      : null;


  proveedorEventoId =
    body.id ??
    null;


  procesable =
    false;


  eventoConversacional =
    false;


  esMensajeEntrante =
    false;


  esMensajeHumanoPegaso =
    false;
}


// ======================================================
// 10. SALIDA NORMALIZADA
// ======================================================

return [
  {
    json: {

      evento_whatsapp: {

        // ==============================================
        // PROCESABILIDAD
        // ==============================================

        procesable,


        // ==============================================
        // TIPO DE EVENTO
        // ==============================================

        evento_tipo:
          tipoEvento,

        evento_conversacional:
          eventoConversacional,


        // ==============================================
        // DIRECCIÓN / ACTOR
        // ==============================================

        direccion,

        actor,

        es_mensaje_entrante:
          esMensajeEntrante,

        es_mensaje_humano_pegaso:
          esMensajeHumanoPegaso,

        es_mensaje_automatico_pegaso:
          esMensajeAutomaticoPegaso,

        clasificacion_mensaje:
          clasificacionMensaje,

        automatizacion_codigo:
          automatizacion?.codigo ?? null,

        accion_equivalente:
          automatizacion?.accion_equivalente ?? null,


        // ==============================================
        // ANUNCIO
        // ==============================================

        es_lead_anuncio:
          anuncio !== null,

        anuncio,


        // ==============================================
        // COMPATIBILIDAD
        // ==============================================

        object,

        field,


        // ==============================================
        // CUENTA / PEGASO
        // ==============================================

        phone_number_id:
          phoneNumberId,

        display_phone_number:
          displayPhoneNumber,

        waba_id:
          wabaId,


        // ==============================================
        // CLIENTE
        // ==============================================

        telefono_cliente:
          telefonoCliente,

        wa_id:
          waId,

        user_id:
          userId,

        nombre_cliente:
          nombreCliente,


        // ==============================================
        // MENSAJE
        // ==============================================

        mensaje_id:
          mensajeId,

        timestamp,

        tipo_mensaje:
          tipo,

        texto,

        caption,


        // ==============================================
        // MULTIMEDIA
        // ==============================================

        media_id:
          mediaId,

        media_mime_type:
          mediaMimeType,

        media_sha256:
          mediaSha256,

        media_link:
          mediaLink,


        // ==============================================
        // CONTROL INTERNO
        // ==============================================

        canal:
          'WHATSAPP',

        origen,

        proveedor_evento_id:
          proveedorEventoId
      },


      // =================================================
      // CONSERVAR EXACTAMENTE EL WEBHOOK ORIGINAL
      // =================================================

      payload_original:
        input
    }
  }
];
