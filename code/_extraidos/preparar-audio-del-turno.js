// ======================================================
// N8N NODE - PEGASO
// ======================================================
// Nombre: Preparar audio del turno
// Node ID: 104f0e23-49ef-4273-927d-4d9b5e3b88a0
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
// NODO N8N: Preparar audio del turno
// ARCHIVO: code/03-conversacion/preparar-audio-turno.js
// VERSION: 1.0
// RESPONSABILIDAD:
// - Tras resolver el turno conversacional, buscar audios
//   pendientes de transcripci├│n.
// - Leer el descriptor [MEDIA_PENDIENTE] persistido en
//   mensajes.contenido.
// - Revalidar MIME y enlace YCloud.
// - Emitir un item por audio v├ílido.
// - Limitar la cantidad de audios procesados por turno.
// - Conservar identidad y contexto del turno.
// - NO descargar audio.
// - NO transcribir.
// - NO llamar al cerebro comercial.
// - NO escribir PostgreSQL.
// ======================================================


// ======================================================
// 0. CONFIGURACI├ôN
// ======================================================

const MAX_AUDIOS_POR_TURNO = 3;

const MAX_LINK_LENGTH = 2048;

const PREFIJO_PENDIENTE =
  '[MEDIA_PENDIENTE] ';


// MIME admitidos para STT.
//
// WhatsApp/YCloud normalmente entrega notas de voz como:
// audio/ogg; codecs=opus
//
// En Preparar entrada WhatsApp el MIME deber├¡a llegar
// normalizado sin par├ímetros:
// audio/ogg
// ======================================================

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


// ======================================================
// ANTI-SSRF
// ======================================================

const LINK_YCLOUD_PERMITIDO =
  /^https:\/\/api\.ycloud\.com\/v2\/whatsapp\/media\/download\/[A-Za-z0-9_-]+(\?[A-Za-z0-9%._~&=+-]*)?$/;


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


function numeroONull(valor) {

  if (
    valor === undefined ||
    valor === null ||
    valor === ''
  ) {
    return null;
  }

  const numero =
    Number(valor);

  return Number.isFinite(numero)
    ? numero
    : null;
}


function normalizarMime(valor) {

  const mime =
    textoONull(valor);

  if (!mime) {
    return null;
  }

  return mime
    .toLowerCase()
    .split(';')[0]
    .trim();
}


function lineas(contenido) {

  return String(
    contenido ?? ''
  ).split('\n');
}


// ======================================================
// 2. LEER [MEDIA_PENDIENTE]
// ======================================================

function leerPendiente(contenido) {

  const linea =
    lineas(contenido)
      .map(
        valor =>
          valor.trim()
      )
      .find(
        valor =>
          valor.startsWith(
            PREFIJO_PENDIENTE
          )
      );

  if (!linea) {
    return null;
  }

  const jsonTexto =
    linea.slice(
      PREFIJO_PENDIENTE.length
    );

  try {

    const datos =
      JSON.parse(
        jsonTexto
      );

    if (
      !datos ||
      typeof datos !== 'object' ||
      Array.isArray(datos)
    ) {
      return null;
    }

    return datos;

  } catch (error) {

    return null;
  }
}


// ======================================================
// 3. TEXTO/CAPTION DEL AUDIO
// ======================================================

function textoAudioDe(contenido) {

  const primeraLinea =
    lineas(contenido)[0] ?? '';

  return String(
    primeraLinea
  )
    .replace(
      /^\[AUDIO\]\s*/i,
      ''
    )
    .trim();
}


// ======================================================
// 4. RECUPERAR TURNO GANADOR
// ======================================================
//
// IMPORTANTE:
//
// No dependemos del item que llega inmediatamente
// desde la rama de im├ígenes.
//
// Leemos directamente el contrato original de:
//
// Resolver turno conversacional
//
// De esta forma audio funciona:
// - haya im├ígenes o no
// - haya pasado por Groq visual
// - haya pasado por DeepSeek visual
// - haya pasado por OpenAI visual
//
// ======================================================

let turno = {};

try {

  turno =
    $('Resolver turno conversacional')
      .first()
      .json ?? {};

} catch (error) {

  turno =
    $input.first().json ?? {};
}


const turnoMensajes =
  Array.isArray(
    turno.turno_mensajes
  )
    ? turno.turno_mensajes
    : [];


// ======================================================
// 5. IDENTIDAD
// ======================================================

const conversacionId =
  numeroONull(
    turno.conversacion_id
  );


const prospectoId =
  numeroONull(
    turno.prospecto_id
  );


const clienteId =
  numeroONull(
    turno.cliente_id
  );


const contactoId =
  numeroONull(
    turno.contacto_id
  );


const telefono =
  textoONull(
    turno.telefono
  );


const nombreWhatsapp =
  textoONull(
    turno.nombre_whatsapp
  );


// ======================================================
// 6. BUSCAR AUDIOS PENDIENTES
// ======================================================

const candidatos = [];

let descartados = 0;


for (
  const mensaje of turnoMensajes
) {

  const tipo =
    String(
      mensaje.tipo ?? ''
    )
      .trim()
      .toUpperCase();


  // --------------------------------------------------
  // Solo AUDIO
  // --------------------------------------------------

  if (
    tipo !== 'AUDIO'
  ) {
    continue;
  }


  // --------------------------------------------------
  // Descriptor multimedia
  // --------------------------------------------------

  const pendiente =
    leerPendiente(
      mensaje.contenido
    );


  if (!pendiente) {

    descartados++;

    continue;
  }


  const mime =
    normalizarMime(
      pendiente.mime_type
    );


  const link =
    textoONull(
      pendiente.link
    );


  const mediaId =
    textoONull(
      pendiente.media_id
    );


  // --------------------------------------------------
  // Validar formato
  // --------------------------------------------------

  const mimeValido =
    mime !== null &&
    MIME_AUDIO_SOPORTADOS.includes(
      mime
    );


  const linkValido =
    link !== null &&
    link.length <=
      MAX_LINK_LENGTH &&
    LINK_YCLOUD_PERMITIDO.test(
      link
    );


  if (
    !mimeValido ||
    !linkValido
  ) {

    descartados++;

    continue;
  }


  // --------------------------------------------------
  // L├¡mite por turno
  // --------------------------------------------------

  if (
    candidatos.length >=
    MAX_AUDIOS_POR_TURNO
  ) {

    descartados++;

    continue;
  }


  const mensajeId =
    numeroONull(
      mensaje.id
    );


  candidatos.push({

    mensaje_id:
      mensajeId,

    media_id:
      mediaId,

    mime_type:
      mime,

    media_link:
      link,

    texto_asociado:
      textoAudioDe(
        mensaje.contenido
      ),

    contenido_base:
      lineas(
        mensaje.contenido
      )[0]?.trim() ??
      '[AUDIO]',

    enviado_at:
      mensaje.enviado_at ??
      null
  });
}


// ======================================================
// 7. NO HAY AUDIOS
// ======================================================
//
// Emitimos SIEMPRE un item.
//
// As├¡ el IF:
//
// ┬┐Hay audios por transcribir?
//
// puede evaluar:
//
// {{$json.transcribir_audio}}
//
// ======================================================

if (
  candidatos.length === 0
) {

  return [
    {
      json: {

        transcribir_audio:
          false,

        audios_por_transcribir:
          0,

        audios_descartados:
          descartados,


        // ----------------------------------------------
        // IDENTIDAD
        // ----------------------------------------------

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
          nombreWhatsapp,


        // ----------------------------------------------
        // TURNO
        // ----------------------------------------------

        turno_mensaje_ids:
          Array.isArray(
            turno.turno_mensaje_ids
          )
            ? turno.turno_mensaje_ids
            : [],

        turno_desde_id:
          numeroONull(
            turno.turno_desde_id
          ),

        turno_hasta_id:
          numeroONull(
            turno.turno_hasta_id
          ),

        turno_texto:
          textoONull(
            turno.turno_texto
          ),


        // ----------------------------------------------
        // CONTROL
        // ----------------------------------------------

        audio_preparado:
          true
      }
    }
  ];
}


// ======================================================
// 8. HAY AUDIOS
// ======================================================
//
// Un item por audio.
//
// Eso permite que:
//
// Descargar audio YCloud
//
// procese cada archivo individualmente.
//
// ======================================================

return candidatos.map(
  (audio, indice) => ({
    json: {

      // ----------------------------------------------
      // CONTROL AUDIO
      // ----------------------------------------------

      transcribir_audio:
        true,

      audios_por_transcribir:
        candidatos.length,

      audios_descartados:
        descartados,

      indice_audio:
        indice,


      // ----------------------------------------------
      // IDENTIDAD
      // ----------------------------------------------

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
        nombreWhatsapp,


      // ----------------------------------------------
      // AUDIO
      // ----------------------------------------------

      ...audio,


      // ----------------------------------------------
      // TURNO
      // ----------------------------------------------

      turno_mensaje_ids:
        Array.isArray(
          turno.turno_mensaje_ids
        )
          ? turno.turno_mensaje_ids
          : [],

      turno_desde_id:
        numeroONull(
          turno.turno_desde_id
        ),

      turno_hasta_id:
        numeroONull(
          turno.turno_hasta_id
        ),

      turno_texto:
        textoONull(
          turno.turno_texto
        ),


      // ----------------------------------------------
      // CONTROL
      // ----------------------------------------------

      audio_preparado:
        true
    }
  })
);
