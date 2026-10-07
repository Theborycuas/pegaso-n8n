// ======================================================
// NODO N8N: Validar producibilidad P4
// ARCHIVO: code/07-cotizacion/validar-producibilidad-p4.js
// VERSION: 1
// RESPONSABILIDAD:
// - Validar restricciones físicas ANTES de INSERT cotizacion_detalles y del cálculo de precios
// - Marcar MEDIDAS_INCOMPLETAS si falta ancho_cm o alto_cm
// - Marcar MEDIDA_NO_PRODUCIBLE si algún lado mide menos de 2 cm (regla Pegaso: no se producen lados de 1 cm o menos; ej no válidos 1x1, 1x5, 0.5x10, 10x0.8; válidos 2x2, 2x5, 5x8)
// - Si hay algún detalle inválido: bloquear toda la cotización y devolver 1 solo item con mensaje_comercial para el cliente
// - Si todo es producible: conservar cada item con cotizacion_producible = true y calcular_precio = true
// - NO calcular precio (las reglas de precio pertenecen a "Calcular precio detalle")
// ======================================================


const items =
  $input.all();


// ======================================================
// 1. VALIDACIÓN GENERAL
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
// 3. REGLAS DE PRODUCCIÓN
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
    // Medidas físicamente no producibles
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
// 5. SI EXISTE ALGÚN DETALLE INVÁLIDO
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
      `en cualquiera de sus lados. La medida mínima que ` +
      `podemos producir es de 2 cm.\n\n` +

      `Indíquenos otra medida y con gusto le cotizamos.`;

  }


  // --------------------------------------------------
  // Medidas incompletas
  // --------------------------------------------------

  else {

    mensaje =
      `No pudimos determinar correctamente las medidas de la etiqueta. ` +
      `Indíquenos ancho y alto en centímetros por favor.`;

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
        // VALIDACIÓN
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
        // CONTRATO COMPATIBLE CON MENSAJERÍA
        // ============================================

        mensaje_comercial:
          mensaje,

        mensajes_comerciales: [
          mensaje
        ],

        cantidad_mensajes_comerciales:
          1,


        // ============================================
        // DIAGNÓSTICO
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
// puede contener varios detalles de cotización.
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