// ======================================================
// PREPARAR NOTIFICACIÓN HUMANO
// PEGASO ADHESIVOS - V2
// ======================================================
//
// Objetivo:
//
// Construir una notificación INTERNA para Pegaso
// cuando una conversación requiere intervención humana.
//
// Este mensaje NO se envía al prospecto.
//
// Destinos previstos:
// - Email Brevo
// - WhatsApp interno futuro
//
// ======================================================

const input =
  $input.first().json;


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

  const n =
    Number(valor);

  return Number.isFinite(n)
    ? n
    : null;
}


// ======================================================
// 2. DATOS PRINCIPALES
// ======================================================

const conversacionId =
  numeroONull(
    input.conversacion_id
  );


const prospectoId =
  numeroONull(
    input.prospecto_id
  );


const nombre =
  texto(
    input.prospecto_nombre
  ) ??
  texto(
    input.nombre_whatsapp
  ) ??
  'Sin nombre';


const telefono =
  texto(
    input.telefono
  ) ??
  'No disponible';


const ciudad =
  texto(
    input.prospecto_ciudad
  ) ??
  texto(
    input.ciudad_detectada
  ) ??
  'No registrada';


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
    'OTRO'
  ).toUpperCase();


const prioridad =
  (
    texto(
      input.handoff_prioridad
    ) ??
    texto(
      input.prioridad_derivacion
    ) ??
    'NORMAL'
  ).toUpperCase();


const mensajeCliente =
  texto(
    input.handoff_mensaje_cliente
  ) ??
  texto(
    input.mensaje_actual
  ) ??
  'No disponible';


const clasificacionProspecto =
  texto(
    input.clasificacion_prospecto
  ) ??
  texto(
    input.prospecto_clasificacion
  ) ??
  null;


// ======================================================
// 3. CLASIFICAR TIPO DE ALERTA
// ======================================================

let categoriaNotificacion =
  'REVISION_GENERAL';


if (
  [
    'SOLICITA_CUENTA',
    'SOLICITA_DATOS_BANCARIOS',
    'PIDE_CUENTA',
    'PIDE_NUMERO_CUENTA',
    'INTERES_PAGO'
  ].includes(motivo)
) {

  categoriaNotificacion =
    'INTERESADO_PAGO';

}


else if (
  [
    'REPORTA_PAGO',
    'COMPROBANTE_PAGO',
    'PAGO_REALIZADO'
  ].includes(motivo)
) {

  categoriaNotificacion =
    'PAGO_REPORTADO';

}


else if (
  [
    'SOLICITA_LLAMADA',
    'QUIERE_LLAMAR',
    'QUIERE_QUE_LO_LLAMEN',
    'ATENCION_TELEFONICA'
  ].includes(motivo)
) {

  categoriaNotificacion =
    'SOLICITA_CONTACTO';

}


else if (
  [
    'ARCHIVO_NO_ANALIZABLE',
    'IMAGEN_NO_ANALIZABLE',
    'ARCHIVO_REQUIERE_REVISION',
    'DISENO_REQUIERE_REVISION'
  ].includes(motivo)
) {

  categoriaNotificacion =
    'ARCHIVO_REQUIERE_REVISION';

}


else if (
  [
    'NEGOCIACION',
    'NEGOCIAR_PRECIO',
    'PRECIO_ESPECIAL',
    'DESCUENTO'
  ].includes(motivo)
) {

  categoriaNotificacion =
    'NEGOCIACION';

}


else if (
  [
    'RECLAMO',
    'INCONVENIENTE',
    'QUEJA'
  ].includes(motivo)
) {

  categoriaNotificacion =
    'RECLAMO';

}


// ======================================================
// 4. RESOLVER PRIORIDAD REAL
// ======================================================

let prioridadFinal =
  prioridad;


if (
  categoriaNotificacion ===
  'PAGO_REPORTADO'
) {

  prioridadFinal =
    'ALTA';

}


else if (
  categoriaNotificacion ===
  'INTERESADO_PAGO'
) {

  prioridadFinal =
    'ALTA';

}


else if (
  categoriaNotificacion ===
  'RECLAMO'
) {

  prioridadFinal =
    'ALTA';

}


else if (
  categoriaNotificacion ===
  'SOLICITA_CONTACTO'
) {

  prioridadFinal =
    'MEDIA';

}


// ======================================================
// 5. ASUNTO EMAIL
// ======================================================

let asunto =
  'Pegaso - Prospecto requiere revisión';


if (
  categoriaNotificacion ===
  'INTERESADO_PAGO'
) {

  asunto =
    '🔥 Pegaso - Prospecto solicita datos de pago';

}


else if (
  categoriaNotificacion ===
  'PAGO_REPORTADO'
) {

  asunto =
    '💰 Pegaso - Prospecto reportó un pago';

}


else if (
  categoriaNotificacion ===
  'RECLAMO'
) {

  asunto =
    '⚠️ Pegaso - Reclamo requiere atención';

}


else if (
  categoriaNotificacion ===
  'ARCHIVO_REQUIERE_REVISION'
) {

  asunto =
    '📎 Pegaso - Archivo requiere revisión';

}


// ======================================================
// 6. TEXTO INTERNO
// ======================================================

const lineas = [
  'PEGASO ADHESIVOS',
  '',
  'Nueva conversación requiere atención.',
  '',
  `Prioridad: ${prioridadFinal}`,
  `Categoría: ${categoriaNotificacion}`,
  `Motivo: ${motivo}`,
  `Intención: ${intencion}`,
  '',
  `Prospecto: ${nombre}`,
  `Teléfono: ${telefono}`,
  `Ciudad: ${ciudad}`,
  `Clasificación: ${clasificacionProspecto ?? 'No definida'}`,
  '',
  'Último mensaje:',
  mensajeCliente,
  '',
  `Conversación ID: ${conversacionId ?? 'N/D'}`,
  `Prospecto ID: ${prospectoId ?? 'N/D'}`
];


const mensajeNotificacion =
  lineas.join('\n');


// ======================================================
// 7. HTML EMAIL
// ======================================================

const htmlEmail = `
<h2>Pegaso Adhesivos</h2>

<p><strong>Nueva conversación requiere atención.</strong></p>

<table style="border-collapse:collapse;">
  <tr>
    <td><strong>Prioridad</strong></td>
    <td>${prioridadFinal}</td>
  </tr>
  <tr>
    <td><strong>Categoría</strong></td>
    <td>${categoriaNotificacion}</td>
  </tr>
  <tr>
    <td><strong>Motivo</strong></td>
    <td>${motivo}</td>
  </tr>
  <tr>
    <td><strong>Intención</strong></td>
    <td>${intencion}</td>
  </tr>
  <tr>
    <td><strong>Prospecto</strong></td>
    <td>${nombre}</td>
  </tr>
  <tr>
    <td><strong>Teléfono</strong></td>
    <td>${telefono}</td>
  </tr>
  <tr>
    <td><strong>Ciudad</strong></td>
    <td>${ciudad}</td>
  </tr>
  <tr>
    <td><strong>Clasificación</strong></td>
    <td>${clasificacionProspecto ?? 'No definida'}</td>
  </tr>
</table>

<h3>Último mensaje</h3>

<p>${mensajeCliente}</p>

<hr>

<p>
Conversación ID: ${conversacionId ?? 'N/D'}<br>
Prospecto ID: ${prospectoId ?? 'N/D'}
</p>
`;


// ======================================================
// 8. SALIDA
// ======================================================

return [
  {
    json: {

      ...input,

      notificacion_interna: true,

      categoria_notificacion:
        categoriaNotificacion,

      prioridad_notificacion:
        prioridadFinal,

      asunto_notificacion:
        asunto,

      mensaje_notificacion:
        mensajeNotificacion,

      html_notificacion:
        htmlEmail,

      // Inicialmente usaremos EMAIL.
      canal_notificacion:
        'EMAIL',

      enviar_notificacion:
        true,

      notificacion_preparada_at:
        new Date().toISOString()

    }
  }
];