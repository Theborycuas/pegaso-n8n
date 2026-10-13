// ======================================================
// N8N NODE - PEGASO
// ======================================================
// Nombre: Validar verificaci├│n Meta
// Node ID: 8d427a27-6eda-44e2-b437-1b84be55165c
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
// VALIDAR VERIFICACI├ôN DE WEBHOOK DE META / WHATSAPP
// ======================================================

const input = $input.first().json;

// Query parameters enviados por Meta
const query = input.query ?? {};

// Datos de verificaci├│n
const mode = query['hub.mode'] ?? null;
const verifyToken = query['hub.verify_token'] ?? null;
const challenge = query['hub.challenge'] ?? null;

// IMPORTANTE:
// Debe ser exactamente el mismo token colocado en Meta.
const EXPECTED_VERIFY_TOKEN = 'pegaso_whatsapp_verify_2026';

// Validaci├│n
const tokenValido =
  mode === 'subscribe' &&
  verifyToken === EXPECTED_VERIFY_TOKEN &&
  challenge !== null &&
  challenge !== undefined &&
  String(challenge).trim() !== '';

// ======================================================
// SALIDA
// ======================================================

return [
  {
    json: {
      ...input,

      meta_verificacion: {
        valido: tokenValido,

        mode,
        challenge:
          challenge !== null && challenge !== undefined
            ? String(challenge)
            : null,

        token_recibido: verifyToken !== null,

        motivo: tokenValido
          ? 'VERIFICACION_META_OK'
          : 'VERIFICACION_META_RECHAZADA'
      }
    }
  }
];
