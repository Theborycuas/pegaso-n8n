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
const payload = JSON.stringify({ conversacion_id: 10, prospecto_id: 20, handoff_at: timestamp, handoff_motivo: 'CIERRE_COMERCIAL_ACEPTADO' });
const reserve = node('Reservar avisos humanos pendientes').parameters.query;
const confirm = node('Confirmar aviso humano enviado').parameters.query;
const retry = node('Programar reintento aviso humano').parameters.query;
const history = node('Recuperar historial conversacion').parameters.query;

function reset() {
  sql(`TRUNCATE pegaso.metricas_preventa, pegaso.notificaciones_humano, pegaso.mensajes, pegaso.conversaciones, pegaso.prospectos RESTART IDENTITY;
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
  // Migración obligatoria de la segunda entrega, aplicada tal como se ejecutará en producción.
  sql(fs.readFileSync(new URL('../schema/preventa-eficiencia.sql', import.meta.url), 'utf8'));
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
  const query = bind(claim, [20, payload]);
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
  sql(bind(saveContext, [10, '{"cotizacion":{"total":53}}', timestamp, null, null, null, null, null, null]));
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

test('La derivación registra su aviso en la misma operación', () => {
  reset();
  const row = sql(bind(claim, [20, payload]));
  const columns = row.split('|');
  assert.equal(columns.at(-2), '1');
  assert.ok(columns.at(-1).length > 0);
  assert.equal(sql("SELECT estado || '|' || intentos || '|' || conversacion_id || '|' || (payload->>'handoff_motivo') FROM pegaso.notificaciones_humano;"),
    'ENVIANDO|1|10|CIERRE_COMERCIAL_ACEPTADO');
  assert.equal(sql('SELECT requiere_humano FROM pegaso.prospectos;'), 't');
});

test('Dos derivaciones concurrentes dejan un solo aviso', async () => {
  reset();
  const query = bind(claim, [20, payload]);
  await Promise.all([0, 1].map(() => new Promise((resolve, reject) => {
    import('node:child_process').then(({ spawn }) => {
      const processSql = spawn('docker', ['exec', '-i', container, 'psql', '-U', 'postgres', '-X', '-qAt', '-v', 'ON_ERROR_STOP=1']);
      processSql.on('error', reject);
      processSql.on('close', code => code === 0 ? resolve() : reject(new Error(`psql ${code}`)));
      processSql.stdin.end(query);
    }, reject);
  })));
  assert.equal(sql('SELECT COUNT(*) FROM pegaso.notificaciones_humano;'), '1');
});

test('Un aviso imposible de registrar no detiene la derivación', () => {
  reset();
  sql(`INSERT INTO pegaso.notificaciones_humano (prospecto_id, conversacion_id, evento_clave, payload)
VALUES (20, 10, '${timestamp}', '{}');`);
  const result = sql(bind(claim, [20, payload]));
  assert.match(result, /^20\|t\|DERIVAR_HUMANO\|/);
  assert.match(result, /\|\|$/);
  assert.equal(sql('SELECT requiere_humano FROM pegaso.prospectos;'), 't');
});

test('Aviso sin conversación ni fecha de handoff se registra igualmente', () => {
  reset();
  sql(bind(claim, [20, JSON.stringify({ prospecto_id: 20 })]));
  assert.equal(sql('SELECT COUNT(*) FROM pegaso.notificaciones_humano WHERE conversacion_id IS NULL AND evento_clave IS NOT NULL;'), '1');
});

test('El envío confirmado cierra el aviso solo con su reserva', () => {
  reset();
  sql(bind(claim, [20, payload]));
  const reserva = sql('SELECT reserva FROM pegaso.notificaciones_humano;');
  assert.equal(sql(bind(confirm, [1, 'otra-reserva'])), '');
  assert.equal(sql(bind(confirm, [1, reserva])), '1|ENVIADA');
  // La ruta STATUSIA comparte Brevo y llega sin aviso que confirmar.
  assert.equal(sql(bind(confirm, [null, null])), '');
  sql("UPDATE pegaso.notificaciones_humano SET reservada_hasta = now() - interval '1 hour';");
  assert.equal(sql(reserve), '', 'Un aviso enviado no se reenvía');
});

test('Un fallo de correo programa el reintento y el recuperador lo reserva', () => {
  reset();
  sql(bind(claim, [20, payload]));
  const reserva = sql('SELECT reserva FROM pegaso.notificaciones_humano;');
  assert.match(sql(bind(retry, [1, reserva])), /^1\|PENDIENTE\|/);
  assert.equal(sql(reserve), '', 'Respeta la espera del reintento');
  sql("UPDATE pegaso.notificaciones_humano SET proximo_intento_at = now() - interval '1 second';");
  assert.match(sql(reserve), /"handoff_motivo": "CIERRE_COMERCIAL_ACEPTADO"/);
  assert.equal(sql("SELECT estado || '|' || intentos FROM pegaso.notificaciones_humano;"), 'ENVIANDO|2');
  assert.equal(sql(reserve), '', 'Una reserva vigente no se duplica');
  assert.notEqual(sql('SELECT reserva FROM pegaso.notificaciones_humano;'), reserva);
});

test('Un envío interrumpido se recupera cuando vence su reserva', () => {
  reset();
  sql(bind(claim, [20, payload]));
  assert.equal(sql(reserve), '');
  sql("UPDATE pegaso.notificaciones_humano SET reservada_hasta = now() - interval '1 second';");
  assert.match(sql(reserve), /CIERRE_COMERCIAL_ACEPTADO/);
});

test('La métrica de preventa se registra una vez por mensaje sin afectar el contexto', () => {
  reset();
  const values = [10, '{"cotizacion":{"total":53}}', timestamp, 'entrada-1', 'DECISION_COMPRA', null, true, false, 1200];
  assert.match(sql(bind(saveContext, values)), /^10\|20\|/);
  sql(bind(saveContext, values));
  assert.equal(sql("SELECT COUNT(*) || '|' || MIN(accion) || '|' || BOOL_AND(cache_faq) FROM pegaso.metricas_preventa;"), '1|SIN_ACCION|true');
  assert.equal(sql("SELECT contexto_comercial #>> '{cotizacion,total}' FROM pegaso.conversaciones;"), '53');
});

test('El historial acotado conserva turno, reactivación y última intervención humana', () => {
  reset();
  sql(`INSERT INTO pegaso.conversaciones VALUES (99, 20, '{}'::jsonb, NOW());
UPDATE pegaso.mensajes SET enviado_at = now() - interval '5 days';
INSERT INTO pegaso.mensajes (id, conversacion_id, direccion, contenido, mensaje_externo_id, enviado_at, procesado) VALUES
  (3, 10, 'SALIENTE', 'Hola, le atiende Evelyn', 'humano-3', now() - interval '3 days', TRUE),
  (4, 10, 'SALIENTE', '[BOT REACTIVADO POR ADMINISTRADOR]', NULL, now() - interval '2 days', TRUE),
  (5, 99, 'ENTRANTE', 'Otra conversación', 'otra-5', now(), FALSE);
SELECT setval('pegaso.mensajes_id_seq', 10);
INSERT INTO pegaso.mensajes (conversacion_id, direccion, contenido, enviado_at, procesado)
SELECT 10, 'SALIENTE', 'Mensaje ' || n, now() - interval '1 hour' + n * interval '1 second', TRUE FROM generate_series(1, 80) n;
INSERT INTO pegaso.mensajes (id, conversacion_id, direccion, contenido, mensaje_externo_id, enviado_at, procesado)
VALUES (200, 10, 'ENTRANTE', '10*15 cm', 'entrada-200', now(), FALSE);`);
  const ids = sql(bind(history, [10, 200])).split('\n').map(line => Number(line.split('|')[0]));
  assert.ok(ids.includes(200), 'Mensaje de esta ejecución');
  assert.ok(ids.includes(3), 'Última intervención humana');
  assert.ok(ids.includes(4), 'Última reactivación');
  assert.ok(!ids.includes(5), 'Solo la conversación indicada');
  assert.ok(!ids.includes(1), 'Los mensajes antiguos quedan fuera de la ventana');
  assert.equal(ids.length, 62);
  assert.deepEqual(ids.slice(0, 2), [3, 4], 'Orden cronológico');
});
