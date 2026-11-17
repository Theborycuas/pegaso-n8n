// ======================================================
// N8N NODE - PEGASO
// ======================================================
// Nombre: Preparar conversación
// Node ID: d5e02846-ddb3-4498-a909-fdf6258237fb
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
// PREPARAR CONVERSACIÓN
// ======================================================
// Entrada:
//   - conversación ya resuelta
//   - puede pertenecer a cliente, contacto o prospecto
//   - puede incluir contexto_comercial desde PostgreSQL
//
// Salida:
//   estructura uniforme para:
//   - guardar mensaje entrante
//   - recuperar historial
//   - preparar contexto IA
//   - conservar contexto comercial persistente
// ======================================================

const data = $input.first().json;


// ======================================================
// HELPERS
// ======================================================

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

  if (valor === 'true') {
    return true;
  }

  if (valor === 'false') {
    return false;
  }

  return defecto;
}


function objetoJSON(valor) {
  // Ya es objeto
  if (
    valor &&
    typeof valor === 'object' &&
    !Array.isArray(valor)
  ) {
    return valor;
  }

  // PostgreSQL/n8n podría entregarlo como string
  if (typeof valor === 'string') {
    const limpio = valor.trim();

    if (!limpio) {
      return {};
    }

    try {
      const parsed = JSON.parse(limpio);

      if (
        parsed &&
        typeof parsed === 'object' &&
        !Array.isArray(parsed)
      ) {
        return parsed;
      }
    } catch (error) {
      // No detenemos el flujo por un JSON vacío o mal formado.
      return {};
    }
  }

  return {};
}


// ======================================================
// VALIDACIONES BÁSICAS
// ======================================================

if (!data.conversacion_id) {
  throw new Error(
    'Preparar conversación: no existe conversacion_id.'
  );
}

if (!data.telefono) {
  throw new Error(
    'Preparar conversación: no existe telefono.'
  );
}


// ======================================================
// NORMALIZACIÓN DE IDS
// ======================================================

const conversacionId =
  numeroONull(data.conversacion_id);

if (conversacionId === null) {
  throw new Error(
    'Preparar conversación: conversacion_id no es válido.'
  );
}


const clienteId =
  numeroONull(data.cliente_id) ??
  numeroONull(data.conversacion_cliente_id);


const contactoId =
  numeroONull(data.contacto_id) ??
  numeroONull(data.conversacion_contacto_id);


const prospectoId =
  numeroONull(data.prospecto_id) ??
  numeroONull(data.conversacion_prospecto_id);


// ======================================================
// DETERMINAR ACTOR
// ======================================================

let tipoActor = 'DESCONOCIDO';

if (clienteId !== null) {
  tipoActor = 'CLIENTE';
}
else if (contactoId !== null) {
  tipoActor = 'CONTACTO';
}
else if (prospectoId !== null) {
  tipoActor = 'PROSPECTO';
}


// ======================================================
// RECUPERAR CONTEXTO COMERCIAL
// ======================================================
//
// Soportamos varios nombres por seguridad porque el dato
// puede venir:
// - directamente desde Buscar conversación
// - renombrado por un resolver previo
//
// Orden de prioridad:
// 1. contexto_comercial
// 2. conversacion_contexto_comercial
//
// ======================================================

const contextoComercial =
  objetoJSON(
    data.contexto_comercial ??
    data.conversacion_contexto_comercial ??
    {}
  );


// ======================================================
// ANUNCIO DE META DEL MENSAJE ACTUAL
// ======================================================
//
// Si el mensaje llegó desde un anuncio de clic a WhatsApp,
// "Guardar mensaje entrante" lo registra en el prospecto
// (ultimo_anuncio_*; origen = ANUNCIO_META cuando es su
// primer mensaje). Lo usa la insistencia a leads.
//
// Solo se toma si el evento corresponde a este mismo
// mensaje. En la ruta de prueba no existe el webhook y
// el anuncio queda en null.
//
// ======================================================

let anuncioMeta = null;

// Id del botón tocado (SEG_SI / SEG_NO de la insistencia).
let respuestaBotonId = null;

try {
  const eventoWhatsApp =
    $('Normalizar evento WhatsApp').first().json?.evento_whatsapp ?? null;

  if (
    eventoWhatsApp?.mensaje_id &&
    eventoWhatsApp.mensaje_id === data.mensaje_externo_id &&
    eventoWhatsApp.respuesta_interactiva?.id
  ) {
    respuestaBotonId =
      String(eventoWhatsApp.respuesta_interactiva.id).slice(0, 100);
  }

  if (
    eventoWhatsApp?.es_lead_anuncio === true &&
    eventoWhatsApp.mensaje_id &&
    eventoWhatsApp.mensaje_id === data.mensaje_externo_id
  ) {
    const anuncio =
      eventoWhatsApp.anuncio ?? {};

    anuncioMeta = {
      fuente:
        String(anuncio.source_type ?? 'ad').slice(0, 30),

      ctwa_clid:
        anuncio.ctwa_clid
          ? String(anuncio.ctwa_clid).slice(0, 500)
          : null
    };
  }
} catch (error) {
  anuncioMeta = null;
  respuestaBotonId = null;
}


// ======================================================
// NORMALIZAR ESTADO DE CONVERSACIÓN
// ======================================================

const conversacionEstado =
  data.conversacion_estado ??
  data.estado ??
  'ACTIVA';


// ======================================================
// SALIDA
// ======================================================

return [
  {
    json: {
      ...data,

      // ============================================
      // CONVERSACIÓN
      // ============================================

      conversacion_id:
        conversacionId,

      conversacion_existe:
        true,

      conversacion_nueva:
        booleano(
          data.conversacion_nueva,
          false
        ),

      conversacion_estado:
        conversacionEstado,

      conversacion_cliente_id:
        clienteId,

      conversacion_contacto_id:
        contactoId,

      conversacion_prospecto_id:
        prospectoId,

      // ============================================
      // CONTEXTO COMERCIAL PERSISTENTE
      // ============================================

      contexto_comercial:
        contextoComercial,

      // ============================================
      // ACTORES
      // ============================================

      cliente_id:
        clienteId,

      contacto_id:
        contactoId,

      prospecto_id:
        prospectoId,

      tipo_actor:
        tipoActor,

      // ============================================
      // MENSAJE
      // ============================================

      mensaje:
        data.mensaje ?? '',

      tipo:
        data.tipo ?? 'TEXTO',

      canal:
        data.canal ?? 'WHATSAPP',

      mensaje_externo_id:
        data.mensaje_externo_id ?? null,

      recibido_at:
        data.recibido_at ??
        new Date().toISOString(),

      // Anuncio de Meta de este mensaje: {fuente, ctwa_clid} o null
      anuncio_meta:
        anuncioMeta,

      // Botón tocado en este mensaje (o null)
      respuesta_boton_id:
        respuestaBotonId,

      // ============================================
      // FLAGS
      // ============================================

      es_cliente_registrado:
        booleano(
          data.es_cliente_registrado,
          false
        ),

      prospecto_existe:
        booleano(
          data.prospecto_existe,
          false
        )
    }
  }
];
