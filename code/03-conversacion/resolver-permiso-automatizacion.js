// ======================================================
// RESOLVER PERMISO DE AUTOMATIZACIÓN
// ======================================================
//
// Determina si el BOT puede procesar/responder este
// mensaje.
//
// MODO_PRUEBA = false
//   → cualquier teléfono puede usar el BOT.
//
// MODO_PRUEBA = true
//   → solamente teléfonos autorizados.
//
// IMPORTANTE:
// Si existe un problema con la configuración,
// se adopta comportamiento seguro:
// NO permitir automatización.
// ======================================================


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

const configRow =
  $input.first()?.json ?? {};

const config =
  configRow.valor_json &&
  typeof configRow.valor_json === 'object'
    ? configRow.valor_json
    : {
        activo: true,
        telefonos_permitidos: []
      };


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
      // Diagnóstico
      // ----------------------------------------------

      telefonos_permitidos_configurados:
        telefonosPermitidos.length,

      permiso_resuelto_at:
        new Date().toISOString()

    }
  }
];