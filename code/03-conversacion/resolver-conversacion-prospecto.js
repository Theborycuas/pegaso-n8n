// ======================================================
// RESOLVER CONVERSACIÓN DEL PROSPECTO
// ======================================================

const entrada = $('Unificar prospecto').first().json;
const resultadoBusqueda = $input.first()?.json ?? {};

// ------------------------------------------------------
// Existe conversación si PostgreSQL devolvió un ID válido
// ------------------------------------------------------

const conversacionExiste =
  resultadoBusqueda.id !== undefined &&
  resultadoBusqueda.id !== null &&
  Number(resultadoBusqueda.id) > 0;

// ------------------------------------------------------
// SALIDA UNIFICADA
// ------------------------------------------------------

return [
  {
    json: {
      ...entrada,

      conversacion_existe: conversacionExiste,

      conversacion_id:
        conversacionExiste
          ? Number(resultadoBusqueda.id)
          : null,

      conversacion_estado:
        conversacionExiste
          ? resultadoBusqueda.estado ?? null
          : null,

      conversacion_cliente_id:
        conversacionExiste &&
        resultadoBusqueda.cliente_id != null
          ? Number(resultadoBusqueda.cliente_id)
          : null,

      conversacion_contacto_id:
        conversacionExiste &&
        resultadoBusqueda.contacto_id != null
          ? Number(resultadoBusqueda.contacto_id)
          : null,

      conversacion_prospecto_id:
        conversacionExiste &&
        resultadoBusqueda.prospecto_id != null
          ? Number(resultadoBusqueda.prospecto_id)
          : null
    }
  }
];