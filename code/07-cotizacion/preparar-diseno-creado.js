const creados = $input.all();
const originales = $('¿Diseño existe?').all();

return creados.map((item, index) => {
  const creado = item.json;

  // Como esta rama FALSE mantiene el orden de los items,
  // recuperamos el detalle original correspondiente.
  const original = originales.find(
    o =>
      o.json.diseno_existente === false &&
      Number(o.json.cliente_id) === Number(creado.cliente_id) &&
      Number(o.json.material_id) === Number(creado.material_id) &&
      Number(o.json.ancho_cm) === Number(creado.ancho_cm) &&
      Number(o.json.alto_cm) === Number(creado.alto_cm) &&
      String(o.json.forma || '').toUpperCase() ===
        String(creado.forma || '').toUpperCase() &&
      String(o.json.nombre || o.json.producto || '').trim().toLowerCase() ===
        String(creado.nombre || '').trim().toLowerCase()
  );

  if (!original) {
    throw new Error(
      `No pude relacionar el diseño creado ID ${creado.id} con su detalle original.`
    );
  }

  return {
    json: {
      ...original.json,

      diseno_id: Number(creado.id),
      diseno_existente: false,
      diseno_creado: true,
      diseno_nombre_resuelto: creado.nombre
    }
  };
});