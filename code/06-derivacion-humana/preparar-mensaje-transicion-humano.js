// ======================================================
// PREPARAR MENSAJE DE TRANSICIÓN A HUMANO
// PEGASO ADHESIVOS - V3
// ======================================================
//
// El input inmediato puede venir de un UPDATE PostgreSQL.
//
// Por eso recuperamos explícitamente el contrato de:
//
//   Preparar contexto handoff
//
// IMPORTANTE:
//
// handoff_mensaje_cliente
//     = mensaje ORIGINAL del prospecto
//
// mensaje_transicion
//     = respuesta de Pegaso al prospecto
//
// Son conceptos diferentes.
//
// ======================================================


// ======================================================
// 1. INPUT DB
// ======================================================

const db =
  $input.first().json ?? {};


// ======================================================
// 2. RECUPERAR HANDOFF
// ======================================================

let handoff = {};

try {

  handoff =
    $('Preparar contexto handoff')
      .first()
      .json ?? {};

} catch (_) {

  handoff = {};

}


// ======================================================
// 3. COMBINAR
// ======================================================

const input = {
  ...db,
  ...handoff
};


// ======================================================
// 4. HELPERS
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


// ======================================================
// 5. DATOS HANDOFF
// ======================================================

const intencion =
  (
    texto(
      input.intencion
    ) ??
    'OTRO'
  ).toUpperCase();


const motivo =
  (
    texto(
      input.handoff_motivo
    ) ??
    texto(
      input.motivo_derivacion
    ) ??
    'ATENCION_COMERCIAL'
  ).toUpperCase();


const mensajeClienteOriginal =
  texto(
    input.mensaje_cliente_original
  ) ??
  texto(
    input.handoff_mensaje_cliente
  ) ??
  texto(
    input.mensaje_actual
  );


// ======================================================
// 6. MENSAJE AL PROSPECTO
// ======================================================

let mensaje = null;


// ------------------------------------------------------
// DATOS DE PAGO
// ------------------------------------------------------

if (
  [
    'SOLICITA_DATOS_PAGO',
    'SOLICITA_CUENTA',
    'SOLICITA_DATOS_BANCARIOS',
    'PIDE_CUENTA',
    'PIDE_NUMERO_CUENTA',
    'INTERES_PAGO'
  ].includes(motivo)
) {

  mensaje =
    'En breve le pasamos nuestros datos personales y números de cuenta.';

}


// ------------------------------------------------------
// REPORTA PAGO
// ------------------------------------------------------

else if (
  [
    'REPORTA_PAGO',
    'COMPROBANTE_PAGO',
    'PAGO_REALIZADO'
  ].includes(motivo)
) {

  mensaje =
    'Gracias. Permítame un momento por favor, ya verificamos su pago para continuar con el pedido.';

}


// ------------------------------------------------------
// CONTINUAR PEDIDO
// ------------------------------------------------------

else if (
  motivo === 'DESEA_CONTINUAR_PEDIDO'
) {

  mensaje =
    'Permítame un momento por favor, ya verificamos los datos para continuar con su pedido.';

}


// ------------------------------------------------------
// LLAMADA
// ------------------------------------------------------

else if (
  [
    'SOLICITA_LLAMADA',
    'QUIERE_LLAMAR',
    'QUIERE_QUE_LO_LLAMEN',
    'ATENCION_TELEFONICA'
  ].includes(motivo)
) {

  mensaje =
    'Permítame un momento por favor, ya verificamos su solicitud.';

}


// ------------------------------------------------------
// ARCHIVOS
// ------------------------------------------------------

else if (
  [
    'ARCHIVO_NO_ANALIZABLE',
    'IMAGEN_NO_ANALIZABLE',
    'ARCHIVO_REQUIERE_REVISION',
    'DISENO_REQUIERE_REVISION'
  ].includes(motivo)
) {

  mensaje =
    'Permítame un momento por favor, ya revisamos el archivo que nos envió.';

}


// ------------------------------------------------------
// NEGOCIACIÓN
// ------------------------------------------------------

else if (
  [
    'NEGOCIACION',
    'NEGOCIACION_COMERCIAL',
    'NEGOCIAR_PRECIO',
    'PRECIO_ESPECIAL',
    'DESCUENTO'
  ].includes(motivo)
) {

  mensaje =
    'Permítame un momento por favor, ya verificamos su requerimiento.';

}


// ------------------------------------------------------
// RECLAMO
// ------------------------------------------------------

else if (
  [
    'RECLAMO',
    'INCONVENIENTE',
    'QUEJA'
  ].includes(motivo)
) {

  mensaje =
    'Gracias por indicarnos lo ocurrido. Permítame un momento por favor, ya revisamos su caso.';

}


// ======================================================
// 7. FALLBACK POR INTENCIÓN
// ======================================================

if (!mensaje) {

  switch (intencion) {

    case 'CONSULTAR_PAGO':

      mensaje =
        'En breve le pasamos nuestros datos personales y números de cuenta.';

      break;


    case 'REPORTAR_PAGO':

      mensaje =
        'Gracias. Permítame un momento por favor, ya verificamos la información enviada.';

      break;


    case 'CONFIRMAR_PEDIDO':

      mensaje =
        'Permítame un momento por favor, ya verificamos los datos para continuar con su pedido.';

      break;


    case 'NEGOCIAR':

      mensaje =
        'Permítame un momento por favor, ya verificamos su requerimiento.';

      break;


    case 'RECLAMO':

      mensaje =
        'Gracias por indicarnos lo ocurrido. Permítame un momento por favor, ya revisamos su caso.';

      break;


    default:

      mensaje =
        'Permítame un momento por favor, ya verificamos su requerimiento.';

  }

}


// ======================================================
// 8. SALIDA
// ======================================================

return [
  {
    json: {

      ...input,

      // Mensaje ORIGINAL del prospecto.
      mensaje_cliente_original:
        mensajeClienteOriginal,

      handoff_mensaje_cliente:
        mensajeClienteOriginal,

      // Mensaje que nosotros enviaremos.
      mensaje_salida:
        mensaje,

      mensaje_transicion:
        mensaje,

      handoff_mensaje_transicion:
        mensaje,

      tipo_mensaje_salida:
        'HANDOFF_HUMANO',

      mensaje_handoff_preparado:
        true

    }
  }
];