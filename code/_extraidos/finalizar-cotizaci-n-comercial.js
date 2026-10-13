// ======================================================
// N8N NODE - PEGASO
// ======================================================
// Nombre: Finalizar cotizaci├│n comercial
// Node ID: 662c9948-ec8d-4c43-a087-33905eba5a6a
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
// FINALIZAR COTIZACI├ôN COMERCIAL
// PEGASO ADHESIVOS - V2
// ======================================================
//
// Objetivo:
//
// Cerrar formalmente el flujo de cotizaci├│n.
//
// Este nodo soporta DOS resultados v├ílidos:
//
// 1. COTIZACI├ôN PRODUCIBLE
//    - existe cotizacion_id
//    - existe total
//    - cotizacion_generada = true
//
// 2. COTIZACI├ôN NO PRODUCIBLE
//    - NO existe cotizacion_id
//    - NO existe total
//    - cotizacion_generada = false
//    - existe mensaje comercial explicando el motivo
//
// Una cotizaci├│n no producible NO constituye un error.
//
// ======================================================


// ======================================================
// 1. RECUPERAR ESTADO RESUELTO
// ======================================================

const data =
  $('Resolver estado post cotizaci├│n')
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
// 4. VALIDACI├ôN COM├ÜN
// ======================================================

if (
  conversacionId === null ||
  conversacionId <= 0
) {

  throw new Error(
    'Finalizar cotizaci├│n: no existe conversacion_id v├ílido.'
  );

}


// ======================================================
// 5. DETERMINAR SI REALMENTE SE GENER├ô COTIZACI├ôN
// ======================================================
//
// Preferimos flags expl├¡citos.
//
// Si por compatibilidad todav├¡a no existen,
// la presencia de cotizacion_id permite inferir
// una cotizaci├│n real.
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
// COTIZACI├ôN PRODUCIBLE
// ======================================================

if (cotizacionGenerada) {

  if (
    cotizacionId === null ||
    cotizacionId <= 0
  ) {

    throw new Error(
      'Finalizar cotizaci├│n: se marc├│ como generada pero no existe cotizacion_id.'
    );

  }


  if (
    total === null ||
    total < 0
  ) {

    throw new Error(
      'Finalizar cotizaci├│n: se marc├│ como generada pero no existe total v├ílido.'
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
        // COTIZACI├ôN
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
// Aqu├¡ NO debe existir cotizacion_id.
//
// Esto NO es un error.
//
// El prospecto debe poder cambiar la medida y continuar.
//
// ======================================================

if (!mensajeComercial) {

  throw new Error(
    'Finalizar cotizaci├│n no producible: no existe mensaje comercial para responder al prospecto.'
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
      // SIN COTIZACI├ôN REAL
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
