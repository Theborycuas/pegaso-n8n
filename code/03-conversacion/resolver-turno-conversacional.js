// ======================================================
// NODO N8N: Resolver turno conversacional
// ARCHIVO: code/03-conversacion/resolver-turno-conversacional.js
// VERSION: 1.0
// RESPONSABILIDAD:
// - Tras "Esperar ventana de turno", decidir si esta ejecución sigue siendo la del último mensaje ENTRANTE de la conversación (latest-wins por mensajes.id)
// - Ignorar reenvíos del mismo mensaje_externo_id (reintentos del webhook): solo cuenta la primera fila
// - Si llegó un mensaje posterior: continuar_procesamiento = false, resultado DEBOUNCE_SUPERSEDED, motivo MENSAJE_POSTERIOR_RECIBIDO (final válido, sin error)
// - Si es la última: armar el turno con los ENTRANTE con procesado = false posteriores al último SALIENTE anterior y no más antiguos que turno_max_antiguedad_segundos
// - Entregar turno_texto (un mensaje por línea, en orden), los ids y el rango turno_desde_id / turno_hasta_id para "Preparar contexto IA" y "Confirmar turno conversacional"
// - Lanzar error solo si falta el id de "Guardar mensaje entrante" o esa fila no aparece en el historial (configuración rota)
// - NO escribir en PostgreSQL (la confirmación atómica la hace "Confirmar turno conversacional")
// - NO llamar a la IA ni decidir la acción comercial
// ======================================================

const TURNO_MAX_ANTIGUEDAD_SEGUNDOS_DEFECTO = 600;


// ======================================================
// 1. HELPERS
// ======================================================

function numeroONull(valor) {
  if (valor === undefined || valor === null || valor === '') {
    return null;
  }

  const n = Number(valor);

  return Number.isFinite(n) ? n : null;
}

function textoONull(valor) {
  if (valor === undefined || valor === null) {
    return null;
  }

  const limpio = String(valor).trim();

  return limpio !== '' ? limpio : null;
}

function verdadero(valor) {
  return valor === true || valor === 'true' || valor === 't' || valor === 1;
}

function direccion(fila) {
  return String(fila.direccion ?? '').trim().toUpperCase();
}

function fechaMs(valor) {
  const ms = Date.parse(valor ?? '');

  return Number.isFinite(ms) ? ms : null;
}


// ======================================================
// 2. MENSAJE DE ESTA EJECUCIÓN
// ======================================================

const guardado =
  $('Guardar mensaje entrante').first().json ?? {};

const miId = numeroONull(guardado.id);

if (miId === null || miId <= 0) {
  throw new Error(
    'Resolver turno conversacional: "Guardar mensaje entrante" no devolvió un id válido.'
  );
}


// ======================================================
// 3. CONFIGURACIÓN
// ======================================================

let config = {};

try {
  config = $('Resolver permiso automatización').first().json ?? {};
} catch (error) {
  config = {};
}

const turnoMaxAntiguedadSegundos =
  numeroONull(config.turno_max_antiguedad_segundos) ??
  TURNO_MAX_ANTIGUEDAD_SEGUNDOS_DEFECTO;


// ======================================================
// 4. MENSAJES DE LA CONVERSACIÓN (después de la espera)
// ======================================================

const filas = $input.all()
  .map(item => item.json)
  .filter(fila => fila && numeroONull(fila.id) !== null)
  .map(fila => ({ ...fila, id: Number(fila.id) }))
  .sort((a, b) => a.id - b.id);

const miFila = filas.find(fila => fila.id === miId);

if (!miFila) {
  throw new Error(
    `Resolver turno conversacional: el mensaje ${miId} no aparece en "Recuperar historial conversación".`
  );
}

const conversacionId =
  numeroONull(guardado.conversacion_id) ??
  numeroONull(miFila.conversacion_id);


// ======================================================
// 5. ENTRANTES VÁLIDOS (sin reenvíos del webhook)
// ======================================================

const externosVistos = new Set();
const entrantes = [];
let miEsDuplicado = false;

for (const fila of filas) {
  if (direccion(fila) !== 'ENTRANTE') {
    continue;
  }

  const externo = textoONull(fila.mensaje_externo_id);
  const duplicado = externo !== null && externosVistos.has(externo);

  if (externo !== null) {
    externosVistos.add(externo);
  }

  if (duplicado) {
    if (fila.id === miId) {
      miEsDuplicado = true;
    }
    continue;
  }

  entrantes.push(fila);
}

const ultimoEntranteId =
  entrantes.length > 0
    ? entrantes[entrantes.length - 1].id
    : null;


// ======================================================
// 6. SALIDA SIN PROCESAR
// ======================================================

function noProcesar(resultado, motivo, extra = {}) {
  return [
    {
      json: {
        success: true,
        flujo: 'DEBOUNCE',
        conversacion_id: conversacionId,
        mensaje_id: miId,
        continuar_procesamiento: false,
        resultado_turno: resultado,
        motivo_no_procesamiento: motivo,
        respuesta_automatica: false,
        mensaje_guardado: true,
        ultimo_entrante_id: ultimoEntranteId,
        ...extra,
        turno_resuelto_at: new Date().toISOString()
      }
    }
  ];
}

if (miEsDuplicado) {
  return noProcesar('DUPLICADO', 'MENSAJE_DUPLICADO', {
    mensaje_externo_id: textoONull(miFila.mensaje_externo_id)
  });
}

if (ultimoEntranteId !== miId) {
  return noProcesar('DEBOUNCE_SUPERSEDED', 'MENSAJE_POSTERIOR_RECIBIDO', {
    mensaje_posterior_id: ultimoEntranteId
  });
}


// ======================================================
// 7. ARMAR EL TURNO
// ======================================================
//
// Turno = ENTRANTE válidos que cumplen todo:
// - id <= este mensaje
// - id > último SALIENTE anterior a este mensaje
// - procesado = false (no confirmados por un turno anterior)
// - no más antiguos que turno_max_antiguedad_segundos respecto de este mensaje
//
// El límite por SALIENTE se calcula solo con salientes anteriores a este
// mensaje: una respuesta de otro turno guardada después no debe vaciar el turno.
// ======================================================

const ultimoSalienteAnteriorId = filas
  .filter(fila => direccion(fila) === 'SALIENTE' && fila.id < miId)
  .reduce((max, fila) => Math.max(max, fila.id), 0);

const miFecha =
  fechaMs(guardado.enviado_at) ??
  fechaMs(miFila.enviado_at);

let descartadosPorAntiguedad = 0;

const turno = entrantes.filter(fila => {
  if (fila.id > miId || fila.id <= ultimoSalienteAnteriorId) {
    return false;
  }

  if (verdadero(fila.procesado)) {
    return false;
  }

  const fecha = fechaMs(fila.enviado_at);

  if (
    miFecha !== null &&
    fecha !== null &&
    miFecha - fecha > turnoMaxAntiguedadSegundos * 1000
  ) {
    descartadosPorAntiguedad++;
    return false;
  }

  return true;
});

if (!turno.some(fila => fila.id === miId)) {
  return noProcesar('YA_PROCESADO', 'TURNO_YA_PROCESADO');
}

const turnoMensajes = turno.map(fila => ({
  id: fila.id,
  contenido: String(fila.contenido ?? '').trim(),
  tipo: textoONull(fila.tipo) ?? 'TEXTO',
  enviado_at: fila.enviado_at ?? null
}));

const turnoTexto = turnoMensajes
  .map(m => m.contenido)
  .filter(Boolean)
  .join('\n');


// ======================================================
// 8. SALIDA PARA PROCESAR
// ======================================================

return [
  {
    json: {
      success: true,
      flujo: 'DEBOUNCE',
      conversacion_id: conversacionId,
      mensaje_id: miId,
      continuar_procesamiento: true,
      resultado_turno: 'PROCESAR',
      motivo_no_procesamiento: null,
      ultimo_entrante_id: ultimoEntranteId,
      ultimo_saliente_anterior_id: ultimoSalienteAnteriorId || null,

      turno_mensaje_ids: turnoMensajes.map(m => m.id),
      turno_desde_id: turnoMensajes[0].id,
      turno_hasta_id: miId,
      cantidad_mensajes_turno: turnoMensajes.length,
      turno_mensajes: turnoMensajes,
      turno_texto: turnoTexto,
      mensajes_descartados_por_antiguedad: descartadosPorAntiguedad,

      turno_resuelto_at: new Date().toISOString()
    }
  }
];
