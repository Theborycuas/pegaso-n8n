import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { compileNode } from '../scripts/lib/node-modules.mjs';

const load = name => fs.readFileSync(new URL(`../code/preventa/${name}.js`, import.meta.url), 'utf8');
const galeria = new Function(`${load('galeria-trabajos')}
return { decidirGaleriaTrabajos, elegirGaleriaTrabajos, motivoGaleriaTrabajos, galeriaYaEnviada, pideMuestrasTrabajos };`)();
// Mismo orden que en "Preparar contexto IA".
const faq = new Function(`${load('ubicacion')}\n${load('galeria-trabajos')}\n${load('preguntas-frecuentes')}\nreturn resolverFaqPreIA;`)();
const plano = valor => String(valor).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();

const URL_BASE = 'https://pegasoadhesivos.com/wp-content/uploads/2026/11';
const CONFIG = {
  activo: true,
  galerias: [
    { clave: 'LACTEOS', palabras: ['leche', 'yogurt', 'queso', 'embutido', 'tortilla', 'comida'], medios: [`${URL_BASE}/yogurt.mp4`, { url: `${URL_BASE}/leche`, tipo: 'image' }] },
    { clave: 'AGUA', predeterminada: true, palabras: ['agua', 'botellon', 'bidon', 'detergente', 'liquido'], medios: [`${URL_BASE}/agua-1.jpg`, `${URL_BASE}/agua-2.mp4`, 'http://inseguro.com/x.jpg', `${URL_BASE}/agua-3.jpg`] }
  ]
};
const CONFIG_FILA = { clave: 'GALERIA_TRABAJOS', valor_json: CONFIG };

const RESPUESTA_CIUDAD = 'Nosotros somos de la ciudad de Quito, realizamos trabajos y envíos para todo el país 🇪🇨🚛.';
const RESPUESTA_MATERIAL = faq('que material usan').respuesta;
const RESPUESTA_CIRELES = faq('cobran cireles').respuesta;
const INTRO = 'Claro, con gusto 🤗.';
const CIERRE = 'Le adjunto varios de nuestros trabajos.';
const SEGUIMIENTO = 'Quedamos atentos de las medidas exactas para cotizarle por favor.';
const PIDE_MEDIDAS = 'Para enviarle el precio indíquenos por favor el ancho y el alto de sus etiquetas en centímetros. ¿En qué producto las va a usar?';

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

test('Se reconoce cuando el prospecto pide fotos o muestras de trabajos', () => {
  for (const texto of [
    'Buenas tardes. Puede enviarme fotos de trabajos de etiquetas de agua?', 'Quiza tiene imagenes de muestra?',
    'Ok. Tiene muestras de su trabajo en botellas de agua. Me interesa', 'me puede mandar fotos de etiquetas que hayan hecho',
    'tienen videos?', 'quisiera ver sus trabajos', 'envíeme ejemplos por favor', 'hay fotos de trabajos realizados?', 'me pasa fotos'
  ]) {
    assert.equal(galeria.pideMuestrasTrabajos(texto), true, texto);
  }
  for (const texto of [
    'Le envié la foto de mi diseño', 'le mando imagen de mi logo', 'aqui esta la foto', 'quiero ver el precio',
    'precio de las etiquetas adhesivas', 'fotos de mi trabajo las envio luego'
  ]) {
    assert.equal(galeria.pideMuestrasTrabajos(texto), false, texto);
  }
});

test('La FAQ atiende la petición de muestras sin IA', () => {
  const hit = faq(plano('Quiza tiene imagenes de muestra?'));
  assert.equal(hit.id, 'MUESTRAS_TRABAJOS');
  assert.equal(hit.respuesta, INTRO);
  assert.equal(faq(plano('Le envié la foto de mi diseño'))?.id ?? null, null);
});

test('La galería se elige por el producto que escribió el prospecto', () => {
  assert.equal(galeria.elegirGaleriaTrabajos(CONFIG, 'Precio de etiquetas para botellones y envases').clave, 'AGUA');
  assert.equal(galeria.elegirGaleriaTrabajos(CONFIG, 'son para detergente').clave, 'AGUA');
  assert.equal(galeria.elegirGaleriaTrabajos(CONFIG, 'son para yogurt de 1 litro').clave, 'LACTEOS');
  assert.equal(galeria.elegirGaleriaTrabajos(CONFIG, 'para embutidos y tortillas').clave, 'LACTEOS');
  const otra = galeria.elegirGaleriaTrabajos(CONFIG, 'etiquetas para velas');
  assert.equal(otra.clave, 'AGUA');
  assert.equal(otra.por_producto, false);
  // Solo links https; el tipo sale de la extensión o del valor declarado.
  assert.deepEqual(otra.medios.map(m => m.url), [`${URL_BASE}/agua-1.jpg`, `${URL_BASE}/agua-2.mp4`, `${URL_BASE}/agua-3.jpg`]);
  assert.deepEqual(galeria.elegirGaleriaTrabajos(CONFIG, 'yogurt').medios.map(m => m.tipo), ['video', 'image']);
  assert.equal(galeria.elegirGaleriaTrabajos(CONFIG, 'aguacate').por_producto, false);
});

const decidir = opciones => galeria.decidirGaleriaTrabajos({
  config: CONFIG, accion: 'RESPONDER_GENERAL', permitido: true, contextoAnterior: {}, historial: [], ...opciones
});

test('Pide fotos con producto conocido: galería de su producto, una sola vez', () => {
  const mensaje = 'Puede enviarme fotos de trabajos de etiquetas de agua?';
  const pedido = decidir({ textoTurno: mensaje, textoProspecto: mensaje, respuesta: INTRO });
  assert.equal(pedido.galeria.clave, 'AGUA');
  assert.equal(pedido.galeria.motivo, 'SOLICITUD');
  assert.equal(pedido.texto, INTRO);
  assert.equal(pedido.galeria.texto_cierre, `${CIERRE}\n\n${SEGUIMIENTO}`);
  assert.deepEqual(pedido.estado.claves_enviadas, ['AGUA']);

  // Con medidas ya conocidas no vuelve a pedir medidas.
  assert.equal(decidir({ textoTurno: 'tienen fotos?', textoProspecto: 'agua', medidasConocidas: true }).galeria.texto_cierre, CIERRE);

  // Vuelve a pedir: no se repite la galería.
  const otraVez = decidir({ textoTurno: 'tiene mas fotos?', textoProspecto: 'agua', contextoAnterior: { galeria_trabajos: pedido.estado } });
  assert.equal(otraVez.galeria, null);
  assert.match(otraVez.texto, /^Más arriba le compartimos varios de nuestros trabajos/);

  // Pide la de otro producto: sí sale esa.
  const lacteos = decidir({ textoTurno: 'tiene fotos de etiquetas de yogurt?', textoProspecto: 'agua yogurt', contextoAnterior: { galeria_trabajos: pedido.estado } });
  assert.equal(lacteos.galeria.clave, 'LACTEOS');
  assert.deepEqual(lacteos.estado.claves_enviadas, ['AGUA', 'LACTEOS']);
});

test('Pide fotos sin producto claro: pregunta y envía según lo que responda', () => {
  const pregunta = decidir({ textoTurno: 'Quiza tiene imagenes de muestra?', textoProspecto: 'Precio de las etiquetas adhesivas? Quiza tiene imagenes de muestra?' });
  assert.equal(pregunta.galeria, null);
  assert.match(pregunta.texto, /¿Para qué producto son sus etiquetas\?$/);
  assert.equal(pregunta.estado.pendiente_producto, 'SOLICITUD');

  const embutidos = decidir({ textoTurno: 'son para embutidos', textoProspecto: 'son para embutidos', contextoAnterior: { galeria_trabajos: pregunta.estado } });
  assert.equal(embutidos.galeria.clave, 'LACTEOS');
  assert.equal(embutidos.galeria.motivo, 'PRODUCTO_INDICADO');
  assert.equal(embutidos.texto, 'Perfecto 👌.');
  assert.equal(embutidos.estado.pendiente_producto, null);

  // Un producto sin palabra conocida recibe la galería predeterminada.
  const velas = decidir({ textoTurno: 'para velas aromaticas', textoProspecto: 'para velas aromaticas', contextoAnterior: { galeria_trabajos: pregunta.estado } });
  assert.equal(velas.galeria.clave, 'AGUA');
});

test('El enganche sin producto claro espera a que lo nombre', () => {
  const material = decidir({ textoTurno: 'que material son', textoProspecto: 'precio de etiquetas que material son', respuesta: RESPUESTA_MATERIAL, accion: 'INFORMAR_MATERIAL' });
  assert.equal(material.galeria, null);
  assert.equal(material.texto, null);
  assert.equal(material.estado.pendiente_producto, 'ENGANCHE');

  // Nombra un producto conocido más adelante: sale su galería.
  const detergente = decidir({ textoTurno: 'es para detergente liquido', textoProspecto: 'es para detergente liquido', contextoAnterior: { galeria_trabajos: material.estado }, accion: 'PEDIR_MEDIDAS', respuesta: PIDE_MEDIDAS });
  assert.equal(detergente.galeria.clave, 'AGUA');

  // Un producto sin galería no recibe una al azar.
  assert.equal(decidir({ textoTurno: 'para velas', textoProspecto: 'para velas', contextoAnterior: { galeria_trabajos: material.estado } }), null);

  // Con producto conocido, el enganche envía sin texto adicional.
  const ciudad = decidir({ textoTurno: 'Cuenca', textoProspecto: 'botellones Cuenca', respuesta: RESPUESTA_CIUDAD });
  assert.equal(ciudad.galeria.clave, 'AGUA');
  assert.equal(ciudad.galeria.motivo, 'CIUDAD');
  assert.equal(ciudad.texto, null);
  assert.equal(ciudad.galeria.texto_cierre, CIERRE);
});

test('La galería no se repite si ya salió o la envió un asesor', () => {
  const base = { textoTurno: 'que material son', textoProspecto: 'agua', respuesta: RESPUESTA_MATERIAL };
  assert.equal(decidir(base).galeria.clave, 'AGUA');
  assert.equal(decidir({ ...base, contextoAnterior: { galeria_trabajos: { clave: 'AGUA', enviada_at: '2026-11-17T10:00:00Z' } } }), null);
  assert.equal(decidir({ ...base, historial: [{ direccion: 'SALIENTE', contenido: CIERRE }] }), null);
  assert.equal(decidir({ ...base, historial: [{ direccion: 'ENTRANTE', contenido: 'le adjunto varios de nuestros trabajos' }] }).galeria.clave, 'AGUA');
  // Si el asesor ya la envió y vuelve a pedir fotos, se le recuerda.
  const pide = decidir({ textoTurno: 'tiene fotos?', textoProspecto: 'agua', historial: [{ direccion: 'SALIENTE', contenido: CIERRE }] });
  assert.equal(pide.galeria, null);
  assert.match(pide.texto, /^Más arriba/);
});

test('Sin configuración activa, en cotización o derivación no sale la galería', () => {
  const base = { textoTurno: 'tienen fotos de trabajos?', textoProspecto: 'agua' };
  assert.ok(decidir(base).galeria);
  assert.equal(decidir({ ...base, config: { ...CONFIG, activo: false } }), null);
  assert.equal(decidir({ ...base, config: {} }), null);
  assert.equal(decidir({ ...base, permitido: false }), null);
  for (const accion of ['COTIZAR_P4', 'DERIVAR_HUMANO', 'ENVIAR_DATOS_PAGO']) {
    assert.equal(decidir({ ...base, accion }), null, accion);
  }
  assert.equal(decidir({ ...base, config: { activo: true, galerias: [{ clave: 'X', palabras: ['agua'], medios: ['http://x.jpg'] }] } }).galeria, null);
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

function resolver({ mensaje, accion, respuesta, contexto = {}, historial = [], config = [CONFIG_FILA], regla = null }) {
  const context = {
    conversacion_id: 10, prospecto_id: 20, telefono: '593000000000', regla_pre_ia: regla,
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
  assert.equal(out.texto_cierre_galeria, CIERRE);
  assert.equal(out.respuesta_sugerida, RESPUESTA_MATERIAL);
  assert.equal(out.contexto_comercial.galeria_trabajos.motivo, 'MATERIAL');
  assert.ok(out.contexto_comercial.galeria_trabajos.enviada_at);
});

test('Captura: pide fotos de etiquetas de agua y recibe la galería de agua', () => {
  const out = resolver({
    mensaje: 'Buenas tardes. Puede enviarme fotos de trabajos de etiquetas de agua?',
    accion: 'RESPONDER_GENERAL', respuesta: INTRO, regla: 'FAQ_MUESTRAS_TRABAJOS'
  });
  assert.equal(out.respuesta_sugerida, INTRO);
  assert.equal(out.enviar_galeria_trabajos, true);
  assert.equal(out.galeria_trabajos_clave, 'AGUA');
  assert.equal(out.texto_cierre_galeria, `${CIERRE}\n\n${SEGUIMIENTO}`);
  assert.equal(out.contexto_comercial.galeria_trabajos.motivo, 'SOLICITUD');
});

test('Captura: "¿tiene imágenes de muestra?" sin producto pregunta cuál es y luego envía', () => {
  // El cerebro había respondido pidiendo medidas: la pregunta del producto toma su lugar.
  const pregunta = resolver({
    mensaje: 'Quiza tiene imagenes de muestra?', accion: 'PEDIR_MEDIDAS', respuesta: PIDE_MEDIDAS,
    historial: [{ direccion: 'ENTRANTE', contenido: '¿Precio de las etiquetas adhesivas?' }]
  });
  assert.equal(pregunta.enviar_galeria_trabajos, false);
  assert.equal(pregunta.respuesta_sugerida, 'Con gusto le compartimos fotos de nuestros trabajos 🤗. ¿Para qué producto son sus etiquetas?');
  assert.equal(pregunta.contexto_comercial.galeria_trabajos.pendiente_producto, 'SOLICITUD');

  const respuesta = resolver({
    mensaje: 'Son para yogurt', accion: 'PEDIR_MEDIDAS', respuesta: PIDE_MEDIDAS,
    contexto: pregunta.contexto_comercial,
    historial: [{ direccion: 'ENTRANTE', contenido: 'Quiza tiene imagenes de muestra?' }]
  });
  assert.equal(respuesta.enviar_galeria_trabajos, true);
  assert.equal(respuesta.galeria_trabajos_clave, 'LACTEOS');
  assert.equal(respuesta.respuesta_sugerida, 'Perfecto 👌.');
  assert.equal(respuesta.texto_cierre_galeria, `${CIERRE}\n\n${SEGUIMIENTO}`);
  assert.equal(respuesta.contexto_comercial.galeria_trabajos.pendiente_producto, null);
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

test('El envío arma un request por medio, sin caption, y el cierre', () => {
  const envio = prepararEnvio({
    enviar_galeria_trabajos: true,
    galeria_trabajos_clave: 'AGUA',
    galeria_trabajos: [{ tipo: 'image', url: `${URL_BASE}/a.jpg` }, { tipo: 'video', url: `${URL_BASE}/b.mp4` }, { tipo: 'image', url: 'http://x.jpg' }],
    texto_cierre_galeria: `${CIERRE}\n\n${SEGUIMIENTO}`
  });
  assert.equal(envio.enviar_whatsapp, true);
  assert.equal(envio.enviar_galeria_trabajos, true);
  assert.deepEqual(envio.galeria_trabajos.map(m => m.body.type), ['image', 'video']);
  assert.deepEqual(envio.galeria_trabajos[1].body.video, { link: `${URL_BASE}/b.mp4` });
  assert.equal(envio.galeria_trabajos[0].body.image.caption, undefined);
  assert.equal(envio.ycloud_request_cierre_galeria.body.text.body, `${CIERRE}\n\n${SEGUIMIENTO}`);
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
  // Cada medio y el cierre pasan por la guardia de salida común (convención "Autorizar salida WhatsApp N").
  assert.deepEqual(next('IF: ¿Enviar galería trabajos?'), ['Preparar galería trabajos']);
  assert.deepEqual(next('Preparar galería trabajos'), ['Autorizar salida WhatsApp 9']);
  assert.deepEqual(next('Autorizar salida WhatsApp 9'), ['IF permiso salida WhatsApp 9']);
  assert.deepEqual(next('IF permiso salida WhatsApp 9'), ['YCloud Enviar galería trabajos']);
  assert.deepEqual(next('YCloud Enviar galería trabajos'), ['Esperar cierre galería']);
  assert.deepEqual(next('Esperar cierre galería'), ['Autorizar salida WhatsApp 10']);
  assert.deepEqual(next('Autorizar salida WhatsApp 10'), ['IF permiso salida WhatsApp 10']);
  assert.deepEqual(next('IF permiso salida WhatsApp 10'), ['YCloud Enviar cierre galería']);

  const envio = node('YCloud Enviar galería trabajos');
  assert.deepEqual(envio.parameters.options.batching.batch, { batchSize: 1, batchInterval: 600 });
  assert.match(envio.parameters.jsonBody, /\$\('Preparar galería trabajos'\)\.all\(\)\[\$itemIndex\]\.json\.body/);
  assert.equal(envio.onError, 'continueRegularOutput');
  assert.equal(envio.credentials.httpHeaderAuth.name, 'YCloud API');
  assert.equal(node('Esperar cierre galería').executeOnce, true);
  assert.equal(node('YCloud Enviar cierre galería').onError, 'continueRegularOutput');
  for (const guardia of ['Autorizar salida WhatsApp 9', 'Autorizar salida WhatsApp 10']) {
    assert.equal(node(guardia).parameters.query, node('Autorizar salida WhatsApp 8').parameters.query);
  }
});
