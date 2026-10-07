// ======================================================
// NODO N8N: EXPANDIR DETALLES
// ARCHIVO: code/07-cotizacion/expandir-detalles.js
// VERSION: 1.0
// RESPONSABILIDAD:
// - Leer cotizacion_id y cliente_id de la entrada directa ("EDT Datos del detalle")
// - Recuperar detalles[] desde "Preparar datos cotización"
// - Emitir 1 item por detalle con cotizacion_id, cliente_id y detalle_index
// - Lanzar error si falta cotizacion_id o si cantidad/ancho_cm/alto_cm no son positivos
// - Resolver nombre por prioridad: nombre explícito > producto > nombre técnico (ej 5x5 + CIRCULAR -> "Etiqueta 5x5 cm circular")
// - NO exigir producto (puede quedar null)
// - NO resolver catálogo ni diseño (lo hacen "Resolver catalogo Pegaso" y "Resolver diseño")
// ======================================================


// ======================================================
// 1. DATOS DE LA COTIZACIÓN
// ======================================================

const input = $input.first().json;

const cotizacionId =
  input.cotizacion_id != null
    ? Number(input.cotizacion_id)
    : null;

const clienteId =
  input.cliente_id != null
    ? Number(input.cliente_id)
    : null;


// ======================================================
// 2. RECUPERAR DETALLES PREPARADOS
// ======================================================

let datosPreparados = {};

try {
  datosPreparados =
    $('Preparar datos cotización').first().json ?? {};
} catch (error) {
  datosPreparados = {};
}

const detalles =
  Array.isArray(datosPreparados.detalles)
    ? datosPreparados.detalles
    : [];


// ======================================================
// 3. VALIDACIONES
// ======================================================

if (
  cotizacionId === null ||
  !Number.isFinite(cotizacionId) ||
  cotizacionId <= 0
) {
  throw new Error(
    'EXPANDIR DETALLES: cotizacion_id es obligatorio.'
  );
}

if (
  !Array.isArray(detalles) ||
  detalles.length === 0
) {
  throw new Error(
    'EXPANDIR DETALLES: no existen detalles preparados para calcular.'
  );
}


// ======================================================
// 4. HELPERS
// ======================================================

function limpiarTexto(valor) {
  if (valor === null || valor === undefined) {
    return null;
  }

  const texto = String(valor).trim();

  return texto !== ''
    ? texto
    : null;
}


function numeroTexto(valor) {
  const numero = Number(valor);

  if (!Number.isFinite(numero)) {
    return '';
  }

  return Number.isInteger(numero)
    ? String(numero)
    : String(numero);
}


function formaParaNombre(forma) {

  switch (forma) {

    case 'CIRCULAR':
      return 'circular';

    case 'RECTANGULAR':
      return 'rectangular';

    case 'CUADRADA':
      return 'cuadrada';

    case 'REDONDEADA':
      return 'con puntas redondeadas';

    case 'TROQUELADA':
      return 'troquelada';

    case 'IRREGULAR':
      return 'irregular';

    case 'NO_ESPECIFICADA':
      return '';

    default:
      return String(forma)
        .trim()
        .toLowerCase();
  }
}


function generarNombreTecnico(
  anchoCm,
  altoCm,
  forma
) {

  const ancho =
    numeroTexto(anchoCm);

  const alto =
    numeroTexto(altoCm);

  const formaTexto =
    formaParaNombre(forma);

  const medida =
    `${ancho}x${alto} cm`;

  if (formaTexto) {
    return `Etiqueta ${medida} ${formaTexto}`;
  }

  return `Etiqueta ${medida}`;
}


// ======================================================
// 5. EXPANDIR
// ======================================================

return detalles.map((detalle, index) => {

  const cantidad =
    Number(detalle.cantidad ?? 0);

  const anchoCm =
    Number(detalle.ancho_cm ?? 0);

  const altoCm =
    Number(detalle.alto_cm ?? 0);

  const cantidadOriginal =
    Number(
      detalle.cantidad_original ??
      detalle.cantidad ??
      0
    );

  const forma =
    String(
      detalle.forma ??
      'RECTANGULAR'
    )
      .trim()
      .toUpperCase();


  // ====================================================
  // VALIDACIÓN DEL DETALLE
  // ====================================================

  if (
    !Number.isFinite(cantidad) ||
    cantidad <= 0
  ) {
    throw new Error(
      `EXPANDIR DETALLES: cantidad inválida en detalle ${index}.`
    );
  }

  if (
    !Number.isFinite(anchoCm) ||
    anchoCm <= 0
  ) {
    throw new Error(
      `EXPANDIR DETALLES: ancho_cm inválido en detalle ${index}.`
    );
  }

  if (
    !Number.isFinite(altoCm) ||
    altoCm <= 0
  ) {
    throw new Error(
      `EXPANDIR DETALLES: alto_cm inválido en detalle ${index}.`
    );
  }


  // ====================================================
  // PRODUCTO Y NOMBRE
  // ====================================================

  const producto =
    limpiarTexto(detalle.producto);

  const nombreOriginal =
    limpiarTexto(detalle.nombre);

  // Prioridad:
  //
  // 1. nombre explícito
  // 2. producto
  // 3. nombre técnico generado
  //
  // producto puede permanecer null.

  const nombre =
    nombreOriginal ??
    producto ??
    generarNombreTecnico(
      anchoCm,
      altoCm,
      forma
    );


  // ====================================================
  // SALIDA DEL DETALLE
  // ====================================================

  return {
    json: {

      cotizacion_id:
        cotizacionId,

      cliente_id:
        clienteId,

      detalle_index:
        index,

      cantidad,

      // Producto no es obligatorio.
      producto,

      // Nombre sí queda resuelto para diseño.
      nombre,

      sabor:
        detalle.sabor ?? null,

      ancho_cm:
        anchoCm,

      alto_cm:
        altoCm,

      forma,

      cantidad_original:
        Number.isFinite(cantidadOriginal)
          ? cantidadOriginal
          : cantidad,

      minimo_aplicado:
        detalle.minimo_aplicado === true

    }
  };

});