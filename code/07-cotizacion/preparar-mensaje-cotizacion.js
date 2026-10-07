// ======================================================
// NODO N8N: Preparar mensaje cotización
// ARCHIVO: code/07-cotizacion/preparar-mensaje-cotizacion.js
// VERSION: 2.5
// RESPONSABILIDAD:
// - Construir el mensaje final de cotización válida con una línea por detalle ("-N Etiquetas adhesivas de <medida/forma> le saldrían en $X dólares")
// - Aclarar el ajuste a múltiplos de 1000 cuando se aplicó mínimo sobre una cantidad indicada por el cliente
// - Cerrar solicitando el diseño, sin línea "Total", sin "IVA incluido" ni nombre largo de producto/material
// - Generar un segundo mensaje independiente sobre la variación del precio según medidas
// - Entregar el contrato común (tipo COTIZACION, mensajes_comerciales, identidad desde "Recuperar decisión comercial") para "Construir mensaje comercial"
// - NO calcular precios (usa "Recuperar detalles calculados" y el resumen de "Update rows in a table")
// - NO enviar ni guardar el mensaje (lo hacen "Guardar mensaje comercial" y "Preparar envío WhatsApp")
// ======================================================


// ======================================================
// 1. RECUPERAR RESUMEN
// ======================================================

const resumen =
  $('Update rows in a table')
    .first()
    .json;


// ======================================================
// 2. RECUPERAR DETALLES CALCULADOS
// ======================================================

const detalles =
  $('Recuperar detalles calculados')
    .all()
    .map(
      item => item.json
    );


// ======================================================
// 3. RECUPERAR CONTEXTO COMERCIAL
// ======================================================
//
// Necesitamos conservar identidad de conversación,
// cliente y prospecto para los nodos posteriores.
//
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
// 4. VALIDACIONES
// ======================================================

if (
  !Array.isArray(detalles) ||
  detalles.length === 0
) {

  throw new Error(
    'No existen detalles calculados para construir el mensaje comercial.'
  );

}


// ======================================================
// 5. HELPERS
// ======================================================

function numero(valor) {

  const n =
    Number(
      valor ?? 0
    );

  return Number.isFinite(n)
    ? n
    : 0;

}


function numeroONull(valor) {

  if (
    valor === undefined ||
    valor === null ||
    valor === ''
  ) {
    return null;
  }

  const n =
    Number(valor);

  return Number.isFinite(n)
    ? n
    : null;

}


// ------------------------------------------------------
// DINERO
// ------------------------------------------------------

function dinero(valor) {

  return `$${numero(valor).toFixed(2)}`;

}


// ------------------------------------------------------
// CANTIDAD
// ------------------------------------------------------

function cantidadTexto(valor) {

  return numero(valor)
    .toLocaleString(
      'es-EC'
    );

}


// ------------------------------------------------------
// MEDIDA
// ------------------------------------------------------

function medidaTexto(valor) {

  const n =
    numero(valor);

  if (
    Number.isInteger(n)
  ) {

    return String(n);

  }

  return String(
    Number(
      n.toFixed(2)
    )
  );

}


// ======================================================
// 6. DESCRIBIR MEDIDA + FORMA
// ======================================================

function describirForma(detalle) {

  const forma =
    String(
      detalle.forma ||
      'RECTANGULAR'
    )
      .trim()
      .toUpperCase();


  const ancho =
    medidaTexto(
      detalle.ancho_cm
    );


  const alto =
    medidaTexto(
      detalle.alto_cm
    );


  // ----------------------------------------------------
  // CIRCULAR
  // ----------------------------------------------------

  if (
    forma === 'CIRCULAR'
  ) {

    return `${ancho} cm circulares`;

  }


  // ----------------------------------------------------
  // REDONDEADAS
  // ----------------------------------------------------

  if (
    forma === 'REDONDEADA' ||
    forma === 'REDONDEADO' ||
    forma === 'PUNTAS_REDONDEADAS'
  ) {

    return (
      `${ancho}x${alto} cm ` +
      `con puntas redondeadas`
    );

  }


  // ----------------------------------------------------
  // TROQUELADAS
  // ----------------------------------------------------

  if (
    forma === 'TROQUELADA' ||
    forma === 'TROQUELADO' ||
    forma === 'IRREGULAR'
  ) {

    return (
      `${ancho}x${alto} cm ` +
      `troqueladas`
    );

  }


  // ----------------------------------------------------
  // RECTANGULAR / CUADRADA
  // ----------------------------------------------------

  return (
    `${ancho}x${alto} cm ` +
    `rectangulares`
  );

}


// ======================================================
// 7. DATOS GENERALES
// ======================================================

const total =
  numero(
    resumen.total
  );


const conversacionId =
  numeroONull(
    decision.conversacion_id
  );


const clienteId =
  numeroONull(
    decision.cliente_id
  );


const prospectoId =
  numeroONull(
    decision.prospecto_id
  );


// ======================================================
// 8. DETECTAR AJUSTE DE CANTIDAD
// ======================================================

const detallesCantidadAjustada =
  detalles.filter(
    d =>
      Boolean(
        d.minimo_aplicado
      ) &&
      !Boolean(
        d.cantidad_asumida
      ) &&
      d.cantidad_original !== null &&
      d.cantidad_original !== undefined
  );


const huboAjusteCantidad =
  detallesCantidadAjustada.length > 0;


// ======================================================
// 9. CONSTRUIR MENSAJE PRINCIPAL
// ======================================================

let mensaje =
  `Le adjunto la cotización:\n\n`;


// ======================================================
// 10. ACLARACIÓN DE CANTIDAD
// ======================================================

if (
  huboAjusteCantidad
) {

  const ajustes =
    detallesCantidadAjustada.map(
      d => {

        return (
          `${cantidadTexto(
            d.cantidad_original
          )} → ` +
          `${cantidadTexto(
            d.cantidad
          )}`
        );

      }
    );


  mensaje +=
    `Trabajamos únicamente en múltiplos de 1000 unidades, ` +
    `por lo que las cantidades solicitadas se ajustan así: ` +
    `${ajustes.join(', ')}.\n\n`;

}


// ======================================================
// 11. DETALLES DE COTIZACIÓN
// ======================================================

detalles.forEach(
  (detalle) => {

    const cantidad =
      cantidadTexto(
        detalle.cantidad
      );


    const medidaForma =
      describirForma(
        detalle
      );


    const precio =
      dinero(
        detalle.total ??
        detalle.precio_total
      );


    mensaje +=
      `-${cantidad} Etiquetas adhesivas ` +
      `de ${medidaForma} ` +
      `le saldrían en ${precio} dólares\n`;

  }
);


// ======================================================
// 12. CIERRE
// ======================================================

mensaje +=
  `\nAdjúntenos su diseño para verificarle por favor`;


// ======================================================
// 13. MENSAJE INDEPENDIENTE DE VARIACIÓN DE PRECIO
// ======================================================

const mensajeVariacionPrecio =
  'El precio se calcula en base a las medidas de la etiqueta. ' +
  'Si aumenta o disminuye las medidas, el precio también varía.';


// ======================================================
// 14. SALIDA
// ======================================================

return [
  {
    json: {

      // ----------------------------------------------
      // Identidad
      // ----------------------------------------------

      conversacion_id:
        conversacionId,

      cliente_id:
        clienteId,

      prospecto_id:
        prospectoId,


      // ----------------------------------------------
      // Tipo
      // ----------------------------------------------

      tipo_respuesta_comercial:
        'COTIZACION',


      // ----------------------------------------------
      // Cotización
      // ----------------------------------------------

      cotizacion_id:
        resumen.cotizacion_id ??
        resumen.id ??
        null,

      total,

      cantidad_detalles:
        detalles.length,


      // ----------------------------------------------
      // Mensajería
      // ----------------------------------------------

      mensaje_comercial:
        mensaje,

      mensaje_variacion_precio:
        mensajeVariacionPrecio,

      mensajes_comerciales: [
        mensaje,
        mensajeVariacionPrecio
      ],

      cantidad_mensajes_comerciales:
        2,


      // ----------------------------------------------
      // Control
      // ----------------------------------------------

      cotizacion_producible:
        true,

      bloquear_cotizacion:
        false,

      respuesta_comercial_lista:
        true

    }
  }
];