// ======================================================
// NODO N8N: Construir mensaje comercial
// ARCHIVO: code/07-cotizacion/construir-mensaje-comercial.js
// VERSION: 1.0
// RESPONSABILIDAD:
// - Actuar como único punto de convergencia (contrato final común) de "Preparar mensaje cotización" y "Construir mensaje no producible"
// - Validar que exista mensaje_comercial no vacío y lanzar error si falta
// - Normalizar identidad (conversacion_id, cliente_id, prospecto_id) con respaldo en "Recuperar decisión comercial"
// - Limpiar mensajes_comerciales (o usar mensaje_comercial como único mensaje) y resolver tipo_respuesta_comercial
// - Garantizar que "Guardar mensaje comercial" pueda leer siempre $('Construir mensaje comercial').first().json.mensaje_comercial
// - NO calcular precios ni consultar detalles
// - NO depender de nodos exclusivos de una sola rama
// ======================================================


const input =
  $input.first().json ?? {};


// ======================================================
// 1. HELPERS
// ======================================================

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


// ======================================================
// 2. VALIDAR MENSAJE
// ======================================================

const mensajeComercial =
  textoONull(
    input.mensaje_comercial
  );


if (!mensajeComercial) {

  throw new Error(
    'No existe mensaje_comercial para finalizar la respuesta comercial.'
  );

}


// ======================================================
// 3. RECUPERAR IDENTIDAD COMERCIAL
// ======================================================
//
// Las ramas deberían conservar estos datos.
//
// Como respaldo recuperamos la decisión comercial.
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
// 4. IDENTIDAD
// ======================================================

const conversacionId =
  numeroONull(
    input.conversacion_id
  ) ??
  numeroONull(
    decision.conversacion_id
  );


const clienteId =
  numeroONull(
    input.cliente_id
  ) ??
  numeroONull(
    decision.cliente_id
  );


const prospectoId =
  numeroONull(
    input.prospecto_id
  ) ??
  numeroONull(
    decision.prospecto_id
  );


// ======================================================
// 5. MENSAJES
// ======================================================

let mensajesComerciales =
  Array.isArray(
    input.mensajes_comerciales
  )
    ? input.mensajes_comerciales
        .map(m => textoONull(m))
        .filter(Boolean)
    : [];


if (
  mensajesComerciales.length === 0
) {

  mensajesComerciales = [
    mensajeComercial
  ];

}


// ======================================================
// 6. TIPO DE RESPUESTA
// ======================================================

const tipoRespuesta =
  textoONull(
    input.tipo_respuesta_comercial
  ) ??
  (
    input.cotizacion_producible === false
      ? 'NO_PRODUCIBLE'
      : 'COTIZACION'
  );


// ======================================================
// 7. SALIDA COMÚN
// ======================================================

return [
  {
    json: {

      // ----------------------------------------------
      // Conservamos todo lo recibido
      // ----------------------------------------------

      ...input,


      // ----------------------------------------------
      // Identidad normalizada
      // ----------------------------------------------

      conversacion_id:
        conversacionId,

      cliente_id:
        clienteId,

      prospecto_id:
        prospectoId,


      // ----------------------------------------------
      // Tipo de respuesta
      // ----------------------------------------------

      tipo_respuesta_comercial:
        tipoRespuesta,


      // ----------------------------------------------
      // Mensaje principal
      // ----------------------------------------------

      mensaje_comercial:
        mensajeComercial,


      // ----------------------------------------------
      // Mensaje secundario opcional
      // ----------------------------------------------

      mensaje_variacion_precio:
        textoONull(
          input.mensaje_variacion_precio
        ),


      // ----------------------------------------------
      // Colección de mensajes
      // ----------------------------------------------

      mensajes_comerciales:
        mensajesComerciales,

      cantidad_mensajes_comerciales:
        mensajesComerciales.length,


      // ----------------------------------------------
      // Control
      // ----------------------------------------------

      cotizacion_producible:
        input.cotizacion_producible !== false,

      bloquear_cotizacion:
        input.bloquear_cotizacion === true,

      respuesta_comercial_lista:
        true
    }
  }
];
