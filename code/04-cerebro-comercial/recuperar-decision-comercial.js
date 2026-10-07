// ======================================================
// NODO N8N: Recuperar decisión comercial
// ARCHIVO: code/04-cerebro-comercial/recuperar-decision-comercial.js
// VERSION: 2.2
// RESPONSABILIDAD:
// - Recuperar el contrato comercial desde "Resolver contexto comercial", porque el UPDATE de prospectos solo devuelve la fila de PostgreSQL.
// - Preservar cantidad asumida, datos consolidados, acción corregida y respuestas informativas para el Switch "Enrutar acción comercial".
// - Validar que la decisión exista y contenga accion; lanzar error si no.
// - Marcar prospecto_actualizado=true.
// - NO usar la salida de "Normalizar decisión IA".
// - NO modificar la acción ni escribir en PostgreSQL.
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
