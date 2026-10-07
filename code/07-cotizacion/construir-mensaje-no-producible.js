// ======================================================
// PREPARAR MENSAJE NO PRODUCIBLE
// PEGASO ADHESIVOS
// ======================================================

const input =
  $input.first().json ?? {};


// ======================================================
// HELPERS
// ======================================================

function numeroONull(valor) {

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
    numeroONull(valor);

  if (n === null) {
    return null;
  }

  if (Number.isInteger(n)) {
    return String(n);
  }

  return String(
    Number(
      n.toFixed(2)
    )
  );
}


// ======================================================
// DETALLE INVÁLIDO
// ======================================================

const detallesInvalidos =
  Array.isArray(input.detalles_invalidos)
    ? input.detalles_invalidos
    : [];


const detalle =
  detallesInvalidos[0] ?? {};


const ancho =
  numeroONull(
    detalle.ancho_cm ??
    input.ancho_cm
  );


const alto =
  numeroONull(
    detalle.alto_cm ??
    input.alto_cm
  );


// ======================================================
// MENSAJE
// ======================================================

let mensaje;


if (
  ancho !== null &&
  alto !== null &&
  (
    ancho <= 1 ||
    alto <= 1
  )
) {

  mensaje =
    `La medida de ${medidaTexto(ancho)}x${medidaTexto(alto)} cm no es posible de producir.\n\n` +
    `No trabajamos etiquetas que tengan 1 cm o menos en cualquiera de sus lados.\n\n` +
    `Indíquenos otra medida y con gusto le cotizamos.`;

} else {

  mensaje =
    `No podemos producir las etiquetas con las medidas indicadas. ` +
    `Indíquenos otra medida y con gusto le cotizamos.`;

}


// ======================================================
// SALIDA
// ======================================================

return [
  {
    json: {
      ...input,

      tipo_respuesta_comercial:
        'NO_PRODUCIBLE',

      mensaje_comercial:
        mensaje,

      mensaje_variacion_precio:
        null,

      mensajes_comerciales: [
        mensaje
      ],

      cantidad_mensajes_comerciales:
        1,

      cotizacion_producible:
        false,

      respuesta_comercial_lista:
        true
    }
  }
];