// ======================================================
// NODO N8N: Resolver contacto
// ARCHIVO: code/02-contacto-prospecto/resolver-contacto.js
// VERSION: 1.0
// RESPONSABILIDAD:
// - Recuperar el mensaje normalizado desde "Normalizar mensaje"
// - Interpretar el resultado de "Buscar Contacto": existe si devolvió un id numérico mayor que 0
// - Exponer contacto_id, cliente_id y contacto_nombre del contacto encontrado
// - Marcar es_cliente_registrado cuando el contacto está vinculado a un cliente_id
// - NO decidir la ruta (lo hace el IF siguiente "¿Cliente existente?")
// - NO crear contactos en PostgreSQL
// ======================================================

const entrada = $('Normalizar mensaje').first().json;

const resultadoBusqueda = $input.first()?.json ?? {};

const contactoExiste =
  resultadoBusqueda.id != null &&
  Number(resultadoBusqueda.id) > 0;

return [
  {
    json: {
      // Mensaje entrante
      telefono: entrada.telefono,
      nombre_whatsapp: entrada.nombre_whatsapp,
      mensaje: entrada.mensaje,
      tipo: entrada.tipo,
      canal: entrada.canal,
      mensaje_externo_id: entrada.mensaje_externo_id,
      recibido_at: entrada.recibido_at,

      // Resolución
      contacto_existe: contactoExiste,

      contacto_id:
        contactoExiste
          ? Number(resultadoBusqueda.id)
          : null,

      cliente_id:
        contactoExiste &&
        resultadoBusqueda.cliente_id != null
          ? Number(resultadoBusqueda.cliente_id)
          : null,

      contacto_nombre:
        contactoExiste
          ? resultadoBusqueda.nombre
          : null,

      es_cliente_registrado:
        contactoExiste &&
        resultadoBusqueda.cliente_id != null
    }
  }
];