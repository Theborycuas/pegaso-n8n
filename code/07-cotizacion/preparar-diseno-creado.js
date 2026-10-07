// ======================================================
// NODO N8N: Preparar diseño creado
// ARCHIVO: code/07-cotizacion/preparar-diseno-creado.js
// VERSION: 1.0
// RESPONSABILIDAD:
// - Recibir los diseños recién insertados por "Crear diseño"
// - Relacionar cada diseño creado con su detalle original de "¿Diseño existe?" (rama false) por cliente_id, material_id, medidas, forma y nombre
// - Devolver el detalle original con diseno_id del diseño creado, diseno_existente = false y diseno_creado = true
// - Lanzar error si un diseño creado no puede relacionarse con ningún detalle
// - NO crear ni modificar diseños en PostgreSQL
// - NO validar producibilidad (lo hace "Validar producibilidad P4")
// ======================================================

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