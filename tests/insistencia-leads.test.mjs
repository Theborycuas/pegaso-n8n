// Sprint 1 · Insistencia a leads de anuncio
// Respuestas de botón y anuncio de Meta en la entrada.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { compileNode } from '../scripts/lib/node-modules.mjs';

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

const ycloud = (message) => ({
  body: {
    id: 'evt-1',
    type: 'whatsapp.inbound_message.received',
    whatsappInboundMessage: {
      id: 'yc-1',
      wamid: 'wamid.CLIENTE1',
      wabaId: 'waba-1',
      from: '+593980000001',
      to: '+593960000000',
      customerProfile: { name: 'Cliente' },
      sendTime: '2026-11-17T20:00:00.000Z',
      ...message
    }
  }
});

const meta = (message) => ({
  body: {
    object: 'whatsapp_business_account',
    entry: [{
      id: 'waba-1',
      changes: [{
        field: 'messages',
        value: {
          messaging_product: 'whatsapp',
          metadata: { display_phone_number: '593960000000', phone_number_id: 'pn-1' },
          contacts: [{ wa_id: '593980000001', profile: { name: 'Cliente' } }],
          messages: [{ from: '593980000001', id: 'wamid.META1', timestamp: '1763409600', ...message }]
        }
      }]
    }]
  }
});

const normalizar = input => runNode('normalizar-evento-whatsapp', input).evento_whatsapp;
const entrada = evento => runNode('preparar-entrada-whatsapp', { evento_whatsapp: evento });

const botonSi = {
  type: 'interactive',
  interactive: { type: 'button_reply', button_reply: { id: 'SEG_SI', title: 'Sí, quiero cotizar' } }
};

test('YCloud: el botón tocado se convierte en texto del cliente', () => {
  const evento = normalizar(ycloud(botonSi));
  assert.equal(evento.procesable, true);
  assert.equal(evento.tipo_mensaje, 'interactive');
  assert.equal(evento.texto, 'Sí, quiero cotizar');
  assert.deepEqual(evento.respuesta_interactiva, { tipo: 'BOTON', id: 'SEG_SI', titulo: 'Sí, quiero cotizar' });
});

test('YCloud: el botón entra al flujo conversacional como TEXTO', () => {
  const salida = entrada(normalizar(ycloud(botonSi)));
  assert.equal(salida.tipo, 'TEXTO');
  assert.equal(salida.mensaje, 'Sí, quiero cotizar');
  assert.equal(salida.apto_para_flujo_texto, true);
  assert.equal(salida.apto_para_flujo_conversacional, true);
  assert.equal(salida.meta_whatsapp.tipo_original, 'interactive');
  assert.equal(salida.meta_whatsapp.respuesta_interactiva.id, 'SEG_SI');
});

test('YCloud: acepta nombres camelCase del proveedor', () => {
  const evento = normalizar(ycloud({
    type: 'interactive',
    interactive: { type: 'button_reply', buttonReply: { id: 'SEG_NO', title: 'Ya no, gracias' } }
  }));
  assert.equal(evento.texto, 'Ya no, gracias');
  assert.equal(evento.respuesta_interactiva.id, 'SEG_NO');
});

test('Meta directo: opción de lista y botón de plantilla', () => {
  const lista = normalizar(meta({
    type: 'interactive',
    interactive: { type: 'list_reply', list_reply: { id: 'OP_1', title: 'Etiquetas', description: 'x' } }
  }));
  assert.equal(lista.texto, 'Etiquetas');
  assert.equal(lista.respuesta_interactiva.tipo, 'LISTA');

  const plantilla = normalizar(meta({ type: 'button', button: { payload: 'SEG_SI', text: 'Sí, quiero cotizar' } }));
  assert.equal(plantilla.texto, 'Sí, quiero cotizar');
  assert.equal(plantilla.respuesta_interactiva.tipo, 'BOTON_PLANTILLA');
  assert.equal(entrada(plantilla).tipo, 'TEXTO');
});

test('Interactivo sin título sigue como entrada no soportada', () => {
  const evento = normalizar(ycloud({ type: 'interactive', interactive: { type: 'nfm_reply', nfm_reply: {} } }));
  assert.equal(evento.texto, null);
  assert.equal(evento.respuesta_interactiva, null);
  const salida = entrada(evento);
  assert.equal(salida.tipo, 'INTERACTIVO');
  assert.equal(salida.apto_para_flujo_conversacional, false);
});

test('Texto normal no cambia', () => {
  const evento = normalizar(ycloud({ type: 'text', text: { body: '10x5 cm' } }));
  assert.equal(evento.texto, '10x5 cm');
  assert.equal(evento.respuesta_interactiva, null);
  const salida = entrada(evento);
  assert.equal(salida.tipo, 'TEXTO');
  assert.equal(salida.meta_whatsapp.respuesta_interactiva, null);
});

// ------------------------------------------------------
// Preparar conversación: anuncio de Meta del mensaje
// ------------------------------------------------------

const conversacion = (extra = {}) => ({
  conversacion_id: 10, prospecto_id: 20, telefono: '593980000001',
  mensaje: '¿Precio de las etiquetas adhesivas?', tipo: 'TEXTO',
  mensaje_externo_id: 'wamid.CLIENTE1', ...extra
});

const eventoAnuncio = normalizar(ycloud({
  type: 'text',
  text: { body: '¿Precio de las etiquetas adhesivas?' },
  referral: { source_type: 'ad', source_id: '123', ctwa_clid: 'CLID-1', headline: 'Etiquetas' }
}));

test('Lead de anuncio: Preparar conversación expone fuente y ctwa_clid', () => {
  assert.equal(eventoAnuncio.es_lead_anuncio, true);
  const salida = runNode('preparar-conversacion', conversacion(), {
    'Normalizar evento WhatsApp': { evento_whatsapp: eventoAnuncio }
  });
  assert.deepEqual(salida.anuncio_meta, { fuente: 'ad', ctwa_clid: 'CLID-1' });
});

test('Anuncio de otro mensaje no se atribuye a este', () => {
  const salida = runNode('preparar-conversacion', conversacion({ mensaje_externo_id: 'wamid.OTRO' }), {
    'Normalizar evento WhatsApp': { evento_whatsapp: eventoAnuncio }
  });
  assert.equal(salida.anuncio_meta, null);
});

test('Ruta de prueba sin webhook: anuncio_meta null y sin error', () => {
  const salida = runNode('preparar-conversacion', conversacion());
  assert.equal(salida.anuncio_meta, null);
  assert.equal(salida.conversacion_id, 10);
});
