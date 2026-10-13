// ======================================================
// N8N NODE - PEGASO
// ======================================================
// Nombre: Resolver estado post cotizaci├│n
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
// RESOLVER ESTADO POST COTIZACI├ôN
// ======================================================

const contexto =
  $('Preparar contexto post cotizaci├│n').first().json ?? {};

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
// Si m├ís adelante descubrimos restricciones espec├¡ficas
// en la columna estado, ajustamos ├║nicamente este valor.

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
