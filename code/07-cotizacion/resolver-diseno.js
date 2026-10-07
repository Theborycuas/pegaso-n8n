// ======================================================
// RESOLVER DISEÑO
// ======================================================
// Toma:
// - los detalles ya resueltos por catálogo
// - los diseños existentes del cliente
//
// Devuelve:
// - un item por detalle
// - diseno_id si encuentra coincidencia exacta
// - diseno_id = null si no existe
// ======================================================

const detalles = $('Resolver catálogo Pegaso').all();
const disenos = $input.all();

function normalizarTexto(valor) {
  return String(valor ?? '')
    .trim()
    .toLowerCase();
}

return detalles.map((item, index) => {
  const detalle = item.json;

  const clienteId = Number(detalle.cliente_id);
  const materialId = Number(detalle.material_id);
  const ancho = Number(detalle.ancho_cm);
  const alto = Number(detalle.alto_cm);
  const forma = normalizarTexto(detalle.forma);
  const nombre = normalizarTexto(detalle.nombre || detalle.producto);

  const encontrado = disenos.find((d) => {
    const diseno = d.json;

    if (!diseno || !diseno.id) {
      return false;
    }

    return (
      Number(diseno.cliente_id) === clienteId &&
      Number(diseno.material_id) === materialId &&
      Number(diseno.ancho_cm) === ancho &&
      Number(diseno.alto_cm) === alto &&
      normalizarTexto(diseno.forma) === forma &&
      normalizarTexto(diseno.nombre) === nombre &&
      diseno.activo === true
    );
  });

  return {
    json: {
      ...detalle,

      diseno_id: encontrado
        ? Number(encontrado.json.id)
        : null,

      diseno_existente: Boolean(encontrado),

      diseno_nombre_resuelto: encontrado
        ? encontrado.json.nombre
        : null,

      detalle_index: detalle.detalle_index ?? index
    }
  };
});