// ======================================================
// N8N NODE - PEGASO
// ======================================================
// Nombre: Aplicar mínimo de impresión
// Node ID: b389417d-a3d7-4b2e-8819-255e7ba4a429
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
// APLICAR MÍNIMO DE IMPRESIÓN
// PEGASO ADHESIVOS - V2.5
// ======================================================
//
// V2.5: detalles con la misma medida y forma se unen en una
// sola línea con la cantidad total si el cliente habla de
// varios diseños (fusion_disenos); si no, se deja una.
//
// V2.4: corta la cotizacion automatica (antes de insertar
// nada) si algun detalle normalizado llega a 6000 o mas.
// La derivacion normal ocurre en "Resolver contexto
// comercial"; esto solo cubre extracciones divergentes.
//
// ======================================================

const MINIMO_IMPRESION = 1000;
const MULTIPLO_IMPRESION = 1000;
const CANTIDAD_DERIVACION_HUMANA = 6000;

const input = $input.first().json;

const detallesExtraidos = input.detalles;


// ======================================================
// V2.5: MISMA MEDIDA EN VARIOS DISEÑOS
// ======================================================
//
// "3000 etiquetas, 3 modelos diferentes, 1000 de cada una
// de 14x7" llega como 3 detalles iguales. Si el cliente
// habla de varios diseños, se cotiza UNA línea con la
// cantidad total (el precio mejora por rango) y se anota
// cuántos diseños son (fusion_disenos, lo lee "Preparar
// mensaje cotización"). Si repite la misma medida sin
// hablar de diseños (reenvío), queda una sola línea.
// Medidas distintas siguen en líneas separadas.
//
// ======================================================

let textoClienteDisenos = '';

try {
  textoClienteDisenos =
    String(
      $('Resolver contexto comercial').first().json?.mensaje_actual ?? ''
    )
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
} catch (_) {
  textoClienteDisenos = '';
}

const PALABRAS_DISENO_PLURAL =
  '(modelos|disenos|sabores|variedades|nombres|versiones|tipos|presentaciones|referencias|artes|colores|productos)';

const clienteHablaDeVariosDisenos =
  new RegExp(`\\b(\\d{1,2}|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|varios|varias|diferentes|distintos|distintas) ${PALABRAS_DISENO_PLURAL}\\b`).test(textoClienteDisenos) ||
  new RegExp(`\\b${PALABRAS_DISENO_PLURAL} (diferentes|distintos|distintas)\\b`).test(textoClienteDisenos) ||
  /\b(de|para|por) cada (una|uno|diseno|modelo|sabor|variedad|nombre)\b/.test(textoClienteDisenos) ||
  /\bcada (una|uno)\b/.test(textoClienteDisenos);

function claveMedida(d) {
  return [
    Number(d.ancho_cm),
    Number(d.alto_cm),
    String(d.forma ?? 'RECTANGULAR').toUpperCase(),
    String(d.material ?? '').toUpperCase()
  ].join('|');
}

function cantidadDetalle(d) {
  const n = Number(d.cantidad);
  return Number.isFinite(n) && n > 0 ? n : null;
}

const fusionDisenos = [];

const detalles =
  Array.isArray(detallesExtraidos)
    ? Object.values(
        detallesExtraidos.reduce((grupos, d) => {
          const clave = claveMedida(d);
          (grupos[clave] = grupos[clave] ?? []).push(d);
          return grupos;
        }, {})
      ).map(grupo => {
        if (grupo.length === 1) {
          return grupo[0];
        }

        if (!clienteHablaDeVariosDisenos) {
          // Reenvío de la misma medida: una sola línea.
          return grupo.reduce((mayor, d) =>
            (cantidadDetalle(d) ?? 0) > (cantidadDetalle(mayor) ?? 0) ? d : mayor
          );
        }

        const cantidades =
          grupo.map(d => cantidadDetalle(d) ?? MINIMO_IMPRESION);

        const total =
          cantidades.reduce((a, b) => a + b, 0);

        fusionDisenos.push({
          ancho_cm: Number(grupo[0].ancho_cm),
          alto_cm: Number(grupo[0].alto_cm),
          forma: String(grupo[0].forma ?? 'RECTANGULAR').toUpperCase(),
          disenos: grupo.length,
          cantidades_por_diseno: cantidades,
          cantidad_total: total
        });

        return {
          ...grupo[0],
          cantidad: total,
          disenos: grupo.length
        };
      })
    : detallesExtraidos;


// ======================================================
// VALIDACIÓN
// ======================================================

if (!Array.isArray(detalles)) {

  return [
    {
      json: {
        valid: false,
        error:
          'No se encontraron detalles válidos para cotización.',
        detalles: []
      }
    }
  ];

}


// ======================================================
// NORMALIZAR
// ======================================================

const detallesNormalizados =
  detalles.map((detalle) => {

    const cantidadRecibida =
      detalle.cantidad;

    const cantidadNumerica =
      Number(cantidadRecibida);


    // --------------------------------------------------
    // SIN CANTIDAD
    // --------------------------------------------------
    //
    // Pegaso no pregunta cantidad para iniciar cotización.
    // Se utiliza el mínimo determinístico de 1000.
    //
    // --------------------------------------------------

    if (
      cantidadRecibida === null ||
      cantidadRecibida === undefined ||
      cantidadRecibida === '' ||
      !Number.isFinite(cantidadNumerica) ||
      cantidadNumerica <= 0
    ) {

      return {

        ...detalle,

        cantidad_original:
          cantidadRecibida ?? null,

        cantidad:
          MINIMO_IMPRESION,

        cantidad_asumida:
          true,

        minimo_aplicado:
          true

      };

    }


    // --------------------------------------------------
    // MÍNIMO + MÚLTIPLOS DE 1000
    // --------------------------------------------------

    const cantidadFinal =
      Math.max(
        MINIMO_IMPRESION,
        Math.ceil(
          cantidadNumerica /
          MULTIPLO_IMPRESION
        ) *
        MULTIPLO_IMPRESION
      );


    const cantidadFueAjustada =
      cantidadFinal !== cantidadNumerica;


    return {

      ...detalle,

      cantidad_original:
        cantidadNumerica,

      cantidad:
        cantidadFinal,

      cantidad_asumida:
        false,

      minimo_aplicado:
        cantidadFueAjustada

    };

  });


const detallesMayoristas =
  detallesNormalizados.filter(
    d => d.cantidad >= CANTIDAD_DERIVACION_HUMANA
  );

if (detallesMayoristas.length > 0) {

  throw new Error(
    `Cotizacion automatica bloqueada: ${detallesMayoristas
      .map(d => d.cantidad)
      .join(', ')} etiquetas (${CANTIDAD_DERIVACION_HUMANA} o mas) ` +
    'requieren DERIVAR_HUMANO.'
  );

}


const minimoAplicado =
  detallesNormalizados.some(
    d => d.minimo_aplicado === true
  );


const algunaCantidadAsumida =
  detallesNormalizados.some(
    d => d.cantidad_asumida === true
  );


// ======================================================
// SALIDA
// ======================================================

return [
  {
    json: {

      valid:
        true,

      detalles:
        detallesNormalizados,

      cantidad_detalles:
        detallesNormalizados.length,

      minimo_impresion:
        MINIMO_IMPRESION,

      multiplo_impresion:
        MULTIPLO_IMPRESION,

      minimo_aplicado:
        minimoAplicado,

      cantidad_asumida:
        algunaCantidadAsumida,

      // V2.5: medidas iguales unidas por varios diseños.
      fusion_disenos:
        fusionDisenos,

      nota_minimo:
        'La cantidad mínima de impresión es de 1000 etiquetas por diseño o tamaño y trabajamos en múltiplos de 1000. Si cambia una letra o palabra ya se considera otro diseño.'

    }
  }
];
