// ======================================================
// N8N NODE - PEGASO
// ======================================================
// Nombre: Preparar derivación imagen fallida
// Node ID: 397a709e-9177-4c15-b89a-6bf1f4266e81
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
// NODO N8N: PREPARAR DERIVACIÓN IMAGEN FALLIDA
// PEGASO ADHESIVOS
// VERSION: 2.0
// ======================================================
//
// Se ejecuta únicamente cuando:
//
// Groq       -> análisis inválido
// DeepSeek   -> análisis inválido
// OpenAI     -> análisis inválido
//
// Objetivo:
//
// Transformar el fallo total del análisis visual en un
// contrato compatible con la ruta estándar de handoff.
//
// IMPORTANTE:
//
// - NO vuelve a analizar la imagen.
// - NO pasa otra vez por el cerebro comercial.
// - NO inventa qué contiene la imagen.
// - NO confirma pagos.
// - NO crea pedidos.
// - SÍ recupera correctamente prospecto/conversación.
// - SÍ conserva el mensaje/caption real del cliente.
// - SÍ deriva a humano con notificación.
//
// Ruta esperada:
//
// IF: ¿Análisis OpenAI válido?
// FALSE
//   ↓
// Preparar derivación imagen fallida
//   ↓
// Preparar derivación humana
//
// ======================================================


const input =
  $input.first().json ?? {};


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
    String(valor)
      .replace(/\s+/g, ' ')
      .trim();

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


function obtenerNodo(nombre) {

  try {

    return (
      $(nombre)
        .first()
        .json ??
      {}
    );

  } catch (_) {

    return {};

  }
}


function primerNumero(...valores) {

  for (const valor of valores) {

    const n =
      numeroONull(valor);

    if (
      n !== null &&
      n > 0
    ) {
      return n;
    }

  }

  return null;
}


function primerTexto(...valores) {

  for (const valor of valores) {

    const t =
      texto(valor);

    if (t !== null) {
      return t;
    }

  }

  return null;
}


// ======================================================
// 2. RECUPERAR CONTEXTO DE NODOS ANTERIORES
// ======================================================
//
// No dependemos de que el validador de imagen preserve
// todos los datos de negocio.
//
// ======================================================

const turno =
  obtenerNodo(
    'Resolver turno conversacional'
  );

const media =
  obtenerNodo(
    'Preparar media del turno'
  );

const entrada =
  obtenerNodo(
    'Preparar entrada WhatsApp'
  );

const resolverProspecto =
  obtenerNodo(
    'Resolver prospecto'
  );

const unificarProspecto =
  obtenerNodo(
    'Unificar prospecto'
  );

const prospectoCreado =
  obtenerNodo(
    'Preparar prospecto creado'
  );

const resolverConversacion =
  obtenerNodo(
    'Resolver conversación prospecto'
  );

const unificarConversacion =
  obtenerNodo(
    'Unificar conversación'
  );

const prepararConversacion =
  obtenerNodo(
    'Preparar conversación'
  );


// ======================================================
// 3. RESOLVER CONVERSACIÓN
// ======================================================

const conversacionId =
  primerNumero(

    input.conversacion_id,

    media.conversacion_id,

    turno.conversacion_id,

    resolverConversacion.conversacion_id,
    resolverConversacion.id,

    unificarConversacion.conversacion_id,
    unificarConversacion.id,

    prepararConversacion.conversacion_id,
    prepararConversacion.id
  );


if (conversacionId === null) {

  throw new Error(
    'DERIVACIÓN IMAGEN FALLIDA: no fue posible resolver conversacion_id.'
  );

}


// ======================================================
// 4. RESOLVER PROSPECTO
// ======================================================

const prospectoId =
  primerNumero(

    input.prospecto_id,

    resolverProspecto.prospecto_id,
    resolverProspecto.id,

    unificarProspecto.prospecto_id,
    unificarProspecto.id,

    prospectoCreado.prospecto_id,
    prospectoCreado.id,

    resolverConversacion.prospecto_id,

    unificarConversacion.prospecto_id,

    media.prospecto_id,

    turno.prospecto_id
  );


if (prospectoId === null) {

  throw new Error(
    'DERIVACIÓN IMAGEN FALLIDA: no fue posible resolver prospecto_id.'
  );

}


// ======================================================
// 5. CLIENTE / CONTACTO
// ======================================================

const clienteId =
  primerNumero(

    input.cliente_id,

    resolverProspecto.cliente_id,

    unificarProspecto.cliente_id,

    prospectoCreado.cliente_id,

    resolverConversacion.cliente_id,

    unificarConversacion.cliente_id
  );


const contactoId =
  primerNumero(

    input.contacto_id,

    resolverProspecto.contacto_id,

    unificarProspecto.contacto_id,

    prospectoCreado.contacto_id,

    resolverConversacion.contacto_id,

    unificarConversacion.contacto_id
  );


// ======================================================
// 6. TELÉFONO Y NOMBRE
// ======================================================

const telefono =
  primerTexto(

    input.telefono,

    resolverProspecto.telefono,

    unificarProspecto.telefono,

    prospectoCreado.telefono,

    entrada.telefono
  );


const nombre =
  primerTexto(

    input.prospecto_nombre,
    input.nombre_whatsapp,

    resolverProspecto.nombre_whatsapp,
    resolverProspecto.nombre,

    unificarProspecto.nombre_whatsapp,
    unificarProspecto.nombre,

    prospectoCreado.nombre_whatsapp,
    prospectoCreado.nombre,

    entrada.nombre_whatsapp
  );


// ======================================================
// 7. MENSAJE REAL DEL CLIENTE
// ======================================================
//
// Preferimos caption/texto original.
//
// NO usamos contenido_actualizado del validador como
// mensaje principal porque contiene metadata técnica.
//
// ======================================================

const mensajeCliente =
  primerTexto(

    input.mensaje_cliente_original,

    media.texto_turno_cliente,

    media.caption,

    entrada.mensaje,

    media.contenido_base,

    turno.turno_texto
  ) ??
  '[Imagen enviada por el prospecto]';


// ======================================================
// 8. INFORMACIÓN DEL FALLO VISUAL
// ======================================================

const motivoAnalisis =
  primerTexto(

    input.motivo_revision,

    input.error_analisis,

    input.detalle_error
  ) ??
  'ANALISIS_NO_DISPONIBLE';


const detalleError =
  primerTexto(

    input.detalle_error,

    input.error_analisis
  );


// ======================================================
// 9. MENSAJE DE TRANSICIÓN AL CLIENTE
// ======================================================
//
// Debe sonar natural.
// No decimos:
// "te paso con un asesor".
//
// ======================================================

const TEXTO_SUGIERE_COMPROBANTE =
  /\b(abono|comprobante|voucher|transfer[ií](encia|í|i)|ya\s+pag(u[eé]|o|amos)|adjunt[oa]\s+(el\s+)?(abono|comprobante|pago|transfer)|pagu[eé]|deposit[eéo]|dep[oó]sito|pago\s+(realizado|enviado|hecho))\b/i;

const esComprobantePorTexto =
  TEXTO_SUGIERE_COMPROBANTE.test(
    String(mensajeCliente ?? '')
  );

const mensajeTransicion =
  esComprobantePorTexto
    ? 'En este momento le verificamos su pago.'
    : 'Permítame un momento por favor, vamos a revisar la imagen que nos envió.';

const motivoHandoffImagen =
  esComprobantePorTexto
    ? 'ENVIA_COMPROBANTE'
    : 'IMAGEN_REQUIERE_REVISION';


// ======================================================
// 10. SALIDA
// ======================================================

return [
  {
    json: {

      ...input,


      // ==================================================
      // IDENTIDAD
      // ==================================================

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
        nombre,

      prospecto_nombre:
        nombre,


      // ==================================================
      // DECISIÓN COMERCIAL
      // ==================================================

      intencion:
        esComprobantePorTexto
          ? 'REPORTAR_PAGO'
          : 'OTRO',

      accion:
        'DERIVAR_HUMANO',

      requiere_humano:
        true,


      // ==================================================
      // HANDOFF
      // ==================================================

      handoff_motivo:
        motivoHandoffImagen,

      motivo_derivacion:
        motivoHandoffImagen,

      motivo:
        motivoHandoffImagen,

      handoff_clasificacion:
        esComprobantePorTexto
          ? 'CIERRE_COMERCIAL'
          : 'REVISION_IMAGEN',

      clasificacion_handoff:
        esComprobantePorTexto
          ? 'CIERRE_COMERCIAL'
          : 'REVISION_IMAGEN',

      handoff_prioridad:
        esComprobantePorTexto
          ? 'ALTA'
          : 'MEDIA',

      prioridad_derivacion:
        esComprobantePorTexto
          ? 'ALTA'
          : 'MEDIA',

      prioridad:
        esComprobantePorTexto
          ? 'ALTA'
          : 'MEDIA',


      // ==================================================
      // NOTIFICACIÓN INTERNA
      // ==================================================

      requiere_notificacion:
        true,

      handoff_requiere_notificacion:
        true,


      // ==================================================
      // MENSAJE ORIGINAL DEL PROSPECTO
      // ==================================================

      mensaje_actual:
        mensajeCliente,

      mensaje_cliente_original:
        mensajeCliente,

      ultimo_mensaje_cliente:
        mensajeCliente,


      // ==================================================
      // MENSAJE DE TRANSICIÓN
      // ==================================================

      respuesta_sugerida:
        mensajeTransicion,

      mensaje_transicion:
        mensajeTransicion,

      handoff_mensaje_cliente:
        mensajeCliente,


      // ==================================================
      // INFORMACIÓN DEL FALLO DE IMAGEN
      // ==================================================

      origen_derivacion:
        'ANALISIS_IMAGEN',

      analisis_imagen_fallido:
        true,

      analisis_imagen_motivo:
        motivoAnalisis,

      analisis_imagen_error:
        detalleError,

      contenido_imagen_detectado:
        input.contenido_detectado ??
        null,

      confianza_imagen:
        input.confianza ??
        null,


      // ==================================================
      // CONTROL
      // ==================================================

      derivacion_directa:
        true,

      derivacion_directa_motivo:
        'FALLO_TOTAL_ANALISIS_IMAGEN',

      handoff_at:
        new Date().toISOString()

    }
  }
];
