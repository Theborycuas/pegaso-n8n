// ======================================================
// NODO N8N: Finalizar mensaje atención humana
// ARCHIVO: code/03-conversacion/finalizar-mensaje-atencion-humana.js
// VERSION: 1.0
// RESPONSABILIDAD:
// - Cerrar la ejecución cuando el prospecto ya está derivado a atención humana
// - Devolver un resumen fijo: flujo ATENCION_HUMANA, motivo PROSPECTO_DERIVADO_A_HUMANO, mensaje_guardado = true
// - Marcar requiere_humano = true y respuesta_automatica = false
// - NO llamar a la IA ni responder por WhatsApp
// - NO notificar al asesor humano ni modificar la conversación
// ======================================================

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