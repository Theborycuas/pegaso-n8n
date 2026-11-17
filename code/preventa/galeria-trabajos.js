// Galería de trabajos realizados (fila GALERIA_TRABAJOS de configuracion_bot).
// Se envía una sola vez por conversación, después de responder cireles,
// material o la ciudad, para dar confianza al prospecto de etiquetas.
//
// valor_json:
// {
//   "activo": true,
//   "texto_cierre": "Le adjunto varios de nuestros trabajos.",
//   "galerias": [
//     { "clave": "AGUA", "palabras": ["agua", "botellon", "bidon"], "medios": ["https://…jpg", "https://…mp4"] },
//     { "clave": "GENERAL", "predeterminada": true, "medios": [ … ] }
//   ]
// }
// Un medio puede ser un link o { "url": "…", "tipo": "image" | "video" }.

const GALERIA_TEXTO_CIERRE = 'Le adjunto varios de nuestros trabajos.';
const GALERIA_MAX_MEDIOS = 15;
const GALERIA_PATRON_YA_ENVIADA = /\b(le )?adjunto (varios|algunos) de nuestros trabajos\b/;

function galeriaPlano(valor) {
  return String(valor ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9ñ\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
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

function galeriaYaEnviada(contextoAnterior, historial) {
  if (String(contextoAnterior?.galeria_trabajos?.enviada_at ?? '').trim() !== '') return true;
  // Un asesor ya la envió a mano desde WhatsApp Business.
  return (Array.isArray(historial) ? historial : []).some(mensaje =>
    String(mensaje?.direccion ?? '').toUpperCase() === 'SALIENTE' &&
    GALERIA_PATRON_YA_ENVIADA.test(galeriaPlano(mensaje?.contenido))
  );
}

// Devuelve la galería a enviar en este turno o null.
function decidirGaleriaTrabajos({
  config, respuesta, accion, permitido, contextoAnterior, historial, textoProspecto
} = {}) {
  if (!permitido || config?.activo !== true) return null;
  if (['COTIZAR_P4', 'DERIVAR_HUMANO', 'ENVIAR_DATOS_PAGO'].includes(accion)) return null;
  const motivo = motivoGaleriaTrabajos(respuesta);
  if (!motivo) return null;
  if (galeriaYaEnviada(contextoAnterior, historial)) return null;
  const galeria = elegirGaleriaTrabajos(config, textoProspecto);
  if (!galeria) return null;
  const textoCierre = String(config.texto_cierre ?? '').trim() || GALERIA_TEXTO_CIERRE;
  return { ...galeria, motivo, texto_cierre: textoCierre };
}
