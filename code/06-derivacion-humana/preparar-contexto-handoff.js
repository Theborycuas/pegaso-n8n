// ======================================================
// NODO N8N: Preparar contexto handoff
// ARCHIVO: code/06-derivacion-humana/preparar-contexto-handoff.js
// VERSION: 3.1
// RESPONSABILIDAD:
// - Recibir la fila de prospectos devuelta por "Marcar prospecto requiere humano"
// - Recuperar explícitamente el contrato creado por "Preparar derivación humana" (cerebro, imagen fallida o entrada no soportada)
// - Construir contexto_comercial.handoff (activo, motivo, intención, clasificación, prioridad, notificación, origen, mensaje del cliente, iniciado_at)
//   sobre la memoria comercial que trae el contrato
// - Fusionar fila DB + contrato handoff, dando prioridad al contrato y protegiendo prospecto_id
// - Marcar handoff_activo = true
// - NO escribir en PostgreSQL (lo hace "Guardar contexto handoff")
// - NO recalcular motivo, prioridad ni notificación
// ======================================================


// ======================================================
// 1. INPUT POSTGRES
// ======================================================

const db =
  $input.first().json ?? {};


// ======================================================
// 2. RECUPERAR CONTRATO HANDOFF ORIGINAL
// ======================================================

let handoff = {};

try {

  handoff =
    $('Preparar derivación humana')
      .first()
      .json ?? {};

} catch (_) {

  handoff = {};

}


// ======================================================
// 3. HELPERS
// ======================================================

function texto(valor) {

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


function objeto(valor) {

  if (
    valor &&
    typeof valor === 'object' &&
    !Array.isArray(valor)
  ) {
    return valor;
  }

  if (
    typeof valor === 'string'
  ) {

    try {

      const parsed =
        JSON.parse(valor);

      if (
        parsed &&
        typeof parsed === 'object' &&
        !Array.isArray(parsed)
      ) {

        return parsed;

      }

    } catch (_) {}

  }

  return {};

}


// ======================================================
// 4. CONTEXTO COMERCIAL
// ======================================================

const contextoActual =
  objeto(
    handoff.contexto_comercial ??
    db.contexto_comercial
  );


const ahora =
  new Date().toISOString();


// ======================================================
// 5. DATOS HANDOFF
// ======================================================

const motivo =
  texto(
    handoff.handoff_motivo
  ) ??
  'ATENCION_COMERCIAL';


const intencion =
  texto(
    handoff.intencion
  ) ??
  'OTRO';


const prioridad =
  texto(
    handoff.handoff_prioridad ??
    handoff.prioridad_derivacion
  ) ??
  'NORMAL';


const clasificacion =
  texto(
    handoff.handoff_clasificacion ??
    handoff.clasificacion_handoff
  );


const mensajeCliente =
  texto(
    handoff.mensaje_cliente_original
  ) ??
  texto(
    handoff.handoff_mensaje_cliente
  ) ??
  texto(
    handoff.mensaje_actual
  );


const requiereNotificacion =
  handoff.requiere_notificacion === true ||
  handoff.handoff_requiere_notificacion === true;


// ======================================================
// 6. CONTEXTO NUEVO
// ======================================================

const contextoNuevo = {

  ...contextoActual,

  handoff: {

    activo:
      true,

    motivo,

    intencion,

    clasificacion,

    prioridad,

    requiere_notificacion:
      requiereNotificacion,

    origen:
      texto(handoff.origen_derivacion) ??
      'CEREBRO_COMERCIAL',

    mensaje_cliente:
      mensajeCliente,

    iniciado_at:
      handoff.handoff_at ??
      ahora

  }

};


// ======================================================
// 7. SALIDA
// ======================================================

return [
  {
    json: {

      // Conservamos cualquier dato actualizado de DB.
      ...db,

      // Pero el contrato comercial tiene prioridad.
      ...handoff,

      // El id del prospecto NO debe reemplazar
      // conversacion_id.
      prospecto_id:
        handoff.prospecto_id ??
        db.id ??
        null,

      nombre_whatsapp:
        texto(
          handoff.nombre_whatsapp
        ) ??
        texto(
          db.nombre_whatsapp
        ),

      prospecto_nombre:
        texto(
          handoff.prospecto_nombre
        ) ??
        texto(
          db.nombre_whatsapp
        ),

      contexto_comercial:
        contextoNuevo,

      handoff_activo:
        true

    }
  }
];