// ======================================================
// N8N NODE - PEGASO
// ======================================================
// Nombre: Validar extracci├│n Groq
// Node ID: 0378efe8-3c60-41ab-8db0-9cd1e64aae23
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
// NODO N8N: Validar extracci├│n Groq
// PEGASO ADHESIVOS
// VERSION: 2.0
// ======================================================
//
// RESPONSABILIDAD:
//
// - Validar la salida estructurada del extractor de cotizaci├│n.
// - Detectar errores de contrato.
// - Detectar cantidades comerciales imposibles (< 1000).
// - Detectar dimensiones inv├ílidas.
// - Detectar contradicciones b├ísicas entre forma y dimensiones.
// - Comparar de forma prudente contra el mensaje actual.
// - Detectar cuando el cliente expres├│ m├║ltiples medidas y la IA
//   devolvi├│ menos detalles de los necesarios.
// - Evitar aceptar alucinaciones evidentes.
//
// IMPORTANTE:
//
// Este nodo NO:
// - calcula precios;
// - corrige detalles;
// - inventa datos;
// - decide producibilidad;
// - consulta PostgreSQL;
// - responde al cliente.
//
// Solo declara:
//   valid = true / false
//
// ======================================================


// ======================================================
// 1. INPUT
// ======================================================

const item = $input.first().json ?? {};

const output =
  item.output &&
  typeof item.output === 'object' &&
  !Array.isArray(item.output)
    ? item.output
    : null;

const detalles =
  Array.isArray(output?.detalles)
    ? output.detalles
    : null;


// ======================================================
// 2. HELPERS
// ======================================================

function texto(valor) {
  if (
    valor === undefined ||
    valor === null
  ) {
    return null;
  }

  const limpio =
    String(valor)
      .replace(/\s+/g, ' ')
      .trim();

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

  const n = Number(valor);

  return Number.isFinite(n)
    ? n
    : null;
}


function normalizarTexto(valor) {
  const t =
    texto(valor);

  if (!t) {
    return '';
  }

  return t
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}


function casiIgual(a, b, tolerancia = 0.01) {
  const na = numero(a);
  const nb = numero(b);

  if (
    na === null ||
    nb === null
  ) {
    return false;
  }

  return Math.abs(na - nb) <= tolerancia;
}


function claveMedida(ancho, alto) {
  const a = numero(ancho);
  const h = numero(alto);

  if (
    a === null ||
    h === null
  ) {
    return null;
  }

  return `${a}x${h}`;
}


// ======================================================
// 3. OBTENER MENSAJE ACTUAL
// ======================================================
//
// Priorizamos Resolver contexto comercial porque es
// precisamente la entrada utilizada por el extractor.
//
// ======================================================

let contexto = {};

try {
  contexto =
    $('Resolver contexto comercial')
      .first()
      .json ?? {};
} catch (_) {
  contexto = {};
}


const mensajeActual =
  texto(
    contexto.mensaje_actual ??
    contexto.turno_texto ??
    null
  ) ?? '';

const mensajeNormalizado =
  normalizarTexto(mensajeActual);


// ======================================================
// 4. EXTRAER MEDIDAS EXPL├ìCITAS DEL MENSAJE
// ======================================================
//
// Soporta:
// 8x11
// 8 x 11
// 8 por 11
// 8,5 x 10
// 8 de ancho por 11 de alto
//
// Esto NO pretende entender toda la conversaci├│n.
// Solo detectar medidas expl├¡citas para evitar que la IA
// devuelva datos completamente diferentes.
//
// ======================================================

function extraerMedidasExplicitas(textoEntrada) {
  const resultado = [];

  if (!textoEntrada) {
    return resultado;
  }

  const limpio =
    textoEntrada
      .replace(/,/g, '.')
      .toLowerCase();

  // --------------------------------------------------
  // Caso expl├¡cito:
  // "11 de alto por 8 de ancho"
  // "8 de ancho por 11 de alto"
  // --------------------------------------------------

  const regexEtiquetado =
    /(\d+(?:\.\d+)?)\s*(?:cm|centimetros?|cent├¡metros?)?\s*de\s*(ancho|alto)\s*(?:por|x)\s*(\d+(?:\.\d+)?)\s*(?:cm|centimetros?|cent├¡metros?)?\s*de\s*(ancho|alto)/gi;

  let match;

  while (
    (match = regexEtiquetado.exec(limpio)) !== null
  ) {
    const valor1 = Number(match[1]);
    const tipo1 = match[2];
    const valor2 = Number(match[3]);
    const tipo2 = match[4];

    let ancho = null;
    let alto = null;

    if (tipo1 === 'ancho') {
      ancho = valor1;
    }

    if (tipo1 === 'alto') {
      alto = valor1;
    }

    if (tipo2 === 'ancho') {
      ancho = valor2;
    }

    if (tipo2 === 'alto') {
      alto = valor2;
    }

    if (
      Number.isFinite(ancho) &&
      Number.isFinite(alto)
    ) {
      resultado.push({
        ancho_cm: ancho,
        alto_cm: alto
      });
    }
  }

  // --------------------------------------------------
  // Caso com├║n:
  // 8x11
  // 8 x 11
  // 8 por 11
  // --------------------------------------------------

  const regexComun =
    /(\d+(?:\.\d+)?)\s*(?:cm|centimetros?|cent├¡metros?)?\s*(?:x|por)\s*(\d+(?:\.\d+)?)\s*(?:cm|centimetros?|cent├¡metros?)?/gi;

  while (
    (match = regexComun.exec(limpio)) !== null
  ) {
    const ancho = Number(match[1]);
    const alto = Number(match[2]);

    if (
      !Number.isFinite(ancho) ||
      !Number.isFinite(alto)
    ) {
      continue;
    }

    const yaExiste =
      resultado.some(m =>
        casiIgual(m.ancho_cm, ancho) &&
        casiIgual(m.alto_cm, alto)
      );

    if (!yaExiste) {
      resultado.push({
        ancho_cm: ancho,
        alto_cm: alto
      });
    }
  }

  return resultado;
}


const medidasExplicitas =
  extraerMedidasExplicitas(
    mensajeActual
  );


// ======================================================
// 5. FORMAS PERMITIDAS
// ======================================================

const formasPermitidas = [
  'RECTANGULAR',
  'CUADRADA',
  'CIRCULAR',
  'IRREGULAR',
  'NO_ESPECIFICADA',
  null
];


// ======================================================
// 6. VALIDACI├ôN
// ======================================================

let valid = true;
let reason = null;


// ------------------------------------------------------
// 6.1 Debe existir output
// ------------------------------------------------------

if (!output) {
  valid = false;

  reason =
    'La IA no devolvi├│ un objeto output v├ílido.';
}


// ------------------------------------------------------
// 6.2 Debe existir detalles[]
// ------------------------------------------------------

else if (!Array.isArray(detalles)) {
  valid = false;

  reason =
    'El campo detalles no existe o no es un array.';
}


// ------------------------------------------------------
// 6.3 No debe estar vac├¡o
// ------------------------------------------------------

else if (detalles.length === 0) {
  valid = false;

  reason =
    'La IA devolvi├│ detalles vac├¡o.';
}


// ------------------------------------------------------
// 6.4 L├¡mite de seguridad
// ------------------------------------------------------

else if (detalles.length > 10) {
  valid = false;

  reason =
    'La IA devolvi├│ demasiados detalles de cotizaci├│n.';
}


// ------------------------------------------------------
// 6.5 Validar cada detalle
// ------------------------------------------------------

else {

  for (
    let i = 0;
    i < detalles.length;
    i++
  ) {

    const d =
      detalles[i];

    const numeroDetalle =
      i + 1;


    // ----------------------------------------------
    // Debe ser objeto
    // ----------------------------------------------

    if (
      !d ||
      typeof d !== 'object' ||
      Array.isArray(d)
    ) {
      valid = false;

      reason =
        `El detalle ${numeroDetalle} no es un objeto v├ílido.`;

      break;
    }


    // ----------------------------------------------
    // CAMPOS OBLIGATORIOS
    // ----------------------------------------------

    const camposObligatorios = [
      'cantidad',
      'producto',
      'nombre',
      'sabor',
      'ancho_cm',
      'alto_cm',
      'forma'
    ];

    for (const campo of camposObligatorios) {
      if (!(campo in d)) {
        valid = false;

        reason =
          `Falta el campo obligatorio "${campo}" en el detalle ${numeroDetalle}.`;

        break;
      }
    }

    if (!valid) {
      break;
    }


    // ----------------------------------------------
    // CANTIDAD
    // ----------------------------------------------

    if (
      d.cantidad !== null &&
      typeof d.cantidad !== 'number'
    ) {
      valid = false;

      reason =
        `La cantidad del detalle ${numeroDetalle} no es num├®rica.`;

      break;
    }


    if (
      typeof d.cantidad === 'number' &&
      (
        !Number.isFinite(d.cantidad) ||
        !Number.isInteger(d.cantidad)
      )
    ) {
      valid = false;

      reason =
        `La cantidad del detalle ${numeroDetalle} debe ser un n├║mero entero.`;

      break;
    }


    if (
      typeof d.cantidad === 'number' &&
      d.cantidad < 1000
    ) {
      valid = false;

      reason =
        `La cantidad del detalle ${numeroDetalle} es menor al m├¡nimo comercial de 1000.`;

      break;
    }


    // ----------------------------------------------
    // PRODUCTO
    // ----------------------------------------------

    if (
      d.producto !== null &&
      typeof d.producto !== 'string'
    ) {
      valid = false;

      reason =
        `El producto del detalle ${numeroDetalle} no es texto.`;

      break;
    }


    // ----------------------------------------------
    // NOMBRE
    // ----------------------------------------------

    if (
      d.nombre !== null &&
      typeof d.nombre !== 'string'
    ) {
      valid = false;

      reason =
        `El nombre del detalle ${numeroDetalle} no es texto.`;

      break;
    }


    // ----------------------------------------------
    // SABOR
    // ----------------------------------------------

    if (
      d.sabor !== null &&
      typeof d.sabor !== 'string'
    ) {
      valid = false;

      reason =
        `El sabor del detalle ${numeroDetalle} no es texto.`;

      break;
    }


    // ----------------------------------------------
    // ANCHO
    // ----------------------------------------------

    if (
      d.ancho_cm !== null &&
      typeof d.ancho_cm !== 'number'
    ) {
      valid = false;

      reason =
        `El ancho_cm del detalle ${numeroDetalle} no es num├®rico.`;

      break;
    }


    if (
      typeof d.ancho_cm === 'number' &&
      (
        !Number.isFinite(d.ancho_cm) ||
        d.ancho_cm <= 0
      )
    ) {
      valid = false;

      reason =
        `El ancho_cm del detalle ${numeroDetalle} debe ser mayor a 0.`;

      break;
    }


    // ----------------------------------------------
    // ALTO
    // ----------------------------------------------

    if (
      d.alto_cm !== null &&
      typeof d.alto_cm !== 'number'
    ) {
      valid = false;

      reason =
        `El alto_cm del detalle ${numeroDetalle} no es num├®rico.`;

      break;
    }


    if (
      typeof d.alto_cm === 'number' &&
      (
        !Number.isFinite(d.alto_cm) ||
        d.alto_cm <= 0
      )
    ) {
      valid = false;

      reason =
        `El alto_cm del detalle ${numeroDetalle} debe ser mayor a 0.`;

      break;
    }


    // ----------------------------------------------
    // FORMA
    // ----------------------------------------------

    if (
      !formasPermitidas.includes(d.forma)
    ) {
      valid = false;

      reason =
        `La forma del detalle ${numeroDetalle} no es v├ílida.`;

      break;
    }


    // ----------------------------------------------
    // CONSISTENCIA RECTANGULAR / CUADRADA
    // ----------------------------------------------
    //
    // No hacemos esto para CIRCULAR porque 8x8 circular
    // es perfectamente v├ílido.
    //
    // ----------------------------------------------

    if (
      typeof d.ancho_cm === 'number' &&
      typeof d.alto_cm === 'number'
    ) {

      if (
        d.forma === 'CUADRADA' &&
        !casiIgual(
          d.ancho_cm,
          d.alto_cm
        )
      ) {
        valid = false;

        reason =
          `El detalle ${numeroDetalle} est├í marcado como CUADRADA pero ancho_cm y alto_cm son diferentes.`;

        break;
      }

      if (
        d.forma === 'RECTANGULAR' &&
        casiIgual(
          d.ancho_cm,
          d.alto_cm
        )
      ) {

        // Permitimos rectangular cuadrada f├¡sicamente,
        // porque comercialmente podr├¡a existir un troquel
        // rectangular de lados iguales.
        //
        // Por tanto NO invalidamos.
      }
    }


    // ----------------------------------------------
    // ALUCINACI├ôN B├üSICA EN NOMBRE / SABOR
    // ----------------------------------------------
    //
    // Si nombre o sabor vienen informados pero NO aparecen
    // en el mensaje actual ni existe contexto que los respalde,
    // es sospechoso.
    //
    // No invalidamos producto aqu├¡ porque puede venir de la
    // memoria comercial previa.
    //
    // ----------------------------------------------

    for (const campo of ['nombre', 'sabor']) {

      const valor =
        texto(d[campo]);

      if (!valor) {
        continue;
      }

      const valorNormalizado =
        normalizarTexto(valor);

      const apareceEnMensaje =
        valorNormalizado !== '' &&
        mensajeNormalizado.includes(
          valorNormalizado
        );

      // Recuperamos contexto comercial completo para ver
      // si realmente estaba previamente guardado.

      const contextoTexto =
        normalizarTexto(
          JSON.stringify(
            contexto.contexto_comercial ?? {}
          )
        );

      const apareceEnContexto =
        valorNormalizado !== '' &&
        contextoTexto.includes(
          valorNormalizado
        );

      if (
        !apareceEnMensaje &&
        !apareceEnContexto
      ) {
        valid = false;

        reason =
          `El campo ${campo} del detalle ${numeroDetalle} contiene informaci├│n no respaldada por el mensaje ni por el contexto.`;

        break;
      }
    }

    if (!valid) {
      break;
    }
  }
}


// ======================================================
// 7. VALIDAR COBERTURA DE MEDIDAS EXPL├ìCITAS
// ======================================================
//
// Si el cliente escribi├│ expl├¡citamente:
// 8x11 y 8x8
//
// el extractor no puede devolver solo una.
//
// Solo aplicamos esta regla cuando encontramos
// dos o m├ís pares expl├¡citos en el mensaje.
//
// ======================================================

if (
  valid &&
  medidasExplicitas.length >= 2
) {

  const medidasExtraidas =
    detalles
      .map(d => ({
        ancho_cm:
          numero(d.ancho_cm),

        alto_cm:
          numero(d.alto_cm)
      }))
      .filter(m =>
        m.ancho_cm !== null &&
        m.alto_cm !== null
      );


  for (const medidaEsperada of medidasExplicitas) {

    const encontrada =
      medidasExtraidas.some(m =>
        casiIgual(
          m.ancho_cm,
          medidaEsperada.ancho_cm
        ) &&
        casiIgual(
          m.alto_cm,
          medidaEsperada.alto_cm
        )
      );

    if (!encontrada) {
      valid = false;

      reason =
        `El cliente indic├│ expl├¡citamente la medida ${claveMedida(
          medidaEsperada.ancho_cm,
          medidaEsperada.alto_cm
        )}, pero el extractor no la incluy├│ en detalles.`;

      break;
    }
  }
}


// ======================================================
// 8. DETECTAR POSIBLE REDUCCI├ôN DE PEDIDO M├ÜLTIPLE
// ======================================================
//
// Cuando existen dos o m├ís medidas expl├¡citas,
// esperamos al menos tantos detalles como medidas
// distintas.
//
// ======================================================

if (
  valid &&
  medidasExplicitas.length >= 2 &&
  detalles.length < medidasExplicitas.length
) {
  valid = false;

  reason =
    `El mensaje contiene ${medidasExplicitas.length} medidas expl├¡citas, pero el extractor devolvi├│ solo ${detalles.length} detalle(s).`;
}


// ======================================================
// 9. SALIDA
// ======================================================

return [
  {
    json: {

      valid,

      reason,

      detalles:
        valid
          ? detalles
          : [],

      cantidad_detalles:
        Array.isArray(detalles)
          ? detalles.length
          : 0,

      medidas_explicitas_mensaje:
        medidasExplicitas,

      cantidad_medidas_explicitas:
        medidasExplicitas.length,

      validado_at:
        new Date().toISOString()
    }
  }
];
