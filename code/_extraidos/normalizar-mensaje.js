// ======================================================
// N8N NODE - PEGASO
// ======================================================
// Nombre: Normalizar mensaje
// Node ID: 86f8c1b8-0cff-4a95-bf03-92995e8f842b
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
// NODO N8N: Normalizar mensaje
// ARCHIVO: code/01-entrada/normalizar-mensaje.js
// VERSION: 2.1
// ======================================================
//
// RESPONSABILIDAD:
//
// - Unificar entrada real de WhatsApp y entrada TEST.
// - Normalizar teléfono, nombre, mensaje, tipo y canal.
// - CONSERVAR metadatos multimedia provenientes de
//   "Preparar entrada WhatsApp".
// - Compatible con:
//      TEXTO
//      IMAGEN
//      AUDIO
//      VIDEO
//      DOCUMENTO
//      otros tipos ya existentes.
// - No decidir si una imagen se analiza.
// - No decidir si un audio se transcribe.
// - No descargar multimedia.
// - No llamar IA.
// - No consultar PostgreSQL.
//
// ======================================================

const items =
  $input.all();


// ======================================================
// 1. HELPERS
// ======================================================

function normalizarTelefono(valor) {

  if (
    valor === undefined ||
    valor === null ||
    valor === ''
  ) {
    return null;
  }

  let telefono =
    String(valor)
      .trim()
      .replace(/\s+/g, '')
      .replace(/-/g, '')
      .replace(/\(/g, '')
      .replace(/\)/g, '');


  // --------------------------------------------------
  // Ecuador:
  //
  // 0999999999
  // ->
  // 593999999999
  // --------------------------------------------------

  if (
    telefono.startsWith('0')
  ) {
    telefono =
      '593' +
      telefono.substring(1);
  }


  // --------------------------------------------------
  // +593...
  // ->
  // 593...
  // --------------------------------------------------

  if (
    telefono.startsWith('+')
  ) {
    telefono =
      telefono.substring(1);
  }


  return telefono || null;
}


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


function booleano(
  valor,
  defecto = false
) {

  if (
    typeof valor === 'boolean'
  ) {
    return valor;
  }

  if (
    valor === true ||
    valor === 'true' ||
    valor === 1 ||
    valor === '1'
  ) {
    return true;
  }

  if (
    valor === false ||
    valor === 'false' ||
    valor === 0 ||
    valor === '0'
  ) {
    return false;
  }

  return defecto;
}


// ======================================================
// 2. NORMALIZAR ITEMS
// ======================================================

return items.map((item) => {

  const data =
    item.json ?? {};


  // ==================================================
  // TELÉFONO
  // ==================================================

  const telefono =
    normalizarTelefono(
      data.telefono ??
      data.whatsapp ??
      null
    );


  // ==================================================
  // MENSAJE
  // ==================================================
  //
  // IMPORTANTE:
  //
  // Para multimedia este campo puede contener:
  //
  // [IMAGEN] ...
  // [MEDIA_PENDIENTE] {...}
  //
  // o:
  //
  // [AUDIO]
  // [MEDIA_PENDIENTE] {...}
  //
  // No debemos modificar internamente ese descriptor.
  //
  // ==================================================

  const mensaje =
    textoONull(
      data.mensaje ??
      data.contenido
    ) ?? '';


  // ==================================================
  // TIPO
  // ==================================================

  const tipo =
    String(
      data.tipo ??
      'TEXTO'
    )
      .trim()
      .toUpperCase();


  // ==================================================
  // CANAL
  // ==================================================

  const canal =
    String(
      data.canal ??
      'WHATSAPP'
    )
      .trim()
      .toUpperCase();


  // ==================================================
  // MULTIMEDIA
  // ==================================================

  const mediaSoportada =
    booleano(
      data.media_soportada,
      false
    );


  const requiereProcesamientoMedia =
    booleano(
      data.requiere_procesamiento_media,
      false
    );


  const aptoParaFlujoTexto =
    booleano(
      data.apto_para_flujo_texto,
      false
    );


  const aptoParaFlujoConversacional =
    booleano(
      data.apto_para_flujo_conversacional,
      false
    );


  // ==================================================
  // SALIDA
  // ==================================================

  return {
    json: {

      // -----------------------------------------------
      // CONSERVAMOS PRIMERO TODO EL CONTRATO PREVIO.
      //
      // Fundamental para multimedia:
      //
      // - meta_whatsapp
      // - media_soportada
      // - descriptor [MEDIA_PENDIENTE]
      // - flags de control
      // -----------------------------------------------

      ...data,


      // -----------------------------------------------
      // CAMPOS NORMALIZADOS
      // -----------------------------------------------

      telefono,

      nombre_whatsapp:
        data.nombre_whatsapp ??
        data.nombre ??
        null,

      mensaje,

      tipo,

      canal,

      mensaje_externo_id:
        data.mensaje_externo_id ??
        null,


      // -----------------------------------------------
      // MULTIMEDIA
      // -----------------------------------------------

      meta_whatsapp:
        data.meta_whatsapp ??
        null,

      media_soportada:
        mediaSoportada,

      requiere_procesamiento_media:
        requiereProcesamientoMedia,

      apto_para_flujo_texto:
        aptoParaFlujoTexto,

      apto_para_flujo_conversacional:
        aptoParaFlujoConversacional,


      // -----------------------------------------------
      // CONTROL
      // -----------------------------------------------

      mensaje_normalizado:
        true,

      recibido_at:
        data.recibido_at ??
        new Date().toISOString()
    }
  };
});
