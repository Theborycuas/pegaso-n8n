// ======================================================
// N8N NODE - PEGASO
// ======================================================
// Nombre: Peparar notificacion humano
// Node ID: bc2e3649-a530-43b4-be61-72665ab148cf
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
// NODO N8N: Peparar notificacion humano
// ARCHIVO: code/06-derivacion-humana/preparar-notificacion-humano.js
// VERSION: 2.1
// RESPONSABILIDAD:
// - Construir una notificaci├│n INTERNA para Pegaso cuando una conversaci├│n requiere intervenci├│n humana
// - Clasificar la alerta en una categor├¡a (INTERESADO_PAGO, PAGO_REPORTADO, SOLICITA_CONTACTO, ARCHIVO_REQUIERE_REVISION, NEGOCIACION, RECLAMO, REVISION_GENERAL)
// - Ajustar la prioridad de la alerta seg├║n la categor├¡a
// - Generar asunto, texto plano y HTML del email con datos del prospecto y su ├║ltimo mensaje
// - Marcar canal_notificacion = EMAIL (destinos previstos: email Brevo/Resend; WhatsApp interno a futuro)
// - NO enviar el correo (lo hacen los nodos HTTP "Brevo - Enviar notificaci├│n humana" y, como respaldo, "Resend - Enviar notificaci├│n humana")
// - NO enviar nada al prospecto
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
    'ENVIA_COMPROBANTE',
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
    'IMAGEN_REQUIERE_REVISION',
    'ARCHIVO_NO_PROCESABLE',
    'ARCHIVO_DISENO',
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
  'Pegaso - Prospecto requiere revisi├│n';


if (
  categoriaNotificacion ===
  'INTERESADO_PAGO'
) {

  asunto =
    '­ƒöÑ Pegaso - Prospecto solicita datos de pago';

}


else if (
  categoriaNotificacion ===
  'PAGO_REPORTADO'
) {

  asunto =
    '­ƒÆ░ Pegaso - Prospecto report├│ un pago';

}


else if (
  categoriaNotificacion ===
  'RECLAMO'
) {

  asunto =
    'ÔÜá´©Å Pegaso - Reclamo requiere atenci├│n';

}


else if (
  categoriaNotificacion ===
  'ARCHIVO_REQUIERE_REVISION'
) {

  asunto =
    '­ƒôÄ Pegaso - Archivo requiere revisi├│n';

}


// ======================================================
// 6. TEXTO INTERNO
// ======================================================

const lineas = [
  'PEGASO ADHESIVOS',
  '',
  'Nueva conversaci├│n requiere atenci├│n.',
  '',
  `Prioridad: ${prioridadFinal}`,
  `Categor├¡a: ${categoriaNotificacion}`,
  `Motivo: ${motivo}`,
  `Intenci├│n: ${intencion}`,
  '',
  `Prospecto: ${nombre}`,
  `Tel├®fono: ${telefono}`,
  `Ciudad: ${ciudad}`,
  `Clasificaci├│n: ${clasificacionProspecto ?? 'No definida'}`,
  '',
  '├Ültimo mensaje:',
  mensajeCliente,
  '',
  `Conversaci├│n ID: ${conversacionId ?? 'N/D'}`,
  `Prospecto ID: ${prospectoId ?? 'N/D'}`
];


const mensajeNotificacion =
  lineas.join('\n');


// ======================================================
// 7. HTML EMAIL
// ======================================================

const htmlEmail = `
<h2>Pegaso Adhesivos</h2>

<p><strong>Nueva conversaci├│n requiere atenci├│n.</strong></p>

<table style="border-collapse:collapse;">
  <tr>
    <td><strong>Prioridad</strong></td>
    <td>${prioridadFinal}</td>
  </tr>
  <tr>
    <td><strong>Categor├¡a</strong></td>
    <td>${categoriaNotificacion}</td>
  </tr>
  <tr>
    <td><strong>Motivo</strong></td>
    <td>${motivo}</td>
  </tr>
  <tr>
    <td><strong>Intenci├│n</strong></td>
    <td>${intencion}</td>
  </tr>
  <tr>
    <td><strong>Prospecto</strong></td>
    <td>${nombre}</td>
  </tr>
  <tr>
    <td><strong>Tel├®fono</strong></td>
    <td>${telefono}</td>
  </tr>
  <tr>
    <td><strong>Ciudad</strong></td>
    <td>${ciudad}</td>
  </tr>
  <tr>
    <td><strong>Clasificaci├│n</strong></td>
    <td>${clasificacionProspecto ?? 'No definida'}</td>
  </tr>
</table>

<h3>├Ültimo mensaje</h3>

<p>${mensajeCliente}</p>

<hr>

<p>
Conversaci├│n ID: ${conversacionId ?? 'N/D'}<br>
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
