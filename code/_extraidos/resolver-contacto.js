// ======================================================
// N8N NODE - PEGASO
// ======================================================
// Nombre: Resolver contacto
// Node ID: c548c8da-59ad-4278-bc97-c570261239ff
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
// RESOLVER CONTACTO
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
