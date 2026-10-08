// ======================================================
// NODO N8N: Normalizar mensaje
// ARCHIVO: code/01-entrada/normalizar-mensaje.js
// VERSION: 2.1
// ======================================================
//
// RESPONSABILIDAD:
//
// - Unificar entrada real de WhatsApp ("IF: ¿Entrada soportada
//   por el flujo?" true), entrada no soportada ("Preparar entrada
//   no soportada") y entrada TEST.
// - Normalizar teléfono, nombre, mensaje, tipo y canal.
// - CONSERVAR metadatos multimedia provenientes de
//   "Preparar entrada WhatsApp".
// - Exponer derivacion_directa siempre como booleano: lo lee
//   "IF: ¿Derivación directa por entrada?" con
//   $('Normalizar mensaje').
// - No decidir la derivación (la fija "Preparar entrada no
//   soportada").
// - No decidir si una imagen se analiza.
// - No descargar multimedia.
// - No consultar PostgreSQL.
//
// ======================================================

const items = $input.all();


// ======================================================
// 1. HELPERS
// ======================================================

function normalizarTelefono(valor) {

  if (!valor) {
    return null;
  }

  let telefono = String(valor)
    .trim()
    .replace(/\s+/g, '')
    .replace(/-/g, '')
    .replace(/\(/g, '')
    .replace(/\)/g, '');

  // --------------------------------------------------
  // Ecuador:
  // 0999999999 -> 593999999999
  // --------------------------------------------------

  if (telefono.startsWith('0')) {
    telefono =
      '593' + telefono.substring(1);
  }

  if (telefono.startsWith('+')) {
    telefono =
      telefono.substring(1);
  }

  return telefono;
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

  const mensaje =
    textoONull(
      data.mensaje ??
      data.contenido
    ) ?? '';


  // ==================================================
  // TIPO / CANAL
  // ==================================================

  const tipo =
    String(
      data.tipo ??
      'TEXTO'
    )
      .trim()
      .toUpperCase();


  const canal =
    String(
      data.canal ??
      'WHATSAPP'
    )
      .trim()
      .toUpperCase();


  // ==================================================
  // SALIDA
  // ==================================================

  return {
    json: {

      // -----------------------------------------------
      // Conservamos primero el contrato previo.
      // Esto es fundamental para multimedia.
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
        data.media_soportada === true,

      requiere_procesamiento_media:
        data.requiere_procesamiento_media === true,

      apto_para_flujo_texto:
        data.apto_para_flujo_texto === true,

      apto_para_flujo_conversacional:
        data.apto_para_flujo_conversacional === true,


      // -----------------------------------------------
      // DERIVACIÓN DIRECTA (entradas no soportadas)
      // -----------------------------------------------

      derivacion_directa:
        data.derivacion_directa === true,

      derivacion_directa_motivo:
        data.derivacion_directa === true
          ? data.derivacion_directa_motivo ?? 'ENTRADA_NO_SOPORTADA'
          : null,


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