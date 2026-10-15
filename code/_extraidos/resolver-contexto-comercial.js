// ======================================================
// N8N NODE - PEGASO
// ======================================================
// Nombre: Resolver contexto comercial
// Node ID: 2453472a-9d65-46d2-9a67-b788aac2fd36
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
// RESOLVER CONTEXTO COMERCIAL - V2.8
// ======================================================
//
// Objetivo:
// - consolidar datos nuevos + contexto persistido;
// - usar 1000 como mínimo por defecto si hay medidas;
// - NO exigir producto para cotizar;
// - NO convertir cualquier mensaje en COTIZAR_P4;
// - preservar acciones informativas como INFORMAR_DISENO;
// - recotizar solo cuando corresponde;
// - tratar ancho + alto como un par atómico cuando ambos vienen en el turno actual;
// - invalidar metadatos de una cotización anterior cuando cambian sus datos base,
//   evitando snapshots híbridos (por ejemplo id/precio viejos con medidas nuevas).
// - V2.4: cantidad cotizable >= 6000 -> DERIVAR_HUMANO (COTIZACION_ESPECIAL)
//   antes de COTIZAR_P4; la IA no puede revertirlo.
// - V2.5: reglas pre-IA de "Preparar contexto IA" (PRODUCTO_NO_P4 ->
//   DERIVAR_HUMANO con regla_derivacion PRODUCTO_NO_P4; SALUDO_SIMPLE);
//   fecha pedida por el cliente -> nunca se promete: se responde con la
//   metodología semanal y se guarda contexto_comercial.fecha_deseada_cliente;
//   PEDIR_MEDIDAS no se repite si las medidas ya se pidieron (solo lo que falta);
//   omitir_envio cuando la automatización de WhatsApp Business ya atendió
//   la misma acción después de iniciado el turno.
// - V2.6: "para 5 diseños / sabores / nombres..." ya no se toma como fecha
//   deseada (la aclaración del mínimo por diseño no se reemplaza por la
//   metodología semanal).
// - V2.7: en turnos de solo texto, una cantidad o medida nueva solo cuenta
//   si el número está escrito en el mensaje ("botella de 500 ml" no es
//   cantidad). No se recotiza sin un cambio real del turno: con cotización
//   vigente sin cambios -> RESPONDER_GENERAL; "otras medidas" -> pide las
//   nuevas medidas; sesión nueva sin datos ni referencia -> no reutiliza la
//   cotización vieja. Si una automatización de WhatsApp Business ya respondió
//   la pregunta informativa del turno, el bot solo pregunta las medidas que
//   faltan (o no envía nada).
// - V2.8: INFORMAR_MATERIAL marca enviar_imagen_material (con
//   imagen_material_url) la primera vez por conversación, si la
//   configuración IMAGEN_MATERIAL está activa con un enlace https;
//   guarda contexto_comercial.imagen_material.enviada_at.
//
// ======================================================

const data = $input.first().json;


// ======================================================
// 1. HELPERS
// ======================================================

function texto(valor) {
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


function numero(valor) {
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


function igualesNumero(a, b) {
  const na = numero(a);
  const nb = numero(b);

  if (na === null || nb === null) {
    return false;
  }

  return Math.abs(na - nb) < 0.000001;
}


// ======================================================
// 2. RECUPERAR CONTEXTO ANTERIOR
// ======================================================

let contextoAnterior = {};

let contextoIA = {};

try {
  contextoIA =
    $('Preparar contexto IA').first().json ?? {};

  contextoAnterior =
    objeto(
      contextoIA.contexto_comercial
    );
} catch (_) {
  contextoIA = {};
  contextoAnterior = {};
}


const cotizacionAnterior =
  objeto(
    contextoAnterior.cotizacion
  );


// ======================================================
// 3. DATOS ANTERIORES
// ======================================================

const productoAnterior =
  texto(
    cotizacionAnterior.producto
  );

const materialAnterior =
  texto(
    cotizacionAnterior.material
  );

const cantidadAnterior =
  numero(
    cotizacionAnterior.cantidad_solicitada ??
    cotizacionAnterior.cantidad
  );

const anchoAnterior =
  numero(
    cotizacionAnterior.ancho_cm
  );

const altoAnterior =
  numero(
    cotizacionAnterior.alto_cm
  );

const formaAnterior =
  texto(
    cotizacionAnterior.forma
  );


// ======================================================
// 4. DATOS EXPLÍCITOS DEL MENSAJE ACTUAL
// ======================================================

// ------------------------------------------------------
// 4.1 NÚMEROS REALMENTE ESCRITOS EN EL TURNO
// ------------------------------------------------------
//
// La IA conserva datos anteriores y a veces toma como
// cantidad un número que no lo es ("botella de 500 ml").
// En un turno de solo texto, cantidad, ancho o alto
// cuentan como dato del turno solo si el número aparece
// escrito; la cantidad no puede ser volumen, peso ni
// medida. Con números en palabras, imagen o audio se
// confía en la IA.
//
// ------------------------------------------------------

const textoTurnoCrudo =
  String(
    contextoIA.mensaje_actual ??
    data.mensaje_actual ??
    ''
  );

const planoTurno =
  textoPlano(textoTurnoCrudo);

const UNIDADES_NO_CANTIDAD = [
  'ml', 'cc', 'l', 'lt', 'lts', 'litro', 'litros',
  'g', 'gr', 'grs', 'gramo', 'gramos', 'kg', 'kilo', 'kilos',
  'oz', 'onza', 'onzas', 'cm', 'mm', 'm', 'mt', 'mts', 'metro', 'metros'
];

const NUMEROS_EN_PALABRAS =
  /\b(dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce|trece|catorce|quince|dieci\w+|veinte|veinti\w+|treinta|cuarenta|cincuenta|sesenta|setenta|ochenta|noventa|cien|ciento|\w+cientos|mil)\b/;

function numerosEscritos(valor) {
  const encontrados = [];

  const patron =
    /(\d{1,3}(?:[.,]\d{3})+(?!\d)|\d+(?:[.,]\d+)?)\s*(mil\b|ml\b|cc\b|lts?\b|litros?\b|l\b|grs?\b|gramos?\b|g\b|kg\b|kilos?\b|oz\b|onzas?\b|cm\b|mm\b|mts?\b|metros?\b|m\b)?/g;

  for (const m of String(valor ?? '').toLowerCase().matchAll(patron)) {
    const crudo = m[1];

    const valorNumero =
      /^\d{1,3}(?:[.,]\d{3})+$/.test(crudo)
        ? Number(crudo.replace(/[.,]/g, ''))
        : Number(crudo.replace(',', '.'));

    const unidad = m[2] ?? null;

    if (!Number.isFinite(valorNumero)) {
      continue;
    }

    encontrados.push(
      unidad === 'mil'
        ? { valor: valorNumero * 1000, unidad: null }
        : { valor: valorNumero, unidad }
    );
  }

  return encontrados;
}

const numerosTurno =
  numerosEscritos(textoTurnoCrudo);

const turnoSoloTexto =
  numero(contextoIA.media_turno?.cantidad_media) === null ||
  numero(contextoIA.media_turno?.cantidad_media) === 0;

const verificarNumerosTurno =
  turnoSoloTexto &&
  planoTurno !== '' &&
  !NUMEROS_EN_PALABRAS.test(planoTurno);

function cantidadEscrita(valor) {
  return numerosTurno.some(n =>
    igualesNumero(n.valor, valor) &&
    !UNIDADES_NO_CANTIDAD.includes(n.unidad)
  );
}

function medidaEscrita(valor) {
  return numerosTurno.some(n =>
    igualesNumero(n.valor, valor) ||
    (n.unidad === 'mm' && igualesNumero(n.valor / 10, valor)) ||
    (['m', 'mt', 'mts', 'metro', 'metros'].includes(n.unidad) && igualesNumero(n.valor * 100, valor))
  );
}

function datoDelTurno(valor, escrito) {
  if (valor === null || !verificarNumerosTurno) {
    return valor;
  }

  return escrito(valor) ? valor : null;
}


const productoActual =
  texto(data.producto);

const materialActual =
  texto(data.material);

const cantidadActual =
  datoDelTurno(numero(data.cantidad), cantidadEscrita);

const anchoActual =
  datoDelTurno(numero(data.ancho_cm), medidaEscrita);

const altoActual =
  datoDelTurno(numero(data.alto_cm), medidaEscrita);

const datosDescartadosTurno = [
  ['cantidad', numero(data.cantidad), cantidadActual],
  ['ancho_cm', numero(data.ancho_cm), anchoActual],
  ['alto_cm', numero(data.alto_cm), altoActual]
]
  .filter(([, ia, turno]) => ia !== null && turno === null)
  .map(([campo]) => campo);

let formaActual =
  texto(data.forma);

if (
  formaActual === 'NO_ESPECIFICADA'
) {
  formaActual = null;
}


// ======================================================
// 5. CONSOLIDAR DATOS
// ======================================================

const producto =
  productoActual ??
  productoAnterior;

const material =
  materialActual ??
  materialAnterior;

let cantidadSolicitada =
  cantidadActual ??
  cantidadAnterior;

// ------------------------------------------------------
// REGLA ATÓMICA DE MEDIDAS
// ------------------------------------------------------
//
// Si el mensaje actual trae LAS DOS medidas, ambas
// reemplazan juntas al par anterior.
//
// Esto evita estados híbridos:
//
// anterior: 7 x 12
// actual:   8 x 11
// incorrecto: 7 x 11
// correcto:   8 x 11
//
// Si el mensaje actual trae solo UNA medida explícita,
// sí permitimos conservar la otra anterior, porque puede
// ser una corrección parcial legítima.
// ------------------------------------------------------

const medidasActualesCompletas =
  anchoActual !== null &&
  altoActual !== null;

let anchoCm = null;
let altoCm = null;

if (medidasActualesCompletas) {
  anchoCm = anchoActual;
  altoCm = altoActual;
} else {
  anchoCm =
    anchoActual ??
    anchoAnterior;

  altoCm =
    altoActual ??
    altoAnterior;
}

let forma =
  formaActual ??
  formaAnterior ??
  'NO_ESPECIFICADA';


// ======================================================
// 6. FORMA DERIVADA
// ======================================================

if (
  forma === 'NO_ESPECIFICADA' &&
  anchoCm !== null &&
  altoCm !== null
) {
  forma =
    anchoCm === altoCm
      ? 'RECTANGULAR'
      : 'RECTANGULAR';
}


// ======================================================
// 7. CANTIDAD POR DEFECTO
// ======================================================
//
// Si ya tenemos medidas y el cliente no indicó cantidad,
// trabajamos con el mínimo comercial de 1000.
//
// NO se pregunta cantidad.
//
// ======================================================

let cantidadAsumida = false;

if (
  cantidadSolicitada === null &&
  anchoCm !== null &&
  altoCm !== null
) {
  cantidadSolicitada = 1000;
  cantidadAsumida = true;
}


// ======================================================
// 8. NORMALIZAR CANTIDAD IMPRIMIBLE
// ======================================================

let cantidadCotizable = null;
let cantidadAjustada = false;

if (
  cantidadSolicitada !== null &&
  cantidadSolicitada > 0
) {
  cantidadCotizable =
    Math.max(
      1000,
      Math.ceil(
        cantidadSolicitada / 1000
      ) * 1000
    );

  cantidadAjustada =
    cantidadCotizable !== cantidadSolicitada;
}


// ======================================================
// 9. DETECTAR CAMBIOS REALES DE COTIZACIÓN
// ======================================================

const modificoCantidad =
  cantidadActual !== null &&
  (
    cantidadAnterior === null ||
    !igualesNumero(
      cantidadActual,
      cantidadAnterior
    )
  );

const modificoAncho =
  anchoActual !== null &&
  (
    anchoAnterior === null ||
    !igualesNumero(
      anchoActual,
      anchoAnterior
    )
  );

const modificoAlto =
  altoActual !== null &&
  (
    altoAnterior === null ||
    !igualesNumero(
      altoActual,
      altoAnterior
    )
  );

const modificoForma =
  formaActual !== null &&
  (
    !formaAnterior ||
    formaActual !== formaAnterior
  );

const modificoParMedidas =
  medidasActualesCompletas &&
  (
    anchoAnterior === null ||
    altoAnterior === null ||
    !igualesNumero(
      anchoCm,
      anchoAnterior
    ) ||
    !igualesNumero(
      altoCm,
      altoAnterior
    )
  );

const modificoDatosCotizacion =
  modificoCantidad ||
  modificoAncho ||
  modificoAlto ||
  modificoForma ||
  modificoParMedidas;


// ======================================================
// 10. DATOS SUFICIENTES
// ======================================================

const faltaMedidas =
  anchoCm === null ||
  altoCm === null;

const datosSuficientes =
  !faltaMedidas &&
  cantidadCotizable !== null;


// ======================================================
// 11. RESOLVER ACCIÓN REAL
// ======================================================

const accionIA =
  texto(data.accion) ??
  'RESPONDER_GENERAL';

const intencion =
  texto(data.intencion) ??
  'OTRO';

let accion =
  accionIA;


// ------------------------------------------------------
// A. HUMANO SIEMPRE SE RESPETA
// ------------------------------------------------------

if (
  data.requiere_humano === true ||
  accionIA === 'DERIVAR_HUMANO'
) {
  accion =
    'DERIVAR_HUMANO';
}


// ------------------------------------------------------
// B. ACCIONES INFORMATIVAS SE RESPETAN
// ------------------------------------------------------
//
// Esta es la corrección clave:
// una pregunta de diseño, material, pago, ubicación, etc.
// NO puede convertirse en cotización solamente porque
// ya existan medidas previas.
//
// ------------------------------------------------------

else if (
  [
    'INFORMAR_MATERIAL',
    'INFORMAR_MINIMO',
    'INFORMAR_UBICACION',
    'INFORMAR_METODOLOGIA',
    'INFORMAR_METODOLOGIA_PAGO',
    'INFORMAR_ENTREGA',
    'INFORMAR_DISENO',
    'REGISTRAR_ACEPTACION',
    'RESPONDER_GENERAL'
  ].includes(accionIA)
) {
  accion =
    accionIA;
}


// ------------------------------------------------------
// C. SI QUIERE COTIZAR Y FALTAN MEDIDAS
// ------------------------------------------------------

else if (
  faltaMedidas &&
  [
    'SOLICITAR_COTIZACION',
    'CONSULTAR_PRECIO',
    'APORTAR_DATOS'
  ].includes(intencion)
) {
  accion =
    'PEDIR_MEDIDAS';
}


// ------------------------------------------------------
// D. COTIZACIÓN INICIAL
// ------------------------------------------------------

else if (
  datosSuficientes &&
  [
    'SOLICITAR_COTIZACION',
    'CONSULTAR_PRECIO'
  ].includes(intencion)
) {
  accion =
    'COTIZAR_P4';
}


// ------------------------------------------------------
// E. MODIFICACIÓN DE UNA COTIZACIÓN
// ------------------------------------------------------

else if (
  datosSuficientes &&
  intencion === 'APORTAR_DATOS' &&
  modificoDatosCotizacion
) {
  accion =
    'COTIZAR_P4';
}


// ------------------------------------------------------
// F. SI LA IA YA DECIDIÓ COTIZAR
// ------------------------------------------------------

else if (
  datosSuficientes &&
  accionIA === 'COTIZAR_P4'
) {
  accion =
    'COTIZAR_P4';
}


// ------------------------------------------------------
// G. PROTECCIÓN: NO PEDIR PRODUCTO PARA P4
// ------------------------------------------------------

else if (
  accionIA === 'PEDIR_PRODUCTO'
) {
  accion =
    faltaMedidas
      ? 'PEDIR_MEDIDAS'
      : 'COTIZAR_P4';
}


// ------------------------------------------------------
// J. NO RECOTIZAR SIN UN CAMBIO REAL EN ESTE TURNO
// ------------------------------------------------------
//
// Las medidas guardadas no bastan para volver a cotizar:
// - "son en otras medidas" sin medidas nuevas -> se piden;
// - sesión nueva sin datos ni referencia a lo anterior ->
//   no se reutiliza la cotización vieja;
// - cotización vigente sin cambios y sin pedir precio ->
//   se responde lo que preguntó, sin recotizar.
//
// ------------------------------------------------------

const PIDE_PRECIO =
  /\b(precios?|cuanto (cuesta|cuestan|vale|valen|sale|salen|seria|serian|costaria|costarian|me sale|me salen|me cobra|me cobran)|cotiza\w*|cotizacion(es)?|presupuesto|valor)\b/;

const REFIERE_COTIZACION_ANTERIOR =
  /\b(la cotizacion (que|de|anterior)|lo de (ayer|antes|la otra vez)|las mismas|los mismos|la misma|lo mismo|como (la vez pasada|antes|la anterior)|anterior|seguir con|continuar con)\b/;

const PIDE_OTRAS_MEDIDAS =
  /\b(otr[ao]s? (medidas?|tamanos?|dimensiones)|no son (esas|esa|estas|esta) medidas?|(cambiar|cambio|modificar) (de |las |la )?(medidas?|tamano)|(diferentes?|distint[ao]s?) (medidas?|tamanos?))\b/;

const cotizacionVigente =
  cotizacionAnterior.estado === 'COTIZADA' ||
  numero(cotizacionAnterior.total) !== null ||
  numero(cotizacionAnterior.cotizacion_id) !== null;

const sesionConversacionalNueva =
  contextoIA.sesion_conversacional_nueva === true;

let ajusteRecotizacion = null;

if (
  accion === 'COTIZAR_P4' &&
  !modificoDatosCotizacion
) {
  if (PIDE_OTRAS_MEDIDAS.test(planoTurno)) {
    ajusteRecotizacion = 'PIDE_OTRAS_MEDIDAS';
    accion = 'PEDIR_MEDIDAS';
  } else if (
    sesionConversacionalNueva &&
    !REFIERE_COTIZACION_ANTERIOR.test(planoTurno)
  ) {
    ajusteRecotizacion = 'SESION_NUEVA_SIN_DATOS';
    accion =
      PIDE_PRECIO.test(planoTurno)
        ? 'PEDIR_MEDIDAS'
        : 'RESPONDER_GENERAL';
  } else if (
    cotizacionVigente &&
    !PIDE_PRECIO.test(planoTurno) &&
    !REFIERE_COTIZACION_ANTERIOR.test(planoTurno)
  ) {
    ajusteRecotizacion = 'COTIZACION_VIGENTE_SIN_CAMBIOS';
    accion = 'RESPONDER_GENERAL';
  }
}


// ------------------------------------------------------
// H. CANTIDAD MAYORISTA -> HUMANO
// ------------------------------------------------------
//
// Desde 6000 etiquetas (ya normalizadas a multiplos de
// 1000) no existe precio automatico. Tiene prioridad
// sobre COTIZAR_P4 y sobre pedir datos de cotizacion,
// para que nunca se entre al extractor ni al calculo.
//
// Si la IA ya derivo por otro motivo, se respeta ese
// motivo. Las acciones informativas sin cantidad nueva
// en este turno se conservan.
//
// ------------------------------------------------------

const CANTIDAD_DERIVACION_HUMANA = 6000;

const ACCIONES_RUTA_COTIZACION = [
  'COTIZAR_P4',
  'PEDIR_MEDIDAS',
  'PEDIR_CANTIDAD',
  'PEDIR_PRODUCTO',
  'PEDIR_FORMA'
];

const INTENCIONES_PRECIO = [
  'SOLICITAR_COTIZACION',
  'CONSULTAR_PRECIO',
  'APORTAR_DATOS'
];

const cantidadMayorista =
  cantidadCotizable !== null &&
  cantidadCotizable >=
    CANTIDAD_DERIVACION_HUMANA;

const derivacionPorCantidad =
  cantidadMayorista &&
  accion !== 'DERIVAR_HUMANO' &&
  (
    ACCIONES_RUTA_COTIZACION.includes(accion) ||
    (
      cantidadActual !== null &&
      INTENCIONES_PRECIO.includes(intencion)
    )
  );

if (derivacionPorCantidad) {
  accion =
    'DERIVAR_HUMANO';
}


// ------------------------------------------------------
// I. REGLAS PRE-IA
// ------------------------------------------------------
//
// PRODUCTO_NO_P4: impreso que no es etiqueta adhesiva.
// Nunca se piden medidas ni se cotiza P4: lo atiende un
// humano como COTIZACION_ESPECIAL.
//
// ------------------------------------------------------

const reglaPreIA =
  texto(contextoIA.regla_pre_ia);

const productoNoP4 =
  texto(contextoIA.producto_no_p4);

const derivacionPorProductoNoP4 =
  reglaPreIA === 'PRODUCTO_NO_P4' &&
  !derivacionPorCantidad;

if (derivacionPorProductoNoP4) {
  accion =
    'DERIVAR_HUMANO';
}


// ======================================================
// 12. RESPUESTA SUGERIDA
// ======================================================

let respuestaSugerida =
  texto(
    data.respuesta_sugerida
  ) ?? '';

if (
  accion === 'PEDIR_MEDIDAS'
) {
  respuestaSugerida =
    '¿En qué medidas necesita sus etiquetas? Indíquenos ancho y alto por favor.';
}

else if (
  accion === 'COTIZAR_P4' ||
  derivacionPorCantidad
) {
  respuestaSugerida =
    '';
}

if (ajusteRecotizacion === 'PIDE_OTRAS_MEDIDAS') {
  respuestaSugerida =
    'Indíquenos por favor las nuevas medidas de sus etiquetas (ancho y alto en centímetros) para cotizarle.';
}

else if (
  accion === 'RESPONDER_GENERAL' &&
  ajusteRecotizacion !== null &&
  respuestaSugerida === ''
) {
  respuestaSugerida =
    ajusteRecotizacion === 'SESION_NUEVA_SIN_DATOS'
      ? '¿En qué podemos ayudarle con sus etiquetas?'
      : 'Gracias por la información. Si necesita cotizar otra medida o cantidad, indíquenos por favor ancho, alto y cantidad.';
}


// ------------------------------------------------------
// 12.1 FECHA DESEADA POR EL CLIENTE
// ------------------------------------------------------
//
// Pedidos de lunes a miércoles, producción miércoles y
// jueves, entregas viernes desde las 17:00. La fecha que
// pide el cliente se guarda, pero nunca se confirma.
//
// ------------------------------------------------------

const RESPUESTA_METODOLOGIA =
  'Trabajamos con una metodología semanal: recibimos pedidos de lunes a miércoles, ' +
  'producimos miércoles y jueves, y realizamos entregas y envíos los viernes a partir de las 17:00. ' +
  'El viernes de entrega se confirma según el día en que ingrese su pedido.';

function textoPlano(valor) {
  return String(valor ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const DIAS_SEMANA =
  '(lunes|martes|miercoles|jueves|viernes|sabado|domingo)';

const MESES =
  '(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)';

const PATRONES_FECHA_DESEADA = [
  new RegExp(`\\b(para|hasta|antes del?) (el )?(dia )?(proximo )?${DIAS_SEMANA}\\b`),
  /\b(para|hasta|antes del?) (el )?(dia )?\d{1,2}\b(?! ?(x|cm|mm|ml|cc|gr|g|kg|lt|l|litros?|onzas?|oz|unidades|etiquetas|mil|por|disenos?|modelos?|sabor(?:es)?|nombres?|variedad(?:es)?|version(?:es)?|textos?|tipos?|referencias?|artes?|marcas?|color(?:es)?|productos?|presentacion(?:es)?|diferentes|distint[oa]s))/,
  new RegExp(`\\b\\d{1,2} de ${MESES}\\b`),
  /\b(para|hasta|antes de) (hoy|manana|pasado manana|esta semana|la proxima semana|el fin de semana|fin de mes)\b/,
  /\b(las|los|la|lo) (necesito|necesitamos|requiero|requerimos|quiero|queremos) (para|hasta|antes)\b/
];

const PATRON_PROMESA =
  /\b(se (lo|la|los|las) (entregamos|tenemos|tendremos)|(estara|estaran) list[oa]s? (para|el)|le (confirmamos|garantizamos) (la entrega|que)|sin problema (para|el))\b/;

const mensajeTurnoPlano =
  textoPlano(
    contextoIA.mensaje_actual ??
    data.mensaje_actual
  );

const coincidenciaFecha =
  PATRONES_FECHA_DESEADA
    .map(patron => mensajeTurnoPlano.match(patron))
    .find(Boolean) ?? null;


// ------------------------------------------------------
// 12.2 NO REPETIR PEDIR_MEDIDAS
// ------------------------------------------------------
//
// Si el último SALIENTE con acción reconocible ya pidió
// medidas (bot, automatización de WhatsApp Business o
// humano), no se vuelve a hacer la pregunta completa:
// - con información nueva en el turno, se agradece y se
//   pide solo lo que falta;
// - sin información nueva, no se envía nada.
//
// ------------------------------------------------------

const ultimoSaliente =
  objeto(contextoIA.ultimo_saliente);

const medidasYaSolicitadas =
  contextoIA.medidas_ya_solicitadas === true;

const turnoAportaInformacion =
  anchoActual !== null ||
  altoActual !== null ||
  cantidadActual !== null ||
  materialActual !== null ||
  formaActual !== null ||
  coincidenciaFecha !== null ||
  (
    productoActual !== null &&
    productoActual !== productoAnterior
  );

let omitirEnvio = false;

let motivoOmisionEnvio = null;

let preguntaMedidasFaltantes = null;

if (
  accion === 'PEDIR_MEDIDAS' &&
  medidasYaSolicitadas &&
  ajusteRecotizacion !== 'PIDE_OTRAS_MEDIDAS'
) {
  if (turnoAportaInformacion) {
    const faltante =
      anchoCm === null && altoCm === null
        ? 'el ancho y alto'
        : anchoCm === null
          ? 'el ancho'
          : 'el alto';

    preguntaMedidasFaltantes =
      `Para cotizar sus etiquetas solo nos falta ${faltante} en centímetros.`;

    respuestaSugerida =
      `Gracias. ${preguntaMedidasFaltantes}`;
  } else {
    omitirEnvio = true;
    motivoOmisionEnvio = 'MEDIDAS_YA_SOLICITADAS';
  }
}


// ------------------------------------------------------
// 12.3 METODOLOGÍA EN LUGAR DE PROMESA DE FECHA
// ------------------------------------------------------

const respuestaPrometeFecha =
  PATRON_PROMESA.test(
    textoPlano(respuestaSugerida)
  );

let fechaDeseadaCliente =
  objeto(contextoAnterior.fecha_deseada_cliente);

const aplicaMetodologia =
  (coincidenciaFecha !== null || respuestaPrometeFecha) &&
  !omitirEnvio &&
  !['COTIZAR_P4', 'DERIVAR_HUMANO'].includes(accion);

if (coincidenciaFecha !== null) {
  fechaDeseadaCliente = {
    texto:
      coincidenciaFecha[0],
    detectada_at:
      new Date().toISOString()
  };
}

if (aplicaMetodologia) {
  const preguntaPendiente =
    accion === 'PEDIR_MEDIDAS'
      ? (
          preguntaMedidasFaltantes !== null
            ? ` ${preguntaMedidasFaltantes}`
            : ' Para cotizar, ¿en qué medidas necesita sus etiquetas? Indíquenos ancho y alto por favor.'
        )
      : '';

  respuestaSugerida =
    `${RESPUESTA_METODOLOGIA}${preguntaPendiente}`.trim();
}


// ------------------------------------------------------
// 12.4 ACCIÓN YA ATENDIDA DURANTE EL TURNO
// ------------------------------------------------------
//
// El eco automático de WhatsApp Business (por ejemplo la
// respuesta de anuncio que pide medidas o explica el
// material) puede llegar después de iniciado el turno. Si
// ya cubrió la misma acción, el bot no la repite. Una
// respuesta automática sin acción reconocida (detectada
// por velocidad en la apertura) cubre las preguntas
// informativas del turno.
//
// Si lo que respondió la automatización es informativo y
// aún faltan medidas, el bot solo continúa con la pregunta
// de medidas para no dejar la conversación sin siguiente
// paso.
//
// ------------------------------------------------------

const ACCIONES_ATENDIBLES_POR_AUTOMATIZACION = [
  'INFORMAR_MATERIAL',
  'INFORMAR_MINIMO',
  'INFORMAR_UBICACION',
  'INFORMAR_METODOLOGIA',
  'INFORMAR_METODOLOGIA_PAGO',
  'INFORMAR_ENTREGA',
  'INFORMAR_DISENO',
  'RESPONDER_GENERAL'
];

const accionAutomatizacion =
  texto(ultimoSaliente.accion_equivalente);

const automatizacionAtendioTurno =
  !omitirEnvio &&
  !aplicaMetodologia &&
  ultimoSaliente.posterior_al_turno === true &&
  ultimoSaliente.origen === 'AUTOMATICO' &&
  (
    accionAutomatizacion === accion ||
    (
      reglaPreIA === 'SALUDO_SIMPLE' &&
      accionAutomatizacion !== null
    ) ||
    (
      accionAutomatizacion === null &&
      ACCIONES_ATENDIBLES_POR_AUTOMATIZACION.includes(accion)
    )
  );

let seguimientoTrasAutomatizacion = false;

if (automatizacionAtendioTurno) {
  seguimientoTrasAutomatizacion =
    reglaPreIA !== 'SALUDO_SIMPLE' &&
    ACCIONES_ATENDIBLES_POR_AUTOMATIZACION.includes(accion) &&
    faltaMedidas &&
    !medidasYaSolicitadas;

  if (seguimientoTrasAutomatizacion) {
    respuestaSugerida =
      '¿En qué medidas necesita sus etiquetas? Indíquenos ancho y alto por favor.';
  } else {
    omitirEnvio = true;
    motivoOmisionEnvio = 'ACCION_YA_ATENDIDA_POR_AUTOMATIZACION';
  }
}


// ------------------------------------------------------
// 12.5 FOTO DEL MATERIAL
// ------------------------------------------------------
//
// La respuesta de material va acompañada de la foto
// configurada en configuracion_bot (clave IMAGEN_MATERIAL,
// valor_json { activo, url }), una sola vez por
// conversación: contexto_comercial.imagen_material guarda
// cuándo se envió. "Preparar envío WhatsApp" la manda
// como segundo mensaje después del texto.
//
// ------------------------------------------------------

let filasConfiguracion = [];

try {
  filasConfiguracion =
    $('Obtener configuración MODO_PRUEBA')
      .all()
      .map(item => item.json ?? {});
} catch (_) {
  filasConfiguracion = [];
}

const configImagenMaterial =
  objeto(
    filasConfiguracion.find(
      fila => fila.clave === 'IMAGEN_MATERIAL'
    )?.valor_json
  );

const urlConfiguradaImagenMaterial =
  texto(configImagenMaterial.url);

const urlImagenMaterial =
  configImagenMaterial.activo === true &&
  urlConfiguradaImagenMaterial !== null &&
  /^https:\/\/\S+$/i.test(urlConfiguradaImagenMaterial)
    ? urlConfiguradaImagenMaterial
    : null;

const imagenMaterialYaEnviada =
  texto(
    objeto(contextoAnterior.imagen_material).enviada_at
  ) !== null;

const enviarImagenMaterial =
  accion === 'INFORMAR_MATERIAL' &&
  !omitirEnvio &&
  urlImagenMaterial !== null &&
  !imagenMaterialYaEnviada;


// ======================================================
// 13. CONTEXTO COMERCIAL NUEVO
// ======================================================

// ------------------------------------------------------
// INVALIDAR RESULTADO DE COTIZACIÓN ANTERIOR SI CAMBIARON
// SUS DATOS BASE
// ------------------------------------------------------
//
// El objeto contexto_comercial.cotizacion funciona como
// snapshot de la cotización vigente.
//
// Si cambia cantidad, medidas o forma, ya no podemos
// conservar como vigentes:
//
// - id / cotizacion_id
// - total / precio_total
// - estado
// - cotizada_at
// - flags de producibilidad del intento anterior
//
// Esos datos serán escritos nuevamente por la ruta real
// de cotización cuando termine el cálculo.
// ------------------------------------------------------

const cotizacionBaseNueva =
  modificoDatosCotizacion
    ? {
        ...cotizacionAnterior,

        id: null,
        cotizacion_id: null,

        existe: false,

        estado: null,

        total: null,
        precio_total: null,
        moneda:
          cotizacionAnterior.moneda ??
          'USD',

        cotizada_at: null,

        cantidad_detalles: null,

        producible: null,
        restriccion_codigo: null,
        restriccion_tipo: null,

        ultimo_error_produccion: null,
        ultimo_intento_producible: null
      }
    : {
        ...cotizacionAnterior
      };

const contextoComercialNuevo = {
  ...contextoAnterior,

  ...(
    Object.keys(fechaDeseadaCliente).length > 0
      ? { fecha_deseada_cliente: fechaDeseadaCliente }
      : {}
  ),

  ...(
    derivacionPorProductoNoP4
      ? {
          producto_no_p4: {
            producto: productoNoP4,
            detectado_at: new Date().toISOString()
          }
        }
      : {}
  ),

  ...(
    enviarImagenMaterial
      ? {
          imagen_material: {
            url: urlImagenMaterial,
            enviada_at: new Date().toISOString()
          }
        }
      : {}
  ),

  cotizacion: {
    ...cotizacionBaseNueva,

    producto,
    material,

    cantidad_solicitada:
      cantidadSolicitada,

    cantidad_cotizable:
      cantidadCotizable,

    cantidad_ajustada:
      cantidadAjustada,

    cantidad_asumida:
      cantidadAsumida,

    ancho_cm:
      anchoCm,

    alto_cm:
      altoCm,

    forma
  }
};


// ======================================================
// 14. SALIDA
// ======================================================

return [
  {
    json: {
      ...data,

      producto,
      material,

      cantidad_solicitada:
        cantidadSolicitada,

      cantidad_cotizable:
        cantidadCotizable,

      cantidad_ajustada:
        cantidadAjustada,

      cantidad_asumida:
        cantidadAsumida,

      cantidad:
        cantidadCotizable,

      ancho_cm:
        anchoCm,

      alto_cm:
        altoCm,

      forma,

      modifico_datos_cotizacion:
        modificoDatosCotizacion,

      modifico_par_medidas:
        modificoParMedidas,

      medidas_actuales_completas:
        medidasActualesCompletas,

      accion,

      ...(
        derivacionPorCantidad
          ? {
              requiere_humano:
                true,

              motivo_derivacion:
                'COTIZACION_ESPECIAL',

              requiere_notificacion:
                true,

              regla_derivacion:
                'CANTIDAD_MAYORISTA'
            }
          : {}
      ),

      ...(
        derivacionPorProductoNoP4
          ? {
              requiere_humano:
                true,

              motivo_derivacion:
                'COTIZACION_ESPECIAL',

              requiere_notificacion:
                true,

              regla_derivacion:
                'PRODUCTO_NO_P4',

              producto_no_p4:
                productoNoP4
            }
          : {}
      ),

      derivacion_por_cantidad:
        derivacionPorCantidad,

      regla_pre_ia:
        reglaPreIA,

      fecha_deseada_cliente:
        Object.keys(fechaDeseadaCliente).length > 0
          ? fechaDeseadaCliente
          : null,

      omitir_envio:
        omitirEnvio,

      motivo_omision_envio:
        motivoOmisionEnvio,

      ajuste_recotizacion:
        ajusteRecotizacion,

      datos_descartados_turno:
        datosDescartadosTurno,

      seguimiento_tras_automatizacion:
        seguimientoTrasAutomatizacion,

      enviar_imagen_material:
        enviarImagenMaterial,

      imagen_material_url:
        enviarImagenMaterial
          ? urlImagenMaterial
          : null,

      datos_suficientes_para_cotizar:
        datosSuficientes,

      respuesta_sugerida:
        respuestaSugerida,

      contexto_comercial:
        contextoComercialNuevo
    }
  }
];
