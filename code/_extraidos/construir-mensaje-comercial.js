// ======================================================
// N8N NODE - PEGASO
// ======================================================
// Nombre: Construir mensaje comercial
// Node ID: d942cfd8-ee3a-4f2b-8e50-4778b26e5bdb
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
// CONSTRUIR MENSAJE COMERCIAL
// PEGASO ADHESIVOS - V1.1
// CONTRATO FINAL COMÚN
// ======================================================
//
// Objetivo:
//
// Ser el ÚNICO punto de salida de respuestas comerciales.
//
// Puede recibir:
//
// 1. "Preparar mensaje cotización"
// 2. "Construir mensaje no producible"
//
// Este nodo NO:
//
// - calcula precios
// - decide cierres comerciales
// - consulta detalles de cotización
// - depende de nodos exclusivos de una rama
// - llama a IA
//
// De esta manera:
//
// Guardar mensaje comercial
//
// siempre puede leer:
//
// $('Construir mensaje comercial')
//   .first()
//   .json
//   .mensaje_comercial
//
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
// 2. VALIDAR MENSAJE PRINCIPAL
// ======================================================

const mensajeComercial =
  textoONull(
    input.mensaje_comercial
  );


if (!mensajeComercial) {

  throw new Error(
    'CONSTRUIR MENSAJE COMERCIAL: no existe mensaje_comercial para finalizar la respuesta comercial.'
  );

}


// ======================================================
// 3. RECUPERAR IDENTIDAD COMERCIAL
// ======================================================
//
// Las ramas deberían conservar estos datos.
//
// Como respaldo recuperamos:
//
// "Recuperar decisión comercial"
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
// 5. MENSAJE SECUNDARIO
// ======================================================

const mensajeVariacionPrecio =
  textoONull(
    input.mensaje_variacion_precio
  );


// ======================================================
// 6. COLECCIÓN DE MENSAJES
// ======================================================

let mensajesComerciales =
  Array.isArray(
    input.mensajes_comerciales
  )
    ? input
        .mensajes_comerciales
        .map(
          mensaje =>
            textoONull(mensaje)
        )
        .filter(Boolean)
    : [];


// ------------------------------------------------------
// Si la rama no entregó colección,
// utilizamos el mensaje principal.
// ------------------------------------------------------

if (
  mensajesComerciales.length === 0
) {

  mensajesComerciales = [
    mensajeComercial
  ];

}


// ------------------------------------------------------
// Garantizar que el mensaje principal sea el primero.
//
// Evita inconsistencias si una rama futura construye
// mensajes_comerciales de forma incorrecta.
// ------------------------------------------------------

if (
  mensajesComerciales[0] !== mensajeComercial
) {

  mensajesComerciales =
    [
      mensajeComercial,
      ...mensajesComerciales.filter(
        mensaje =>
          mensaje !== mensajeComercial
      )
    ];

}


// ======================================================
// 7. TIPO DE RESPUESTA
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
// 8. SALIDA COMÚN
// ======================================================

return [
  {
    json: {

      // ----------------------------------------------
      // Conservamos TODO lo recibido.
      //
      // Esto incluye también los nuevos campos:
      //
      // cierre_cotizacion
      // cotizaciones_recientes_detectadas
      // multiples_opciones_en_cotizacion
      //
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
        mensajeVariacionPrecio,


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
