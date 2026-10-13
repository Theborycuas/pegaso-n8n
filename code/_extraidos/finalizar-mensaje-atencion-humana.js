// ======================================================
// N8N NODE - PEGASO
// ======================================================
// Nombre: Finalizar mensaje atención humana
// Node ID: 39de2c44-ec67-4f28-9cb1-c469f60993f4
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
