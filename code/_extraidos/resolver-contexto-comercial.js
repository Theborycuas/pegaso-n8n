// ======================================================
// N8N NODE - PEGASO
// ======================================================
// Nombre: Resolver contexto comercial
// Node ID: 2453472a-9d65-46d2-9a67-b788aac2fd36
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
// RESOLVER CONTEXTO COMERCIAL - V2.4
// ======================================================
//
// Objetivo:
// - consolidar datos nuevos + contexto persistido;
// - usar 1000 como mínimo por defecto si hay medidas;
// - NO exigir producto para cotizar;
// - NO convertir cualquier mensaje en COTIZAR_P4;
// - preservar acciones informativas como INFORMAR_DISENO;
// - recotizar solo cuando corresponde;
// - tratar ancho + alto como un par atómico cuando ambos vienen en el turno actual;
// - invalidar metadatos de una cotización anterior cuando cambian sus datos base,
//   evitando snapshots híbridos (por ejemplo id/precio viejos con medidas nuevas).
// - V2.4: cantidad cotizable >= 6000 -> DERIVAR_HUMANO (COTIZACION_ESPECIAL)
//   antes de COTIZAR_P4; la IA no puede revertirlo.
//
// ======================================================

const data = $input.first().json;


// ======================================================
// 1. HELPERS
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


function objeto(valor) {
  if (
    valor &&
    typeof valor === 'object' &&
    !Array.isArray(valor)
  ) {
    return valor;
  }

  if (typeof valor === 'string') {
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
    } catch (_) {
      // Ignorar
    }
  }

  return {};
}


function igualesNumero(a, b) {
  const na = numero(a);
  const nb = numero(b);

  if (na === null || nb === null) {
    return false;
  }

  return Math.abs(na - nb) < 0.000001;
}


// ======================================================
// 2. RECUPERAR CONTEXTO ANTERIOR
// ======================================================

let contextoAnterior = {};

try {
  const contextoIA =
    $('Preparar contexto IA').first().json;

  contextoAnterior =
    objeto(
      contextoIA.contexto_comercial
    );
} catch (_) {
  contextoAnterior = {};
}


const cotizacionAnterior =
  objeto(
    contextoAnterior.cotizacion
  );


// ======================================================
// 3. DATOS ANTERIORES
// ======================================================

const productoAnterior =
  texto(
    cotizacionAnterior.producto
  );

const materialAnterior =
  texto(
    cotizacionAnterior.material
  );

const cantidadAnterior =
  numero(
    cotizacionAnterior.cantidad_solicitada ??
    cotizacionAnterior.cantidad
  );

const anchoAnterior =
  numero(
    cotizacionAnterior.ancho_cm
  );

const altoAnterior =
  numero(
    cotizacionAnterior.alto_cm
  );

const formaAnterior =
  texto(
    cotizacionAnterior.forma
  );


// ======================================================
// 4. DATOS EXPLÍCITOS DEL MENSAJE ACTUAL
// ======================================================

const productoActual =
  texto(data.producto);

const materialActual =
  texto(data.material);

const cantidadActual =
  numero(data.cantidad);

const anchoActual =
  numero(data.ancho_cm);

const altoActual =
  numero(data.alto_cm);

let formaActual =
  texto(data.forma);

if (
  formaActual === 'NO_ESPECIFICADA'
) {
  formaActual = null;
}


// ======================================================
// 5. CONSOLIDAR DATOS
// ======================================================

const producto =
  productoActual ??
  productoAnterior;

const material =
  materialActual ??
  materialAnterior;

let cantidadSolicitada =
  cantidadActual ??
  cantidadAnterior;

// ------------------------------------------------------
// REGLA ATÓMICA DE MEDIDAS
// ------------------------------------------------------
//
// Si el mensaje actual trae LAS DOS medidas, ambas
// reemplazan juntas al par anterior.
//
// Esto evita estados híbridos:
//
// anterior: 7 x 12
// actual:   8 x 11
// incorrecto: 7 x 11
// correcto:   8 x 11
//
// Si el mensaje actual trae solo UNA medida explícita,
// sí permitimos conservar la otra anterior, porque puede
// ser una corrección parcial legítima.
// ------------------------------------------------------

const medidasActualesCompletas =
  data.medidas_actuales_completas === true ||
  (
    anchoActual !== null &&
    altoActual !== null
  );

let anchoCm = null;
let altoCm = null;

if (medidasActualesCompletas) {
  anchoCm = anchoActual;
  altoCm = altoActual;
} else {
  anchoCm =
    anchoActual ??
    anchoAnterior;

  altoCm =
    altoActual ??
    altoAnterior;
}

let forma =
  formaActual ??
  formaAnterior ??
  'NO_ESPECIFICADA';


// ======================================================
// 6. FORMA DERIVADA
// ======================================================

if (
  forma === 'NO_ESPECIFICADA' &&
  anchoCm !== null &&
  altoCm !== null
) {
  forma =
    anchoCm === altoCm
      ? 'RECTANGULAR'
      : 'RECTANGULAR';
}


// ======================================================
// 7. CANTIDAD POR DEFECTO
// ======================================================
//
// Si ya tenemos medidas y el cliente no indicó cantidad,
// trabajamos con el mínimo comercial de 1000.
//
// NO se pregunta cantidad.
//
// ======================================================

let cantidadAsumida = false;

if (
  cantidadSolicitada === null &&
  anchoCm !== null &&
  altoCm !== null
) {
  cantidadSolicitada = 1000;
  cantidadAsumida = true;
}


// ======================================================
// 8. NORMALIZAR CANTIDAD IMPRIMIBLE
// ======================================================

let cantidadCotizable = null;
let cantidadAjustada = false;

if (
  cantidadSolicitada !== null &&
  cantidadSolicitada > 0
) {
  cantidadCotizable =
    Math.max(
      1000,
      Math.ceil(
        cantidadSolicitada / 1000
      ) * 1000
    );

  cantidadAjustada =
    cantidadCotizable !== cantidadSolicitada;
}


// ======================================================
// 9. DETECTAR CAMBIOS REALES DE COTIZACIÓN
// ======================================================

const modificoCantidad =
  cantidadActual !== null &&
  (
    cantidadAnterior === null ||
    !igualesNumero(
      cantidadActual,
      cantidadAnterior
    )
  );

const modificoAncho =
  anchoActual !== null &&
  (
    anchoAnterior === null ||
    !igualesNumero(
      anchoActual,
      anchoAnterior
    )
  );

const modificoAlto =
  altoActual !== null &&
  (
    altoAnterior === null ||
    !igualesNumero(
      altoActual,
      altoAnterior
    )
  );

const modificoForma =
  formaActual !== null &&
  (
    !formaAnterior ||
    formaActual !== formaAnterior
  );

const modificoParMedidas =
  medidasActualesCompletas &&
  (
    anchoAnterior === null ||
    altoAnterior === null ||
    !igualesNumero(
      anchoCm,
      anchoAnterior
    ) ||
    !igualesNumero(
      altoCm,
      altoAnterior
    )
  );

const modificoDatosCotizacion =
  modificoCantidad ||
  modificoAncho ||
  modificoAlto ||
  modificoForma ||
  modificoParMedidas;


// ======================================================
// 10. DATOS SUFICIENTES
// ======================================================

const faltaMedidas =
  anchoCm === null ||
  altoCm === null;

const datosSuficientes =
  !faltaMedidas &&
  cantidadCotizable !== null;


// ======================================================
// 11. RESOLVER ACCIÓN REAL
// ======================================================

const accionIA =
  texto(data.accion) ??
  'RESPONDER_GENERAL';

const intencion =
  texto(data.intencion) ??
  'OTRO';

let accion =
  accionIA;


// ------------------------------------------------------
// A. HUMANO SIEMPRE SE RESPETA
// ------------------------------------------------------

if (
  data.requiere_humano === true ||
  accionIA === 'DERIVAR_HUMANO'
) {
  accion =
    'DERIVAR_HUMANO';
}


// ------------------------------------------------------
// B. ACCIONES INFORMATIVAS SE RESPETAN
// ------------------------------------------------------
//
// Esta es la corrección clave:
// una pregunta de diseño, material, pago, ubicación, etc.
// NO puede convertirse en cotización solamente porque
// ya existan medidas previas.
//
// ------------------------------------------------------

else if (
  [
    'INFORMAR_MATERIAL',
    'INFORMAR_MINIMO',
    'INFORMAR_UBICACION',
    'INFORMAR_METODOLOGIA',
    'INFORMAR_METODOLOGIA_PAGO',
    'INFORMAR_ENTREGA',
    'INFORMAR_DISENO',
    'REGISTRAR_ACEPTACION',
    'RESPONDER_GENERAL'
  ].includes(accionIA)
) {
  accion =
    accionIA;
}


// ------------------------------------------------------
// C. SI QUIERE COTIZAR Y FALTAN MEDIDAS
// ------------------------------------------------------

else if (
  faltaMedidas &&
  [
    'SOLICITAR_COTIZACION',
    'CONSULTAR_PRECIO',
    'APORTAR_DATOS'
  ].includes(intencion)
) {
  accion =
    'PEDIR_MEDIDAS';
}


// ------------------------------------------------------
// D. COTIZACIÓN INICIAL
// ------------------------------------------------------

else if (
  datosSuficientes &&
  [
    'SOLICITAR_COTIZACION',
    'CONSULTAR_PRECIO'
  ].includes(intencion)
) {
  accion =
    'COTIZAR_P4';
}


// ------------------------------------------------------
// E. MODIFICACIÓN DE UNA COTIZACIÓN
// ------------------------------------------------------

else if (
  datosSuficientes &&
  intencion === 'APORTAR_DATOS' &&
  modificoDatosCotizacion
) {
  accion =
    'COTIZAR_P4';
}


// ------------------------------------------------------
// F. SI LA IA YA DECIDIÓ COTIZAR
// ------------------------------------------------------

else if (
  datosSuficientes &&
  accionIA === 'COTIZAR_P4'
) {
  accion =
    'COTIZAR_P4';
}


// ------------------------------------------------------
// G. PROTECCIÓN: NO PEDIR PRODUCTO PARA P4
// ------------------------------------------------------

else if (
  accionIA === 'PEDIR_PRODUCTO'
) {
  accion =
    faltaMedidas
      ? 'PEDIR_MEDIDAS'
      : 'COTIZAR_P4';
}


// ------------------------------------------------------
// H. CANTIDAD MAYORISTA -> HUMANO
// ------------------------------------------------------
//
// Desde 6000 etiquetas (ya normalizadas a multiplos de
// 1000) no existe precio automatico. Tiene prioridad
// sobre COTIZAR_P4 y sobre pedir datos de cotizacion,
// para que nunca se entre al extractor ni al calculo.
//
// Si la IA ya derivo por otro motivo, se respeta ese
// motivo. Las acciones informativas sin cantidad nueva
// en este turno se conservan.
//
// ------------------------------------------------------

const CANTIDAD_DERIVACION_HUMANA = 6000;

const ACCIONES_RUTA_COTIZACION = [
  'COTIZAR_P4',
  'PEDIR_MEDIDAS',
  'PEDIR_CANTIDAD',
  'PEDIR_PRODUCTO',
  'PEDIR_FORMA'
];

const INTENCIONES_PRECIO = [
  'SOLICITAR_COTIZACION',
  'CONSULTAR_PRECIO',
  'APORTAR_DATOS'
];

const cantidadMayorista =
  cantidadCotizable !== null &&
  cantidadCotizable >=
    CANTIDAD_DERIVACION_HUMANA;

const derivacionPorCantidad =
  cantidadMayorista &&
  accion !== 'DERIVAR_HUMANO' &&
  (
    ACCIONES_RUTA_COTIZACION.includes(accion) ||
    (
      cantidadActual !== null &&
      INTENCIONES_PRECIO.includes(intencion)
    )
  );

if (derivacionPorCantidad) {
  accion =
    'DERIVAR_HUMANO';
}


// ======================================================
// 12. RESPUESTA SUGERIDA
// ======================================================

let respuestaSugerida =
  texto(
    data.respuesta_sugerida
  ) ?? '';

if (
  accion === 'PEDIR_MEDIDAS'
) {
  respuestaSugerida =
    '¿En qué medidas necesita sus etiquetas? Indíquenos ancho y alto por favor.';
}

else if (
  accion === 'COTIZAR_P4' ||
  derivacionPorCantidad
) {
  respuestaSugerida =
    '';
}


// ======================================================
// 13. CONTEXTO COMERCIAL NUEVO
// ======================================================

// ------------------------------------------------------
// INVALIDAR RESULTADO DE COTIZACIÓN ANTERIOR SI CAMBIARON
// SUS DATOS BASE
// ------------------------------------------------------
//
// El objeto contexto_comercial.cotizacion funciona como
// snapshot de la cotización vigente.
//
// Si cambia cantidad, medidas o forma, ya no podemos
// conservar como vigentes:
//
// - id / cotizacion_id
// - total / precio_total
// - estado
// - cotizada_at
// - flags de producibilidad del intento anterior
//
// Esos datos serán escritos nuevamente por la ruta real
// de cotización cuando termine el cálculo.
// ------------------------------------------------------

const cotizacionBaseNueva =
  modificoDatosCotizacion
    ? {
        ...cotizacionAnterior,

        id: null,
        cotizacion_id: null,

        existe: false,

        estado: null,

        total: null,
        precio_total: null,
        moneda:
          cotizacionAnterior.moneda ??
          'USD',

        cotizada_at: null,

        cantidad_detalles: null,

        producible: null,
        restriccion_codigo: null,
        restriccion_tipo: null,

        ultimo_error_produccion: null,
        ultimo_intento_producible: null
      }
    : {
        ...cotizacionAnterior
      };

const contextoComercialNuevo = {
  ...contextoAnterior,

  cotizacion: {
    ...cotizacionBaseNueva,

    producto,
    material,

    cantidad_solicitada:
      cantidadSolicitada,

    cantidad_cotizable:
      cantidadCotizable,

    cantidad_ajustada:
      cantidadAjustada,

    cantidad_asumida:
      cantidadAsumida,

    ancho_cm:
      anchoCm,

    alto_cm:
      altoCm,

    forma
  }
};


// ======================================================
// 14. SALIDA
// ======================================================

return [
  {
    json: {
      ...data,

      producto,
      material,

      cantidad_solicitada:
        cantidadSolicitada,

      cantidad_cotizable:
        cantidadCotizable,

      cantidad_ajustada:
        cantidadAjustada,

      cantidad_asumida:
        cantidadAsumida,

      cantidad:
        cantidadCotizable,

      ancho_cm:
        anchoCm,

      alto_cm:
        altoCm,

      forma,

      modifico_datos_cotizacion:
        modificoDatosCotizacion,

      modifico_par_medidas:
        modificoParMedidas,

      medidas_actuales_completas:
        medidasActualesCompletas,

      accion,

      ...(
        derivacionPorCantidad
          ? {
              requiere_humano:
                true,

              motivo_derivacion:
                'COTIZACION_ESPECIAL',

              requiere_notificacion:
                true,

              regla_derivacion:
                'CANTIDAD_MAYORISTA'
            }
          : {}
      ),

      derivacion_por_cantidad:
        derivacionPorCantidad,

      datos_suficientes_para_cotizar:
        datosSuficientes,

      respuesta_sugerida:
        respuestaSugerida,

      contexto_comercial:
        contextoComercialNuevo
    }
  }
];
