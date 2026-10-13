// ======================================================
// N8N NODE - PEGASO
// ======================================================
// Nombre: Preparar conversación creada
// Node ID: 6b096918-3e74-4e49-8182-cfc44a11ca45
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
// PREPARAR CONVERSACIÓN CREADA
// ======================================================

const creada = $input.first().json;
const original = $('Resolver conversación prospecto').first().json;

if (!creada.id || Number(creada.id) <= 0) {
  throw new Error(
    'Crear conversación prospecto no devolvió un id válido.'
  );
}

return [
  {
    json: {
      ...original,

      conversacion_existe: true,
      conversacion_nueva: true,

      conversacion_id: Number(creada.id),

      conversacion_estado:
        creada.estado ?? 'ACTIVA',

      conversacion_cliente_id:
        creada.cliente_id != null
          ? Number(creada.cliente_id)
          : null,

      conversacion_contacto_id:
        creada.contacto_id != null
          ? Number(creada.contacto_id)
          : null,

      conversacion_prospecto_id:
        creada.prospecto_id != null
          ? Number(creada.prospecto_id)
          : Number(original.prospecto_id)
    }
  }
];
