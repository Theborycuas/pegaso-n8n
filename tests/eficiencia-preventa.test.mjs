import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { compileNode, extractNode } from '../scripts/lib/node-modules.mjs';

const load = name => fs.readFileSync(new URL(`../code/preventa/${name}.js`, import.meta.url), 'utf8');
// Mismo orden que en "Preparar contexto IA": ubicación antes de las FAQs.
const faq = new Function(`${load('ubicacion')}\n${load('preguntas-frecuentes')}\nreturn resolverFaqPreIA;`)();
const compra = new Function(`${load('cierre-comercial')}\nreturn resolverCompraPreventa;`)();
const compactar = new Function(`${load('contexto-modelo')}\nreturn construirContextoModelo;`)();

for (const message of ['que material usan', 'cual es el minimo', 'hacen envios', 'donde estan', 'incluye iva']) {
  test(`Respuesta frecuente aprobada sin llamada IA: ${message}`, () => {
    const result = faq(message);
    assert.ok(result?.respuesta);
    assert.equal(result.cache_version, 'preventa-2');
  });
}

test('Una consulta combinada atiende material, envío e IVA', () => {
  const result = faq('que material usan, hacen envios e incluye iva');
  assert.deepEqual(result.temas, ['MATERIAL_ETIQUETAS', 'IVA', 'ENVIO']);
  assert.match(result.respuesta, /Polipropileno/);
  assert.match(result.respuesta, /IVA/);
  assert.match(result.respuesta, /envíos/);
});

test('Las FAQs preservan las medidas y cantidades para el cotizador', () => {
  assert.equal(faq('10x15 cm incluye iva'), null);
  assert.equal(faq('quiero 3000 etiquetas incluye iva'), null);
});

test('La FAQ de etiquetas respeta el producto del catálogo', () => {
  assert.equal(faq('incluye iva', { productoLinea: 'TARJETAS_PRESENTACION' }), null);
});

test('Una solicitud de cuenta tiene prioridad sobre el material', () => {
  assert.equal(faq('que material usan y paseme la cuenta').accion, 'ENVIAR_DATOS_PAGO');
});

test('Sesión nueva con sí ambiguo requiere conversación', () => {
  assert.equal(compra({ mensaje: 'Sí', ultimoSaliente: '¿Desea realizar este pedido?', sesionNueva: true }), null);
});

test('Compra con una corrección pendiente llega como interés firme', () => {
  const result = compra({ mensaje: 'Hagámoslas pero cambie el tamaño', cotizacion: { estado: 'COTIZADA', cotizacion_id: 81 } });
  assert.equal(result.tipo, 'INTERES_FIRME_PARA_COORDINAR');
});

test('El contexto breve conserva hechos y limita el historial', () => {
  const data = compactar({ mensaje: 'Quiero continuar', contexto: {
    editable: { estado: 'NO_DISPONIBLE' }, cotizacion: { cotizacion_id: 81, total: 53 },
    imagen_material: { url: 'https://example.com/' + 'x'.repeat(10000) }
  }, historial: Array.from({ length: 30 }, () => ({ direccion: 'ENTRANTE', contenido: 'x'.repeat(2000) })) });
  assert.equal(data.memoria.editable.estado, 'NO_DISPONIBLE');
  assert.equal(data.memoria.cotizacion.total, 53);
  assert.equal(data.historial.length, 6);
  assert.ok(data.historial.every(item => item.contenido.length <= 450));
  assert.ok(JSON.stringify(data).length < 5000);
});

test('Un texto extenso deja señal de revisión conservando su original en el flujo', () => {
  const data = compactar({ mensaje: 'x'.repeat(10000) });
  assert.equal(data.mensaje_truncado, true);
  assert.equal(data.mensaje.length, 8000);
});

test('Compilación y extracción de módulos preservan la fuente', () => {
  const source = '// @pegaso-module code/preventa/cierre-comercial.js\nreturn 1;';
  const compiled = compileNode(source);
  assert.match(compiled, /function resolverCompraPreventa/);
  assert.equal(extractNode(compiled), source);
  assert.throws(() => extractNode(compiled.replace('function resolverCompraPreventa', 'function cambiado')), /remoto cambió/);
});

test('Los tres cerebros conservan el prompt comercial publicado', () => {
  // El prompt compacto de prompts/ es un candidato. Se activa tras evaluarlo con casos reales.
  const read = name => JSON.parse(fs.readFileSync(new URL(`../workflows/${name}`, import.meta.url), 'utf8'));
  const [published, edit] = [read('sistema-automatizado-pegaso.json'), read('sistema-automatizado-pegaso.edit.json')];
  for (const name of ['Cerebro comercial Groq', 'Cerebro comercial DeepSeek', 'Cerebro comercial OpenAI']) {
    const text = workflow => workflow.nodes.find(node => node.name === name).parameters.text;
    assert.equal(text(edit), text(published));
    // Los datos variables van al final: el texto fijo previo es un prefijo cacheable.
    assert.ok(text(edit).indexOf('{{') > text(edit).length * 0.9);
  }
});

test('Una consulta de anuncio sin propuesta continúa con el vendedor automático', () => {
  for (const message of ['Hola quiero hacer etiquetas', 'Necesito hacer unas etiquetas para mi negocio', 'Quiero hacer las etiquetas']) {
    assert.equal(compra({ mensaje: message }), null, message);
  }
});

test('Con propuesta vigente, elegir el producto es aceptación', () => {
  const result = compra({ mensaje: 'Ya, quiero hacer las etiquetas', cotizacion: { estado: 'COTIZADA', cotizacion_id: 81 } });
  assert.equal(result.tipo, 'CIERRE_COMERCIAL_ACEPTADO');
});

test('Pedido explícito sin propuesta llega como interés firme', () => {
  assert.equal(compra({ mensaje: 'Quiero hacer el pedido' }).tipo, 'INTERES_FIRME_PARA_COORDINAR');
  assert.equal(compra({ mensaje: 'Páseme la cuenta para depositar' }).tipo, 'INTERES_FIRME_PARA_COORDINAR');
});

test('Una cantidad nueva al aceptar se entrega como coordinación', () => {
  const result = compra({ mensaje: 'Hagámoslas', modificoDatos: true, cotizacion: { estado: 'COTIZADA', cotizacion_id: 81 } });
  assert.equal(result.tipo, 'INTERES_FIRME_PARA_COORDINAR');
  assert.equal(result.cambio_pendiente, true);
});

test('Las consultas y aplazamientos no se interpretan como compra', () => {
  for (const message of ['Solo estoy cotizando', 'Luego le aviso para hacer el pedido', '¿Cuánto cuesta si hago el pedido?', 'Tal vez hagámoslas la próxima semana']) {
    assert.equal(compra({ mensaje: message, cotizacion: { estado: 'COTIZADA', cotizacion_id: 81 } }), null, message);
  }
});

test('Ubicación y envío combinados preguntan la ciudad una sola vez', () => {
  const result = faq('donde estan ubicados y hacen envios');
  assert.deepEqual(result.temas, ['UBICACION', 'ENVIO']);
  assert.equal(result.respuesta.match(/Desde qué ciudad/g).length, 1);
  assert.match(result.respuesta, /^Somos de la ciudad de Quito pero no tiene de qué preocuparse/);
  assert.match(result.respuesta, /¿Desde qué ciudad nos escribe( disculpe)?\?$/);
});
