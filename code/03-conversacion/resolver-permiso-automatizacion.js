// ======================================================
// NODO N8N: Resolver permiso automatización
// ARCHIVO: code/03-conversacion/resolver-permiso-automatizacion.js
// VERSION: 2.0
// RESPONSABILIDAD:
// - Buscar entre las filas de "Obtener configuración MODO_PRUEBA" la de clave MODO_PRUEBA (valor_json: activo, telefonos_permitidos)
// - Si MODO_PRUEBA está inactivo, permitir el BOT para cualquier teléfono
// - Si MODO_PRUEBA está activo, permitir el BOT solo a teléfonos autorizados (comparación por dígitos)
// - Ante configuración ausente o inválida, asumir MODO_PRUEBA activo sin teléfonos (comportamiento seguro: no automatizar)
// - Emitir puede_responder_bot y motivo_bloqueo_bot (MODO_PRUEBA_TELEFONO_NO_IDENTIFICADO / MODO_PRUEBA_TELEFONO_NO_AUTORIZADO)
// - Resolver la configuración del turno conversacional desde la fila DEBOUNCE_WHATSAPP (debounce_ms, turno_max_antiguedad_segundos), con valores por defecto si no existe
// - Conservar ids de conversación desde "Preparar conversación" para diagnóstico
// - NO decidir derivación a humano (lo evalúa el IF "¿Requiere atención humana?")
// ======================================================

const DEBOUNCE_WHATSAPP_MS_DEFECTO = 3000;
const DEBOUNCE_WHATSAPP_MS_MAXIMO = 15000;
const TURNO_MAX_ANTIGUEDAD_SEGUNDOS_DEFECTO = 600;


// ======================================================
// 1. RECUPERAR MENSAJE NORMALIZADO
// ======================================================

let mensaje = {};

try {
  mensaje =
    $('Normalizar mensaje').first().json ?? {};
} catch (error) {
  mensaje = {};
}


// ======================================================
// 2. RECUPERAR CONFIGURACIÓN
// ======================================================

function objetoJSON(valor) {
  if (valor && typeof valor === 'object' && !Array.isArray(valor)) {
    return valor;
  }

  if (typeof valor === 'string') {
    try {
      const parsed = JSON.parse(valor);

      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed;
      }
    } catch (error) {
      return null;
    }
  }

  return null;
}

const filasConfig =
  $input.all().map(item => item.json ?? {});

function configPorClave(clave) {
  const fila = filasConfig.find(f => f.clave === clave);

  return fila ? objetoJSON(fila.valor_json) : null;
}

const config =
  configPorClave('MODO_PRUEBA') ?? {
    activo: true,
    telefonos_permitidos: []
  };


// ======================================================
// 2.1. CONFIGURACIÓN DEL TURNO CONVERSACIONAL
// ======================================================

const configDebounce =
  configPorClave('DEBOUNCE_WHATSAPP') ?? {};

function enteroEnRango(valor, minimo, maximo, defecto) {
  const n = Number(valor);

  if (valor === null || valor === undefined || valor === '' || !Number.isFinite(n)) {
    return defecto;
  }

  return Math.min(maximo, Math.max(minimo, Math.round(n)));
}

const debounceMs = enteroEnRango(
  configDebounce.debounce_ms,
  0,
  DEBOUNCE_WHATSAPP_MS_MAXIMO,
  DEBOUNCE_WHATSAPP_MS_DEFECTO
);

const turnoMaxAntiguedadSegundos = enteroEnRango(
  configDebounce.turno_max_antiguedad_segundos,
  60,
  86400,
  TURNO_MAX_ANTIGUEDAD_SEGUNDOS_DEFECTO
);


// ======================================================
// 3. NORMALIZAR TELÉFONO
// ======================================================

const telefono = String(
  mensaje.telefono ??
  mensaje.wa_id ??
  mensaje.from ??
  ''
)
  .replace(/\D/g, '')
  .trim();


// ======================================================
// 4. RESOLVER MODO PRUEBA
// ======================================================

const modoPrueba =
  config.activo === true;


// ======================================================
// 5. NORMALIZAR TELÉFONOS AUTORIZADOS
// ======================================================

const telefonosPermitidos =
  Array.isArray(config.telefonos_permitidos)
    ? config.telefonos_permitidos
        .map(t =>
          String(t ?? '')
            .replace(/\D/g, '')
            .trim()
        )
        .filter(Boolean)
    : [];


// ======================================================
// 6. COMPROBAR AUTORIZACIÓN
// ======================================================

const telefonoPermitido =
  telefono !== '' &&
  telefonosPermitidos.includes(telefono);


// ======================================================
// 7. DECISIÓN
// ======================================================
//
// Si modo prueba está apagado:
//   BOT habilitado.
//
// Si modo prueba está encendido:
//   BOT solamente para teléfonos autorizados.
// ======================================================

const puedeResponderBot =
  modoPrueba === false ||
  telefonoPermitido === true;


// ======================================================
// 8. MOTIVO
// ======================================================

let motivoBloqueo = null;

if (!puedeResponderBot) {

  if (!telefono) {
    motivoBloqueo =
      'MODO_PRUEBA_TELEFONO_NO_IDENTIFICADO';
  } else {
    motivoBloqueo =
      'MODO_PRUEBA_TELEFONO_NO_AUTORIZADO';
  }

}


// ======================================================
// 9. RECUPERAR INFORMACIÓN DE CONVERSACIÓN
// ======================================================
//
// Nos interesa conservar IDs para diagnóstico.
// ======================================================

let conversacion = {};

try {
  conversacion =
    $('Preparar conversación').first().json ?? {};
} catch (error) {
  conversacion = {};
}


// ======================================================
// 10. SALIDA
// ======================================================

return [
  {
    json: {

      // ----------------------------------------------
      // Identidad del mensaje
      // ----------------------------------------------

      telefono,

      mensaje_actual:
        mensaje.mensaje_actual ??
        mensaje.contenido ??
        mensaje.texto ??
        null,

      tipo_mensaje:
        mensaje.tipo_mensaje ??
        mensaje.tipo ??
        null,


      // ----------------------------------------------
      // Conversación
      // ----------------------------------------------

      conversacion_id:
        conversacion.conversacion_id ??
        conversacion.id ??
        null,

      prospecto_id:
        conversacion.prospecto_id ??
        null,

      cliente_id:
        conversacion.cliente_id ??
        null,


      // ----------------------------------------------
      // Configuración BOT
      // ----------------------------------------------

      modo_prueba:
        modoPrueba,

      telefono_prueba_permitido:
        telefonoPermitido,

      puede_responder_bot:
        puedeResponderBot,

      motivo_bloqueo_bot:
        motivoBloqueo,


      // ----------------------------------------------
      // Turno conversacional (debounce)
      // ----------------------------------------------

      debounce_ms:
        debounceMs,

      debounce_segundos:
        debounceMs / 1000,

      turno_max_antiguedad_segundos:
        turnoMaxAntiguedadSegundos,

      debounce_configurado:
        Object.keys(configDebounce).length > 0,


      // ----------------------------------------------
      // Diagnóstico
      // ----------------------------------------------

      telefonos_permitidos_configurados:
        telefonosPermitidos.length,

      permiso_resuelto_at:
        new Date().toISOString()

    }
  }
];