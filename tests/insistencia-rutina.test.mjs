// Sprint 2 · Insistencia a leads de anuncio
// Texto y botones del envío, respuesta del cliente y estados de entrega.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { compileNode } from '../scripts/lib/node-modules.mjs';

const sources = new Map();
function runNodeAll(file, inputs, nodes = {}) {
  if (!sources.has(file)) {
    const code = fs.readFileSync(new URL(`../code/_extraidos/${file}.js`, import.meta.url), 'utf8');
    sources.set(file, new Function('$input', '$', compileNode(code)));
  }
  const lookup = name => {
    if (!(name in nodes)) throw new Error(`Nodo no ejecutado: ${name}`);
    const rows = (Array.isArray(nodes[name]) ? nodes[name] : [nodes[name]]).map(json => ({ json }));
    return { isExecuted: true, first: () => rows[0], all: () => rows, item: rows[0] };
  };
  const rows = inputs.map(json => ({ json }));
  return sources.get(file)({ first: () => rows[0], all: () => rows, item: rows[0] }, lookup);
}
const runNode = (file, input, nodes) => runNodeAll(file, [input], nodes)[0]?.json;

const modulo = new Function(`${fs.readFileSync(new URL('../code/preventa/insistencia-leads.js', import.meta.url), 'utf8')}
return { saludoInsistencia, textoInsistencia, botonesInsistencia, clasificarRespuestaInsistencia,
  RESPUESTA_INSISTENCIA_ACEPTADA, RESPUESTA_INSISTENCIA_RECHAZADA };`)();

const plano = valor => String(valor).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();

const INSISTENCIA = modulo.textoInsistencia('Buenas noches', 'etiquetas adhesivas');

// ------------------------------------------------------
// Módulo
// ------------------------------------------------------

test('Saludo según la hora de Ecuador', () => {
  assert.equal(modulo.saludoInsistencia(10), 'Buenos días');
  assert.equal(modulo.saludoInsistencia(11), 'Buenos días');
  assert.equal(modulo.saludoInsistencia(12), 'Buenas tardes');
  assert.equal(modulo.saludoInsistencia(15), 'Buenas tardes');
  assert.equal(modulo.saludoInsistencia(18), 'Buenas noches');
  assert.equal(modulo.saludoInsistencia(20), 'Buenas noches');
});

test('Texto y botones aprobados', () => {
  assert.equal(INSISTENCIA,
    'Buenas noches 👋 Nos escribió por etiquetas adhesivas, ¿aún le interesa? Si nos indica el ancho y alto en centímetros le cotizamos de inmediato.');
  const botones = modulo.botonesInsistencia();
  assert.deepEqual(botones.map(b => b.reply.id), ['SEG_SI', 'SEG_NO']);
  for (const boton of botones) assert.ok(boton.reply.title.length <= 20, boton.reply.title);
});

for (const [texto, esperado] of [
  ['Ya no, gracias', 'RECHAZO'],
  ['No gracias', 'RECHAZO'],
  ['no me interesa', 'RECHAZO'],
  ['Por ahora no', 'RECHAZO'],
  ['Sí, quiero cotizar', 'ACEPTA'],
  ['Si por favor', 'ACEPTA'],
  ['Claro', 'ACEPTA'],
  ['Sí, son de 5x5', null],
  ['No sé las medidas todavía, ¿qué tamaños manejan?', null]
]) {
  test(`Respuesta a la insistencia: ${texto}`, () => {
    assert.equal(modulo.clasificarRespuestaInsistencia(plano(texto), plano(INSISTENCIA)), esperado);
  });
}

test('Sin insistencia previa no se clasifica', () => {
  assert.equal(modulo.clasificarRespuestaInsistencia(plano('No gracias'), plano('¿Desea que avancemos con este pedido?')), null);
  assert.equal(modulo.clasificarRespuestaInsistencia(plano('Sí'), ''), null);
});

// ------------------------------------------------------
// Preparar insistencia lead
// ------------------------------------------------------

test('Preparar insistencia lead arma el mensaje interactivo por fila', () => {
  const salida = runNodeAll('preparar-insistencia-lead', [
    { seguimiento_id: 7, reserva: 'R7', prospecto_id: 3, conversacion_id: 9, telefono: '593980000001',
      telefono_emisor: '593962645735', producto_texto: 'etiquetas adhesivas', hora_local: 10 },
    { seguimiento_id: 8, reserva: 'R8', prospecto_id: 4, conversacion_id: 10, telefono: '+593 98 000 0002',
      telefono_emisor: null, producto_texto: null, hora_local: 19 }
  ]);
  assert.equal(salida.length, 2);
  const [a, b] = salida.map(item => item.json);
  assert.equal(a.seguimiento_id, 7);
  assert.equal(a.reserva, 'R7');
  assert.match(a.texto, /^Buenos días 👋 Nos escribió por etiquetas adhesivas/);
  assert.equal(a.ycloud_body.from, '+593962645735');
  assert.equal(a.ycloud_body.to, '+593980000001');
  assert.equal(a.ycloud_body.type, 'interactive');
  assert.equal(a.ycloud_body.interactive.body.text, a.texto);
  assert.equal(a.ycloud_body.interactive.action.buttons.length, 2);
  assert.match(b.texto, /^Buenas noches/);
  assert.equal(b.ycloud_body.to, '+593980000002');
  assert.equal(b.ycloud_body.from, '+593962645735');
  assert.deepEqual(salida.map(item => item.pairedItem), [{ item: 0 }, { item: 1 }]);
});

// ------------------------------------------------------
// Normalizar evento WhatsApp: estado de envío
// ------------------------------------------------------

const estado = whatsappMessage => runNode('normalizar-evento-whatsapp', {
  body: { id: 'evt-9', type: 'whatsapp.message.updated', whatsappMessage }
}).evento_whatsapp;

test('Estado entregado con precio de YCloud', () => {
  const evento = estado({ id: 'yc-1', wamid: 'wamid.X', status: 'delivered', pricingCategory: 'service', totalPrice: 0, currency: 'USD' });
  assert.equal(evento.procesable, false);
  assert.deepEqual(evento.estado_mensaje, {
    id: 'yc-1', wamid: 'wamid.X', status: 'delivered', pricing_category: 'service',
    pricing_type: null, total_price: 0, currency: 'USD', error: null
  });
});

test('Estado fallido conserva el error', () => {
  const evento = estado({ id: 'yc-2', status: 'failed', errorCode: '131047', errorMessage: 'Re-engagement message' });
  assert.equal(evento.estado_mensaje.status, 'failed');
  assert.equal(evento.estado_mensaje.error, 'Re-engagement message');
  assert.equal(evento.estado_mensaje.total_price, null);
});

test('Otros eventos no traen estado de envío', () => {
  assert.equal(runNode('normalizar-evento-whatsapp', { body: { type: 'whatsapp.template.reviewed' } }).evento_whatsapp.estado_mensaje, null);
});

// ------------------------------------------------------
// Preparar conversación: botón tocado
// ------------------------------------------------------

test('Preparar conversación expone el id del botón de este mensaje', () => {
  const evento = { mensaje_id: 'wamid.B1', respuesta_interactiva: { tipo: 'BOTON', id: 'SEG_NO', titulo: 'Ya no, gracias' } };
  const base = { conversacion_id: 10, prospecto_id: 20, telefono: '593980000001', mensaje: 'Ya no, gracias', tipo: 'TEXTO' };
  assert.equal(runNode('preparar-conversacion', { ...base, mensaje_externo_id: 'wamid.B1' },
    { 'Normalizar evento WhatsApp': { evento_whatsapp: evento } }).respuesta_boton_id, 'SEG_NO');
  assert.equal(runNode('preparar-conversacion', { ...base, mensaje_externo_id: 'wamid.OTRO' },
    { 'Normalizar evento WhatsApp': { evento_whatsapp: evento } }).respuesta_boton_id, null);
  assert.equal(runNode('preparar-conversacion', { ...base, mensaje_externo_id: 'wamid.B1' }).respuesta_boton_id, null);
});

// ------------------------------------------------------
// Preparar contexto IA + Resolver contexto comercial
// ------------------------------------------------------

function contextoTurno(mensaje, ultimoSaliente = INSISTENCIA) {
  const ahora = Date.now();
  const historial = [
    { id: 1, direccion: 'ENTRANTE', tipo: 'TEXTO', contenido: '¿Precio de las etiquetas adhesivas?', mensaje_externo_id: 'w1', enviado_at: new Date(ahora - 20 * 3600e3).toISOString() },
    { id: 2, direccion: 'SALIENTE', tipo: 'TEXTO', contenido: 'Para enviarle el precio indíquenos por favor el ancho y el alto de sus etiquetas en centímetros. Con esos datos le cotizamos de inmediato.', mensaje_externo_id: null, enviado_at: new Date(ahora - 20 * 3600e3 + 60e3).toISOString() },
    { id: 3, direccion: 'SALIENTE', tipo: 'TEXTO', contenido: ultimoSaliente, mensaje_externo_id: null, enviado_at: new Date(ahora - 3600e3).toISOString() },
    { id: 4, direccion: 'ENTRANTE', tipo: 'TEXTO', contenido: mensaje, mensaje_externo_id: 'w4', enviado_at: new Date(ahora - 5e3).toISOString() }
  ];
  const turno = {
    conversacion_id: 10, continuar_procesamiento: true, turno_mensaje_ids: [4],
    turno_mensajes: [historial[3]], turno_texto: mensaje
  };
  const conversacion = {
    conversacion_id: 10, prospecto_id: 20, telefono: '593980000001', mensaje, tipo: 'TEXTO',
    mensaje_externo_id: 'w4', contexto_comercial: {}, conversacion_nueva: false
  };
  return runNode('preparar-contexto-ia', turno, {
    'Resolver turno conversacional': turno,
    'Preparar conversación': conversacion,
    'Recuperar historial conversación': historial
  });
}

function resolver(contexto) {
  return runNode('resolver-contexto-comercial', { ...contexto, ...contexto.decision }, {
    'Preparar contexto IA': contexto
  });
}

test('"Ya no, gracias" tras la insistencia: despedida fija sin IA', () => {
  const contexto = contextoTurno('Ya no, gracias');
  assert.equal(contexto.cache_faq.regla, 'INSISTENCIA_RECHAZADA');
  assert.equal(contexto.requiere_cerebro_comercial, false);
  assert.equal(contexto.decision.respuesta_sugerida, modulo.RESPUESTA_INSISTENCIA_RECHAZADA);
  const final = resolver(contexto);
  assert.equal(final.omitir_envio, false);
  assert.equal(final.requiere_humano, false);
  assert.equal(final.respuesta_sugerida, modulo.RESPUESTA_INSISTENCIA_RECHAZADA);
});

test('"Sí, quiero cotizar" tras la insistencia: pide medidas sin IA', () => {
  const contexto = contextoTurno('Sí, quiero cotizar');
  assert.equal(contexto.cache_faq.regla, 'INSISTENCIA_ACEPTADA');
  assert.equal(contexto.requiere_cerebro_comercial, false);
  assert.equal(contexto.decision.accion, 'PEDIR_MEDIDAS');
  const final = resolver(contexto);
  assert.equal(final.omitir_envio, false);
  assert.equal(final.requiere_humano, false);
  // El resolver acota con su texto aprobado porque las medidas ya se pidieron.
  assert.match(final.respuesta_sugerida, /ancho y (el )?alto/);
});

test('Con medidas sigue el flujo normal de cotización', () => {
  const contexto = contextoTurno('Sí, de 5x5 cm');
  assert.notEqual(contexto.cache_faq.regla, 'INSISTENCIA_ACEPTADA');
});

test('"No gracias" sin insistencia previa no usa la despedida', () => {
  const contexto = contextoTurno('No gracias', '¿Desea que le enviemos información del material?');
  assert.notEqual(contexto.cache_faq.regla, 'INSISTENCIA_RECHAZADA');
});
