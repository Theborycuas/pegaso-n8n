import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { compileNode } from '../scripts/lib/node-modules.mjs';

// Correos de derivación vacíos: cuando "Reservar avisos humanos pendientes" no
// encontraba avisos, el nodo Postgres de n8n entregaba {"success": true} y cada
// 10 minutos salía un correo con "Sin nombre", "No disponible" y "N/D".

const wf = JSON.parse(fs.readFileSync(new URL('../workflows/sistema-automatizado-pegaso.edit.json', import.meta.url), 'utf8'));
const node = name => wf.nodes.find(n => n.name === name);

const codigo = compileNode(fs.readFileSync(new URL('../code/_extraidos/peparar-notificacion-humano.js', import.meta.url), 'utf8'));
const preparar = jsons => {
  const items = jsons.map(json => ({ json }));
  return new Function('$input', '$', codigo)({ all: () => items, first: () => items[0] }, () => {
    throw new Error('Peparar notificacion humano no debe leer otros nodos');
  });
};

test('Sin avisos pendientes no sale ningún correo', () => {
  assert.deepEqual(preparar([{ success: true }]), []);
  assert.deepEqual(preparar([{}]), []);
  assert.deepEqual(preparar([{ payload: {}, notificacion_id: 7, notificacion_reserva: 'r' }]), []);
});

test('Un aviso reservado con datos arma el correo con su reserva', () => {
  const [salida] = preparar([{
    payload: { conversacion_id: 10, prospecto_id: 20, telefono: '593999999999', handoff_motivo: 'CIERRE_COMERCIAL_ACEPTADO' },
    notificacion_id: 7,
    notificacion_reserva: 'r-7'
  }]);
  assert.equal(salida.json.notificacion_id, 7);
  assert.equal(salida.json.notificacion_reserva, 'r-7');
  assert.match(salida.json.html_notificacion, /Conversación ID: 10/);
});

test('La derivación del turno sigue enviando su correo', () => {
  const salida = preparar([
    { success: true },
    { conversacion_id: 11, prospecto_id: 21, telefono: '593988888888', handoff_motivo: 'SOLICITA_ASESOR' }
  ]);
  assert.equal(salida.length, 1);
  assert.deepEqual(salida[0].pairedItem, { item: 1 });
  assert.match(salida[0].json.html_notificacion, /593988888888/);
});

test('La reserva de avisos termina en SELECT para no emitir {"success": true}', () => {
  const query = node('Reservar avisos humanos pendientes').parameters.query
    .replace(/--.*$/gm, '').trim();
  assert.match(query, /\)\s*SELECT payload, notificacion_id, notificacion_reserva\s+FROM reservadas\s+ORDER BY notificacion_id;?$/);
});
