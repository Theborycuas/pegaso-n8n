// ======================================================
// NODO N8N: Calcular precio detalle
// ARCHIVO: code/07-cotizacion/calcular-precio-detalle.js
// VERSION: 2.5
// RESPONSABILIDAD:
// - Calcular el precio de cada fila insertada en cotizacion_detalles (fuente única de verdad de reglas de precio)
// - Aplicar precios fijos por 1000: banda 2 a <4 cm en ambos lados = $18 y 4x4 exacto = $20 (la forma no los altera)
// - Aplicar fórmula ancho x alto x factor (0.72 general, 0.67 si ambos lados >= 10 cm, 0.50 si cantidad >= 10.000) con +1 cm por lado para 5x5 exacto y para formas circular/redondeada/troquelada
// - Restar descuento, redondear el total comercial hacia arriba (Math.ceil) y derivar subtotal/IVA interno 15%
// - Fusionar datos del INSERT con los de "EXPANDIR DETALLES" por índice y exponer campos de auditoría del cálculo
// - NO validar producibilidad (lo hace "Validar producibilidad P4"); solo lanza error si algún lado es < 2 cm
// - NO escribir en PostgreSQL (lo hacen "Update rows in a table" y "Update cotizacion_detalles")
// ======================================================


const items =
  $input.all();


const detallesOriginales =
  $('EXPANDIR DETALLES')
    .all();


// ======================================================
// 1. POLÍTICA CENTRAL DE PRECIOS PEGASO
// ======================================================
//
// ESTA ES LA SECCIÓN QUE DEBEMOS EDITAR EN EL FUTURO
// CUANDO CAMBIEN PRECIOS O REGLAS.
//
// ======================================================

const REGLAS_PRECIO = {


  // --------------------------------------------------
  // Restricción mínima
  // --------------------------------------------------

  MEDIDA_MINIMA_PERMITIDA_CM:
    2,


  // --------------------------------------------------
  // Banda fija pequeña
  // --------------------------------------------------
  //
  // Desde 2 cm inclusive
  // hasta 4 cm exclusivo.
  //
  // Ambos lados deben estar dentro de esta banda.
  //
  // --------------------------------------------------

  BANDA_PEQUENA_MIN_CM:
    2,

  BANDA_PEQUENA_MAX_EXCLUSIVO_CM:
    4,

  PRECIO_BANDA_PEQUENA_1000:
    18,


  // --------------------------------------------------
  // Precio fijo 4x4
  // --------------------------------------------------

  PRECIO_FIJO_4X4_1000:
    20,


  // --------------------------------------------------
  // Regla 5x5
  // --------------------------------------------------

  MEDIDA_ESPECIAL_5X5_CM:
    5,

  INCREMENTO_5X5_ANCHO_CM:
    1,

  INCREMENTO_5X5_ALTO_CM:
    1,


  // --------------------------------------------------
  // Factores
  // --------------------------------------------------

  FACTOR_GENERAL:
    0.72,

  FACTOR_TAMANO_GRANDE:
    0.67,

  FACTOR_VOLUMEN:
    0.50,


  // --------------------------------------------------
  // Volumen
  // --------------------------------------------------

  CANTIDAD_VOLUMEN:
    10000,


  // --------------------------------------------------
  // Tamaño grande
  // --------------------------------------------------
  //
  // "10x10 en adelante":
  // ambas dimensiones deben ser >= 10.
  //
  // --------------------------------------------------

  LIMITE_GRANDE_ANCHO_CM:
    10,

  LIMITE_GRANDE_ALTO_CM:
    10,


  // --------------------------------------------------
  // Incremento por forma
  // --------------------------------------------------

  INCREMENTO_FORMA_ANCHO_CM:
    1,

  INCREMENTO_FORMA_ALTO_CM:
    1,


  // --------------------------------------------------
  // IVA interno
  // --------------------------------------------------
  //
  // Se mantiene para DB / contabilidad.
  // No debe mostrarse como "IVA incluido"
  // en el mensaje comercial.
  //
  // --------------------------------------------------

  IVA:
    0.15,


  // --------------------------------------------------
  // Material P4
  // --------------------------------------------------

  MATERIAL_P4_ID:
    1
};


// ======================================================
// 2. HELPERS GENERALES
// ======================================================

function limpiarTexto(
  valor
) {

  return String(
    valor ?? ''
  )
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(
      /[\u0300-\u036f]/g,
      ''
    );
}


// ======================================================
// 3. NORMALIZAR FORMA
// ======================================================

function normalizarForma(
  valor
) {

  const forma =
    limpiarTexto(
      valor
    );


  if (!forma) {

    return 'RECTANGULAR';

  }


  // --------------------------------------------------
  // Rectangular / cuadrada
  // --------------------------------------------------

  if (
    forma === 'RECTANGULAR' ||
    forma === 'CUADRADA' ||
    forma === 'CUADRADO'
  ) {

    return 'RECTANGULAR';

  }


  // --------------------------------------------------
  // Redondeada / ovalada
  // --------------------------------------------------

  if (
    forma.includes('PUNTA REDONDEADA') ||
    forma.includes('PUNTAS REDONDEADAS') ||
    forma.includes('ESQUINA REDONDEADA') ||
    forma.includes('ESQUINAS REDONDEADAS') ||
    forma.includes('BORDE REDONDEADO') ||
    forma.includes('BORDES REDONDEADOS') ||
    forma === 'REDONDEADA' ||
    forma === 'REDONDEADO' ||
    forma === 'OVALADA' ||
    forma === 'OVALADO' ||
    forma === 'OVAL'
  ) {

    return 'REDONDEADA';

  }


  // --------------------------------------------------
  // Circular
  // --------------------------------------------------

  if (
    forma === 'CIRCULAR' ||
    forma === 'CIRCULO' ||
    forma === 'REDONDA' ||
    forma === 'REDONDO'
  ) {

    return 'CIRCULAR';

  }


  // --------------------------------------------------
  // Troquelada / irregular
  // --------------------------------------------------

  if (
    forma.includes('TROQUEL') ||
    forma.includes('IRREGULAR') ||
    forma.includes('FORMA ESPECIAL') ||
    forma.includes('FORMA PERSONALIZADA') ||
    forma.includes('CONTORNO') ||
    forma.includes('SILUETA') ||
    forma.includes('ARBOL') ||
    forma.includes('ESTRELLA') ||
    forma.includes('CORAZON') ||
    forma.includes('FLOR') ||
    forma.includes('NUBE') ||
    forma.includes('FIGURA')
  ) {

    return 'TROQUELADA';

  }


  // --------------------------------------------------
  // Conservamos comportamiento existente:
  // forma desconocida = troquelada.
  // --------------------------------------------------

  return 'TROQUELADA';

}


// ======================================================
// 4. INCREMENTO POR FORMA
// ======================================================

function aplicaIncrementoForma(
  formaNormalizada
) {

  return (
    formaNormalizada === 'CIRCULAR' ||
    formaNormalizada === 'TROQUELADA' ||
    formaNormalizada === 'REDONDEADA'
  );

}


// ======================================================
// 5. COMPARAR MEDIDAS
// ======================================================

function iguales(
  a,
  b,
  tolerancia = 0.000001
) {

  return (
    Math.abs(
      Number(a) -
      Number(b)
    ) <=
    tolerancia
  );

}


// ======================================================
// 6. MEDIDA CUADRADA EXACTA
// ======================================================

function esMedidaCuadradaExacta(
  ancho,
  alto,
  medida
) {

  return (
    iguales(
      ancho,
      medida
    ) &&
    iguales(
      alto,
      medida
    )
  );

}


// ======================================================
// 7. VALIDAR MEDIDA MÍNIMA
// ======================================================
//
// Pegaso NO produce etiquetas:
//
// 1x1
// 1x5
// 10x1
// 0.5x8
//
// En general:
// cualquier lado menor de 2 cm.
//
// ======================================================

function validarMedidaMinima(
  ancho,
  alto
) {

  return (
    ancho >=
      REGLAS_PRECIO
        .MEDIDA_MINIMA_PERMITIDA_CM &&
    alto >=
      REGLAS_PRECIO
        .MEDIDA_MINIMA_PERMITIDA_CM
  );

}


// ======================================================
// 8. BANDA FIJA PEQUEÑA
// ======================================================
//
// Regla comercial:
//
// Ambos lados:
//   >= 2 cm
//   < 4 cm
//
// Precio:
//   $18 / 1000
//
// Ejemplos válidos:
//   2x2
//   2x3
//   3x2
//   3x3
//   3x2.5
//   3.2x2
//   3.4x3.2
//   2.2x2.5
//
// ======================================================

function esBandaPequena18(
  ancho,
  alto
) {

  const min =
    REGLAS_PRECIO
      .BANDA_PEQUENA_MIN_CM;

  const max =
    REGLAS_PRECIO
      .BANDA_PEQUENA_MAX_EXCLUSIVO_CM;


  return (
    ancho >= min &&
    ancho < max &&
    alto >= min &&
    alto < max
  );

}


// ======================================================
// 9. RESOLVER PRECIO FIJO
// ======================================================

function resolverPrecioFijo(
  ancho,
  alto
) {


  // --------------------------------------------------
  // Banda pequeña 2 <= lado < 4
  // --------------------------------------------------

  if (
    esBandaPequena18(
      ancho,
      alto
    )
  ) {

    return {

      aplica:
        true,

      precio1000:
        REGLAS_PRECIO
          .PRECIO_BANDA_PEQUENA_1000,

      regla:
        'BANDA_PEQUENA_2_A_MENOR_4'

    };

  }


  // --------------------------------------------------
  // 4x4 exacto
  // --------------------------------------------------

  if (
    esMedidaCuadradaExacta(
      ancho,
      alto,
      4
    )
  ) {

    return {

      aplica:
        true,

      precio1000:
        REGLAS_PRECIO
          .PRECIO_FIJO_4X4_1000,

      regla:
        'PRECIO_FIJO_4X4'

    };

  }


  return {

    aplica:
      false,

    precio1000:
      null,

    regla:
      null

  };

}


// ======================================================
// 10. REGLA ESPECIAL 5X5
// ======================================================

function esEtiqueta5x5(
  ancho,
  alto
) {

  return esMedidaCuadradaExacta(
    ancho,
    alto,
    REGLAS_PRECIO
      .MEDIDA_ESPECIAL_5X5_CM
  );

}


// ======================================================
// 11. TAMAÑO GRANDE
// ======================================================

function esEtiquetaGrande(
  ancho,
  alto
) {

  return (
    ancho >=
      REGLAS_PRECIO
        .LIMITE_GRANDE_ANCHO_CM &&
    alto >=
      REGLAS_PRECIO
        .LIMITE_GRANDE_ALTO_CM
  );

}


// ======================================================
// 12. RESOLVER FACTOR
// ======================================================
//
// Prioridad para precios NO fijos:
//
// 1. Volumen >= 10.000
// 2. Tamaño >= 10x10
// 3. General
//
// ======================================================

function resolverFactor(
  cantidad,
  anchoOriginal,
  altoOriginal
) {


  // --------------------------------------------------
  // Volumen
  // --------------------------------------------------

  if (
    cantidad >=
    REGLAS_PRECIO
      .CANTIDAD_VOLUMEN
  ) {

    return {

      factor:
        REGLAS_PRECIO
          .FACTOR_VOLUMEN,

      regla:
        'VOLUMEN_10000'

    };

  }


  // --------------------------------------------------
  // Tamaño 10x10 o mayor
  // --------------------------------------------------

  if (
    esEtiquetaGrande(
      anchoOriginal,
      altoOriginal
    )
  ) {

    return {

      factor:
        REGLAS_PRECIO
          .FACTOR_TAMANO_GRANDE,

      regla:
        'TAMANO_10X10_O_MAYOR'

    };

  }


  // --------------------------------------------------
  // General
  // --------------------------------------------------

  return {

    factor:
      REGLAS_PRECIO
        .FACTOR_GENERAL,

    regla:
      'GENERAL'

  };

}


// ======================================================
// 13. PROCESAR DETALLES
// ======================================================

return items.map(
  (
    item,
    index
  ) => {


    // ==================================================
    // DATOS DB
    // ==================================================

    const db =
      item.json;


    const original =
      detallesOriginales[index]
        ?.json ||
      {};


    // ==================================================
    // IDENTIFICADORES
    // ==================================================

    const id =
      Number(
        db.id
      );


    const cotizacionId =
      Number(
        db.cotizacion_id ??
        original.cotizacion_id
      );


    const clienteId =
      original.cliente_id != null
        ? Number(
            original.cliente_id
          )
        : null;


    // ==================================================
    // VALIDACIONES DE IDENTIDAD
    // ==================================================

    if (
      !id ||
      id <= 0
    ) {

      throw new Error(
        `Detalle ${index}: el INSERT no devolvió un id válido de cotizacion_detalles.`
      );

    }


    if (
      !cotizacionId ||
      cotizacionId <= 0
    ) {

      throw new Error(
        `Detalle ${index}: cotizacion_id no es válido.`
      );

    }


    // ==================================================
    // DATOS BASE
    // ==================================================

    const cantidad =
      Number(
        db.cantidad ??
        original.cantidad
      );


    const ancho =
      Number(
        db.ancho_cm ??
        original.ancho_cm
      );


    const alto =
      Number(
        db.alto_cm ??
        original.alto_cm
      );


    const formaOriginal =
      String(
        db.forma ??
        original.forma ??
        'RECTANGULAR'
      );


    const forma =
      normalizarForma(
        formaOriginal
      );


    // ==================================================
    // VALIDACIONES COMERCIALES BASE
    // ==================================================

    if (
      !Number.isFinite(
        cantidad
      ) ||
      cantidad <= 0
    ) {

      throw new Error(
        `Detalle ${id}: cantidad inválida.`
      );

    }


    if (
      !Number.isFinite(
        ancho
      ) ||
      ancho <= 0
    ) {

      throw new Error(
        `Detalle ${id}: ancho_cm inválido.`
      );

    }


    if (
      !Number.isFinite(
        alto
      ) ||
      alto <= 0
    ) {

      throw new Error(
        `Detalle ${id}: alto_cm inválido.`
      );

    }


    // ==================================================
    // RESTRICCIÓN TÉCNICA
    // ==================================================

    const medidaPermitida =
      validarMedidaMinima(
        ancho,
        alto
      );


    if (
      !medidaPermitida
    ) {

      throw new Error(
        `Detalle ${id}: no es posible producir etiquetas de ${ancho}x${alto} cm. ` +
        `Pegaso no produce etiquetas que tengan 1 cm o menos en cualquiera de sus lados.`
      );

    }


    // ==================================================
    // IDS CATÁLOGO
    // ==================================================

    const productoId =
      db.producto_id != null
        ? Number(
            db.producto_id
          )
        : original.producto_id != null
          ? Number(
              original.producto_id
            )
          : null;


    const materialId =
      db.material_id != null
        ? Number(
            db.material_id
          )
        : original.material_id != null
          ? Number(
              original.material_id
            )
          : null;


    const disenoId =
      db.diseno_id != null
        ? Number(
            db.diseno_id
          )
        : original.diseno_id != null
          ? Number(
              original.diseno_id
            )
          : null;


    // ==================================================
    // INFORMACIÓN COMERCIAL
    // ==================================================

    const producto =
      original.producto ??
      '';


    const nombre =
      original.nombre ??
      '';


    const sabor =
      original.sabor ??
      null;


    const cantidadOriginal =
      original.cantidad_original !== null &&
      original.cantidad_original !== undefined &&
      Number.isFinite(
        Number(
          original.cantidad_original
        )
      )
        ? Number(
            original.cantidad_original
          )
        : cantidad;


    const cantidadAsumida =
      Boolean(
        original.cantidad_asumida
      );


    const minimoAplicado =
      Boolean(
        original.minimo_aplicado
      );


    // ==================================================
    // PRECIO FIJO
    // ==================================================

    const precioFijo =
      resolverPrecioFijo(
        ancho,
        alto
      );


    const precioFijoAplicado =
      precioFijo.aplica === true;


    // ==================================================
    // DIMENSIONES DE CÁLCULO
    // ==================================================

    let anchoCalculado =
      ancho;

    let altoCalculado =
      alto;


    // --------------------------------------------------
    // Regla exacta 5x5
    // --------------------------------------------------

    const incremento5x5Aplicado =
      !precioFijoAplicado &&
      esEtiqueta5x5(
        ancho,
        alto
      );


    if (
      incremento5x5Aplicado
    ) {

      anchoCalculado +=
        REGLAS_PRECIO
          .INCREMENTO_5X5_ANCHO_CM;

      altoCalculado +=
        REGLAS_PRECIO
          .INCREMENTO_5X5_ALTO_CM;

    }


    // --------------------------------------------------
    // Incremento por forma
    //
    // IMPORTANTE:
    // Si existe precio fijo, la forma NO altera el precio.
    //
    // Ejemplo:
    // 3 x 2.5 ovalada = $18 / 1000.
    // --------------------------------------------------

    const incrementoFormaAplicado =
      !precioFijoAplicado &&
      aplicaIncrementoForma(
        forma
      );


    if (
      incrementoFormaAplicado
    ) {

      anchoCalculado +=
        REGLAS_PRECIO
          .INCREMENTO_FORMA_ANCHO_CM;

      altoCalculado +=
        REGLAS_PRECIO
          .INCREMENTO_FORMA_ALTO_CM;

    }


    // ==================================================
    // FACTOR
    // ==================================================

    let factor =
      null;

    let reglaPrecio =
      null;


    if (
      precioFijoAplicado
    ) {

      reglaPrecio =
        precioFijo.regla;

    } else {

      const factorResuelto =
        resolverFactor(
          cantidad,
          ancho,
          alto
        );

      factor =
        factorResuelto.factor;

      reglaPrecio =
        factorResuelto.regla;

    }


    // ==================================================
    // PRECIO POR 1000 SIN REDONDEAR
    // ==================================================

    let precio1000Calculado;


    if (
      precioFijoAplicado
    ) {

      precio1000Calculado =
        Number(
          precioFijo
            .precio1000
        );

    } else {

      precio1000Calculado =
        anchoCalculado *
        altoCalculado *
        factor;

    }


    // ==================================================
    // PRECIO TOTAL ANTES DE DESCUENTO
    // ==================================================

    const precioTotalCalculado =
      precio1000Calculado *
      (
        cantidad /
        1000
      );


    // ==================================================
    // DESCUENTO
    // ==================================================

    const descuento =
      Number(
        db.descuento ??
        original.descuento ??
        0
      );


    const descuentoValido =
      Number.isFinite(
        descuento
      )
        ? descuento
        : 0;


    const precioDespuesDescuento =
      Math.max(
        0,
        precioTotalCalculado -
        descuentoValido
      );


    // ==================================================
    // REDONDEO COMERCIAL
    // ==================================================

    const total =
      Math.ceil(
        precioDespuesDescuento
      );


    const precioUnitario =
      total /
      cantidad;


    // ==================================================
    // IVA INTERNO
    // ==================================================

    const subtotal =
      total /
      (
        1 +
        REGLAS_PRECIO.IVA
      );


    const iva =
      total -
      subtotal;


    // ==================================================
    // PRECIO 1000 COMERCIAL
    // ==================================================

    const precio1000Comercial =
      Math.ceil(
        precio1000Calculado
      );


    // ==================================================
    // COTIZACIÓN MANUAL
    // ==================================================

    const requiereCotizacionManual =
      materialId !== null &&
      materialId !==
        REGLAS_PRECIO
          .MATERIAL_P4_ID;


    // ==================================================
    // SALIDA
    // ==================================================

    return {

      json: {

        // ----------------------------------------------
        // PK REAL
        // ----------------------------------------------

        id,

        cotizacion_id:
          cotizacionId,

        cliente_id:
          clienteId,

        detalle_index:
          original.detalle_index ??
          index,


        // ----------------------------------------------
        // Catálogo
        // ----------------------------------------------

        producto_id:
          productoId,

        material_id:
          materialId,

        diseno_id:
          disenoId,


        // ----------------------------------------------
        // Producto
        // ----------------------------------------------

        producto,

        nombre,

        sabor,


        // ----------------------------------------------
        // Cantidades
        // ----------------------------------------------

        cantidad,

        cantidad_original:
          cantidadOriginal,

        cantidad_asumida:
          cantidadAsumida,

        minimo_aplicado:
          minimoAplicado,


        // ----------------------------------------------
        // Dimensiones reales
        // ----------------------------------------------

        ancho_cm:
          ancho,

        alto_cm:
          alto,


        // ----------------------------------------------
        // Restricción técnica
        // ----------------------------------------------

        medida_permitida:
          medidaPermitida,

        medida_minima_permitida_cm:
          REGLAS_PRECIO
            .MEDIDA_MINIMA_PERMITIDA_CM,


        // ----------------------------------------------
        // Forma
        // ----------------------------------------------

        forma_original:
          formaOriginal,

        forma,


        // ----------------------------------------------
        // Dimensiones usadas para cálculo
        // ----------------------------------------------

        ancho_calculado_cm:
          anchoCalculado,

        alto_calculado_cm:
          altoCalculado,


        // ----------------------------------------------
        // Reglas especiales
        // ----------------------------------------------

        precio_fijo_aplicado:
          precioFijoAplicado,

        precio_fijo_1000:
          precioFijoAplicado
            ? Number(
                precioFijo
                  .precio1000
                  .toFixed(2)
              )
            : null,


        banda_pequena_18_aplicada:
          reglaPrecio ===
          'BANDA_PEQUENA_2_A_MENOR_4',


        incremento_5x5_aplicado:
          incremento5x5Aplicado,


        // ----------------------------------------------
        // Compatibilidad con V2.3 / V2.4
        // ----------------------------------------------

        incremento_pequena_aplicado:
          incremento5x5Aplicado,

        incremento_forma_aplicado:
          incrementoFormaAplicado,


        // ----------------------------------------------
        // Regla precio
        // ----------------------------------------------

        regla_precio:
          reglaPrecio,

        factor_aplicado:
          factor,


        // ----------------------------------------------
        // Auditoría antes de redondeo
        // ----------------------------------------------

        precio_1000_calculado:
          Number(
            precio1000Calculado
              .toFixed(6)
          ),

        precio_total_calculado:
          Number(
            precioTotalCalculado
              .toFixed(6)
          ),

        precio_despues_descuento:
          Number(
            precioDespuesDescuento
              .toFixed(6)
          ),


        // ----------------------------------------------
        // Valores comerciales compatibles
        // ----------------------------------------------

        precio_1000:
          Number(
            precio1000Comercial
              .toFixed(2)
          ),

        precio_unitario:
          Number(
            precioUnitario
              .toFixed(6)
          ),

        precio_total:
          Number(
            total
              .toFixed(2)
          ),

        subtotal:
          Number(
            subtotal
              .toFixed(2)
          ),

        iva:
          Number(
            iva
              .toFixed(2)
          ),

        descuento:
          Number(
            descuentoValido
              .toFixed(2)
          ),

        total:
          Number(
            total
              .toFixed(2)
          ),


        // ----------------------------------------------
        // Control
        // ----------------------------------------------

        precio_redondeado:
          true,

        requiere_cotizacion_manual:
          requiereCotizacionManual,

        observaciones:
          original.observaciones ??
          db.observaciones ??
          ''

      }

    };

  }
);