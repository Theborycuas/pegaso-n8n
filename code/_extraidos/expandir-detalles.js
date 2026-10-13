// ======================================================
// N8N NODE - PEGASO
// ======================================================
// Nombre: EXPANDIR DETALLES
// Node ID: dd0638d2-f68d-491c-967c-e30a16fbdfa7
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
// EXPANDIR DETALLES
// ======================================================
//
// Entrada directa:
//   "EDT Datos del detalle"
//   - cotizacion_id
//   - cliente_id
//
// Detalles comerciales:
//   "Preparar datos cotizaci├│n"
//   - detalles[]
//
// Salida:
//   1 item por cada detalle de la cotizaci├│n
//
// IMPORTANTE:
//   producto NO es obligatorio.
//   Si nombre y producto vienen vac├¡os, se genera un
//   nombre t├®cnico usando medidas + forma.
//
// Ejemplo:
//   5x5 + CIRCULAR
//   -> "Etiqueta 5x5 cm circular"
// ======================================================


// ======================================================
// 1. DATOS DE LA COTIZACI├ôN
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
    $('Preparar datos cotizaci├│n').first().json ?? {};
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
  // VALIDACI├ôN DEL DETALLE
  // ====================================================

  if (
    !Number.isFinite(cantidad) ||
    cantidad <= 0
  ) {
    throw new Error(
      `EXPANDIR DETALLES: cantidad inv├ílida en detalle ${index}.`
    );
  }

  if (
    !Number.isFinite(anchoCm) ||
    anchoCm <= 0
  ) {
    throw new Error(
      `EXPANDIR DETALLES: ancho_cm inv├ílido en detalle ${index}.`
    );
  }

  if (
    !Number.isFinite(altoCm) ||
    altoCm <= 0
  ) {
    throw new Error(
      `EXPANDIR DETALLES: alto_cm inv├ílido en detalle ${index}.`
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
  // 1. nombre expl├¡cito
  // 2. producto
  // 3. nombre t├®cnico generado
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

      // Nombre s├¡ queda resuelto para dise├▒o.
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
