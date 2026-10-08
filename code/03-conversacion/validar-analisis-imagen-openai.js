// ======================================================
// NODO N8N: Validar análisis imagen OpenAI
// ARCHIVO: code/03-conversacion/validar-analisis-imagen-openai.js
// VERSION: 3.0
// RESPONSABILIDAD:
// - Validar la salida de "Analizar imagen Open IA" contra schemas/analisis-imagen.schema.json y llevarla al contrato común de análisis visual
// - Marcar proveedor_analisis = OPENAI (fijo en este archivo; Groq y DeepSeek tienen su propio archivo con la MISMA lógica)
// - Inválido (error del nodo, sin salida estructurada o schema incumplido): analisis_valido = false; es el último proveedor,
//   así que no reenvía la imagen: "IF: ¿Análisis OpenAI válido?" (false) lleva el item a "Preparar derivación imagen fallida"
// - Válido: requiere_revision si la IA lo pide, confianza BAJA o contenido NO_DETERMINABLE; comprobante_detectado solo con COMPROBANTE_PAGO (nunca confirma pagos)
// - Generar contenido_actualizado = contenido_base + "[CONTEXTO DE IMAGEN · proveedor=… · contenido=… · confianza=… · revision=…] detalle"
// - Conservar mensaje_id, conversacion_id y contenido_base (desde "Preparar media del turno" por pairedItem; respaldo: el validador anterior de la cascada)
// - Fijar pairedItem para que los nodos siguientes sigan emparejando con la imagen original
// - NO tomar decisiones comerciales, NO confirmar pagos, NO escribir en PostgreSQL
// ======================================================


// ======================================================
// 0. CONFIGURACIÓN DEL PROVEEDOR (única parte que cambia entre los 3 validadores)
// ======================================================

const PROVEEDOR = 'OPENAI';

// Nodos donde buscar mensaje_id / conversacion_id / contenido_base de cada item (en orden).
const NODOS_ORIGEN = ['Preparar media del turno', 'Validar análisis imagen DeepSeek', 'Validar análisis imagen Groq'];

// Solo el primer proveedor recibe los items en el mismo orden que "Preparar media del turno".
const EMPAREJAR_POR_POSICION = false;

// Último proveedor: un análisis inválido va a derivación humana, no necesita la imagen.
const REENVIAR_IMAGEN_SI_INVALIDO = false;


// ======================================================
// 1. CONTRATO DEL ANÁLISIS
// ======================================================

const CONTENIDOS = [
  'ENVASE_O_PRODUCTO',
  'ETIQUETA_O_DISENO',
  'LOGO',
  'REFERENCIA_VISUAL',
  'MEDIDAS_ESCRITAS',
  'COMPROBANTE_PAGO',
  'EVIDENCIA_RECLAMO',
  'CAPTURA_DE_PANTALLA',
  'NO_RELACIONADO',
  'NO_DETERMINABLE'
];

const MOTIVOS_REVISION = ['NINGUNO', 'IMAGEN_ILEGIBLE', 'IMAGEN_AMBIGUA', 'DISENO_COMPLEJO', 'OTRO'];

const CONFIANZAS = ['ALTA', 'MEDIA', 'BAJA'];

const CAMPOS_BOOLEANOS = ['envase_detectado', 'etiqueta_visible', 'diseno_visible', 'requiere_revision_humana'];

const CONTENIDOS_DE_ETIQUETA = [
  'ENVASE_O_PRODUCTO',
  'ETIQUETA_O_DISENO',
  'LOGO',
  'REFERENCIA_VISUAL',
  'MEDIDAS_ESCRITAS'
];

const NODO_DESCARGA = 'Descargar imagen YCloud';
const PROPIEDAD_BINARIA = 'imagen';

const LARGO_MAXIMO_RESUMEN = 400;
const LARGO_MAXIMO_CAMPO = 200;
const LARGO_MAXIMO_ERROR = 500;


// ======================================================
// 2. HELPERS
// ======================================================

function textoONull(valor, largo = LARGO_MAXIMO_CAMPO) {
  if (valor === undefined || valor === null) {
    return null;
  }

  const limpio = String(valor).replace(/\s+/g, ' ').trim();

  return limpio ? limpio.slice(0, largo) : null;
}

function numeroONull(valor) {
  if (valor === undefined || valor === null || valor === '') {
    return null;
  }

  const n = Number(valor);

  return Number.isFinite(n) ? n : null;
}

function booleanoONull(valor) {
  if (typeof valor === 'boolean') {
    return valor;
  }

  if (valor === 'true' || valor === 1 || valor === '1') {
    return true;
  }

  if (valor === 'false' || valor === 0 || valor === '0') {
    return false;
  }

  return null;
}

function sinCorchetes(valor) {
  return valor === null ? null : String(valor).replace(/[\[\]]/g, '').trim();
}

function quitarMarkdownJson(valor) {
  return typeof valor === 'string'
    ? valor.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
    : valor;
}


// ======================================================
// 3. LEER LA SALIDA DEL ANALIZADOR
// ======================================================
//
// El Basic LLM Chain con Structured Output Parser entrega
// { output: {...} }; sin parser, { text: "json" }. Con
// "On Error: Continue" un fallo llega como { error }.
// ======================================================

function detectarError(json) {
  if (!json || typeof json !== 'object') {
    return null;
  }

  if (json.error) {
    if (typeof json.error === 'string') {
      return textoONull(json.error, LARGO_MAXIMO_ERROR);
    }

    return (
      textoONull(json.error.message, LARGO_MAXIMO_ERROR) ??
      textoONull(json.error.description, LARGO_MAXIMO_ERROR) ??
      'ERROR_NODO'
    );
  }

  if (json.success === false) {
    return (
      textoONull(json.message, LARGO_MAXIMO_ERROR) ??
      textoONull(json.description, LARGO_MAXIMO_ERROR) ??
      'EJECUCION_FALLIDA'
    );
  }

  return null;
}

function extraerSalidaBruta(json) {
  if (json === undefined || json === null || typeof json !== 'object') {
    return json ?? null;
  }

  if (!Array.isArray(json) && json.contenido_detectado) {
    return json;
  }

  const candidatos = [
    json.output,
    json.text,
    json.response,
    json.content,
    json.result,
    json.data,
    json.message?.content,
    json.choices?.[0]?.message?.content,
    json.choices?.[0]?.text
  ];

  return candidatos.find(c => c !== undefined && c !== null) ?? null;
}

function leerSalidaIA(json) {
  if (!json || typeof json !== 'object') {
    return { error: 'SALIDA_VACIA', detalle: null };
  }

  const errorNodo = detectarError(json);

  if (errorNodo) {
    return { error: 'DESCARGA_O_IA_FALLIDA', detalle: errorNodo };
  }

  let salida = extraerSalidaBruta(json);

  if (salida === null) {
    return { error: 'SALIDA_VACIA', detalle: null };
  }

  if (Array.isArray(salida)) {
    if (salida.length === 1 && salida[0] && typeof salida[0] === 'object') {
      salida = salida[0];
    } else {
      return { error: 'SALIDA_ARRAY_NO_SOPORTADA', detalle: null };
    }
  }

  if (typeof salida === 'string') {
    try {
      salida = JSON.parse(quitarMarkdownJson(salida));
    } catch (error) {
      return { error: 'JSON_INVALIDO', detalle: textoONull(error.message, LARGO_MAXIMO_ERROR) };
    }
  }

  if (salida && typeof salida === 'object' && !Array.isArray(salida) && salida.output && typeof salida.output === 'object') {
    salida = salida.output;
  }

  if (!salida || typeof salida !== 'object' || Array.isArray(salida)) {
    return { error: 'SALIDA_VACIA', detalle: null };
  }

  return { datos: salida };
}

function validarContrato(datos) {
  if (!CONTENIDOS.includes(datos.contenido_detectado)) {
    return 'contenido_detectado inválido';
  }

  if (!CONFIANZAS.includes(datos.confianza)) {
    return 'confianza inválida';
  }

  if (!MOTIVOS_REVISION.includes(datos.motivo_revision)) {
    return 'motivo_revision inválido';
  }

  for (const campo of CAMPOS_BOOLEANOS) {
    if (booleanoONull(datos[campo]) === null) {
      return `${campo} debe ser boolean`;
    }
  }

  if (!textoONull(datos.resumen_para_cerebro)) {
    return 'resumen_para_cerebro vacío';
  }

  return null;
}


// ======================================================
// 4. ORIGEN DE CADA ITEM E IMAGEN DESCARGADA
// ======================================================

let mediaPorPosicion = [];

if (EMPAREJAR_POR_POSICION) {
  try {
    mediaPorPosicion = $('Preparar media del turno')
      .all()
      .filter(item => item.json?.analizar_imagen === true);
  } catch (error) {
    mediaPorPosicion = [];
  }
}

function origenDe(indice) {
  for (const nodo of NODOS_ORIGEN) {
    try {
      const json = $(nodo).itemMatching(indice)?.json;

      if (json && numeroONull(json.mensaje_id) !== null) {
        return json;
      }
    } catch (error) {
      // sin pairedItem hacia ese nodo: se prueba el siguiente
    }
  }

  return mediaPorPosicion[indice]?.json ?? {};
}

function imagenDescargadaDe(indice) {
  try {
    const binary = $(NODO_DESCARGA).itemMatching(indice)?.binary;

    if (binary?.[PROPIEDAD_BINARIA]) {
      return binary;
    }
  } catch (error) {
    // sin pairedItem hacia la descarga
  }

  if (EMPAREJAR_POR_POSICION) {
    try {
      const binary = $(NODO_DESCARGA).all()[indice]?.binary;

      if (binary?.[PROPIEDAD_BINARIA]) {
        return binary;
      }
    } catch (error) {
      // la descarga no se ejecutó
    }
  }

  return null;
}


// ======================================================
// 5. PROCESAR CADA RESULTADO
// ======================================================

return $input.all().map((item, indice) => {
  const origen = origenDe(indice);
  const mensajeId = numeroONull(origen.mensaje_id);
  const conversacionId = numeroONull(origen.conversacion_id);
  const contenidoBase = textoONull(origen.contenido_base, 1200) ?? '[IMAGEN]';

  const lectura = leerSalidaIA(item.json);
  const errorContrato = lectura.datos ? validarContrato(lectura.datos) : null;

  // ------------------------------------------------
  // 5.1 ANÁLISIS INVÁLIDO
  // ------------------------------------------------

  if (lectura.error || errorContrato) {
    const imagen = REENVIAR_IMAGEN_SI_INVALIDO ? imagenDescargadaDe(indice) : null;
    const descargaFallida = REENVIAR_IMAGEN_SI_INVALIDO && imagen === null;

    const salida = {
      json: {
        mensaje_id: mensajeId,
        conversacion_id: conversacionId,
        proveedor_analisis: PROVEEDOR,
        analisis_valido: false,
        requiere_revision: true,
        motivo_revision: 'ANALISIS_NO_DISPONIBLE',
        comprobante_detectado: false,
        contenido_detectado: null,
        confianza: null,
        error_analisis: descargaFallida ? 'DESCARGA_FALLIDA' : (lectura.error ?? 'SCHEMA_INVALIDO'),
        detalle_error: lectura.detalle ?? errorContrato ?? null,
        analisis: null,
        indice_imagen: indice,
        contenido_base: contenidoBase,
        contenido_actualizado:
          `${contenidoBase}\n` +
          `[CONTEXTO DE IMAGEN · proveedor=${PROVEEDOR} · revision=SI · motivo=ANALISIS_NO_DISPONIBLE] ` +
          'La imagen no pudo revisarse automáticamente.'
      },
      pairedItem: { item: indice }
    };

    if (imagen) {
      salida.binary = imagen;
    }

    return salida;
  }

  // ------------------------------------------------
  // 5.2 ANÁLISIS VÁLIDO
  // ------------------------------------------------

  const datos = lectura.datos;
  const contenido = datos.contenido_detectado;
  const confianza = datos.confianza;
  const requiereRevisionIA = booleanoONull(datos.requiere_revision_humana) === true;

  const analisis = {
    contenido_detectado: contenido,
    producto_probable: contenido === 'NO_RELACIONADO' ? null : textoONull(datos.producto_probable),
    envase_detectado: booleanoONull(datos.envase_detectado),
    forma_envase: textoONull(datos.forma_envase),
    etiqueta_visible: booleanoONull(datos.etiqueta_visible),
    diseno_visible: booleanoONull(datos.diseno_visible),
    texto_visible_relevante: contenido === 'COMPROBANTE_PAGO' ? null : textoONull(datos.texto_visible_relevante),
    colores_relevantes: Array.isArray(datos.colores_relevantes)
      ? datos.colores_relevantes.map(color => textoONull(color, 30)).filter(Boolean).slice(0, 5)
      : [],
    medidas_visibles: textoONull(datos.medidas_visibles, 60),
    requiere_revision_humana: requiereRevisionIA,
    motivo_revision: datos.motivo_revision,
    confianza,
    resumen_para_cerebro: textoONull(datos.resumen_para_cerebro, LARGO_MAXIMO_RESUMEN)
  };

  let motivoRevision = null;

  if (requiereRevisionIA) {
    motivoRevision = datos.motivo_revision !== 'NINGUNO' ? datos.motivo_revision : 'OTRO';
  } else if (confianza === 'BAJA') {
    motivoRevision = 'CONFIANZA_BAJA';
  } else if (contenido === 'NO_DETERMINABLE') {
    motivoRevision = 'IMAGEN_AMBIGUA';
  }

  const requiereRevision = motivoRevision !== null;

  const cabecera = [
    'CONTEXTO DE IMAGEN',
    `proveedor=${PROVEEDOR}`,
    `contenido=${contenido}`,
    `confianza=${confianza}`,
    `revision=${requiereRevision ? 'SI' : 'NO'}`,
    requiereRevision ? `motivo=${motivoRevision}` : null
  ]
    .filter(Boolean)
    .join(' · ');

  const detalle = [
    sinCorchetes(analisis.resumen_para_cerebro),
    analisis.producto_probable ? `Producto probable: ${sinCorchetes(analisis.producto_probable)}.` : null,
    analisis.forma_envase ? `Envase: ${sinCorchetes(analisis.forma_envase)}.` : null,
    analisis.texto_visible_relevante ? `Texto visible: "${sinCorchetes(analisis.texto_visible_relevante)}".` : null,
    analisis.colores_relevantes.length > 0 ? `Colores: ${analisis.colores_relevantes.join(', ')}.` : null,
    analisis.medidas_visibles
      ? `Medidas escritas en la imagen: ${sinCorchetes(analisis.medidas_visibles)}.`
      : CONTENIDOS_DE_ETIQUETA.includes(contenido)
        ? 'Sin medidas visibles.'
        : null
  ]
    .filter(Boolean)
    .join(' ');

  return {
    json: {
      mensaje_id: mensajeId,
      conversacion_id: conversacionId,
      proveedor_analisis: PROVEEDOR,
      analisis_valido: true,
      requiere_revision: requiereRevision,
      motivo_revision: motivoRevision,
      comprobante_detectado: contenido === 'COMPROBANTE_PAGO',
      contenido_detectado: contenido,
      confianza,
      error_analisis: null,
      detalle_error: null,
      analisis,
      indice_imagen: indice,
      contenido_base: contenidoBase,
      contenido_actualizado: `${contenidoBase}\n[${cabecera}] ${detalle}`
    },
    pairedItem: { item: indice }
  };
});
