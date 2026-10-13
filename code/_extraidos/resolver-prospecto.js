// ======================================================
// N8N NODE - PEGASO
// ======================================================
// Nombre: Resolver prospecto
// Node ID: 1be58b3b-42bc-4ad5-ab46-871491a80742
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
// RESOLVER PROSPECTO
// ======================================================
// Determina si el tel├®fono/canal ya pertenece a un
// prospecto existente.
//
// Conserva siempre los datos originales del mensaje.
// ======================================================

const mensajeOriginal =
  $('Resolver contacto').first().json;

const resultadoBusqueda =
  $input.first()?.json ?? {};

// ======================================================
// ┬┐EL SELECT ENCONTR├ô UN PROSPECTO?
// ======================================================

const prospectoExiste =
  resultadoBusqueda.id !== undefined &&
  resultadoBusqueda.id !== null;

// ======================================================
// SALIDA
// ======================================================

return [
  {
    json: {

      // -----------------------------------------------
      // Mensaje / contacto original
      // -----------------------------------------------

      ...mensajeOriginal,

      // -----------------------------------------------
      // Prospecto
      // -----------------------------------------------

      prospecto_existe: prospectoExiste,

      prospecto_id:
        prospectoExiste
          ? Number(resultadoBusqueda.id)
          : null,

      prospecto_estado:
        prospectoExiste
          ? resultadoBusqueda.estado ?? null
          : null,

      prospecto_nombre:
        prospectoExiste
          ? resultadoBusqueda.nombre_whatsapp ?? null
          : null,

      prospecto_producto_interes:
        prospectoExiste
          ? resultadoBusqueda.producto_interes ?? null
          : null,

      prospecto_ciudad:
        prospectoExiste
          ? resultadoBusqueda.ciudad ?? null
          : null,

      prospecto_provincia:
        prospectoExiste
          ? resultadoBusqueda.provincia ?? null
          : null,

      prospecto_ultima_intencion:
        prospectoExiste
          ? resultadoBusqueda.ultima_intencion ?? null
          : null,

      prospecto_ultima_accion:
        prospectoExiste
          ? resultadoBusqueda.ultima_accion ?? null
          : null,

      prospecto_requiere_humano:
        prospectoExiste
          ? Boolean(resultadoBusqueda.requiere_humano)
          : false
    }
  }
];
