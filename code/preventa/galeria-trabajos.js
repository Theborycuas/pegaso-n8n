// Galería de trabajos realizados (fila GALERIA_TRABAJOS de configuracion_bot).
// Da confianza al prospecto de etiquetas con trabajos de su mismo tipo de producto.
//
// Cuándo sale:
// - SOLICITUD: el prospecto pide fotos, imágenes, videos o muestras de trabajos.
//   Si su producto ya se conoce, sale esa galería; si no, el bot pregunta para qué
//   producto son las etiquetas y la envía con lo que responda.
// - Enganche (CIRELES, MATERIAL, CIUDAD): después de esas respuestas, solo si el
//   producto se conoce. Si no, queda pendiente y sale cuando el prospecto lo nombre.
// Cada galería se envía una sola vez por conversación.
//
// valor_json:
// {
//   "activo": true,
//   "texto_cierre": "Le adjunto varios de nuestros trabajos.",
//   "galerias": [
//     { "clave": "AGUA", "palabras": ["agua", "detergente"], "medios": ["https://…jpg", "https://…mp4"] },
//     { "clave": "GENERAL", "predeterminada": true, "medios": [ … ] }
//   ]
// }
// Un medio puede ser un link o { "url": "…", "tipo": "image" | "video" }.

const GALERIA_TEXTO_CIERRE = 'Le adjunto varios de nuestros trabajos.';
const GALERIA_SEGUIMIENTO_MEDIDAS = 'Quedamos atentos de las medidas exactas para cotizarle por favor.';
const GALERIA_INTRO_SOLICITUD = 'Claro, con gusto 🤗.';
const GALERIA_INTRO_PRODUCTO = 'Perfecto 👌.';
const GALERIA_PREGUNTA_PRODUCTO =
  'Con gusto le compartimos fotos de nuestros trabajos 🤗. ¿Para qué producto son sus etiquetas?';
const GALERIA_YA_COMPARTIDA =
  'Más arriba le compartimos varios de nuestros trabajos 👆.';
const GALERIA_MAX_MEDIOS = 15;
const GALERIA_ACCIONES_BLOQUEADAS = ['COTIZAR_P4', 'DERIVAR_HUMANO', 'ENVIAR_DATOS_PAGO'];

function galeriaPlano(valor) {
  return String(valor ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// El prospecto pide ver trabajos. Sin constantes de módulo: la tabla de FAQ
// la usa aunque este módulo se incluya después.
function pideMuestrasTrabajos(texto) {
  const plano = galeriaPlano(texto);
  if (!plano) return false;
  const MEDIO = '(fotos?|fotografias?|imagen(es)?|muestras?|ejemplos?|videos?|catalogo)';
  // Pedirle a Pegaso (no "le envié la foto de mi diseño").
  const PEDIR =
    '((me|nos) )?(puede[ns]?|podria[ns]?) (enviar|mandar|pasar|compartir|mostrar|ensenar)|' +
    '(enviar|mandar|pasar|compartir|mostrar|ensenar)(me|nos)|' +
    '(envie|mande|pase|comparta|muestre|ensene)(me|nos)|' +
    '(me|nos) (envia|manda|pasa|comparte|muestra|ensena)|' +
    '(quisiera|quiero|me gustaria|puedo|podria) (ver|mirar|conocer)';
  return (
    new RegExp(`\\b(tiene[ns]?|tendra[ns]?|hay|cuenta[ns]? con|disponen de)\\b.{0,30}\\b${MEDIO}\\b`).test(plano) ||
    new RegExp(`\\b(${PEDIR})\\b.{0,30}\\b(${MEDIO}|trabajos?)\\b`).test(plano) ||
    new RegExp(`\\b${MEDIO} (de )?(sus |los |algunos )?(trabajos?|muestra)\\b`).test(plano) ||
    /\btrabajos? (realizados|hechos|anteriores)\b/.test(plano)
  );
}

// Momento de enganche según la respuesta que sale en este turno.
function motivoGaleriaTrabajos(respuesta) {
  const plano = galeriaPlano(respuesta);
  if (!plano) return null;
  if (/\bimpresion offset\b/.test(plano)) return 'CIRELES';
  if (/\bpolipropileno\b/.test(plano)) return 'MATERIAL';
  // Ciudad (no la dirección para visitas).
  if (
    /\b(somos de (la ciudad de )?quito|tambien estamos en quito)\b/.test(plano) &&
    !/\b(valle de los chillos|previa cita)\b/.test(plano)
  ) {
    return 'CIUDAD';
  }
  return null;
}

function medioGaleria(valor) {
  const url = String(typeof valor === 'string' ? valor : valor?.url ?? '').trim();
  if (!/^https:\/\/\S+$/i.test(url)) return null;
  const declarado = String(valor?.tipo ?? '').toLowerCase();
  const tipo = ['image', 'video'].includes(declarado)
    ? declarado
    : /\.(mp4|3gp|mov)(\?|$)/i.test(url) ? 'video' : 'image';
  return { tipo, url };
}

function elegirGaleriaTrabajos(config, textoProspecto) {
  const galerias = Array.isArray(config?.galerias) ? config.galerias : [];
  const plano = ` ${galeriaPlano(textoProspecto)} `;
  const maximo = Math.min(
    Number(config?.max_medios) > 0 ? Number(config.max_medios) : GALERIA_MAX_MEDIOS,
    GALERIA_MAX_MEDIOS
  );

  const conMedios = galerias
    .map(galeria => ({
      clave: String(galeria?.clave ?? '').trim() || 'GENERAL',
      predeterminada: galeria?.predeterminada === true,
      palabras: (Array.isArray(galeria?.palabras) ? galeria.palabras : [])
        .map(galeriaPlano)
        .filter(Boolean),
      medios: (Array.isArray(galeria?.medios) ? galeria.medios : [])
        .map(medioGaleria)
        .filter(Boolean)
        .slice(0, maximo)
    }))
    .filter(galeria => galeria.medios.length > 0);

  // Palabra completa, también en plural: "botellon" reconoce "botellones".
  const porProducto = conMedios.find(galeria =>
    galeria.palabras.some(palabra => new RegExp(`\\b${palabra}(s|es)?\\b`).test(plano))
  );
  const elegida =
    porProducto ??
    conMedios.find(galeria => galeria.predeterminada) ??
    conMedios.find(galeria => galeria.palabras.length === 0) ??
    null;

  return elegida
    ? { clave: elegida.clave, por_producto: Boolean(porProducto), medios: elegida.medios }
    : null;
}

function galeriaEnviadaAMano(historial) {
  return (Array.isArray(historial) ? historial : []).some(mensaje =>
    String(mensaje?.direccion ?? '').toUpperCase() === 'SALIENTE' &&
    /\b(le )?adjunto (varios|algunos) de nuestros trabajos\b/.test(galeriaPlano(mensaje?.contenido))
  );
}

function galeriaYaEnviada(contextoAnterior, historial) {
  if (String(contextoAnterior?.galeria_trabajos?.enviada_at ?? '').trim() !== '') return true;
  return galeriaEnviadaAMano(historial);
}

// Decide la galería del turno.
// Devuelve null (nada que hacer) o:
// - galeria: { clave, por_producto, medios, motivo, texto_cierre } a enviar, o null;
// - texto: texto aprobado para la respuesta, o null;
// - texto_reemplaza: el texto puede ocupar el lugar de una respuesta genérica;
// - estado: nuevo contexto_comercial.galeria_trabajos, o null para no tocarlo.
function decidirGaleriaTrabajos({
  config, respuesta, accion, permitido, contextoAnterior, historial,
  textoProspecto, textoTurno, medidasConocidas
} = {}) {
  if (!permitido || config?.activo !== true) return null;
  if (GALERIA_ACCIONES_BLOQUEADAS.includes(accion)) return null;

  const previo = contextoAnterior?.galeria_trabajos && typeof contextoAnterior.galeria_trabajos === 'object'
    ? contextoAnterior.galeria_trabajos
    : {};
  const enviadas = Array.isArray(previo.claves_enviadas)
    ? previo.claves_enviadas
    : previo.clave && previo.enviada_at ? [previo.clave] : [];
  const aMano = galeriaEnviadaAMano(historial);
  const yaEnviada = enviadas.length > 0 || String(previo.enviada_at ?? '').trim() !== '' || aMano;

  // El producto del mensaje actual manda sobre el del historial.
  const delTurno = elegirGaleriaTrabajos(config, textoTurno);
  const delProspecto = elegirGaleriaTrabajos(config, textoProspecto);
  const conocida = delTurno?.por_producto ? delTurno : delProspecto?.por_producto ? delProspecto : null;
  const textoCierre = String(config.texto_cierre ?? '').trim() || GALERIA_TEXTO_CIERRE;

  const enviar = (galeria, motivo, intro) => ({
    galeria: {
      ...galeria,
      motivo,
      texto_cierre: intro && !medidasConocidas
        ? `${textoCierre}\n\n${GALERIA_SEGUIMIENTO_MEDIDAS}`
        : textoCierre
    },
    texto: intro,
    texto_reemplaza: true,
    estado: {
      clave: galeria.clave,
      motivo,
      medios: galeria.medios.length,
      claves_enviadas: [...new Set([...enviadas, galeria.clave])],
      pendiente_producto: null,
      enviada_at: new Date().toISOString()
    }
  });

  if (pideMuestrasTrabajos(textoTurno)) {
    if (conocida && !enviadas.includes(conocida.clave) && !(aMano && enviadas.length === 0)) {
      return enviar(conocida, 'SOLICITUD', GALERIA_INTRO_SOLICITUD);
    }
    if (yaEnviada) {
      return {
        galeria: null,
        texto: medidasConocidas ? GALERIA_YA_COMPARTIDA : `${GALERIA_YA_COMPARTIDA} ${GALERIA_SEGUIMIENTO_MEDIDAS}`,
        texto_reemplaza: true,
        estado: null
      };
    }
    return {
      galeria: null,
      texto: GALERIA_PREGUNTA_PRODUCTO,
      texto_reemplaza: true,
      estado: { ...previo, pendiente_producto: 'SOLICITUD', pendiente_at: new Date().toISOString() }
    };
  }

  if (!yaEnviada && previo.pendiente_producto) {
    if (delTurno?.por_producto) {
      return enviar(delTurno, 'PRODUCTO_INDICADO', GALERIA_INTRO_PRODUCTO);
    }
    // Pidió fotos y respondió con un producto sin galería propia: la predeterminada.
    if (previo.pendiente_producto === 'SOLICITUD' && delProspecto) {
      return enviar(delProspecto, 'PRODUCTO_INDICADO', GALERIA_INTRO_PRODUCTO);
    }
  }

  const motivo = motivoGaleriaTrabajos(respuesta);
  if (!motivo || yaEnviada) return null;
  if (conocida) {
    const envio = enviar(conocida, motivo, null);
    return { ...envio, texto: null, texto_reemplaza: false };
  }
  // Sin producto claro no se envía una galería al azar: espera a que lo nombre.
  if (previo.pendiente_producto) return null;
  return {
    galeria: null,
    texto: null,
    texto_reemplaza: false,
    estado: { ...previo, pendiente_producto: 'ENGANCHE', pendiente_at: new Date().toISOString() }
  };
}
