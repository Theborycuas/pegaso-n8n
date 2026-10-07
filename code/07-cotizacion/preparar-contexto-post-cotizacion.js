// ======================================================
// PREPARAR CONTEXTO POST COTIZACIÓN
// PEGASO ADHESIVOS - V2.6
// ======================================================
//
// OBJETIVO:
//
// Actualizar contexto_comercial después del intento
// de cotización.
//
// IMPORTANTE:
//
// Existen DOS resultados posibles:
//
// 1. COTIZACIÓN PRODUCIBLE
// 2. COTIZACIÓN NO PRODUCIBLE
//
// Este nodo NO puede asumir que:
// "Preparar mensaje cotización"
// siempre fue ejecutado.
//
// Tampoco debe marcar como COTIZADO a un prospecto
// cuando las medidas no son producibles.
//
// PostgreSQL continúa siendo la fuente de verdad.
// ======================================================


// ======================================================
// 1. HELPERS
// ======================================================

function numeroONull(valor) {

    if (
      valor === undefined ||
      valor === null ||
      valor === ''
    ) {
      return null;
    }
  
    const n = Number(valor);
  
    return Number.isFinite(n)
      ? n
      : null;
  }
  
  
  function textoONull(valor) {
  
    if (
      valor === undefined ||
      valor === null
    ) {
      return null;
    }
  
    const texto =
      String(valor).trim();
  
    return texto !== ''
      ? texto
      : null;
  }
  
  
  function objeto(valor) {
  
    if (
      valor &&
      typeof valor === 'object' &&
      !Array.isArray(valor)
    ) {
      return valor;
    }
  
    if (typeof valor === 'string') {
  
      try {
  
        const parsed =
          JSON.parse(valor);
  
        if (
          parsed &&
          typeof parsed === 'object' &&
          !Array.isArray(parsed)
        ) {
          return parsed;
        }
  
      } catch (_) {
        // Ignorar
      }
    }
  
    return {};
  }
  
  
  // ======================================================
  // 2. RECUPERAR DECISIÓN COMERCIAL
  // ======================================================
  
  let decision = {};
  
  try {
  
    decision =
      $('Recuperar decisión comercial')
        .first()
        .json ?? {};
  
  } catch (_) {
  
    decision = {};
  
  }
  
  
  // ======================================================
  // 3. RECUPERAR CONTEXTO COMERCIAL ANTERIOR
  // ======================================================
  
  let contextoAnterior = {};
  
  try {
  
    const resolver =
      $('Resolver contexto comercial')
        .first()
        .json ?? {};
  
    contextoAnterior =
      objeto(
        resolver.contexto_comercial
      );
  
  } catch (_) {
  
    contextoAnterior = {};
  
  }
  
  
  // ======================================================
  // 4. RECUPERAR RESULTADO DE COTIZACIÓN
  // ======================================================
  //
  // Nunca acceder directamente a un nodo que quizá
  // no se ejecutó.
  //
  // Intentamos primero cotización normal.
  // Después cotización no producible.
  //
  // ======================================================
  
  let resultadoComercial = null;
  
  
  // ------------------------------------------------------
  // 4.1 COTIZACIÓN PRODUCIBLE
  // ------------------------------------------------------
  
  try {
  
    if (
      $('Preparar mensaje cotización')
        .isExecuted
    ) {
  
      resultadoComercial =
        $('Preparar mensaje cotización')
          .first()
          .json ?? null;
  
    }
  
  } catch (_) {
  
    resultadoComercial = null;
  
  }
  
  
  // ------------------------------------------------------
  // 4.2 RESPUESTA NO PRODUCIBLE
  // ------------------------------------------------------
  
  if (!resultadoComercial) {
  
    try {
  
      if (
        $('Construir mensaje no producible')
          .isExecuted
      ) {
  
        resultadoComercial =
          $('Construir mensaje no producible')
            .first()
            .json ?? null;
  
      }
  
    } catch (_) {
  
      resultadoComercial = null;
  
    }
  
  }
  
  
  // ======================================================
  // 5. FALLBACK
  // ======================================================
  //
  // Como protección adicional:
  //
  // "Guardar mensaje comercial" sí está en la ruta común,
  // pero el INSERT normalmente devuelve la fila DB y puede
  // no conservar todos los campos comerciales.
  //
  // Por eso solamente lo utilizamos como fallback.
  //
  // ======================================================
  
  if (!resultadoComercial) {
  
    try {
  
      resultadoComercial =
        $('Guardar mensaje comercial')
          .first()
          .json ?? {};
  
    } catch (_) {
  
      resultadoComercial = {};
  
    }
  
  }
  
  
  // ======================================================
  // 6. IDENTIDAD
  // ======================================================
  
  const conversacionId =
    numeroONull(
      decision.conversacion_id
    );
  
  const prospectoId =
    numeroONull(
      decision.prospecto_id
    );
  
  const clienteId =
    numeroONull(
      decision.cliente_id
    );
  
  const contactoId =
    numeroONull(
      decision.contacto_id
    );
  
  
  if (
    conversacionId === null ||
    conversacionId <= 0
  ) {
  
    throw new Error(
      'Preparar contexto post cotización: conversacion_id inválido.'
    );
  
  }
  
  
  // ======================================================
  // 7. DETERMINAR TIPO DE RESULTADO
  // ======================================================
  //
  // Aceptamos diferentes banderas para mantener
  // compatibilidad entre versiones.
  //
  // ======================================================
  
  const tipoRespuesta =
    (
      textoONull(
        resultadoComercial?.tipo_respuesta_comercial
      ) ??
      ''
    ).toUpperCase();
  
  
  const cotizacionProducible =
    resultadoComercial?.cotizacion_producible === true ||
    tipoRespuesta === 'COTIZACION';
  
  
  const cotizacionNoProducible =
    resultadoComercial?.cotizacion_producible === false ||
    resultadoComercial?.bloquear_cotizacion === true ||
    tipoRespuesta === 'NO_PRODUCIBLE';
  
  
  // ======================================================
  // 8. DATOS DEL PEDIDO ACTUAL
  // ======================================================
  
  const cotizacionAnterior =
    objeto(
      contextoAnterior.cotizacion
    );
  
  
  const producto =
    decision.producto ??
    cotizacionAnterior.producto ??
    null;
  
  
  const material =
    decision.material ??
    cotizacionAnterior.material ??
    null;
  
  
  const cantidadSolicitada =
    decision.cantidad_solicitada ??
    decision.cantidad ??
    cotizacionAnterior.cantidad_solicitada ??
    null;
  
  
  const cantidadCotizable =
    decision.cantidad_cotizable ??
    decision.cantidad ??
    cotizacionAnterior.cantidad_cotizable ??
    null;
  
  
  const cantidadAjustada =
    decision.cantidad_ajustada ??
    cotizacionAnterior.cantidad_ajustada ??
    false;
  
  
  const anchoCm =
    decision.ancho_cm ??
    cotizacionAnterior.ancho_cm ??
    null;
  
  
  const altoCm =
    decision.alto_cm ??
    cotizacionAnterior.alto_cm ??
    null;
  
  
  const forma =
    decision.forma ??
    cotizacionAnterior.forma ??
    'NO_ESPECIFICADA';
  
  
  // ======================================================
  // 9. MENSAJE COMERCIAL
  // ======================================================
  
  const mensajeComercial =
    textoONull(
      resultadoComercial?.mensaje_comercial
    ) ??
    '';
  
  
  // ======================================================
  // 10. COTIZACIÓN PRODUCIBLE
  // ======================================================
  
  if (cotizacionProducible) {
  
    const cotizacionId =
      numeroONull(
        resultadoComercial.cotizacion_id
      );
  
    const total =
      numeroONull(
        resultadoComercial.total
      );
  
  
    if (
      cotizacionId === null ||
      cotizacionId <= 0
    ) {
  
      throw new Error(
        'Preparar contexto post cotización: cotización producible sin cotizacion_id válido.'
      );
  
    }
  
  
    if (
      total === null ||
      total < 0
    ) {
  
      throw new Error(
        'Preparar contexto post cotización: cotización producible sin total válido.'
      );
  
    }
  
  
    const contextoNuevo = {
  
      ...contextoAnterior,
  
      cotizacion: {
  
        ...cotizacionAnterior,
  
        cotizacion_id:
          cotizacionId,
  
        producto,
  
        material,
  
        cantidad_solicitada:
          cantidadSolicitada,
  
        cantidad_cotizable:
          cantidadCotizable,
  
        cantidad_ajustada:
          Boolean(
            cantidadAjustada
          ),
  
        ancho_cm:
          anchoCm,
  
        alto_cm:
          altoCm,
  
        forma,
  
        total,
  
        cantidad_detalles:
          Number(
            resultadoComercial.cantidad_detalles ?? 0
          ),
  
        estado:
          'COTIZADA',
  
        cotizada_at:
          new Date().toISOString(),
  
        ultimo_intento_producible:
          true,
  
        ultimo_error_produccion:
          null
      }
  
    };
  
  
    return [
      {
        json: {
  
          conversacion_id:
            conversacionId,
  
          prospecto_id:
            prospectoId,
  
          cliente_id:
            clienteId,
  
          contacto_id:
            contactoId,
  
          cotizacion_id:
            cotizacionId,
  
          total,
  
          mensaje_comercial:
            mensajeComercial,
  
          contexto_comercial:
            contextoNuevo,
  
          cotizacion_generada:
            true,
  
          cotizacion_producible:
            true,
  
          bloquear_cotizacion:
            false,
  
          estado_comercial:
            'COTIZADO',
  
          actualizar_estado_prospecto:
            true
        }
      }
    ];
  
  }
  
  
  // ======================================================
  // 11. COTIZACIÓN NO PRODUCIBLE
  // ======================================================
  //
  // MUY IMPORTANTE:
  //
  // No debemos:
  //
  // - marcar COTIZADO
  // - fingir que existe una cotización
  // - sobrescribir la última cotización válida
  //
  // Sí guardamos memoria del intento.
  //
  // ======================================================
  
  if (cotizacionNoProducible) {
  
    const motivoNoProducible =
      textoONull(
        resultadoComercial.motivo_no_producible
      ) ??
      textoONull(
        resultadoComercial.motivo
      ) ??
      'MEDIDAS_NO_PRODUCIBLES';
  
  
    const contextoNuevo = {
  
      ...contextoAnterior,
  
      cotizacion: {
  
        ...cotizacionAnterior,
  
        producto,
  
        material,
  
        cantidad_solicitada:
          cantidadSolicitada,
  
        cantidad_cotizable:
          cantidadCotizable,
  
        cantidad_ajustada:
          Boolean(
            cantidadAjustada
          ),
  
        ancho_cm:
          anchoCm,
  
        alto_cm:
          altoCm,
  
        forma,
  
        ultimo_intento_producible:
          false,
  
        ultimo_error_produccion:
          motivoNoProducible,
  
        ultimo_intento_at:
          new Date().toISOString()
      }
  
    };
  
  
    return [
      {
        json: {
  
          conversacion_id:
            conversacionId,
  
          prospecto_id:
            prospectoId,
  
          cliente_id:
            clienteId,
  
          contacto_id:
            contactoId,
  
          cotizacion_id:
            null,
  
          total:
            null,
  
          mensaje_comercial:
            mensajeComercial,
  
          contexto_comercial:
            contextoNuevo,
  
          cotizacion_generada:
            false,
  
          cotizacion_producible:
            false,
  
          bloquear_cotizacion:
            true,
  
          motivo_no_producible:
            motivoNoProducible,
  
          // NO convertirlo a COTIZADO
          estado_comercial:
            decision.prospecto_estado ??
            'EN_CONVERSACION',
  
          actualizar_estado_prospecto:
            false
        }
      }
    ];
  
  }
  
  
  // ======================================================
  // 12. ESTADO INDETERMINADO
  // ======================================================
  
  throw new Error(
    'Preparar contexto post cotización: no se pudo determinar si el resultado comercial fue producible o no producible.'
  );