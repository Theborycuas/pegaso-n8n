// ======================================================
// N8N NODE - PEGASO
// ======================================================
// Nombre: Preparar env├¡o WhatsApp
// Node ID: aabdc11d-b55e-467d-b32d-50c9d5bf8c4e
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
// PREPARAR ENV├ìO WHATSAPP - YCLOUD
// PEGASO ADHESIVOS
// VERSION: 2.0
// ======================================================
//
// Puede recibir datos desde distintas rutas:
//
// - Guardar mensaje saliente
// - Guardar mensaje comercial
// - Guardar mensaje transici├│n humano
//
// IMPORTANTE:
//
// Los nodos PostgreSQL pueden devolver ├║nicamente la fila
// insertada y perder datos del contrato anterior, por ejemplo:
//
// - telefono
// - nombre_whatsapp
// - proveedor
// - mensaje de negocio
//
// Por eso este nodo recupera identidad y contexto desde
// nodos anteriores como fallback.
//
// Responsabilidades:
//
// 1. Resolver mensaje persistido.
// 2. Resolver tel├®fono destino.
// 3. Confirmar que la ejecuci├│n naci├│ de WhatsApp real.
// 4. Resolver proveedor YCloud.
// 5. Resolver n├║mero emisor Pegaso.
// 6. Construir request compatible con YCloud.
// 7. Evitar env├¡os f├¡sicos durante TEST/manual.
//
// ======================================================

const input =
  $input.first().json ?? {};


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


function numeroONull(valor) {

  if (
    valor === undefined ||
    valor === null ||
    valor === ''
  ) {
    return null;
  }

  const numero =
    Number(valor);

  return Number.isFinite(numero)
    ? numero
    : null;
}


function limpiarTelefono(valor) {

  const texto =
    textoONull(valor);

  if (!texto) {
    return null;
  }

  const limpio =
    texto
      .replace(/[^\d]/g, '')
      .trim();

  return limpio || null;
}


function telefonoE164(valor) {

  const limpio =
    limpiarTelefono(valor);

  if (!limpio) {
    return null;
  }

  return `+${limpio}`;
}


// ------------------------------------------------------
// Recupera de forma segura otro nodo del workflow.
//
// Si el nodo no particip├│ en esta ejecuci├│n:
// devuelve {}.
//
// Esto es importante porque este nodo sirve a varias rutas.
// ------------------------------------------------------

function obtenerNodo(nombre) {

  try {

    return (
      $(nombre)
        .first()
        .json ?? {}
    );

  } catch (_) {

    return {};

  }
}


// ======================================================
// 2. RECUPERAR CONTRATOS DE RUTAS ANTERIORES
// ======================================================

const decision =
  obtenerNodo(
    'Recuperar decisi├│n comercial'
  );


const prepararRespuestaComercial =
  obtenerNodo(
    'Preparar respuesta comercial'
  );


const prepararMensajeCotizacion =
  obtenerNodo(
    'Preparar mensaje cotizaci├│n'
  );


const prepararMensajeHumano =
  obtenerNodo(
    'Preparar mensaje transici├│n humano'
  );


const prepararDerivacionHumana =
  obtenerNodo(
    'Preparar derivaci├│n humana'
  );


const guardarContextoHandoff =
  obtenerNodo(
    'Guardar contexto handoff'
  );


const prepararContextoHandoff =
  obtenerNodo(
    'Preparar contexto handoff'
  );


const entradaWhatsApp =
  obtenerNodo(
    'Preparar entrada WhatsApp'
  );


// ======================================================
// 3. RECUPERAR EVENTO NORMALIZADO
// ======================================================

const normalizado =
  obtenerNodo(
    'Normalizar evento WhatsApp'
  );


const eventoWhatsApp =
  (
    normalizado.evento_whatsapp &&
    typeof normalizado.evento_whatsapp === 'object'
  )
    ? normalizado.evento_whatsapp
    : {};


// ======================================================
// 4. MENSAJE DB / IDENTIDAD
// ======================================================

const mensajeDbId =
  numeroONull(
    input.id ??
    input.mensaje_db_id
  );


const conversacionId =
  numeroONull(
    input.conversacion_id ??
    prepararMensajeHumano.conversacion_id ??
    prepararDerivacionHumana.conversacion_id ??
    guardarContextoHandoff.conversacion_id ??
    decision.conversacion_id ??
    entradaWhatsApp.conversacion_id
  );


// ======================================================
// 5. RESOLVER TEXTO DE SALIDA
// ======================================================
//
// Primera opci├│n:
// contenido ya persistido en mensajes.
//
// Los dem├ís son ├║nicamente fallbacks de seguridad.
//
// ======================================================

const textoSalida =
  textoONull(
    input.contenido
  ) ??

  textoONull(
    input.texto_salida
  ) ??

  // Handoff humano
  textoONull(
    prepararMensajeHumano.mensaje_salida
  ) ??

  textoONull(
    prepararMensajeHumano.mensaje_transicion
  ) ??

  textoONull(
    prepararMensajeHumano.handoff_mensaje_transicion
  ) ??

  // Respuesta comercial
  textoONull(
    prepararRespuestaComercial.mensaje_salida
  ) ??

  textoONull(
    prepararRespuestaComercial.mensaje_comercial
  ) ??

  // Cotizaci├│n
  textoONull(
    prepararMensajeCotizacion.mensaje_salida
  ) ??

  textoONull(
    prepararMensajeCotizacion.mensaje_comercial
  ) ??

  null;


if (!textoSalida) {

  throw new Error(
    'PREPARAR ENV├ìO WHATSAPP: el mensaje saliente no contiene texto.'
  );

}


// ======================================================
// 6. RESOLVER TEL├ëFONO DESTINO
// ======================================================
//
// El mensaje guardado puede NO conservar tel├®fono.
//
// Prioridad:
//
// 1. input actual
// 2. decisi├│n comercial
// 3. mensaje humano
// 4. derivaci├│n humana
// 5. contexto handoff
// 6. entrada WhatsApp
// 7. evento normalizado
//
// ======================================================

let telefonoDestino =
  limpiarTelefono(
    input.telefono_destino
  ) ??

  limpiarTelefono(
    input.telefono
  ) ??

  limpiarTelefono(
    decision.telefono
  ) ??

  limpiarTelefono(
    prepararMensajeHumano.telefono
  ) ??

  limpiarTelefono(
    prepararDerivacionHumana.telefono
  ) ??

  limpiarTelefono(
    guardarContextoHandoff.telefono
  ) ??

  limpiarTelefono(
    prepararContextoHandoff.telefono
  ) ??

  limpiarTelefono(
    entradaWhatsApp.telefono
  ) ??

  limpiarTelefono(
    eventoWhatsApp.telefono_cliente
  ) ??

  limpiarTelefono(
    eventoWhatsApp.from
  ) ??

  limpiarTelefono(
    eventoWhatsApp.wa_id
  );


if (!telefonoDestino) {

  throw new Error(
    'PREPARAR ENV├ìO WHATSAPP: no se pudo resolver el tel├®fono destino.'
  );

}


// ======================================================
// 7. DETERMINAR SI VIENE DE WHATSAPP REAL
// ======================================================
//
// Camino real:
//
// Webhook YCloud
//   ÔåÆ Normalizar evento WhatsApp
//   ÔåÆ Preparar entrada WhatsApp
//   ÔåÆ ...
//
// Camino TEST:
//
// Execute workflow
//   ÔåÆ Mensaje TEST
//
// Solo enviamos f├¡sicamente cuando la ejecuci├│n pertenece
// a un mensaje WhatsApp real.
//
// ======================================================

const canalEntrada =
  String(
    entradaWhatsApp.canal ??
    eventoWhatsApp.canal ??
    ''
  )
    .trim()
    .toUpperCase();


const entradaPreparada =
  entradaWhatsApp
    .entrada_whatsapp_preparada === true;


const eventoProcesable =
  eventoWhatsApp.procesable === true;


const vieneDeWhatsAppReal =
  (
    entradaPreparada &&
    canalEntrada === 'WHATSAPP'
  )
  ||
  (
    eventoProcesable &&
    String(
      eventoWhatsApp.canal ?? ''
    )
      .trim()
      .toUpperCase() === 'WHATSAPP'
  );


// ======================================================
// 8. RESOLVER PROVEEDOR
// ======================================================
//
// El proveedor puede venir expl├¡citamente del evento.
//
// Tambi├®n aceptamos el hecho de que el evento normalizado
// venga del webhook YCloud.
//
// ======================================================

let proveedor =
  textoONull(
    eventoWhatsApp.origen
  ) ??

  textoONull(
    eventoWhatsApp.proveedor
  ) ??

  textoONull(
    entradaWhatsApp.origen
  ) ??

  textoONull(
    entradaWhatsApp.proveedor_whatsapp
  ) ??

  null;


if (proveedor) {
  proveedor =
    proveedor.toUpperCase();
}


// Si existe un evento real YCloud pero el normalizador
// todav├¡a no expone origen expl├¡citamente, podemos
// reconocerlo por la estructura del evento.
//
// NO se aplica en ejecuciones manuales.
if (
  !proveedor &&
  vieneDeWhatsAppReal &&
  (
    eventoWhatsApp.waba_id ||
    eventoWhatsApp.mensaje_id ||
    entradaWhatsApp.meta_whatsapp
  )
) {

  proveedor =
    'YCLOUD';

}


const vieneDeYCloud =
  proveedor === 'YCLOUD';


// ======================================================
// 9. RESOLVER N├ÜMERO EMISOR PEGASO
// ======================================================
//
// YCloud inbound:
//
// from = cliente
// to   = Pegaso
//
// En la normalizaci├│n normalmente:
//
// display_phone_number = n├║mero Pegaso.
//
// ======================================================

const metaWhatsApp =
  (
    entradaWhatsApp.meta_whatsapp &&
    typeof entradaWhatsApp.meta_whatsapp === 'object'
  )
    ? entradaWhatsApp.meta_whatsapp
    : {};


let telefonoEmisor =
  limpiarTelefono(
    eventoWhatsApp.display_phone_number
  ) ??

  limpiarTelefono(
    eventoWhatsApp.telefono_emisor
  ) ??

  limpiarTelefono(
    entradaWhatsApp.display_phone_number
  ) ??

  limpiarTelefono(
    metaWhatsApp.display_phone_number
  ) ??

  null;


// ------------------------------------------------------
// Fallback operativo.
//
// N├║mero oficial actualmente conectado a YCloud.
//
// Si Pegaso trabaja despu├®s con m├║ltiples n├║meros,
// este fallback debe desaparecer y resolverse por WABA.
// ------------------------------------------------------

if (!telefonoEmisor) {

  telefonoEmisor =
    '593962645735';

}


// ======================================================
// 10. RESOLVER TIPO DE MENSAJE
// ======================================================
//
// `HANDOFF_HUMANO` describe el prop├│sito comercial,
// pero f├¡sicamente sigue siendo un mensaje de texto.
//
// ======================================================

const tipoOriginal =
  String(
    input.tipo ??
    input.tipo_salida ??
    input.tipo_mensaje_salida ??
    prepararMensajeHumano.tipo_mensaje_salida ??
    'TEXTO'
  )
    .trim()
    .toUpperCase();


const tiposTransportablesComoTexto = [
  'TEXTO',
  'TEXT',
  'HANDOFF_HUMANO',
  'RESPUESTA_COMERCIAL',
  'COTIZACION'
];


const esTexto =
  tiposTransportablesComoTexto
    .includes(tipoOriginal);


// Para YCloud siempre ser├í f├¡sicamente "text".
const tipoYCloud =
  'text';


// ======================================================
// 11. DECIDIR SI SE ENV├ìA
// ======================================================

const enviarWhatsApp =
  vieneDeWhatsAppReal &&
  vieneDeYCloud &&
  esTexto &&
  Boolean(telefonoDestino) &&
  Boolean(telefonoEmisor) &&
  Boolean(textoSalida);


// ======================================================
// 12. MOTIVO DE NO ENV├ìO
// ======================================================

let motivoNoEnvio =
  null;


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

  else if (!textoSalida) {

    motivoNoEnvio =
      'TEXTO_SALIDA_FALTANTE';

  }

  else {

    motivoNoEnvio =
      'DATOS_ENVIO_INCOMPLETOS';

  }

}


// ======================================================
// 13. BODY YCLOUD
// ======================================================

const bodyYCloud = {

  from:
    telefonoE164(
      telefonoEmisor
    ),

  to:
    telefonoE164(
      telefonoDestino
    ),

  type:
    tipoYCloud,

  text: {
    body:
      textoSalida
  }

};


// ======================================================
// 14. DIAGN├ôSTICO DE ORIGEN
// ======================================================
//
// Muy ├║til mientras estabilizamos todas las rutas.
//
// Permite ver exactamente de d├│nde se recuper├│ tel├®fono.
//
// ======================================================

let telefonoDestinoOrigen =
  null;


if (
  limpiarTelefono(
    input.telefono_destino ??
    input.telefono
  )
) {

  telefonoDestinoOrigen =
    'INPUT_ACTUAL';

}

else if (
  limpiarTelefono(
    decision.telefono
  )
) {

  telefonoDestinoOrigen =
    'RECUPERAR_DECISION_COMERCIAL';

}

else if (
  limpiarTelefono(
    prepararMensajeHumano.telefono
  )
) {

  telefonoDestinoOrigen =
    'PREPARAR_MENSAJE_TRANSICION_HUMANO';

}

else if (
  limpiarTelefono(
    prepararDerivacionHumana.telefono
  )
) {

  telefonoDestinoOrigen =
    'PREPARAR_DERIVACION_HUMANA';

}

else if (
  limpiarTelefono(
    guardarContextoHandoff.telefono
  )
) {

  telefonoDestinoOrigen =
    'GUARDAR_CONTEXTO_HANDOFF';

}

else if (
  limpiarTelefono(
    prepararContextoHandoff.telefono
  )
) {

  telefonoDestinoOrigen =
    'PREPARAR_CONTEXTO_HANDOFF';

}

else if (
  limpiarTelefono(
    entradaWhatsApp.telefono
  )
) {

  telefonoDestinoOrigen =
    'PREPARAR_ENTRADA_WHATSAPP';

}

else {

  telefonoDestinoOrigen =
    'EVENTO_WHATSAPP';

}


// ======================================================
// 15. SALIDA
// ======================================================

return [
  {
    json: {

      // ----------------------------------------------
      // IDENTIFICACI├ôN
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

      telefono_destino_origen:
        telefonoDestinoOrigen,

      telefono_emisor:
        telefonoEmisor,

      telefono_destino_e164:
        telefonoE164(
          telefonoDestino
        ),

      telefono_emisor_e164:
        telefonoE164(
          telefonoEmisor
        ),


      // ----------------------------------------------
      // CONTENIDO
      // ----------------------------------------------

      texto_salida:
        textoSalida,

      tipo_salida:
        tipoOriginal,

      tipo_ycloud:
        tipoYCloud,


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
        body:
          bodyYCloud
      },


      // ----------------------------------------------
      // DIAGN├ôSTICO
      // ----------------------------------------------

      waba_id:
        eventoWhatsApp.waba_id ??
        metaWhatsApp.waba_id ??
        null,

      mensaje_entrante_id:
        eventoWhatsApp.mensaje_id ??
        entradaWhatsApp.mensaje_externo_id ??
        null,

      preparado_at:
        new Date().toISOString()

    }
  }
];
