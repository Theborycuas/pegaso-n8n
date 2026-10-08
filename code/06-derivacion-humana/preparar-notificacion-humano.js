// ======================================================
// NODO N8N: Peparar notificacion humano
// ARCHIVO: code/06-derivacion-humana/preparar-notificacion-humano.js
// VERSION: 3.0
// RESPONSABILIDAD:
// - Construir una notificación INTERNA para Pegaso cuando una conversación requiere intervención humana
// - Tomar el contrato final de "Finalizar derivación humana" (vía "IF: ¿Requiere notificación?"); si falta un dato
//   (intención, prioridad, motivo, nombre, ciudad, clasificación, mensaje real), recuperarlo de "Preparar derivación humana"
// - Clasificar la alerta: INTERESADO_PAGO (incluye SOLICITA_DATOS_PAGO), PAGO_REPORTADO, CONTINUAR_PEDIDO, SOLICITA_CONTACTO,
//   ARCHIVO_REQUIERE_REVISION, ENTRADA_REQUIERE_REVISION, NEGOCIACION, RECLAMO o REVISION_GENERAL (por motivo; respaldo por intención)
// - Resolver la prioridad como la MAYOR entre la del handoff y la mínima de la categoría (nunca baja una ALTA)
// - Generar asunto, texto plano y HTML (con los datos del cliente escapados) del email
// - Marcar canal_notificacion = EMAIL
// - NO enviar el correo (lo hacen "Brevo - Enviar notificación humana" y, solo en su rama Error, "Resend - Enviar notificación humana")
// - NO enviar nada al prospecto
// ======================================================

const input =
  $input.first().json ?? {};


// ======================================================
// 1. HELPERS
// ======================================================

function texto(valor) {
  if (valor === undefined || valor === null) {
    return null;
  }

  const limpio = String(valor).trim();

  return limpio !== '' ? limpio : null;
}

function numeroONull(valor) {
  if (valor === undefined || valor === null || valor === '') {
    return null;
  }

  const n = Number(valor);

  return Number.isFinite(n) ? n : null;
}

function primero(...valores) {
  for (const valor of valores) {
    const limpio = texto(valor);

    if (limpio !== null) {
      return limpio;
    }
  }

  return null;
}

function escaparHtml(valor) {
  return String(valor ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}


// ======================================================
// 2. RESPALDO: CONTRATO DE "Preparar derivación humana"
// ======================================================

let derivacion = {};

try {
  derivacion = $('Preparar derivación humana').first().json ?? {};
} catch (error) {
  derivacion = {};
}


// ======================================================
// 3. DATOS PRINCIPALES
// ======================================================

const conversacionId = numeroONull(input.conversacion_id ?? derivacion.conversacion_id);

const prospectoId = numeroONull(input.prospecto_id ?? derivacion.prospecto_id);

const nombre =
  primero(
    input.prospecto_nombre,
    input.nombre_whatsapp,
    derivacion.prospecto_nombre,
    derivacion.nombre_whatsapp
  ) ?? 'Sin nombre';

const telefono =
  primero(input.telefono, derivacion.telefono) ?? 'No disponible';

const ciudad =
  primero(
    input.prospecto_ciudad,
    input.ciudad_detectada,
    derivacion.prospecto_ciudad,
    derivacion.ciudad_detectada
  ) ?? 'No registrada';

const intencion =
  (primero(input.intencion, derivacion.intencion) ?? 'OTRO').toUpperCase();

const motivo =
  (
    primero(
      input.handoff_motivo,
      input.motivo_derivacion,
      input.motivo,
      derivacion.handoff_motivo,
      derivacion.motivo_derivacion
    ) ?? 'OTRO'
  ).toUpperCase();

const prioridad =
  (
    primero(
      input.handoff_prioridad,
      input.prioridad_derivacion,
      input.prioridad,
      derivacion.handoff_prioridad,
      derivacion.prioridad_derivacion
    ) ?? 'NORMAL'
  ).toUpperCase();

const mensajeCliente =
  primero(
    input.handoff_mensaje_cliente,
    input.mensaje_cliente_original,
    derivacion.handoff_mensaje_cliente,
    derivacion.mensaje_cliente_original,
    input.mensaje_actual,
    derivacion.mensaje_actual
  ) ?? 'No disponible';

const clasificacionProspecto =
  primero(
    input.prospecto_clasificacion,
    input.clasificacion_prospecto,
    derivacion.prospecto_clasificacion,
    derivacion.clasificacion_prospecto
  );

const origenDerivacion =
  primero(input.origen_derivacion, derivacion.origen_derivacion) ?? 'CEREBRO_COMERCIAL';


// ======================================================
// 4. CATEGORÍA DE LA ALERTA
// ======================================================

const CATEGORIA_POR_MOTIVO = {
  INTERESADO_PAGO: [
    'SOLICITA_DATOS_PAGO',
    'SOLICITA_CUENTA',
    'SOLICITA_DATOS_BANCARIOS',
    'PIDE_CUENTA',
    'PIDE_NUMERO_CUENTA',
    'INTERES_PAGO'
  ],
  PAGO_REPORTADO: [
    'REPORTA_PAGO',
    'ENVIA_COMPROBANTE',
    'COMPROBANTE_PAGO',
    'PAGO_REALIZADO'
  ],
  CONTINUAR_PEDIDO: [
    'DESEA_CONTINUAR_PEDIDO',
    'CONFIRMAR_PEDIDO'
  ],
  SOLICITA_CONTACTO: [
    'SOLICITA_LLAMADA',
    'SOLICITA_HABLAR_CON_PERSONA',
    'QUIERE_LLAMAR',
    'QUIERE_QUE_LO_LLAMEN',
    'ATENCION_TELEFONICA'
  ],
  ARCHIVO_REQUIERE_REVISION: [
    'IMAGEN_REQUIERE_REVISION',
    'ARCHIVO_NO_PROCESABLE',
    'ARCHIVO_DISENO',
    'ARCHIVO_NO_ANALIZABLE',
    'IMAGEN_NO_ANALIZABLE',
    'ARCHIVO_REQUIERE_REVISION',
    'DISENO_REQUIERE_REVISION',
    'DISENO_ESPECIAL'
  ],
  ENTRADA_REQUIERE_REVISION: [
    'ENTRADA_NO_SOPORTADA'
  ],
  NEGOCIACION: [
    'NEGOCIACION',
    'NEGOCIACION_COMERCIAL',
    'NEGOCIAR_PRECIO',
    'PRECIO_ESPECIAL',
    'DESCUENTO'
  ],
  RECLAMO: [
    'RECLAMO',
    'PROBLEMA_PEDIDO',
    'PROBLEMA_PAGO',
    'PROBLEMA_ENTREGA',
    'INCONVENIENTE',
    'QUEJA'
  ]
};

const CATEGORIA_POR_INTENCION = {
  CONSULTAR_PAGO: 'INTERESADO_PAGO',
  REPORTAR_PAGO: 'PAGO_REPORTADO',
  CONFIRMAR_PEDIDO: 'CONTINUAR_PEDIDO',
  SOLICITAR_LLAMADA: 'SOLICITA_CONTACTO',
  SOLICITAR_HUMANO: 'SOLICITA_CONTACTO',
  NEGOCIAR: 'NEGOCIACION',
  RECLAMO: 'RECLAMO'
};

const categoriaNotificacion =
  Object.keys(CATEGORIA_POR_MOTIVO).find(categoria => CATEGORIA_POR_MOTIVO[categoria].includes(motivo)) ??
  CATEGORIA_POR_INTENCION[intencion] ??
  'REVISION_GENERAL';


// ======================================================
// 5. PRIORIDAD REAL
// ======================================================
//
// La categoría fija un mínimo; nunca baja la prioridad del handoff.
// ======================================================

const RANGO_PRIORIDAD = { NORMAL: 1, MEDIA: 2, ALTA: 3 };

const PRIORIDAD_MINIMA_POR_CATEGORIA = {
  INTERESADO_PAGO: 'ALTA',
  PAGO_REPORTADO: 'ALTA',
  CONTINUAR_PEDIDO: 'ALTA',
  RECLAMO: 'ALTA',
  SOLICITA_CONTACTO: 'MEDIA',
  NEGOCIACION: 'MEDIA',
  ARCHIVO_REQUIERE_REVISION: 'MEDIA',
  ENTRADA_REQUIERE_REVISION: 'MEDIA',
  REVISION_GENERAL: 'NORMAL'
};

const prioridadMinima = PRIORIDAD_MINIMA_POR_CATEGORIA[categoriaNotificacion] ?? 'NORMAL';

const prioridadFinal =
  RANGO_PRIORIDAD[prioridad] >= RANGO_PRIORIDAD[prioridadMinima]
    ? prioridad
    : prioridadMinima;


// ======================================================
// 6. ASUNTO EMAIL
// ======================================================

const ASUNTO_POR_CATEGORIA = {
  INTERESADO_PAGO: '🔥 Pegaso - Prospecto solicita datos de pago',
  PAGO_REPORTADO: '💰 Pegaso - Prospecto reportó un pago',
  CONTINUAR_PEDIDO: '🔥 Pegaso - Prospecto quiere continuar con su pedido',
  RECLAMO: '⚠️ Pegaso - Reclamo requiere atención',
  ARCHIVO_REQUIERE_REVISION: '📎 Pegaso - Archivo requiere revisión',
  ENTRADA_REQUIERE_REVISION: '📎 Pegaso - Mensaje no soportado requiere revisión',
  SOLICITA_CONTACTO: '📞 Pegaso - Prospecto solicita contacto',
  NEGOCIACION: '💬 Pegaso - Prospecto quiere negociar'
};

const asunto =
  ASUNTO_POR_CATEGORIA[categoriaNotificacion] ??
  'Pegaso - Prospecto requiere revisión';


// ======================================================
// 7. TEXTO INTERNO
// ======================================================

const filas = [
  ['Prioridad', prioridadFinal],
  ['Categoría', categoriaNotificacion],
  ['Motivo', motivo],
  ['Intención', intencion],
  ['Origen', origenDerivacion],
  ['Prospecto', nombre],
  ['Teléfono', telefono],
  ['Ciudad', ciudad],
  ['Clasificación', clasificacionProspecto ?? 'No definida']
];

const lineas = [
  'PEGASO ADHESIVOS',
  '',
  'Nueva conversación requiere atención.',
  '',
  ...filas.slice(0, 5).map(([etiqueta, valor]) => `${etiqueta}: ${valor}`),
  '',
  ...filas.slice(5).map(([etiqueta, valor]) => `${etiqueta}: ${valor}`),
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
// 8. HTML EMAIL
// ======================================================

const filasHtml = filas
  .map(([etiqueta, valor]) =>
    `  <tr>\n    <td><strong>${etiqueta}</strong></td>\n    <td>${escaparHtml(valor)}</td>\n  </tr>`
  )
  .join('\n');

const htmlEmail = `
<h2>Pegaso Adhesivos</h2>

<p><strong>Nueva conversación requiere atención.</strong></p>

<table style="border-collapse:collapse;">
${filasHtml}
</table>

<h3>Último mensaje</h3>

<p>${escaparHtml(mensajeCliente).replace(/\n/g, '<br>')}</p>

<hr>

<p>
Conversación ID: ${conversacionId ?? 'N/D'}<br>
Prospecto ID: ${prospectoId ?? 'N/D'}
</p>
`;


// ======================================================
// 9. SALIDA
// ======================================================

return [
  {
    json: {
      ...input,

      notificacion_interna: true,

      categoria_notificacion: categoriaNotificacion,
      prioridad_notificacion: prioridadFinal,

      asunto_notificacion: asunto,
      mensaje_notificacion: mensajeNotificacion,
      html_notificacion: htmlEmail,

      canal_notificacion: 'EMAIL',
      enviar_notificacion: true,

      notificacion_preparada_at: new Date().toISOString()
    }
  }
];
