// ======================================================
// N8N NODE - PEGASO
// ======================================================
// Nombre: Preparar mensaje cotización
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
// PREPARAR MENSAJE COTIZACIÓN
// PEGASO ADHESIVOS - V2.13
// ======================================================
//
// V2.13: si "Aplicar mínimo de impresión" unió la misma
// medida de varios diseños, la línea dice "(3 diseños de
// 1.000 cada uno)" y el precio es el de la cantidad total.
//
// V2.12: si el diseño ya llegó antes de cotizar y la ciudad
// se conoce, la primera cotización cierra con "¿Usted cuenta
// con el diseño original editable disculpe?" en vez de
// pedir el diseño otra vez.
//
// V2.11: la primera cotización cierra con "¿Desde qué
// ciudad nos escribe disculpe?" si la ciudad no se conoce
// y no se preguntó antes. Si ya se conoce, sigue pidiendo
// el diseño.
//
// V2.10: si hay mix etiquetas + flyers/tarjetas, se
// anexa el bloque de catálogo (con *Precios no incluyen
// IVA*) después de las líneas P4. Las etiquetas no
// llevan IVA.
//
// V2.9: si se recotiza por cambio de cantidad (p. ej.
// "¿con 5000 baja el precio?"), el mensaje abre con
// "Así es, el precio se calcula en base a las medidas
// y cantidades." antes de la cotización.
//
// V2.8: el cierre "Veo que estamos comparando varias
// alternativas..." se envía una sola vez. Si ya está en
// los salientes recientes, las cotizaciones siguientes
// cierran con "Verifíquele a detalle por favor."
//
// V2.7: si un detalle supera el minimo de su rango de
// cantidad y "Calcular precio detalle" indica una
// mejora real en el siguiente rango, se informa desde
// que cantidad mejora el precio (sin calcularlo aqui).
//
// ======================================================
//
// Objetivo:
//
// Construir el mensaje FINAL que recibe el prospecto
// después de calcular una cotización válida.
//
// CONTRATO:
//
// Este nodo y "Construir mensaje no producible"
// deben entregar una estructura compatible para que
// ambos puedan converger en:
//
// "Construir mensaje comercial"
//      ↓
// "Guardar mensaje comercial"
//
// REGLAS DE PRESENTACIÓN:
//
// 1. No mostrar nombre largo del producto.
// 2. Usar siempre "Etiquetas adhesivas".
// 3. No mostrar línea "Total".
// 4. No mostrar "IVA incluido".
// 5. No repetir información del material.
// 6. No cerrar siempre con la misma frase.
// 7. Adaptar el cierre según cotizaciones recientes.
// 8. Mantener mensaje independiente sobre variación
//    de precio según medidas.
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
// 3. RECUPERAR DECISIÓN COMERCIAL
// ======================================================
//
// Conservamos identidad de conversación,
// cliente y prospecto para nodos posteriores.
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
// 4. RECUPERAR CONTEXTO CONVERSACIONAL
// ======================================================
//
// Se utiliza únicamente para mejorar el cierre.
//
// Si este nodo no estuviera disponible por alguna
// razón, la cotización debe seguir funcionando.
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
// No contamos toda la historia de la conversación.
// Solo la ventana reciente que ya decidió ese nodo.
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

  // Patrón principal que usamos actualmente.
  if (
    t.includes(
      'le adjunto la cotización'
    )
  ) {
    return true;
  }

  // Fallback por si posteriormente cambia ligeramente
  // el encabezado de la respuesta.
  if (
    t.includes('etiquetas adhesivas') &&
    (
      t.includes('le saldrían en') ||
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


const CIERRE_COMPARACION =
  'Veo que estamos comparando varias alternativas. ' +
  'Si gusta, indíquenos cuáles son sus opciones favoritas ' +
  'y le ayudamos a definir la más conveniente.';

const cierreComparacionYaEnviado =
  mensajesSalientesRecientes.some(
    texto =>
      texto
        .toLowerCase()
        .includes('comparando varias alternativas')
  );


// ------------------------------------------------------
// CIUDAD (V2.11)
// ------------------------------------------------------
//
// La primera cotización cierra preguntando la ciudad si
// todavía no se conoce: engancha mejor que pedir el
// diseño. La respuesta del cliente la atiende el cerebro
// (sección 16 del prompt) y ahí se pide el diseño.
// Se pregunta una sola vez: si ya se preguntó en los
// salientes recientes, se usa el cierre normal.
//
// ------------------------------------------------------

const PREGUNTA_CIUDAD =
  '¿Desde qué ciudad nos escribe disculpe?';

const ciudadConocida =
  textoONull(decision.prospecto_ciudad) ??
  textoONull(decision.ciudad_detectada) ??
  textoONull(contextoIA.prospecto_ciudad) ??
  textoONull(decision.contexto_comercial?.ubicacion?.ciudad) ??
  textoONull(contextoIA.contexto_comercial?.ubicacion?.ciudad);

function normalizarPlano(texto) {
  return String(texto ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

const ciudadYaPreguntada =
  mensajesSalientesRecientes.some(
    texto =>
      /desde que ciudad nos escribe|de que ciudad nos escribe/.test(
        normalizarPlano(texto)
      )
  );

const preguntarCiudad =
  !ciudadConocida &&
  !ciudadYaPreguntada;

// V2.12: si el diseño ya llegó (imagen, archivo o link),
// no se vuelve a pedir: se pregunta por el editable.
const PREGUNTA_EDITABLE =
  '¿Usted cuenta con el diseño original editable disculpe?';

const disenoYaRecibido =
  textoONull(decision.contexto_comercial?.diseno_recibido?.recibido_at) !== null &&
  !['METODOLOGIA_ENVIADA', 'ARCHIVO_FINAL_RECIBIDO', 'ESPERA_EDITABLE'].includes(
    decision.contexto_comercial?.diseno_recibido?.paso
  );


// ======================================================
// 9. RESOLVER CIERRE DE COTIZACIÓN
// ======================================================
//
// IMPORTANTE:
//
// Esta lógica es DETERMINÍSTICA.
//
// No queremos que el LLM improvise el cierre de
// una cotización.
//
// La cantidad representa cotizaciones PREVIAS,
// ya que la actual todavía no se ha guardado.
//
// ======================================================

function resolverCierreCotizacion({
  cantidadCotizacionesPrevias,
  cantidadDetallesActuales
}) {

  const multiplesOpcionesActuales =
    cantidadDetallesActuales > 1;


  // ----------------------------------------------------
  // PRIMERA COTIZACIÓN RECIENTE
  // ----------------------------------------------------

  if (
    cantidadCotizacionesPrevias <= 0
  ) {

    if (preguntarCiudad) {

      return multiplesOpcionesActuales
        ? 'Le dejo estas opciones para que pueda compararlas. ' + PREGUNTA_CIUDAD
        : PREGUNTA_CIUDAD;

    }

    if (disenoYaRecibido) {

      return multiplesOpcionesActuales
        ? 'Le dejo estas opciones para que pueda compararlas. ' + PREGUNTA_EDITABLE
        : PREGUNTA_EDITABLE;

    }

    if (multiplesOpcionesActuales) {

      return (
        'Le dejo estas opciones para que pueda compararlas. ' +
        'Si ya cuenta con su diseño, adjúntenoslo para verificarlo por favor.'
      );

    }

    return (
      'Adjúntenos su diseño para verificarle por favor.'
    );

  }


  // ----------------------------------------------------
  // YA EXISTE 1 COTIZACIÓN PREVIA
  // ----------------------------------------------------

  if (
    cantidadCotizacionesPrevias === 1
  ) {

    if (multiplesOpcionesActuales) {

      return (
        'Si desea revisar otra medida también podemos cotizársela.'
      );

    }

    return (
      'Si desea, también podemos revisarle otra medida ' +
      'para que pueda comparar opciones.'
    );

  }


  // ----------------------------------------------------
  // YA EXISTEN 2 COTIZACIONES PREVIAS
  // ----------------------------------------------------

  if (
    cantidadCotizacionesPrevias === 2
  ) {

    return (
      'Verifíquele por favor.'
    );

  }


  // ----------------------------------------------------
  // 3 O MÁS COTIZACIONES PREVIAS
  // ----------------------------------------------------
  //
  // La invitación a elegir favoritas va una sola vez
  // dentro de la ventana de salientes recientes.
  // ----------------------------------------------------

  if (!cierreComparacionYaEnviado) {

    return CIERRE_COMPARACION;

  }

  return (
    'Verifíquele a detalle por favor.'
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

const explicarCalculoPrecioCantidad =
  decision.explicar_calculo_precio_cantidad === true;

let mensaje =
  (
    explicarCalculoPrecioCantidad
      ? 'Así es, el precio se calcula en base a las medidas y cantidades.\n\n'
      : ''
  ) +
  `Le adjunto la cotización:\n\n`;


// ======================================================
// 13. ACLARACIÓN DE CANTIDAD
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
    `por lo que las cantidades solicitadas podrían ser: ` +
    `${ajustes.join(', ')}.\n\n`;

}


// ======================================================
// 14. DETALLES DE COTIZACIÓN
// ======================================================

// V2.13: misma medida en varios diseños (unida en "Aplicar
// mínimo de impresión"): se anota "(3 diseños de 1.000
// cada uno)".
let fusionDisenos = [];

try {
  fusionDisenos =
    $('Aplicar mínimo de impresión').first().json?.fusion_disenos ?? [];
} catch (_) {
  fusionDisenos = [];
}

function notaDisenos(detalle) {
  const fusion =
    (Array.isArray(fusionDisenos) ? fusionDisenos : []).find(f =>
      numero(f.ancho_cm) === numero(detalle.ancho_cm) &&
      numero(f.alto_cm) === numero(detalle.alto_cm) &&
      numero(f.cantidad_total) === numero(detalle.cantidad)
    );

  if (!fusion || numero(fusion.disenos) < 2) {
    return '';
  }

  const porDiseno =
    Array.isArray(fusion.cantidades_por_diseno)
      ? fusion.cantidades_por_diseno
      : [];

  const iguales =
    porDiseno.length > 0 &&
    porDiseno.every(c => numero(c) === numero(porDiseno[0]));

  return iguales
    ? ` (${fusion.disenos} diseños de ${cantidadTexto(porDiseno[0])} cada uno)`
    : ` (${fusion.disenos} diseños)`;
}

detalles.forEach(
  (detalle) => {

    const cantidad =
      cantidadTexto(
        detalle.cantidad
      );


    const medidaForma =
      describirForma(
        detalle
      ) +
      notaDisenos(detalle);


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
// 14.1 MEJORA DE PRECIO POR RANGO DE CANTIDAD
// ======================================================

const cantidadesMejora =
  detalles
    .filter(
      d =>
        numeroONull(d.mejora_precio_desde_cantidad) !== null &&
        numeroONull(d.rango_cantidad_desde) !== null &&
        numero(d.cantidad) > numero(d.rango_cantidad_desde)
    )
    .map(
      d => numero(d.mejora_precio_desde_cantidad)
    );


const mejoraPrecioDesdeCantidad =
  cantidadesMejora.length > 0
    ? Math.min(...cantidadesMejora)
    : null;


if (
  mejoraPrecioDesdeCantidad !== null
) {

  mensaje +=
    `\nA partir de ${cantidadTexto(
      mejoraPrecioDesdeCantidad
    )} etiquetas podemos mejorarle el precio.\n`;

}


// ======================================================
// 15. CIERRE DINÁMICO
// ======================================================

const cierreCotizacion =
  resolverCierreCotizacion({

    cantidadCotizacionesPrevias:
      cantidadCotizacionesRecientes,

    cantidadDetallesActuales:
      detalles.length

  });


const anexoCatalogoMixto =
  textoONull(
    decision.anexo_catalogo_mixto
  );

if (anexoCatalogoMixto) {
  mensaje +=
    `\n${anexoCatalogoMixto}\n`;
}

mensaje +=
  `\n${cierreCotizacion}`;


// ======================================================
// 16. MENSAJE INDEPENDIENTE DE VARIACIÓN DE PRECIO
// ======================================================
//
// Se mantiene exactamente como concepto independiente.
//
// Esto conserva compatibilidad con el flujo actual.
//
// ======================================================

const mensajeVariacionPrecio =
  'El precio se calcula en base a las medidas de la etiqueta. ' +
  'Si aumenta o disminuye las medidas, el precio también varía.';


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
      // Información del cierre
      // ----------------------------------------------
      //
      // Estos campos son informativos.
      // No rompen contratos posteriores.
      //
      // Nos servirán para diagnóstico y futuras reglas.
      // ----------------------------------------------

      cierre_cotizacion:
        cierreCotizacion,

      cotizaciones_recientes_detectadas:
        cantidadCotizacionesRecientes,

      cierre_comparacion_ya_enviado:
        cierreComparacionYaEnviado,

      cierre_pregunta_ciudad:
        cierreCotizacion.includes(PREGUNTA_CIUDAD),

      multiples_opciones_en_cotizacion:
        detalles.length > 1,

      mejora_precio_desde_cantidad:
        mejoraPrecioDesdeCantidad,


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
