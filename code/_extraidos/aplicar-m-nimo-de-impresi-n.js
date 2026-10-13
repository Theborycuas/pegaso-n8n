// ======================================================
// N8N NODE - PEGASO
// ======================================================
// Nombre: Aplicar m├¡nimo de impresi├│n
// Node ID: b389417d-a3d7-4b2e-8819-255e7ba4a429
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
// APLICAR M├ìNIMO DE IMPRESI├ôN
// PEGASO ADHESIVOS - V2.3
// ======================================================

const MINIMO_IMPRESION = 1000;
const MULTIPLO_IMPRESION = 1000;

const input = $input.first().json;

const detalles = input.detalles;


// ======================================================
// VALIDACI├ôN
// ======================================================

if (!Array.isArray(detalles)) {

  return [
    {
      json: {
        valid: false,
        error:
          'No se encontraron detalles v├ílidos para cotizaci├│n.',
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
    // Pegaso no pregunta cantidad para iniciar cotizaci├│n.
    // Se utiliza el m├¡nimo determin├¡stico de 1000.
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
    // M├ìNIMO + M├ÜLTIPLOS DE 1000
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
        'La cantidad m├¡nima de impresi├│n es de 1000 etiquetas por dise├▒o o tama├▒o y trabajamos en m├║ltiplos de 1000. Si cambia una letra o palabra ya se considera otro dise├▒o.'

    }
  }
];
