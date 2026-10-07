// ======================================================
// NODO N8N: Normalizar mensaje
// ARCHIVO: code/01-entrada/normalizar-mensaje.js
// VERSION: 1.0
// RESPONSABILIDAD:
// - Unificar la entrada real ("Preparar entrada WhatsApp") y la de prueba ("Mensaje entrante TEST") en un mismo contrato
// - Normalizar el teléfono: quitar espacios, guiones, paréntesis y '+', y convertir prefijo local 0 a 593 (Ecuador)
// - Aceptar alias de campos: telefono/whatsapp, mensaje/contenido, nombre_whatsapp/nombre
// - Forzar tipo y canal a mayúsculas con valores por defecto TEXTO y WHATSAPP
// - Registrar recibido_at con la hora actual de ejecución
// - NO consultar PostgreSQL (lo hace el nodo siguiente "Buscar Contacto")
// - NO validar que el teléfono o el mensaje existan
// ======================================================

const items = $input.all();

function normalizarTelefono(valor) {
  if (!valor) return null;

  let telefono = String(valor)
    .trim()
    .replace(/\s+/g, '')
    .replace(/-/g, '')
    .replace(/\(/g, '')
    .replace(/\)/g, '');

  // Quito/Ecuador:
  // 0999999999 -> 593999999999
  if (telefono.startsWith('0')) {
    telefono = '593' + telefono.substring(1);
  }

  if (telefono.startsWith('+')) {
    telefono = telefono.substring(1);
  }

  return telefono;
}

return items.map((item) => {
  const data = item.json;

  const telefono = normalizarTelefono(
    data.telefono ??
    data.whatsapp ??
    null
  );

  const mensaje = String(
    data.mensaje ??
    data.contenido ??
    ''
  ).trim();

  return {
    json: {
      telefono,

      nombre_whatsapp:
        data.nombre_whatsapp ??
        data.nombre ??
        null,

      mensaje,

      tipo:
        String(
          data.tipo ??
          'TEXTO'
        ).toUpperCase(),

      canal:
        String(
          data.canal ??
          'WHATSAPP'
        ).toUpperCase(),

      mensaje_externo_id:
        data.mensaje_externo_id ??
        null,

      recibido_at:
        new Date().toISOString()
    }
  };
});