// ======================================================
// NODO N8N: Resolver diseño
// ARCHIVO: code/07-cotizacion/resolver-diseno.js
// VERSION: 1.0
// RESPONSABILIDAD:
// - Tomar los detalles resueltos por catálogo y los diseños existentes del cliente (entrada desde "Buscar diseño existente")
// - Buscar coincidencia exacta por cliente_id, material_id, ancho_cm, alto_cm, forma y nombre (sin mayúsculas/espacios) con activo = true
// - Devolver un item por detalle con diseno_id (o null si no existe) y diseno_existente
// - Adjuntar diseno_nombre_resuelto y conservar detalle_index
// - NO crear diseños (lo hace "Crear diseño" en la rama false de "¿Diseño existe?")
// - NO escribir en PostgreSQL
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