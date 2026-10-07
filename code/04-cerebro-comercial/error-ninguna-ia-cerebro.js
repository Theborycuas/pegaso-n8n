// ======================================================
// NODO N8N: Error ninguna IA funciono cerebro
// ARCHIVO: code/04-cerebro-comercial/error-ninguna-ia-cerebro.js
// VERSION: 1.0
// RESPONSABILIDAD:
// - Emitir un item de error fijo cuando Groq, DeepSeek y OpenAI fallaron la validación del Cerebro Comercial.
// - Marcar valid=false, success=false, can_quote=false, status=AI_EXTRACTION_FAILED y error_code=ALL_AI_FAILED.
// - Devolver un mensaje fijo de diagnóstico con details vacío y source=NONE.
// - NO responder al prospecto ni derivar a humano.
// - NO escribir en PostgreSQL ni reintentar la IA.
// ======================================================
return [
    {
      json: {
        valid: false,
        success: false,
        can_quote: false,
        status: 'AI_EXTRACTION_FAILED',
        error_code: 'ALL_AI_FAILED',
        message: 'No se pudo interpretar la solicitud. Los modelos de IA no pudieron extraer datos válidos.',
        details: [],
        cantidad_detalles: 0,
        source: 'NONE'
      }
    }
  ];