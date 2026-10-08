// ======================================================
// NODO N8N: Recuperar decisión comercial
// ARCHIVO: code/04-cerebro-comercial/recuperar-decision-comercial.js
// VERSION: 2.3
// RESPONSABILIDAD:
// - Recuperar el contrato comercial desde "Resolver contexto comercial", porque el UPDATE de prospectos solo devuelve la fila de PostgreSQL.
// - Aplicar encima la restricción de "Aplicar reglas comerciales determinísticas" cuando bloqueó la solicitud (solicitud_producible = false):
//   así MEDIDA_NO_PRODUCIBLE llega al Switch "Enrutar acción comercial" y nunca entra al cotizador.
// - Preservar cantidad asumida, datos consolidados, acción corregida, derivación (motivo, prioridad, notificación) y respuestas informativas.
// - Validar que la decisión exista y contenga accion; lanzar error si no.
// - Marcar prospecto_actualizado=true.
// - NO usar la salida de "Normalizar decisión IA".
// - NO recalcular la acción ni escribir en PostgreSQL.
// ======================================================

let decision = {};

try {
  decision =
    $('Resolver contexto comercial').first().json ?? {};
} catch (e) {
  throw new Error(
    'No se pudo recuperar la salida de "Resolver contexto comercial".'
  );
}


// ======================================================
// RESTRICCIONES DETERMINÍSTICAS
// ======================================================
//
// "Aplicar reglas comerciales determinísticas" conserva todo el
// contrato de "Resolver contexto comercial" (...data) y solo
// cambia la decisión cuando hay una restricción.
// ======================================================

let reglas = {};

try {
  reglas =
    $('Aplicar reglas comerciales determinísticas').first().json ?? {};
} catch (e) {
  reglas = {};
}

if (
  reglas.solicitud_producible === false &&
  reglas.accion
) {
  decision = {
    ...decision,
    ...reglas
  };
}


// ======================================================
// VALIDACIONES
// ======================================================

if (
  !decision ||
  typeof decision !== 'object' ||
  Array.isArray(decision)
) {
  throw new Error(
    'La decisión comercial resuelta no existe.'
  );
}

if (
  !decision.accion ||
  String(decision.accion).trim() === ''
) {
  throw new Error(
    'La decisión comercial no contiene accion.'
  );
}


// ======================================================
// SALIDA
// ======================================================

return [
  {
    json: {
      ...decision,

      prospecto_actualizado:
        true
    }
  }
];
