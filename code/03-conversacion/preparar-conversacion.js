// ======================================================
// NODO N8N: Preparar conversación
// ARCHIVO: code/03-conversacion/preparar-conversacion.js
// VERSION: 1.0
// RESPONSABILIDAD:
// - Validar que existan conversacion_id numérico y telefono (lanza error si no)
// - Normalizar ids de cliente, contacto y prospecto, con respaldo en los conversacion_*_id
// - Determinar tipo_actor con prioridad CLIENTE > CONTACTO > PROSPECTO (DESCONOCIDO si no hay ninguno)
// - Parsear contexto_comercial (objeto o string JSON) desde contexto_comercial o conversacion_contexto_comercial; {} si falta o es inválido
// - Entregar una estructura uniforme para guardar el mensaje entrante, recuperar historial y preparar el contexto IA
// - NO escribir en PostgreSQL (lo hace el nodo siguiente "Guardar mensaje entrante")
// - NO decidir si el BOT responde
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