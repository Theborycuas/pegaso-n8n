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