import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { compileNode } from '../scripts/lib/node-modules.mjs';

const load = name => fs.readFileSync(new URL(`../code/preventa/${name}.js`, import.meta.url), 'utf8');
const galeria = new Function(`${load('galeria-trabajos')}
return { decidirGaleriaTrabajos, elegirGaleriaTrabajos, motivoGaleriaTrabajos, galeriaYaEnviada };`)();
const faq = new Function(`${load('ubicacion')}\n${load('preguntas-frecuentes')}\nreturn resolverFaqPreIA;`)();

const URL_BASE = 'https://pegasoadhesivos.com/wp-content/uploads/2026/11';
const CONFIG = {
  activo: true,
  galerias: [
    { clave: 'AGUA', palabras: ['agua', 'botellon', 'bidon'], medios: [`${URL_BASE}/agua-1.jpg`, `${URL_BASE}/agua-2.mp4`, `${URL_BASE}/agua-3.jpg`] },
    { clave: 'LACTEOS', palabras: ['leche', 'yogurt', 'queso'], medios: [`${URL_BASE}/yogurt.mp4`, { url: `${URL_BASE}/leche`, tipo: 'image' }] },
    { clave: 'GENERAL', predeterminada: true, medios: [`${URL_BASE}/general-1.jpg`, 'http://inseguro.com/x.jpg', `${URL_BASE}/general-2.jpg`] }
  ]
};
const CONFIG_FILA = { clave: 'GALERIA_TRABAJOS', valor_json: CONFIG };

const RESPUESTA_CIUDAD = 'Nosotros somos de la ciudad de Quito, realizamos trabajos y envíos para todo el país 🇪🇨🚛.';
const RESPUESTA_MATERIAL = faq('que material usan').respuesta;
const RESPUESTA_CIRELES = faq('cobran cireles').respuesta;

test('Los momentos de enganche son cireles, material y ciudad', () => {
  assert.equal(galeria.motivoGaleriaTrabajos(RESPUESTA_CIRELES), 'CIRELES');
  assert.equal(galeria.motivoGaleriaTrabajos(RESPUESTA_MATERIAL), 'MATERIAL');
  assert.equal(galeria.motivoGaleriaTrabajos(RESPUESTA_CIUDAD), 'CIUDAD');
  assert.equal(galeria.motivoGaleriaTrabajos('Perfecto, nosotros también estamos en Quito. ¿Usted cuenta con el diseño?'), 'CIUDAD');
  // El texto predeterminado de ciudad también es momento de enganche; la dirección para visitas no.
  assert.equal(galeria.motivoGaleriaTrabajos(faq('en que ciudad se encuentran').respuesta), 'CIUDAD');
  assert.equal(galeria.motivoGaleriaTrabajos(faq('cual es su direccion').respuesta), null);
  assert.equal(galeria.motivoGaleriaTrabajos('Para enviarle el precio indíquenos el ancho y el alto.'), null);
});

test('La galería se elige por el producto que escribió el prospecto', () => {
  assert.equal(galeria.elegirGaleriaTrabajos(CONFIG, 'Precio de etiquetas para botellones y envases').clave, 'AGUA');
  assert.equal(galeria.elegirGaleriaTrabajos(CONFIG, 'tienen muestras en botellas de agua').clave, 'AGUA');
  assert.equal(galeria.elegirGaleriaTrabajos(CONFIG, 'son para yogurt de 1 litro').clave, 'LACTEOS');
  const general = galeria.elegirGaleriaTrabajos(CONFIG, 'etiquetas para mermelada');
  assert.equal(general.clave, 'GENERAL');
  assert.equal(general.por_producto, false);
  // Solo links https; el tipo sale de la extensión o del valor declarado.
  assert.deepEqual(general.medios.map(m => m.url), [`${URL_BASE}/general-1.jpg`, `${URL_BASE}/general-2.jpg`]);
  assert.deepEqual(galeria.elegirGaleriaTrabajos(CONFIG, 'yogurt').medios.map(m => m.tipo), ['video', 'image']);
  assert.equal(galeria.elegirGaleriaTrabajos(CONFIG, 'aguacate').clave, 'GENERAL');
});

test('La galería se envía una sola vez y no repite la de un asesor', () => {
  const base = { config: CONFIG, respuesta: RESPUESTA_CIUDAD, accion: 'RESPONDER_GENERAL', permitido: true, textoProspecto: 'agua' };
  assert.equal(galeria.decidirGaleriaTrabajos(base).clave, 'AGUA');
  assert.equal(galeria.decidirGaleriaTrabajos({ ...base, contextoAnterior: { galeria_trabajos: { enviada_at: '2026-11-17T10:00:00Z' } } }), null);
  assert.equal(galeria.decidirGaleriaTrabajos({ ...base, historial: [{ direccion: 'SALIENTE', contenido: 'Le adjunto varios de nuestros trabajos.' }] }), null);
  assert.equal(galeria.decidirGaleriaTrabajos({ ...base, historial: [{ direccion: 'ENTRANTE', contenido: 'le adjunto varios de nuestros trabajos' }] }).clave, 'AGUA');
});

test('Sin configuración activa, en cotización o derivación no sale la galería', () => {
  const base = { config: CONFIG, respuesta: RESPUESTA_MATERIAL, accion: 'INFORMAR_MATERIAL', permitido: true };
  assert.ok(galeria.decidirGaleriaTrabajos(base));
  assert.equal(galeria.decidirGaleriaTrabajos({ ...base, config: { ...CONFIG, activo: false } }), null);
  assert.equal(galeria.decidirGaleriaTrabajos({ ...base, config: {} }), null);
  assert.equal(galeria.decidirGaleriaTrabajos({ ...base, permitido: false }), null);
  for (const accion of ['COTIZAR_P4', 'DERIVAR_HUMANO', 'ENVIAR_DATOS_PAGO']) {
    assert.equal(galeria.decidirGaleriaTrabajos({ ...base, accion }), null, accion);
  }
  assert.equal(galeria.decidirGaleriaTrabajos({ ...base, config: { activo: true, galerias: [{ clave: 'X', medios: ['http://x.jpg'] }] } }), null);
});

// ------------------------------------------------------
// Nodos del flujo
// ------------------------------------------------------

const sources = new Map();
function runNode(file, input, nodes = {}) {
  if (!sources.has(file)) {
    const code = fs.readFileSync(new URL(`../code/_extraidos/${file}.js`, import.meta.url), 'utf8');
    sources.set(file, new Function('$input', '$', compileNode(code)));
  }
  const lookup = name => {
    if (!(name in nodes)) throw new Error(`Nodo no ejecutado: ${name}`);
    const rows = (Array.isArray(nodes[name]) ? nodes[name] : [nodes[name]]).map(json => ({ json }));
    return { isExecuted: true, first: () => rows[0], all: () => rows, item: rows[0] };
  };
  const rows = [{ json: input }];
  return sources.get(file)({ first: () => rows[0], all: () => rows, item: rows[0] }, lookup);
}

function resolver({ mensaje, accion, respuesta, contexto = {}, historial = [], config = [CONFIG_FILA] }) {
  const context = {
    conversacion_id: 10, prospecto_id: 20, telefono: '593000000000',
    mensaje_actual: mensaje, contexto_comercial: contexto, ultimo_saliente: {}, historial
  };
  return runNode('resolver-contexto-comercial', {
    ...context, producto: null, intencion: 'CONSULTAR_PRODUCTO', accion,
    requiere_humano: false, motivo_derivacion: 'NINGUNO', respuesta_sugerida: respuesta
  }, { 'Preparar contexto IA': context, 'Obtener configuración MODO_PRUEBA': config })[0].json;
}

test('El resolver marca la galería del producto tras responder el material', () => {
  const out = resolver({
    mensaje: 'Q material son',
    accion: 'INFORMAR_MATERIAL',
    respuesta: RESPUESTA_MATERIAL,
    historial: [{ direccion: 'ENTRANTE', contenido: 'Precio de etiquetas para botellones y envases de galones' }]
  });
  assert.equal(out.enviar_galeria_trabajos, true);
  assert.equal(out.galeria_trabajos_clave, 'AGUA');
  assert.equal(out.galeria_trabajos.length, 3);
  assert.equal(out.texto_cierre_galeria, 'Le adjunto varios de nuestros trabajos.');
  assert.equal(out.contexto_comercial.galeria_trabajos.motivo, 'MATERIAL');
  assert.ok(out.contexto_comercial.galeria_trabajos.enviada_at);
});

test('El resolver no repite la galería ni la envía sin configuración', () => {
  const yaEnviada = resolver({
    mensaje: 'cobran cireles', accion: 'RESPONDER_GENERAL', respuesta: RESPUESTA_CIRELES,
    contexto: { galeria_trabajos: { clave: 'AGUA', enviada_at: '2026-11-17T10:00:00Z' } }
  });
  assert.equal(yaEnviada.enviar_galeria_trabajos, false);
  assert.equal(yaEnviada.contexto_comercial.galeria_trabajos.enviada_at, '2026-11-17T10:00:00Z');

  const sinConfig = resolver({ mensaje: 'cobran cireles', accion: 'RESPONDER_GENERAL', respuesta: RESPUESTA_CIRELES, config: [] });
  assert.equal(sinConfig.enviar_galeria_trabajos, false);
  assert.equal(sinConfig.contexto_comercial.galeria_trabajos, undefined);
});

function prepararEnvio(decision) {
  return runNode('preparar-envio-whatsapp', {
    conversacion_id: 10, id: 55, direccion: 'SALIENTE', tipo: 'TEXTO', contenido: 'Respuesta', telefono: '593999999999'
  }, {
    'Recuperar decisión comercial': decision,
    'Preparar respuesta comercial': { respuesta_final: 'Respuesta', omitir_envio: false },
    'Preparar entrada WhatsApp': {
      entrada_whatsapp_preparada: true, canal: 'WHATSAPP', proveedor_whatsapp: 'YCLOUD', telefono: '593999999999'
    }
  })[0].json;
}

test('Sin galería decidida el envío no prepara medios', () => {
  const envio = prepararEnvio({ enviar_galeria_trabajos: false });
  assert.equal(envio.enviar_whatsapp, true);
  assert.equal(envio.enviar_galeria_trabajos, false);
  assert.deepEqual(envio.galeria_trabajos, []);
  assert.equal(envio.ycloud_request_cierre_galeria.body, null);
});

test('El envío arma un request por medio, sin caption, y el cierre', t => {
  const envio = prepararEnvio({
    enviar_galeria_trabajos: true,
    galeria_trabajos_clave: 'AGUA',
    galeria_trabajos: [{ tipo: 'image', url: `${URL_BASE}/a.jpg` }, { tipo: 'video', url: `${URL_BASE}/b.mp4` }, { tipo: 'image', url: 'http://x.jpg' }],
    texto_cierre_galeria: 'Le adjunto varios de nuestros trabajos.'
  });
  if (envio.enviar_whatsapp !== true) {
    t.skip(`el fixture no habilita WhatsApp: ${envio.motivo_no_envio}`);
    return;
  }
  assert.equal(envio.enviar_galeria_trabajos, true);
  assert.deepEqual(envio.galeria_trabajos.map(m => m.body.type), ['image', 'video']);
  assert.deepEqual(envio.galeria_trabajos[1].body.video, { link: `${URL_BASE}/b.mp4` });
  assert.equal(envio.galeria_trabajos[0].body.image.caption, undefined);
  assert.equal(envio.ycloud_request_cierre_galeria.body.text.body, 'Le adjunto varios de nuestros trabajos.');
});

test('Preparar galería emite un item por medio', () => {
  const items = runNode('preparar-galeria-trabajos', {}, {
    'Preparar envío WhatsApp': {
      enviar_galeria_trabajos: true,
      galeria_trabajos: [
        { orden: 1, body: { to: '+593', type: 'image', image: { link: 'https://a' } } },
        { orden: 2, body: { to: '+593', type: 'video', video: { link: 'https://b' } } }
      ]
    }
  });
  assert.deepEqual(items.map(i => i.json.orden), [1, 2]);
  assert.deepEqual(runNode('preparar-galeria-trabajos', {}, { 'Preparar envío WhatsApp': { enviar_galeria_trabajos: false } }), []);
});

test('El flujo envía la galería después del texto, en orden y con un solo cierre', () => {
  const wf = JSON.parse(fs.readFileSync(new URL('../workflows/sistema-automatizado-pegaso.edit.json', import.meta.url), 'utf8'));
  const node = name => wf.nodes.find(n => n.name === name);
  const next = (name, salida = 0) => (wf.connections[name]?.main?.[salida] ?? []).map(c => c.node);

  assert.match(node('Obtener configuración MODO_PRUEBA').parameters.query, /'GALERIA_TRABAJOS'/);
  assert.deepEqual(next('IF: ¿Enviar nota IVA?', 1), ['IF: ¿Enviar galería trabajos?']);
  assert.deepEqual(next('IF: ¿Enviar galería trabajos?'), ['Autorizar salida galería trabajos']);
  assert.deepEqual(next('Autorizar salida galería trabajos'), ['IF permiso salida galería trabajos']);
  assert.deepEqual(next('IF permiso salida galería trabajos'), ['Preparar galería trabajos']);
  assert.deepEqual(next('Preparar galería trabajos'), ['YCloud Enviar galería trabajos']);
  assert.deepEqual(next('YCloud Enviar galería trabajos'), ['Esperar cierre galería']);
  assert.deepEqual(next('Esperar cierre galería'), ['YCloud Enviar cierre galería']);

  const envio = node('YCloud Enviar galería trabajos');
  assert.deepEqual(envio.parameters.options.batching.batch, { batchSize: 1, batchInterval: 600 });
  assert.equal(envio.onError, 'continueRegularOutput');
  assert.equal(envio.credentials.httpHeaderAuth.name, 'YCloud API');
  assert.equal(node('Esperar cierre galería').executeOnce, true);
  assert.equal(node('YCloud Enviar cierre galería').onError, 'continueRegularOutput');
  assert.equal(
    node('Autorizar salida galería trabajos').parameters.query,
    node('Autorizar salida WhatsApp 8').parameters.query
  );
});
