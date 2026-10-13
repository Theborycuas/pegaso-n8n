// ======================================================
// N8N NODE - PEGASO
// ======================================================
// Nombre: Preparar fallback Deepgram
// Node ID: 9e363e80-b236-4e0c-b00b-ef83537ef152
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
// NODO N8N: Preparar fallback Deepgram
// PEGASO ADHESIVOS
// VERSION: 1.0
// ======================================================
//
// Se ejecuta cuando la transcripci├│n primaria con Groq
// no fue v├ílida.
//
// RESPONSABILIDAD:
//
// - Recibir uno o varios audios fallidos.
// - Recuperar su metadata original desde
//   "Preparar audio del turno".
// - Emparejar por mensaje_id / media_id.
// - Preparar nuevamente media_link para volver a
//   descargar el archivo desde YCloud.
// - NO transcribir.
// - NO decidir handoff.
// ======================================================

const fallidos = $input.all();


// ======================================================
// 1. HELPERS
// ======================================================

function numeroONull(valor) {
  if (
    valor === undefined ||
    valor === null ||
    valor === ''
  ) {
    return null;
  }

  const n = Number(valor);

  return Number.isFinite(n)
    ? n
    : null;
}


function textoONull(valor) {
  if (
    valor === undefined ||
    valor === null
  ) {
    return null;
  }

  const t = String(valor).trim();

  return t !== ''
    ? t
    : null;
}


// ======================================================
// 2. RECUPERAR AUDIOS ORIGINALES
// ======================================================

let originales = [];

try {
  originales =
    $('Preparar audio del turno')
      .all()
      .map(item => item.json ?? {});
} catch (_) {
  originales = [];
}


// ======================================================
// 3. EMPAREJAR FALLIDOS CON AUDIO ORIGINAL
// ======================================================

const resultados = fallidos.map((item, indice) => {

  const fallido =
    item.json ?? {};

  const mensajeId =
    numeroONull(fallido.mensaje_id);

  const mediaId =
    textoONull(fallido.media_id);


  // --------------------------------------------------
  // Buscar preferentemente por mensaje_id.
  // Si no existe, por media_id.
  // ├Ültimo fallback: posici├│n.
  // --------------------------------------------------

  let original =
    originales.find(o =>
      mensajeId !== null &&
      numeroONull(o.mensaje_id) === mensajeId
    );

  if (!original && mediaId) {
    original =
      originales.find(o =>
        textoONull(o.media_id) === mediaId
      );
  }

  if (!original) {
    original =
      originales[indice] ?? {};
  }


  // ==================================================
  // 4. DATOS DEL AUDIO
  // ==================================================

  const mediaLink =
    textoONull(
      original.media_link ??
      fallido.media_link
    );

  const mimeType =
    textoONull(
      original.mime_type ??
      fallido.mime_type
    ) ??
    'audio/ogg';

  const mediaIdFinal =
    textoONull(
      original.media_id ??
      fallido.media_id
    );

  const mensajeIdFinal =
    numeroONull(
      original.mensaje_id ??
      fallido.mensaje_id
    );


  if (!mediaLink) {
    throw new Error(
      `PREPARAR FALLBACK DEEPGRAM: no se pudo recuperar media_link para mensaje_id=${mensajeIdFinal ?? 'null'}.`
    );
  }


  // ==================================================
  // 5. SALIDA
  // ==================================================

  return {
    json: {

      ...fallido,

      mensaje_id:
        mensajeIdFinal,

      media_id:
        mediaIdFinal,

      media_link:
        mediaLink,

      mime_type:
        mimeType,

      indice_audio:
        numeroONull(
          original.indice_audio ??
          fallido.indice_audio
        ) ?? indice,

      conversacion_id:
        numeroONull(
          original.conversacion_id ??
          fallido.conversacion_id
        ),

      prospecto_id:
        numeroONull(
          original.prospecto_id ??
          fallido.prospecto_id
        ),

      telefono:
        textoONull(
          original.telefono ??
          fallido.telefono
        ),

      nombre_whatsapp:
        textoONull(
          original.nombre_whatsapp ??
          fallido.nombre_whatsapp
        ),

      proveedor_fallback:
        'DEEPGRAM',

      fallback_audio:
        true,

      fallback_preparado_at:
        new Date().toISOString()
    }
  };
});

return resultados;
