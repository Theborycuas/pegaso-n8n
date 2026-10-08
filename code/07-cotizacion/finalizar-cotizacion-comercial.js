// ======================================================
// NODO N8N: Finalizar cotización comercial
// ARCHIVO: code/07-cotizacion/finalizar-cotizacion-comercial.js
// VERSION: 2.1
// RESPONSABILIDAD:
// - Cerrar formalmente el flujo de cotización leyendo "Resolver estado post cotización" (respaldo de identidad: "Recuperar decisión comercial")
// - Detectar primero si la solicitud NO fue producible, con cualquier señal: cotizacion_generada / cotizacion_producible = false,
//   bloquear_cotizacion, motivo_bloqueo / motivo_no_producible, "Validar producibilidad P4" bloqueada o accion MEDIDA_NO_PRODUCIBLE
// - Caso no producible: resultado válido (no error) con flujo COTIZACION_NO_PRODUCIBLE, estado_comercial NO_COTIZABLE y
//   siguiente_accion_esperada SOLICITAR_NUEVA_MEDIDA; aunque exista un cotizacion_id (el INSERT corre antes de validar), no se informa;
//   si falta el mensaje comercial usa uno estándar en vez de lanzar error
// - Caso producible (cotizacion_generada, cotizacion_producible o presencia de cotizacion_id): exigir cotizacion_id y total válidos
//   y devolver flujo COTIZACION / resultado COTIZADA / estado_comercial COTIZADO
// - NO escribir en PostgreSQL ni enviar mensajes
// ======================================================


// ======================================================
// 1. RECUPERAR ESTADO RESUELTO
// ======================================================

const data =
  $('Resolver estado post cotización')
    .first()
    .json ?? {};


// ======================================================
// 2. HELPERS
// ======================================================

function numeroONull(valor) {
  if (valor === undefined || valor === null || valor === '') {
    return null;
  }

  const n = Number(valor);

  return Number.isFinite(n) ? n : null;
}

function booleano(valor, defecto = false) {
  if (typeof valor === 'boolean') {
    return valor;
  }

  if (valor === 'true' || valor === 1 || valor === '1') {
    return true;
  }

  if (valor === 'false' || valor === 0 || valor === '0') {
    return false;
  }

  return defecto;
}

function textoONull(valor) {
  if (valor === undefined || valor === null) {
    return null;
  }

  const limpio = String(valor).trim();

  return limpio !== '' ? limpio : null;
}

function jsonDe(nodo) {
  try {
    return $(nodo).first().json ?? {};
  } catch (error) {
    return {};
  }
}


// ======================================================
// 3. DATOS BASE
// ======================================================

const decision = jsonDe('Recuperar decisión comercial');

const conversacionId = numeroONull(data.conversacion_id ?? decision.conversacion_id);
const prospectoId = numeroONull(data.prospecto_id ?? decision.prospecto_id);
const clienteId = numeroONull(data.cliente_id ?? decision.cliente_id);
const cotizacionId = numeroONull(data.cotizacion_id);
const total = numeroONull(data.total);

const MENSAJE_NO_PRODUCIBLE_ESTANDAR =
  'No podemos producir las etiquetas con las medidas indicadas. Si gusta, indíquenos otra medida y con gusto le cotizamos.';

const mensajeComercial =
  textoONull(data.mensaje_comercial) ??
  '';


// ======================================================
// 4. VALIDACIÓN COMÚN
// ======================================================

if (
  conversacionId === null ||
  conversacionId <= 0
) {
  throw new Error(
    'Finalizar cotización: no existe conversacion_id válido.'
  );
}


// ======================================================
// 5. ¿LA SOLICITUD FUE NO PRODUCIBLE?
// ======================================================
//
// Se revisa antes que la presencia de cotizacion_id: "Insert
// cotización" corre antes de "Validar producibilidad P4", así
// que una medida no producible puede traer un id de una
// cotización vacía.
// ======================================================

let producibilidad = {};

try {
  producibilidad =
    $('Validar producibilidad P4')
      .all()
      .map(item => item.json ?? {})
      .find(item =>
        item.cotizacion_producible === false ||
        item.bloquear_cotizacion === true
      ) ?? {};
} catch (error) {
  producibilidad = {};
}

let cotizacionGenerada;

if (data.cotizacion_generada !== undefined && data.cotizacion_generada !== null) {
  cotizacionGenerada = booleano(data.cotizacion_generada);
} else if (data.cotizacion_producible !== undefined && data.cotizacion_producible !== null) {
  cotizacionGenerada = booleano(data.cotizacion_producible);
} else {
  cotizacionGenerada = cotizacionId !== null;
}

const noProducible =
  cotizacionGenerada === false ||
  data.cotizacion_producible === false ||
  booleano(data.bloquear_cotizacion) ||
  textoONull(data.motivo_bloqueo) !== null ||
  textoONull(data.motivo_no_producible) !== null ||
  producibilidad.cotizacion_producible === false ||
  producibilidad.bloquear_cotizacion === true ||
  String(decision.accion ?? '').toUpperCase() === 'MEDIDA_NO_PRODUCIBLE';


// ======================================================
// 6. CASO A: SOLICITUD NO PRODUCIBLE
// ======================================================
//
// No es un error: el prospecto debe poder cambiar la medida y
// continuar. No se informa ninguna cotización.
// ======================================================

if (noProducible) {
  return [
    {
      json: {
        success: true,
        flujo: 'COTIZACION_NO_PRODUCIBLE',
        resultado_cotizacion: 'NO_PRODUCIBLE',

        // ----------------------------------------------
        // IDENTIDAD
        // ----------------------------------------------

        conversacion_id: conversacionId,
        prospecto_id: prospectoId,
        cliente_id: clienteId,

        // ----------------------------------------------
        // SIN COTIZACIÓN REAL
        // ----------------------------------------------

        cotizacion_id: null,
        total: null,
        estado_comercial: 'NO_COTIZABLE',
        cotizacion_generada: false,
        cotizacion_producible: false,
        motivo_no_producible:
          textoONull(data.motivo_no_producible) ??
          textoONull(data.motivo_bloqueo) ??
          textoONull(producibilidad.motivo_bloqueo) ??
          'MEDIDA_NO_PRODUCIBLE',

        // ----------------------------------------------
        // MENSAJE
        // ----------------------------------------------

        mensaje_comercial: mensajeComercial || MENSAJE_NO_PRODUCIBLE_ESTANDAR,
        mensaje_comercial_estandar: !mensajeComercial,
        esperando_respuesta_cliente: true,
        siguiente_accion_esperada: 'SOLICITAR_NUEVA_MEDIDA',

        // ----------------------------------------------
        // CONTROL
        // ----------------------------------------------

        finalizado_at: new Date().toISOString()
      }
    }
  ];
}


// ======================================================
// 7. CASO B: COTIZACIÓN PRODUCIBLE
// ======================================================

if (
  cotizacionId === null ||
  cotizacionId <= 0
) {
  throw new Error(
    'Finalizar cotización: se marcó como generada pero no existe cotizacion_id.'
  );
}

if (
  total === null ||
  total < 0
) {
  throw new Error(
    'Finalizar cotización: se marcó como generada pero no existe total válido.'
  );
}

return [
  {
    json: {
      success: true,
      flujo: 'COTIZACION',
      resultado_cotizacion: 'COTIZADA',

      // ----------------------------------------------
      // IDENTIDAD
      // ----------------------------------------------

      conversacion_id: conversacionId,
      prospecto_id: prospectoId,
      cliente_id: clienteId,

      // ----------------------------------------------
      // COTIZACIÓN
      // ----------------------------------------------

      cotizacion_id: cotizacionId,
      total,
      estado_comercial: 'COTIZADO',
      cotizacion_generada: true,
      cotizacion_producible: true,

      // ----------------------------------------------
      // MENSAJE
      // ----------------------------------------------

      mensaje_comercial: mensajeComercial,
      esperando_respuesta_cliente: true,

      // ----------------------------------------------
      // CONTROL
      // ----------------------------------------------

      finalizado_at: new Date().toISOString()
    }
  }
];
