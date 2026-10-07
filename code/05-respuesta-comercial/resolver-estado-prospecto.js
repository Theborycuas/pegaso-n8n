// ======================================================
// RESOLVER ESTADO PROSPECTO
// ======================================================
// Objetivo:
// Resolver exclusivamente el estado COMERCIAL del prospecto.
//
// IMPORTANTE:
// El input inmediato viene de "Actualizar actividad conversación"
// y su campo `estado` corresponde a la CONVERSACIÓN ("ACTIVA").
//
// Por eso NO utilizamos $json.estado como estado del prospecto.
// Recuperamos el estado comercial desde los nodos anteriores.
// ======================================================

const data = $input.first().json;

// ======================================================
// 1. RECUPERAR DECISIÓN COMERCIAL PREVIA
// ======================================================

let decision = {};

try {
  decision =
    $('Recuperar decisión comercial').first().json ?? {};
} catch (e) {
  decision = {};
}

// ======================================================
// 2. RECUPERAR PROSPECTO ACTUALIZADO
// ======================================================
//
// Este nodo contiene el registro real de pegaso.prospectos
// después de "Actualizar prospecto comercial".
//

let prospectoActualizado = {};

try {
  prospectoActualizado =
    $('Actualizar prospecto comercial').first().json ?? {};
} catch (e) {
  prospectoActualizado = {};
}

// ======================================================
// 3. HELPERS
// ======================================================

function numeroONull(valor) {
  if (
    valor === null ||
    valor === undefined ||
    valor === ''
  ) {
    return null;
  }

  const n = Number(valor);

  return Number.isFinite(n)
    ? n
    : null;
}

function textoONull(valor) {
  if (
    valor === null ||
    valor === undefined
  ) {
    return null;
  }

  const t = String(valor).trim();

  return t !== ''
    ? t
    : null;
}

// ======================================================
// 4. RESOLVER ID DEL PROSPECTO
// ======================================================

const prospectoId =
  numeroONull(data.prospecto_id) ??
  numeroONull(decision.prospecto_id) ??
  numeroONull(prospectoActualizado.id);

if (prospectoId === null) {
  throw new Error(
    'No se puede resolver estado del prospecto: prospecto_id no disponible.'
  );
}

// ======================================================
// 5. RESOLVER ESTADO COMERCIAL REAL
// ======================================================
//
// PRIORIDAD:
//
// 1. Registro devuelto por UPDATE de prospectos
// 2. Decisión recuperada
//
// JAMÁS usar data.estado, porque pertenece a conversaciones.
//

const estadoActualRaw =
  textoONull(prospectoActualizado.estado) ??
  textoONull(decision.prospecto_estado) ??
  'NUEVO';

const estadoActual =
  estadoActualRaw.toUpperCase();

// ======================================================
// 6. CATÁLOGO DE ESTADOS
// ======================================================
//
// Por ahora:
//
// NUEVO
// EN_CONVERSACION
// COTIZADO
// PEDIDO_CONFIRMADO
// REQUIERE_HUMANO
//
// Más adelante podremos ampliar el ciclo comercial.
// ======================================================

const ESTADOS_VALIDOS = [
  'NUEVO',
  'EN_CONVERSACION',
  'COTIZADO',
  'PEDIDO_CONFIRMADO',
  'REQUIERE_HUMANO'
];

if (!ESTADOS_VALIDOS.includes(estadoActual)) {
  throw new Error(
    `Estado comercial de prospecto inválido: ${estadoActual}`
  );
}

// ======================================================
// 7. RESOLVER TRANSICIÓN
// ======================================================
//
// Este nodo SOLO realiza:
//
// NUEVO → EN_CONVERSACION
//
// No debe:
// - marcar COTIZADO
// - confirmar pedido
// - derivar humano
//
// Eso corresponde a otros eventos comerciales.
//

let estadoNuevo = estadoActual;

if (estadoActual === 'NUEVO') {
  estadoNuevo = 'EN_CONVERSACION';
}

// ======================================================
// 8. DETERMINAR SI NECESITA UPDATE
// ======================================================

const actualizarEstadoProspecto =
  estadoNuevo !== estadoActual;

// ======================================================
// 9. SALIDA
// ======================================================

return [
  {
    json: {
      ...data,

      // Mantener contexto comercial
      prospecto_id:
        prospectoId,

      prospecto_estado:
        estadoActual,

      // Datos específicos para el siguiente UPDATE
      prospecto_id_estado_update:
        prospectoId,

      prospecto_estado_anterior:
        estadoActual,

      prospecto_estado_nuevo:
        estadoNuevo,

      actualizar_estado_prospecto:
        actualizarEstadoProspecto,

      estado_resuelto_at:
        new Date().toISOString()
    }
  }
];