// ======================================================
// N8N NODE - PEGASO
// ======================================================
// Nombre: Recuperar decisi├│n comercial
// Node ID: 5c895f4e-16ee-4834-8f4d-ce7c3228f92f
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
// RECUPERAR DECISI├ôN COMERCIAL - V2.2
// ======================================================
//
// IMPORTANTE:
// Despu├®s de "Resolver contexto comercial", esa salida es
// el contrato comercial definitivo.
//
// El UPDATE de prospectos puede devolver solamente la fila
// de PostgreSQL, por eso recuperamos aqu├¡ el resultado del
// resolver, NO el de "Normalizar decisi├│n IA".
//
// Esto evita perder:
// - cantidad asumida = 1000;
// - datos consolidados;
// - acci├│n corregida;
// - protecci├│n contra recotizaci├│n;
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
    'La decisi├│n comercial resuelta no existe.'
  );
}

if (
  !decision.accion ||
  String(decision.accion).trim() === ''
) {
  throw new Error(
    'La decisi├│n comercial no contiene accion.'
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
