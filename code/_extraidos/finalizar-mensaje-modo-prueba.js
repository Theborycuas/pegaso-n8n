// ======================================================
// N8N NODE - PEGASO
// ======================================================
// Nombre: Finalizar mensaje modo prueba
// Node ID: ed6f0062-e4e1-4c97-9f71-33f3d08e1732
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
// FINALIZAR MENSAJE - MODO PRUEBA
// ======================================================
//
// El mensaje YA fue guardado.
//
// Este n├║mero no tiene autorizaci├│n para ser atendido
// autom├íticamente mientras MODO_PRUEBA est├® activo.
//
// No llamar IA.
// No cotizar.
// No responder WhatsApp.
// No modificar la conversaci├│n comercial.
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
