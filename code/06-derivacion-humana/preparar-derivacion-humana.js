// ======================================================
// NODO N8N: Preparar derivación humana
// ARCHIVO: code/06-derivacion-humana/preparar-derivacion-humana.js
// VERSION: 4.0
// RESPONSABILIDAD:
// - Punto ÚNICO de entrada a la ruta de handoff. Recibe tres orígenes:
//   1. "Enrutar acción comercial" (DERIVAR_HUMANO) con la decisión del cerebro (respaldo: "Recuperar decisión comercial")
//   2. "Preparar derivación imagen fallida" (las 3 IA visuales fallaron), que ya trae el contrato completo
//   3. "IF: ¿Derivación directa por entrada?" (true): entrada no soportada; la decisión se toma de "Normalizar mensaje"
// - Recuperar la identidad si no viene en el input ("Preparar contexto IA", "Preparar conversación", "Unificar prospecto") y lanzar error
//   solo si conversacion_id o prospecto_id no existen en ningún nodo
// - Convertir la decisión en un contrato estable de HANDOFF: motivo (explícito; NINGUNO u OTRO se deducen de la intención), clasificación del handoff,
//   prioridad (la mayor entre la recibida y la mínima por motivo: nunca baja una ALTA) y notificación (nunca apaga una notificación pedida)
// - Conservar contexto_comercial (para que "Guardar contexto handoff" no borre la memoria) y el origen de la derivación
// - Preservar el mensaje original del cliente, separado del mensaje de transición de Pegaso, sin enlaces de media
// - NO escribir en PostgreSQL (lo hace "Marcar prospecto requiere humano")
// - NO dejar que los nodos posteriores reinterpreten estas decisiones: solo deben preservarlas
// ======================================================

const input = $input.first().json ?? {};


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

function numeroPositivoONull(valor) {
  if (valor === undefined || valor === null || valor === '') {
    return null;
  }

  const n = Number(valor);

  return Number.isFinite(n) && n > 0 ? n : null;
}

function booleano(valor, defecto = false) {
  if (typeof valor === 'boolean') {
    return valor;
  }

  if (valor === 'true' || valor === 1 || valor === '1') {
    return true;
  }

  if (valor === 'false' || valor === 0 || valor === '0') {
    return false;
  }

  return defecto;
}

function primero(...valores) {
  for (const valor of valores) {
    if (valor !== undefined && valor !== null && valor !== '') {
      return valor;
    }
  }

  return null;
}

function jsonDe(nodo) {
  try {
    return $(nodo).first().json ?? {};
  } catch (error) {
    return {};
  }
}

function objetoONull(valor) {
  if (valor && typeof valor === 'object' && !Array.isArray(valor)) {
    return valor;
  }

  if (typeof valor === 'string') {
    try {
      const parsed = JSON.parse(valor);

      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
    } catch (error) {
      return null;
    }
  }

  return null;
}

function sinLineasDeMedia(valor) {
  const limpio = String(valor ?? '')
    .split('\n')
    .filter(linea => !linea.trim().startsWith('[MEDIA_PENDIENTE]'))
    .join('\n')
    .trim();

  return limpio !== '' ? limpio : null;
}


// ======================================================
// 2. FUENTES
// ======================================================

const decisionAnterior = jsonDe('Recuperar decisión comercial');
const contextoIA = jsonDe('Preparar contexto IA');
const conversacion = jsonDe('Preparar conversación');
const prospectoUnificado = jsonDe('Unificar prospecto');


// ======================================================
// 3. DERIVACIÓN DIRECTA POR ENTRADA NO SOPORTADA
// ======================================================
//
// Por "IF: ¿Derivación directa por entrada?" llega la salida de
// "Resolver turno conversacional", sin decisión. La decisión la
// fijó "Preparar entrada no soportada" y viaja en "Normalizar mensaje".
// ======================================================

let entradaDirecta = {};

if (input.derivacion_directa !== true && !texto(input.accion)) {
  const normalizado = jsonDe('Normalizar mensaje');

  if (normalizado.derivacion_directa === true) {
    entradaDirecta = {
      intencion: 'OTRO',
      accion: 'DERIVAR_HUMANO',
      handoff_motivo: texto(normalizado.derivacion_motivo) ?? 'ENTRADA_NO_SOPORTADA',
      handoff_clasificacion: texto(normalizado.derivacion_clasificacion) ?? 'REVISION_COMERCIAL',
      handoff_prioridad: texto(normalizado.derivacion_prioridad) ?? 'MEDIA',
      requiere_notificacion: true,
      origen_derivacion: texto(normalizado.origen_derivacion) ?? 'ENTRADA_NO_SOPORTADA',
      derivacion_directa: true,
      derivacion_directa_motivo: texto(normalizado.derivacion_directa_motivo) ?? 'ENTRADA_NO_SOPORTADA',
      telefono: normalizado.telefono,
      nombre_whatsapp: normalizado.nombre_whatsapp
    };
  }
}

const base = {
  ...entradaDirecta,
  ...input
};


// ======================================================
// 4. IDENTIDAD
// ======================================================

const conversacionId = numeroPositivoONull(
  primero(
    base.conversacion_id,
    decisionAnterior.conversacion_id,
    contextoIA.conversacion_id,
    conversacion.conversacion_id
  )
);

const prospectoId = numeroPositivoONull(
  primero(
    base.prospecto_id,
    decisionAnterior.prospecto_id,
    contextoIA.prospecto_id,
    conversacion.prospecto_id,
    prospectoUnificado.prospecto_id
  )
);

const clienteId = numeroPositivoONull(
  primero(base.cliente_id, decisionAnterior.cliente_id, contextoIA.cliente_id, conversacion.cliente_id)
);

const contactoId = numeroPositivoONull(
  primero(base.contacto_id, decisionAnterior.contacto_id, contextoIA.contacto_id, conversacion.contacto_id)
);

if (conversacionId === null) {
  throw new Error('PREPARAR DERIVACIÓN HUMANA: conversacion_id inválido.');
}

if (prospectoId === null) {
  throw new Error('PREPARAR DERIVACIÓN HUMANA: prospecto_id inválido.');
}


// ======================================================
// 5. INTENCIÓN / ACCIÓN
// ======================================================

const intencion = (texto(base.intencion) ?? texto(decisionAnterior.intencion) ?? 'OTRO').toUpperCase();

const accionOriginal = (texto(base.accion) ?? texto(decisionAnterior.accion) ?? 'DERIVAR_HUMANO').toUpperCase();


// ======================================================
// 6. MENSAJE ORIGINAL DEL CLIENTE
// ======================================================
//
// Representa exclusivamente lo que escribió el prospecto.
// Jamás debe reemplazarse con el mensaje de transición de
// Pegaso. Nunca lleva el enlace de una imagen pendiente.
// ======================================================

const mensajeClienteOriginal =
  texto(base.mensaje_actual) ??
  texto(decisionAnterior.mensaje_actual) ??
  texto(base.handoff_mensaje_cliente) ??
  sinLineasDeMedia(base.turno_texto) ??
  texto(contextoIA.mensaje_actual) ??
  sinLineasDeMedia(conversacion.mensaje);


// ======================================================
// 7. DATOS DEL PROSPECTO
// ======================================================

const nombreProspecto = texto(
  primero(
    base.prospecto_nombre,
    decisionAnterior.prospecto_nombre,
    contextoIA.prospecto_nombre,
    conversacion.prospecto_nombre,
    prospectoUnificado.prospecto_nombre,
    base.nombre_whatsapp,
    decisionAnterior.nombre_whatsapp,
    contextoIA.nombre_whatsapp,
    conversacion.nombre_whatsapp
  )
);

const telefono = texto(
  primero(base.telefono, decisionAnterior.telefono, contextoIA.telefono, conversacion.telefono, prospectoUnificado.telefono)
);

const ciudad = texto(
  primero(
    base.prospecto_ciudad,
    decisionAnterior.prospecto_ciudad,
    base.ciudad_detectada,
    decisionAnterior.ciudad_detectada,
    contextoIA.prospecto_ciudad,
    conversacion.prospecto_ciudad,
    prospectoUnificado.prospecto_ciudad
  )
);

const provincia = texto(
  primero(
    base.prospecto_provincia,
    decisionAnterior.prospecto_provincia,
    base.provincia_detectada,
    decisionAnterior.provincia_detectada,
    contextoIA.prospecto_provincia,
    conversacion.prospecto_provincia,
    prospectoUnificado.prospecto_provincia
  )
);

const clasificacionProspecto = texto(
  primero(
    base.clasificacion_prospecto,
    base.prospecto_clasificacion,
    decisionAnterior.clasificacion_prospecto,
    decisionAnterior.prospecto_clasificacion,
    contextoIA.prospecto_clasificacion,
    conversacion.prospecto_clasificacion
  )
)?.toUpperCase() ?? null;

const contextoComercial =
  objetoONull(base.contexto_comercial) ??
  objetoONull(decisionAnterior.contexto_comercial) ??
  objetoONull(contextoIA.contexto_comercial) ??
  objetoONull(conversacion.contexto_comercial) ??
  {};


// ======================================================
// 8. MOTIVO FUNCIONAL
// ======================================================
//
// Se respeta el motivo explícito. NINGUNO (o un OTRO cuando la
// intención es concreta) se deduce de la intención:
// "Envíeme un número de cuenta" -> CONSULTAR_PAGO -> SOLICITA_DATOS_PAGO.
// ======================================================

const MOTIVO_POR_INTENCION = {
  CONSULTAR_PAGO: 'SOLICITA_DATOS_PAGO',
  REPORTAR_PAGO: 'REPORTA_PAGO',
  CONFIRMAR_PEDIDO: 'DESEA_CONTINUAR_PEDIDO',
  ACEPTAR_COTIZACION: 'DESEA_CONTINUAR_PEDIDO',
  NEGOCIAR: 'NEGOCIACION_COMERCIAL',
  RECLAMO: 'RECLAMO',
  SOLICITAR_LLAMADA: 'SOLICITA_LLAMADA',
  SOLICITAR_HUMANO: 'SOLICITA_HABLAR_CON_PERSONA'
};

const motivoExplicito = texto(
  primero(
    base.handoff_motivo,
    base.motivo_derivacion,
    decisionAnterior.handoff_motivo,
    decisionAnterior.motivo_derivacion
  )
)?.toUpperCase() ?? null;

const motivoDeIntencion = MOTIVO_POR_INTENCION[intencion] ?? null;

let motivo = motivoExplicito;

if (!motivo || motivo === 'NINGUNO' || (motivo === 'OTRO' && motivoDeIntencion)) {
  motivo = motivoDeIntencion ?? (motivo === 'OTRO' ? 'OTRO' : 'ATENCION_COMERCIAL');
}


// ======================================================
// 9. CLASIFICACIÓN HANDOFF
// ======================================================

let clasificacionHandoff = texto(
  primero(
    base.handoff_clasificacion,
    base.clasificacion_handoff,
    decisionAnterior.handoff_clasificacion,
    decisionAnterior.clasificacion_handoff
  )
)?.toUpperCase() ?? null;

if (!clasificacionHandoff) {
  switch (motivo) {
    case 'SOLICITA_DATOS_PAGO':
    case 'REPORTA_PAGO':
    case 'ENVIA_COMPROBANTE':
    case 'DESEA_CONTINUAR_PEDIDO':
    case 'CONFIRMAR_PEDIDO':
      clasificacionHandoff = 'CIERRE_COMERCIAL';
      break;

    case 'RECLAMO':
    case 'PROBLEMA_PEDIDO':
    case 'PROBLEMA_PAGO':
    case 'PROBLEMA_ENTREGA':
      clasificacionHandoff = 'POSTVENTA';
      break;

    case 'NEGOCIACION_COMERCIAL':
    case 'NEGOCIACION':
      clasificacionHandoff = 'NEGOCIACION';
      break;

    case 'SOLICITA_LLAMADA':
    case 'SOLICITA_HABLAR_CON_PERSONA':
      clasificacionHandoff = 'CONTACTO_DIRECTO';
      break;

    case 'IMAGEN_REQUIERE_REVISION':
      clasificacionHandoff = 'REVISION_IMAGEN';
      break;

    case 'ARCHIVO_NO_PROCESABLE':
    case 'ARCHIVO_DISENO':
      clasificacionHandoff = 'REVISION_ARCHIVO';
      break;

    default:
      clasificacionHandoff = 'REVISION_COMERCIAL';
  }
}


// ======================================================
// 10. PRIORIDAD
// ======================================================
//
// La prioridad recibida (IA o derivación directa) se respeta y
// las reglas solo pueden SUBIRLA: nunca baja una ALTA.
// ======================================================

const RANGO_PRIORIDAD = { NORMAL: 1, MEDIA: 2, ALTA: 3 };

const MOTIVOS_PRIORIDAD_ALTA = [
  'SOLICITA_DATOS_PAGO',
  'REPORTA_PAGO',
  'ENVIA_COMPROBANTE',
  'DESEA_CONTINUAR_PEDIDO',
  'CONFIRMAR_PEDIDO',
  'RECLAMO',
  'PROBLEMA_PAGO',
  'PROBLEMA_PEDIDO',
  'PROBLEMA_ENTREGA'
];

const MOTIVOS_PRIORIDAD_MEDIA = [
  'NEGOCIACION_COMERCIAL',
  'NEGOCIACION',
  'SOLICITA_LLAMADA',
  'SOLICITA_HABLAR_CON_PERSONA',
  'IMAGEN_REQUIERE_REVISION',
  'ARCHIVO_NO_PROCESABLE',
  'ARCHIVO_DISENO',
  'DISENO_ESPECIAL',
  'ENTRADA_NO_SOPORTADA'
];

const prioridadRecibida = (
  texto(
    primero(
      base.handoff_prioridad,
      base.prioridad_derivacion,
      decisionAnterior.handoff_prioridad,
      decisionAnterior.prioridad_derivacion
    )
  ) ?? 'NORMAL'
).toUpperCase();

const prioridadMinima = MOTIVOS_PRIORIDAD_ALTA.includes(motivo)
  ? 'ALTA'
  : MOTIVOS_PRIORIDAD_MEDIA.includes(motivo)
    ? 'MEDIA'
    : 'NORMAL';

const prioridad =
  RANGO_PRIORIDAD[prioridadRecibida] >= RANGO_PRIORIDAD[prioridadMinima]
    ? prioridadRecibida
    : prioridadMinima;


// ======================================================
// 11. NOTIFICACIÓN
// ======================================================
//
// Los eventos que necesitan atención pronta notifican siempre;
// una notificación pedida por la IA nunca se apaga aquí.
// ======================================================

const MOTIVOS_NOTIFICABLES = new Set([
  ...MOTIVOS_PRIORIDAD_ALTA,
  ...MOTIVOS_PRIORIDAD_MEDIA,
  'ARCHIVO_REQUIERE_REVISION',
  'DISENO_REQUIERE_REVISION',
  'COTIZACION_ESPECIAL'
]);

const requiereNotificacion =
  booleano(
    primero(
      base.requiere_notificacion,
      base.handoff_requiere_notificacion,
      decisionAnterior.requiere_notificacion,
      decisionAnterior.handoff_requiere_notificacion
    ),
    false
  ) ||
  MOTIVOS_NOTIFICABLES.has(motivo) ||
  prioridad === 'ALTA';


// ======================================================
// 12. ORIGEN
// ======================================================

const derivacionDirecta = base.derivacion_directa === true;

const origenDerivacion =
  texto(base.origen_derivacion) ??
  (derivacionDirecta ? 'DERIVACION_DIRECTA' : 'CEREBRO_COMERCIAL');


// ======================================================
// 13. SALIDA
// ======================================================

return [
  {
    json: {
      ...base,

      // ----------------------------------------------
      // IDENTIDAD
      // ----------------------------------------------

      conversacion_id: conversacionId,
      prospecto_id: prospectoId,
      cliente_id: clienteId,
      contacto_id: contactoId,
      telefono,
      nombre_whatsapp: nombreProspecto,
      prospecto_nombre: nombreProspecto,
      prospecto_ciudad: ciudad,
      prospecto_provincia: provincia,
      prospecto_clasificacion: clasificacionProspecto,

      // ----------------------------------------------
      // DECISIÓN
      // ----------------------------------------------

      intencion,
      accion_original: accionOriginal,
      accion: 'DERIVAR_HUMANO',
      requiere_humano: true,

      // ----------------------------------------------
      // HANDOFF
      // ----------------------------------------------

      handoff_motivo: motivo,
      motivo_derivacion: motivo,
      handoff_clasificacion: clasificacionHandoff,
      clasificacion_handoff: clasificacionHandoff,
      handoff_prioridad: prioridad,
      prioridad_derivacion: prioridad,

      // ----------------------------------------------
      // NOTIFICACIÓN
      // ----------------------------------------------

      requiere_notificacion: requiereNotificacion,
      handoff_requiere_notificacion: requiereNotificacion,

      // ----------------------------------------------
      // ORIGEN
      // ----------------------------------------------

      origen_derivacion: origenDerivacion,
      derivacion_directa: derivacionDirecta,
      derivacion_directa_motivo: derivacionDirecta ? texto(base.derivacion_directa_motivo) : null,
      analisis_imagen_fallido: base.analisis_imagen_fallido === true,

      // ----------------------------------------------
      // MENSAJE ORIGINAL CLIENTE
      // ----------------------------------------------

      mensaje_cliente_original: mensajeClienteOriginal,
      handoff_mensaje_cliente: mensajeClienteOriginal,

      // ----------------------------------------------
      // MEMORIA COMERCIAL
      // ----------------------------------------------

      contexto_comercial: contextoComercial,

      // ----------------------------------------------
      // CONTROL
      // ----------------------------------------------

      handoff_at: new Date().toISOString()
    }
  }
];
