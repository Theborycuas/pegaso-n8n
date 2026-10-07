// ======================================================
// NORMALIZAR MENSAJE ENTRANTE
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