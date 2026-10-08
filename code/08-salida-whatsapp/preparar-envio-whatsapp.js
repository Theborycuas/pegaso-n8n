// ======================================================
// NODO N8N: Preparar envío WhatsApp
// ARCHIVO: code/08-salida-whatsapp/preparar-envio-whatsapp.js
// VERSION: 1.1
// RESPONSABILIDAD:
// - Recibir el mensaje saliente ya persistido en PostgreSQL (Guardar mensaje saliente / transición humano / comercial)
// - Resolver el texto de salida y el teléfono destino del cliente con respaldos en orden: input, "Recuperar decisión comercial",
//   "Preparar mensaje transición humano", "Preparar derivación humana", "Preparar entrada WhatsApp", "Preparar conversación",
//   "Unificar prospecto" y "Normalizar mensaje" (la fila de mensajes no trae teléfono); lanzar error solo si ninguno lo tiene
// - Confirmar que la ejecución nació de un webhook WhatsApp real de YCloud
// - Resolver el número oficial emisor de Pegaso (con fallback fijo)
// - Construir el body compatible con YCloud y el flag enviar_whatsapp con su motivo_no_envio
// - NO enviar el mensaje (lo hace el nodo HTTP "YCloud Enviar Wts" tras "If ¿Enviar por WhatsApp?")
// - NO enviar durante ejecuciones manuales / TEST
// ======================================================

const input = $input.first().json;

// ======================================================
// HELPERS
// ======================================================

function limpiarTelefono(valor) {
  if (valor === null || valor === undefined) {
    return null;
  }

  const limpio = String(valor)
    .replace(/[^\d]/g, '')
    .trim();

  return limpio || null;
}

function telefonoE164(valor) {
  const limpio = limpiarTelefono(valor);

  if (!limpio) {
    return null;
  }

  return `+${limpio}`;
}

// ======================================================
// 1. MENSAJE PERSISTIDO
// ======================================================

const mensajeDbId =
  input.id !== null && input.id !== undefined
    ? Number(input.id)
    : null;

const conversacionId =
  input.conversacion_id !== null &&
  input.conversacion_id !== undefined
    ? Number(input.conversacion_id)
    : null;

const textoSalida =
  typeof input.contenido === 'string'
    ? input.contenido.trim()
    : '';

if (!textoSalida) {
  throw new Error(
    'PREPARAR ENVÍO WHATSAPP: el mensaje saliente no contiene texto.'
  );
}

// ======================================================
// 2. RESOLVER TELÉFONO DESTINO
// ======================================================
//
// La fila de mensajes que entra no tiene teléfono. Cada rama
// (respuesta, cotización, handoff del cerebro, handoff por imagen
// fallida o por entrada no soportada) ejecuta nodos distintos:
// se toma el primero que exista, sin depender de una sola rama.
// ======================================================

const FUENTES_TELEFONO = [
  'Recuperar decisión comercial',
  'Preparar mensaje transición humano',
  'Preparar derivación humana',
  'Preparar entrada WhatsApp',
  'Preparar conversación',
  'Unificar prospecto',
  'Normalizar mensaje'
];

function telefonoDe(nodo) {
  try {
    return limpiarTelefono($(nodo).first().json?.telefono);
  } catch (error) {
    return null;
  }
}

let telefonoDestino =
  limpiarTelefono(input.telefono);

for (const nodo of FUENTES_TELEFONO) {
  if (telefonoDestino) {
    break;
  }

  telefonoDestino =
    telefonoDe(nodo);
}

if (!telefonoDestino) {
  throw new Error(
    'PREPARAR ENVÍO WHATSAPP: no se pudo resolver el teléfono destino.'
  );
}

// ======================================================
// 3. RECUPERAR ENTRADA WHATSAPP
// ======================================================

let entradaWhatsApp = null;

try {
  entradaWhatsApp =
    $('Preparar entrada WhatsApp').first().json ?? null;
} catch (error) {
  entradaWhatsApp = null;
}

// ======================================================
// 4. RECUPERAR EVENTO NORMALIZADO
// ======================================================

let eventoWhatsApp = null;

try {
  eventoWhatsApp =
    $('Normalizar evento WhatsApp')
      .first()
      .json
      ?.evento_whatsapp ?? null;
} catch (error) {
  eventoWhatsApp = null;
}

// ======================================================
// 5. DETERMINAR SI VIENE DE WHATSAPP REAL
// ======================================================
//
// Camino real:
// Webhook YCloud
//   → Normalizar evento WhatsApp
//   → Preparar entrada WhatsApp
//   → ...
//
// Camino test/manual:
// Execute workflow
//   → Mensaje TEST
//
// Solo enviamos físicamente cuando viene de webhook real.
// ======================================================

const vieneDeWhatsAppReal =
  (
    entradaWhatsApp?.entrada_whatsapp_preparada === true &&
    entradaWhatsApp?.canal === 'WHATSAPP'
  )
  ||
  (
    eventoWhatsApp?.procesable === true &&
    eventoWhatsApp?.canal === 'WHATSAPP' &&
    eventoWhatsApp?.origen === 'YCLOUD'
  );

// ======================================================
// 6. RESOLVER PROVEEDOR
// ======================================================

const proveedor =
  eventoWhatsApp?.origen ??
  entradaWhatsApp?.origen ??
  null;

const vieneDeYCloud =
  proveedor === 'YCLOUD';

// ======================================================
// 7. RESOLVER NÚMERO EMISOR PEGASO
// ======================================================
//
// YCloud inbound:
//   from = cliente
//   to   = Pegaso
//
// Nuestro normalizador guarda:
// display_phone_number = número Pegaso
//
// Ejemplo:
// 593962645735
// ======================================================

let telefonoEmisor =
  eventoWhatsApp?.display_phone_number ??
  entradaWhatsApp?.display_phone_number ??
  null;

telefonoEmisor =
  limpiarTelefono(telefonoEmisor);

// Fallback de seguridad.
// Este es el número oficial conectado actualmente a YCloud.
// Si luego agregamos más números, eliminamos este fallback
// y resolvemos siempre dinámicamente.
if (!telefonoEmisor) {
  telefonoEmisor = '593962645735';
}

// ======================================================
// 8. TIPO DE MENSAJE
// ======================================================

const tipo =
  String(
    input.tipo ?? 'TEXTO'
  ).toUpperCase();

const esTexto =
  tipo === 'TEXTO';

// ======================================================
// 9. DECIDIR SI SE ENVÍA
// ======================================================

const enviarWhatsApp =
  vieneDeWhatsAppReal &&
  vieneDeYCloud &&
  esTexto &&
  !!telefonoDestino &&
  !!telefonoEmisor &&
  !!textoSalida;

// ======================================================
// 10. MOTIVO DE NO ENVÍO
// ======================================================

let motivoNoEnvio = null;

if (!enviarWhatsApp) {

  if (!vieneDeWhatsAppReal) {
    motivoNoEnvio =
      'EJECUCION_NO_ORIGINADA_EN_WEBHOOK_WHATSAPP';
  }

  else if (!vieneDeYCloud) {
    motivoNoEnvio =
      'ORIGEN_NO_ES_YCLOUD';
  }

  else if (!esTexto) {
    motivoNoEnvio =
      'TIPO_MENSAJE_NO_SOPORTADO';
  }

  else if (!telefonoDestino) {
    motivoNoEnvio =
      'TELEFONO_DESTINO_FALTANTE';
  }

  else if (!telefonoEmisor) {
    motivoNoEnvio =
      'TELEFONO_EMISOR_FALTANTE';
  }

  else {
    motivoNoEnvio =
      'DATOS_ENVIO_INCOMPLETOS';
  }
}

// ======================================================
// 11. BODY YCLOUD
// ======================================================

const bodyYCloud = {
  from: telefonoE164(telefonoEmisor),
  to: telefonoE164(telefonoDestino),

  type: 'text',

  text: {
    body: textoSalida
  }
};

// ======================================================
// 12. SALIDA
// ======================================================

return [
  {
    json: {

      // ----------------------------------------------
      // IDENTIFICACIÓN
      // ----------------------------------------------

      mensaje_db_id:
        mensajeDbId,

      conversacion_id:
        conversacionId,

      // ----------------------------------------------
      // DESTINO / EMISOR
      // ----------------------------------------------

      telefono_destino:
        telefonoDestino,

      telefono_emisor:
        telefonoEmisor,

      telefono_destino_e164:
        telefonoE164(telefonoDestino),

      telefono_emisor_e164:
        telefonoE164(telefonoEmisor),

      // ----------------------------------------------
      // CONTENIDO
      // ----------------------------------------------

      texto_salida:
        textoSalida,

      tipo_salida:
        tipo,

      // ----------------------------------------------
      // CONTROL
      // ----------------------------------------------

      proveedor_whatsapp:
        proveedor,

      viene_de_ycloud:
        vieneDeYCloud,

      viene_de_whatsapp_real:
        vieneDeWhatsAppReal,

      enviar_whatsapp:
        enviarWhatsApp,

      motivo_no_envio:
        motivoNoEnvio,

      // ----------------------------------------------
      // REQUEST YCLOUD
      // ----------------------------------------------

      ycloud_request: {
        body: bodyYCloud
      },

      // ----------------------------------------------
      // DIAGNÓSTICO
      // ----------------------------------------------

      waba_id:
        eventoWhatsApp?.waba_id ?? null,

      mensaje_entrante_id:
        eventoWhatsApp?.mensaje_id ?? null,

      preparado_at:
        new Date().toISOString()
    }
  }
];