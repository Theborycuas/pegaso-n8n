import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { compileNode } from '../scripts/lib/node-modules.mjs';

const sources = new Map();
function runNode(file, input, nodes = {}) {
  if (!sources.has(file)) {
    sources.set(file, new Function('$input', '$', compileNode(fs.readFileSync(new URL(`../code/_extraidos/${file}.js`, import.meta.url), 'utf8'))));
  }
  const lookup = name => {
    if (!(name in nodes)) throw new Error(`Nodo no ejecutado: ${name}`);
    const rows = (Array.isArray(nodes[name]) ? nodes[name] : [nodes[name]]).map(json => ({ json }));
    return { isExecuted: true, first: () => rows[0], all: () => rows };
  };
  return sources.get(file)({ first: () => ({ json: input }), all: () => [{ json: input }] }, lookup)[0]?.json;
}

const quote = {
  estado: 'COTIZADA', cotizacion_id: 81, producto: 'ETIQUETAS_ADHESIVAS',
  material: 'P4', cantidad_solicitada: 1000, cantidad_cotizable: 1000,
  ancho_cm: 10, alto_cm: 7, forma: 'RECTANGULAR', total: 53
};

function resolve(message, { quoted = true, previous = '', action = 'RESPONDER_GENERAL', fields = {} } = {}) {
  const context = {
    conversacion_id: 10, prospecto_id: 20, telefono: '593000000000',
    mensaje_actual: message, contexto_comercial: quoted ? { cotizacion: quote } : {},
    ultimo_saliente: { contenido: previous }, ...fields
  };
  return runNode('resolver-contexto-comercial', {
    ...context, producto: 'ETIQUETAS_ADHESIVAS', accion: action,
    respuesta_sugerida: 'Con gusto le ayudamos.', ...fields
  }, { 'Preparar contexto IA': context });
}

for (const message of [
  'Está bien, hagámoslas. Ayúdeme con los datos de cuenta',
  'Quiero realizar el pedido que cotizamos',
  'Ya listo agale mañana le deposito',
  '¿Me pasa el número de cuenta para transferir?',
  'Ya entonces me da haciendo todo adhesivos',
  'No hay problema, hagámoslas'
]) {
  test(`Aceptación con cotización: ${message}`, () => {
    const result = resolve(message);
    assert.equal(result.accion, 'DERIVAR_HUMANO');
    assert.equal(result.motivo_derivacion, 'CIERRE_COMERCIAL_ACEPTADO');
    assert.equal(result.requiere_humano, true);
    assert.equal(result.requiere_notificacion, true);
    assert.equal(result.contexto_comercial.cierre_comercial.cotizacion_id, 81);
    assert.equal(result.enviar_imagen_informativa, false);
    assert.equal(result.omitir_envio, false);
  });
}

test('Intención firme con datos pendientes se entrega al encargado', () => {
  const result = resolve('Quiero realizar un pedido de etiquetas', { quoted: false });
  assert.equal(result.motivo_derivacion, 'INTERES_FIRME_PARA_COORDINAR');
  assert.equal(result.cierre_comercial.cotizacion_id, null);
});

test('Confirmación breve depende de la pregunta inmediatamente anterior', () => {
  assert.equal(resolve('Sí por favor', { previous: '¿Desea que avancemos con este pedido?' }).motivo_derivacion, 'CIERRE_COMERCIAL_ACEPTADO');
  assert.equal(resolve('Sí por favor', { previous: '¿Le envío información del material?' }).cierre_comercial, undefined);
});

for (const message of [
  'No quiero realizar el pedido todavía',
  'Solo estoy cotizando',
  'Si hago el pedido, ¿cuánto demora?',
  'Está bien pero cambie la cantidad',
  'Me gustaría saber cómo realizar un pedido',
  'Quiero hacer un logo',
  'Gracias',
  'Qué material usan y cuánto cuesta el envío'
]) {
  test(`Consulta conserva su contexto: ${message}`, () => {
    assert.equal(resolve(message, { action: 'REGISTRAR_ACEPTACION' }).cierre_comercial, undefined);
  });
}

test('Vaso de 7 onzas solicita medidas y conserva la preventa', () => {
  const result = resolve('Necesito para los vasos de 7 onzas circular y que precio tiene', { quoted: false });
  assert.notEqual(result.accion, 'DERIVAR_HUMANO');
  assert.match(result.respuesta_sugerida, /centímetros|\bcm\b/);
});

test('Medidas explícitas 10*15 cm continúan al cotizador', () => {
  const result = resolve('10*15 cm', { quoted: false, action: 'COTIZAR_P4', fields: { ancho_cm: 10, alto_cm: 15, cantidad: 1000 } });
  assert.equal(result.accion, 'COTIZAR_P4');
  assert.equal(result.ancho_cm, 10);
  assert.equal(result.alto_cm, 15);
});

test('Transición de cierre y persistencia del contexto sobreviven a los UPDATE', () => {
  const decision = resolve('Hagámoslas');
  const handoff = runNode('preparar-derivacion-humana', decision);
  const saved = runNode('preparar-contexto-handoff', { id: 20, requiere_humano: true }, { 'Preparar derivación humana': handoff });
  assert.equal(saved.contexto_comercial.handoff.activo, true);
  assert.equal(saved.contexto_comercial.handoff.cierre_comercial.tipo, 'CIERRE_COMERCIAL_ACEPTADO');
  const transition = runNode('preparar-mensaje-transicion-humano', { id: 10 }, { 'Preparar contexto handoff': saved });
  assert.match(transition.mensaje_transicion, /encargado/);
  const final = runNode('finalizar-derivacion-humana', transition, { 'Preparar mensaje transición humano': transition });
  const email = runNode('peparar-notificacion-humano', final);
  assert.equal(email.categoria_notificacion, 'CIERRE_COMERCIAL_ACEPTADO');
  assert.match(email.asunto_notificacion, /CIERRE COMERCIAL/);
  assert.match(email.mensaje_notificacion, /Cotización ID: 81/);
  assert.match(email.mensaje_notificacion, /Total cotizado: 53/);
});

test('El reintento del aviso reproduce el correo de la ruta principal', () => {
  const handoff = runNode('preparar-derivacion-humana', resolve('Hagámoslas'));
  const claimed = { id: 20, requiere_humano: true, notificacion_id: 5, notificacion_reserva: 'reserva-5' };
  const saved = runNode('preparar-contexto-handoff', claimed, { 'Preparar derivación humana': handoff });
  const transition = runNode('preparar-mensaje-transicion-humano', { id: 10 }, { 'Preparar contexto handoff': saved });
  const final = runNode('finalizar-derivacion-humana', transition, { 'Preparar mensaje transición humano': transition });
  const main = runNode('peparar-notificacion-humano', final);
  // "Marcar prospecto requiere humano" guarda como payload la salida de "Preparar derivación humana".
  const retry = runNode('peparar-notificacion-humano', { payload: handoff, notificacion_id: 5, notificacion_reserva: 'reserva-5' });
  assert.equal(main.notificacion_id, 5);
  assert.equal(main.notificacion_reserva, 'reserva-5');
  assert.equal(retry.notificacion_id, 5);
  assert.equal(retry.notificacion_reserva, 'reserva-5');
  assert.equal(retry.asunto_notificacion, main.asunto_notificacion);
  assert.equal(retry.categoria_notificacion, main.categoria_notificacion);
  assert.match(retry.mensaje_notificacion, /Cotización ID: 81/);
});

test('HTML de cierre trata el mensaje del cliente como texto', () => {
  const email = runNode('peparar-notificacion-humano', {
    handoff_motivo: 'CIERRE_COMERCIAL_ACEPTADO',
    handoff_mensaje_cliente: '<img src=x onerror=alert(1)>',
    cierre_comercial: { tipo: 'CIERRE_COMERCIAL_ACEPTADO' }
  });
  assert.ok(!email.html_notificacion.includes('<img'));
  assert.match(email.html_notificacion, /&lt;img/);
});

test('La notificación de comprobante conserva su clasificación', () => {
  const email = runNode('peparar-notificacion-humano', { handoff_motivo: 'ENVIA_COMPROBANTE' });
  assert.equal(email.categoria_notificacion, 'PAGO_REPORTADO');
  assert.equal(email.asunto_notificacion, 'SE RECIBIÓ UN COMPROBANTE DE PAGO');
});

test('Cliente registrado conserva identidad y propiedad de la conversación', () => {
  const result = runNode('resolver-prospecto', { id: 20, requiere_humano: true }, {
    'Resolver contacto': { cliente_id: 71, contacto_id: 72, telefono: '593000000000' }
  });
  assert.equal(result.cliente_id, 71);
  assert.equal(result.contacto_id, 72);
  assert.equal(result.prospecto_requiere_humano, true);
});
