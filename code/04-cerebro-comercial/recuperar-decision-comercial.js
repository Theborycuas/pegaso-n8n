// ======================================================
// RECUPERAR DECISIÓN COMERCIAL - V2.2
// ======================================================
//
// IMPORTANTE:
// Después de "Resolver contexto comercial", esa salida es
// el contrato comercial definitivo.
//
// El UPDATE de prospectos puede devolver solamente la fila
// de PostgreSQL, por eso recuperamos aquí el resultado del
// resolver, NO el de "Normalizar decisión IA".
//
// Esto evita perder:
// - cantidad asumida = 1000;
// - datos consolidados;
// - acción corregida;
// - protección contra recotización;
// - respuestas informativas como INFORMAR_DISENO.
//
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
