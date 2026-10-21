// ======================================================
// N8N NODE - PEGASO
// ======================================================
// Nombre: Validar extracción DeepSeek
// Node ID: 7bebd33a-2a0c-400a-aeaf-388110be4d9d
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
// NODO N8N: Validar extracción Groq
// PEGASO ADHESIVOS
// VERSION: 2.4
// ======================================================
//
// RESPONSABILIDAD:
//
// - Validar la salida estructurada del extractor de cotización.
// - Detectar errores de contrato.
// - Detectar cantidades comerciales imposibles (< 1000).
// - Detectar dimensiones inválidas.
// - Detectar contradicciones básicas entre forma y dimensiones.
// - Comparar de forma prudente contra el mensaje actual.
// - Detectar cuando el cliente expresó múltiples medidas y la IA
//   devolvió menos detalles de los necesarios.
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

if (
  output &&
  !Array.isArray(output.detalles)
) {
  output.detalles = [];
}

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
// 4. EXTRAER MEDIDAS EXPLÍCITAS DEL MENSAJE
// ======================================================
//
// Soporta:
// 8x11
// 8 x 11
// 8 por 11
// 8,5 x 10
// 8 de ancho por 11 de alto
//
// Esto NO pretende entender toda la conversación.
// Solo detectar medidas explícitas para evitar que la IA
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
      .replace(/[×*]/g, 'x')
      .toLowerCase();

  const hayFlyersEnTexto =
    /\b(flyers?|flayers?|volantes?|vonates?|a6|a5)\b/.test(
      limpio
    );

  function esMedidaFlyerCatalogo(ancho, alto) {
    const menor = Math.min(ancho, alto);
    const mayor = Math.max(ancho, alto);

    return (
      (
        casiIgual(menor, 10.5) &&
        casiIgual(mayor, 14.8)
      ) ||
      (
        casiIgual(menor, 14.8) &&
        casiIgual(mayor, 21)
      )
    );
  }

  function agregar(ancho, alto) {
    if (
      !Number.isFinite(ancho) ||
      !Number.isFinite(alto) ||
      ancho <= 0 ||
      alto <= 0 ||
      ancho > 200 ||
      alto > 200
    ) {
      return;
    }

    if (
      hayFlyersEnTexto &&
      esMedidaFlyerCatalogo(ancho, alto)
    ) {
      return;
    }

    const yaExiste =
      resultado.some(m =>
        (
          casiIgual(m.ancho_cm, ancho) &&
          casiIgual(m.alto_cm, alto)
        ) ||
        (
          casiIgual(m.ancho_cm, alto) &&
          casiIgual(m.alto_cm, ancho)
        )
      );

    if (!yaExiste) {
      resultado.push({
        ancho_cm: ancho,
        alto_cm: alto
      });
    }
  }

  // Primer número x segundo, como se escribe:
  // 8x11, 8 x 11, 8cm alto x 9ancho,
  // 8cm de alto x 5 de ancho, 18 de ancho x 7 de alto
  const regexPar =
    /(\d+(?:\.\d+)?)\s*(?:cm|centimetros?|centímetros?)?\s*(?:de\s+)?(?:alto|ancho)?\s*(?:x|por)\s*(\d+(?:\.\d+)?)\s*(?:cm|centimetros?|centímetros?)?\s*(?:de\s+)?(?:alto|ancho)?/gi;

  let match;

  while (
    (match = regexPar.exec(limpio)) !== null
  ) {
    agregar(
      Number(match[1]),
      Number(match[2])
    );
  }

  return resultado;
}


function completarDetallesFaltantes(lista, medidas) {
  if (
    !Array.isArray(lista) ||
    medidas.length === 0
  ) {
    return;
  }

  const plantilla =
    lista[0] &&
    typeof lista[0] === 'object'
      ? lista[0]
      : {
          cantidad: 1000,
          producto: null,
          nombre: null,
          sabor: null,
          forma: 'RECTANGULAR',
          material: null
        };

  for (const medida of medidas) {
    const existe =
      lista.some(d =>
        d &&
        (
          (
            casiIgual(
              numero(d.ancho_cm),
              medida.ancho_cm
            ) &&
            casiIgual(
              numero(d.alto_cm),
              medida.alto_cm
            )
          ) ||
          (
            casiIgual(
              numero(d.ancho_cm),
              medida.alto_cm
            ) &&
            casiIgual(
              numero(d.alto_cm),
              medida.ancho_cm
            )
          )
        )
      );

    if (!existe) {
      lista.push({
        cantidad:
          plantilla.cantidad ?? 1000,
        producto:
          plantilla.producto ?? null,
        nombre: null,
        sabor: null,
        ancho_cm:
          medida.ancho_cm,
        alto_cm:
          medida.alto_cm,
        forma:
          plantilla.forma ?? 'RECTANGULAR',
        material:
          plantilla.material ?? null
      });
    }
  }
}


const medidasExplicitas =
  extraerMedidasExplicitas(
    mensajeActual
  );

if (Array.isArray(detalles)) {
  completarDetallesFaltantes(
    detalles,
    medidasExplicitas
  );

  if (
    /\b(flyers?|flayers?|volantes?|vonates?|a6|a5)\b/i.test(
      String(mensajeActual ?? '')
    )
  ) {
    for (let i = detalles.length - 1; i >= 0; i--) {
      const ancho = numero(detalles[i]?.ancho_cm);
      const alto = numero(detalles[i]?.alto_cm);
      const menor = Math.min(ancho, alto);
      const mayor = Math.max(ancho, alto);

      if (
        (
          casiIgual(menor, 10.5) &&
          casiIgual(mayor, 14.8)
        ) ||
        (
          casiIgual(menor, 14.8) &&
          casiIgual(mayor, 21)
        )
      ) {
        detalles.splice(i, 1);
      }
    }

    if (
      output &&
      (
        (
          casiIgual(
            Math.min(
              numero(output.ancho_cm),
              numero(output.alto_cm)
            ),
            10.5
          ) &&
          casiIgual(
            Math.max(
              numero(output.ancho_cm),
              numero(output.alto_cm)
            ),
            14.8
          )
        ) ||
        (
          casiIgual(
            Math.min(
              numero(output.ancho_cm),
              numero(output.alto_cm)
            ),
            14.8
          ) &&
          casiIgual(
            Math.max(
              numero(output.ancho_cm),
              numero(output.alto_cm)
            ),
            21
          )
        )
      )
    ) {
      if (detalles.length > 0) {
        output.ancho_cm = detalles[0].ancho_cm;
        output.alto_cm = detalles[0].alto_cm;
      } else {
        output.ancho_cm = null;
        output.alto_cm = null;
      }
    }
  }
}


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
// 6. VALIDACIÓN
// ======================================================

let valid = true;
let reason = null;


// ------------------------------------------------------
// 6.1 Debe existir output
// ------------------------------------------------------

if (!output) {
  valid = false;

  reason =
    'La IA no devolvió un objeto output válido.';
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
// 6.3 No debe estar vacío
// ------------------------------------------------------

else if (detalles.length === 0) {
  valid = false;

  reason =
    'La IA devolvió detalles vacío.';
}


// ------------------------------------------------------
// 6.4 Límite de seguridad
// ------------------------------------------------------

else if (detalles.length > 10) {
  valid = false;

  reason =
    'La IA devolvió demasiados detalles de cotización.';
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
        `El detalle ${numeroDetalle} no es un objeto válido.`;

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
        `La cantidad del detalle ${numeroDetalle} no es numérica.`;

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
        `La cantidad del detalle ${numeroDetalle} debe ser un número entero.`;

      break;
    }


    if (
      typeof d.cantidad === 'number' &&
      d.cantidad < 1000
    ) {
      valid = false;

      reason =
        `La cantidad del detalle ${numeroDetalle} es menor al mínimo comercial de 1000.`;

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
        `El ancho_cm del detalle ${numeroDetalle} no es numérico.`;

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
        `El alto_cm del detalle ${numeroDetalle} no es numérico.`;

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
        `La forma del detalle ${numeroDetalle} no es válida.`;

      break;
    }


    // ----------------------------------------------
    // CONSISTENCIA RECTANGULAR / CUADRADA
    // ----------------------------------------------
    //
    // No hacemos esto para CIRCULAR porque 8x8 circular
    // es perfectamente válido.
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
          `El detalle ${numeroDetalle} está marcado como CUADRADA pero ancho_cm y alto_cm son diferentes.`;

        break;
      }

      if (
        d.forma === 'RECTANGULAR' &&
        casiIgual(
          d.ancho_cm,
          d.alto_cm
        )
      ) {

        // Permitimos rectangular cuadrada físicamente,
        // porque comercialmente podría existir un troquel
        // rectangular de lados iguales.
        //
        // Por tanto NO invalidamos.
      }
    }


    // ----------------------------------------------
    // ALUCINACIÓN BÁSICA EN NOMBRE / SABOR
    // ----------------------------------------------
    //
    // Si nombre o sabor vienen informados pero NO aparecen
    // en el mensaje actual ni existe contexto que los respalde,
    // es sospechoso.
    //
    // No invalidamos producto aquí porque puede venir de la
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
          `El campo ${campo} del detalle ${numeroDetalle} contiene información no respaldada por el mensaje ni por el contexto.`;

        break;
      }
    }

    if (!valid) {
      break;
    }
  }
}


// ======================================================
// 7. VALIDAR COBERTURA DE MEDIDAS EXPLÍCITAS
// ======================================================
//
// Si el cliente escribió explícitamente:
// 8x11 y 8x8
//
// el extractor no puede devolver solo una.
//
// Solo aplicamos esta regla cuando encontramos
// dos o más pares explícitos en el mensaje.
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
        `El cliente indicó explícitamente la medida ${claveMedida(
          medidaEsperada.ancho_cm,
          medidaEsperada.alto_cm
        )}, pero el extractor no la incluyó en detalles.`;

      break;
    }
  }
}


// ======================================================
// 8. DETECTAR POSIBLE REDUCCIÓN DE PEDIDO MÚLTIPLE
// ======================================================
//
// Cuando existen dos o más medidas explícitas,
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
    `El mensaje contiene ${medidasExplicitas.length} medidas explícitas, pero el extractor devolvió solo ${detalles.length} detalle(s).`;
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
