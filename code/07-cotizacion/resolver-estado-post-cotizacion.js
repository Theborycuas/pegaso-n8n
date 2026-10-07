// ======================================================
// NODO N8N: Resolver estado post cotización
// ARCHIVO: code/07-cotizacion/resolver-estado-post-cotizacion.js
// VERSION: 1.0
// RESPONSABILIDAD:
// - Leer la salida de "Preparar contexto post cotización" y conservarla completa
// - Determinar si existe un prospecto válido (prospecto_id numérico > 0)
// - Fijar prospecto_id_estado_update, prospecto_estado_nuevo = COTIZADO y actualizar_estado_prospecto para el IF "¿Actualizar prospecto cotizado?"
// - Registrar estado_resuelto_at
// - NO escribir en PostgreSQL (lo hace "Actualizar prospecto cotizado")
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