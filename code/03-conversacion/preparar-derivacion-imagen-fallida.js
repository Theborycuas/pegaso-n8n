// ======================================================
// NODO N8N: Preparar derivación imagen fallida
// ARCHIVO: code/03-conversacion/preparar-derivacion-imagen-fallida.js
// VERSION: 1.0
// RESPONSABILIDAD:
// - Recibir de "IF: ¿Análisis OpenAI válido?" (false) las imágenes que fallaron en los 3 proveedores visuales (Groq, DeepSeek, OpenAI)
// - Emitir UN solo item (aunque fallen varias imágenes) con el contrato de "Preparar derivación humana" para entrar a la ruta estándar de handoff
// - Recuperar la identidad (conversacion_id, prospecto_id, cliente_id, contacto_id, telefono, nombre_whatsapp, prospecto) de los nodos
//   anteriores: "Preparar conversación", "Unificar prospecto", "Normalizar mensaje", "Resolver turno conversacional" y los validadores
// - Reconstruir el mensaje real del cliente del turno (texto y captions), sin enlaces ni líneas de sistema
// - Fijar la decisión: OTRO / DERIVAR_HUMANO, motivo IMAGEN_REQUIERE_REVISION, clasificación REVISION_IMAGEN, prioridad MEDIA,
//   notificación interna, origen ANALISIS_IMAGEN y derivacion_directa = FALLO_TOTAL_ANALISIS_IMAGEN
// - Conservar contexto_comercial para que "Guardar contexto handoff" no borre la memoria comercial
// - NO lanzar error por campos que faltan: si la identidad no aparece, "Preparar derivación humana" lo informa
// - NO llamar a la IA, NO escribir en PostgreSQL, NO enviar mensajes ni notificaciones
// ======================================================


// ======================================================
// 1. HELPERS
// ======================================================

function textoONull(valor) {
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

function objeto(valor) {
  if (valor && typeof valor === 'object' && !Array.isArray(valor)) {
    return valor;
  }

  if (typeof valor === 'string') {
    try {
      const parsed = JSON.parse(valor);

      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch (error) {
      return {};
    }
  }

  return {};
}

function clasificacionDesdeEstado(estado) {
  const valor = textoONull(estado)?.toUpperCase() ?? null;

  if (!valor) {
    return null;
  }

  if (['INTERESADO', 'ACEPTADO', 'PAGO_PENDIENTE', 'ABONO_REPORTADO', 'EN_PROCESO'].includes(valor)) {
    return 'A';
  }

  if (['COTIZADO', 'CALIFICADO', 'EN_SEGUIMIENTO', 'CONTACTADO'].includes(valor)) {
    return 'B';
  }

  return 'C';
}


// ======================================================
// 2. FUENTES
// ======================================================

const fallidas = $input.all().map(item => item.json ?? {});

const conversacion = jsonDe('Preparar conversación');
const prospecto = jsonDe('Unificar prospecto');
const entrada = jsonDe('Normalizar mensaje');
const turno = jsonDe('Resolver turno conversacional');


// ======================================================
// 3. IDENTIDAD
// ======================================================

const conversacionId = numeroPositivoONull(
  primero(
    conversacion.conversacion_id,
    turno.conversacion_id,
    ...fallidas.map(f => f.conversacion_id)
  )
);

const prospectoId = numeroPositivoONull(
  primero(
    conversacion.prospecto_id,
    conversacion.conversacion_prospecto_id,
    prospecto.prospecto_id
  )
);

const clienteId = numeroPositivoONull(primero(conversacion.cliente_id, prospecto.cliente_id));
const contactoId = numeroPositivoONull(primero(conversacion.contacto_id, prospecto.contacto_id));

const telefono = textoONull(primero(conversacion.telefono, prospecto.telefono, entrada.telefono));

const nombreWhatsapp = textoONull(
  primero(conversacion.nombre_whatsapp, prospecto.nombre_whatsapp, entrada.nombre_whatsapp)
);

const contextoComercial = objeto(conversacion.contexto_comercial);

const prospectoEstado = textoONull(primero(conversacion.prospecto_estado, prospecto.prospecto_estado));

const prospectoClasificacion =
  textoONull(primero(conversacion.prospecto_clasificacion, contextoComercial.prospecto?.clasificacion))?.toUpperCase() ??
  clasificacionDesdeEstado(prospectoEstado);


// ======================================================
// 4. MENSAJE REAL DEL CLIENTE
// ======================================================
//
// Texto y captions del turno. Se quitan las líneas de
// sistema ([MEDIA_PENDIENTE] con el enlace, [CONTEXTO DE
// IMAGEN …], [ARCHIVO NO PROCESABLE …]).
// ======================================================

function esLineaDeSistema(linea) {
  return /^\[(MEDIA_PENDIENTE|CONTEXTO DE IMAGEN|ARCHIVO NO PROCESABLE|ENTRADA NO SOPORTADA)[\]\s·]/.test(linea.trim());
}

function limpiarContenido(contenido) {
  return String(contenido ?? '')
    .split('\n')
    .filter(linea => !esLineaDeSistema(linea))
    .map(linea => linea.trim())
    .filter(Boolean)
    .join('\n');
}

const mensajesTurno =
  turno.continuar_procesamiento === true && Array.isArray(turno.turno_mensajes)
    ? turno.turno_mensajes
    : [{ contenido: primero(conversacion.mensaje, entrada.mensaje) }];

const mensajeCliente =
  mensajesTurno
    .map(m => limpiarContenido(m.contenido))
    .filter(Boolean)
    .join('\n') || '[IMAGEN]';


// ======================================================
// 5. DIAGNÓSTICO DE LAS IMÁGENES FALLIDAS
// ======================================================

const imagenesFallidas = fallidas.map(f => ({
  mensaje_id: numeroPositivoONull(f.mensaje_id),
  ultimo_proveedor: textoONull(f.proveedor_analisis),
  error_analisis: textoONull(f.error_analisis),
  detalle_error: textoONull(f.detalle_error)
}));


// ======================================================
// 6. SALIDA (contrato de "Preparar derivación humana")
// ======================================================

return [
  {
    json: {
      // ----------------------------------------------
      // IDENTIDAD
      // ----------------------------------------------

      conversacion_id: conversacionId,
      prospecto_id: prospectoId,
      cliente_id: clienteId,
      contacto_id: contactoId,
      telefono,
      nombre_whatsapp: nombreWhatsapp,
      tipo_actor: textoONull(conversacion.tipo_actor) ?? 'PROSPECTO',

      prospecto_nombre: textoONull(primero(conversacion.prospecto_nombre, prospecto.prospecto_nombre)),
      prospecto_estado: prospectoEstado,
      prospecto_ciudad: textoONull(primero(conversacion.prospecto_ciudad, prospecto.prospecto_ciudad)),
      prospecto_provincia: textoONull(primero(conversacion.prospecto_provincia, prospecto.prospecto_provincia)),
      prospecto_clasificacion: prospectoClasificacion,
      clasificacion_prospecto: prospectoClasificacion,

      // ----------------------------------------------
      // MENSAJE DEL CLIENTE
      // ----------------------------------------------

      mensaje_actual: mensajeCliente,
      handoff_mensaje_cliente: mensajeCliente,
      turno_mensaje_ids: Array.isArray(turno.turno_mensaje_ids) ? turno.turno_mensaje_ids : [],

      // ----------------------------------------------
      // DECISIÓN
      // ----------------------------------------------

      intencion: 'OTRO',
      accion: 'DERIVAR_HUMANO',
      requiere_humano: true,

      handoff_motivo: 'IMAGEN_REQUIERE_REVISION',
      motivo_derivacion: 'IMAGEN_REQUIERE_REVISION',

      handoff_clasificacion: 'REVISION_IMAGEN',
      clasificacion_handoff: 'REVISION_IMAGEN',

      handoff_prioridad: 'MEDIA',
      prioridad_derivacion: 'MEDIA',

      requiere_notificacion: true,
      handoff_requiere_notificacion: true,

      // El texto que se envía lo fija "Preparar mensaje transición humano" por el motivo.
      respuesta_sugerida: 'Permítame un momento por favor, ya revisamos la imagen que nos envió.',

      // ----------------------------------------------
      // ORIGEN
      // ----------------------------------------------

      origen_derivacion: 'ANALISIS_IMAGEN',
      analisis_imagen_fallido: true,
      derivacion_directa: true,
      derivacion_directa_motivo: 'FALLO_TOTAL_ANALISIS_IMAGEN',
      imagenes_fallidas: imagenesFallidas,

      // ----------------------------------------------
      // MEMORIA COMERCIAL (la reescribe "Guardar contexto handoff")
      // ----------------------------------------------

      contexto_comercial: contextoComercial
    }
  }
];
