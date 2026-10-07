// ======================================================
// APLICAR MÍNIMO DE IMPRESIÓN
// PEGASO ADHESIVOS - V2.3
// ======================================================

const MINIMO_IMPRESION = 1000;
const MULTIPLO_IMPRESION = 1000;

const input = $input.first().json;

const detalles = input.detalles;


// ======================================================
// VALIDACIÓN
// ======================================================

if (!Array.isArray(detalles)) {

  return [
    {
      json: {
        valid: false,
        error:
          'No se encontraron detalles válidos para cotización.',
        detalles: []
      }
    }
  ];

}


// ======================================================
// NORMALIZAR
// ======================================================

const detallesNormalizados =
  detalles.map((detalle) => {

    const cantidadRecibida =
      detalle.cantidad;

    const cantidadNumerica =
      Number(cantidadRecibida);


    // --------------------------------------------------
    // SIN CANTIDAD
    // --------------------------------------------------
    //
    // Pegaso no pregunta cantidad para iniciar cotización.
    // Se utiliza el mínimo determinístico de 1000.
    //
    // --------------------------------------------------

    if (
      cantidadRecibida === null ||
      cantidadRecibida === undefined ||
      cantidadRecibida === '' ||
      !Number.isFinite(cantidadNumerica) ||
      cantidadNumerica <= 0
    ) {

      return {

        ...detalle,

        cantidad_original:
          cantidadRecibida ?? null,

        cantidad:
          MINIMO_IMPRESION,

        cantidad_asumida:
          true,

        minimo_aplicado:
          true

      };

    }


    // --------------------------------------------------
    // MÍNIMO + MÚLTIPLOS DE 1000
    // --------------------------------------------------

    const cantidadFinal =
      Math.max(
        MINIMO_IMPRESION,
        Math.ceil(
          cantidadNumerica /
          MULTIPLO_IMPRESION
        ) *
        MULTIPLO_IMPRESION
      );


    const cantidadFueAjustada =
      cantidadFinal !== cantidadNumerica;


    return {

      ...detalle,

      cantidad_original:
        cantidadNumerica,

      cantidad:
        cantidadFinal,

      cantidad_asumida:
        false,

      minimo_aplicado:
        cantidadFueAjustada

    };

  });


const minimoAplicado =
  detallesNormalizados.some(
    d => d.minimo_aplicado === true
  );


const algunaCantidadAsumida =
  detallesNormalizados.some(
    d => d.cantidad_asumida === true
  );


// ======================================================
// SALIDA
// ======================================================

return [
  {
    json: {

      valid:
        true,

      detalles:
        detallesNormalizados,

      cantidad_detalles:
        detallesNormalizados.length,

      minimo_impresion:
        MINIMO_IMPRESION,

      multiplo_impresion:
        MULTIPLO_IMPRESION,

      minimo_aplicado:
        minimoAplicado,

      cantidad_asumida:
        algunaCantidadAsumida,

      nota_minimo:
        'La cantidad mínima de impresión es de 1000 etiquetas por diseño o tamaño y trabajamos en múltiplos de 1000. Si cambia una letra o palabra ya se considera otro diseño.'

    }
  }
];