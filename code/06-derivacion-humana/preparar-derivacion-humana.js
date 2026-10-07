// ======================================================
// NODO N8N: Preparar derivación humana
// ARCHIVO: code/06-derivacion-humana/preparar-derivacion-humana.js
// VERSION: 3
// RESPONSABILIDAD:
// - Recibir la salida DERIVAR_HUMANO de "Enrutar acción comercial" y validar conversacion_id y prospecto_id
// - Convertir la decisión comercial en un contrato estable de HANDOFF (respaldo en "Recuperar decisión comercial")
// - Decidir el motivo funcional (explícito o derivado de la intención) y la clasificación del handoff
// - Decidir la prioridad (IA + reglas deterministas ALTA/MEDIA por motivo)
// - Decidir si requiere notificación interna (motivos notificables o prioridad ALTA)
// - Preservar el mensaje original del cliente, separado del mensaje de transición de Pegaso
// - NO escribir en PostgreSQL (lo hace "Marcar prospecto requiere humano")
// - NO dejar que los nodos posteriores reinterpreten estas decisiones: solo deben preservarlas
// ======================================================

const input = $input.first().json;


// ======================================================
// 1. HELPERS
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


function numeroONull(valor) {

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


// ======================================================
// 2. IDENTIDAD
// ======================================================

const conversacionId =
  numeroONull(
    input.conversacion_id
  );

const prospectoId =
  numeroONull(
    input.prospecto_id
  );

const clienteId =
  numeroONull(
    input.cliente_id
  );

const contactoId =
  numeroONull(
    input.contacto_id
  );


if (
  conversacionId === null ||
  conversacionId <= 0
) {

  throw new Error(
    'PREPARAR DERIVACIÓN HUMANA: conversacion_id inválido.'
  );

}


if (
  prospectoId === null ||
  prospectoId <= 0
) {

  throw new Error(
    'PREPARAR DERIVACIÓN HUMANA: prospecto_id inválido.'
  );

}


// ======================================================
// 3. RECUPERAR DECISIÓN COMERCIAL
// ======================================================
//
// El input normalmente ya la contiene.
// Sin embargo dejamos respaldo directo al nodo anterior
// para no perderla si en el futuro cambia la conexión.
//
// ======================================================

let decisionAnterior = {};

try {

  decisionAnterior =
    $('Recuperar decisión comercial')
      .first()
      .json ?? {};

} catch (_) {

  decisionAnterior = {};

}


// ======================================================
// 4. INTENCIÓN / ACCIÓN
// ======================================================

const intencion =
  (
    texto(
      input.intencion
    ) ??
    texto(
      decisionAnterior.intencion
    ) ??
    'OTRO'
  ).toUpperCase();


const accionOriginal =
  (
    texto(
      input.accion
    ) ??
    texto(
      decisionAnterior.accion
    ) ??
    'DERIVAR_HUMANO'
  ).toUpperCase();


// ======================================================
// 5. MENSAJE ORIGINAL DEL CLIENTE
// ======================================================
//
// MUY IMPORTANTE:
//
// Este campo representa exclusivamente lo que escribió
// el prospecto.
//
// Jamás debe reemplazarse posteriormente con el mensaje
// de transición generado por Pegaso.
//
// ======================================================

const mensajeClienteOriginal =
  texto(
    input.mensaje_actual
  ) ??
  texto(
    decisionAnterior.mensaje_actual
  ) ??
  texto(
    input.handoff_mensaje_cliente
  ) ??
  null;


// ======================================================
// 6. DATOS DEL PROSPECTO
// ======================================================

const nombreProspecto =
  texto(
    input.prospecto_nombre
  ) ??
  texto(
    decisionAnterior.prospecto_nombre
  ) ??
  texto(
    input.nombre_whatsapp
  ) ??
  texto(
    decisionAnterior.nombre_whatsapp
  );


const telefono =
  texto(
    input.telefono
  ) ??
  texto(
    decisionAnterior.telefono
  );


const ciudad =
  texto(
    input.prospecto_ciudad
  ) ??
  texto(
    decisionAnterior.prospecto_ciudad
  ) ??
  texto(
    input.ciudad_detectada
  ) ??
  texto(
    decisionAnterior.ciudad_detectada
  );


const provincia =
  texto(
    input.prospecto_provincia
  ) ??
  texto(
    decisionAnterior.prospecto_provincia
  ) ??
  texto(
    input.provincia_detectada
  ) ??
  texto(
    decisionAnterior.provincia_detectada
  );


const clasificacionProspecto =
  texto(
    input.clasificacion_prospecto
  ) ??
  texto(
    input.prospecto_clasificacion
  ) ??
  texto(
    decisionAnterior.clasificacion_prospecto
  ) ??
  texto(
    decisionAnterior.prospecto_clasificacion
  );


// ======================================================
// 7. MOTIVO FUNCIONAL
// ======================================================
//
// Primero respetamos un motivo explícito si ya existe.
//
// Si no existe, lo derivamos desde la intención.
//
// ======================================================

let motivo =
  (
    texto(
      input.handoff_motivo
    ) ??
    texto(
      input.motivo_derivacion
    ) ??
    texto(
      decisionAnterior.handoff_motivo
    ) ??
    texto(
      decisionAnterior.motivo_derivacion
    )
  );


if (motivo) {

  motivo =
    motivo.toUpperCase();

}


if (!motivo) {

  switch (intencion) {

    case 'CONSULTAR_PAGO':

      motivo =
        'SOLICITA_DATOS_PAGO';

      break;


    case 'REPORTAR_PAGO':

      motivo =
        'REPORTA_PAGO';

      break;


    case 'CONFIRMAR_PEDIDO':

      motivo =
        'DESEA_CONTINUAR_PEDIDO';

      break;


    case 'NEGOCIAR':

      motivo =
        'NEGOCIACION_COMERCIAL';

      break;


    case 'RECLAMO':

      motivo =
        'RECLAMO';

      break;


    case 'SOLICITAR_LLAMADA':

      motivo =
        'SOLICITA_LLAMADA';

      break;


    default:

      motivo =
        'ATENCION_COMERCIAL';

  }

}


// ======================================================
// 8. CLASIFICACIÓN HANDOFF
// ======================================================

let clasificacionHandoff =
  texto(
    input.handoff_clasificacion
  ) ??
  texto(
    input.clasificacion_handoff
  ) ??
  texto(
    decisionAnterior.handoff_clasificacion
  ) ??
  texto(
    decisionAnterior.clasificacion_handoff
  );


if (clasificacionHandoff) {

  clasificacionHandoff =
    clasificacionHandoff.toUpperCase();

}


if (!clasificacionHandoff) {

  switch (motivo) {

    case 'SOLICITA_DATOS_PAGO':
    case 'REPORTA_PAGO':
    case 'DESEA_CONTINUAR_PEDIDO':

      clasificacionHandoff =
        'CIERRE_COMERCIAL';

      break;


    case 'RECLAMO':

      clasificacionHandoff =
        'POSTVENTA';

      break;


    case 'NEGOCIACION_COMERCIAL':

      clasificacionHandoff =
        'NEGOCIACION';

      break;


    case 'SOLICITA_LLAMADA':

      clasificacionHandoff =
        'CONTACTO_DIRECTO';

      break;


    default:

      clasificacionHandoff =
        'REVISION_COMERCIAL';

  }

}


// ======================================================
// 9. PRIORIDAD
// ======================================================
//
// MUY IMPORTANTE:
//
// La IA ya puede entregar:
//
// prioridad_derivacion = ALTA
//
// Antes nuestro flujo ignoraba ese campo.
//
// ======================================================

let prioridad =
  (
    texto(
      input.handoff_prioridad
    ) ??
    texto(
      input.prioridad_derivacion
    ) ??
    texto(
      decisionAnterior.handoff_prioridad
    ) ??
    texto(
      decisionAnterior.prioridad_derivacion
    ) ??
    'NORMAL'
  ).toUpperCase();


// Reglas determinísticas tienen autoridad mínima.

if (
  motivo === 'SOLICITA_DATOS_PAGO' ||
  motivo === 'REPORTA_PAGO' ||
  motivo === 'DESEA_CONTINUAR_PEDIDO' ||
  motivo === 'RECLAMO'
) {

  prioridad =
    'ALTA';

}


else if (
  motivo === 'NEGOCIACION_COMERCIAL' ||
  motivo === 'SOLICITA_LLAMADA'
) {

  if (prioridad !== 'ALTA') {

    prioridad =
      'MEDIA';

  }

}


// ======================================================
// 10. RESOLVER NOTIFICACIÓN
// ======================================================
//
// Regla:
// No dependemos solo de la IA.
//
// Los eventos comerciales que necesitan atención pronta
// notifican siempre.
//
// ======================================================

let requiereNotificacion =
  booleano(
    input.requiere_notificacion ??
    input.handoff_requiere_notificacion ??
    decisionAnterior.requiere_notificacion ??
    decisionAnterior.handoff_requiere_notificacion,
    false
  );


const motivosNotificables =
  new Set([
    'SOLICITA_DATOS_PAGO',
    'REPORTA_PAGO',
    'DESEA_CONTINUAR_PEDIDO',
    'NEGOCIACION_COMERCIAL',
    'RECLAMO',
    'SOLICITA_LLAMADA',
    'ARCHIVO_REQUIERE_REVISION',
    'DISENO_REQUIERE_REVISION',
    'COTIZACION_ESPECIAL'
  ]);


if (
  motivosNotificables.has(
    motivo
  )
) {

  requiereNotificacion =
    true;

}


// Prioridad ALTA también obliga notificación.

if (
  prioridad === 'ALTA'
) {

  requiereNotificacion =
    true;

}


// ======================================================
// 11. SALIDA
// ======================================================

return [
  {
    json: {

      ...input,

      // ----------------------------------------------
      // IDENTIDAD
      // ----------------------------------------------

      conversacion_id:
        conversacionId,

      prospecto_id:
        prospectoId,

      cliente_id:
        clienteId,

      contacto_id:
        contactoId,

      telefono,

      nombre_whatsapp:
        nombreProspecto,

      prospecto_nombre:
        nombreProspecto,

      prospecto_ciudad:
        ciudad,

      prospecto_provincia:
        provincia,

      prospecto_clasificacion:
        clasificacionProspecto,


      // ----------------------------------------------
      // DECISIÓN
      // ----------------------------------------------

      intencion,

      accion_original:
        accionOriginal,

      accion:
        'DERIVAR_HUMANO',

      requiere_humano:
        true,


      // ----------------------------------------------
      // HANDOFF
      // ----------------------------------------------

      handoff_motivo:
        motivo,

      handoff_clasificacion:
        clasificacionHandoff,

      clasificacion_handoff:
        clasificacionHandoff,

      handoff_prioridad:
        prioridad,

      prioridad_derivacion:
        prioridad,


      // ----------------------------------------------
      // NOTIFICACIÓN
      // ----------------------------------------------

      requiere_notificacion:
        requiereNotificacion,

      handoff_requiere_notificacion:
        requiereNotificacion,


      // ----------------------------------------------
      // MENSAJE ORIGINAL CLIENTE
      // ----------------------------------------------

      mensaje_cliente_original:
        mensajeClienteOriginal,

      handoff_mensaje_cliente:
        mensajeClienteOriginal,


      // ----------------------------------------------
      // CONTROL
      // ----------------------------------------------

      handoff_at:
        new Date().toISOString()

    }
  }
];