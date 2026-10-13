// ======================================================
// N8N NODE - PEGASO
// ======================================================
// Nombre: Aplicar transcripciones al turno
// Node ID: c000b9bb-0e60-4658-8a26-02ad12460aaa
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
// NODO N8N: Aplicar transcripciones al turno
// ARCHIVO: code/03-conversacion/aplicar-transcripciones-turno.js
// VERSION: 1.0
// ======================================================
//
// RESPONSABILIDAD:
//
// - Recibir todas las transcripciones validadas del turno.
// - Recuperar el turno original desde
//   "Resolver turno conversacional".
// - Asociar cada transcripci├│n por mensaje_id.
// - Sustituir el marcador [MEDIA_PENDIENTE] del AUDIO
//   por su transcripci├│n.
// - Eliminar URLs / metadatos t├®cnicos antes de enviar
//   contenido al cerebro comercial.
// - Mantener el orden cronol├│gico de los mensajes.
// - Generar UN SOLO ITEM para "Preparar contexto IA".
// - Informar si alg├║n audio fall├│.
//
// IMPORTANTE:
//
// Este nodo NO:
// - interpreta comercialmente los audios
// - llama IA
// - responde al cliente
// - escribe PostgreSQL
//
// ======================================================


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

  let limpio =
    String(valor).trim();

  if (!limpio) {
    return null;
  }

  if (
    limite !== null &&
    Number.isFinite(limite) &&
    limite > 0
  ) {
    limpio =
      limpio.slice(0, limite);
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

  const numero =
    Number(valor);

  return Number.isFinite(numero)
    ? numero
    : null;
}


function normalizarTipo(valor) {
  return String(
    valor ?? ''
  )
    .trim()
    .toUpperCase();
}


function primeraLinea(contenido) {
  const linea =
    String(contenido ?? '')
      .split('\n')[0]
      ?.trim();

  return linea || null;
}


function contenidoBaseAudio(contenido) {
  const primera =
    primeraLinea(contenido);

  if (
    primera &&
    primera.startsWith('[AUDIO]')
  ) {
    return primera;
  }

  return '[AUDIO]';
}


// ======================================================
// 2. RECUPERAR TURNO ORIGINAL
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


const conversacionId =
  numeroONull(
    turno.conversacion_id
  );


if (!conversacionId) {
  throw new Error(
    'APLICAR TRANSCRIPCIONES: no existe conversacion_id en "Resolver turno conversacional".'
  );
}


const turnoMensajes =
  Array.isArray(turno.turno_mensajes)
    ? turno.turno_mensajes
    : [];


if (turnoMensajes.length === 0) {
  throw new Error(
    'APLICAR TRANSCRIPCIONES: el turno no contiene mensajes.'
  );
}


// ======================================================
// 3. RECIBIR TRANSCRIPCIONES
// ======================================================

const entradas =
  $input.all()
    .map(item => item.json ?? {});


// ======================================================
// 4. INDEXAR POR mensaje_id
// ======================================================

const porMensajeId =
  new Map();

const mensajesDuplicados =
  new Set();


for (const item of entradas) {

  const mensajeId =
    numeroONull(
      item.mensaje_id
    );

  if (mensajeId === null) {
    continue;
  }

  if (porMensajeId.has(mensajeId)) {
    mensajesDuplicados.add(
      mensajeId
    );

    continue;
  }

  porMensajeId.set(
    mensajeId,
    item
  );
}


// ======================================================
// 5. APLICAR TRANSCRIPCIONES
// ======================================================

let audiosEnTurno = 0;
let transcripcionesValidas = 0;
let transcripcionesFallidas = 0;
let audiosSinResultado = 0;

const motivosRevision =
  new Set();

const transcripciones =
  [];


const mensajesActualizados =
  turnoMensajes.map(mensaje => {

    const mensajeId =
      numeroONull(
        mensaje.id
      );

    const tipo =
      normalizarTipo(
        mensaje.tipo
      );


    // ==================================================
    // MENSAJE NO AUDIO
    // ==================================================

    if (tipo !== 'AUDIO') {
      return {
        ...mensaje
      };
    }


    audiosEnTurno++;


    // ==================================================
    // AUDIO
    // ==================================================

    const base =
      contenidoBaseAudio(
        mensaje.contenido
      );

    const resultado =
      mensajeId !== null
        ? porMensajeId.get(mensajeId)
        : null;


    // ==================================================
    // 5.1 NO EXISTE RESULTADO PARA ESTE AUDIO
    // ==================================================

    if (!resultado) {

      audiosSinResultado++;

      motivosRevision.add(
        'AUDIO_SIN_RESULTADO'
      );

      return {
        ...mensaje,

        contenido:
          `${base}\n` +
          '[TRANSCRIPCION DE AUDIO ┬À revision=SI ┬À motivo=AUDIO_SIN_RESULTADO] ' +
          'Este audio no pudo procesarse autom├íticamente.',

        audio_transcrito:
          false,

        audio_requiere_revision:
          true,

        transcripcion:
          null
      };
    }


    // ==================================================
    // 5.2 RESULTADO DUPLICADO
    // ==================================================

    if (
      mensajeId !== null &&
      mensajesDuplicados.has(mensajeId)
    ) {

      transcripcionesFallidas++;

      motivosRevision.add(
        'TRANSCRIPCION_DUPLICADA'
      );

      return {
        ...mensaje,

        contenido:
          `${base}\n` +
          '[TRANSCRIPCION DE AUDIO ┬À revision=SI ┬À motivo=TRANSCRIPCION_DUPLICADA] ' +
          'Se recibieron varias transcripciones para el mismo audio.',

        audio_transcrito:
          false,

        audio_requiere_revision:
          true,

        transcripcion:
          null
      };
    }


    const transcripcionValida =
      resultado.transcripcion_valida === true;

    const textoTranscrito =
      textoONull(
        resultado.texto_transcrito,
        12000
      );


    // ==================================================
    // 5.3 TRANSCRIPCI├ôN FALLIDA
    // ==================================================

    if (
      !transcripcionValida ||
      !textoTranscrito
    ) {

      transcripcionesFallidas++;

      const motivo =
        textoONull(
          resultado.motivo_revision
        ) ??
        'TRANSCRIPCION_NO_DISPONIBLE';

      motivosRevision.add(
        motivo
      );

      transcripciones.push({
        mensaje_id:
          mensajeId,

        indice_audio:
          numeroONull(
            resultado.indice_audio
          ),

        media_id:
          textoONull(
            resultado.media_id
          ),

        valida:
          false,

        texto:
          null,

        motivo_revision:
          motivo,

        proveedor:
          textoONull(
            resultado.proveedor_transcripcion
          ),

        modelo:
          textoONull(
            resultado.modelo_transcripcion
          )
      });


      return {
        ...mensaje,

        contenido:
          `${base}\n` +
          `[TRANSCRIPCION DE AUDIO ┬À revision=SI ┬À motivo=${motivo}] ` +
          'No fue posible transcribir autom├íticamente este audio.',

        audio_transcrito:
          false,

        audio_requiere_revision:
          true,

        transcripcion:
          null,

        motivo_revision_audio:
          motivo
      };
    }


    // ==================================================
    // 5.4 TRANSCRIPCI├ôN CORRECTA
    // ==================================================

    transcripcionesValidas++;


    transcripciones.push({
      mensaje_id:
        mensajeId,

      indice_audio:
        numeroONull(
          resultado.indice_audio
        ),

      media_id:
        textoONull(
          resultado.media_id
        ),

      valida:
        true,

      texto:
        textoTranscrito,

      motivo_revision:
        null,

      proveedor:
        textoONull(
          resultado.proveedor_transcripcion
        ) ??
        'GROQ',

      modelo:
        textoONull(
          resultado.modelo_transcripcion
        ) ??
        'whisper-large-v3-turbo'
    });


    return {
      ...mensaje,

      contenido:
        `${base}\n` +
        `[TRANSCRIPCION DE AUDIO ┬À proveedor=${textoONull(resultado.proveedor_transcripcion) ?? 'GROQ'}] ` +
        textoTranscrito,

      audio_transcrito:
        true,

      audio_requiere_revision:
        false,

      transcripcion:
        textoTranscrito,

      proveedor_transcripcion:
        textoONull(
          resultado.proveedor_transcripcion
        ) ??
        'GROQ'
    };
  });


// ======================================================
// 6. RECONSTRUIR TURNO TEXTO
// ======================================================
//
// Este es el contenido que posteriormente debe poder
// consumir "Preparar contexto IA".
//
// Ejemplo:
//
// [AUDIO]
// [TRANSCRIPCION DE AUDIO ┬À proveedor=GROQ] Hola...
//
// quiero 1000 etiquetas
//
// [AUDIO]
// [TRANSCRIPCION DE AUDIO ┬À proveedor=GROQ] de 10x5...
//
// ======================================================

const turnoTextoActualizado =
  mensajesActualizados
    .map(mensaje =>
      textoONull(
        mensaje.contenido,
        15000
      )
    )
    .filter(Boolean)
    .join('\n');


// ======================================================
// 7. ESTADO GLOBAL DEL AUDIO
// ======================================================

const totalFallos =
  transcripcionesFallidas +
  audiosSinResultado;


const requiereRevisionAudio =
  totalFallos > 0;


const audioListoParaCerebro =
  !requiereRevisionAudio;


// ======================================================
// 8. IDENTIDAD ADICIONAL
// ======================================================

let audioOrigen = {};

try {
  audioOrigen =
    $('Preparar audio del turno')
      .first()
      .json ?? {};
} catch (_) {
  audioOrigen = {};
}


// ======================================================
// 9. SALIDA ├ÜNICA
// ======================================================
//
// SIEMPRE devolvemos UN SOLO ITEM.
//
// Esto es deliberado.
//
// Tres audios:
//   Ôåô
// tres transcripciones
//   Ôåô
// UN turno enriquecido
//   Ôåô
// UNA decisi├│n comercial
//
// ======================================================

return [
  {
    json: {

      // ==================================================
      // CONTRATO ORIGINAL DEL TURNO
      // ==================================================

      ...turno,


      // ==================================================
      // IDENTIDAD
      // ==================================================

      conversacion_id:
        conversacionId,

      prospecto_id:
        numeroONull(
          audioOrigen.prospecto_id ??
          turno.prospecto_id
        ),

      cliente_id:
        numeroONull(
          audioOrigen.cliente_id ??
          turno.cliente_id
        ),

      contacto_id:
        numeroONull(
          audioOrigen.contacto_id ??
          turno.contacto_id
        ),

      telefono:
        textoONull(
          audioOrigen.telefono ??
          turno.telefono
        ),

      nombre_whatsapp:
        textoONull(
          audioOrigen.nombre_whatsapp ??
          turno.nombre_whatsapp
        ),


      // ==================================================
      // TURNO ENRIQUECIDO
      // ==================================================

      turno_mensajes:
        mensajesActualizados,

      turno_texto:
        turnoTextoActualizado,

      turno_mensaje_ids:
        mensajesActualizados
          .map(m => numeroONull(m.id))
          .filter(id => id !== null),

      cantidad_mensajes_turno:
        mensajesActualizados.length,


      // ==================================================
      // TRANSCRIPCIONES
      // ==================================================

      transcripciones_audio:
        transcripciones,

      audios_en_turno:
        audiosEnTurno,

      transcripciones_validas:
        transcripcionesValidas,

      transcripciones_fallidas:
        transcripcionesFallidas,

      audios_sin_resultado:
        audiosSinResultado,


      // ==================================================
      // CONTROL GLOBAL
      // ==================================================

      audio_procesado:
        true,

      audio_listo_para_cerebro:
        audioListoParaCerebro,

      requiere_revision_audio:
        requiereRevisionAudio,

      motivos_revision_audio:
        Array.from(
          motivosRevision
        ),

      transcripciones_aplicadas:
        transcripcionesValidas > 0,

      procesado_audio_at:
        new Date().toISOString()
    }
  }
];
