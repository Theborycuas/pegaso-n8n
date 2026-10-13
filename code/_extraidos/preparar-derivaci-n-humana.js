// ======================================================
// N8N NODE - PEGASO
// ======================================================
// Nombre: Preparar derivaci├│n humana
// Node ID: f85439cb-8b0f-4f83-9171-7cb72c198bc6
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
// NODO N8N: Preparar derivaci├│n humana
// ARCHIVO: code/06-derivacion-humana/preparar-derivacion-humana.js
// VERSION: 3.1
// RESPONSABILIDAD:
// - Recibir la salida DERIVAR_HUMANO de "Enrutar acci├│n comercial" y validar conversacion_id y prospecto_id
// - Convertir la decisi├│n comercial en un contrato estable de HANDOFF (respaldo en "Recuperar decisi├│n comercial")
// - Decidir el motivo funcional (expl├¡cito o derivado de la intenci├│n) y la clasificaci├│n del handoff
// - Decidir la prioridad (IA + reglas deterministas ALTA/MEDIA por motivo)
// - Decidir si requiere notificaci├│n interna (motivos notificables o prioridad ALTA)
// - Preservar el mensaje original del cliente, separado del mensaje de transici├│n de Pegaso
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
    'PREPARAR DERIVACI├ôN HUMANA: conversacion_id inv├ílido.'
  );

}


if (
  prospectoId === null ||
  prospectoId <= 0
) {

  throw new Error(
    'PREPARAR DERIVACI├ôN HUMANA: prospecto_id inv├ílido.'
  );

}


// ======================================================
// 3. RECUPERAR DECISI├ôN COMERCIAL
// ======================================================
//
// El input normalmente ya la contiene.
// Sin embargo dejamos respaldo directo al nodo anterior
// para no perderla si en el futuro cambia la conexi├│n.
//
// ======================================================

let decisionAnterior = {};

try {

  decisionAnterior =
    $('Recuperar decisi├│n comercial')
      .first()
      .json ?? {};

} catch (_) {

  decisionAnterior = {};

}


// ======================================================
// 4. INTENCI├ôN / ACCI├ôN
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
// Este campo representa exclusivamente lo que escribi├│
// el prospecto.
//
// Jam├ís debe reemplazarse posteriormente con el mensaje
// de transici├│n generado por Pegaso.
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
// Primero respetamos un motivo expl├¡cito si ya existe.
//
// Si no existe, lo derivamos desde la intenci├│n.
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
// 8. CLASIFICACI├ôN HANDOFF
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
    case 'ENVIA_COMPROBANTE':
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


// Reglas determin├¡sticas tienen autoridad m├¡nima.

if (
  motivo === 'SOLICITA_DATOS_PAGO' ||
  motivo === 'REPORTA_PAGO' ||
  motivo === 'ENVIA_COMPROBANTE' ||
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
// 10. RESOLVER NOTIFICACI├ôN
// ======================================================
//
// Regla:
// No dependemos solo de la IA.
//
// Los eventos comerciales que necesitan atenci├│n pronta
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
    'ENVIA_COMPROBANTE',
    'IMAGEN_REQUIERE_REVISION',
    'ARCHIVO_NO_PROCESABLE',
    'ARCHIVO_DISENO',
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


// Prioridad ALTA tambi├®n obliga notificaci├│n.

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
      // DECISI├ôN
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
      // NOTIFICACI├ôN
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
