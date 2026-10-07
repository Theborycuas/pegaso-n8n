// ======================================================
// NORMALIZAR DECISIÓN IA - V2
// ======================================================
// Recibe una decisión YA VALIDADA.
// A partir de este nodo no importa qué modelo respondió.
//
// Además:
// - conserva contexto;
// - resuelve ciudad/provincia;
// - impide degradar clasificación A/B/C;
// - calcula etiqueta_grande;
// - calcula banderas operativas;
// - normaliza derivación/notificación.
// ======================================================

const input = $json;

const decision =
  input.output ??
  input.data ??
  input.resultado ??
  input.decision ??
  input;


// ======================================================
// 1. HELPERS
// ======================================================

function texto(valor, defecto = null) {
  if (
    valor === undefined ||
    valor === null
  ) {
    return defecto;
  }

  const limpio =
    String(valor).trim();

  return limpio !== ''
    ? limpio
    : defecto;
}

function numero(valor) {
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

function booleano(valor, defecto = false) {
  if (typeof valor === 'boolean') {
    return valor;
  }

  if (
    valor === 'true' ||
    valor === 1 ||
    valor === '1'
  ) {
    return true;
  }

  if (
    valor === 'false' ||
    valor === 0 ||
    valor === '0'
  ) {
    return false;
  }

  return defecto;
}

function rankingClasificacion(valor) {
  const v =
    texto(valor, 'C').toUpperCase();

  if (v === 'A') return 3;
  if (v === 'B') return 2;
  return 1;
}

function clasificacionPorEstado(estado) {
  const v =
    texto(estado, '').toUpperCase();

  if (
    [
      'INTERESADO',
      'ACEPTADO',
      'PAGO_PENDIENTE',
      'ABONO_REPORTADO',
      'EN_PROCESO'
    ].includes(v)
  ) {
    return 'A';
  }

  if (
    [
      'COTIZADO',
      'CALIFICADO',
      'EN_SEGUIMIENTO',
      'CONTACTADO'
    ].includes(v)
  ) {
    return 'B';
  }

  return 'C';
}

function maxClasificacion(...valores) {
  let mejor = 'C';
  let mejorRank = 1;

  for (const valor of valores) {
    const v =
      texto(valor, 'C').toUpperCase();

    const rank =
      rankingClasificacion(v);

    if (rank > mejorRank) {
      mejor = v;
      mejorRank = rank;
    }
  }

  return mejor;
}


// ======================================================
// 2. DECISIÓN COMERCIAL
// ======================================================

const intencion =
  texto(
    decision.intencion,
    'OTRO'
  ).toUpperCase();

const accion =
  texto(
    decision.accion,
    'RESPONDER_GENERAL'
  ).toUpperCase();

let respuestaSugerida =
  texto(
    decision.respuesta_sugerida,
    ''
  );


// ======================================================
// 3. DATOS EXTRAÍDOS
// ======================================================

const producto =
  texto(decision.producto);

const material =
  texto(decision.material);

const cantidad =
  numero(decision.cantidad);

const anchoCm =
  numero(decision.ancho_cm);

const altoCm =
  numero(decision.alto_cm);

const forma =
  texto(
    decision.forma,
    'NO_ESPECIFICADA'
  ).toUpperCase();

const ciudadDetectada =
  texto(
    decision.ciudad_detectada
  );

const provinciaDetectada =
  texto(
    decision.provincia_detectada
  );


// ======================================================
// 4. CONTROL IA
// ======================================================

const datosSuficientes =
  booleano(
    decision.datos_suficientes_para_cotizar,
    false
  );

const requiereHumano =
  booleano(
    decision.requiere_humano,
    false
  );

const motivoDerivacion =
  texto(
    decision.motivo_derivacion,
    'NINGUNO'
  ).toUpperCase();


// ======================================================
// 4.1. NORMALIZACIÓN DE TONO V2.1
// ======================================================
//
// Defensa adicional después de validar:
// - elimina 😊;
// - elimina aperturas robóticas si algún proveedor las deja;
// - no modifica mensajes de transición humana salvo el emoji.
// ======================================================

respuestaSugerida =
  respuestaSugerida
    .replace(/😊/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();

if (
  requiereHumano !== true
) {
  respuestaSugerida =
    respuestaSugerida
      .replace(/^¡?Perfecto!?\s*[,.!:-]*\s*/i, '')
      .replace(/^Entendemos\s*[,.!:-]*\s*/i, '')
      .replace(/^Con gusto le explico\s*[,.!:-]*\s*/i, '')
      .replace(/^Con mucho gusto\s*[,.!:-]*\s*/i, '')
      .trim();
}


// ======================================================
// 5. RECUPERAR CONTEXTO REAL
// ======================================================

let contexto = {};

try {
  contexto =
    $('Preparar contexto IA').first().json ?? {};
} catch (e) {
  contexto = {};
}


// ======================================================
// 6. IDS
// ======================================================

const conversacionId =
  numero(contexto.conversacion_id);

const clienteId =
  numero(contexto.cliente_id);

const contactoId =
  numero(contexto.contacto_id);

const prospectoId =
  numero(contexto.prospecto_id);


// ======================================================
// 7. PROSPECTO
// ======================================================

const prospectoExiste =
  prospectoId !== null ||
  booleano(
    contexto.prospecto_existe,
    false
  );

const prospectoEstado =
  texto(
    contexto.prospecto_estado
  );

const prospectoNombre =
  texto(
    contexto.prospecto_nombre
  );

const prospectoProductoInteres =
  texto(
    contexto.prospecto_producto_interes
  );

const prospectoCiudadAnterior =
  texto(
    contexto.prospecto_ciudad
  );

const prospectoProvinciaAnterior =
  texto(
    contexto.prospecto_provincia
  );

const prospectoCiudadResuelta =
  ciudadDetectada ??
  prospectoCiudadAnterior;

const prospectoProvinciaResuelta =
  provinciaDetectada ??
  prospectoProvinciaAnterior;

const prospectoUltimaIntencion =
  texto(
    contexto.prospecto_ultima_intencion
  );

const prospectoUltimaAccion =
  texto(
    contexto.prospecto_ultima_accion
  );

const prospectoRequiereHumano =
  booleano(
    contexto.prospecto_requiere_humano,
    false
  );


// ======================================================
// 8. TIPO DE ACTOR
// ======================================================

let tipoActor =
  texto(
    contexto.tipo_actor
  );

if (!tipoActor) {
  if (
    booleano(
      contexto.es_cliente_registrado,
      false
    ) ||
    clienteId !== null
  ) {
    tipoActor = 'CLIENTE';
  } else if (
    prospectoId !== null
  ) {
    tipoActor = 'PROSPECTO';
  } else if (
    contactoId !== null
  ) {
    tipoActor = 'CONTACTO';
  } else {
    tipoActor = 'DESCONOCIDO';
  }
}

tipoActor =
  tipoActor.toUpperCase();


// ======================================================
// 9. CLASIFICACIÓN A/B/C
// ======================================================
//
// Nunca degradamos:
// A -> B/C NO
// B -> C   NO
//
// La IA propone, pero estas reglas fijan un mínimo.
// ======================================================

const clasificacionAnterior =
  texto(
    contexto.prospecto_clasificacion
  )?.toUpperCase() ??
  clasificacionPorEstado(
    prospectoEstado
  );

let clasificacionMinima =
  'C';

if (
  accion === 'COTIZAR_P4' ||
  [
    'CONSULTAR_PRECIO',
    'CONSULTAR_MATERIAL',
    'CONSULTAR_MINIMO',
    'CONSULTAR_UBICACION',
    'CONSULTAR_METODOLOGIA',
    'CONSULTAR_ENTREGA',
    'CONSULTAR_DISENO',
    'CONSULTAR_PAGO'
  ].includes(intencion)
) {
  clasificacionMinima =
    'B';
}

if (
  intencion === 'ACEPTAR_COTIZACION' ||
  intencion === 'CONFIRMAR_PEDIDO' ||
  intencion === 'REPORTAR_PAGO' ||
  motivoDerivacion === 'SOLICITA_DATOS_PAGO' ||
  motivoDerivacion === 'ENVIA_COMPROBANTE'
) {
  clasificacionMinima =
    'A';
}

const clasificacionIA =
  texto(
    decision.clasificacion_prospecto,
    'C'
  ).toUpperCase();

const clasificacionProspecto =
  maxClasificacion(
    clasificacionAnterior,
    clasificacionIA,
    clasificacionMinima
  );


// ======================================================
// 10. ETIQUETA GRANDE
// ======================================================
//
// Regla comercial:
// supera 10 x 15 cm, sin importar orientación.
//
// Normalizamos lados:
// corto <= largo
//
// Grande cuando:
// corto > 10
// O
// largo > 15
// ======================================================

let etiquetaGrande =
  false;

if (
  anchoCm !== null &&
  altoCm !== null
) {
  const ladoCorto =
    Math.min(
      anchoCm,
      altoCm
    );

  const ladoLargo =
    Math.max(
      anchoCm,
      altoCm
    );

  etiquetaGrande =
    ladoCorto > 10 ||
    ladoLargo > 15;
}


// ======================================================
// 11. BANDERAS DE CONTINUIDAD
// ======================================================

const debePedirCiudadDespuesCotizacion =
  accion === 'COTIZAR_P4' &&
  !prospectoCiudadResuelta;

const cierreCordial =
  intencion === 'POSPONER_DECISION';


// ======================================================
// 12. NOTIFICACIÓN Y PRIORIDAD
// ======================================================
//
// Toda derivación humana genera notificación interna.
// No confiamos únicamente en el booleano emitido por IA.
// ======================================================

const requiereNotificacion =
  requiereHumano === true;

let prioridadDerivacion =
  'NORMAL';

if (
  [
    'SOLICITA_DATOS_PAGO',
    'REPORTA_PAGO',
    'ENVIA_COMPROBANTE',
    'CONFIRMAR_PEDIDO',
    'RECLAMO',
    'PROBLEMA_PAGO',
    'PROBLEMA_PEDIDO',
    'PROBLEMA_ENTREGA'
  ].includes(motivoDerivacion)
) {
  prioridadDerivacion =
    'ALTA';
} else if (
  requiereHumano
) {
  prioridadDerivacion =
    'MEDIA';
}


// ======================================================
// 13. VALIDACIÓN DE SEGURIDAD
// ======================================================

for (
  const [nombre, valor] of Object.entries({
    cantidad,
    ancho_cm:
      anchoCm,
    alto_cm:
      altoCm
  })
) {
  if (
    valor !== null &&
    valor <= 0
  ) {
    throw new Error(
      `${nombre} inválido recibido desde IA: ${valor}`
    );
  }
}

if (
  requiereHumano &&
  accion !== 'DERIVAR_HUMANO'
) {
  throw new Error(
    'Decisión incoherente: requiere_humano=true pero accion no es DERIVAR_HUMANO.'
  );
}


// ======================================================
// 14. SALIDA ÚNICA PEGASO
// ======================================================

return {
  json: {

    // ----------------------------------------------
    // CONVERSACIÓN
    // ----------------------------------------------

    conversacion_id:
      conversacionId,

    cliente_id:
      clienteId,

    contacto_id:
      contactoId,

    telefono:
      texto(contexto.telefono),

    nombre_whatsapp:
      texto(contexto.nombre_whatsapp),

    es_cliente_registrado:
      booleano(
        contexto.es_cliente_registrado,
        false
      ),

    mensaje_actual:
      texto(
        contexto.mensaje_actual,
        ''
      ),

    tipo_mensaje:
      texto(
        contexto.tipo_mensaje,
        'TEXTO'
      ).toUpperCase(),


    // ----------------------------------------------
    // PROSPECTO
    // ----------------------------------------------

    prospecto_existe:
      prospectoExiste,

    prospecto_id:
      prospectoId,

    prospecto_estado:
      prospectoEstado,

    prospecto_clasificacion_anterior:
      clasificacionAnterior,

    clasificacion_prospecto:
      clasificacionProspecto,

    prospecto_nombre:
      prospectoNombre,

    prospecto_producto_interes:
      prospectoProductoInteres,

    prospecto_ciudad:
      prospectoCiudadResuelta,

    prospecto_provincia:
      prospectoProvinciaResuelta,

    prospecto_ultima_intencion:
      prospectoUltimaIntencion,

    prospecto_ultima_accion:
      prospectoUltimaAccion,

    prospecto_requiere_humano:
      prospectoRequiereHumano,


    // ----------------------------------------------
    // ACTOR
    // ----------------------------------------------

    tipo_actor:
      tipoActor,


    // ----------------------------------------------
    // DECISIÓN
    // ----------------------------------------------

    intencion,
    accion,


    // ----------------------------------------------
    // INFORMACIÓN DETECTADA
    // ----------------------------------------------

    producto,
    material,
    cantidad,

    ancho_cm:
      anchoCm,

    alto_cm:
      altoCm,

    forma,

    ciudad_detectada:
      ciudadDetectada,

    provincia_detectada:
      provinciaDetectada,


    // ----------------------------------------------
    // ESTADO COMERCIAL
    // ----------------------------------------------

    datos_suficientes_para_cotizar:
      datosSuficientes,

    etiqueta_grande:
      etiquetaGrande,

    debe_pedir_ciudad_despues_cotizacion:
      debePedirCiudadDespuesCotizacion,

    cierre_cordial:
      cierreCordial,


    // ----------------------------------------------
    // DERIVACIÓN HUMANA
    // ----------------------------------------------

    requiere_humano:
      requiereHumano,

    motivo_derivacion:
      motivoDerivacion,

    requiere_notificacion:
      requiereNotificacion,

    prioridad_derivacion:
      prioridadDerivacion,


    // ----------------------------------------------
    // RESPUESTA
    // ----------------------------------------------

    respuesta_sugerida:
      respuestaSugerida,


    // ----------------------------------------------
    // CONTEXTO
    // ----------------------------------------------

    contexto_comercial:
      contexto.contexto_comercial ?? {},


    // ----------------------------------------------
    // DIAGNÓSTICO
    // ----------------------------------------------

    decision_ia_valida:
      true
  }
};
