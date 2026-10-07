// ======================================================
// RESOLVER PROSPECTO
// ======================================================
// Determina si el teléfono/canal ya pertenece a un
// prospecto existente.
//
// Conserva siempre los datos originales del mensaje.
// ======================================================

const mensajeOriginal =
  $('Resolver contacto').first().json;

const resultadoBusqueda =
  $input.first()?.json ?? {};

// ======================================================
// ¿EL SELECT ENCONTRÓ UN PROSPECTO?
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