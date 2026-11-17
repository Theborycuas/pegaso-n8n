const RESPUESTA_FAQ_REFUERZO_MEDIDAS =
  'Para enviarle el precio indíquenos por favor el ancho y el alto de sus etiquetas en centímetros. Con esos datos le cotizamos de inmediato.';

const RESPUESTA_FAQ_MATERIAL =
  'Trabajamos con plástico Polipropileno de alta adherencia 👌. ' +
  'Lo que permite a sus productos una elegante presentación. ' +
  'Nuestras etiquetas resisten refrigeración, congelación y temperaturas relativamente altas (no temperaturas que derritan el plástico), sin que se despegue.';

const RESPUESTA_FAQ_MATERIAL_Y_MEDIDAS =
  RESPUESTA_FAQ_MATERIAL +
  '\n\n¿En qué medidas necesita sus etiquetas? Indíquenos ancho y alto en centímetros para cotizarle de inmediato.';

// Requiere el módulo code/preventa/ubicacion.js incluido antes en el nodo.
const RESPUESTA_FAQ_UBICACION = UBICACION_RESPUESTA_GENERAL;

const RESPUESTA_FAQ_LOCAL = UBICACION_RESPUESTA_DIRECCION;

const RESPUESTA_FAQ_IVA_ETIQUETAS =
  'Sí, el precio de las etiquetas adhesivas incluye IVA.';

const RESPUESTA_FAQ_ENVIO =
  'Sí, realizamos envíos a todo el país 🇪🇨🚛. No está incluido el valor del envío; es de $5.00 dólares aproximadamente. ¿Desde qué ciudad nos escribe disculpe?';

const RESPUESTA_FAQ_MINIMO =
  'El mínimo de impresión es de 1000 etiquetas por diseño (del mismo diseño).';

const RESPUESTA_FAQ_METODOLOGIA =
  'Trabajamos con una metodología semanal: recibimos pedidos de lunes a miércoles, ' +
  'producimos miércoles y jueves, y realizamos entregas y envíos los viernes a partir de las 17:00. ' +
  'El viernes de entrega se confirma según el día en que ingrese su pedido.';

const RESPUESTA_FAQ_DATOS_PAGO =
  'Con gusto. Le comunicamos con el encargado para coordinar su compra y el pago.';

const RESPUESTA_FAQ_DISENO =
  'Realizamos 1 propuesta de diseño con posibilidad de 5 cambios sobre lo propuesto. ' +
  'Debe tener listo su logo, slogan, fotos e información de direcciones y contactos. ' +
  'Trabajamos con abono del 50% para iniciar y el 50% restante contra entrega.';

const RESPUESTA_FAQ_ENVASE_VOLUMEN =
  'Para cotizarle la etiqueta necesitamos el ancho y el alto en centímetros (no basta con onzas o mililitros). ' +
  'Si puede, envíenos también una foto del vaso o envase con una regla o midiendo el área a etiquetar. ' +
  'Con esos datos le cotizamos de inmediato.';

const RESPUESTA_FAQ_CIRELES =
  'No trabajamos con cireles, realizamos impresión offset por lo que no necesita cireles. ' +
  'Puede hacer cambios cuando usted lo requiera.';

const TABLA_FAQ_PRE_IA = [
  {
    id: 'PRECIO_ETIQUETAS_ADHESIVAS',
    // FAQ del anuncio Meta (muy repetida en ejecuciones).
    patron:
      /^(hola[!¡. ]*)?(quiero (saber |conocer )?)?(el )?precio de las etiquetas adhesivas\??$/,
    intencion: 'CONSULTAR_PRECIO',
    accion: 'PEDIR_MEDIDAS',
    respuesta: RESPUESTA_FAQ_REFUERZO_MEDIDAS
  },
  {
    id: 'MATERIAL_ETIQUETAS',
    patron:
      /\b(de que material|que material|cual (es|seria) el material|material (de las |para )?(sus )?etiquetas|polipropileno)\b/,
    intencion: 'CONSULTAR_PRODUCTO',
    accion: 'INFORMAR_MATERIAL',
    respuesta: RESPUESTA_FAQ_MATERIAL
  },
  {
    id: 'MAS_INFORMACION',
    patron:
      /^(hola[!¡. ]*)?(quiero |me gustaria |deseo )?(mas |la )?informacion\??$|^(informacion|info)\??$/,
    intencion: 'CONSULTAR_PRODUCTO',
    accion: 'INFORMAR_MATERIAL',
    respuesta: RESPUESTA_FAQ_MATERIAL_Y_MEDIDAS
  },
  {
    id: 'UBICACION',
    patron: UBICACION_PIDE_CIUDAD,
    intencion: 'CONSULTAR_UBICACION',
    accion: 'INFORMAR_UBICACION',
    respuesta: RESPUESTA_FAQ_UBICACION
  },
  {
    id: 'LOCAL_FISICO',
    patron: UBICACION_PIDE_DIRECCION,
    intencion: 'CONSULTAR_UBICACION',
    accion: 'INFORMAR_UBICACION',
    respuesta: RESPUESTA_FAQ_LOCAL
  },
  {
    id: 'CIRELES',
    // "¿Cobran cireles?", "el cirel va aparte", "clisé", "Cyrel" y errores de tipeo.
    patron:
      /\b(c|s)[iy]rr?el(es|s)?\b|\bclis(e|es|ses)\b|\bclich(e|es)\b|\bfotopolimeros?\b/,
    intencion: 'CONSULTAR_PRODUCTO',
    accion: 'RESPONDER_GENERAL',
    respuesta: RESPUESTA_FAQ_CIRELES
  },
  {
    id: 'IVA',
    patron:
      /\b(incluye|incluyen|incluido|con|sin|el|del)?\s*iva\b|\biva\b/,
    intencion: 'CONSULTAR_PRECIO',
    accion: 'RESPONDER_GENERAL',
    respuesta: RESPUESTA_FAQ_IVA_ETIQUETAS,
    // Solo turnos cortos: "¿incluye IVA?" no una cotización larga.
    maxLen: 80
  },
  {
    id: 'ENVIO',
    patron:
      /\b(hacen|realizan|tienen)?\s*envios?\b|\benvian (a|hasta|para)\b|\b(transporte|flete|delivery|encomienda)\b|\bme (hacen|pueden) llegar\b/,
    intencion: 'CONSULTAR_ENVIO',
    accion: 'RESPONDER_GENERAL',
    respuesta: RESPUESTA_FAQ_ENVIO,
    maxLen: 120
  },
  {
    id: 'MINIMO',
    patron:
      /\b(cual (es|seria) (el )?minimo|minimo (de|de impresion|por diseno)|desde cuantas|cantidad minima|el minimo)\b/,
    intencion: 'CONSULTAR_MINIMO',
    accion: 'INFORMAR_MINIMO',
    respuesta: RESPUESTA_FAQ_MINIMO
  },
  {
    id: 'METODOLOGIA_ENTREGA',
    patron:
      /\b(tiempo de entrega|tiempos? de (produccion|entrega)|metodologia|cuando (entregan|envian|salen|despachan)|en cuantos dias|cuanto (se )?demora|cuanto tarda|plazo de entrega|dias habiles)\b/,
    intencion: 'CONSULTAR_ENTREGA',
    accion: 'INFORMAR_METODOLOGIA',
    respuesta: RESPUESTA_FAQ_METODOLOGIA
  },
  {
    id: 'DATOS_PAGO',
    patron:
      /\b(datos (de )?pago|numero(s)? de cuenta|cuentas? bancarias?|transferencia|deposito|datos bancarios|para (el )?abono|como (pago|abono|abonar|transferir))\b|\b(paseme|envie(me)?|deme|ayudeme)\b.{0,35}\bcuenta\b/,
    intencion: 'CONSULTAR_PAGO',
    accion: 'ENVIAR_DATOS_PAGO',
    respuesta: RESPUESTA_FAQ_DATOS_PAGO
  },
  {
    id: 'HORARIO',
    patron:
      /\b(horario|a que hora|estan abiertos|atienden|hora(s)? de atencion)\b/,
    intencion: 'CONSULTAR_ENTREGA',
    accion: 'INFORMAR_METODOLOGIA',
    respuesta: RESPUESTA_FAQ_METODOLOGIA
  },
  {
    id: 'DISENO',
    patron:
      /\b(hacen (el )?diseno|incluyen (el )?diseno|como (es|funciona) (el )?diseno|propuesta(s)? de diseno|cuantos cambios|disenan)\b/,
    intencion: 'CONSULTAR_DISENO',
    accion: 'INFORMAR_DISENO',
    respuesta: RESPUESTA_FAQ_DISENO,
    maxLen: 140
  },
  {
    id: 'ENVASE_VOLUMEN',
    // "vasos de 7 onzas circular", "botella 600 ml", etc.
    patron:
      /\b(vasos?|botellas?|envases?|frascos?|potes?|bidon(es)?|botellon(es)?)\b.*\b(\d+([.,]\d+)?\s*(oz|onzas?|ml|cc|litros?|lt|l)\b|\b(oz|onzas?|ml)\b)|\b(\d+([.,]\d+)?\s*(oz|onzas?|ml|cc)\b).*\b(vasos?|botellas?|envases?|circular|redond)/,
    intencion: 'SOLICITAR_COTIZACION',
    accion: 'PEDIR_MEDIDAS',
    respuesta: RESPUESTA_FAQ_ENVASE_VOLUMEN,
    maxLen: 220
  }
];

function resolverFaqPreIA(textoPlano, opciones = {}) {
  const plano =
    String(textoPlano ?? '').trim();

  if (!plano) {
    return null;
  }

  if (opciones.hayMedidas) {
    return null;
  }

  // Cotización / pedido con cantidad grande: no FAQ corta.
  // (NxN en cm sí es medida; oz/ml no cuentan como hayMedidas.)
  if (
    /\b\d{1,3}([.,]\d+)?\s*(x|por|\*|×)\s*\d{1,3}([.,]\d+)?\s*(cm|mm)?\b/.test(plano) ||
    /\b\d{3,}\s*(etiquetas?|unidades?|mil)\b/.test(plano)
  ) {
    return null;
  }

  // El texto cacheado procede del catálogo de respuestas aprobadas.
  // Cantidades, condiciones particulares y compras se resuelven por su propia ruta.
  let hallazgos = [];
  for (const faq of TABLA_FAQ_PRE_IA) {
    const maxLen =
      Number(faq.maxLen) > 0 ? Number(faq.maxLen) : 220;

    if (plano.length > maxLen) {
      continue;
    }

    const productoCatalogo = opciones.productoLinea && opciones.productoLinea !== 'ETIQUETAS_ADHESIVAS';
    if (productoCatalogo && !['UBICACION', 'LOCAL_FISICO', 'ENVIO', 'DATOS_PAGO'].includes(faq.id)) {
      continue;
    }
    if (faq.patron.test(plano)) {
      hallazgos.push(faq);
    }
  }

  // La dirección en Quito ya indica la ciudad: sustituye a la respuesta general.
  if (hallazgos.some(faq => faq.id === 'LOCAL_FISICO')) {
    hallazgos = hallazgos.filter(faq => faq.id !== 'UBICACION');
  }
  if (hallazgos.length === 0) return null;
  // Una intención que exige al encargado tiene prioridad sobre las FAQs informativas.
  const pago = hallazgos.find(faq => faq.id === 'DATOS_PAGO');
  if (pago) return { ...pago, cache_version: 'preventa-2', temas: ['DATOS_PAGO'] };
  let respuestas = [...new Set(hallazgos.map(faq => faq.respuesta))];
  // Varias respuestas pueden cerrar con la misma pregunta. Se formula una sola vez al final.
  const preguntaCiudad = /\s*¿Desde qué ciudad nos escribe[^?]*\?/;
  if (respuestas.filter(respuesta => preguntaCiudad.test(respuesta)).length > 1) {
    respuestas = respuestas.map(respuesta => respuesta.replace(preguntaCiudad, '').trim());
    respuestas.push('¿Desde qué ciudad nos escribe?');
  }
  return {
    ...hallazgos[0],
    id: hallazgos.map(faq => faq.id).join('_'),
    temas: hallazgos.map(faq => faq.id),
    accion: hallazgos.length > 1 ? 'RESPONDER_GENERAL' : hallazgos[0].accion,
    respuesta: respuestas.join('\n\n'),
    cache_version: 'preventa-2'
  };
}
