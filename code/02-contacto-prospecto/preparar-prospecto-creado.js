// ======================================================
// NODO N8N: Preparar prospecto creado
// ARCHIVO: code/02-contacto-prospecto/preparar-prospecto-creado.js
// VERSION: 1.0
// RESPONSABILIDAD:
// - Convertir la salida del INSERT "Crear prospecto" al mismo formato que emite "Resolver prospecto"
// - Recuperar el mensaje y contacto originales desde "Resolver prospecto", con respaldo en las columnas insertadas
// - Fijar prospecto_existe = true y usar estado NUEVO por defecto si el INSERT no lo devuelve
// - Normalizar ids a número y flags (contacto_existe, es_cliente_registrado, prospecto_requiere_humano) a booleano
// - NO escribir en PostgreSQL (el INSERT ya lo hizo "Crear prospecto")
// - NO validar que el INSERT haya devuelto un id válido
// ======================================================

const prospectoCreado = $input.first().json;

// Recuperamos el mensaje original desde Resolver prospecto
const origen = $('Resolver prospecto').first().json;

return [
  {
    json: {
      // ==================================================
      // MENSAJE ORIGINAL
      // ==================================================
      telefono:
        origen.telefono ?? prospectoCreado.telefono ?? null,

      nombre_whatsapp:
        origen.nombre_whatsapp ??
        prospectoCreado.nombre_whatsapp ??
        null,

      mensaje:
        origen.mensaje ?? null,

      tipo:
        origen.tipo ?? 'TEXTO',

      canal:
        origen.canal ??
        prospectoCreado.canal ??
        'WHATSAPP',

      mensaje_externo_id:
        origen.mensaje_externo_id ?? null,

      recibido_at:
        origen.recibido_at ?? new Date().toISOString(),

      // ==================================================
      // CLIENTE / CONTACTO
      // ==================================================
      contacto_existe:
        Boolean(origen.contacto_existe),

      contacto_id:
        origen.contacto_id != null
          ? Number(origen.contacto_id)
          : null,

      cliente_id:
        origen.cliente_id != null
          ? Number(origen.cliente_id)
          : null,

      contacto_nombre:
        origen.contacto_nombre ?? null,

      es_cliente_registrado:
        Boolean(origen.es_cliente_registrado),

      // ==================================================
      // PROSPECTO
      // ==================================================
      prospecto_existe: true,

      prospecto_id:
        Number(prospectoCreado.id),

      prospecto_estado:
        prospectoCreado.estado ?? 'NUEVO',

      prospecto_nombre:
        prospectoCreado.nombre_whatsapp ?? null,

      prospecto_producto_interes:
        prospectoCreado.producto_interes ?? null,

      prospecto_ciudad:
        prospectoCreado.ciudad ?? null,

      prospecto_provincia:
        prospectoCreado.provincia ?? null,

      prospecto_ultima_intencion:
        prospectoCreado.ultima_intencion ?? null,

      prospecto_ultima_accion:
        prospectoCreado.ultima_accion ?? null,

      prospecto_requiere_humano:
        Boolean(prospectoCreado.requiere_humano)
    }
  }
];