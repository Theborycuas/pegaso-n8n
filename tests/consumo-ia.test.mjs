import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { compileNode } from '../scripts/lib/node-modules.mjs';

const code = compileNode(fs.readFileSync(new URL('../code/_extraidos/extraer-consumo-ia.js', import.meta.url), 'utf8'));
const extraer = (items, solicitadas) => new Function('$input', '$', code)(
  { all: () => items.map(json => ({ json })) },
  () => ({ all: () => solicitadas.map(execution_id => ({ json: { execution_id } })) })
)[0].json;

// Estructura de la API de n8n (GET /executions/{id}?includeData=true), con datos ficticios.
const ejecucion = {
  id: '25657',
  startedAt: '2026-11-17T10:00:00.000Z',
  workflowData: {
    nodes: [
      { name: 'Groq Chat Model1', type: '@n8n/n8n-nodes-langchain.lmChatGroq', parameters: { model: 'openai/gpt-oss-20b' } },
      { name: 'DeepSeek Chat Model1', type: '@n8n/n8n-nodes-langchain.lmChatDeepSeek', parameters: {} },
      { name: 'Groq Chat Model', type: '@n8n/n8n-nodes-langchain.lmChatGroq', parameters: {} },
      { name: 'Transcribir audio Deepgram', type: 'n8n-nodes-base.httpRequest', parameters: { url: 'https://api.deepgram.com/v1/listen?model=nova-3' } }
    ]
  },
  data: { resultData: { runData: {
    'Preparar contexto IA': [{ data: { main: [[{ json: { conversacion_id: 827, prospecto_id: 20 } }]] } }],
    'Groq Chat Model1': [{
      startTime: 1794920384000, executionTime: 97, executionStatus: 'error',
      source: [{ previousNode: 'Cerebro comercial Groq' }],
      error: { message: 'Your request is invalid', description: "Request too large for model: Limit 8000, Requested 18083" },
      inputOverride: { ai_languageModel: [[{ json: { estimatedTokens: 17115, options: { model: 'openai/gpt-oss-20b' } } }]] }
    }],
    'DeepSeek Chat Model1': [{
      startTime: 1794920385000, executionTime: 6380, executionStatus: 'success',
      source: [{ previousNode: 'Cerebro comercial DeepSeek' }],
      inputOverride: { ai_languageModel: [[{ json: { estimatedTokens: 17115, options: { model: 'deepseek-flash', configuration: { baseURL: 'https://api.deepseek.com' } } } }]] },
      data: { ai_languageModel: [[{ json: { response: {}, tokenUsage: { promptTokens: 19873, completionTokens: 888, totalTokens: 20761 } } }]] }
    }],
    'Validar extracción DeepSeek1': [{ source: [{ previousNode: 'Cerebro comercial DeepSeek' }], data: { main: [[{ json: { valid: true } }]] } }],
    'Groq Chat Model': [{
      startTime: 1794920386000, executionTime: 1558, executionStatus: 'success',
      source: [{ previousNode: 'Extractor → Groq Chat Model' }],
      inputOverride: { ai_languageModel: [[{ json: { options: { model: 'openai/gpt-oss-20b' } } }]] },
      data: { ai_languageModel: [[{ json: { tokenUsage: { promptTokens: 3734, completionTokens: 898, totalTokens: 4632 } } }]] }
    }],
    'Validar extracción Groq': [{ source: [{ previousNode: 'Extractor → Groq Chat Model' }], data: { main: [[{ json: { valid: false, validation_reason: 'Falta el campo obligatorio: cantidad' } }]] } }],
    'Transcribir audio Deepgram': [{
      startTime: 1794920383000, executionTime: 900, executionStatus: 'success',
      data: { main: [[{ json: { metadata: { duration: 7.5 } } }], []] }
    }]
  } } }
};

test('Cada llamada a IA de la ejecución genera una fila con su rol y proveedor', () => {
  const result = extraer([ejecucion], ['25657']);
  assert.deepEqual(result.ejecuciones, [{ execution_id: '25657', estado: 'PROCESADA', llamadas: 4 }]);
  const por = nodo => result.llamadas.find(fila => fila.nodo === nodo);
  assert.deepEqual([por('Groq Chat Model1').rol, por('Groq Chat Model1').proveedor], ['CEREBRO', 'GROQ']);
  assert.deepEqual([por('DeepSeek Chat Model1').rol, por('DeepSeek Chat Model1').proveedor], ['CEREBRO', 'DEEPSEEK']);
  assert.equal(por('Groq Chat Model').rol, 'COTIZADOR');
  assert.deepEqual([por('Transcribir audio Deepgram').rol, por('Transcribir audio Deepgram').proveedor], ['AUDIO', 'DEEPGRAM']);
  assert.ok(result.llamadas.every(fila => fila.conversacion_id === 827 && fila.execution_id === '25657'));
});

test('Los tokens son los que devolvió el proveedor', () => {
  const fila = extraer([ejecucion], ['25657']).llamadas.find(item => item.nodo === 'DeepSeek Chat Model1');
  assert.deepEqual([fila.tokens_prompt, fila.tokens_completion, fila.tokens_estimados, fila.tokens_origen], [19873, 888, 20761, 'PROVEEDOR']);
  assert.equal(fila.modelo, 'deepseek-flash');
  assert.equal(fila.exito, true);
  assert.equal(fila.es_fallback, true);
  assert.equal(fila.duracion_ms, 6380);
});

test('Una petición rechazada conserva el error y no suma tokens consumidos', () => {
  const fila = extraer([ejecucion], ['25657']).llamadas.find(item => item.nodo === 'Groq Chat Model1');
  assert.equal(fila.exito, false);
  assert.match(fila.error_texto, /Limit 8000, Requested 18083/);
  assert.equal(fila.tokens_prompt, null);
  assert.equal(fila.detalle.tokens_solicitados, 17115);
});

test('Una respuesta que no pasa la validación cuenta como fallo con su motivo', () => {
  const fila = extraer([ejecucion], ['25657']).llamadas.find(item => item.nodo === 'Groq Chat Model');
  assert.equal(fila.exito, false);
  assert.equal(fila.validation_reason, 'Falta el campo obligatorio: cantidad');
  assert.equal(fila.tokens_prompt, 3734);
});

test('La transcripción registra la duración del audio', () => {
  const fila = extraer([ejecucion], ['25657']).llamadas.find(item => item.nodo === 'Transcribir audio Deepgram');
  assert.equal(fila.exito, true);
  assert.equal(fila.audio_segundos, 7.5);
  assert.equal(fila.modelo, 'nova-3');
});

test('Una ejecución borrada se marca y un error temporal se reintenta', () => {
  const result = extraer([
    { error: { message: '404 - The execution you are looking for could not be found.' } },
    { error: { message: 'ECONNRESET' } }
  ], ['111', '112']);
  assert.deepEqual(result.ejecuciones, [{ execution_id: '111', estado: 'NO_ENCONTRADA', llamadas: 0 }]);
  assert.equal(result.llamadas.length, 0);
});

test('Una ejecución sin IA queda revisada con cero llamadas', () => {
  const result = extraer([{ id: '300', data: { resultData: { runData: { 'Webhook YCloud': [{}] } } } }], ['300']);
  assert.deepEqual(result.ejecuciones, [{ execution_id: '300', estado: 'PROCESADA', llamadas: 0 }]);
});

test('Los nodos de API de n8n quedan desactivados hasta asignar su credencial', () => {
  const workflow = JSON.parse(fs.readFileSync(new URL('../workflows/sistema-automatizado-pegaso.edit.json', import.meta.url), 'utf8'));
  for (const name of ['Registrar consumo IA', 'Listar ejecuciones n8n', 'Leer ejecución n8n']) {
    const node = workflow.nodes.find(item => item.name === name);
    assert.ok(node.credentials || node.disabled === true, `${name} sin credencial debe estar desactivado`);
  }
});
