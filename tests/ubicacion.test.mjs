import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { compileNode } from '../scripts/lib/node-modules.mjs';

const load = name => fs.readFileSync(new URL(`../code/preventa/${name}.js`, import.meta.url), 'utf8');
const ubicacion = new Function(`${load('ubicacion')}
return { UBICACION_RESPUESTA_GENERAL, UBICACION_RESPUESTA_DIRECCION, clasificarConsultaUbicacion, familiaRespuestaUbicacion };`)();
const faq = new Function(`${load('ubicacion')}\n${load('preguntas-frecuentes')}\nreturn resolverFaqPreIA;`)();
const plano = valor => String(valor).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();

const sources = new Map();
function runNode(file, input, nodes = {}) {
  if (!sources.has(file)) {
    const code = fs.readFileSync(new URL(`../code/_extraidos/${file}.js`, import.meta.url), 'utf8');
    sources.set(file, new Function('$input', '$', compileNode(code)));
  }
  const lookup = name => {
    if (!(name in nodes)) throw new Error(`Nodo no ejecutado: ${name}`);
    const rows = [{ json: nodes[name] }];
    return { isExecuted: true, first: () => rows[0], all: () => rows, item: rows[0] };
  };
  const rows = [{ json: input }];
  return sources.get(file)({ first: () => rows[0], all: () => rows, item: rows[0] }, lookup)[0]?.json;
}

function resolve(message, ultimoSaliente = null) {
  const context = {
    conversacion_id: 10, prospecto_id: 20, telefono: '593000000000',
    mensaje_actual: message, contexto_comercial: {}, ultimo_saliente: ultimoSaliente ?? {}
  };
  return runNode('resolver-contexto-comercial', {
    ...context, producto: null, accion: 'INFORMAR_UBICACION',
    respuesta_sugerida: 'Nosotros somos de la ciudad de Quito y realizamos trabajos y envíos para todo el país 🇪🇨🚛.'
  }, { 'Preparar contexto IA': context });
}

const { UBICACION_RESPUESTA_GENERAL: GENERAL, UBICACION_RESPUESTA_DIRECCION: DIRECCION } = ubicacion;

test('Los textos de ubicación son los aprobados por Pegaso', () => {
  assert.match(GENERAL, /^Somos de la ciudad de Quito pero no tiene de qué preocuparse 🤗/);
  assert.match(GENERAL, /Servientrega 🚛 o por transporte depende de su requerimiento 🚌\.$/);
  assert.match(DIRECCION, /Valle de los Chillos en el sector de Capelo/);
  assert.match(DIRECCION, /Av\. América y José Riofrío/);
  assert.match(DIRECCION, /\*En ambas direcciones le atendemos solo bajo previa cita por favor\.\*/);
  assert.match(DIRECCION, /¿cuándo tiene planificado visitarnos\?$/);
});

for (const [message, tipo] of [
  ['¿En qué ciudad se encuentran?', 'CIUDAD'],
  ['¿De qué ciudad son?', 'CIUDAD'],
  ['¿Dónde están ubicados?', 'CIUDAD'],
  ['¿Cuál es su dirección?', 'DIRECCION'],
  ['¿Tienen local físico?', 'DIRECCION'],
  ['¿En qué parte de Quito están?', 'DIRECCION'],
  ['¿Puedo ir a visitarles?', 'DIRECCION'],
  ['Me pasa su ubicación por favor', 'DIRECCION'],
  ['Necesito etiquetas de 10x5', null]
]) {
  test(`Clasificación de ubicación: ${message}`, () => {
    assert.equal(ubicacion.clasificarConsultaUbicacion(plano(message)), tipo);
  });
}

test('La FAQ responde la ciudad con el texto predeterminado', () => {
  const result = faq(plano('¿En qué ciudad se encuentran?'));
  assert.equal(result.respuesta, GENERAL);
  assert.equal(result.accion, 'INFORMAR_UBICACION');
});

test('La FAQ responde la dirección en Quito con cita previa', () => {
  assert.equal(faq(plano('¿Cuál es su dirección?')).respuesta, DIRECCION);
  assert.equal(faq(plano('¿Tienen local físico?')).respuesta, DIRECCION);
});

test('Ciudad y dirección juntas reciben solo la dirección', () => {
  const result = faq(plano('¿Dónde están ubicados? ¿cuál es la dirección?'));
  assert.deepEqual(result.temas, ['LOCAL_FISICO']);
  assert.equal(result.respuesta, DIRECCION);
});

test('Primera consulta de ciudad recibe el texto predeterminado', () => {
  const result = resolve('¿En qué ciudad se encuentran?');
  assert.equal(result.accion, 'INFORMAR_UBICACION');
  assert.equal(result.respuesta_sugerida, GENERAL);
  assert.equal(result.omitir_envio, false);
});

test('Tras la respuesta automática del anuncio el bot no repite la ubicación ni envía el local', () => {
  const result = resolve('¿En qué ciudad se encuentran?', {
    contenido: '[AUTOMATICO WHATSAPP BUSINESS] ' + GENERAL, origen: 'AUTOMATICO',
    accion_equivalente: 'INFORMAR_UBICACION', posterior_al_turno: true, enviado_at: new Date().toISOString()
  });
  assert.doesNotMatch(result.respuesta_sugerida, /local físico|retiros se realizan/);
  assert.notEqual(result.respuesta_sugerida, GENERAL);
  assert.notEqual(result.respuesta_sugerida, DIRECCION);
});

test('Pedir la dirección después de conocer la ciudad entrega las direcciones', () => {
  const result = resolve('¿Y en qué parte de Quito están?', {
    contenido: GENERAL, origen: 'BOT', accion_equivalente: 'INFORMAR_UBICACION', posterior_al_turno: false
  });
  assert.equal(result.respuesta_sugerida, DIRECCION);
  assert.equal(result.omitir_envio, false);
});

test('Preguntar por el local recibe las direcciones con cita previa', () => {
  const result = resolve('¿Tienen local físico?');
  assert.equal(result.respuesta_sugerida, DIRECCION);
});

test('Si la dirección ya se envió, se pide la fecha de visita sin repetir el bloque', () => {
  const result = resolve('¿Cuál es la dirección exacta?', {
    contenido: DIRECCION, origen: 'BOT', accion_equivalente: 'INFORMAR_UBICACION', posterior_al_turno: false
  });
  assert.doesNotMatch(result.respuesta_sugerida, /Valle de los Chillos en el sector/);
  assert.match(result.respuesta_sugerida, /previa cita/);
});

test('El filtro de duplicados distingue ciudad y dirección', () => {
  assert.equal(ubicacion.familiaRespuestaUbicacion(plano(GENERAL)), 'GENERAL');
  assert.equal(ubicacion.familiaRespuestaUbicacion(plano(DIRECCION)), 'DIRECCION');
  assert.equal(ubicacion.familiaRespuestaUbicacion(plano('Sí, contamos con local físico en Quito.')), 'GENERAL');
});
