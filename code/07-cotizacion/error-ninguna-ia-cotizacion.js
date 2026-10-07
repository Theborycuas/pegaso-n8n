// ======================================================
// NODO N8N: Error ninguna IA funciono
// ARCHIVO: code/07-cotizacion/error-ninguna-ia-cotizacion.js
// VERSION: 1.0
// RESPONSABILIDAD:
// - Emitir el resultado de fallo cuando Groq, DeepSeek y OpenAI no devolvieron una extracción válida
// - Marcar valid/success/can_quote en false con status AI_EXTRACTION_FAILED y error_code ALL_AI_FAILED
// - Entregar un mensaje de error fijo y una lista de detalles vacía (campo details)
// - NO lanzar excepción ni reintentar ningún modelo de IA
// - NO enviar mensajes al cliente ni escribir en PostgreSQL
// ======================================================

return [
    {
      json: {
        valid: false,
        success: false,
        can_quote: false,
        status: 'AI_EXTRACTION_FAILED',
        error_code: 'ALL_AI_FAILED',
        message: 'No se pudo interpretar el pedido. Los modelos de IA no pudieron extraer datos válidos.',
        details: [],
        cantidad_detalles: 0,
        source: 'NONE'
      }
    }
  ];