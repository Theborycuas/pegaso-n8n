// ======================================================
// NODO N8N: Resolver conversación prospecto
// ARCHIVO: code/03-conversacion/resolver-conversacion-prospecto.js
// VERSION: 1.0
// RESPONSABILIDAD:
// - Recuperar los datos unificados del prospecto desde el Merge "Unificar prospecto"
// - Interpretar el resultado de "Buscar conversación": existe si devolvió un id numérico mayor que 0
// - Exponer conversacion_id, conversacion_estado y los ids de cliente, contacto y prospecto de la conversación
// - NO crear la conversación (lo hace "Crear conversación prospecto" en la rama false de "¿Conversación prospecto existe?")
// - NO exponer contexto_comercial de la conversación encontrada
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