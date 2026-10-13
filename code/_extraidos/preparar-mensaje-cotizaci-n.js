// ======================================================
// N8N NODE - PEGASO
// ======================================================
// Nombre: Preparar mensaje cotizaci├│n
// Node ID: 68a0eb70-195a-4a1b-bb2d-833a7cb45967
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
// PREPARAR MENSAJE COTIZACI├ôN
// PEGASO ADHESIVOS - V2.6
// ======================================================
//
// Objetivo:
//
// Construir el mensaje FINAL que recibe el prospecto
// despu├®s de calcular una cotizaci├│n v├ílida.
//
// CONTRATO:
//
// Este nodo y "Construir mensaje no producible"
// deben entregar una estructura compatible para que
// ambos puedan converger en:
//
// "Construir mensaje comercial"
//      Ôåô
// "Guardar mensaje comercial"
//
// REGLAS DE PRESENTACI├ôN:
//
// 1. No mostrar nombre largo del producto.
// 2. Usar siempre "Etiquetas adhesivas".
// 3. No mostrar l├¡nea "Total".
// 4. No mostrar "IVA incluido".
// 5. No repetir informaci├│n del material.
// 6. No cerrar siempre con la misma frase.
// 7. Adaptar el cierre seg├║n cotizaciones recientes.
// 8. Mantener mensaje independiente sobre variaci├│n
//    de precio seg├║n medidas.
// 9. NO usar IA para elegir el cierre.
// 10. Mantener compatibilidad con nodos posteriores.
//
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
// 3. RECUPERAR DECISI├ôN COMERCIAL
// ======================================================
//
// Conservamos identidad de conversaci├│n,
// cliente y prospecto para nodos posteriores.
//
// ======================================================

let decision = {};

try {

  decision =
    $('Recuperar decisi├│n comercial')
      .first()
      .json ?? {};

} catch (_) {

  decision = {};

}


// ======================================================
// 4. RECUPERAR CONTEXTO CONVERSACIONAL
// ======================================================
//
// Se utiliza ├║nicamente para mejorar el cierre.
//
// Si este nodo no estuviera disponible por alguna
// raz├│n, la cotizaci├│n debe seguir funcionando.
//
// ======================================================

let contextoIA = {};

try {

  contextoIA =
    $('Preparar contexto IA')
      .first()
      .json ?? {};

} catch (_) {

  contextoIA = {};

}


// ======================================================
// 5. VALIDACIONES
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
// 6. HELPERS GENERALES
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


function textoONull(valor) {

  if (
    valor === undefined ||
    valor === null
  ) {
    return null;
  }

  const limpio =
    String(valor).trim();

  return limpio !== ''
    ? limpio
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
// 7. DESCRIBIR MEDIDA + FORMA
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
  // TROQUELADAS / IRREGULARES
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
// 8. DETECTAR COTIZACIONES RECIENTES
// ======================================================
//
// "Preparar contexto IA" ya entrega:
//
// mensajes_salientes_recientes
//
// No contamos toda la historia de la conversaci├│n.
// Solo la ventana reciente que ya decidi├│ ese nodo.
//
// ======================================================

function pareceCotizacion(texto) {

  const t =
    String(
      texto ?? ''
    )
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();

  if (!t) {
    return false;
  }

  // Patr├│n principal que usamos actualmente.
  if (
    t.includes(
      'le adjunto la cotizaci├│n'
    )
  ) {
    return true;
  }

  // Fallback por si posteriormente cambia ligeramente
  // el encabezado de la respuesta.
  if (
    t.includes('etiquetas adhesivas') &&
    (
      t.includes('le saldr├¡an en') ||
      t.includes('le saldrian en')
    ) &&
    t.includes('$')
  ) {
    return true;
  }

  return false;

}


function obtenerMensajesSalientesRecientes() {

  if (
    Array.isArray(
      contextoIA.mensajes_salientes_recientes
    )
  ) {

    return contextoIA
      .mensajes_salientes_recientes
      .map(textoONull)
      .filter(Boolean);

  }

  return [];

}


const mensajesSalientesRecientes =
  obtenerMensajesSalientesRecientes();


const cotizacionesRecientes =
  mensajesSalientesRecientes.filter(
    pareceCotizacion
  );


const cantidadCotizacionesRecientes =
  cotizacionesRecientes.length;


// ======================================================
// 9. RESOLVER CIERRE DE COTIZACI├ôN
// ======================================================
//
// IMPORTANTE:
//
// Esta l├│gica es DETERMIN├ìSTICA.
//
// No queremos que el LLM improvise el cierre de
// una cotizaci├│n.
//
// La cantidad representa cotizaciones PREVIAS,
// ya que la actual todav├¡a no se ha guardado.
//
// ======================================================

function resolverCierreCotizacion({
  cantidadCotizacionesPrevias,
  cantidadDetallesActuales
}) {

  const multiplesOpcionesActuales =
    cantidadDetallesActuales > 1;


  // ----------------------------------------------------
  // PRIMERA COTIZACI├ôN RECIENTE
  // ----------------------------------------------------

  if (
    cantidadCotizacionesPrevias <= 0
  ) {

    if (multiplesOpcionesActuales) {

      return (
        'Le dejo estas opciones para que pueda compararlas. ' +
        'Si ya cuenta con su dise├▒o, adj├║ntenoslo para verificarlo por favor.'
      );

    }

    return (
      'Adj├║ntenos su dise├▒o para verificarle por favor.'
    );

  }


  // ----------------------------------------------------
  // YA EXISTE 1 COTIZACI├ôN PREVIA
  // ----------------------------------------------------

  if (
    cantidadCotizacionesPrevias === 1
  ) {

    if (multiplesOpcionesActuales) {

      return (
        'Si desea revisar otra medida tambi├®n podemos cotiz├írsela.'
      );

    }

    return (
      'Si desea, tambi├®n podemos revisarle otra medida ' +
      'para que pueda comparar opciones.'
    );

  }


  // ----------------------------------------------------
  // YA EXISTEN 2 COTIZACIONES PREVIAS
  // ----------------------------------------------------

  if (
    cantidadCotizacionesPrevias === 2
  ) {

    if (multiplesOpcionesActuales) {

      return (
        'Verifiquele por favor '
      );

    }

    return (
      'Verifiquele por favor '
    );

  }


  // ----------------------------------------------------
  // 3 O M├üS COTIZACIONES PREVIAS
  // ----------------------------------------------------

  return (
    'Veo que estamos comparando varias alternativas. ' +
    'Si gusta, ind├¡quenos cu├íles son sus opciones favoritas ' +
    'y le ayudamos a definir la m├ís conveniente.'
  );

}


// ======================================================
// 10. DATOS GENERALES
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
// 11. DETECTAR AJUSTE DE CANTIDAD
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
// 12. CONSTRUIR MENSAJE PRINCIPAL
// ======================================================

let mensaje =
  `Le adjunto la cotizaci├│n:\n\n`;


// ======================================================
// 13. ACLARACI├ôN DE CANTIDAD
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
          )} ÔåÆ ` +
          `${cantidadTexto(
            d.cantidad
          )}`
        );

      }
    );


  mensaje +=
    `Trabajamos ├║nicamente en m├║ltiplos de 1000 unidades, ` +
    `por lo que las cantidades solicitadas podr├¡an ser: ` +
    `${ajustes.join(', ')}.\n\n`;

}


// ======================================================
// 14. DETALLES DE COTIZACI├ôN
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
      `le saldr├¡an en ${precio} d├│lares\n`;

  }
);


// ======================================================
// 15. CIERRE DIN├üMICO
// ======================================================

const cierreCotizacion =
  resolverCierreCotizacion({

    cantidadCotizacionesPrevias:
      cantidadCotizacionesRecientes,

    cantidadDetallesActuales:
      detalles.length

  });


mensaje +=
  `\n${cierreCotizacion}`;


// ======================================================
// 16. MENSAJE INDEPENDIENTE DE VARIACI├ôN DE PRECIO
// ======================================================
//
// Se mantiene exactamente como concepto independiente.
//
// Esto conserva compatibilidad con el flujo actual.
//
// ======================================================

const mensajeVariacionPrecio =
  'El precio se calcula en base a las medidas de la etiqueta. ' +
  'Si aumenta o disminuye las medidas, el precio tambi├®n var├¡a.';


// ======================================================
// 17. SALIDA
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
      // Cotizaci├│n
      // ----------------------------------------------

      cotizacion_id:
        resumen.cotizacion_id ??
        resumen.id ??
        null,

      total,

      cantidad_detalles:
        detalles.length,


      // ----------------------------------------------
      // Mensajer├¡a
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
      // Informaci├│n del cierre
      // ----------------------------------------------
      //
      // Estos campos son informativos.
      // No rompen contratos posteriores.
      //
      // Nos servir├ín para diagn├│stico y futuras reglas.
      // ----------------------------------------------

      cierre_cotizacion:
        cierreCotizacion,

      cotizaciones_recientes_detectadas:
        cantidadCotizacionesRecientes,

      multiples_opciones_en_cotizacion:
        detalles.length > 1,


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
