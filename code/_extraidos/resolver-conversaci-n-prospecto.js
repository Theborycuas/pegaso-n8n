// ======================================================
// N8N NODE - PEGASO
// ======================================================
// Nombre: Resolver conversaci├│n prospecto
// Node ID: 747d2f8b-66aa-487d-87c6-3458c649a4e6
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
// NODO N8N: Resolver conversaci├│n prospecto
// ARCHIVO: code/03-conversacion/resolver-conversacion-prospecto.js
// VERSION: 1.1
// RESPONSABILIDAD:
// - Recuperar los datos unificados del prospecto desde el Merge "Unificar prospecto"
// - Interpretar el resultado de "Buscar conversaci├│n": existe si devolvi├│ un id num├®rico mayor que 0
// - Exponer conversacion_id, conversacion_estado y los ids de cliente, contacto y prospecto de la conversaci├│n
// - Exponer conversacion_contexto_comercial (memoria guardada por "Guardar contexto comercial") para que "Preparar conversaci├│n" la parsee
// - NO crear la conversaci├│n (lo hace "Crear conversaci├│n prospecto" en la rama false de "┬┐Conversaci├│n prospecto existe?")
// ======================================================

const entrada = $('Unificar prospecto').first().json;
const resultadoBusqueda = $input.first()?.json ?? {};

// ------------------------------------------------------
// Existe conversaci├│n si PostgreSQL devolvi├│ un ID v├ílido
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
          : null,

      conversacion_contexto_comercial:
        conversacionExiste
          ? resultadoBusqueda.contexto_comercial ?? null
          : null
    }
  }
];
