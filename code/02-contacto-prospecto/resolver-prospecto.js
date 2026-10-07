// ======================================================
// NODO N8N: Resolver prospecto
// ARCHIVO: code/02-contacto-prospecto/resolver-prospecto.js
// VERSION: 1.0
// RESPONSABILIDAD:
// - Determinar si el teléfono/canal ya pertenece a un prospecto según el resultado de "Buscar prospecto" (id no nulo)
// - Conservar siempre los datos originales del mensaje y contacto desde "Resolver contacto"
// - Mapear columnas del prospecto a campos prospecto_* (estado, nombre, producto_interes, ciudad, provincia, ultima_intencion, ultima_accion)
// - Convertir requiere_humano a booleano (false si no existe prospecto)
// - NO crear el prospecto (lo hace "Crear prospecto" en la rama false de "¿Prospecto existe?")
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