// ======================================================
// N8N NODE - PEGASO
// ======================================================
// Nombre: Procesar comando BOT
// Node ID: 71aaa80a-fccc-4aad-9506-70ea92468bea
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
// NODO N8N: PROCESAR COMANDO BOT
// PEGASO ADHESIVOS
// VERSION: 1.0
// ======================================================
//
// Objetivo:
//
// Interpretar comandos administrativos enviados por
// teléfonos autorizados:
//
// STOP  -> activa MODO_PRUEBA
// START -> desactiva MODO_PRUEBA
//
// Este nodo:
// - NO procesa conversaciones comerciales
// - NO busca prospectos
// - NO responde al cerebro comercial
// - NO modifica todavía PostgreSQL
//
// ======================================================

const input = $input.first().json ?? {};


// ======================================================
// 1. HELPERS
// ======================================================

function textoONull(valor) {
  if (
    valor === undefined ||
    valor === null
  ) {
    return null;
  }

  const limpio =
    String(valor).trim();

  return limpio !== ''
    ? limpio
    : null;
}

function limpiarTelefono(valor) {
  if (
    valor === undefined ||
    valor === null
  ) {
    return null;
  }

  const limpio =
    String(valor)
      .replace(/\D/g, '')
      .trim();

  return limpio || null;
}


// ======================================================
// 2. RECUPERAR EVENTO
// ======================================================

const evento =
  input.evento_whatsapp ??
  input;


// ======================================================
// 3. ADMINISTRADORES AUTORIZADOS
// ======================================================

const ADMINISTRADORES = [
  '593996588558',
  '593999217750'
];


// ======================================================
// 4. RESOLVER DATOS
// ======================================================

const telefonoAdmin =
  limpiarTelefono(
    evento.telefono_cliente ??
    evento.from
  );

const textoRecibido =
  textoONull(
    evento.texto ??
    evento.text?.body
  );

const comando =
  textoRecibido
    ? textoRecibido.toUpperCase()
    : null;


// ======================================================
// 5. VALIDAR ADMINISTRADOR
// ======================================================

if (
  !telefonoAdmin ||
  !ADMINISTRADORES.includes(telefonoAdmin)
) {
  throw new Error(
    'PROCESAR COMANDO BOT: teléfono no autorizado.'
  );
}


// ======================================================
// 6. VALIDAR COMANDO
// ======================================================

if (
  comando !== 'STOP' &&
  comando !== 'START'
) {
  throw new Error(
    `PROCESAR COMANDO BOT: comando no soportado: ${comando ?? 'NULL'}.`
  );
}


// ======================================================
// 7. RESOLVER NUEVO ESTADO
// ======================================================

const modoPruebaNuevo =
  comando === 'STOP';

const botHabilitado =
  comando === 'START';


// ======================================================
// 8. SALIDA
// ======================================================

return [
  {
    json: {
      comando_bot:
        comando,

      telefono_admin:
        telefonoAdmin,

      modo_prueba_nuevo:
        modoPruebaNuevo,

      bot_habilitado:
        botHabilitado,

      motivo_cambio:
        comando === 'STOP'
          ? 'COMANDO_ADMIN_STOP'
          : 'COMANDO_ADMIN_START',

      mensaje_externo_id:
        evento.mensaje_id ??
        evento.wamid ??
        null,

      proveedor_evento_id:
        evento.proveedor_evento_id ??
        null,

      comando_valido:
        true,

      procesado_at:
        new Date().toISOString()
    }
  }
];
