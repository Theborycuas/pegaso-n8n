// ======================================================
// N8N NODE - PEGASO
// ======================================================
// Nombre: Preparar registro IA
// Node ID: 849811b6-476c-467d-abdd-77ef707c4357
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

const input =
  $input.first()?.json ?? {};


function texto(valor) {
  if (valor === undefined || valor === null) {
    return null;
  }

  const limpio =
    String(valor).trim();

  return limpio !== '' ? limpio : null;
}


function numeroONull(valor) {
  if (
    valor === undefined ||
    valor === null ||
    valor === ''
  ) {
    return null;
  }

  const n =
    Number(valor);

  return Number.isFinite(n) ? n : null;
}


function sqlTexto(valor) {
  const t =
    texto(valor);

  if (t === null) {
    return null;
  }

  // V1.1: "Insertar log IA" usa parámetros; el texto viaja sin escapar.
  return t;
}

let executionId = null;
try {
  executionId = typeof $execution !== 'undefined' ? String($execution.id) : null;
} catch (_) {
  executionId = null;
}


function nodoEjecutado(nombre) {
  try {
    return $(nombre).isExecuted === true;
  } catch (_) {
    return false;
  }
}


function jsonNodo(nombre) {
  try {
    return $(nombre).first()?.json ?? null;
  } catch (_) {
    return null;
  }
}


const CADENA = [
  {
    cerebro: 'Cerebro comercial Groq',
    modeloNodo: 'Groq Chat Model1',
    proveedor: 'GROQ',
    modelo: 'openai/gpt-oss-20b'
  },
  {
    cerebro: 'Cerebro comercial DeepSeek',
    modeloNodo: 'DeepSeek Chat Model1',
    proveedor: 'DEEPSEEK',
    modelo: 'deepseek-flash'
  },
  {
    cerebro: 'Cerebro comercial OpenAI',
    modeloNodo: 'OpenAI Chat Model1',
    proveedor: 'OPENAI',
    modelo: 'gpt-5-mini'
  }
];

let elegido =
  null;

for (const fila of CADENA) {
  if (nodoEjecutado(fila.cerebro)) {
    elegido =
      fila;
  }
}

const proveedor =
  elegido?.proveedor ??
  (
    input.error_code === 'ALL_AI_FAILED'
      ? 'NINGUNO'
      : 'DESCONOCIDO'
  );

const modelo =
  elegido?.modelo ??
  null;

const esFallback =
  proveedor === 'DEEPSEEK' ||
  proveedor === 'OPENAI' ||
  proveedor === 'NINGUNO';

const contexto =
  jsonNodo('Preparar contexto IA') ?? {};

const modeloJson =
  elegido
    ? jsonNodo(elegido.modeloNodo)
    : null;

const tokensEstimados =
  numeroONull(
    modeloJson?.estimatedTokens ??
    modeloJson?.tokenCount ??
    modeloJson?.usage?.total_tokens ??
    modeloJson?.tokenUsage?.totalTokens
  );

const tokensPrompt =
  numeroONull(
    modeloJson?.usage?.prompt_tokens ??
    modeloJson?.tokenUsage?.promptTokens
  );

const tokensCompletion =
  numeroONull(
    modeloJson?.usage?.completion_tokens ??
    modeloJson?.tokenUsage?.completionTokens
  );

const exito =
  input.valid === true &&
  input.error_code !== 'ALL_AI_FAILED';

const errorTexto =
  texto(input.error) ??
  texto(input.validation_reason) ??
  (
    exito
      ? null
      : 'intento_invalido_o_fallido'
  );

const mensajeResumen =
  texto(contexto.mensaje_actual_original) ??
  texto(contexto.mensaje_actual) ??
  null;

const responseJson =
  {
    valid: input.valid === true,
    intencion: input.intencion ?? null,
    accion: input.accion ?? null,
    validation_reason: input.validation_reason ?? null,
    error_code: input.error_code ?? null,
    status: input.status ?? null
  };


return [
  {
    json: {
      ...input,

      ia_log_proveedor:
        proveedor,
      ia_log_execution_id:
        executionId ?? '',

      ia_log_rol:
        'CEREBRO',

      ia_log_modelo:
        modelo ?? '',

      ia_log_exito:
        exito ? 'true' : 'false',

      ia_log_es_fallback:
        esFallback ? 'true' : 'false',

      ia_log_validation_reason:
        sqlTexto(input.validation_reason) ?? '',

      ia_log_error_texto:
        sqlTexto(errorTexto) ?? '',

      ia_log_tokens_estimados:
        tokensEstimados == null
          ? ''
          : String(tokensEstimados),

      ia_log_tokens_prompt:
        tokensPrompt == null
          ? ''
          : String(tokensPrompt),

      ia_log_tokens_completion:
        tokensCompletion == null
          ? ''
          : String(tokensCompletion),

      ia_log_conversacion_id:
        numeroONull(contexto.conversacion_id) == null
          ? ''
          : String(numeroONull(contexto.conversacion_id)),

      ia_log_prospecto_id:
        numeroONull(contexto.prospecto_id) == null
          ? ''
          : String(numeroONull(contexto.prospecto_id)),

      ia_log_mensaje_resumen:
        sqlTexto(
          mensajeResumen
            ? mensajeResumen.slice(0, 500)
            : null
        ) ?? '',

      ia_log_request_resumen:
        sqlTexto(
          [
            proveedor,
            modelo,
            mensajeResumen
              ? `msg=${mensajeResumen.slice(0, 120)}`
              : null,
            tokensEstimados != null
              ? `tokens_est=${tokensEstimados}`
              : null
          ]
            .filter(Boolean)
            .join(' · ')
        ) ?? '',

      ia_log_response_json:
        sqlTexto(JSON.stringify(responseJson)) ?? ''
    }
  }
];
