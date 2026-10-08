// ======================================================
// NODO N8N: Preparar entrada no soportada
// ARCHIVO: code/01-entrada/preparar-entrada-no-soportada.js
// VERSION: 1.0
// RESPONSABILIDAD:
// - Recibir de "IF: ¿Entrada soportada por el flujo?" (false) las entradas que no son texto procesable ni media a procesar
// - Ignorar en silencio (sin item) lo que no necesita respuesta: reacciones, stickers y textos vacíos
// - Para el resto (ubicación, contacto, interactivo, tipo desconocido o media sin media_id) emitir el mismo contrato que
//   "Preparar entrada WhatsApp" con un mensaje descriptor controlado "[TIPO]\n[ENTRADA NO SOPORTADA · tipo=…] …"
//   (o el descriptor de imagen/archivo que ya armó la etapa 01) y marcar derivacion_directa = true
// - Fijar la derivación: motivo (IMAGEN_REQUIERE_REVISION / ARCHIVO_NO_PROCESABLE / ENTRADA_NO_SOPORTADA), clasificación del handoff y prioridad MEDIA
// - Seguir a "Normalizar mensaje": la entrada se identifica (contacto/prospecto/conversación) y se guarda como cualquier otra;
//   "IF: ¿Derivación directa por entrada?" la manda luego a "Preparar derivación humana" sin pasar por la IA
// - NO consultar PostgreSQL, NO descargar media, NO decidir identidad
// ======================================================

const LARGO_MAXIMO_CAPTION = 1000;

const TIPOS_ORIGINALES_IGNORADOS = ['reaction', 'sticker'];

const TIPOS_ARCHIVO = ['AUDIO', 'VIDEO', 'DOCUMENTO'];


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


// ======================================================
// 2. CLASIFICAR CADA ENTRADA
// ======================================================

const salida = [];

for (const [indice, item] of $input.all().entries()) {
  const data = item.json ?? {};

  const tipo = (textoONull(data.tipo) ?? 'DESCONOCIDO').toUpperCase();
  const tipoOriginal = (textoONull(data.meta_whatsapp?.tipo_original) ?? '').toLowerCase();

  // ------------------------------------------------
  // 2.1 IGNORADAS
  // ------------------------------------------------

  if (
    TIPOS_ORIGINALES_IGNORADOS.includes(tipoOriginal) ||
    tipo === 'STICKER' ||
    (tipo === 'TEXTO' && textoONull(data.mensaje) === null)
  ) {
    continue;
  }

  // ------------------------------------------------
  // 2.2 MOTIVO Y DESCRIPTOR
  // ------------------------------------------------

  let motivo;
  let clasificacion;
  let mensaje;

  if (tipo === 'IMAGEN') {
    motivo = 'IMAGEN_REQUIERE_REVISION';
    clasificacion = 'REVISION_IMAGEN';
    mensaje = textoONull(data.mensaje) ?? '[IMAGEN]\n[CONTEXTO DE IMAGEN · revision=SI · motivo=IMAGEN_NO_DESCARGABLE] No se pudo obtener la imagen para revisarla automáticamente.';
  } else if (TIPOS_ARCHIVO.includes(tipo)) {
    motivo = 'ARCHIVO_NO_PROCESABLE';
    clasificacion = 'REVISION_ARCHIVO';
    mensaje = textoONull(data.mensaje) ?? `[${tipo}]\n[ARCHIVO NO PROCESABLE · tipo=${tipo} · mime=desconocido] El bot no puede revisar este archivo automáticamente.`;
  } else {
    motivo = 'ENTRADA_NO_SOPORTADA';
    clasificacion = 'REVISION_COMERCIAL';

    const caption =
      typeof data.meta_whatsapp?.media?.caption === 'string'
        ? data.meta_whatsapp.media.caption.replace(/\s+/g, ' ').trim().slice(0, LARGO_MAXIMO_CAPTION)
        : '';

    mensaje =
      `[${tipo}]${caption ? ` ${caption}` : ''}\n` +
      `[ENTRADA NO SOPORTADA · tipo=${tipo} · original=${tipoOriginal || 'desconocido'}] ` +
      'El bot no puede revisar este tipo de mensaje automáticamente.';
  }

  salida.push({
    json: {
      ...data,

      // ----------------------------------------------
      // CONTRATO DE ENTRADA (igual que "Preparar entrada WhatsApp")
      // ----------------------------------------------

      mensaje,
      tipo,

      entrada_soportada_flujo: false,

      // ----------------------------------------------
      // DERIVACIÓN DIRECTA (la aplica "Preparar derivación humana")
      // ----------------------------------------------

      derivacion_directa: true,
      derivacion_directa_motivo: 'ENTRADA_NO_SOPORTADA',
      origen_derivacion: 'ENTRADA_NO_SOPORTADA',

      derivacion_motivo: motivo,
      derivacion_clasificacion: clasificacion,
      derivacion_prioridad: 'MEDIA'
    },
    pairedItem: { item: indice }
  });
}

return salida;
