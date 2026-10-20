// ======================================================
// N8N NODE - PEGASO
// ======================================================
// Nombre: Preparar envío WhatsApp
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
// PREPARAR ENVÍO WHATSAPP - YCLOUD
// PEGASO ADHESIVOS
// VERSION: 3.5
// ======================================================
//
// V2.1: no envía si el texto persistido es el marcador
// [RESPUESTA AUTOMÁTICA OMITIDA ...] de "Preparar respuesta
// comercial" (motivo_no_envio = RESPUESTA_OMITIDA_DUPLICADA).
//
// V2.2: si la decisión comercial trae enviar_imagen_material,
// emite enviar_imagen y ycloud_request_imagen (foto del
// material) para "YCloud Enviar imagen material", que se
// envía después del texto.
//
// V3.0: lee enviar_imagen_informativa / imagen_informativa_url
// (material o metodología) y expone imagen_informativa. La
// imagen se envía ANTES del texto ("YCloud Enviar imagen" →
// "Esperar antes del texto" → "YCloud Enviar Wts").
//
// V3.1: catálogo de videos de tarjetas (enviar_videos_tarjetas
// + videos_tarjetas[].body type=video con caption).
//
// V3.2: saludo horario antes de los videos
// (ycloud_request_saludo_tarjetas); el texto posterior es
// solo la frase de cierre del catálogo.
//
// V3.3: el mismo saludo sirve para flyers; la imagen de
// flyers reutiliza ycloud_request_imagen (antes del texto).
//
// V3.4: nota de IVA al final del catálogo de tarjetas/flyers
// (ycloud_request_nota_iva), no en etiquetas.
//
// V3.5: el saludo de catálogo solo sale si Resolver dejó
// texto_saludo_tarjetas (sesión nueva). Flyers reutiliza
// ycloud_request_imagen aunque no haya saludo.
//
// Puede recibir datos desde distintas rutas:
//
// - Guardar mensaje saliente
// - Guardar mensaje comercial
// - Guardar mensaje transición humano
//
// IMPORTANTE:
//
// Los nodos PostgreSQL pueden devolver únicamente la fila
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
// 2. Resolver teléfono destino.
// 3. Confirmar que la ejecución nació de WhatsApp real.
// 4. Resolver proveedor YCloud.
// 5. Resolver número emisor Pegaso.
// 6. Construir request compatible con YCloud.
// 7. Evitar envíos físicos durante TEST/manual.
// 8. Construir el request de la imagen informativa, si aplica.
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
// Si el nodo no participó en esta ejecución:
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
    'Recuperar decisión comercial'
  );


const prepararRespuestaComercial =
  obtenerNodo(
    'Preparar respuesta comercial'
  );


const prepararMensajeCotizacion =
  obtenerNodo(
    'Preparar mensaje cotización'
  );


const prepararMensajeHumano =
  obtenerNodo(
    'Preparar mensaje transición humano'
  );


const prepararDerivacionHumana =
  obtenerNodo(
    'Preparar derivación humana'
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
// Primera opción:
// contenido ya persistido en mensajes.
//
// Los demás son únicamente fallbacks de seguridad.
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

  // Cotización
  textoONull(
    prepararMensajeCotizacion.mensaje_salida
  ) ??

  textoONull(
    prepararMensajeCotizacion.mensaje_comercial
  ) ??

  null;


if (!textoSalida) {

  throw new Error(
    'PREPARAR ENVÍO WHATSAPP: el mensaje saliente no contiene texto.'
  );

}


// ======================================================
// 6. RESOLVER TELÉFONO DESTINO
// ======================================================
//
// El mensaje guardado puede NO conservar teléfono.
//
// Prioridad:
//
// 1. input actual
// 2. decisión comercial
// 3. mensaje humano
// 4. derivación humana
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
    'PREPARAR ENVÍO WHATSAPP: no se pudo resolver el teléfono destino.'
  );

}


// ======================================================
// 7. DETERMINAR SI VIENE DE WHATSAPP REAL
// ======================================================
//
// Camino real:
//
// Webhook YCloud
//   → Normalizar evento WhatsApp
//   → Preparar entrada WhatsApp
//   → ...
//
// Camino TEST:
//
// Execute workflow
//   → Mensaje TEST
//
// Solo enviamos físicamente cuando la ejecución pertenece
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
// El proveedor puede venir explícitamente del evento.
//
// También aceptamos el hecho de que el evento normalizado
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
// todavía no expone origen explícitamente, podemos
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
// 9. RESOLVER NÚMERO EMISOR PEGASO
// ======================================================
//
// YCloud inbound:
//
// from = cliente
// to   = Pegaso
//
// En la normalización normalmente:
//
// display_phone_number = número Pegaso.
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
// Número oficial actualmente conectado a YCloud.
//
// Si Pegaso trabaja después con múltiples números,
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
// `HANDOFF_HUMANO` describe el propósito comercial,
// pero físicamente sigue siendo un mensaje de texto.
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


// Para YCloud siempre será físicamente "text".
const tipoYCloud =
  'text';


// ======================================================
// 11. DECIDIR SI SE ENVÍA
// ======================================================

const respuestaOmitida =
  String(textoSalida ?? '')
    .trim()
    .startsWith('[RESPUESTA AUTOMÁTICA OMITIDA') ||
  (
    prepararRespuestaComercial.omitir_envio === true &&
    String(textoSalida ?? '').trim() ===
      String(prepararRespuestaComercial.respuesta_final ?? '').trim()
  );


const enviarWhatsApp =
  !respuestaOmitida &&
  vieneDeWhatsAppReal &&
  vieneDeYCloud &&
  esTexto &&
  Boolean(telefonoDestino) &&
  Boolean(telefonoEmisor) &&
  Boolean(textoSalida);


// ======================================================
// 12. MOTIVO DE NO ENVÍO
// ======================================================

let motivoNoEnvio =
  null;


if (!enviarWhatsApp) {

  if (respuestaOmitida) {

    motivoNoEnvio =
      'RESPUESTA_OMITIDA_DUPLICADA';

  }

  else if (!vieneDeWhatsAppReal) {

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
// 13.1 IMAGEN INFORMATIVA (ANTES DEL TEXTO)
// ======================================================
//
// Solo cuando "Resolver contexto comercial" marcó
// enviar_imagen_informativa (material o metodología) y el
// texto sí se envía. "YCloud Enviar imagen" continúa ante
// error, así que el texto sale aunque la imagen falle.
//
// ======================================================

const urlImagenInformativa =
  decision.enviar_imagen_flyers === true
    ? textoONull(decision.imagen_flyers_url)
    : decision.enviar_imagen_informativa === true
      ? textoONull(decision.imagen_informativa_url)
      : null;

const videosTarjetasOrigen =
  decision.enviar_videos_tarjetas === true &&
  Array.isArray(decision.videos_tarjetas)
    ? decision.videos_tarjetas
    : [];

const enviarVideosTarjetas =
  enviarWhatsApp &&
  videosTarjetasOrigen.length > 0;

const enviarImagen =
  enviarWhatsApp &&
  !enviarVideosTarjetas &&
  urlImagenInformativa !== null;

const bodyYCloudImagen =
  enviarImagen
    ? {
        from:
          telefonoE164(
            telefonoEmisor
          ),

        to:
          telefonoE164(
            telefonoDestino
          ),

        type:
          'image',

        image: {
          link:
            urlImagenInformativa
        }
      }
    : null;

const videosTarjetas =
  enviarVideosTarjetas
    ? videosTarjetasOrigen
        .slice(0, 4)
        .map(video => ({
          clave:
            textoONull(video?.clave),

          body: {
            from:
              telefonoE164(
                telefonoEmisor
              ),

            to:
              telefonoE164(
                telefonoDestino
              ),

            type:
              'video',

            video: {
              link:
                textoONull(video?.url),

              caption:
                String(video?.caption ?? '').trim()
            }
          }
        }))
        .filter(v =>
          v.body.video.link !== null &&
          v.body.video.caption !== ''
        )
    : [];

const enviarVideosTarjetasFinal =
  videosTarjetas.length > 0;

const textoSaludoTarjetas =
  String(decision.texto_saludo_tarjetas ?? '').trim();

const enviarSaludoTarjetas =
  enviarWhatsApp &&
  textoSaludoTarjetas !== '' &&
  (
    enviarVideosTarjetasFinal ||
    enviarImagen
  );

const bodyYCloudSaludoTarjetas =
  enviarSaludoTarjetas
    ? {
        from:
          telefonoE164(
            telefonoEmisor
          ),

        to:
          telefonoE164(
            telefonoDestino
          ),

        type:
          'text',

        text: {
          body:
            textoSaludoTarjetas
        }
      }
    : null;

const textoNotaIva =
  enviarWhatsApp &&
  decision.enviar_nota_iva === true
    ? String(decision.texto_nota_iva ?? '').trim()
    : '';

const enviarNotaIva =
  textoNotaIva !== '';

const bodyYCloudNotaIva =
  enviarNotaIva
    ? {
        from:
          telefonoE164(
            telefonoEmisor
          ),

        to:
          telefonoE164(
            telefonoDestino
          ),

        type:
          'text',

        text: {
          body:
            textoNotaIva
        }
      }
    : null;


// ======================================================
// 14. DIAGNÓSTICO DE ORIGEN
// ======================================================
//
// Muy útil mientras estabilizamos todas las rutas.
//
// Permite ver exactamente de dónde se recuperó teléfono.
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

      enviar_imagen:
        enviarImagen,

      imagen_informativa:
        enviarImagen
          ? textoONull(decision.imagen_informativa)
          : null,

      ycloud_request_imagen: {
        body:
          bodyYCloudImagen
      },

      enviar_videos_tarjetas:
        enviarVideosTarjetasFinal,

      videos_tarjetas:
        videosTarjetas,

      enviar_saludo:
        enviarSaludoTarjetas,

      enviar_saludo_tarjetas:
        enviarSaludoTarjetas,

      ycloud_request_saludo: {
        body:
          bodyYCloudSaludoTarjetas
      },

      ycloud_request_saludo_tarjetas: {
        body:
          bodyYCloudSaludoTarjetas
      },

      enviar_nota_iva:
        enviarNotaIva,

      ycloud_request_nota_iva: {
        body:
          bodyYCloudNotaIva
      },


      // ----------------------------------------------
      // DIAGNÓSTICO
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
