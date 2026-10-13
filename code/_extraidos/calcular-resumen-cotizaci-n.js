// ======================================================
// N8N NODE - PEGASO
// ======================================================
// Nombre: Calcular resumen cotizaci├│n
// Node ID: 2478267a-3ded-4aa1-9dbd-8e4e62a6a390
// TypeVersion: 2
//
// Workflow:
// SISTEMA AUTOMATIZADO PEGASO
//
// Workflow ID:
// 09OF22FOxihypeeh
//
// NOTA:
// Archivo generado automáticamente desde n8n.
// El header NO pertenece al código almacenado en n8n.
// ======================================================

// ======================================================
// CALCULAR RESUMEN COTIZACI├ôN
// PEGASO ADHESIVOS - V2.3
// ======================================================
//
// Entrada:
//   varios registros de cotizacion_detalles
//   YA calculados / actualizados.
//
// Salida:
//   1 item con subtotal, IVA y total
//   de toda la cotizaci├│n.
//
// IMPORTANTE:
//
// - Cada detalle ya viene con su redondeo comercial.
// - El resumen suma el campo "total" de cada detalle.
// - Si por compatibilidad no existe "total",
//   utiliza "precio_total".
// - IVA se mantiene internamente.
// - Ya NO depende de que el mensaje comercial
//   muestre "IVA incluido".
//
// ======================================================

const items = $input.all();


// ======================================================
// 1. VALIDACI├ôN
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
// 3. COTIZACI├ôN ID
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
    'cotizacion_id no v├ílido para calcular el resumen.'
  );

}


// ======================================================
// 4. VALIDAR QUE TODOS PERTENEZCAN A LA MISMA COTIZACI├ôN
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
//   Ôåô
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
// 7. TOTAL ANTES DE REDONDEO / AUDITOR├ìA
// ======================================================
//
// Solo informativo.
//
// Permite comparar:
//
// c├ílculo matem├ítico previo
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
// 9. INFORMACI├ôN DE REGLAS APLICADAS
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
