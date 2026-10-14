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
// VERSION: 2.0
// ======================================================
//
// Objetivo:
//
// Interpretar comandos administrativos enviados por
// teléfonos autorizados:
//
// STOP  -> activa MODO_PRUEBA
// START -> desactiva MODO_PRUEBA
// ACTIVEBOT 0999999999 -> el bot vuelve a atender a ese
//   prospecto (requiere_humano = false), lo ejecuta
//   "Reactivar bot prospecto"
//
// Este nodo:
// - NO procesa conversaciones comerciales
// - NO busca prospectos
// - NO responde al cerebro comercial
// - NO modifica PostgreSQL
// - Entrega telefono_objetivo solo con dígitos y prefijo
//   593 (0999999999 -> 593999999999)
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

const textoComando =
  textoRecibido
    ? textoRecibido.toUpperCase().replace(/\s+/g, ' ')
    : null;

const coincidenciaActivebot =
  textoComando
    ? textoComando.match(/^ACTIVEBOT ([+\d][\d\s\-().]*)$/)
    : null;

const comando =
  coincidenciaActivebot
    ? 'ACTIVEBOT'
    : textoComando;


// Ecuador: 0999999999 / 999999999 / +593 99 999 9999 -> 593999999999
function telefonoEcuador(valor) {
  const digitos =
    limpiarTelefono(valor);

  if (!digitos) {
    return null;
  }

  if (digitos.startsWith('593')) {
    return digitos;
  }

  if (digitos.startsWith('0')) {
    return '593' + digitos.substring(1);
  }

  if (digitos.length === 9) {
    return '593' + digitos;
  }

  return digitos;
}


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
  comando !== 'START' &&
  comando !== 'ACTIVEBOT'
) {
  throw new Error(
    `PROCESAR COMANDO BOT: comando no soportado: ${comando ?? 'NULL'}.`
  );
}

const telefonoObjetivo =
  coincidenciaActivebot
    ? telefonoEcuador(coincidenciaActivebot[1])
    : null;

if (
  comando === 'ACTIVEBOT' &&
  !/^\d{11,15}$/.test(telefonoObjetivo ?? '')
) {
  throw new Error(
    `PROCESAR COMANDO BOT: teléfono inválido en ACTIVEBOT: ${coincidenciaActivebot?.[1] ?? 'NULL'}.`
  );
}


// ======================================================
// 7. RESOLVER NUEVO ESTADO
// ======================================================

const modoPruebaNuevo =
  comando === 'STOP';

const botHabilitado =
  comando === 'START';

const MOTIVOS = {
  STOP: 'COMANDO_ADMIN_STOP',
  START: 'COMANDO_ADMIN_START',
  ACTIVEBOT: 'COMANDO_ADMIN_ACTIVEBOT'
};


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

      telefono_objetivo:
        telefonoObjetivo,

      motivo_cambio:
        MOTIVOS[comando],

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
