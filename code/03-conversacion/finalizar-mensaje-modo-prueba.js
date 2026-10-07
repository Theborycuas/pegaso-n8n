// ======================================================
// NODO N8N: Finalizar mensaje modo prueba
// ARCHIVO: code/03-conversacion/finalizar-mensaje-modo-prueba.js
// VERSION: 1.0
// RESPONSABILIDAD:
// - Cerrar la ejecución cuando MODO_PRUEBA está activo y el teléfono no está autorizado (el mensaje ya fue guardado)
// - Devolver un resumen: flujo MODO_PRUEBA, respuesta_automatica = false, automatizacion_ejecutada = false
// - Propagar el motivo de bloqueo (por defecto MODO_PRUEBA_TELEFONO_NO_AUTORIZADO), teléfono e ids de conversación y prospecto
// - NO llamar a la IA, NO cotizar y NO responder por WhatsApp
// - NO modificar la conversación comercial
// ======================================================

const input =
  $input.first()?.json ?? {};

return [
  {
    json: {

      success: true,

      flujo:
        'MODO_PRUEBA',

      mensaje_guardado:
        true,

      respuesta_automatica:
        false,

      automatizacion_ejecutada:
        false,

      modo_prueba:
        input.modo_prueba === true,

      telefono_prueba_permitido:
        input.telefono_prueba_permitido === true,

      puede_responder_bot:
        false,

      motivo:
        input.motivo_bloqueo_bot ??
        'MODO_PRUEBA_TELEFONO_NO_AUTORIZADO',

      telefono:
        input.telefono ?? null,

      conversacion_id:
        input.conversacion_id ?? null,

      prospecto_id:
        input.prospecto_id ?? null,

      finalizado_at:
        new Date().toISOString()

    }
  }
];