// ======================================================
// FINALIZAR MENSAJE - MODO PRUEBA
// ======================================================
//
// El mensaje YA fue guardado.
//
// Este número no tiene autorización para ser atendido
// automáticamente mientras MODO_PRUEBA esté activo.
//
// No llamar IA.
// No cotizar.
// No responder WhatsApp.
// No modificar la conversación comercial.
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