// ======================================================
// NODO N8N: Preparar media del turno
// ARCHIVO: code/03-conversacion/preparar-media-turno.js
// VERSION: 1.0
// RESPONSABILIDAD:
// - Tras "IF: ¿Procesar turno?" (true), buscar en el turno las imágenes todavía sin analizar (tipo IMAGEN con línea "[MEDIA_PENDIENTE] {json}")
// - Revalidar cada una: MIME JPEG/PNG/WebP y enlace https://api.ycloud.com/v2/whatsapp/media/download/ (anti-SSRF); máximo MAX_IMAGENES_POR_TURNO
// - Emitir un item por imagen a analizar (analizar_imagen = true) con mensaje_id, enlace, MIME, caption y el contexto comercial breve para la IA visual
// - Si no hay ninguna: un solo item con analizar_imagen = false (el IF siguiente va directo a "Preparar contexto IA")
// - Las imágenes que no pasan la validación o exceden el máximo quedan pendientes: "Preparar contexto IA" las marca para revisión humana
// - NO descargar, NO llamar a la IA, NO escribir en PostgreSQL
// ======================================================

const MAX_IMAGENES_POR_TURNO = 3;

const MIME_IMAGEN_SOPORTADOS = ['image/jpeg', 'image/png', 'image/webp'];

const LINK_YCLOUD_PERMITIDO =
  /^https:\/\/api\.ycloud\.com\/v2\/whatsapp\/media\/download\/[A-Za-z0-9_-]+(\?[A-Za-z0-9%._~&=+-]*)?$/;

const PREFIJO_PENDIENTE = '[MEDIA_PENDIENTE] ';

const LARGO_MAXIMO_TEXTO_TURNO = 1500;


// ======================================================
// 1. HELPERS
// ======================================================

function textoONull(valor) {
  if (valor === undefined || valor === null) {
    return null;
  }

  const limpio = String(valor).trim();

  return limpio !== '' ? limpio : null;
}

function lineas(contenido) {
  return String(contenido ?? '').split('\n');
}

function esLineaDeSistema(linea) {
  return /^\[(MEDIA_PENDIENTE|CONTEXTO DE IMAGEN|ARCHIVO NO PROCESABLE)[\]\s·]/.test(linea.trim());
}

function leerPendiente(contenido) {
  const linea = lineas(contenido)
    .map(l => l.trim())
    .find(l => l.startsWith(PREFIJO_PENDIENTE));

  if (!linea) {
    return null;
  }

  try {
    const datos = JSON.parse(linea.slice(PREFIJO_PENDIENTE.length));

    return datos && typeof datos === 'object' ? datos : null;
  } catch (error) {
    return null;
  }
}

function captionDe(contenido) {
  const primera = lineas(contenido)[0] ?? '';

  return primera.replace(/^\[IMAGEN\]\s*/, '').trim();
}


// ======================================================
// 2. TURNO
// ======================================================

let turno = {};

try {
  turno = $('Resolver turno conversacional').first().json ?? {};
} catch (error) {
  turno = $input.first().json ?? {};
}

const turnoMensajes = Array.isArray(turno.turno_mensajes)
  ? turno.turno_mensajes
  : [];


// ======================================================
// 3. CONTEXTO PARA LA IA VISUAL
// ======================================================
//
// Lo que el cliente escribió en el turno (texto y captions, sin
// líneas de sistema) y lo poco de la memoria comercial que ayuda a
// interpretar la imagen. Nunca el enlace.
// ======================================================

const textoTurnoCliente = turnoMensajes
  .map(m => lineas(m.contenido)
    .filter(l => !esLineaDeSistema(l))
    .map(l => l.replace(/^\[(IMAGEN|AUDIO|VIDEO|DOCUMENTO)\]\s*/, '').trim())
    .filter(Boolean)
    .join(' '))
  .filter(Boolean)
  .join('\n')
  .slice(0, LARGO_MAXIMO_TEXTO_TURNO);

let conversacion = {};

try {
  conversacion = $('Preparar conversación').first().json ?? {};
} catch (error) {
  conversacion = {};
}

const memoria =
  conversacion.contexto_comercial &&
  typeof conversacion.contexto_comercial === 'object'
    ? conversacion.contexto_comercial
    : {};

const cotizacionPrevia = memoria.cotizacion ?? {};

const contextoComercialBreve = [
  textoONull(conversacion.prospecto_producto_interes ?? memoria.prospecto?.producto_interes)
    ? `Producto de interés: ${textoONull(conversacion.prospecto_producto_interes ?? memoria.prospecto?.producto_interes)}.`
    : null,
  cotizacionPrevia.ancho_cm && cotizacionPrevia.alto_cm
    ? `Ya conversamos de etiquetas de ${cotizacionPrevia.ancho_cm}x${cotizacionPrevia.alto_cm} cm.`
    : null
]
  .filter(Boolean)
  .join(' ') || 'Sin datos comerciales previos.';


// ======================================================
// 4. IMÁGENES A ANALIZAR
// ======================================================

const candidatas = [];
let descartadas = 0;

for (const mensaje of turnoMensajes) {
  if (String(mensaje.tipo ?? '').toUpperCase() !== 'IMAGEN') {
    continue;
  }

  const pendiente = leerPendiente(mensaje.contenido);

  if (!pendiente) {
    continue;
  }

  const mime = textoONull(pendiente.mime_type)?.toLowerCase() ?? null;
  const link = textoONull(pendiente.link);

  const valida =
    MIME_IMAGEN_SOPORTADOS.includes(mime) &&
    link !== null &&
    link.length <= 2048 &&
    LINK_YCLOUD_PERMITIDO.test(link);

  if (!valida || candidatas.length >= MAX_IMAGENES_POR_TURNO) {
    descartadas++;
    continue;
  }

  candidatas.push({
    mensaje_id: Number(mensaje.id),
    mime_type: mime,
    media_link: link,
    caption: captionDe(mensaje.contenido),
    contenido_base: lineas(mensaje.contenido)[0].trim()
  });
}


// ======================================================
// 5. SALIDA
// ======================================================

if (candidatas.length === 0) {
  return [
    {
      json: {
        analizar_imagen: false,
        imagenes_por_analizar: 0,
        imagenes_descartadas: descartadas,
        conversacion_id: turno.conversacion_id ?? null
      }
    }
  ];
}

return candidatas.map((imagen, indice) => ({
  json: {
    analizar_imagen: true,
    imagenes_por_analizar: candidatas.length,
    imagenes_descartadas: descartadas,
    indice_imagen: indice,
    conversacion_id: turno.conversacion_id ?? null,
    ...imagen,
    texto_turno_cliente: textoTurnoCliente || '(el cliente no escribió texto)',
    contexto_comercial_breve: contextoComercialBreve
  }
}));
