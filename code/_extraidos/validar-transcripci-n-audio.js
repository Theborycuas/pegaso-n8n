// ======================================================
// N8N NODE - PEGASO
// ======================================================
// Nombre: Validar transcripci├│n audio
// Node ID: 57653d69-a094-474e-9506-fb4ed1811c62
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
// NODO N8N: Validar transcripci├│n audio
// ARCHIVO: code/03-conversacion/validar-transcripcion-audio.js
// VERSION: 2.0
// ======================================================
//
// RESPONSABILIDAD:
//
// - Validar transcripciones provenientes de:
//
//   1. Groq Whisper
//   2. Deepgram Nova
//
// - Detectar autom├íticamente qu├® proveedor respondi├│.
// - Recuperar identidad del audio desde
//   "Preparar audio del turno".
// - Emparejar por posici├│n:
//      indice_audio
//      mensaje_id
//      media_id
//      conversacion_id
// - Entregar un contrato uniforme para:
//
//      IF: ┬┐Transcripci├│n v├ílida?
//      Aplicar transcripciones al turno
//
// - NO interpretar comercialmente.
// - NO llamar al cerebro comercial.
// - NO escribir PostgreSQL.
// - NO lanzar error por fallo de STT.
//
// ======================================================


const LARGO_MAXIMO_TRANSCRIPCION = 12000;


// ======================================================
// 1. HELPERS
// ======================================================

function textoONull(valor, limite = null) {

  if (
    valor === undefined ||
    valor === null
  ) {
    return null;
  }

  let limpio = String(valor)
    .replace(/\u0000/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\s*\n\s*/g, ' ')
    .trim();

  if (!limpio) {
    return null;
  }

  if (
    limite !== null &&
    Number.isFinite(limite) &&
    limite > 0
  ) {
    limpio = limpio.slice(0, limite);
  }

  return limpio;
}


function numeroONull(valor) {

  if (
    valor === undefined ||
    valor === null ||
    valor === ''
  ) {
    return null;
  }

  const numero = Number(valor);

  return Number.isFinite(numero)
    ? numero
    : null;
}


function normalizarError(valor) {

  if (!valor) {
    return null;
  }

  if (typeof valor === 'string') {
    return textoONull(valor, 1500);
  }

  if (typeof valor === 'object') {

    try {
      return textoONull(
        JSON.stringify(valor),
        1500
      );
    } catch (_) {
      return 'ERROR_NO_SERIALIZABLE';
    }

  }

  return textoONull(
    valor,
    1500
  );
}


// ======================================================
// 2. DETECTAR ERROR HTTP / N8N
// ======================================================

function detectarErrorRespuesta(json) {

  if (
    !json ||
    typeof json !== 'object'
  ) {
    return {
      existe: true,
      motivo: 'RESPUESTA_VACIA',
      error: 'La respuesta del proveedor STT est├í vac├¡a.'
    };
  }


  // --------------------------------------------------
// Errores n8n HTTP Request
// --------------------------------------------------

  if (json.error) {

    return {
      existe: true,
      motivo: 'ERROR_TRANSCRIPCION',
      error:
        normalizarError(
          json.error
        ) ??
        'El proveedor de transcripci├│n devolvi├│ un error.'
    };

  }


  if (
    numeroONull(
      json.statusCode
    ) !== null &&
    Number(
      json.statusCode
    ) >= 400
  ) {

    return {
      existe: true,
      motivo: 'ERROR_HTTP_TRANSCRIPCION',
      error:
        normalizarError(
          json.message ??
          json.body ??
          json
        )
    };

  }


  if (
    numeroONull(
      json.details?.httpCode
    ) !== null &&
    Number(
      json.details.httpCode
    ) >= 400
  ) {

    return {
      existe: true,
      motivo: 'ERROR_HTTP_TRANSCRIPCION',
      error:
        normalizarError(
          json.details
        )
    };

  }


  return {
    existe: false,
    motivo: null,
    error: null
  };
}


// ======================================================
// 3. LEER RESPUESTA GROQ
// ======================================================
//
// Groq:
//
// {
//   "text": "..."
// }
//
// ======================================================

function leerGroq(json) {

  const texto =
    textoONull(
      json.text ??
      json.body?.text ??
      json.data?.text ??
      json.response?.text,
      LARGO_MAXIMO_TRANSCRIPCION
    );


  if (!texto) {

    return {
      reconocido: false,
      valido: false,
      proveedor: null,
      modelo: null,
      texto: null,
      confianza: null,
      motivo: null,
      error: null
    };

  }


  return {
    reconocido: true,
    valido: true,

    proveedor:
      'GROQ',

    modelo:
      'whisper-large-v3-turbo',

    texto,

    confianza:
      null,

    motivo:
      null,

    error:
      null
  };
}


// ======================================================
// 4. LEER RESPUESTA DEEPGRAM
// ======================================================
//
// Deepgram:
//
// {
//   results: {
//     channels: [
//       {
//         alternatives: [
//           {
//             transcript: "...",
//             confidence: 0.99
//           }
//         ]
//       }
//     ]
//   }
// }
//
// ======================================================

function leerDeepgram(json) {

  const alternativa =
    json.results
      ?.channels
      ?.[0]
      ?.alternatives
      ?.[0] ??
    null;


  const texto =
    textoONull(
      alternativa?.transcript ??
      json.results
        ?.utterances
        ?.[0]
        ?.transcript ??
      json.results
        ?.channels
        ?.[0]
        ?.alternatives
        ?.[0]
        ?.paragraphs
        ?.transcript,
      LARGO_MAXIMO_TRANSCRIPCION
    );


  const confianza =
    numeroONull(
      alternativa?.confidence
    );


  const pareceDeepgram =
    !!json.metadata ||
    !!json.results?.channels ||
    !!json.results?.utterances;


  if (!pareceDeepgram) {

    return {
      reconocido: false,
      valido: false,
      proveedor: null,
      modelo: null,
      texto: null,
      confianza: null,
      motivo: null,
      error: null
    };

  }


  if (!texto) {

    return {
      reconocido: true,
      valido: false,

      proveedor:
        'DEEPGRAM',

      modelo:
        json.metadata?.model_info
          ? Object.values(
              json.metadata.model_info
            )[0]?.name ?? 'nova-3'
          : 'nova-3',

      texto:
        null,

      confianza,

      motivo:
        'TRANSCRIPCION_VACIA',

      error:
        'Deepgram respondi├│ correctamente pero no devolvi├│ texto utilizable.'
    };

  }


  return {
    reconocido: true,
    valido: true,

    proveedor:
      'DEEPGRAM',

    modelo:
      json.metadata?.model_info
        ? Object.values(
            json.metadata.model_info
          )[0]?.name ?? 'nova-3'
        : 'nova-3',

    texto,

    confianza,

    motivo:
      null,

    error:
      null
  };
}


// ======================================================
// 5. LEER RESPUESTA STT
// ======================================================

function leerRespuestaSTT(json) {

  const error =
    detectarErrorRespuesta(
      json
    );


  if (
    error.existe
  ) {

    return {
      valido:
        false,

      proveedor:
        null,

      modelo:
        null,

      texto:
        null,

      confianza:
        null,

      motivo:
        error.motivo,

      error:
        error.error
    };

  }


  // --------------------------------------------------
// 5.1 DEEPGRAM
// --------------------------------------------------

  const deepgram =
    leerDeepgram(
      json
    );


  if (
    deepgram.reconocido
  ) {
    return deepgram;
  }


  // --------------------------------------------------
// 5.2 GROQ
// --------------------------------------------------

  const groq =
    leerGroq(
      json
    );


  if (
    groq.reconocido
  ) {
    return groq;
  }


  // --------------------------------------------------
// 5.3 DESCONOCIDO
// --------------------------------------------------

  return {
    valido:
      false,

    proveedor:
      null,

    modelo:
      null,

    texto:
      null,

    confianza:
      null,

    motivo:
      'FORMATO_RESPUESTA_DESCONOCIDO',

    error:
      'El proveedor STT respondi├│, pero el formato de respuesta no coincide con Groq ni Deepgram.'
  };
}


// ======================================================
// 6. RECUPERAR AUDIOS ORIGINALES
// ======================================================
//
// "Preparar audio del turno" sigue siendo la fuente
// principal de identidad.
//
// ======================================================

let origenes = [];

try {

  origenes =
    $('Preparar audio del turno')
      .all()
      .map(
        item =>
          item.json ?? {}
      )
      .filter(
        item =>
          item.transcribir_audio === true
      );

} catch (_) {

  origenes = [];

}


const entradas =
  $input.all();


// ======================================================
// 7. CONSISTENCIA DEL LOTE
// ======================================================

const loteConsistente =
  origenes.length ===
  entradas.length;


// ======================================================
// 8. PROCESAR RESPUESTAS
// ======================================================

const resultados =
  entradas.map(
    (item, indice) => {

      const respuesta =
        item.json ?? {};


      const origen =
        origenes[indice] ?? {};


      const lectura =
        leerRespuestaSTT(
          respuesta
        );


      const mensajeId =
        numeroONull(
          origen.mensaje_id
        );


      const indiceAudio =
        numeroONull(
          origen.indice_audio
        ) ??
        indice;


      const mediaId =
        textoONull(
          origen.media_id
        );


      const conversacionId =
        numeroONull(
          origen.conversacion_id
        );


      const contenidoBase =
        textoONull(
          origen.contenido_base,
          1500
        ) ??
        '[AUDIO]';


      const prospectoId =
        numeroONull(
          origen.prospecto_id
        );


      const clienteId =
        numeroONull(
          origen.cliente_id
        );


      const contactoId =
        numeroONull(
          origen.contacto_id
        );


      const telefono =
        textoONull(
          origen.telefono
        );


      const nombreWhatsApp =
        textoONull(
          origen.nombre_whatsapp
        );


      const mimeType =
        textoONull(
          origen.mime_type
        );


      const textoAsociado =
        textoONull(
          origen.texto_asociado
        );


      // ==================================================
      // 8.1 ERROR DE CORRELACI├ôN
      // ==================================================

      if (
        !loteConsistente
      ) {

        return {
          json: {

            mensaje_id:
              mensajeId,

            indice_audio:
              indiceAudio,

            media_id:
              mediaId,

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

            proveedor_transcripcion:
              lectura.proveedor,

            modelo_transcripcion:
              lectura.modelo,

            transcripcion_valida:
              false,

            requiere_revision:
              true,

            motivo_revision:
              'LOTE_AUDIO_INCONSISTENTE',

            texto_transcrito:
              null,

            confianza_transcripcion:
              lectura.confianza,

            error_transcripcion:
              'La cantidad de respuestas STT no coincide con la cantidad de audios preparados.',

            mime_type:
              mimeType,

            texto_asociado:
              textoAsociado,

            contenido_base:
              contenidoBase,

            contenido_actualizado:
              `${contenidoBase}\n` +
              '[TRANSCRIPCION DE AUDIO ┬À revision=SI ┬À motivo=LOTE_AUDIO_INCONSISTENTE] ' +
              'No fue posible asociar de forma segura la transcripci├│n con el audio original.',

            transcripcion_validada_at:
              new Date().toISOString()

          }
        };

      }


      // ==================================================
      // 8.2 IDENTIDAD INSUFICIENTE
      // ==================================================

      if (
        mensajeId === null ||
        conversacionId === null
      ) {

        return {
          json: {

            mensaje_id:
              mensajeId,

            indice_audio:
              indiceAudio,

            media_id:
              mediaId,

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

            proveedor_transcripcion:
              lectura.proveedor,

            modelo_transcripcion:
              lectura.modelo,

            transcripcion_valida:
              false,

            requiere_revision:
              true,

            motivo_revision:
              'IDENTIDAD_AUDIO_INCOMPLETA',

            texto_transcrito:
              null,

            confianza_transcripcion:
              lectura.confianza,

            error_transcripcion:
              'No se pudo recuperar mensaje_id o conversacion_id del audio.',

            mime_type:
              mimeType,

            texto_asociado:
              textoAsociado,

            contenido_base:
              contenidoBase,

            contenido_actualizado:
              `${contenidoBase}\n` +
              '[TRANSCRIPCION DE AUDIO ┬À revision=SI ┬À motivo=IDENTIDAD_AUDIO_INCOMPLETA] ' +
              'No fue posible asociar el audio con el turno conversacional.',

            transcripcion_validada_at:
              new Date().toISOString()

          }
        };

      }


      // ==================================================
      // 8.3 TRANSCRIPCI├ôN INV├üLIDA
      // ==================================================

      if (
        !lectura.valido
      ) {

        const proveedor =
          lectura.proveedor ??
          'DESCONOCIDO';


        const motivo =
          lectura.motivo ??
          'TRANSCRIPCION_NO_DISPONIBLE';


        return {
          json: {

            mensaje_id:
              mensajeId,

            indice_audio:
              indiceAudio,

            media_id:
              mediaId,

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

            proveedor_transcripcion:
              lectura.proveedor,

            modelo_transcripcion:
              lectura.modelo,

            transcripcion_valida:
              false,

            requiere_revision:
              true,

            motivo_revision:
              motivo,

            texto_transcrito:
              null,

            confianza_transcripcion:
              lectura.confianza,

            error_transcripcion:
              lectura.error,

            mime_type:
              mimeType,

            texto_asociado:
              textoAsociado,

            contenido_base:
              contenidoBase,

            contenido_actualizado:
              `${contenidoBase}\n` +
              `[TRANSCRIPCION DE AUDIO ┬À proveedor=${proveedor} ┬À revision=SI ┬À motivo=${motivo}] ` +
              'No fue posible transcribir autom├íticamente este audio.',

            transcripcion_validada_at:
              new Date().toISOString()

          }
        };

      }


      // ==================================================
      // 8.4 TRANSCRIPCI├ôN V├üLIDA
      // ==================================================

      const textoTranscrito =
        lectura.texto;


      return {
        json: {

          // ----------------------------------------------
          // IDENTIDAD
          // ----------------------------------------------

          mensaje_id:
            mensajeId,

          indice_audio:
            indiceAudio,

          media_id:
            mediaId,

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


          // ----------------------------------------------
          // TRANSCRIPCI├ôN
          // ----------------------------------------------

          proveedor_transcripcion:
            lectura.proveedor,

          modelo_transcripcion:
            lectura.modelo,

          transcripcion_valida:
            true,

          requiere_revision:
            false,

          motivo_revision:
            null,

          texto_transcrito:
            textoTranscrito,

          confianza_transcripcion:
            lectura.confianza,

          error_transcripcion:
            null,


          // ----------------------------------------------
          // CONTEXTO ORIGINAL
          // ----------------------------------------------

          mime_type:
            mimeType,

          texto_asociado:
            textoAsociado,

          contenido_base:
            contenidoBase,


          // ----------------------------------------------
          // CONTENIDO SEGURO PARA IA
          // ----------------------------------------------

          contenido_actualizado:
            `${contenidoBase}\n` +
            `[TRANSCRIPCION DE AUDIO ┬À proveedor=${lectura.proveedor}] ${textoTranscrito}`,


          // ----------------------------------------------
          // CONTROL
          // ----------------------------------------------

          transcripcion_validada_at:
            new Date().toISOString()

        }
      };

    }
  );


// ======================================================
// 9. SALIDA
// ======================================================

return resultados;
