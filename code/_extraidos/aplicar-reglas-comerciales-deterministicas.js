// ======================================================
// N8N NODE - PEGASO
// ======================================================
// Nombre: Aplicar reglas comerciales determinísticas
// Node ID: 268786b8-303c-47fd-9cb3-e79bf3d18a4b
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
// APLICAR REGLAS COMERCIALES DETERMINÍSTICAS
// PEGASO ADHESIVOS - V1.2
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
// V1.2:
// - Mantiene la regla de medida mínima.
// - Limpia una restricción anterior si las nuevas medidas
//   ya son producibles.
// - Conserva el par de medidas resuelto por
//   "Resolver contexto comercial" sin volver a mezclarlo.
// - No revive ids, precios ni estados de cotizaciones viejas.
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


function objeto(valor) {

  if (
    valor &&
    typeof valor === 'object' &&
    !Array.isArray(valor)
  ) {
    return valor;
  }

  return {};
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
// 3. RECUPERAR CONTEXTO
// ======================================================

const contextoAnterior =
  objeto(
    data.contexto_comercial
  );

const cotizacionAnterior =
  objeto(
    contextoAnterior.cotizacion
  );


// ======================================================
// 4. RESTRICCIONES COMERCIALES
// ======================================================
//
// Regla actual:
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
// 5. SI LA SOLICITUD ES PRODUCIBLE
// ======================================================
//
// No basta con devolver ...data.
//
// Si anteriormente existió una medida no producible y
// ahora el cliente corrigió las medidas, debemos eliminar
// del snapshot vigente:
//
// - producible = false
// - restriccion_codigo
// - restriccion_tipo
//
// De lo contrario una restricción vieja podría contaminar
// decisiones posteriores.
//
// La memoria histórica "ultima_restriccion_comercial"
// se conserva; no representa el estado vigente.
// ======================================================

if (
  solicitudProducible === true
) {

  const tieneMedidasCompletas =
    anchoCm !== null &&
    altoCm !== null;

  const cotizacionNueva = {
    ...cotizacionAnterior
  };

  if (tieneMedidasCompletas) {
    cotizacionNueva.ancho_cm =
      anchoCm;

    cotizacionNueva.alto_cm =
      altoCm;

    cotizacionNueva.producible =
      true;

    cotizacionNueva.restriccion_codigo =
      null;

    cotizacionNueva.restriccion_tipo =
      null;
  }

  const contextoComercialNuevo = {
    ...contextoAnterior,

    cotizacion:
      cotizacionNueva
  };

  return [
    {
      json: {

        ...data,

        solicitud_producible:
          true,

        restriccion_comercial:
          null,

        contexto_comercial:
          contextoComercialNuevo

      }
    }
  ];

}


// ======================================================
// 6. ACTUALIZAR CONTEXTO COMERCIAL
// ======================================================
//
// Conservamos el contexto construido por
// Resolver contexto comercial.
//
// Solo añadimos memoria de la restricción.
//
// ======================================================

const contextoComercialNuevo = {

  ...contextoAnterior,

  cotizacion: {

    ...cotizacionAnterior,

    ancho_cm:
      anchoCm,

    alto_cm:
      altoCm,

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
// 7. SOBRESCRIBIR DECISIÓN DE IA
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
