// ======================================================
// NODO N8N: Calcular resumen cotización
// ARCHIVO: code/07-cotizacion/calcular-resumen-cotizacion.js
// VERSION: 2.3
// RESPONSABILIDAD:
// - Validar que existan detalles y que todos pertenezcan al mismo cotizacion_id
// - Sumar el "total" ya redondeado de cada detalle (o "precio_total" por compatibilidad) como total de la cotización
// - Derivar subtotal e IVA interno 15% desde el total (IVA incluido, no se muestra al cliente)
// - Sumar descuentos y el total calculado sin redondeo como dato de auditoría
// - Resumir reglas de precio aplicadas y banderas de redondeo/incremento en 1 solo item
// - NO recalcular precios por detalle (lo hace "Calcular precio detalle")
// - NO escribir en PostgreSQL (lo hace "Update rows in a table")
// ======================================================

const items = $input.all();


// ======================================================
// 1. VALIDACIÓN
// ======================================================

if (!items.length) {

  throw new Error(
    'No existen detalles para calcular el resumen.'
  );

}


// ======================================================
// 2. HELPERS
// ======================================================

function numero(valor) {

  if (
    valor === null ||
    valor === undefined ||
    valor === ''
  ) {
    return 0;
  }

  const n = Number(valor);

  return Number.isFinite(n)
    ? n
    : 0;
}


// ======================================================
// 3. COTIZACIÓN ID
// ======================================================

const cotizacionId =
  Number(
    items[0].json.cotizacion_id
  );


if (
  !cotizacionId ||
  cotizacionId <= 0
) {

  throw new Error(
    'cotizacion_id no válido para calcular el resumen.'
  );

}


// ======================================================
// 4. VALIDAR QUE TODOS PERTENEZCAN A LA MISMA COTIZACIÓN
// ======================================================

for (const item of items) {

  const detalleCotizacionId =
    Number(
      item.json.cotizacion_id
    );

  if (
    detalleCotizacionId !== cotizacionId
  ) {

    throw new Error(
      `Se encontraron detalles de distintas cotizaciones. ` +
      `Esperado: ${cotizacionId}, recibido: ${detalleCotizacionId}.`
    );

  }

}


// ======================================================
// 5. SUMAR TOTALES COMERCIALES
// ======================================================
//
// Preferencia:
//
// total
//   ↓
// precio_total
//
// "total" ya contempla:
// - regla de precio
// - descuento
// - redondeo comercial
//
// ======================================================

const totalCotizacion =
  items.reduce(
    (sum, item) => {

      const detalle =
        item.json;

      const totalDetalle =
        detalle.total !== null &&
        detalle.total !== undefined
          ? numero(detalle.total)
          : numero(detalle.precio_total);

      return sum + totalDetalle;

    },
    0
  );


// ======================================================
// 6. SUMAR DESCUENTOS
// ======================================================

const descuentoTotal =
  items.reduce(
    (sum, item) => {

      return (
        sum +
        numero(
          item.json.descuento
        )
      );

    },
    0
  );


// ======================================================
// 7. TOTAL ANTES DE REDONDEO / AUDITORÍA
// ======================================================
//
// Solo informativo.
//
// Permite comparar:
//
// cálculo matemático previo
// vs.
// precio comercial redondeado.
//
// ======================================================

const totalCalculadoSinRedondeo =
  items.reduce(
    (sum, item) => {

      const detalle =
        item.json;

      if (
        detalle.precio_despues_descuento !== null &&
        detalle.precio_despues_descuento !== undefined
      ) {

        return (
          sum +
          numero(
            detalle.precio_despues_descuento
          )
        );

      }

      if (
        detalle.precio_total_calculado !== null &&
        detalle.precio_total_calculado !== undefined
      ) {

        return (
          sum +
          numero(
            detalle.precio_total_calculado
          ) -
          numero(
            detalle.descuento
          )
        );

      }

      return sum;

    },
    0
  );


// ======================================================
// 8. IVA INTERNO
// ======================================================
//
// Se mantiene porque la estructura existente
// de cotizaciones ya trabaja con:
// subtotal / iva / total.
//
// Comercialmente no es necesario mostrar:
// "IVA incluido".
//
// ======================================================

const IVA =
  0.15;


const subtotal =
  totalCotizacion /
  (
    1 +
    IVA
  );


const iva =
  totalCotizacion -
  subtotal;


// ======================================================
// 9. INFORMACIÓN DE REGLAS APLICADAS
// ======================================================

const reglasAplicadas =
  [
    ...new Set(
      items
        .map(
          item =>
            item.json.regla_precio
        )
        .filter(Boolean)
    )
  ];


const huboRedondeo =
  items.some(
    item =>
      item.json.precio_redondeado === true
  );


const huboIncrementoPequena =
  items.some(
    item =>
      item.json.incremento_pequena_aplicado === true
  );


const huboIncrementoForma =
  items.some(
    item =>
      item.json.incremento_forma_aplicado === true
  );


// ======================================================
// 10. SALIDA
// ======================================================

return [
  {
    json: {

      cotizacion_id:
        cotizacionId,

      subtotal:
        Number(
          subtotal.toFixed(2)
        ),

      iva:
        Number(
          iva.toFixed(2)
        ),

      total:
        Number(
          totalCotizacion.toFixed(2)
        ),

      descuento_total:
        Number(
          descuentoTotal.toFixed(2)
        ),

      total_calculado_sin_redondeo:
        Number(
          totalCalculadoSinRedondeo.toFixed(6)
        ),

      cantidad_detalles:
        items.length,

      reglas_precio_aplicadas:
        reglasAplicadas,

      hubo_redondeo:
        huboRedondeo,

      hubo_incremento_pequena:
        huboIncrementoPequena,

      hubo_incremento_forma:
        huboIncrementoForma

    }
  }
];