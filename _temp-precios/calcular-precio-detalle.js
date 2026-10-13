// ======================================================
// N8N NODE - PEGASO
// ======================================================
// Nombre: Calcular precio detalle
// Node ID: e581adfb-04f8-4998-a994-c6d425bd395c
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
// CALCULAR PRECIO DETALLE
// PEGASO ADHESIVOS - V2.6
// ======================================================
//
// FUENTE ├ÜNICA DE VERDAD PARA REGLAS DE PRECIO.
//
// Mantiene compatibilidad con:
// - cotizacion_detalles
// - Calcular resumen cotizaci├│n
// - Recuperar detalles calculados
// - Construir mensaje comercial
//
// ======================================================
//
// ORDEN REAL DEL CALCULO (V2.6):
//
//   1. Validar medida minima (ningun lado < 2 cm).
//   2. Precio fijo (banda pequena $18 / 4x4 $20).
//      Si aplica, se saltan los pasos 3 a 5.
//   3. Dimensiones de calculo: +1/+1 si es 5x5 exacto.
//   4. Dimensiones de calculo: +1/+1 por forma especial.
//   5. Factor:
//      5a. factor del rango de cantidad (1000-2000 / 3000-5000);
//      5b. tamano grande: si ancho_calc x alto_calc x factor
//          del rango > $130 por 1000 -> factor 0.67
//          (solo si es menor que el del rango).
//   6. precio_1000 = ancho_calc x alto_calc x factor
//      (o precio fijo).
//   7. total = precio_1000 x cantidad / 1000 - descuento.
//   8. Redondeo comercial: Math.ceil(total).
//   9. Precio minimo absoluto por detalle: max(total, $18).
//  10. Unitario, subtotal e IVA se derivan del total final.
//
// ======================================================
//
// REGLAS V2.6:
//
// 1. MEDIDA M├ìNIMA
//    Ninguna dimensi├│n puede ser < 2 cm.
//    Es decir, 1 cm o menos no se produce.
//
// 2. BANDA FIJA PEQUE├æA $18 / 1000
//    Cualquier medida donde:
//      ancho >= 2 y ancho < 4
//      alto  >= 2 y alto  < 4
//
//    Ejemplos:
//      2x2
//      2x3
//      3x2
//      3x3
//      3x2.5
//      3.2x2
//      3.4x3.2
//      2.2x2.5
//
//    Todas cuestan $18 / 1000.
//
//    La forma NO modifica este precio.
//
// 3. PRECIO FIJO 4x4
//    4x4 cm -> $20 / 1000.
//
// 4. 5x5 cm
//    Para c├ílculo se aumenta:
//    +1 cm ancho
//    +1 cm alto
//
// 5. RANGOS DE CANTIDAD (reemplazan al factor general 0.72)
//    1000 - 2000 -> factor 0.75
//    3000 - 5000 -> factor 0.67
//    6000 o mas  -> NO se cotiza automaticamente.
//                   "Resolver contexto comercial" deriva
//                   a humano antes de llegar aqui; si
//                   aun asi llega, este nodo lanza error.
//
//    1000 y 2000 comparten precio por 1000: la mejora
//    empieza en 3000 (mejora_precio_desde_cantidad).
//
//    IMPORTANTE:
//    No modifica precios fijos.
//
// 6. TAMANO GRANDE
//    Es grande la etiqueta cuyo precio por 1000 calculado
//    con el factor del rango supera $130.
//    (10x10 = $75 -> mediana).
//    factor = 0.67 si es menor que el del rango.
//
// 7. VOLUMEN >= 10.000 (factor 0.50)
//    Retirado: desde 6000 la cantidad va a humano.
//
// 8. FORMAS ESPECIALES
//    circular / redondeada / troquelada
//    +1 cm ancho
//    +1 cm alto
//
//    EXCEPTO:
//    cuando aplica una banda/precio fijo.
//
// 9. REDONDEO
//    Precio comercial final:
//    Math.ceil(...)
//
// 10. PRECIO MINIMO ABSOLUTO POR DETALLE
//    Despues del redondeo:
//    total = max(total, $18)
//    No altera medidas, cantidad, factor ni precio_1000.
//
// ======================================================


const items =
  $input.all();


const detallesOriginales =
  $('EXPANDIR DETALLES')
    .all();


// ======================================================
// 1. POL├ìTICA CENTRAL DE PRECIOS PEGASO
// ======================================================
//
// ESTA ES LA SECCI├ôN QUE DEBEMOS EDITAR EN EL FUTURO
// CUANDO CAMBIEN PRECIOS O REGLAS.
//
// ======================================================

const REGLAS_PRECIO = {


  // --------------------------------------------------
  // Restricci├│n m├¡nima
  // --------------------------------------------------

  MEDIDA_MINIMA_PERMITIDA_CM:
    2,


  // --------------------------------------------------
  // Banda fija peque├▒a
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
  // Rangos de cantidad
  // --------------------------------------------------
  //
  // Ordenados de menor a mayor. Las cantidades ya
  // llegan en multiplos de 1000 (minimo 1000).
  // Por encima del ultimo "hasta" no hay precio
  // automatico: corresponde DERIVAR_HUMANO.
  //
  // --------------------------------------------------

  RANGOS_CANTIDAD: [
    {
      codigo: 'RANGO_1000_2000',
      desde: 1000,
      hasta: 2000,
      factor: 0.75
    },
    {
      codigo: 'RANGO_3000_5000',
      desde: 3000,
      hasta: 5000,
      factor: 0.67
    }
  ],


  // --------------------------------------------------
  // Tamano grande
  // --------------------------------------------------
  //
  // Grande = precio por 1000 calculado con el factor
  // del rango mayor a este limite.
  //
  // --------------------------------------------------

  LIMITE_PRECIO_1000_TAMANO_GRANDE:
    130,

  FACTOR_TAMANO_GRANDE:
    0.67,


  // --------------------------------------------------
  // Precio minimo absoluto por detalle
  // --------------------------------------------------

  PRECIO_MINIMO_DETALLE:
    18,


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
// 7. VALIDAR MEDIDA M├ìNIMA
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
// 8. BANDA FIJA PEQUE├æA
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
// Ejemplos v├ílidos:
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
  // Banda peque├▒a 2 <= lado < 4
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
// 11. RANGO DE CANTIDAD
// ======================================================
//
// Devuelve null si la cantidad supera el ultimo rango
// (6000 o mas): no existe precio automatico.
//
// ======================================================

function resolverRangoCantidad(
  cantidad
) {

  return (
    REGLAS_PRECIO
      .RANGOS_CANTIDAD
      .find(
        rango =>
          cantidad <=
          rango.hasta
      ) ??
    null
  );

}


// ======================================================
// 12. RESOLVER FACTOR
// ======================================================
//
// Solo para precios NO fijos:
//
// 1. Factor del rango de cantidad.
// 2. Tamano grande (precio por 1000 con el factor del
//    rango > $130): factor 0.67 si es menor.
//
// Usa las dimensiones de calculo (ya incluyen +1 cm
// por 5x5 o forma especial).
//
// ======================================================

function resolverFactor(
  cantidad,
  anchoCalculado,
  altoCalculado
) {

  const rango =
    resolverRangoCantidad(
      cantidad
    );


  if (!rango) {

    const rangos =
      REGLAS_PRECIO
        .RANGOS_CANTIDAD;

    throw new Error(
      `Cantidad ${cantidad}: supera ${rangos[rangos.length - 1].hasta} ` +
      `etiquetas y no tiene precio automatico. ` +
      `Debe resolverse con DERIVAR_HUMANO antes de cotizar.`
    );

  }


  const precio1000Rango =
    anchoCalculado *
    altoCalculado *
    rango.factor;


  const tamanoGrande =
    precio1000Rango >
    REGLAS_PRECIO
      .LIMITE_PRECIO_1000_TAMANO_GRANDE;


  if (
    tamanoGrande &&
    REGLAS_PRECIO.FACTOR_TAMANO_GRANDE <
    rango.factor
  ) {

    return {

      factor:
        REGLAS_PRECIO
          .FACTOR_TAMANO_GRANDE,

      regla:
        'TAMANO_GRANDE_MAYOR_130',

      rango,

      precio1000Rango,

      tamanoGrande

    };

  }


  return {

    factor:
      rango.factor,

    regla:
      rango.codigo,

    rango,

    precio1000Rango,

    tamanoGrande

  };

}


// ======================================================
// 12.1 MEJORA EN EL SIGUIENTE RANGO
// ======================================================
//
// Devuelve la cantidad desde la que el precio por 1000
// realmente baja para estas dimensiones, o null.
//
// ======================================================

function resolverMejoraSiguienteRango(
  rangoActual,
  factorActual,
  anchoCalculado,
  altoCalculado
) {

  const rangos =
    REGLAS_PRECIO
      .RANGOS_CANTIDAD;

  const indice =
    rangos.indexOf(
      rangoActual
    );

  const siguiente =
    rangos[indice + 1];


  if (!siguiente) {
    return null;
  }


  const factorSiguiente =
    resolverFactor(
      siguiente.desde,
      anchoCalculado,
      altoCalculado
    ).factor;


  return factorSiguiente <
    factorActual
    ? siguiente.desde
    : null;

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
        `Detalle ${index}: el INSERT no devolvi├│ un id v├ílido de cotizacion_detalles.`
      );

    }


    if (
      !cotizacionId ||
      cotizacionId <= 0
    ) {

      throw new Error(
        `Detalle ${index}: cotizacion_id no es v├ílido.`
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
        `Detalle ${id}: cantidad inv├ílida.`
      );

    }


    if (
      !Number.isFinite(
        ancho
      ) ||
      ancho <= 0
    ) {

      throw new Error(
        `Detalle ${id}: ancho_cm inv├ílido.`
      );

    }


    if (
      !Number.isFinite(
        alto
      ) ||
      alto <= 0
    ) {

      throw new Error(
        `Detalle ${id}: alto_cm inv├ílido.`
      );

    }


    // ==================================================
    // RESTRICCI├ôN T├ëCNICA
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
    // LIMITE DE COTIZACION AUTOMATICA
    // ==================================================
    //
    // Aplica tambien a precios fijos.
    //
    // ==================================================

    if (
      !resolverRangoCantidad(
        cantidad
      )
    ) {

      throw new Error(
        `Detalle ${id}: ${cantidad} etiquetas no tienen precio automatico ` +
        `(6000 o mas). Debe resolverse con DERIVAR_HUMANO antes de cotizar.`
      );

    }


    // ==================================================
    // IDS CAT├üLOGO
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
    // INFORMACI├ôN COMERCIAL
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
    // DIMENSIONES DE C├üLCULO
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

    let factorResuelto =
      null;

    let mejoraPrecioDesdeCantidad =
      null;


    if (
      precioFijoAplicado
    ) {

      reglaPrecio =
        precioFijo.regla;

    } else {

      factorResuelto =
        resolverFactor(
          cantidad,
          anchoCalculado,
          altoCalculado
        );

      factor =
        factorResuelto.factor;

      reglaPrecio =
        factorResuelto.regla;

      mejoraPrecioDesdeCantidad =
        resolverMejoraSiguienteRango(
          factorResuelto.rango,
          factor,
          anchoCalculado,
          altoCalculado
        );

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

    const totalRedondeado =
      Math.ceil(
        precioDespuesDescuento
      );


    // ==================================================
    // PRECIO MINIMO ABSOLUTO DEL DETALLE
    // ==================================================
    //
    // Ultimo paso economico: no altera factores,
    // medidas, cantidad ni precio_1000.
    //
    // ==================================================

    const precioMinimoAplicado =
      totalRedondeado <
      REGLAS_PRECIO
        .PRECIO_MINIMO_DETALLE;

    const total =
      Math.max(
        totalRedondeado,
        REGLAS_PRECIO
          .PRECIO_MINIMO_DETALLE
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
    // COTIZACI├ôN MANUAL
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
        // Cat├ílogo
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
        // Restricci├│n t├®cnica
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
        // Dimensiones usadas para c├ílculo
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
        // Rango de cantidad / tamano grande
        // ----------------------------------------------

        rango_cantidad:
          factorResuelto?.rango.codigo ??
          null,

        rango_cantidad_desde:
          factorResuelto?.rango.desde ??
          null,

        rango_cantidad_hasta:
          factorResuelto?.rango.hasta ??
          null,

        factor_rango:
          factorResuelto?.rango.factor ??
          null,

        precio_1000_rango:
          factorResuelto
            ? Number(
                factorResuelto
                  .precio1000Rango
                  .toFixed(6)
              )
            : null,

        tamano_grande:
          factorResuelto?.tamanoGrande ??
          false,

        mejora_precio_desde_cantidad:
          mejoraPrecioDesdeCantidad,


        // ----------------------------------------------
        // Auditor├¡a antes de redondeo
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

        precio_total_antes_minimo:
          Number(
            totalRedondeado
              .toFixed(2)
          ),

        precio_minimo_detalle:
          REGLAS_PRECIO
            .PRECIO_MINIMO_DETALLE,

        precio_minimo_aplicado:
          precioMinimoAplicado,


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
