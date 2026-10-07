// ======================================================
// NODO N8N: Preparar datos cotización
// ARCHIVO: code/07-cotizacion/preparar-datos-cotizacion.js
// VERSION: 2.3
// RESPONSABILIDAD:
// - Normalizar input.detalles[]: cantidad/ancho_cm/alto_cm a número, producto/nombre recortados o null
// - Normalizar forma a mayúsculas (RECTANGULAR por defecto si viene null)
// - Descartar detalles sin cantidad, ancho_cm y alto_cm positivos (producto y material NO son obligatorios para P4)
// - Devolver status READY_FOR_QUOTATION, o NO_DETAILS / NO_VALID_DETAILS con datos de debug
// - Propagar minimo_impresion, multiplo_impresion, minimo_aplicado, cantidad_asumida y nota_minimo
// - NO propagar material (los campos por detalle se reconstruyen de forma explícita)
// - NO escribir en PostgreSQL (lo hace "Insert cotización")
// ======================================================

const input = $input.first().json;

const detalles = input.detalles;


// ============================================================
// VALIDACIÓN
// ============================================================

if (
  !Array.isArray(detalles) ||
  detalles.length === 0
) {

  return [
    {
      json: {

        success: false,
        can_quote: false,

        status:
          'NO_DETAILS',

        message:
          'No existen detalles válidos para generar la cotización.',

        detalles: [],

        cantidad_detalles: 0,

        debug: {

          tipo_detalles:
            typeof detalles,

          es_array:
            Array.isArray(detalles),

          cantidad:
            Array.isArray(detalles)
              ? detalles.length
              : null,

          keys:
            Object.keys(input)
        }

      }
    }
  ];

}


// ============================================================
// NORMALIZAR
// ============================================================

const detallesValidos =
  detalles

    .filter(
      d =>
        d &&
        typeof d === 'object'
    )

    .map(d => {

      const cantidad =
        Number(
          d.cantidad ?? 0
        );

      const anchoCm =
        Number(
          d.ancho_cm ?? 0
        );

      const altoCm =
        Number(
          d.alto_cm ?? 0
        );


      return {

        cantidad,

        producto:
          d.producto != null &&
          String(d.producto).trim() !== ''
            ? String(d.producto).trim()
            : null,

        nombre:
          d.nombre != null &&
          String(d.nombre).trim() !== ''
            ? String(d.nombre).trim()
            : null,

        sabor:
          d.sabor ?? null,

        ancho_cm:
          anchoCm,

        alto_cm:
          altoCm,

        forma:
          String(
            d.forma ??
            'RECTANGULAR'
          ).toUpperCase(),

        cantidad_original:
          d.cantidad_original !== null &&
          d.cantidad_original !== undefined &&
          Number.isFinite(
            Number(d.cantidad_original)
          )
            ? Number(d.cantidad_original)
            : null,

        cantidad_asumida:
          d.cantidad_asumida === true,

        minimo_aplicado:
          d.minimo_aplicado === true

      };

    })


    // ========================================================
    // VALIDACIÓN COMERCIAL
    // ========================================================

    .filter(
      d =>
        Number.isFinite(d.cantidad) &&
        d.cantidad > 0 &&

        Number.isFinite(d.ancho_cm) &&
        d.ancho_cm > 0 &&

        Number.isFinite(d.alto_cm) &&
        d.alto_cm > 0
    );


// ============================================================
// VALIDACIÓN FINAL
// ============================================================

if (detallesValidos.length === 0) {

  return [
    {
      json: {

        success: false,
        can_quote: false,

        status:
          'NO_VALID_DETAILS',

        message:
          'Los detalles recibidos no contienen datos válidos para cotizar.',

        detalles: [],

        cantidad_detalles: 0,

        debug: {

          detalles_recibidos:
            detalles.length,

          detalles_validos:
            0,

          detalles_entrada:
            detalles
        }

      }
    }
  ];

}


// ============================================================
// SALIDA
// ============================================================

return [
  {
    json: {

      success:
        true,

      can_quote:
        true,

      status:
        'READY_FOR_QUOTATION',

      detalles:
        detallesValidos,

      cantidad_detalles:
        detallesValidos.length,

      minimo_impresion:
        input.minimo_impresion !== undefined
          ? Number(input.minimo_impresion)
          : 1000,

      multiplo_impresion:
        input.multiplo_impresion !== undefined
          ? Number(input.multiplo_impresion)
          : 1000,

      minimo_aplicado:
        input.minimo_aplicado === true,

      cantidad_asumida:
        input.cantidad_asumida === true,

      nota_minimo:
        input.nota_minimo ??
        null

    }
  }
];