// ======================================================
// PREPARAR PROSPECTO CREADO
// ======================================================
// Convierte la salida del INSERT de prospectos
// al mismo formato que usa "Resolver prospecto".
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