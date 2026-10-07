// ======================================================
// NORMALIZAR EVENTO WHATSAPP
// Compatible con:
// 1. YCloud Coexistence
// 2. Meta Cloud API directo
// ======================================================

const input = $input.first().json;
const body = input.body ?? {};

// ======================================================
// HELPERS
// ======================================================

const limpiarTelefono = (valor) => {
  if (!valor) return null;
  return String(valor).replace(/[^\d]/g, '');
};

const isoAUnix = (valor) => {
  if (!valor) return null;

  const fecha = new Date(valor);

  if (Number.isNaN(fecha.getTime())) {
    return valor;
  }

  return String(Math.floor(fecha.getTime() / 1000));
};

// ======================================================
// DETECTAR ORIGEN
// ======================================================

const esYCloud =
  body.type === 'whatsapp.inbound_message.received' &&
  !!body.whatsappInboundMessage;

const esMeta =
  Array.isArray(body.entry);

// ======================================================
// VALORES NORMALIZADOS
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

let origen = null;

let proveedorEventoId = null;
let wabaId = null;

// ======================================================
// YCLOUD
// ======================================================

if (esYCloud) {

  const message = body.whatsappInboundMessage ?? {};

  origen = 'YCLOUD';

  // Para conservar compatibilidad con el resto del flujo
  object = 'whatsapp_business_account';
  field = 'messages';

  proveedorEventoId = body.id ?? null;

  // ----------------------------------------------------
  // Cuenta / número Pegaso
  // ----------------------------------------------------

  wabaId = message.wabaId ?? null;

  // YCloud no entrega aquí el phone_number_id de Meta.
  // NO ponemos el WABA ID fingiendo que es phone_number_id.
  phoneNumberId = null;

  displayPhoneNumber =
    limpiarTelefono(message.to) ?? null;

  // ----------------------------------------------------
  // Cliente
  // ----------------------------------------------------

  telefonoCliente =
    limpiarTelefono(message.from) ?? null;

  waId =
    limpiarTelefono(message.from) ?? null;

  userId =
    message.fromUserId ?? null;

  nombreCliente =
    message.customerProfile?.name ?? null;

  // ----------------------------------------------------
  // Mensaje
  // ----------------------------------------------------

  mensajeId =
    message.wamid ??
    message.id ??
    null;

  timestamp =
    isoAUnix(message.sendTime);

  tipo =
    message.type ?? null;

  // ----------------------------------------------------
  // TEXTO
  // ----------------------------------------------------

  if (tipo === 'text') {
    texto =
      message.text?.body ??
      null;
  }

  // ----------------------------------------------------
  // IMAGEN
  // Preparado para cuando implementemos multimedia.
  // ----------------------------------------------------

  if (tipo === 'image') {
    const media = message.image ?? {};

    mediaId =
      media.id ??
      media.mediaId ??
      null;

    mediaMimeType =
      media.mimeType ??
      media.mime_type ??
      null;

    mediaSha256 =
      media.sha256 ??
      null;

    caption =
      media.caption ??
      null;
  }

  // ----------------------------------------------------
  // AUDIO
  // ----------------------------------------------------

  if (tipo === 'audio') {
    const media = message.audio ?? {};

    mediaId =
      media.id ??
      media.mediaId ??
      null;

    mediaMimeType =
      media.mimeType ??
      media.mime_type ??
      null;

    mediaSha256 =
      media.sha256 ??
      null;
  }

  // ----------------------------------------------------
  // DOCUMENTO
  // ----------------------------------------------------

  if (tipo === 'document') {
    const media = message.document ?? {};

    mediaId =
      media.id ??
      media.mediaId ??
      null;

    mediaMimeType =
      media.mimeType ??
      media.mime_type ??
      null;

    mediaSha256 =
      media.sha256 ??
      null;

    caption =
      media.caption ??
      null;
  }

  // ----------------------------------------------------
  // VIDEO
  // ----------------------------------------------------

  if (tipo === 'video') {
    const media = message.video ?? {};

    mediaId =
      media.id ??
      media.mediaId ??
      null;

    mediaMimeType =
      media.mimeType ??
      media.mime_type ??
      null;

    mediaSha256 =
      media.sha256 ??
      null;

    caption =
      media.caption ??
      null;
  }

  // ----------------------------------------------------
  // ¿ES PROCESABLE?
  // ----------------------------------------------------

  procesable =
    !!mensajeId &&
    !!telefonoCliente &&
    !!tipo;
}

// ======================================================
// META CLOUD API DIRECTO
// ======================================================

else if (esMeta) {

  const entry = body.entry?.[0] ?? {};
  const change = entry.changes?.[0] ?? {};

  field = change.field ?? null;

  const value = change.value ?? {};
  const metadata = value.metadata ?? {};
  const contacts = value.contacts ?? [];
  const messages = value.messages ?? [];

  const contact = contacts[0] ?? {};
  const message = messages[0] ?? {};

  tipo = message.type ?? null;

  origen = 'META_CLOUD_API';

  object = body.object ?? null;

  phoneNumberId =
    metadata.phone_number_id ?? null;

  displayPhoneNumber =
    metadata.display_phone_number ?? null;

  telefonoCliente =
    limpiarTelefono(
      message.from ??
      contact.wa_id
    );

  waId =
    limpiarTelefono(contact.wa_id);

  userId =
    contact.user_id ?? null;

  nombreCliente =
    contact.profile?.name ?? null;

  mensajeId =
    message.id ?? null;

  timestamp =
    message.timestamp ?? null;

  // ----------------------------------------------------
  // TEXTO
  // ----------------------------------------------------

  if (tipo === 'text') {
    texto =
      message.text?.body ??
      null;
  }

  // ----------------------------------------------------
  // IMAGEN
  // ----------------------------------------------------

  if (tipo === 'image') {
    mediaId =
      message.image?.id ?? null;

    mediaMimeType =
      message.image?.mime_type ?? null;

    mediaSha256 =
      message.image?.sha256 ?? null;

    caption =
      message.image?.caption ?? null;
  }

  // ----------------------------------------------------
  // AUDIO
  // ----------------------------------------------------

  if (tipo === 'audio') {
    mediaId =
      message.audio?.id ?? null;

    mediaMimeType =
      message.audio?.mime_type ?? null;

    mediaSha256 =
      message.audio?.sha256 ?? null;
  }

  // ----------------------------------------------------
  // DOCUMENTO
  // ----------------------------------------------------

  if (tipo === 'document') {
    mediaId =
      message.document?.id ?? null;

    mediaMimeType =
      message.document?.mime_type ?? null;

    mediaSha256 =
      message.document?.sha256 ?? null;

    caption =
      message.document?.caption ?? null;
  }

  // ----------------------------------------------------
  // VIDEO
  // ----------------------------------------------------

  if (tipo === 'video') {
    mediaId =
      message.video?.id ?? null;

    mediaMimeType =
      message.video?.mime_type ?? null;

    mediaSha256 =
      message.video?.sha256 ?? null;

    caption =
      message.video?.caption ?? null;
  }

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
// SALIDA NORMALIZADA
// ======================================================

return [
  {
    json: {

      evento_whatsapp: {

        procesable,

        object,
        field,

        // ----------------------------------------------
        // CUENTA / PEGASO
        // ----------------------------------------------

        phone_number_id: phoneNumberId,
        display_phone_number: displayPhoneNumber,

        waba_id: wabaId,

        // ----------------------------------------------
        // CLIENTE
        // ----------------------------------------------

        telefono_cliente: telefonoCliente,
        wa_id: waId,
        user_id: userId,
        nombre_cliente: nombreCliente,

        // ----------------------------------------------
        // MENSAJE
        // ----------------------------------------------

        mensaje_id: mensajeId,
        timestamp,
        tipo_mensaje: tipo,

        texto,
        caption,

        // ----------------------------------------------
        // MULTIMEDIA
        // ----------------------------------------------

        media_id: mediaId,
        media_mime_type: mediaMimeType,
        media_sha256: mediaSha256,

        // ----------------------------------------------
        // CONTROL INTERNO
        // ----------------------------------------------

        canal: 'WHATSAPP',
        origen,

        proveedor_evento_id: proveedorEventoId
      },

      // Conservamos exactamente lo recibido.
      payload_original: input
    }
  }
];