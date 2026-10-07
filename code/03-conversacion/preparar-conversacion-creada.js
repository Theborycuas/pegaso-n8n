// ======================================================
// NODO N8N: Preparar conversación creada
// ARCHIVO: code/03-conversacion/preparar-conversacion-creada.js
// VERSION: 1.0
// RESPONSABILIDAD:
// - Validar que "Crear conversación prospecto" devolvió un id mayor que 0 (lanza error si no)
// - Combinar los datos originales de "Resolver conversación prospecto" con la conversación insertada
// - Marcar conversacion_existe = true y conversacion_nueva = true
// - Usar estado ACTIVA por defecto y prospecto_id original si el INSERT no los devuelve
// - NO escribir en PostgreSQL (el INSERT ya lo hizo "Crear conversación prospecto")
// ======================================================

const creada = $input.first().json;
const original = $('Resolver conversación prospecto').first().json;

if (!creada.id || Number(creada.id) <= 0) {
  throw new Error(
    'Crear conversación prospecto no devolvió un id válido.'
  );
}

return [
  {
    json: {
      ...original,

      conversacion_existe: true,
      conversacion_nueva: true,

      conversacion_id: Number(creada.id),

      conversacion_estado:
        creada.estado ?? 'ACTIVA',

      conversacion_cliente_id:
        creada.cliente_id != null
          ? Number(creada.cliente_id)
          : null,

      conversacion_contacto_id:
        creada.contacto_id != null
          ? Number(creada.contacto_id)
          : null,

      conversacion_prospecto_id:
        creada.prospecto_id != null
          ? Number(creada.prospecto_id)
          : Number(original.prospecto_id)
    }
  }
];