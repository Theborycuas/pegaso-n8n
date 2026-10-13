// ======================================================
// N8N NODE - PEGASO
// ======================================================
// Nombre: Preparar handoff entrada no soportada
// Node ID: c8e51c4f-be8a-45ae-af4f-dc91560f43f9
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
// PREPARAR HANDOFF ENTRADA NO SOPORTADA
// PEGASO ADHESIVOS
// VERSION: 1.1
// ======================================================
//
// OBJETIVO:
//
// Preparar una derivación humana directa cuando:
//
// 1. Llega un tipo de entrada que el flujo automático
//    todavía no puede procesar.
//
// 2. Un audio sí era soportado, pero fallaron todos los
//    mecanismos automáticos de transcripción:
//
//      Groq -> falla / transcripción inválida
//      Deepgram -> falla / transcripción inválida
//
// Ejemplos:
// - audio no interpretable
// - video
// - documento
// - sticker
// - ubicación
// - contacto
// - tipo desconocido
//
// IMPORTANTE:
//
// Este nodo NO:
// - transcribe audio
// - analiza imágenes
// - consulta al cerebro comercial
// - decide una cotización
//
// Este nodo únicamente normaliza el evento y construye
// el contrato necesario para la ruta estándar de
// derivación humana.
//
// Puede recibir datos desde distintos puntos del flujo,
// por lo que recupera contexto de nodos anteriores cuando
// el item actual perdió algunos campos.
//
// ======================================================

const input = $input.first().json ?? {};


// ======================================================
// 1. HELPERS
// ======================================================

function texto(valor) {

  if (
    valor === undefined ||
    valor === null
  ) {
    return null;
  }

  const limpio =
    String(valor)
      .replace(/\s+/g, ' ')
      .trim();

  return limpio !== ''
    ? limpio
    : null;
}


function numeroONull(valor) {

  if (
    valor === undefined ||
    valor === null ||
    valor === ''
  ) {
    return null;
  }

  const n =
    Number(valor);

  return Number.isFinite(n)
    ? n
    : null;
}


function objetoSeguro(valor) {

  return (
    valor &&
    typeof valor === 'object' &&
    !Array.isArray(valor)
  )
    ? valor
    : {};
}


// ======================================================
// 2. RECUPERAR CONTEXTO DE NODOS ANTERIORES
// ======================================================
//
// Los nodos HTTP de error pueden perder parte del
// contrato previo.
//
// Recuperamos datos desde nodos estables del flujo.
// ======================================================

let turno = {};

try {

  turno =
    $('Resolver turno conversacional')
      .first()
      .json ?? {};

} catch (_) {

  turno = {};

}


let mediaAudio = {};

try {

  mediaAudio =
    $('Preparar audio del turno')
      .first()
      .json ?? {};

} catch (_) {

  mediaAudio = {};

}


let entradaWhatsApp = {};

try {

  entradaWhatsApp =
    $('Preparar entrada WhatsApp')
      .first()
      .json ?? {};

} catch (_) {

  entradaWhatsApp = {};

}


let normalizado = {};

try {

  normalizado =
    $('Normalizar mensaje')
      .first()
      .json ?? {};

} catch (_) {

  normalizado = {};

}


let conversacion = {};

try {

  conversacion =
    $('Preparar conversación')
      .first()
      .json ?? {};

} catch (_) {

  conversacion = {};

}


// ======================================================
// 3. IDENTIFICACIÓN
// ======================================================

const conversacionId =
  numeroONull(
    input.conversacion_id ??
    input.id_conversacion ??
    turno.conversacion_id ??
    mediaAudio.conversacion_id ??
    conversacion.conversacion_id ??
    conversacion.id
  );


const prospectoId =
  numeroONull(
    input.prospecto_id ??
    turno.prospecto_id ??
    mediaAudio.prospecto_id ??
    conversacion.prospecto_id
  );


const clienteId =
  numeroONull(
    input.cliente_id ??
    turno.cliente_id ??
    mediaAudio.cliente_id ??
    conversacion.cliente_id
  );


const contactoId =
  numeroONull(
    input.contacto_id ??
    turno.contacto_id ??
    mediaAudio.contacto_id ??
    conversacion.contacto_id
  );


// ======================================================
// 4. TELÉFONO / NOMBRE
// ======================================================

const telefono =
  texto(
    input.telefono ??
    turno.telefono ??
    mediaAudio.telefono ??
    normalizado.telefono ??
    entradaWhatsApp.telefono ??
    conversacion.telefono
  );


const nombreWhatsApp =
  texto(
    input.nombre_whatsapp ??
    input.prospecto_nombre ??
    turno.nombre_whatsapp ??
    mediaAudio.nombre_whatsapp ??
    normalizado.nombre_whatsapp ??
    entradaWhatsApp.nombre_whatsapp ??
    conversacion.nombre_whatsapp ??
    conversacion.prospecto_nombre
  );


// ======================================================
// 5. TIPO DE ENTRADA
// ======================================================

const tipoEntrada =
  (
    texto(
      input.tipo ??
      input.tipo_mensaje ??
      input.tipo_original ??
      input.meta_whatsapp?.tipo_original ??
      mediaAudio.tipo ??
      mediaAudio.tipo_media ??
      normalizado.tipo ??
      entradaWhatsApp.tipo ??
      entradaWhatsApp.meta_whatsapp?.tipo_original
    ) ??
    'DESCONOCIDO'
  ).toUpperCase();


// ======================================================
// 6. MENSAJE ORIGINAL DEL CLIENTE
// ======================================================

let mensajeActual =
  texto(
    input.mensaje_actual
  ) ??
  texto(
    input.mensaje_cliente_original
  ) ??
  texto(
    input.mensaje
  ) ??
  texto(
    input.contenido
  ) ??
  texto(
    input.texto_asociado
  ) ??
  texto(
    input.caption
  ) ??
  texto(
    input.meta_whatsapp?.media?.caption
  ) ??
  texto(
    mediaAudio.texto_asociado
  ) ??
  texto(
    mediaAudio.contenido_base
  ) ??
  texto(
    normalizado.mensaje
  ) ??
  texto(
    entradaWhatsApp.mensaje
  ) ??
  '';


// Si el mensaje quedó únicamente como descriptor de sistema,
// construimos una representación más humana.

if (
  mensajeActual === '[AUDIO]' ||
  mensajeActual === '[VIDEO]' ||
  mensajeActual === '[DOCUMENTO]'
) {

  const descripcionTipo =
    tipoEntrada === 'AUDIO'
      ? 'Audio enviado por el prospecto'
      : tipoEntrada === 'VIDEO'
        ? 'Video enviado por el prospecto'
        : tipoEntrada === 'DOCUMENTO'
          ? 'Documento enviado por el prospecto'
          : 'Archivo enviado por el prospecto';

  mensajeActual =
    `[${descripcionTipo}]`;
}


// ======================================================
// 7. DETECTAR FALLO DE TRANSCRIPCIÓN DE AUDIO
// ======================================================
//
// Esta detección permite que este mismo nodo reciba:
//
// - false de "IF: ¿Transcripción válida Deepgram?"
// - error de "Transcribir audio Deepgram"
// - error de descarga del audio fallback
//
// sin confundirlo con una entrada simplemente no soportada.
// ======================================================

const errorActual =
  texto(
    input.error_transcripcion ??
    input.detalle_error ??
    input.details?.message ??
    input.error?.message ??
    input.error
  );


const proveedorTranscripcion =
  texto(
    input.proveedor_transcripcion ??
    input.proveedor_fallback
  );


const pareceAudio =
  tipoEntrada === 'AUDIO' ||
  tipoEntrada === 'VOICE' ||
  input.audio_preparado === true ||
  input.fallback_audio === true ||
  input.media_id !== undefined ||
  mediaAudio.audio_preparado === true ||
  mediaAudio.media_id !== undefined;


const transcripcionMarcadaInvalida =
  input.transcripcion_valida === false;


const falloDeepgram =
  proveedorTranscripcion === 'DEEPGRAM' ||
  input.proveedor_fallback === 'DEEPGRAM';


const falloTranscripcionAudio =
  pareceAudio &&
  (
    transcripcionMarcadaInvalida ||
    falloDeepgram ||
    errorActual !== null
  );


// ======================================================
// 8. MOTIVO DE HANDOFF
// ======================================================

let motivo =
  'ENTRADA_NO_SOPORTADA';


let prioridad =
  'NORMAL';


let mensajeTransicion =
  'Permítame un momento por favor, ya revisamos lo que nos envió.';


// ------------------------------------------------------
// FALLO TOTAL DE TRANSCRIPCIÓN
// ------------------------------------------------------

if (falloTranscripcionAudio) {

  motivo =
    'AUDIO_REQUIERE_REVISION';

  prioridad =
    'MEDIA';

  mensajeTransicion =
    'Permítame un momento por favor, no pudimos interpretar correctamente el audio que nos envió y vamos a revisarlo manualmente.';

}


// ------------------------------------------------------
// ENTRADA NO SOPORTADA NORMAL
// ------------------------------------------------------

else {

  switch (tipoEntrada) {

    case 'AUDIO':
    case 'VOICE':

      motivo =
        'AUDIO_REQUIERE_REVISION';

      prioridad =
        'MEDIA';

      mensajeTransicion =
        'Permítame un momento por favor, ya revisamos el audio que nos envió.';

      break;


    case 'VIDEO':

      motivo =
        'VIDEO_REQUIERE_REVISION';

      mensajeTransicion =
        'Permítame un momento por favor, ya revisamos el video que nos envió.';

      break;


    case 'DOCUMENTO':
    case 'DOCUMENT':

      motivo =
        'DOCUMENTO_REQUIERE_REVISION';

      mensajeTransicion =
        'Permítame un momento por favor, ya revisamos el archivo que nos envió.';

      break;


    case 'STICKER':

      motivo =
        'STICKER_NO_PROCESABLE';

      mensajeTransicion =
        'Permítame un momento por favor, ya revisamos su mensaje.';

      break;


    case 'LOCATION':
    case 'UBICACION':

      motivo =
        'UBICACION_REQUIERE_REVISION';

      mensajeTransicion =
        'Permítame un momento por favor, ya revisamos la ubicación que nos envió.';

      break;


    case 'CONTACT':
    case 'CONTACTO':
    case 'CONTACTS':

      motivo =
        'CONTACTO_REQUIERE_REVISION';

      mensajeTransicion =
        'Permítame un momento por favor, ya revisamos la información que nos envió.';

      break;


    default:

      motivo =
        'ENTRADA_NO_SOPORTADA';

      mensajeTransicion =
        'Permítame un momento por favor, ya revisamos lo que nos envió.';
  }
}


// ======================================================
// 9. DATOS TÉCNICOS DE AUDIO
// ======================================================

const mediaId =
  texto(
    input.media_id ??
    mediaAudio.media_id ??
    entradaWhatsApp.meta_whatsapp?.media?.id
  );


const mimeType =
  texto(
    input.mime_type ??
    mediaAudio.mime_type ??
    entradaWhatsApp.meta_whatsapp?.media?.mime_type
  );


const indiceAudio =
  numeroONull(
    input.indice_audio ??
    mediaAudio.indice_audio
  );


// ======================================================
// 10. CLASIFICACIÓN DEL ORIGEN DEL HANDOFF
// ======================================================

let origenHandoff =
  'ENTRADA_NO_SOPORTADA';


if (falloTranscripcionAudio) {

  origenHandoff =
    'FALLO_TRANSCRIPCION_AUDIO';

}


// ======================================================
// 11. VALIDACIONES MÍNIMAS
// ======================================================
//
// No obligamos prospecto_id aquí porque existen rutas
// donde podría tratarse de un cliente registrado.
//
// La ruta estándar de derivación decidirá después qué
// identidad debe persistir.
//
// Sí necesitamos conversación para no crear un handoff
// huérfano.
// ======================================================

if (
  conversacionId === null ||
  conversacionId <= 0
) {

  throw new Error(
    'PREPARAR HANDOFF ENTRADA NO SOPORTADA: no se pudo resolver conversacion_id.'
  );

}


// ======================================================
// 12. SALIDA
// ======================================================

return [
  {
    json: {

      // ------------------------------------------------
      // CONSERVAR CONTRATO ORIGINAL
      // ------------------------------------------------

      ...input,


      // ------------------------------------------------
      // IDENTIDAD
      // ------------------------------------------------

      conversacion_id:
        conversacionId,

      prospecto_id:
        prospectoId,

      cliente_id:
        clienteId,

      contacto_id:
        contactoId,

      telefono,

      nombre_whatsapp:
        nombreWhatsApp,

      prospecto_nombre:
        nombreWhatsApp,


      // ------------------------------------------------
      // DECISIÓN
      // ------------------------------------------------

      intencion:
        'SOLICITAR_HUMANO',

      accion:
        'DERIVAR_HUMANO',

      requiere_humano:
        true,

      requiere_notificacion:
        true,

      handoff_requiere_notificacion:
        true,


      // ------------------------------------------------
      // HANDOFF
      // ------------------------------------------------

      handoff_motivo:
        motivo,

      motivo_derivacion:
        motivo,

      handoff_prioridad:
        prioridad,

      prioridad_derivacion:
        prioridad,

      origen_handoff:
        origenHandoff,

      clasificacion_handoff:
        falloTranscripcionAudio
          ? 'REVISION_AUDIO'
          : 'REVISION_ENTRADA',


      // ------------------------------------------------
      // MENSAJE DEL CLIENTE
      // ------------------------------------------------

      mensaje_actual:
        mensajeActual,

      mensaje_cliente_original:
        mensajeActual,

      handoff_mensaje_cliente:
        mensajeActual,


      // ------------------------------------------------
      // RESPUESTA DE TRANSICIÓN
      // ------------------------------------------------

      respuesta_sugerida:
        mensajeTransicion,

      mensaje_transicion:
        mensajeTransicion,


      // ------------------------------------------------
      // TIPO DE ENTRADA
      // ------------------------------------------------

      tipo_entrada_no_soportada:
        tipoEntrada,


      // ------------------------------------------------
      // AUDIO / TRANSCRIPCIÓN
      // ------------------------------------------------

      fallo_transcripcion_audio:
        falloTranscripcionAudio,

      proveedor_transcripcion:
        proveedorTranscripcion,

      media_id:
        mediaId,

      mime_type:
        mimeType,

      indice_audio:
        indiceAudio,

      error_transcripcion_handoff:
        errorActual,


      // ------------------------------------------------
      // CONTROL
      // ------------------------------------------------

      derivacion_directa_entrada:
        true,

      derivacion_directa:
        true,

      derivacion_directa_motivo:
        falloTranscripcionAudio
          ? 'FALLO_TOTAL_TRANSCRIPCION_AUDIO'
          : 'ENTRADA_NO_SOPORTADA',

      handoff_at:
        new Date().toISOString()
    }
  }
];
