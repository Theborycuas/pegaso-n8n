import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import { after, before, test } from 'node:test';

const workflow = JSON.parse(fs.readFileSync(new URL('../workflows/sistema-automatizado-pegaso.edit.json', import.meta.url), 'utf8'));
const normalize = value => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const node = name => workflow.nodes.find(item => normalize(item.name) === name);
const container = `pegaso-preventa-test-${process.pid}-${Date.now()}`;
let created = false;

function docker(args, input) {
  const result = spawnSync('docker', args, { encoding: 'utf8', input, timeout: 30000 });
  assert.equal(result.status, 0, result.error?.message ?? result.stderr);
  return result.stdout.trim();
}

function sql(query) {
  return docker(['exec', '-i', container, 'psql', '-U', 'postgres', '-X', '-qAt', '-v', 'ON_ERROR_STOP=1'], query);
}

function bind(query, values) {
  // Literales de fixtures locales para psql. Producción usa parámetros del nodo PostgreSQL.
  return query.replace(/\$(\d+)\b/g, (_, index) => {
    const value = values[Number(index) - 1];
    return value === null ? 'NULL' : `'${String(value).replaceAll("'", "''")}'`;
  });
}

const gate = node('Autorizar salida WhatsApp 1').parameters.query;
const claim = node('Marcar prospecto requiere humano').parameters.query;
const saveContext = node('Guardar contexto comercial').parameters.query;
const insertMessage = node('Guardar mensaje entrante').parameters.query;
const timestamp = '2026-11-16T19:00:00.000Z';

function reset() {
  sql(`TRUNCATE pegaso.mensajes, pegaso.conversaciones, pegaso.prospectos RESTART IDENTITY;
INSERT INTO pegaso.prospectos VALUES (20, FALSE, NULL, NOW());
INSERT INTO pegaso.conversaciones VALUES (10, 20, '{}'::jsonb, NOW());
INSERT INTO pegaso.mensajes (id, conversacion_id, direccion, tipo, contenido, mensaje_externo_id, enviado_at, procesado)
VALUES (1, 10, 'ENTRANTE', 'TEXTO', 'Hola', 'entrada-1', NOW(), FALSE),
       (2, 10, 'SALIENTE', 'TEXTO', 'Respuesta', NULL, NOW(), TRUE);
SELECT setval('pegaso.mensajes_id_seq', 2);`);
}

before(async () => {
  // Sin puertos publicados, montajes del equipo ni conexión con servicios existentes.
  docker(['run', '--rm', '-d', '--name', container, '--network', 'none',
    '--label', 'pegaso-purpose=preventa-test', '-e', 'POSTGRES_HOST_AUTH_METHOD=trust',
    '--tmpfs', '/var/lib/postgresql/data', 'postgres:17-alpine']);
  created = true;
  let ready = false;
  for (let attempt = 0; attempt < 30; attempt++) {
    const probe = spawnSync('docker', ['exec', container, 'pg_isready', '-U', 'postgres'], { encoding: 'utf8', timeout: 10000 });
    if (probe.status === 0) { ready = true; break; }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  assert.ok(ready, 'PostgreSQL temporal debe estar listo');
  sql(`CREATE SCHEMA pegaso;
CREATE TABLE pegaso.prospectos (id bigint PRIMARY KEY, requiere_humano boolean, ultima_accion text, actualizado_at timestamptz);
CREATE TABLE pegaso.conversaciones (id bigint PRIMARY KEY, prospecto_id bigint, contexto_comercial jsonb, ultimo_mensaje_at timestamptz);
CREATE TABLE pegaso.mensajes (id bigserial PRIMARY KEY, conversacion_id bigint, cliente_id bigint,
  direccion text, tipo text, contenido text, mensaje_externo_id text, enviado_at timestamptz, procesado boolean);
CREATE UNIQUE INDEX ON pegaso.mensajes (mensaje_externo_id) WHERE mensaje_externo_id IS NOT NULL;`);
});

after(() => {
  if (created) docker(['rm', '-f', container]);
});

test('Permite la respuesta al último mensaje del prospecto', () => {
  reset();
  assert.equal(sql(bind(gate, [2, 'entrada-1', null])), 't');
});

test('Detiene la respuesta anterior cuando llegaron medidas nuevas', () => {
  reset();
  sql("INSERT INTO pegaso.mensajes (id, conversacion_id, direccion, mensaje_externo_id, contenido) VALUES (3,10,'ENTRANTE','entrada-3','10*15 cm');");
  assert.equal(sql(bind(gate, [2, 'entrada-1', null])), 'f');
});

test('Atención humana persistente detiene el envío aunque la IA haya terminado', () => {
  reset();
  sql('UPDATE pegaso.prospectos SET requiere_humano = TRUE;');
  assert.equal(sql(bind(gate, [2, 'entrada-1', null])), 'f');
});

test('El mensaje más reciente puede continuar después de cancelar la respuesta anterior', () => {
  reset();
  sql("INSERT INTO pegaso.mensajes (id, conversacion_id, direccion, mensaje_externo_id, contenido) VALUES (3,10,'ENTRANTE','entrada-3','10*15 cm'),(4,10,'SALIENTE',NULL,'Cotización');");
  assert.equal(sql(bind(gate, [2, 'entrada-1', null])), 'f');
  assert.equal(sql(bind(gate, [4, 'entrada-3', null])), 't');
});

test('Permite únicamente la transición que corresponde al handoff actual', () => {
  reset();
  sql(`UPDATE pegaso.prospectos SET requiere_humano = TRUE;
UPDATE pegaso.conversaciones SET contexto_comercial = '{"handoff":{"iniciado_at":"${timestamp}"}}';`);
  assert.equal(sql(bind(gate, [2, 'entrada-1', timestamp])), 't');
  assert.equal(sql(bind(gate, [2, 'entrada-1', '2026-11-15T00:00:00Z'])), 'f');
});

test('Humano que interviene después del mensaje frena incluso la transición', () => {
  reset();
  sql("INSERT INTO pegaso.mensajes (id, conversacion_id, direccion, mensaje_externo_id, contenido) VALUES (3,10,'SALIENTE','humano-3',NULL);");
  assert.equal(sql(bind(gate, [2, 'entrada-1', timestamp])), 'f');
});

test('Eco automático de apertura conserva la respuesta comercial', () => {
  reset();
  sql("INSERT INTO pegaso.mensajes (id, conversacion_id, direccion, mensaje_externo_id, contenido) VALUES (3,10,'SALIENTE','auto-3','[AUTOMATICO WHATSAPP BUSINESS] Hola');");
  assert.equal(sql(bind(gate, [2, 'entrada-1', null])), 't');
});

test('Ausencia de mensaje origen o destino válido termina el envío', () => {
  reset();
  assert.equal(sql(bind(gate, [2, 'otro-id', null])), 'f');
  assert.equal(sql(bind(gate, [999, 'entrada-1', null])), 'f');
});

test('Webhook duplicado devuelve una sola fila y conserva el mensaje original', () => {
  reset();
  const query = bind(insertMessage, [10, null, 'TEXTO', "Cliente O'Connor", 'nuevo-id', timestamp]);
  assert.ok(sql(query));
  assert.equal(sql(query), '');
  assert.equal(sql("SELECT COUNT(*) FROM pegaso.mensajes WHERE mensaje_externo_id='nuevo-id';"), '1');
});

test('Dos derivaciones concurrentes tienen un único ganador', async () => {
  reset();
  const query = bind(claim, [20]);
  const execute = () => new Promise((resolve, reject) => {
    // Dos procesos psql independientes contra la base temporal.
    import('node:child_process').then(({ spawn }) => {
      const processSql = spawn('docker', ['exec', '-i', container, 'psql', '-U', 'postgres', '-X', '-qAt', '-v', 'ON_ERROR_STOP=1']);
      let output = '';
      processSql.stdout.on('data', chunk => { output += chunk; });
      processSql.on('error', reject);
      processSql.on('close', code => code === 0 ? resolve(output.trim()) : reject(new Error(`psql ${code}`)));
      processSql.stdin.end(query);
    }, reject);
  });
  const results = await Promise.all([execute(), execute()]);
  assert.equal(results.filter(Boolean).length, 1);
});

test('Una ejecución comercial tardía conserva el contexto del encargado', () => {
  reset();
  sql(`UPDATE pegaso.prospectos SET requiere_humano=TRUE;
UPDATE pegaso.conversaciones SET contexto_comercial='{"handoff":{"activo":true}}';`);
  sql(bind(saveContext, [10, '{"cotizacion":{"total":53}}', timestamp]));
  assert.equal(sql("SELECT contexto_comercial #>> '{handoff,activo}' FROM pegaso.conversaciones;"), 'true');
});

test('La post-cotización conserva el handoff y puede actualizar la actividad', () => {
  reset();
  sql("UPDATE pegaso.prospectos SET requiere_humano=TRUE; UPDATE pegaso.conversaciones SET contexto_comercial='{\"handoff\":{\"activo\":true}}', ultimo_mensaje_at='2026-01-01';");
  const query = node('Guardar contexto post cotizacion').parameters.query;
  sql(bind(query, [10, '{"cotizacion":{"total":53}}']));
  assert.equal(sql("SELECT contexto_comercial #>> '{handoff,activo}' FROM pegaso.conversaciones;"), 'true');
  assert.equal(sql("SELECT ultimo_mensaje_at > '2026-01-01'::timestamptz FROM pegaso.conversaciones;"), 't');
});

test('Cada envío YCloud tiene una guardia SQL y una condición de permiso', () => {
  const senders = workflow.nodes.filter(item => item.type.endsWith('.httpRequest') && /^YCloud Enviar/.test(item.name));
  assert.equal(senders.length, 8);
  for (const sender of senders) {
    const predecessors = Object.entries(workflow.connections).filter(([, types]) => types.main?.flat().some(edge => edge.node === sender.name));
    assert.equal(predecessors.length, 1);
    const condition = workflow.nodes.find(item => item.name === predecessors[0][0]);
    assert.ok(condition.name.startsWith('IF permiso salida WhatsApp '));
    const guard = workflow.nodes.find(item => item.name === condition.name.replace('IF permiso', 'Autorizar'));
    assert.equal(guard.parameters.query, gate);
  }
});
