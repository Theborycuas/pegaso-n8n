// ======================================================
// N8N NODE - PEGASO
// ======================================================
// Nombre: Preparar derivaci├│n imagen fallida
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
// NODO N8N: PREPARAR DERIVACI├ôN IMAGEN FALLIDA
// PEGASO ADHESIVOS
// VERSION: 2.0
// ======================================================
//
// Se ejecuta ├║nicamente cuando:
//
// Groq       -> an├ílisis inv├ílido
// DeepSeek   -> an├ílisis inv├ílido
// OpenAI     -> an├ílisis inv├ílido
//
// Objetivo:
//
// Transformar el fallo total del an├ílisis visual en un
// contrato compatible con la ruta est├índar de handoff.
//
// IMPORTANTE:
//
// - NO vuelve a analizar la imagen.
// - NO pasa otra vez por el cerebro comercial.
// - NO inventa qu├® contiene la imagen.
// - NO confirma pagos.
// - NO crea pedidos.
// - S├ì recupera correctamente prospecto/conversaci├│n.
// - S├ì conserva el mensaje/caption real del cliente.
// - S├ì deriva a humano con notificaci├│n.
//
// Ruta esperada:
//
// IF: ┬┐An├ílisis OpenAI v├ílido?
// FALSE
//   Ôåô
// Preparar derivaci├│n imagen fallida
//   Ôåô
// Preparar derivaci├│n humana
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
    'Resolver conversaci├│n prospecto'
  );

const unificarConversacion =
  obtenerNodo(
    'Unificar conversaci├│n'
  );

const prepararConversacion =
  obtenerNodo(
    'Preparar conversaci├│n'
  );


// ======================================================
// 3. RESOLVER CONVERSACI├ôN
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
    'DERIVACI├ôN IMAGEN FALLIDA: no fue posible resolver conversacion_id.'
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
    'DERIVACI├ôN IMAGEN FALLIDA: no fue posible resolver prospecto_id.'
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
// 6. TEL├ëFONO Y NOMBRE
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
// mensaje principal porque contiene metadata t├®cnica.
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
// 8. INFORMACI├ôN DEL FALLO VISUAL
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
// 9. MENSAJE DE TRANSICI├ôN AL CLIENTE
// ======================================================
//
// Debe sonar natural.
// No decimos:
// "te paso con un asesor".
//
// ======================================================

const mensajeTransicion =
  'Perm├¡tame un momento por favor, vamos a revisar la imagen que nos envi├│.';


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
      // DECISI├ôN COMERCIAL
      // ==================================================

      intencion:
        'OTRO',

      accion:
        'DERIVAR_HUMANO',

      requiere_humano:
        true,


      // ==================================================
      // HANDOFF
      // ==================================================

      handoff_motivo:
        'IMAGEN_REQUIERE_REVISION',

      motivo_derivacion:
        'IMAGEN_REQUIERE_REVISION',

      motivo:
        'IMAGEN_REQUIERE_REVISION',

      handoff_clasificacion:
        'REVISION_IMAGEN',

      clasificacion_handoff:
        'REVISION_IMAGEN',

      handoff_prioridad:
        'MEDIA',

      prioridad_derivacion:
        'MEDIA',

      prioridad:
        'MEDIA',


      // ==================================================
      // NOTIFICACI├ôN INTERNA
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
      // MENSAJE DE TRANSICI├ôN
      // ==================================================

      respuesta_sugerida:
        mensajeTransicion,

      mensaje_transicion:
        mensajeTransicion,

      handoff_mensaje_cliente:
        mensajeCliente,


      // ==================================================
      // INFORMACI├ôN DEL FALLO DE IMAGEN
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
