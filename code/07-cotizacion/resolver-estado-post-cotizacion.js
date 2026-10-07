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