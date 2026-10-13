// ======================================================
// N8N NODE - PEGASO
// ======================================================
// Nombre: Aplicar mínimo de impresión
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
// APLICAR MÍNIMO DE IMPRESIÓN
// PEGASO ADHESIVOS - V2.4
// ======================================================
//
// V2.4: corta la cotizacion automatica (antes de insertar
// nada) si algun detalle normalizado llega a 6000 o mas.
// La derivacion normal ocurre en "Resolver contexto
// comercial"; esto solo cubre extracciones divergentes.
//
// ======================================================

const MINIMO_IMPRESION = 1000;
const MULTIPLO_IMPRESION = 1000;
const CANTIDAD_DERIVACION_HUMANA = 6000;

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


const detallesMayoristas =
  detallesNormalizados.filter(
    d => d.cantidad >= CANTIDAD_DERIVACION_HUMANA
  );

if (detallesMayoristas.length > 0) {

  throw new Error(
    `Cotizacion automatica bloqueada: ${detallesMayoristas
      .map(d => d.cantidad)
      .join(', ')} etiquetas (${CANTIDAD_DERIVACION_HUMANA} o mas) ` +
    'requieren DERIVAR_HUMANO.'
  );

}


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
