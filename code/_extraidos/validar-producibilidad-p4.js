// ======================================================
// N8N NODE - PEGASO
// ======================================================
// Nombre: Validar producibilidad P4
// Node ID: c6bc9d87-8c34-4847-9cf5-a89b113c1381
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
// VALIDAR PRODUCIBILIDAD P4
// PEGASO ADHESIVOS - V1
// ======================================================
//
// OBJETIVO:
//
// Validar restricciones f├¡sicas/comerciales ANTES de:
//
// - INSERT cotizacion_detalles
// - c├ílculo de precios
// - persistencia de una cotizaci├│n inv├ílida
//
// IMPORTANTE:
//
// Las REGLAS DE PRECIO siguen perteneciendo a:
// "Calcular precio detalle"
//
// Este nodo solamente valida si la medida se puede
// producir.
//
// REGLA PEGASO:
//
// No se producen etiquetas que tengan 1 cm o menos
// en cualquiera de sus lados.
//
// Ejemplos NO v├ílidos:
//
// 1x1
// 1x5
// 5x1
// 0.5x10
// 10x0.8
//
// Ejemplos v├ílidos:
//
// 2x2
// 2x5
// 3x3
// 4x4
// 5x8
//
// ======================================================


const items =
  $input.all();


// ======================================================
// 1. VALIDACI├ôN GENERAL
// ======================================================

if (
  !Array.isArray(items) ||
  items.length === 0
) {
  throw new Error(
    'No existen detalles para validar producibilidad.'
  );
}


// ======================================================
// 2. HELPERS
// ======================================================

function numero(valor) {

  if (
    valor === undefined ||
    valor === null ||
    valor === ''
  ) {
    return null;
  }

  const n =
    Number(valor);

  return Number.isFinite(n)
    ? n
    : null;
}


function medidaTexto(valor) {

  const n =
    numero(valor);

  if (n === null) {
    return '';
  }

  if (
    Number.isInteger(n)
  ) {
    return String(n);
  }

  return String(
    Number(
      n.toFixed(2)
    )
  );
}


// ======================================================
// 3. REGLAS DE PRODUCCI├ôN
// ======================================================

const MEDIDA_MINIMA_CM = 2;


// ======================================================
// 4. BUSCAR DETALLES NO PRODUCIBLES
// ======================================================

const detallesInvalidos = [];


items.forEach(
  (item, index) => {

    const data =
      item.json ?? {};


    const ancho =
      numero(
        data.ancho_cm
      );


    const alto =
      numero(
        data.alto_cm
      );


    // --------------------------------------------------
    // Datos incompletos
    // --------------------------------------------------

    if (
      ancho === null ||
      alto === null
    ) {

      detallesInvalidos.push({
        index,
        motivo:
          'MEDIDAS_INCOMPLETAS',

        ancho_cm:
          ancho,

        alto_cm:
          alto
      });

      return;
    }


    // --------------------------------------------------
    // Medidas f├¡sicamente no producibles
    // --------------------------------------------------

    if (
      ancho < MEDIDA_MINIMA_CM ||
      alto < MEDIDA_MINIMA_CM
    ) {

      detallesInvalidos.push({
        index,

        motivo:
          'MEDIDA_NO_PRODUCIBLE',

        ancho_cm:
          ancho,

        alto_cm:
          alto
      });

    }

  }
);


// ======================================================
// 5. SI EXISTE ALG├ÜN DETALLE INV├üLIDO
// ======================================================

if (
  detallesInvalidos.length > 0
) {

  const primerInvalido =
    detallesInvalidos[0];


  const ancho =
    primerInvalido.ancho_cm;


  const alto =
    primerInvalido.alto_cm;


  let mensaje;


  // --------------------------------------------------
  // Medidas conocidas
  // --------------------------------------------------

  if (
    ancho !== null &&
    alto !== null
  ) {

    mensaje =
      `La medida de ${medidaTexto(ancho)}x${medidaTexto(alto)} cm ` +
      `no es posible de producir.\n\n` +

      `No trabajamos etiquetas que tengan 1 cm o menos ` +
      `en cualquiera de sus lados. La medida m├¡nima que ` +
      `podemos producir es de 2 cm.\n\n` +

      `Ind├¡quenos otra medida y con gusto le cotizamos.`;

  }


  // --------------------------------------------------
  // Medidas incompletas
  // --------------------------------------------------

  else {

    mensaje =
      `No pudimos determinar correctamente las medidas de la etiqueta. ` +
      `Ind├¡quenos ancho y alto en cent├¡metros por favor.`;

  }


  // --------------------------------------------------
  // Conservar el contexto principal
  // --------------------------------------------------

  const base =
    items[0].json ?? {};


  return [
    {
      json: {

        ...base,


        // ============================================
        // VALIDACI├ôN
        // ============================================

        cotizacion_producible:
          false,

        validacion_produccion_ok:
          false,

        motivo_bloqueo:
          primerInvalido.motivo,

        medida_minima_cm:
          MEDIDA_MINIMA_CM,

        detalles_invalidos:
          detallesInvalidos,


        // ============================================
        // NO DEBE CONTINUAR A PRECIO
        // ============================================

        bloquear_cotizacion:
          true,

        calcular_precio:
          false,


        // ============================================
        // CONTRATO COMPATIBLE CON MENSAJER├ìA
        // ============================================

        mensaje_comercial:
          mensaje,

        mensajes_comerciales: [
          mensaje
        ],

        cantidad_mensajes_comerciales:
          1,


        // ============================================
        // DIAGN├ôSTICO
        // ============================================

        validacion_produccion_at:
          new Date().toISOString()

      }
    }
  ];

}


// ======================================================
// 6. TODO ES PRODUCIBLE
// ======================================================
//
// Conservamos cada item porque posteriormente el flujo
// puede contener varios detalles de cotizaci├│n.
//
// ======================================================

return items.map(
  item => {

    return {
      json: {

        ...item.json,

        cotizacion_producible:
          true,

        validacion_produccion_ok:
          true,

        motivo_bloqueo:
          null,

        medida_minima_cm:
          MEDIDA_MINIMA_CM,

        detalles_invalidos:
          [],

        bloquear_cotizacion:
          false,

        calcular_precio:
          true

      }
    };

  }
);
