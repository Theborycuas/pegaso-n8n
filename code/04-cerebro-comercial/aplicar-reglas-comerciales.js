// ======================================================
// APLICAR REGLAS COMERCIALES DETERMINÍSTICAS
// PEGASO ADHESIVOS - V1.1
// ======================================================
//
// Este nodo está colocado DESPUÉS de:
//
// Resolver contexto comercial
//
// y ANTES de:
//
// Guardar contexto comercial
//
// OBJETIVO:
//
// Aplicar reglas de negocio objetivas que tienen
// prioridad sobre la decisión realizada por la IA.
//
// IMPORTANTE:
//
// Este nodo NO reconstruye el contrato comercial.
// Conserva SIEMPRE:
//   ...data
//
// De esta manera no se pierden:
//
// - conversacion_id
// - cliente_id
// - contacto_id
// - prospecto_id
// - telefono
// - intención
// - contexto_comercial
// - datos de cotización
// - estado de prospecto
// - etc.
//
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

if (
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
        'RESPONDER_NO_PRODUCIBLE',

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