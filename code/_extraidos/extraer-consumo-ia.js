// ======================================================
// N8N NODE - PEGASO
// ======================================================
// Nombre: Extraer consumo IA
// Node ID: 9e9e8b85-eab7-496d-8e0c-db7426f959d7
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
// EXTRAER CONSUMO IA - V1.0
// ======================================================
//
// Recibe ejecuciones completas de la API de n8n
// (GET /api/v1/executions/{id}?includeData=true).
// Devuelve una fila por cada llamada a IA de esa ejecución:
// - Modelos LangChain (cerebro comercial, cotizador, análisis
//   de imagen): proveedor, modelo, nodo raíz, duración, error
//   y tokens reales (tokenUsage) que n8n guarda en el sub-nodo.
// - Transcripción de audio (Groq Whisper, Deepgram).
//
// No copia mensajes de clientes: solo identificadores,
// métricas y textos de error del proveedor.
// ======================================================

const MAX_ERROR = 500;

const lecturas = $input.all();

let solicitadas = [];
try {
  solicitadas = $('Filtrar ejecuciones sin consumo').all();
} catch (_) {
  solicitadas = [];
}

function texto(valor, maximo = MAX_ERROR) {
  if (valor === undefined || valor === null) return null;
  const limpio = String(valor).trim();
  return limpio === '' ? null : limpio.slice(0, maximo);
}

function numero(valor) {
  if (valor === undefined || valor === null || valor === '') return null;
  const n = Number(valor);
  return Number.isFinite(n) ? n : null;
}

function primerJson(run, tipo) {
  const salidas = run?.data?.[tipo];
  if (!Array.isArray(salidas)) return null;
  for (const salida of salidas) {
    if (Array.isArray(salida) && salida.length > 0) return salida[0]?.json ?? null;
  }
  return null;
}

function proveedorDe(nodo, opciones) {
  const tipo = String(nodo?.type ?? '').toLowerCase();
  const base = String(opciones?.configuration?.baseURL ?? '').toLowerCase();
  const modelo = String(opciones?.model ?? '').toLowerCase();
  if (tipo.includes('deepseek') || base.includes('deepseek') || modelo.startsWith('deepseek')) return 'DEEPSEEK';
  if (tipo.includes('groq')) return 'GROQ';
  if (tipo.includes('openai')) return 'OPENAI';
  if (tipo.includes('gemini') || tipo.includes('palm')) return 'GEMINI';
  if (tipo.includes('anthropic')) return 'ANTHROPIC';
  return 'OTRO';
}

function rolDe(nombreRaiz) {
  const nombre = String(nombreRaiz ?? '');
  if (/^Cerebro comercial/i.test(nombre)) return 'CEREBRO';
  if (/^Extractor/i.test(nombre)) return 'COTIZADOR';
  if (/imagen/i.test(nombre)) return 'IMAGEN';
  return 'OTRO';
}

function modeloDeParametros(nodo) {
  const p = nodo?.parameters ?? {};
  const valor = typeof p.model === 'object' ? p.model?.value : p.model;
  return texto(valor ?? p.modelName, 80);
}

// Validación posterior al nodo raíz (p. ej. "Validar extracción …").
function validacionDe(runData, nombreRaiz, indice) {
  for (const runs of Object.values(runData)) {
    const deLaRaiz = (runs ?? []).filter(run =>
      (run?.source ?? []).some(origen => origen?.previousNode === nombreRaiz)
    );
    const run = deLaRaiz[indice] ?? deLaRaiz[0];
    const json = primerJson(run, 'main');
    if (json && typeof json.valid === 'boolean') {
      return { valid: json.valid, reason: texto(json.validation_reason) };
    }
  }
  return null;
}

function contextoConversacion(runData) {
  for (const nombre of ['Preparar contexto IA', 'Preparar conversación', 'Guardar mensaje entrante']) {
    const json = primerJson(runData[nombre]?.[0], 'main');
    if (json && numero(json.conversacion_id) !== null) {
      return {
        conversacion_id: numero(json.conversacion_id),
        prospecto_id: numero(json.prospecto_id)
      };
    }
  }
  return { conversacion_id: null, prospecto_id: null };
}

function errorDe(run) {
  const error = run?.error;
  if (!error) return null;
  return texto([error.message, error.description].filter(Boolean).join(' · '));
}

function llamadasDeEjecucion(ejecucion) {
  const executionId = String(ejecucion.id);
  const runData = ejecucion?.data?.resultData?.runData ?? {};
  const nodos = new Map((ejecucion?.workflowData?.nodes ?? []).map(nodo => [nodo.name, nodo]));
  const conversacion = contextoConversacion(runData);
  const filas = [];

  for (const [nombre, runs] of Object.entries(runData)) {
    const nodo = nodos.get(nombre);
    const tipo = String(nodo?.type ?? '');
    const esModelo = /lmChat|lmOpenAi|\.lm[A-Z]/.test(tipo) ||
      (runs ?? []).some(run => run?.inputOverride?.ai_languageModel || run?.data?.ai_languageModel);
    const esAudio = /^Transcribir audio/i.test(nombre);
    if (!esModelo && !esAudio) continue;

    const porRaiz = new Map();

    (runs ?? []).forEach(run => {
      const base = {
        execution_id: executionId,
        nodo: nombre,
        creado_at: Number.isFinite(run?.startTime) ? new Date(run.startTime).toISOString() : (ejecucion.startedAt ?? null),
        duracion_ms: numero(run?.executionTime),
        ...conversacion
      };

      if (esAudio) {
        const ok = primerJson(run, 'main');
        const exito = run?.executionStatus === 'success' && Array.isArray(run?.data?.main?.[0]) &&
          run.data.main[0].length > 0 && !ok?.error;
        const proveedor = /deepgram/i.test(nombre) ? 'DEEPGRAM' : 'GROQ';
        const parametros = JSON.stringify(nodo?.parameters ?? {});
        filas.push({
          ...base,
          proveedor,
          rol: 'AUDIO',
          modelo: texto((parametros.match(/whisper[-\w.]*/) ?? parametros.match(/nova-\d[\w-]*/) ?? [])[0], 80),
          exito,
          es_fallback: proveedor !== 'GROQ',
          error_texto: exito ? null : (errorDe(run) ?? texto(ok?.error?.message ?? ok?.error) ?? 'TRANSCRIPCION_FALLIDA'),
          validation_reason: null,
          tokens_prompt: null,
          tokens_completion: null,
          tokens_estimados: null,
          tokens_origen: null,
          audio_segundos: numero(ok?.duration ?? ok?.metadata?.duration),
          detalle: { estado_nodo: run?.executionStatus ?? null }
        });
        return;
      }

      const entrada = run?.inputOverride?.ai_languageModel?.[0]?.[0]?.json ?? {};
      const salida = primerJson(run, 'ai_languageModel') ?? {};
      const opciones = entrada.options ?? {};
      const raiz = run?.source?.[0]?.previousNode ?? null;
      const indiceRaiz = porRaiz.get(raiz) ?? 0;
      porRaiz.set(raiz, indiceRaiz + 1);

      const proveedor = proveedorDe(nodo, opciones);
      const apiOk = run?.executionStatus === 'success' && !run?.error;
      const validacion = apiOk ? validacionDe(runData, raiz, indiceRaiz) : null;
      const uso = salida.tokenUsage ?? null;
      const estimado = salida.tokenUsageEstimate ?? null;
      const tokens = uso ?? estimado;

      filas.push({
        ...base,
        proveedor,
        rol: rolDe(raiz),
        modelo: texto(opciones.model ?? opciones.modelName, 80) ?? modeloDeParametros(nodo),
        exito: apiOk && validacion?.valid !== false,
        es_fallback: proveedor !== 'GROQ',
        error_texto: apiOk ? null : (errorDe(run) ?? 'ERROR_PROVEEDOR'),
        validation_reason: validacion?.valid === false ? validacion.reason : null,
        // Una petición rechazada por el proveedor no consume tokens.
        tokens_prompt: numero(tokens?.promptTokens),
        tokens_completion: numero(tokens?.completionTokens),
        tokens_estimados: numero(tokens?.totalTokens),
        tokens_origen: uso ? 'PROVEEDOR' : estimado ? 'ESTIMADO' : null,
        audio_segundos: null,
        detalle: {
          nodo_raiz: raiz,
          estado_nodo: run?.executionStatus ?? null,
          tokens_solicitados: numero(entrada.estimatedTokens)
        }
      });
    });
  }

  return filas;
}

const ejecuciones = [];
const llamadas = [];

lecturas.forEach((item, indice) => {
  const json = item.json ?? {};
  const solicitada = texto(solicitadas[indice]?.json?.execution_id, 64);

  if (json.data?.resultData) {
    const filas = llamadasDeEjecucion(json);
    llamadas.push(...filas);
    ejecuciones.push({ execution_id: String(json.id), estado: 'PROCESADA', llamadas: filas.length });
    return;
  }

  // Una ejecución borrada por la limpieza de n8n no se volverá a pedir.
  const error = JSON.stringify(json.error ?? json).slice(0, 300);
  if (solicitada && /404|not found|no encontrad/i.test(error)) {
    ejecuciones.push({ execution_id: solicitada, estado: 'NO_ENCONTRADA', llamadas: 0 });
  }
  // Otros errores (red, autenticación) quedan para la siguiente ronda.
});

return [
  {
    json: {
      ejecuciones,
      llamadas,
      total_ejecuciones: ejecuciones.length,
      total_llamadas: llamadas.length
    }
  }
];
