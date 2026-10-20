// ======================================================
// N8N NODE - PEGASO
// ======================================================
// Nombre: Error ninguna IA funciono cerebro
// Node ID: 6de38fe8-617d-48d0-ad20-5c56b0c06047
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
// ERROR NINGUNA IA FUNCIONO CEREBRO - V1.1
// ======================================================
// Groq, DeepSeek y OpenAI fallaron. No se deja al cliente
// sin respuesta: se emite DERIVAR_HUMANO y el flujo sigue
// por Normalizar decisión IA.
// ======================================================

return [
  {
    json: {
      valid: true,
      success: false,
      can_quote: false,
      status: 'AI_EXTRACTION_FAILED',
      error_code: 'ALL_AI_FAILED',
      intencion: 'SOLICITAR_HUMANO',
      accion: 'DERIVAR_HUMANO',
      producto: null,
      material: null,
      cantidad: null,
      ancho_cm: null,
      alto_cm: null,
      forma: 'NO_ESPECIFICADA',
      ciudad_detectada: null,
      provincia_detectada: null,
      datos_suficientes_para_cotizar: false,
      requiere_humano: true,
      motivo_derivacion: 'OTRO',
      requiere_notificacion: true,
      clasificacion_prospecto: 'C',
      respuesta_sugerida:
        'Permítame un momento por favor, verificamos su requerimiento.',
      details: [],
      cantidad_detalles: 0,
      source: 'NONE'
    }
  }
];
