// ======================================================
// N8N NODE - PEGASO
// ======================================================
// Nombre: Error ninguna IA funciono
// Node ID: 62b676d9-ed78-4fbf-b802-86fde41a92b0
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
// ERROR NINGUNA IA FUNCIONO (EXTRACTOR) - V1.1
// ======================================================
// Los tres extractores de cotización fallaron. Se deriva
// a humano con los ids de Recuperar decisión comercial
// para que el cliente reciba el mensaje de transición.
// ======================================================

let decision = {};

try {
  decision =
    $('Recuperar decisión comercial').first().json ?? {};
} catch (_) {
  decision = {};
}

return [
  {
    json: {
      ...decision,
      valid: false,
      success: false,
      can_quote: false,
      status: 'AI_EXTRACTION_FAILED',
      error_code: 'ALL_AI_FAILED',
      intencion: 'SOLICITAR_HUMANO',
      accion: 'DERIVAR_HUMANO',
      requiere_humano: true,
      motivo_derivacion: 'OTRO',
      requiere_notificacion: true,
      respuesta_sugerida:
        'Permítame un momento por favor, verificamos su requerimiento.',
      details: [],
      cantidad_detalles: 0,
      source: 'NONE'
    }
  }
];
