const item = $input.first().json;

const output = item.output;
const detalles = output?.detalles;

let valid = true;
let reason = null;

// 1. Debe existir output
if (!output || typeof output !== 'object') {
  valid = false;
  reason = 'La IA no devolvió un objeto output.';
}

// 2. Debe existir detalles
else if (!Array.isArray(detalles)) {
  valid = false;
  reason = 'El campo detalles no existe o no es un array.';
}

// 3. No debe estar vacío
else if (detalles.length === 0) {
  valid = false;
  reason = 'La IA devolvió detalles vacío.';
}

// 4. Validar cada detalle
else {
  for (let i = 0; i < detalles.length; i++) {
    const d = detalles[i];

    if (!d || typeof d !== 'object') {
      valid = false;
      reason = `El detalle ${i + 1} no es un objeto válido.`;
      break;
    }

    // cantidad
    if (
      d.cantidad !== null &&
      d.cantidad !== undefined &&
      typeof d.cantidad !== 'number'
    ) {
      valid = false;
      reason = `La cantidad del detalle ${i + 1} no es numérica.`;
      break;
    }

    // producto
    if (
      d.producto !== null &&
      d.producto !== undefined &&
      typeof d.producto !== 'string'
    ) {
      valid = false;
      reason = `El producto del detalle ${i + 1} no es texto.`;
      break;
    }

    // nombre
    if (
      d.nombre !== null &&
      d.nombre !== undefined &&
      typeof d.nombre !== 'string'
    ) {
      valid = false;
      reason = `El nombre del detalle ${i + 1} no es texto.`;
      break;
    }

    // sabor
    if (
      d.sabor !== null &&
      d.sabor !== undefined &&
      typeof d.sabor !== 'string'
    ) {
      valid = false;
      reason = `El sabor del detalle ${i + 1} no es texto.`;
      break;
    }

    // ancho
    if (
      d.ancho_cm !== null &&
      d.ancho_cm !== undefined &&
      typeof d.ancho_cm !== 'number'
    ) {
      valid = false;
      reason = `El ancho_cm del detalle ${i + 1} no es numérico.`;
      break;
    }

    // alto
    if (
      d.alto_cm !== null &&
      d.alto_cm !== undefined &&
      typeof d.alto_cm !== 'number'
    ) {
      valid = false;
      reason = `El alto_cm del detalle ${i + 1} no es numérico.`;
      break;
    }

    // forma
    const formasPermitidas = [
      'RECTANGULAR',
      'CUADRADA',
      'CIRCULAR',
      'IRREGULAR',
      'NO_ESPECIFICADA',
      null
    ];

    if (!formasPermitidas.includes(d.forma)) {
      valid = false;
      reason = `La forma del detalle ${i + 1} no es válida.`;
      break;
    }
  }
}

return [
  {
    json: {
      valid,
      reason,
      detalles: valid ? detalles : [],
      cantidad_detalles: Array.isArray(detalles) ? detalles.length : 0
    }
  }
];