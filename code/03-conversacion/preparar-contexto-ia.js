// ======================================================
// NODO N8N: Preparar contexto IA
// ARCHIVO: code/03-conversacion/preparar-contexto-ia.js
// VERSION: 2.2
// RESPONSABILIDAD:
// - Construir el contexto que recibirá el cerebro comercial, tomando "Preparar conversación" como fuente de verdad
// - Convertir las filas de "Recuperar historial conversación" en historial (direccion, contenido, tipo, enviado_at), descartando filas sin contenido
// - Extraer los mensajes SALIENTE recientes y el último saliente para control anti-repetición
// - Resolver tipo_actor (respeta el previo; si falta: CLIENTE > PROSPECTO > CONTACTO > DESCONOCIDO)
// - Armar contexto_comercial explícito (prospecto, ubicación, diseño, última cotización con moneda USD por defecto)
// - Derivar la clasificación A/B/C del prospecto desde su estado cuando no viene informada
// - NO llamar a la IA ni decidir la identidad del actor (la IA no la decide)
// - NO consultar PostgreSQL (si las cotizaciones no llegan por "Preparar conversación", hace falta una consulta previa)
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
  
    const limpio = String(valor).trim();
  
    return limpio !== ''
      ? limpio
      : null;
  }
  
  function booleano(valor, defecto = false) {
    if (typeof valor === 'boolean') {
      return valor;
    }
  
    if (valor === 'true' || valor === 1 || valor === '1') {
      return true;
    }
  
    if (valor === 'false' || valor === 0 || valor === '0') {
      return false;
    }
  
    return defecto;
  }
  
  function primeroDefinido(...valores) {
    for (const valor of valores) {
      if (
        valor !== undefined &&
        valor !== null &&
        valor !== ''
      ) {
        return valor;
      }
    }
  
    return null;
  }
  
  function clasificacionDesdeEstado(estado) {
    const valor = textoONull(estado)?.toUpperCase() ?? null;
  
    if (!valor) {
      return null;
    }
  
    if (
      [
        'INTERESADO',
        'ACEPTADO',
        'PAGO_PENDIENTE',
        'ABONO_REPORTADO',
        'EN_PROCESO'
      ].includes(valor)
    ) {
      return 'A';
    }
  
    if (
      [
        'COTIZADO',
        'CALIFICADO',
        'EN_SEGUIMIENTO',
        'CONTACTADO'
      ].includes(valor)
    ) {
      return 'B';
    }
  
    return 'C';
  }
  
  
  // ======================================================
  // 2. RECUPERAR CONTEXTO ACTUAL
  // ======================================================
  
  let actual = {};
  
  try {
    actual =
      $('Preparar conversación').first().json ?? {};
  } catch (error) {
    throw new Error(
      'No se pudo recuperar la salida de "Preparar conversación".'
    );
  }
  
  
  // ======================================================
  // 3. RECUPERAR HISTORIAL
  // ======================================================
  
  const itemsHistorial = $input.all();
  
  const historial = itemsHistorial
    .map(item => item.json)
    .filter(row => {
      if (!row) {
        return false;
      }
  
      const tieneContenido =
        row.contenido !== undefined &&
        row.contenido !== null &&
        String(row.contenido).trim() !== '';
  
      return tieneContenido;
    })
    .map(row => ({
      direccion:
        textoONull(row.direccion),
  
      contenido:
        row.contenido ?? '',
  
      tipo:
        textoONull(row.tipo) ?? 'TEXTO',
  
      enviado_at:
        row.enviado_at ?? null
    }));
  
  
  // ======================================================
  // 3.1. MEMORIA DE RESPUESTAS SALIENTES
  // ======================================================
  //
  // Se usa para:
  // - evitar repetir exactamente el último mensaje;
  // - ayudar al cerebro a no recotizar sin cambios;
  // - mantener continuidad conversacional.
  //
  // No reemplaza PostgreSQL como fuente de verdad.
  // Es solamente una vista del historial reciente.
  // ======================================================
  
  const mensajesSalientesRecientes =
    historial
      .filter(row =>
        String(row.direccion ?? '').toUpperCase() === 'SALIENTE'
      )
      .map(row => String(row.contenido ?? '').trim())
      .filter(Boolean);
  
  const ultimoMensajeSaliente =
    mensajesSalientesRecientes.length > 0
      ? mensajesSalientesRecientes[mensajesSalientesRecientes.length - 1]
      : null;
  
  
  // ======================================================
  // 4. IDENTIDAD DEL ACTOR
  // ======================================================
  
  const clienteId =
    numeroONull(actual.cliente_id);
  
  const contactoId =
    numeroONull(actual.contacto_id);
  
  const prospectoId =
    numeroONull(actual.prospecto_id);
  
  let tipoActor =
    textoONull(actual.tipo_actor);
  
  if (!tipoActor) {
    if (clienteId !== null) {
      tipoActor = 'CLIENTE';
    } else if (prospectoId !== null) {
      tipoActor = 'PROSPECTO';
    } else if (contactoId !== null) {
      tipoActor = 'CONTACTO';
    } else {
      tipoActor = 'DESCONOCIDO';
    }
  }
  
  tipoActor =
    tipoActor.toUpperCase();
  
  
  // ======================================================
  // 5. CONTEXTO COMERCIAL PREVIO
  // ======================================================
  //
  // Si "Preparar conversación" ya trae un objeto
  // contexto_comercial, lo respetamos.
  //
  // Además soportamos campos planos habituales para no
  // depender de una única forma de consulta SQL.
  //
  // IMPORTANTE:
  // si tus cotizaciones NO llegan a "Preparar conversación",
  // habrá que añadir una consulta DB antes de este nodo.
  // ======================================================
  
  const previo =
    actual.contexto_comercial &&
    typeof actual.contexto_comercial === 'object' &&
    !Array.isArray(actual.contexto_comercial)
      ? actual.contexto_comercial
      : {};
  
  const cotizacionPrevia =
    previo.cotizacion &&
    typeof previo.cotizacion === 'object' &&
    !Array.isArray(previo.cotizacion)
      ? previo.cotizacion
      : {};
  
  const cotizacionId =
    numeroONull(
      primeroDefinido(
        actual.cotizacion_id,
        actual.ultima_cotizacion_id,
        cotizacionPrevia.id,
        cotizacionPrevia.cotizacion_id
      )
    );
  
  const cotizacionEstado =
    textoONull(
      primeroDefinido(
        actual.cotizacion_estado,
        actual.ultima_cotizacion_estado,
        cotizacionPrevia.estado
      )
    );
  
  const cotizacionCantidad =
    numeroONull(
      primeroDefinido(
        actual.cotizacion_cantidad,
        actual.ultima_cotizacion_cantidad,
        cotizacionPrevia.cantidad
      )
    );
  
  const cotizacionAncho =
    numeroONull(
      primeroDefinido(
        actual.cotizacion_ancho_cm,
        actual.ultima_cotizacion_ancho_cm,
        cotizacionPrevia.ancho_cm
      )
    );
  
  const cotizacionAlto =
    numeroONull(
      primeroDefinido(
        actual.cotizacion_alto_cm,
        actual.ultima_cotizacion_alto_cm,
        cotizacionPrevia.alto_cm
      )
    );
  
  const cotizacionForma =
    textoONull(
      primeroDefinido(
        actual.cotizacion_forma,
        actual.ultima_cotizacion_forma,
        cotizacionPrevia.forma
      )
    );
  
  const cotizacionPrecio =
    numeroONull(
      primeroDefinido(
        actual.cotizacion_precio_total,
        actual.cotizacion_total,
        actual.ultima_cotizacion_total,
        cotizacionPrevia.precio_total,
        cotizacionPrevia.total
      )
    );
  
  
  // ======================================================
  // 6. PROSPECTO
  // ======================================================
  
  const prospectoEstado =
    textoONull(actual.prospecto_estado);
  
  const prospectoClasificacion =
    textoONull(
      primeroDefinido(
        actual.prospecto_clasificacion,
        previo.prospecto?.clasificacion
      )
    )?.toUpperCase() ??
    clasificacionDesdeEstado(prospectoEstado);
  
  const prospectoCiudad =
    textoONull(
      primeroDefinido(
        actual.prospecto_ciudad,
        previo.ubicacion?.ciudad
      )
    );
  
  const prospectoProvincia =
    textoONull(
      primeroDefinido(
        actual.prospecto_provincia,
        previo.ubicacion?.provincia
      )
    );
  
  const prospectoDisenoEstado =
    textoONull(
      primeroDefinido(
        actual.prospecto_diseno_estado,
        actual.diseno_estado,
        previo.diseno?.estado
      )
    );
  
  
  // ======================================================
  // 7. OBJETO contexto_comercial
  // ======================================================
  
  const contextoComercial = {
    prospecto: {
      id:
        prospectoId,
  
      estado:
        prospectoEstado,
  
      clasificacion:
        prospectoClasificacion,
  
      producto_interes:
        textoONull(actual.prospecto_producto_interes),
  
      requiere_humano:
        booleano(
          actual.prospecto_requiere_humano,
          false
        ),
  
      ultima_intencion:
        textoONull(actual.prospecto_ultima_intencion),
  
      ultima_accion:
        textoONull(actual.prospecto_ultima_accion)
    },
  
    ubicacion: {
      ciudad:
        prospectoCiudad,
  
      provincia:
        prospectoProvincia
    },
  
    diseno: {
      estado:
        prospectoDisenoEstado
    },
  
    cotizacion: {
      existe:
        cotizacionId !== null ||
        Boolean(cotizacionEstado),
  
      id:
        cotizacionId,
  
      estado:
        cotizacionEstado,
  
      cantidad:
        cotizacionCantidad,
  
      ancho_cm:
        cotizacionAncho,
  
      alto_cm:
        cotizacionAlto,
  
      forma:
        cotizacionForma,
  
      precio_total:
        cotizacionPrecio,
  
      moneda:
        textoONull(
          primeroDefinido(
            actual.cotizacion_moneda,
            cotizacionPrevia.moneda,
            'USD'
          )
        )
    }
  };
  
  
  // ======================================================
  // 8. SALIDA
  // ======================================================
  
  return [
    {
      json: {
  
        // ----------------------------------------------
        // CONVERSACIÓN
        // ----------------------------------------------
  
        conversacion_id:
          numeroONull(actual.conversacion_id),
  
        conversacion_estado:
          textoONull(actual.conversacion_estado),
  
        conversacion_nueva:
          booleano(
            actual.conversacion_nueva,
            false
          ),
  
        conversacion_cliente_id:
          numeroONull(actual.conversacion_cliente_id),
  
        conversacion_contacto_id:
          numeroONull(actual.conversacion_contacto_id),
  
        conversacion_prospecto_id:
          numeroONull(actual.conversacion_prospecto_id),
  
  
        // ----------------------------------------------
        // CLIENTE / CONTACTO
        // ----------------------------------------------
  
        cliente_id:
          clienteId,
  
        contacto_id:
          contactoId,
  
        contacto_nombre:
          textoONull(actual.contacto_nombre),
  
        es_cliente_registrado:
          booleano(
            actual.es_cliente_registrado,
            false
          ),
  
  
        // ----------------------------------------------
        // PROSPECTO
        // ----------------------------------------------
  
        prospecto_existe:
          prospectoId !== null ||
          booleano(
            actual.prospecto_existe,
            false
          ),
  
        prospecto_id:
          prospectoId,
  
        prospecto_estado:
          prospectoEstado,
  
        prospecto_clasificacion:
          prospectoClasificacion,
  
        prospecto_nombre:
          textoONull(actual.prospecto_nombre),
  
        prospecto_producto_interes:
          textoONull(actual.prospecto_producto_interes),
  
        prospecto_ciudad:
          prospectoCiudad,
  
        prospecto_provincia:
          prospectoProvincia,
  
        prospecto_diseno_estado:
          prospectoDisenoEstado,
  
        prospecto_ultima_intencion:
          textoONull(actual.prospecto_ultima_intencion),
  
        prospecto_ultima_accion:
          textoONull(actual.prospecto_ultima_accion),
  
        prospecto_requiere_humano:
          booleano(
            actual.prospecto_requiere_humano,
            false
          ),
  
  
        // ----------------------------------------------
        // ACTOR
        // ----------------------------------------------
  
        tipo_actor:
          tipoActor,
  
  
        // ----------------------------------------------
        // MENSAJE ACTUAL
        // ----------------------------------------------
  
        telefono:
          textoONull(actual.telefono),
  
        nombre_whatsapp:
          textoONull(actual.nombre_whatsapp),
  
        mensaje_actual:
          actual.mensaje ?? '',
  
        tipo_mensaje:
          textoONull(actual.tipo) ?? 'TEXTO',
  
        canal:
          textoONull(actual.canal) ?? 'WHATSAPP',
  
        mensaje_externo_id:
          textoONull(actual.mensaje_externo_id),
  
        recibido_at:
          actual.recibido_at ?? null,
  
  
        // ----------------------------------------------
        // CONTEXTO COMERCIAL EXPLÍCITO
        // ----------------------------------------------
  
        contexto_comercial:
          contextoComercial,
  
  
        // ----------------------------------------------
        // HISTORIAL
        // ----------------------------------------------
  
        historial,
  
        cantidad_mensajes_historial:
          historial.length,
  
        // ----------------------------------------------
        // CONTROL ANTI-REPETICIÓN
        // ----------------------------------------------
  
        ultimo_mensaje_saliente:
          ultimoMensajeSaliente,
  
        mensajes_salientes_recientes:
          mensajesSalientesRecientes
      }
    }
  ];
  