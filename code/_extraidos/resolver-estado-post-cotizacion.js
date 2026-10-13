// ======================================================
// N8N NODE - PEGASO
// ======================================================
// Nombre: Resolver estado post cotización
// Node ID: 2b93b87f-f0d9-4ed5-bebc-e200226e2531
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
// RESOLVER ESTADO POST COTIZACIÓN
// ======================================================

const contexto =
  $('Preparar contexto post cotización').first().json ?? {};

const prospectoId =
  contexto.prospecto_id != null
    ? Number(contexto.prospecto_id)
    : null;

const existeProspecto =
  Number.isFinite(prospectoId) &&
  prospectoId > 0;


// Si es un prospecto y acabamos de cotizar,
// lo llevamos a COTIZADO.
//
// Si más adelante descubrimos restricciones específicas
// en la columna estado, ajustamos únicamente este valor.

return [
  {
    json: {
      ...contexto,

      prospecto_id_estado_update:
        existeProspecto
          ? prospectoId
          : null,

      prospecto_estado_nuevo:
        existeProspecto
          ? 'COTIZADO'
          : null,

      actualizar_estado_prospecto:
        existeProspecto,

      estado_resuelto_at:
        new Date().toISOString()
    }
  }
];
