const mensaje = $input.first().json;

return [
  {
    json: {
      success: true,

      flujo:
        'ATENCION_HUMANA',

      mensaje_guardado:
        true,

      requiere_humano:
        true,

      respuesta_automatica:
        false,

      motivo:
        'PROSPECTO_DERIVADO_A_HUMANO',

      recibido_at:
        new Date().toISOString()
    }
  }
];