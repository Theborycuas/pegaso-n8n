// ======================================================
// NODO N8N: Preparar mensaje transición humano
// ARCHIVO: code/06-derivacion-humana/preparar-mensaje-transicion-humano.js
// VERSION: 3.2
// RESPONSABILIDAD:
// - Recibir la salida del UPDATE "Guardar contexto handoff" y recuperar el contrato de "Preparar contexto handoff"
// - Elegir el texto fijo de transición al prospecto según el motivo (pago, reporte de pago o comprobante, pedido, llamada, imagen,
//   archivo, entrada no soportada, negociación, reclamo); nunca menciona errores técnicos
// - Aplicar un fallback por intención cuando el motivo no tiene texto propio
// - Mantener separados handoff_mensaje_cliente (mensaje ORIGINAL del prospecto) y mensaje_transicion (respuesta de Pegaso)
// - Exponer mensaje_salida y tipo_mensaje_salida = HANDOFF_HUMANO para el guardado del mensaje saliente
// - NO insertar el mensaje (lo hace "Guardar mensaje transición humano")
// - NO enviar por WhatsApp (lo hace "Preparar envío WhatsApp" + "YCloud Enviar Wts")
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
    'ENVIA_COMPROBANTE',
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
  [
    'DESEA_CONTINUAR_PEDIDO',
    'CONFIRMAR_PEDIDO'
  ].includes(motivo)
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
    'SOLICITA_HABLAR_CON_PERSONA',
    'QUIERE_LLAMAR',
    'QUIERE_QUE_LO_LLAMEN',
    'ATENCION_TELEFONICA'
  ].includes(motivo)
) {

  mensaje =
    'Permítame un momento por favor, ya verificamos su solicitud.';

}


// ------------------------------------------------------
// IMAGEN
// ------------------------------------------------------

else if (
  [
    'IMAGEN_REQUIERE_REVISION',
    'IMAGEN_NO_ANALIZABLE'
  ].includes(motivo)
) {

  mensaje =
    'Permítame un momento por favor, ya revisamos la imagen que nos envió.';

}


// ------------------------------------------------------
// ARCHIVOS
// ------------------------------------------------------

else if (
  [
    'ARCHIVO_NO_PROCESABLE',
    'ARCHIVO_DISENO',
    'ARCHIVO_NO_ANALIZABLE',
    'ARCHIVO_REQUIERE_REVISION',
    'DISENO_REQUIERE_REVISION'
  ].includes(motivo)
) {

  mensaje =
    'Permítame un momento por favor, ya revisamos el archivo que nos envió.';

}


// ------------------------------------------------------
// ENTRADA NO SOPORTADA (ubicación, contacto, interactivo…)
// ------------------------------------------------------

else if (
  motivo === 'ENTRADA_NO_SOPORTADA'
) {

  mensaje =
    'Permítame un momento por favor, ya revisamos el mensaje que nos envió.';

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
    'PROBLEMA_PEDIDO',
    'PROBLEMA_PAGO',
    'PROBLEMA_ENTREGA',
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