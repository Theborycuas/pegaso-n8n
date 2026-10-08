// ======================================================
// NODO N8N: Aplicar reglas comerciales determinísticas
// ARCHIVO: code/04-cerebro-comercial/aplicar-reglas-comerciales.js
// VERSION: 2.0
// RESPONSABILIDAD:
// - Aplicar reglas de negocio determinísticas de Pegaso con prioridad sobre la decisión de la IA.
// - Detectar medida no producible (ancho_cm o alto_cm <= 1 cm) y generar restriccion_comercial MEDIDA_MINIMA_NO_PRODUCIBLE.
// - Aplicarla solo a acciones de cotización (COTIZAR_P4, MEDIDA_NO_PRODUCIBLE, RESPONDER_NO_PRODUCIBLE): una derivación humana o una
//   respuesta informativa con medidas viejas en memoria no se tocan.
// - Si aplica: accion = MEDIDA_NO_PRODUCIBLE (la salida del Switch "Enrutar acción comercial"), sin derivación ni notificación,
//   datos_suficientes_para_cotizar=false y respuesta fija.
// - Registrar la restricción en contexto_comercial (cotizacion.producible y ultima_restriccion_comercial).
// - Conservar siempre el contrato completo recibido (...data) y marcar solicitud_producible.
// - NO reconstruir el contrato comercial ni alterar la decisión cuando no hay restricción.
// - NO escribir en PostgreSQL (lo hace "Guardar contexto comercial").
// ======================================================

const data =
  $input.first().json;


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

  const t =
    String(valor).trim();

  return t !== ''
    ? t
    : null;
}


// ======================================================
// 2. RECUPERAR DATOS COMERCIALES
// ======================================================

const anchoCm =
  numeroONull(
    data.ancho_cm
  );

const altoCm =
  numeroONull(
    data.alto_cm
  );


// ======================================================
// 3. RESTRICCIONES COMERCIALES
// ======================================================
//
// Aquí iremos agregando las restricciones objetivas
// de Pegaso.
//
// PRIMERA REGLA:
//
// No se producen etiquetas que tengan 1 cm o menos
// en cualquiera de sus lados.
//
// Ejemplos NO producibles:
//
// 1 x 1
// 1 x 5
// 8 x 1
// 0.5 x 10
//
// ======================================================

let solicitudProducible =
  true;

let restriccionComercial =
  null;


// ------------------------------------------------------
// REGLA: MEDIDA MÍNIMA
// ------------------------------------------------------

const ACCIONES_DE_COTIZACION = [
  'COTIZAR_P4',
  'MEDIDA_NO_PRODUCIBLE',
  'RESPONDER_NO_PRODUCIBLE'
];

const accionRecibida =
  (textoONull(data.accion) ?? '').toUpperCase();

if (
  ACCIONES_DE_COTIZACION.includes(accionRecibida) &&
  anchoCm !== null &&
  altoCm !== null &&
  (
    anchoCm <= 1 ||
    altoCm <= 1
  )
) {

  solicitudProducible =
    false;

  restriccionComercial = {

    codigo:
      'MEDIDA_MINIMA_NO_PRODUCIBLE',

    tipo:
      'PRODUCCION',

    ancho_cm:
      anchoCm,

    alto_cm:
      altoCm,

    mensaje:
      'No trabajamos etiquetas que tengan 1 cm o menos en cualquiera de sus lados. La medida mínima que podemos trabajar debe ser mayor a 1 cm. Si gusta, indíquenos una medida mayor y con gusto le cotizamos.'

  };

}


// ======================================================
// 4. SI NO EXISTE RESTRICCIÓN
// ======================================================
//
// Importante:
//
// devolvemos TODO el contrato recibido.
//
// No alteramos:
// - accion
// - requiere_humano
// - respuesta_sugerida
// - contexto_comercial
//
// ======================================================

if (
  solicitudProducible === true
) {

  return [
    {
      json: {

        ...data,

        solicitud_producible:
          true,

        restriccion_comercial:
          null

      }
    }
  ];

}


// ======================================================
// 5. ACTUALIZAR CONTEXTO COMERCIAL
// ======================================================
//
// Conservamos el contexto construido por
// Resolver contexto comercial.
//
// Solo añadimos memoria de la restricción.
//
// ======================================================

const contextoAnterior =
  (
    data.contexto_comercial &&
    typeof data.contexto_comercial === 'object' &&
    !Array.isArray(data.contexto_comercial)
  )
    ? data.contexto_comercial
    : {};


const cotizacionAnterior =
  (
    contextoAnterior.cotizacion &&
    typeof contextoAnterior.cotizacion === 'object' &&
    !Array.isArray(contextoAnterior.cotizacion)
  )
    ? contextoAnterior.cotizacion
    : {};


const contextoComercialNuevo = {

  ...contextoAnterior,

  cotizacion: {

    ...cotizacionAnterior,

    producible:
      false,

    restriccion_codigo:
      restriccionComercial.codigo,

    restriccion_tipo:
      restriccionComercial.tipo

  },

  ultima_restriccion_comercial: {

    codigo:
      restriccionComercial.codigo,

    tipo:
      restriccionComercial.tipo,

    ancho_cm:
      restriccionComercial.ancho_cm,

    alto_cm:
      restriccionComercial.alto_cm,

    detectada_at:
      new Date().toISOString()

  }

};


// ======================================================
// 6. SOBRESCRIBIR DECISIÓN DE IA
// ======================================================
//
// Una restricción conocida por el sistema:
//
// NO requiere humano.
// NO entra al cotizador.
// NO se notifica internamente.
// Sí debe contestarse al prospecto.
//
// ======================================================

return [
  {
    json: {

      // ------------------------------------------------
      // CONSERVAR CONTRATO COMPLETO
      // ------------------------------------------------

      ...data,


      // ------------------------------------------------
      // PRODUCIBILIDAD
      // ------------------------------------------------

      solicitud_producible:
        false,

      restriccion_comercial:
        restriccionComercial,


      // ------------------------------------------------
      // DECISIÓN COMERCIAL
      // ------------------------------------------------

      accion:
        'MEDIDA_NO_PRODUCIBLE',

      requiere_humano:
        false,

      requiere_notificacion:
        false,

      motivo_derivacion:
        null,

      prioridad_derivacion:
        null,


      // ------------------------------------------------
      // COTIZACIÓN
      // ------------------------------------------------

      datos_suficientes_para_cotizar:
        false,


      // ------------------------------------------------
      // RESPUESTA
      // ------------------------------------------------

      respuesta_sugerida:
        restriccionComercial.mensaje,


      // ------------------------------------------------
      // CONTEXTO PERSISTENTE
      // ------------------------------------------------

      contexto_comercial:
        contextoComercialNuevo

    }
  }
];