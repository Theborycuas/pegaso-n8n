// ======================================================
// NODO N8N: Finalizar cotización comercial
// ARCHIVO: code/07-cotizacion/finalizar-cotizacion-comercial.js
// VERSION: 2
// RESPONSABILIDAD:
// - Cerrar formalmente el flujo de cotización leyendo "Resolver estado post cotización"
// - Determinar si se generó cotización (cotizacion_generada, luego cotizacion_producible, luego presencia de cotizacion_id)
// - Caso producible: exigir cotizacion_id y total válidos y devolver flujo COTIZACION / resultado COTIZADA / estado_comercial COTIZADO
// - Caso no producible: exigir mensaje comercial y devolver flujo COTIZACION_NO_PRODUCIBLE, estado_comercial NO_COTIZABLE y siguiente_accion_esperada SOLICITAR_NUEVA_MEDIDA
// - Tratar la cotización no producible como resultado válido, no como error
// - NO escribir en PostgreSQL ni enviar mensajes
// ======================================================


// ======================================================
// 1. RECUPERAR ESTADO RESUELTO
// ======================================================

const data =
  $('Resolver estado post cotización')
    .first()
    .json ?? {};


// ======================================================
// 2. HELPERS
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


function booleano(
  valor,
  defecto = false
) {

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


// ======================================================
// 3. DATOS BASE
// ======================================================

const conversacionId =
  numeroONull(
    data.conversacion_id
  );


const prospectoId =
  numeroONull(
    data.prospecto_id
  );


const clienteId =
  numeroONull(
    data.cliente_id
  );


const cotizacionId =
  numeroONull(
    data.cotizacion_id
  );


const total =
  numeroONull(
    data.total
  );


const mensajeComercial =
  textoONull(
    data.mensaje_comercial
  ) ??
  '';


// ======================================================
// 4. VALIDACIÓN COMÚN
// ======================================================

if (
  conversacionId === null ||
  conversacionId <= 0
) {

  throw new Error(
    'Finalizar cotización: no existe conversacion_id válido.'
  );

}


// ======================================================
// 5. DETERMINAR SI REALMENTE SE GENERÓ COTIZACIÓN
// ======================================================
//
// Preferimos flags explícitos.
//
// Si por compatibilidad todavía no existen,
// la presencia de cotizacion_id permite inferir
// una cotización real.
//
// ======================================================

let cotizacionGenerada;


if (
  data.cotizacion_generada !== undefined &&
  data.cotizacion_generada !== null
) {

  cotizacionGenerada =
    booleano(
      data.cotizacion_generada
    );

}

else if (
  data.cotizacion_producible !== undefined &&
  data.cotizacion_producible !== null
) {

  cotizacionGenerada =
    booleano(
      data.cotizacion_producible
    );

}

else {

  cotizacionGenerada =
    cotizacionId !== null;

}


// ======================================================
// 6. CASO A:
// COTIZACIÓN PRODUCIBLE
// ======================================================

if (cotizacionGenerada) {

  if (
    cotizacionId === null ||
    cotizacionId <= 0
  ) {

    throw new Error(
      'Finalizar cotización: se marcó como generada pero no existe cotizacion_id.'
    );

  }


  if (
    total === null ||
    total < 0
  ) {

    throw new Error(
      'Finalizar cotización: se marcó como generada pero no existe total válido.'
    );

  }


  return [
    {
      json: {

        success:
          true,

        flujo:
          'COTIZACION',

        resultado_cotizacion:
          'COTIZADA',


        // ----------------------------------------------
        // IDENTIDAD
        // ----------------------------------------------

        conversacion_id:
          conversacionId,

        prospecto_id:
          prospectoId,

        cliente_id:
          clienteId,


        // ----------------------------------------------
        // COTIZACIÓN
        // ----------------------------------------------

        cotizacion_id:
          cotizacionId,

        total:
          total,

        estado_comercial:
          'COTIZADO',

        cotizacion_generada:
          true,

        cotizacion_producible:
          true,


        // ----------------------------------------------
        // MENSAJE
        // ----------------------------------------------

        mensaje_comercial:
          mensajeComercial,

        esperando_respuesta_cliente:
          true,


        // ----------------------------------------------
        // CONTROL
        // ----------------------------------------------

        finalizado_at:
          new Date().toISOString()

      }
    }
  ];

}


// ======================================================
// 7. CASO B:
// SOLICITUD NO PRODUCIBLE
// ======================================================
//
// Aquí NO debe existir cotizacion_id.
//
// Esto NO es un error.
//
// El prospecto debe poder cambiar la medida y continuar.
//
// ======================================================

if (!mensajeComercial) {

  throw new Error(
    'Finalizar cotización no producible: no existe mensaje comercial para responder al prospecto.'
  );

}


return [
  {
    json: {

      success:
        true,

      flujo:
        'COTIZACION_NO_PRODUCIBLE',

      resultado_cotizacion:
        'NO_PRODUCIBLE',


      // ----------------------------------------------
      // IDENTIDAD
      // ----------------------------------------------

      conversacion_id:
        conversacionId,

      prospecto_id:
        prospectoId,

      cliente_id:
        clienteId,


      // ----------------------------------------------
      // SIN COTIZACIÓN REAL
      // ----------------------------------------------

      cotizacion_id:
        null,

      total:
        null,

      estado_comercial:
        'NO_COTIZABLE',

      cotizacion_generada:
        false,

      cotizacion_producible:
        false,


      // ----------------------------------------------
      // MENSAJE
      // ----------------------------------------------

      mensaje_comercial:
        mensajeComercial,

      // Queremos que responda con otra medida.
      esperando_respuesta_cliente:
        true,

      siguiente_accion_esperada:
        'SOLICITAR_NUEVA_MEDIDA',


      // ----------------------------------------------
      // CONTROL
      // ----------------------------------------------

      finalizado_at:
        new Date().toISOString()

    }
  }
];