// ======================================================
// NODO N8N: Finalizar derivación humana
// ARCHIVO: code/06-derivacion-humana/finalizar-derivacion-humana.js
// VERSION: 3.1
// RESPONSABILIDAD:
// - Recibir la salida de "Guardar mensaje transición humano" (fila de mensajes) o de "Preparar mensaje transición humano"
//   si corre en paralelo al INSERT: el contrato sale siempre de los nodos anteriores, no del input
// - Recuperar el contrato de "Preparar mensaje transición humano" con $() por si la conexión cambia; si falta algún dato, de "Preparar derivación humana"
// - Construir el contrato FINAL de handoff (identidad, prospecto, motivo, clasificación, prioridad, origen de la derivación, mensajes)
// - Normalizar requiere_notificacion a booleano para el IF "¿Requiere notificación?"
// - Marcar automatizacion_comercial_finalizada = true y fijar derivado_at / handoff_at
// - NO modificar decisiones comerciales, NO recalcular prioridad, NO decidir notificación
// - NO escribir en PostgreSQL ni enviar mensajes
// ======================================================


// ======================================================
// 1. INPUT DB
// ======================================================

const db =
  $input.first().json ?? {};


// ======================================================
// 2. RECUPERAR CONTRATO ANTERIOR
// ======================================================

let handoff = {};

try {

  handoff =
    $('Preparar mensaje transición humano')
      .first()
      .json ?? {};

} catch (_) {

  handoff = {};

}


let derivacion = {};

try {

  derivacion =
    $('Preparar derivación humana')
      .first()
      .json ?? {};

} catch (_) {

  derivacion = {};

}


const input = {
  ...derivacion,
  ...db,
  ...handoff
};


// ======================================================
// 3. HELPERS
// ======================================================

function booleano(
  valor,
  defecto = false
) {

  if (
    typeof valor === 'boolean'
  ) {
    return valor;
  }

  if (
    valor === 'true' ||
    valor === 1 ||
    valor === '1'
  ) {
    return true;
  }

  if (
    valor === 'false' ||
    valor === 0 ||
    valor === '0'
  ) {
    return false;
  }

  return defecto;
}


function textoONull(
  valor
) {

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


// ======================================================
// 4. HANDOFF
// ======================================================

const handoffMotivo =
  textoONull(
    input.handoff_motivo ??
    input.motivo_derivacion ??
    input.motivo
  );


const handoffClasificacion =
  textoONull(
    input.handoff_clasificacion ??
    input.clasificacion_handoff
  );


const handoffPrioridad =
  textoONull(
    input.handoff_prioridad ??
    input.prioridad_derivacion ??
    input.prioridad
  ) ??
  'NORMAL';


// ======================================================
// 5. NOTIFICACIÓN
// ======================================================

const requiereNotificacion =
  booleano(
    input.requiere_notificacion ??
    input.handoff_requiere_notificacion,
    false
  );


// ======================================================
// 6. MENSAJES
// ======================================================
//
// Dos conceptos separados:
//
// mensajeClienteOriginal:
//   lo que escribió el prospecto.
//
// mensajeTransicion:
//   lo que Pegaso respondió.
//
// ======================================================

const mensajeClienteOriginal =
  textoONull(
    input.mensaje_cliente_original ??
    input.handoff_mensaje_cliente ??
    input.mensaje_actual
  );


const mensajeTransicion =
  textoONull(
    input.mensaje_transicion ??
    input.handoff_mensaje_transicion ??
    input.mensaje_salida ??
    input.respuesta_final ??
    input.respuesta
  );


// ======================================================
// 7. FECHA
// ======================================================

const derivadoAt =
  input.handoff_at ??
  input.derivado_at ??
  new Date().toISOString();


// ======================================================
// 8. SALIDA
// ======================================================

return [
  {
    json: {

      success:
        true,

      flujo:
        'DERIVACION_HUMANA',


      // ----------------------------------------------
      // IDENTIDAD
      // ----------------------------------------------

      conversacion_id:
        input.conversacion_id ??
        null,

      prospecto_id:
        input.prospecto_id ??
        null,

      cliente_id:
        input.cliente_id ??
        null,

      contacto_id:
        input.contacto_id ??
        null,

      telefono:
        textoONull(
          input.telefono
        ),

      nombre_whatsapp:
        textoONull(
          input.nombre_whatsapp ??
          input.prospecto_nombre
        ),

      prospecto_nombre:
        textoONull(
          input.prospecto_nombre ??
          input.nombre_whatsapp
        ),

      prospecto_ciudad:
        textoONull(
          input.prospecto_ciudad
        ),

      prospecto_provincia:
        textoONull(
          input.prospecto_provincia
        ),

      prospecto_clasificacion:
        textoONull(
          input.prospecto_clasificacion ??
          input.clasificacion_prospecto
        ),


      // ----------------------------------------------
      // DECISIÓN
      // ----------------------------------------------

      intencion:
        textoONull(
          input.intencion
        ),

      accion:
        textoONull(
          input.accion
        ),


      // ----------------------------------------------
      // HANDOFF
      // ----------------------------------------------

      handoff_motivo:
        handoffMotivo,

      motivo:
        handoffMotivo,

      handoff_clasificacion:
        handoffClasificacion,

      clasificacion_handoff:
        handoffClasificacion,

      handoff_prioridad:
        handoffPrioridad,

      prioridad:
        handoffPrioridad,

      requiere_humano:
        true,


      // ----------------------------------------------
      // NOTIFICACIÓN
      // ----------------------------------------------

      requiere_notificacion:
        requiereNotificacion,

      handoff_requiere_notificacion:
        requiereNotificacion,


      // ----------------------------------------------
      // ORIGEN DE LA DERIVACIÓN
      // ----------------------------------------------

      origen_derivacion:
        textoONull(
          input.origen_derivacion
        ) ??
        'CEREBRO_COMERCIAL',

      derivacion_directa:
        input.derivacion_directa === true,

      derivacion_directa_motivo:
        textoONull(
          input.derivacion_directa_motivo
        ),

      analisis_imagen_fallido:
        input.analisis_imagen_fallido === true,


      // ----------------------------------------------
      // MENSAJE DEL CLIENTE
      // ----------------------------------------------

      mensaje_cliente_original:
        mensajeClienteOriginal,

      handoff_mensaje_cliente:
        mensajeClienteOriginal,


      // ----------------------------------------------
      // MENSAJE PEGASO
      // ----------------------------------------------

      mensaje_transicion:
        mensajeTransicion,

      handoff_mensaje_transicion:
        mensajeTransicion,


      // ----------------------------------------------
      // CONTROL
      // ----------------------------------------------

      automatizacion_comercial_finalizada:
        true,

      derivado_at:
        derivadoAt,

      handoff_at:
        derivadoAt

    }
  }
];