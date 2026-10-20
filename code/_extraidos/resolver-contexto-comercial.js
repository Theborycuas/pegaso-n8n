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
// RESOLVER CONTEXTO COMERCIAL - V3.10
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
// - V3.0: imagen informativa genérica. Material (IMAGEN_MATERIAL) y
//   metodología de producción (IMAGEN_METODOLOGIA: INFORMAR_ENTREGA,
//   INFORMAR_METODOLOGIA o fecha pedida respondida con la metodología),
//   una vez por conversación cada una. La salida cambia a
//   enviar_imagen_informativa / imagen_informativa / imagen_informativa_url
//   (antes enviar_imagen_material / imagen_material_url).
// - V3.1: antes de COTIZAR_P4, si el precio estimado por 1000 supera
//   $140 (medidas grandes), se pide confirmación de las medidas y no
//   se envía la cotización hasta que el prospecto confirme o corrija.
// - V3.2: si las medidas ya se pidieron (bot o publicidad) y el
//   cliente vuelve a escribir sin darlas, no se omite el envío: se
//   acota pidiendo ancho y alto en cm para poder cotizar.
// - V3.3: ENVIAR_DATOS_PAGO envía IMAGEN_DATOS_PAGO (datos bancarios)
//   + texto fijo, una vez por conversación. No deriva a humano.
// - V3.4: "si hago 5000 baja el precio" / "en cuanto me queda con X"
//   no es NEGOCIAR: es recotización por cantidad (o mayorista si
//   >= 6000). Prefijo de explicación al recotizar por cantidad.
// - V3.5: INFORMAR_TARJETAS envía catálogo de 4 videos (acabados)
//   + texto de cierre. No deriva a humano ni cotiza P4.
// - V3.6: primer contacto de tarjetas = saludo horario + videos
//   + frase corta. Material, entregas y caras se responden después,
//   sin mezclar con la metodología/precios de etiquetas.
// - V3.7: INFORMAR_FLYERS envía saludo + imagen + lista de precios
//   A5/A6. Entregas iguales a tarjetas. Couche 115 gr. Lo que no
//   está en catálogo deriva a humano.
// - V3.8: tras el catálogo de tarjetas o flyers se envía
//   "*Los precios adjuntos no incluyen IVA*".
// - V3.9: el saludo horario de catálogo (tarjetas/flyers) solo
//   en sesión nueva (sin historial en 24 h). Si ya hay
//   conversación en curso, se envía imagen/videos + texto.
//   CATALOGO_FLYERS.valor_json null usa la URL por defecto;
//   el link de WhatsApp pasa por i0.wp.com (JPEG ~190 KB)
//   porque Meta no siempre descarga el original de Hostinger.
// - V3.10: la imagen de flyers se adjunta siempre que el texto
//   saliente sea la lista de precios A5/A6, no solo en el
//   primer INFORMAR_FLYERS. Así no se pierde la foto si el
//   catálogo quedó marcado como enviado sin imagen.
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

let cantidadActual =
  datoDelTurno(numero(data.cantidad), cantidadEscrita);

// Si la IA no extrajo cantidad pero el mensaje trae un solo
// número típico de pedido (>= 1000, sin unidad de medida),
// se toma como cantidad del turno (p. ej. "si hago 5000").
if (cantidadActual === null && verificarNumerosTurno) {
  const candidatasCantidad = numerosTurno.filter(n =>
    n.unidad === null &&
    n.valor >= 1000
  );

  if (candidatasCantidad.length === 1) {
    cantidadActual = candidatasCantidad[0].valor;
  }
}

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

const motivoDerivacionIA =
  texto(data.motivo_derivacion) ??
  'NINGUNO';

let accion =
  accionIA;

// Umbral mayorista (misma constante que la regla H).
const CANTIDAD_DERIVACION_HUMANA = 6000;

// ------------------------------------------------------
// A0. CANTIDAD NUEVA NO ES NEGOCIACIÓN
// ------------------------------------------------------
//
// "¿Con 5000 baja el precio?" / "si hago 10000 en cuanto
// me queda" traen cantidad concreta. Con medidas ya
// conocidas se recotiza (o se deriva mayorista si
// >= 6000). No se trata como NEGOCIAR/descuento.
//
// ------------------------------------------------------

const MOTIVOS_NEGOCIACION = [
  'NEGOCIACION',
  'NEGOCIACION_COMERCIAL',
  'NEGOCIAR_PRECIO',
  'DESCUENTO',
  'PRECIO_ESPECIAL'
];

const recotizacionPorCantidadNueva =
  cantidadActual !== null &&
  datosSuficientes &&
  (
    intencion === 'NEGOCIAR' ||
    MOTIVOS_NEGOCIACION.includes(motivoDerivacionIA) ||
    (
      accionIA === 'DERIVAR_HUMANO' &&
      [
        'CONSULTAR_PRECIO',
        'APORTAR_DATOS',
        'SOLICITAR_COTIZACION',
        'NEGOCIAR'
      ].includes(intencion)
    )
  );


// ------------------------------------------------------
// A. HUMANO SIEMPRE SE RESPETA
// ------------------------------------------------------

if (
  recotizacionPorCantidadNueva &&
  cantidadCotizable !== null &&
  cantidadCotizable < CANTIDAD_DERIVACION_HUMANA
) {
  accion =
    'COTIZAR_P4';
} else if (
  recotizacionPorCantidadNueva &&
  cantidadCotizable !== null &&
  cantidadCotizable >= CANTIDAD_DERIVACION_HUMANA
) {
  accion =
    'DERIVAR_HUMANO';
} else if (
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
    'INFORMAR_TARJETAS',
    'INFORMAR_FLYERS',
    'ENVIAR_DATOS_PAGO',
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

let derivacionPorCantidad =
  cantidadMayorista &&
  (
    recotizacionPorCantidadNueva ||
    (
      accion !== 'DERIVAR_HUMANO' &&
      (
        ACCIONES_RUTA_COTIZACION.includes(accion) ||
        (
          cantidadActual !== null &&
          INTENCIONES_PRECIO.includes(intencion)
        )
      )
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
// TARJETAS_PRESENTACION: catálogo de acabados (videos).
// FLYERS_VOLANTES: imagen + precios A5/A6.
// PRODUCTO_NO_P4: otro impreso (afiches, etc.) → humano.
//
// ------------------------------------------------------

const reglaPreIA =
  texto(contextoIA.regla_pre_ia);

const productoNoP4 =
  texto(contextoIA.producto_no_p4);

const productoTarjetas =
  texto(contextoIA.producto_tarjetas);

const productoFlyers =
  texto(contextoIA.producto_flyers);

if (
  reglaPreIA === 'TARJETAS_PRESENTACION' ||
  accionIA === 'INFORMAR_TARJETAS'
) {
  accion =
    'INFORMAR_TARJETAS';
} else if (
  reglaPreIA === 'FLYERS_VOLANTES' ||
  accionIA === 'INFORMAR_FLYERS'
) {
  accion =
    'INFORMAR_FLYERS';
}

const derivacionPorProductoNoP4 =
  reglaPreIA === 'PRODUCTO_NO_P4' &&
  accion !== 'INFORMAR_TARJETAS' &&
  accion !== 'INFORMAR_FLYERS' &&
  !derivacionPorCantidad;

if (derivacionPorProductoNoP4) {
  accion =
    'DERIVAR_HUMANO';
}


// ------------------------------------------------------
// K. CONFIRMAR MEDIDAS GRANDES (precio / 1000 > $140)
// ------------------------------------------------------
//
// Medidas muy grandes (p. ej. 20x30, 15x30, 100x100)
// generan precios altos. Antes de cotizar se confirma
// con el prospecto. La estimación sigue la misma lógica
// comercial de "Calcular precio detalle" (precio por
// 1000); la fuente de verdad del cobro sigue siendo ese
// nodo en la ruta de cotización.
//
// ------------------------------------------------------

const LIMITE_CONFIRMACION_PRECIO_1000 = 140;

function formatoMedidaCm(valor) {
  const n = numero(valor);
  if (n === null) {
    return '';
  }
  return Number.isInteger(n)
    ? String(n)
    : String(n);
}

function estimarPrecio1000Comercial(
  anchoValor,
  altoValor,
  formaValor,
  cantidadValor
) {
  const ancho = numero(anchoValor);
  const alto = numero(altoValor);
  const cantidad = numero(cantidadValor);

  if (
    ancho === null ||
    alto === null ||
    cantidad === null ||
    cantidad < 1000
  ) {
    return null;
  }

  if (
    ancho >= 2 && ancho < 4 &&
    alto >= 2 && alto < 4
  ) {
    return 18;
  }

  if (ancho === 4 && alto === 4) {
    return 20;
  }

  let anchoCalc = ancho;
  let altoCalc = alto;

  if (ancho === 5 && alto === 5) {
    anchoCalc += 1;
    altoCalc += 1;
  }

  const formaNorm =
    String(formaValor ?? '')
      .trim()
      .toUpperCase();

  if (
    formaNorm === 'CIRCULAR' ||
    formaNorm === 'TROQUELADA' ||
    formaNorm === 'REDONDEADA'
  ) {
    anchoCalc += 1;
    altoCalc += 1;
  }

  const factorRango =
    cantidad <= 2000
      ? 0.75
      : cantidad <= 5000
        ? 0.67
        : null;

  if (factorRango === null) {
    return null;
  }

  const precio1000Rango =
    anchoCalc * altoCalc * factorRango;

  const factor =
    precio1000Rango > 130 && 0.67 < factorRango
      ? 0.67
      : factorRango;

  return Math.ceil(anchoCalc * altoCalc * factor);
}

const confirmacionMedidasAnterior =
  objeto(contextoAnterior.confirmacion_medidas_grandes);

const precio1000Estimado =
  datosSuficientes
    ? estimarPrecio1000Comercial(
        anchoCm,
        altoCm,
        forma,
        cantidadCotizable
      )
    : null;

const medidasGrandesYaConfirmadas =
  confirmacionMedidasAnterior.confirmadas === true &&
  igualesNumero(
    confirmacionMedidasAnterior.ancho_cm,
    anchoCm
  ) &&
  igualesNumero(
    confirmacionMedidasAnterior.alto_cm,
    altoCm
  );

const AFIRMA_MEDIDAS =
  /^(si|ok|okay)\b|\b(correct[oa]s?|confirmo|confirmad[oa]s?|estan bien|estan correctas|asi es|exacto|afirmativo|dale|de acuerdo|esas? (son|es)|son (esas|correctas|asi)|si(,| )?(confirmo|estan bien|son correctas|son esas)|confirmo( las)? medidas|medidas? correctas)\b/;

const NIEGA_MEDIDAS =
  /^(no)\b|\b(incorrect[oa]s?|estan mal|esta mal|equivocad|error|no (son|es)( las)?( esas)?( correctas)?|otras medidas|me equivoque)\b/;

let confirmacionMedidasGrandes =
  Object.keys(confirmacionMedidasAnterior).length > 0
    ? { ...confirmacionMedidasAnterior }
    : null;

let pideConfirmacionMedidasGrandes = false;
let niegaMedidasGrandes = false;

if (
  confirmacionMedidasAnterior.pendiente === true &&
  !derivacionPorCantidad &&
  !derivacionPorProductoNoP4
) {
  const mismasMedidasPendientes =
    igualesNumero(
      confirmacionMedidasAnterior.ancho_cm,
      anchoCm
    ) &&
    igualesNumero(
      confirmacionMedidasAnterior.alto_cm,
      altoCm
    );

  const aportoMedidasDistintas =
    modificoParMedidas &&
    !mismasMedidasPendientes;

  if (aportoMedidasDistintas) {
    confirmacionMedidasGrandes = null;
  } else if (
    AFIRMA_MEDIDAS.test(planoTurno) &&
    !NIEGA_MEDIDAS.test(planoTurno)
  ) {
    accion = 'COTIZAR_P4';
    confirmacionMedidasGrandes = {
      pendiente: false,
      confirmadas: true,
      ancho_cm: anchoCm,
      alto_cm: altoCm,
      forma,
      cantidad: cantidadCotizable,
      precio_1000_estimado:
        precio1000Estimado ??
        confirmacionMedidasAnterior.precio_1000_estimado ??
        null,
      confirmada_at: new Date().toISOString()
    };
  } else if (NIEGA_MEDIDAS.test(planoTurno)) {
    accion = 'PEDIR_MEDIDAS';
    confirmacionMedidasGrandes = null;
    niegaMedidasGrandes = true;
  } else if (
    !modificoDatosCotizacion &&
    accion !== 'DERIVAR_HUMANO'
  ) {
    pideConfirmacionMedidasGrandes = true;
    accion = 'RESPONDER_GENERAL';
  }
}

const medidasGrandesConfirmadasEsteTurno =
  confirmacionMedidasGrandes?.confirmadas === true &&
  igualesNumero(confirmacionMedidasGrandes.ancho_cm, anchoCm) &&
  igualesNumero(confirmacionMedidasGrandes.alto_cm, altoCm);

if (
  accion === 'COTIZAR_P4' &&
  !derivacionPorCantidad &&
  !derivacionPorProductoNoP4 &&
  precio1000Estimado !== null &&
  precio1000Estimado > LIMITE_CONFIRMACION_PRECIO_1000 &&
  !medidasGrandesYaConfirmadas &&
  !medidasGrandesConfirmadasEsteTurno
) {
  pideConfirmacionMedidasGrandes = true;
  accion = 'RESPONDER_GENERAL';
  confirmacionMedidasGrandes = {
    pendiente: true,
    confirmadas: false,
    ancho_cm: anchoCm,
    alto_cm: altoCm,
    forma,
    cantidad: cantidadCotizable,
    precio_1000_estimado: precio1000Estimado,
    solicitada_at: new Date().toISOString()
  };
}


// ======================================================
// 12. RESPUESTA SUGERIDA
// ======================================================

let respuestaSugerida =
  texto(
    data.respuesta_sugerida
  ) ?? '';

if (pideConfirmacionMedidasGrandes) {
  const anchoTxt =
    formatoMedidaCm(
      confirmacionMedidasGrandes?.ancho_cm ?? anchoCm
    );
  const altoTxt =
    formatoMedidaCm(
      confirmacionMedidasGrandes?.alto_cm ?? altoCm
    );

  respuestaSugerida =
    `Solo por confirmar: ¿requiere sus etiquetas de ${anchoTxt}x${altoTxt} cm? ` +
    `Le consulto porque son medidas grandes y el precio se calcula en base a ellas. ` +
    `Confírmenos por favor si esas son las medidas correctas en las que necesita sus etiquetas.`;
}

else if (niegaMedidasGrandes) {
  respuestaSugerida =
    'Entendido. Indíquenos por favor las medidas correctas de sus etiquetas (ancho y alto en centímetros) para cotizarle.';
}

else if (
  accion === 'PEDIR_MEDIDAS'
) {
  respuestaSugerida =
    '¿En qué medidas necesita sus etiquetas? Indíquenos ancho y alto por favor.';
}

else if (
  accion === 'ENVIAR_DATOS_PAGO'
) {
  respuestaSugerida =
    'Le adjunto nuestros datos personales 📃 y números de cuentas 🏦';
}

else if (
  accion === 'INFORMAR_TARJETAS'
) {
  respuestaSugerida =
    'Le adjunto videos y precios de los acabados que manejamos en tarjetas de presentación';
}

else if (
  accion === 'INFORMAR_FLYERS'
) {
  respuestaSugerida =
    'Le adjunto tamaños y precios de volantes / flyers (1000 unidades):\n\n' +
    'A6 (10.5 x 14.8 cm)\n' +
    '• 1 lado: $20\n' +
    '• 2 lados: $26\n\n' +
    'A5 (21 x 14.8 cm)\n' +
    '• 1 lado: $32\n' +
    '• 2 lados: $41';
}

else if (
  accion === 'COTIZAR_P4' ||
  derivacionPorCantidad
) {
  respuestaSugerida =
    '';
}

if (
  !pideConfirmacionMedidasGrandes &&
  !niegaMedidasGrandes &&
  ajusteRecotizacion === 'PIDE_OTRAS_MEDIDAS'
) {
  respuestaSugerida =
    'Indíquenos por favor las nuevas medidas de sus etiquetas (ancho y alto en centímetros) para cotizarle.';
}

else if (
  !pideConfirmacionMedidasGrandes &&
  !niegaMedidasGrandes &&
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
  ajusteRecotizacion !== 'PIDE_OTRAS_MEDIDAS' &&
  !pideConfirmacionMedidasGrandes &&
  !niegaMedidasGrandes
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
    // La publicidad o el bot ya pidieron medidas. No se calla:
    // se acota qué falta (ancho y alto) para poder cotizar.
    // Si el texto queda idéntico al último saliente,
    // "Preparar respuesta comercial" sí lo omite.
    preguntaMedidasFaltantes =
      'el ancho y el alto';

    respuestaSugerida =
      'Para enviarle el precio indíquenos por favor el ancho y el alto de sus etiquetas en centímetros. Con esos datos le cotizamos de inmediato.';
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
  !pideConfirmacionMedidasGrandes &&
  !niegaMedidasGrandes &&
  !['COTIZAR_P4', 'DERIVAR_HUMANO', 'INFORMAR_TARJETAS', 'INFORMAR_FLYERS'].includes(accion);

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
  !pideConfirmacionMedidasGrandes &&
  !niegaMedidasGrandes &&
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
// 12.4b LÍNEA DE PRODUCTO (TARJETAS vs ETIQUETAS)
// ------------------------------------------------------
//
// Precios y entregas no se mezclan. Si el turno nombra
// etiquetas/stickers, la línea es ETIQUETAS. Si nombra
// tarjetas (sin etiquetas) o la acción es INFORMAR_TARJETAS,
// la línea es TARJETAS_PRESENTACION. Si nombra ambos, no
// se cambia la línea persistida (el cerebro debe aclarar).
//
// ------------------------------------------------------

const MENCIONA_ETIQUETA_TURNO =
  /\b(etiquetas?|stickers?|adhesiv[oa]s?|calcomanias?|pegatinas?|rotulos?|vinil|viniles)\b/;

const MENCIONA_TARJETAS_TURNO =
  /\btarjetas?( de (presentacion|visita|negocio|negocios)| personales?| corporativas?)?\b|\bestampitas?\b/;

const MENCIONA_FLYERS_TURNO =
  /\b(flyers?|flayers?|volantes?)\b/;

const mencionaEtiquetaTurno =
  MENCIONA_ETIQUETA_TURNO.test(mensajeTurnoPlano);

const mencionaTarjetasTurno =
  MENCIONA_TARJETAS_TURNO.test(mensajeTurnoPlano);

const mencionaFlyersTurno =
  MENCIONA_FLYERS_TURNO.test(mensajeTurnoPlano);

const productoLineaAnterior =
  texto(contextoAnterior.producto_linea);

let productoLinea =
  productoLineaAnterior;

const mezclaLineasTurno =
  [
    mencionaEtiquetaTurno,
    mencionaTarjetasTurno,
    mencionaFlyersTurno
  ].filter(Boolean).length > 1;

if (mezclaLineasTurno) {
  productoLinea =
    productoLineaAnterior;
} else if (mencionaEtiquetaTurno) {
  productoLinea =
    'ETIQUETAS';
} else if (
  accion === 'INFORMAR_TARJETAS' ||
  productoTarjetas !== null ||
  mencionaTarjetasTurno
) {
  productoLinea =
    'TARJETAS_PRESENTACION';
} else if (
  accion === 'INFORMAR_FLYERS' ||
  productoFlyers !== null ||
  mencionaFlyersTurno
) {
  productoLinea =
    'FLYERS_VOLANTES';
}

const esLineaTarjetas =
  productoLinea === 'TARJETAS_PRESENTACION' &&
  !mencionaEtiquetaTurno &&
  !mencionaFlyersTurno;

const esLineaFlyers =
  productoLinea === 'FLYERS_VOLANTES' &&
  !mencionaEtiquetaTurno &&
  !mencionaTarjetasTurno;


// ------------------------------------------------------
// 12.5 IMAGEN INFORMATIVA (MATERIAL / METODOLOGÍA / DATOS PAGO)
// ------------------------------------------------------
//
// Las respuestas de material, metodología de producción y
// datos bancarios van acompañadas de una imagen configurada
// en configuracion_bot (valor_json { activo, url }), una sola
// vez por conversación y por imagen: el contexto comercial
// guarda cuándo se envió cada una. "Preparar envío
// WhatsApp" la manda antes del texto.
//
// METODOLOGIA cubre INFORMAR_ENTREGA (tiempos, despacho),
// INFORMAR_METODOLOGIA y la respuesta de metodología que
// reemplaza a una fecha pedida (12.3).
//
// DATOS_PAGO cubre ENVIAR_DATOS_PAGO (números de cuenta).
//
// ------------------------------------------------------

const IMAGENES_INFORMATIVAS = {
  MATERIAL: {
    clave: 'IMAGEN_MATERIAL',
    contexto: 'imagen_material'
  },
  METODOLOGIA: {
    clave: 'IMAGEN_METODOLOGIA',
    contexto: 'imagen_metodologia'
  },
  DATOS_PAGO: {
    clave: 'IMAGEN_DATOS_PAGO',
    contexto: 'imagen_datos_pago'
  }
};

const temaImagenInformativa =
  aplicaMetodologia ||
  ['INFORMAR_ENTREGA', 'INFORMAR_METODOLOGIA'].includes(accion)
    ? 'METODOLOGIA'
    : accion === 'INFORMAR_MATERIAL'
      ? 'MATERIAL'
      : accion === 'ENVIAR_DATOS_PAGO'
        ? 'DATOS_PAGO'
        : null;

const imagenInformativa =
  temaImagenInformativa !== null
    ? IMAGENES_INFORMATIVAS[temaImagenInformativa]
    : null;

let filasConfiguracion = [];

try {
  filasConfiguracion =
    $('Obtener configuración MODO_PRUEBA')
      .all()
      .map(item => item.json ?? {});
} catch (_) {
  filasConfiguracion = [];
}

const configImagenInformativa =
  imagenInformativa !== null
    ? objeto(
        filasConfiguracion.find(
          fila => fila.clave === imagenInformativa.clave
        )?.valor_json
      )
    : {};

const urlConfiguradaImagenInformativa =
  texto(configImagenInformativa.url);

const urlImagenInformativa =
  configImagenInformativa.activo === true &&
  urlConfiguradaImagenInformativa !== null &&
  /^https:\/\/\S+$/i.test(urlConfiguradaImagenInformativa)
    ? urlConfiguradaImagenInformativa
    : null;

const imagenInformativaYaEnviada =
  imagenInformativa !== null &&
  texto(
    objeto(contextoAnterior[imagenInformativa.contexto]).enviada_at
  ) !== null;

const enviarImagenInformativa =
  !esLineaTarjetas &&
  !esLineaFlyers &&
  accion !== 'INFORMAR_TARJETAS' &&
  accion !== 'INFORMAR_FLYERS' &&
  imagenInformativa !== null &&
  !omitirEnvio &&
  urlImagenInformativa !== null &&
  !imagenInformativaYaEnviada;


// ------------------------------------------------------
// 12.6 CATÁLOGO VIDEOS TARJETAS
// ------------------------------------------------------

const CATALOGO_TARJETAS_DEFAULT = [
  {
    clave: 'UV_BRILLANTE',
    url: 'https://pegasoadhesivos.com/wp-content/uploads/2026/10/Tarjetas-UV-Brillantes.mp4',
    caption: 'Este es el acabado UV brillante 1000 tarjetas en $24.00 dólares'
  },
  {
    clave: 'MATE',
    url: 'https://pegasoadhesivos.com/wp-content/uploads/2026/10/Tarjetas-Mates.mp4',
    caption: 'Este es el acabado Mate normal 1000 tarjetas en $30.00 dólares.'
  },
  {
    clave: 'UV_SELECTIVO',
    url: 'https://pegasoadhesivos.com/wp-content/uploads/2026/10/Tarjetas-UV-Selectivas.mp4',
    caption:
      'Este es el acabado Mate  + UV Selectivo 1000 tarjetas en $40.00 dólares\n*Con las puntas redondeadas le saldría en $45.00 dólares.'
  },
  {
    clave: 'PAN_DE_ORO',
    url: 'https://pegasoadhesivos.com/wp-content/uploads/2026/10/Tarjetas-Mate-Pan-de-Oro.mp4',
    caption:
      'Este es el acabado Mate  + Pan de Oro 1000 tarjetas en $95.00 dólares\n*Con las puntas redondeadas le saldría en $100.00 dólares.'
  }
];

const configCatalogoTarjetas =
  objeto(
    filasConfiguracion.find(
      fila => fila.clave === 'CATALOGO_TARJETAS'
    )?.valor_json
  );

const videosConfigurados = Array.isArray(configCatalogoTarjetas.videos)
  ? configCatalogoTarjetas.videos
  : CATALOGO_TARJETAS_DEFAULT;

const videosTarjetasValidos = videosConfigurados
  .map(v => ({
    clave: texto(v?.clave),
    url: texto(v?.url),
    caption: String(v?.caption ?? '').trim()
  }))
  .filter(v =>
    v.url !== null &&
    /^https:\/\/\S+$/i.test(v.url) &&
    v.caption !== ''
  )
  .slice(0, 4);

const catalogoTarjetasActivo =
  configCatalogoTarjetas.activo !== false;

const catalogoTarjetasYaEnviado =
  texto(
    objeto(contextoAnterior.catalogo_tarjetas).enviada_at
  ) !== null;

const enviarVideosTarjetas =
  accion === 'INFORMAR_TARJETAS' &&
  !omitirEnvio &&
  catalogoTarjetasActivo &&
  videosTarjetasValidos.length > 0 &&
  !catalogoTarjetasYaEnviado;


// ------------------------------------------------------
// 12.6b CATÁLOGO IMAGEN FLYERS
// ------------------------------------------------------

const IMAGEN_FLYERS_DEFAULT =
  'https://pegasoadhesivos.com/wp-content/uploads/2026/10/Volantes_Mesa-de-trabajo-1-copia-scaled.jpg';

const RESPUESTA_CIERRE_CATALOGO_FLYERS =
  'Le adjunto tamaños y precios de volantes / flyers (1000 unidades):\n\n' +
  'A6 (10.5 x 14.8 cm)\n' +
  '• 1 lado: $20\n' +
  '• 2 lados: $26\n\n' +
  'A5 (21 x 14.8 cm)\n' +
  '• 1 lado: $32\n' +
  '• 2 lados: $41';

function urlPublicaHttps(valor) {
  const cruda =
    texto(valor);

  if (cruda === null) {
    return null;
  }

  const sinEspacios =
    cruda.replace(/\s+/g, '');

  return /^https:\/\/\S+$/i.test(sinEspacios)
    ? sinEspacios
    : null;
}

function urlImagenParaWhatsApp(url) {
  const prefijoOrigen =
    'https://pegasoadhesivos.com/wp-content/uploads/';

  if (url.indexOf(prefijoOrigen) !== 0) {
    return url;
  }

  const ruta =
    url.slice('https://'.length).split('?')[0];

  return (
    'https://i0.wp.com/' +
    ruta +
    '?fit=1600,1600&ssl=1'
  );
}

const configCatalogoFlyers =
  objeto(
    filasConfiguracion.find(
      fila => fila.clave === 'CATALOGO_FLYERS' || fila.clave === 'IMAGEN_FLYERS'
    )?.valor_json
  );

const urlFlyersOrigen =
  urlPublicaHttps(configCatalogoFlyers.url) ??
  IMAGEN_FLYERS_DEFAULT;

const urlImagenFlyers =
  configCatalogoFlyers.activo !== false &&
  urlFlyersOrigen !== null
    ? urlImagenParaWhatsApp(urlFlyersOrigen)
    : null;

const catalogoFlyersYaEnviado =
  texto(
    objeto(contextoAnterior.catalogo_flyers).enviada_at
  ) !== null;

const primerEnvioCatalogoFlyers =
  accion === 'INFORMAR_FLYERS' &&
  !omitirEnvio &&
  urlImagenFlyers !== null &&
  !catalogoFlyersYaEnviado;


// ------------------------------------------------------
// 12.7 RESPUESTAS DE TARJETAS (SIN MEZCLAR ETIQUETAS)
// ------------------------------------------------------

const RESPUESTA_CIERRE_CATALOGO_TARJETAS =
  'Le adjunto videos y precios de los acabados que manejamos en tarjetas de presentación';

const RESPUESTA_MATERIAL_TARJETAS =
  'Las tarjetas de presentación se imprimen en papel Couche de 300 gr, medida estándar 9x5 cm.';

const RESPUESTA_ENTREGA_TARJETAS =
  'Para tarjetas: si el pedido ingresa con abono lunes o martes, se envía el miércoles; ' +
  'si ingresa miércoles o jueves, se envía el viernes.';

const RESPUESTA_CARAS_TARJETAS =
  'La impresión puede ser a una o ambas caras; el precio es el mismo. ' +
  'Comúnmente se imprime por los dos lados.';

const RESPUESTA_MINIMO_TARJETAS =
  'El mínimo es 1000 unidades por diseño, del mismo diseño; no se divide en varios. ' +
  'Otras medidas en Couche 300 gr (por ejemplo estampitas de 18x10 cm) se calculan en múltiplos de la tarjeta 9x5 cm.';

const RESPUESTA_ACABADO_TARJETAS =
  'Los acabados y precios están en los videos que le envié. ¿Qué acabado le gustaría?';

function saludoHorarioTarjetas(textoPlanoTurno) {
  if (/\bnoches?\b/.test(textoPlanoTurno)) {
    return 'Buenas noches';
  }

  if (/\btardes?\b/.test(textoPlanoTurno)) {
    return 'Buenas tardes';
  }

  if (/\bdias?\b/.test(textoPlanoTurno)) {
    return 'Buenos días';
  }

  const horaEcuador =
    new Date(Date.now() - 5 * 3600 * 1000).getUTCHours();

  if (horaEcuador >= 5 && horaEcuador < 12) {
    return 'Buenos días';
  }

  if (horaEcuador >= 12 && horaEcuador < 19) {
    return 'Buenas tardes';
  }

  return 'Buenas noches';
}

const PATRON_CARAS_TARJETAS =
  /\b((a )?(una|1|dos|2) caras?|ambos lados|un lado|doble cara|una sola cara)\b/;

const PATRON_MATERIAL_TARJETAS =
  /\b(material|couche|papel|cartulina|gramaje)\b/;

const PATRON_ENTREGA_TARJETAS =
  /\b(tiempos?|demora|entregas?|envios?|para cuando|cuando (me )?(las |los )?(entregan|tienen|salen)|en cuantos dias|cuanto (se )?demora|metodologia)\b/;

const PATRON_MINIMO_TARJETAS =
  /\b(minimo|minimos|1000 por diseno|varios disenos|dividir|estampitas?)\b/;

let textoSaludoTarjetas = null;

let derivacionPorFlyerDesconocido = false;

if (enviarVideosTarjetas || primerEnvioCatalogoFlyers) {
  if (sesionConversacionalNueva) {
    textoSaludoTarjetas =
      `${saludoHorarioTarjetas(mensajeTurnoPlano)}. Con gusto atenderemos su requerimiento`;
  }

  if (enviarVideosTarjetas) {
    respuestaSugerida =
      RESPUESTA_CIERRE_CATALOGO_TARJETAS;
  }

  if (primerEnvioCatalogoFlyers) {
    respuestaSugerida =
      RESPUESTA_CIERRE_CATALOGO_FLYERS;
  }
} else if (
  esLineaTarjetas &&
  accion !== 'DERIVAR_HUMANO' &&
  accion !== 'ENVIAR_DATOS_PAGO' &&
  !omitirEnvio
) {
  if (PATRON_CARAS_TARJETAS.test(mensajeTurnoPlano)) {
    respuestaSugerida =
      RESPUESTA_CARAS_TARJETAS;

    if (['COTIZAR_P4', 'PEDIR_MEDIDAS', 'INFORMAR_TARJETAS'].includes(accion)) {
      accion = 'RESPONDER_GENERAL';
    }
  } else if (
    accion === 'INFORMAR_MATERIAL' ||
    PATRON_MATERIAL_TARJETAS.test(mensajeTurnoPlano)
  ) {
    respuestaSugerida =
      RESPUESTA_MATERIAL_TARJETAS;

    if (accion !== 'INFORMAR_MATERIAL') {
      accion = 'INFORMAR_MATERIAL';
    }
  } else if (
    accion === 'INFORMAR_ENTREGA' ||
    accion === 'INFORMAR_METODOLOGIA' ||
    aplicaMetodologia ||
    PATRON_ENTREGA_TARJETAS.test(mensajeTurnoPlano)
  ) {
    respuestaSugerida =
      RESPUESTA_ENTREGA_TARJETAS;

    if (!['INFORMAR_ENTREGA', 'INFORMAR_METODOLOGIA'].includes(accion)) {
      accion = 'INFORMAR_ENTREGA';
    }
  } else if (
    accion === 'INFORMAR_MINIMO' ||
    PATRON_MINIMO_TARJETAS.test(mensajeTurnoPlano)
  ) {
    respuestaSugerida =
      RESPUESTA_MINIMO_TARJETAS;

    if (accion !== 'INFORMAR_MINIMO') {
      accion = 'INFORMAR_MINIMO';
    }
  } else if (
    accion === 'COTIZAR_P4' ||
    accion === 'PEDIR_MEDIDAS'
  ) {
    accion = 'RESPONDER_GENERAL';
    respuestaSugerida =
      'Para tarjetas de presentación el precio es por acabado, en 1000 unidades del mismo diseño (9x5 cm). ' +
      '¿Qué acabado le gustaría? Si busca etiquetas adhesivas, indíquenos por favor las medidas.';
  } else if (accion === 'INFORMAR_TARJETAS') {
    respuestaSugerida =
      RESPUESTA_ACABADO_TARJETAS;
  }
} else if (
  esLineaFlyers &&
  accion !== 'ENVIAR_DATOS_PAGO' &&
  !omitirEnvio
) {
  const RESPUESTA_MATERIAL_FLYERS =
    'Los volantes / flyers se imprimen en papel Couche de 115 gr.';

  const RESPUESTA_ENTREGA_FLYERS =
    'Para volantes / flyers: si el pedido ingresa con abono lunes o martes, se envía el miércoles; ' +
    'si ingresa miércoles o jueves, se envía el viernes.';

  const RESPUESTA_CARAS_FLYERS =
    'En volantes el precio cambia según 1 o 2 caras, en 1000 unidades: ' +
    'A6 $20 / $26 y A5 $32 / $41.';

  const PATRON_CARAS_FLYERS =
    /\b((a )?(una|1|dos|2) (lado|lados|caras?)|ambos lados|un lado|doble cara|una sola cara)\b/;

  const PATRON_MATERIAL_FLYERS =
    /\b(material|couche|papel|cartulina|gramaje)\b/;

  const PATRON_ENTREGA_FLYERS =
    /\b(tiempos?|demora|entregas?|envios?|para cuando|cuando (me )?(las |los )?(entregan|tienen|salen)|en cuantos dias|cuanto (se )?demora|metodologia)\b/;

  const PATRON_TAMANO_FLYERS =
    /\b(a5|a6|10\.?5\s*x\s*14|21\s*x\s*14)\b/;

  const PATRON_DESCONOCIDO_FLYERS =
    /\b(a[234]|oficio|carta|tabloide|plastific|laminad|uv select|pantone|oro|relieve|urgente|otro papel|adhesiv|sticker|etiqueta)\b/;

  const preguntaAbierta =
    /\?/.test(mensajeTurnoPlano) ||
    /\b(pueden|podemos|hacen|hacemos|tienen|tienenos|se puede|se podra)\b/.test(
      mensajeTurnoPlano
    );

  if (PATRON_DESCONOCIDO_FLYERS.test(mensajeTurnoPlano)) {
    accion = 'DERIVAR_HUMANO';
    derivacionPorFlyerDesconocido = true;
    respuestaSugerida =
      'Permítame un momento por favor, verificamos su requerimiento.';
  } else if (PATRON_CARAS_FLYERS.test(mensajeTurnoPlano)) {
    respuestaSugerida =
      RESPUESTA_CARAS_FLYERS;

    if (['COTIZAR_P4', 'PEDIR_MEDIDAS', 'INFORMAR_FLYERS', 'DERIVAR_HUMANO'].includes(accion)) {
      accion = 'RESPONDER_GENERAL';
    }
  } else if (
    accion === 'INFORMAR_MATERIAL' ||
    PATRON_MATERIAL_FLYERS.test(mensajeTurnoPlano)
  ) {
    respuestaSugerida =
      RESPUESTA_MATERIAL_FLYERS;

    accion = 'INFORMAR_MATERIAL';
  } else if (
    accion === 'INFORMAR_ENTREGA' ||
    accion === 'INFORMAR_METODOLOGIA' ||
    aplicaMetodologia ||
    PATRON_ENTREGA_FLYERS.test(mensajeTurnoPlano)
  ) {
    respuestaSugerida =
      RESPUESTA_ENTREGA_FLYERS;

    accion = 'INFORMAR_ENTREGA';
  } else if (
    PATRON_TAMANO_FLYERS.test(mensajeTurnoPlano) ||
    /\b(precio|precios|vale|valor|cuanto (sale|cuesta|queda|es)|a como)\b/.test(
      mensajeTurnoPlano
    )
  ) {
    respuestaSugerida =
      RESPUESTA_CIERRE_CATALOGO_FLYERS;

    if (['COTIZAR_P4', 'PEDIR_MEDIDAS', 'DERIVAR_HUMANO'].includes(accion)) {
      accion = 'RESPONDER_GENERAL';
    }
  } else if (
    accion === 'COTIZAR_P4' ||
    accion === 'PEDIR_MEDIDAS'
  ) {
    accion = 'RESPONDER_GENERAL';
    respuestaSugerida =
      'Los volantes / flyers se trabajan en 1000 unidades, tamaños A6 y A5, a 1 o 2 caras. ' +
      '¿Cuál tamaño y de cuántos lados necesita?';
  } else if (accion === 'INFORMAR_FLYERS') {
    respuestaSugerida =
      RESPUESTA_CIERRE_CATALOGO_FLYERS;
  } else if (
    preguntaAbierta &&
    !['INFORMAR_UBICACION', 'INFORMAR_METODOLOGIA_PAGO', 'INFORMAR_DISENO'].includes(accion)
  ) {
    accion = 'DERIVAR_HUMANO';
    derivacionPorFlyerDesconocido = true;
    respuestaSugerida =
      'Permítame un momento por favor, verificamos su requerimiento.';
  }
}

const enviarImagenFlyers =
  !omitirEnvio &&
  urlImagenFlyers !== null &&
  respuestaSugerida === RESPUESTA_CIERRE_CATALOGO_FLYERS;


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
    enviarImagenInformativa
      ? {
          [imagenInformativa.contexto]: {
            url: urlImagenInformativa,
            enviada_at: new Date().toISOString()
          }
        }
      : {}
  ),

  ...(
    enviarVideosTarjetas
      ? {
          catalogo_tarjetas: {
            videos: videosTarjetasValidos.map(v => v.clave),
            enviada_at: new Date().toISOString()
          }
        }
      : {}
  ),

  ...(
    enviarImagenFlyers
      ? {
          catalogo_flyers: {
            url: urlFlyersOrigen,
            enviada_at: new Date().toISOString()
          }
        }
      : {}
  ),

  ...(
    productoLinea
      ? { producto_linea: productoLinea }
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

if (confirmacionMedidasGrandes !== null) {
  contextoComercialNuevo.confirmacion_medidas_grandes =
    confirmacionMedidasGrandes;
} else {
  delete contextoComercialNuevo.confirmacion_medidas_grandes;
}


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
          : (
            accion === 'COTIZAR_P4' &&
            recotizacionPorCantidadNueva
              ? {
                  requiere_humano:
                    false,

                  motivo_derivacion:
                    'NINGUNO',

                  requiere_notificacion:
                    false,

                  intencion:
                    'APORTAR_DATOS'
                }
              : {}
          )
      ),

      explicar_calculo_precio_cantidad:
        accion === 'COTIZAR_P4' &&
        modificoCantidad &&
        cotizacionVigente,

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

      ...(
        derivacionPorFlyerDesconocido
          ? {
              requiere_humano:
                true,

              motivo_derivacion:
                'COTIZACION_ESPECIAL',

              requiere_notificacion:
                true,

              regla_derivacion:
                'FLYER_NO_CATALOGADO'
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

      pide_confirmacion_medidas_grandes:
        pideConfirmacionMedidasGrandes,

      precio_1000_estimado:
        precio1000Estimado,

      enviar_imagen_informativa:
        enviarImagenInformativa,

      imagen_informativa:
        enviarImagenInformativa
          ? temaImagenInformativa
          : null,

      imagen_informativa_url:
        enviarImagenInformativa
          ? urlImagenInformativa
          : null,

      enviar_videos_tarjetas:
        enviarVideosTarjetas,

      videos_tarjetas:
        enviarVideosTarjetas
          ? videosTarjetasValidos
          : [],

      texto_saludo_tarjetas:
        textoSaludoTarjetas,

      enviar_nota_iva:
        enviarVideosTarjetas ||
        (
          enviarImagenFlyers &&
          !catalogoFlyersYaEnviado
        ),

      texto_nota_iva:
        (
          enviarVideosTarjetas ||
          (
            enviarImagenFlyers &&
            !catalogoFlyersYaEnviado
          )
        )
          ? '*Los precios adjuntos no incluyen IVA*'
          : null,

      enviar_imagen_flyers:
        enviarImagenFlyers,

      imagen_flyers_url:
        enviarImagenFlyers
          ? urlImagenFlyers
          : null,

      producto_tarjetas:
        productoTarjetas ??
        (
          accion === 'INFORMAR_TARJETAS'
            ? 'tarjetas de presentación'
            : null
        ),

      producto_flyers:
        productoFlyers ??
        (
          accion === 'INFORMAR_FLYERS'
            ? 'flyers / volantes'
            : null
        ),

      datos_suficientes_para_cotizar:
        datosSuficientes,

      respuesta_sugerida:
        respuestaSugerida,

      contexto_comercial:
        contextoComercialNuevo
    }
  }
];
