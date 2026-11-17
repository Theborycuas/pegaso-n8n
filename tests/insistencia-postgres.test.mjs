// Sprint 2 · Insistencia a leads: consultas de la rutina contra el esquema real
// (schema/pegaso_schema.sql + migraciones) en un PostgreSQL 17 temporal.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import { after, before, beforeEach, test } from 'node:test';

const workflow = JSON.parse(fs.readFileSync(new URL('../workflows/sistema-automatizado-pegaso.edit.json', import.meta.url), 'utf8'));
const query = name => {
  const node = workflow.nodes.find(item => item.name === name);
  assert.ok(node, `Falta el nodo ${name}`);
  return node.parameters.query;
};
const container = `pegaso-insistencia-test-${process.pid}-${Date.now()}`;
let created = false;

function docker(args, input) {
  const result = spawnSync('docker', args, { encoding: 'utf8', input, timeout: 60000 });
  assert.equal(result.status, 0, result.error?.message ?? result.stderr);
  return result.stdout.trim();
}
const sql = text => docker(['exec', '-i', container, 'psql', '-U', 'postgres', '-X', '-qAt', '-v', 'ON_ERROR_STOP=1'], text);
const schema = file => sql(fs.readFileSync(new URL(`../schema/${file}`, import.meta.url), 'utf8'));
function bind(text, values) {
  // Literales de fixtures locales para psql. Producción usa parámetros del nodo PostgreSQL.
  return text.replace(/\$(\d+)\b/g, (_, index) => {
    const value = values[Number(index) - 1];
    return value === null || value === undefined ? 'NULL' : `'${String(value).replaceAll("'", "''")}'`;
  });
}

const programar = ahora => sql(bind(query('Programar insistencias leads'), [ahora]));
const reservar = ahora => sql(bind(query('Reservar insistencias leads'), [ahora]));
const seguimientos = () => sql(`SELECT prospecto_id || ':' || estado FROM pegaso.seguimientos_prospecto ORDER BY prospecto_id, id;`);
const config = cambios => sql(`UPDATE pegaso.configuracion_bot SET valor_json = valor_json || '${JSON.stringify(cambios)}'::jsonb WHERE clave = 'INSISTENCIA_LEADS';`);

// Lead de anuncio: escribe a "entrante" (hora de Ecuador) y el bot responde un minuto después.
function lead(id, entrante, { origen = 'ANUNCIO_META', contexto = {}, extraEntrantes = 0, humano = false, requiereHumano = false } = {}) {
  const t = `'${entrante}'::timestamptz`;
  sql(`INSERT INTO pegaso.prospectos (id, telefono, origen, estado, requiere_humano, ultimo_anuncio_at)
       VALUES (${id}, '59398000000${id}', '${origen}', 'NUEVO', ${requiereHumano}, ${t});
     INSERT INTO pegaso.conversaciones (id, telefono, prospecto_id, contexto_comercial)
       VALUES (${id}, '59398000000${id}', ${id}, '${JSON.stringify(contexto)}');
     INSERT INTO pegaso.mensajes (conversacion_id, direccion, tipo, contenido, mensaje_externo_id, enviado_at, procesado)
     SELECT ${id}, 'ENTRANTE', 'TEXTO', 'Hola ' || g, 'w${id}-' || g, ${t} - make_interval(mins => g), TRUE
     FROM generate_series(1, ${extraEntrantes}) g;
     INSERT INTO pegaso.mensajes (conversacion_id, direccion, tipo, contenido, mensaje_externo_id, enviado_at, procesado) VALUES
       (${id}, 'ENTRANTE', 'TEXTO', '¿Precio de las etiquetas adhesivas?', 'w${id}', ${t}, TRUE),
       (${id}, 'SALIENTE', 'TEXTO', '[AUTOMATICO WHATSAPP BUSINESS · accion=PEDIR_MEDIDAS] Claro…', 'eco${id}', ${t} + interval '20 seconds', TRUE),
       (${id}, 'SALIENTE', 'TEXTO', 'Para enviarle el precio indíquenos…', NULL, ${t} + interval '1 minute', TRUE)
       ${humano ? `, (${id}, 'SALIENTE', 'TEXTO', 'Hola, le saluda Borys', 'humano${id}', ${t} + interval '2 minutes', TRUE)` : ''};`);
}

before(async () => {
  // Sin puertos publicados, montajes del equipo ni conexión con servicios existentes.
  docker(['run', '--rm', '-d', '--name', container, '--network', 'none',
    '--label', 'pegaso-purpose=insistencia-test', '-e', 'POSTGRES_HOST_AUTH_METHOD=trust',
    '--tmpfs', '/var/lib/postgresql/data', 'postgres:17-alpine']);
  created = true;
  let ready = false;
  for (let attempt = 0; attempt < 30; attempt++) {
    const probe = spawnSync('docker', ['exec', container, 'pg_isready', '-U', 'postgres'], { encoding: 'utf8', timeout: 10000 });
    if (probe.status === 0) { ready = true; break; }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  assert.ok(ready, 'PostgreSQL temporal debe estar listo');
  sql('CREATE ROLE "n8nPegaso";');
  for (const file of ['pegaso_schema.sql', 'preventa-eficiencia.sql', 'ia_llamadas.sql', 'seguimientos-leads.sql', 'purga-leads.sql']) schema(file);
});

after(() => {
  if (created) docker(['rm', '-f', container]);
});

beforeEach(() => {
  sql(`TRUNCATE pegaso.seguimientos_prospecto, pegaso.metricas_preventa, pegaso.notificaciones_humano,
         pegaso.ia_llamadas, pegaso.mensajes, pegaso.conversaciones, pegaso.prospectos RESTART IDENTITY CASCADE;
       DELETE FROM pegaso.configuracion_bot WHERE clave IN ('INSISTENCIA_LEADS', 'MODO_PRUEBA', 'PURGA_DATOS_LEADS');
       INSERT INTO pegaso.configuracion_bot (clave, valor_json) VALUES ('MODO_PRUEBA', '{"activo": false, "telefonos_permitidos": []}');`);
  schema('seguimientos-leads.sql');
  schema('purga-leads.sql');
  config({ activo: true });
});

test('La migración es idempotente y la rutina nace apagada', () => {
  schema('seguimientos-leads.sql');
  sql(`DELETE FROM pegaso.configuracion_bot WHERE clave = 'INSISTENCIA_LEADS';`);
  schema('seguimientos-leads.sql');
  assert.equal(sql(`SELECT valor_json->>'activo' FROM pegaso.configuracion_bot WHERE clave = 'INSISTENCIA_LEADS';`), 'false');
  lead(1, '2026-11-17 21:07-05');
  assert.equal(programar('2026-11-18 01:30-05'), '0|0|0|0');
});

test('La migración funciona con la secuencia de configuracion_bot atrasada', () => {
  sql(`DELETE FROM pegaso.configuracion_bot WHERE clave = 'INSISTENCIA_LEADS';
       INSERT INTO pegaso.configuracion_bot (id, clave, valor_json) VALUES (500, 'IMAGEN_PRUEBA', '{}');
       SELECT setval(pg_get_serial_sequence('pegaso.configuracion_bot', 'id'), 500, false);`);
  schema('seguimientos-leads.sql');
  assert.equal(sql(`SELECT id > 500 FROM pegaso.configuracion_bot WHERE clave = 'INSISTENCIA_LEADS';`), 't');
  sql(`DELETE FROM pegaso.configuracion_bot WHERE clave = 'IMAGEN_PRUEBA';`);
});

test('Espera 4 h y programa en la primera franja (21:07 → 10:00 del día siguiente)', () => {
  lead(1, '2026-11-17 21:07-05');
  assert.equal(programar('2026-11-17 23:00-05'), '0|0|0|0');
  assert.equal(programar('2026-11-18 01:30-05'), '0|0|1|0');
  assert.equal(sql(`SELECT to_char(programado_para AT TIME ZONE 'America/Guayaquil', 'YYYY-MM-DD HH24:MI') || '|' ||
    to_char(ventana_cierra_at AT TIME ZONE 'America/Guayaquil', 'YYYY-MM-DD HH24:MI') FROM pegaso.seguimientos_prospecto;`),
  '2026-11-18 10:00|2026-11-18 21:07');
  assert.equal(programar('2026-11-18 01:45-05'), '0|0|0|0', 'no duplica');
});

test('Dentro de una franja se programa para ese momento (07:48 → 11:48)', () => {
  lead(1, '2026-11-17 07:48-05');
  programar('2026-11-17 11:50-05');
  assert.equal(sql(`SELECT to_char(programado_para AT TIME ZONE 'America/Guayaquil', 'HH24:MI') FROM pegaso.seguimientos_prospecto;`), '11:50');
});

test('Entre franjas espera la siguiente (12:00 → 16:00 → 18:30)', () => {
  lead(1, '2026-11-17 12:00-05');
  programar('2026-11-17 16:05-05');
  assert.equal(sql(`SELECT to_char(programado_para AT TIME ZONE 'America/Guayaquil', 'HH24:MI') FROM pegaso.seguimientos_prospecto;`), '18:30');
});

test('Sin franja antes del cierre de la ventana queda EXPIRADO', () => {
  // Escribe 09:30; la espera termina 07:31 y la primera franja (10:00)
  // cae después del límite de 09:00 (ventana de 24 h menos 30 min).
  config({ espera_minima_horas: 22 });
  lead(1, '2026-11-17 09:30-05');
  assert.equal(programar('2026-11-18 07:35-05'), '0|0|0|1');
  assert.equal(seguimientos(), '1:EXPIRADO');
});

for (const [nombre, opciones] of [
  ['origen orgánico', { origen: 'WHATSAPP' }],
  ['cotización en la conversación', { contexto: { cotizacion: { total: 53, ancho_cm: 10 } } }],
  ['medidas ya dadas', { contexto: { cotizacion: { ancho_cm: 10, alto_cm: 5 } } }],
  ['derivado a humano', { contexto: { handoff: { iniciado_at: '2026-11-17T20:00:00Z' } } }],
  ['otro producto', { contexto: { producto_linea: 'TARJETAS_PRESENTACION' } }],
  ['conversó más de 2 mensajes', { extraEntrantes: 2 }],
  ['respondió un humano', { humano: true }],
  ['requiere humano', { requiereHumano: true }]
]) {
  test(`No insiste: ${nombre}`, () => {
    lead(1, '2026-11-17 21:07-05', opciones);
    assert.equal(programar('2026-11-18 01:30-05'), '0|0|0|0');
  });
}

test('No insiste a quien ya dijo "Ya no" ni dos veces en 30 días', () => {
  lead(1, '2026-11-17 21:07-05');
  lead(2, '2026-11-17 21:07-05');
  sql(`INSERT INTO pegaso.seguimientos_prospecto (prospecto_id, conversacion_id, estado, ultimo_mensaje_cliente_at, ventana_cierra_at, programado_para, creado_at)
       VALUES (1, 1, 'RECHAZADO', '2026-09-01', '2026-09-02', '2026-09-01', '2026-09-01'),
              (2, 2, 'SIN_RESPUESTA', '2026-11-10', '2026-11-11', '2026-11-10', '2026-11-10');`);
  assert.equal(programar('2026-11-18 01:30-05'), '0|0|0|0');
});

test('Un seguimiento cancelado no bloquea una nueva insistencia', () => {
  lead(1, '2026-11-17 21:07-05');
  sql(`INSERT INTO pegaso.seguimientos_prospecto (prospecto_id, conversacion_id, estado, ultimo_mensaje_cliente_at, ventana_cierra_at, programado_para, creado_at)
       VALUES (1, 1, 'CANCELADO', '2026-11-16', '2026-11-17', '2026-11-16', '2026-11-16');`);
  assert.equal(programar('2026-11-18 01:30-05'), '0|0|1|0');
});

test('Teléfonos permitidos y MODO_PRUEBA limitan a quién se insiste', () => {
  lead(1, '2026-11-17 21:07-05');
  lead(2, '2026-11-17 21:07-05');
  config({ telefonos_permitidos: ['+593 98 000 0002'] });
  assert.equal(programar('2026-11-18 01:30-05'), '0|0|1|0');
  assert.equal(seguimientos(), '2:PROGRAMADO');
  sql(`TRUNCATE pegaso.seguimientos_prospecto;`);
  config({ telefonos_permitidos: [] });
  sql(`UPDATE pegaso.configuracion_bot SET valor_json = '{"activo": true, "telefonos_permitidos": ["593980000001"]}' WHERE clave = 'MODO_PRUEBA';`);
  assert.equal(programar('2026-11-18 01:30-05'), '0|0|1|0');
  assert.equal(seguimientos(), '1:PROGRAMADO');
});

test('Solo reserva dentro de una franja y devuelve los datos del envío', () => {
  lead(1, '2026-11-17 21:07-05');
  programar('2026-11-18 01:30-05');
  assert.equal(reservar('2026-11-18 09:55-05'), '');
  const fila = reservar('2026-11-18 10:05-05').split('|');
  assert.deepEqual([fila[0], fila[2], fila[3], fila[4], fila[5], fila[6], fila[7]],
    ['1', '1', '1', '593980000001', '593962645735', 'etiquetas adhesivas', '10']);
  assert.equal(fila[1].length, 32);
  assert.equal(reservar('2026-11-18 10:20-05'), '', 'la reserva no se repite');
  assert.equal(seguimientos(), '1:ENVIANDO');
});

test('La rutina apagada no reserva', () => {
  lead(1, '2026-11-17 21:07-05');
  programar('2026-11-18 01:30-05');
  config({ activo: false });
  assert.equal(reservar('2026-11-18 10:05-05'), '');
});

test('Límite diario y por corrida', () => {
  for (const id of [1, 2, 3, 4]) lead(id, '2026-11-17 21:07-05');
  programar('2026-11-18 01:30-05');
  config({ limite_diario: 3, limite_por_corrida: 2 });
  assert.equal(reservar('2026-11-18 10:05-05').split('\n').length, 2);
  sql(`UPDATE pegaso.seguimientos_prospecto SET estado = 'ENVIADO', enviado_at = '2026-11-18 10:06-05' WHERE estado = 'ENVIANDO';`);
  assert.equal(reservar('2026-11-18 10:20-05').split('\n').length, 1);
  assert.equal(reservar('2026-11-18 10:35-05'), '');
});

test('Ventana por cerrar: EXPIRADO sin enviar', () => {
  lead(1, '2026-11-17 21:07-05');
  programar('2026-11-18 01:30-05');
  sql(`UPDATE pegaso.seguimientos_prospecto SET ventana_cierra_at = '2026-11-18 10:20-05';`);
  assert.equal(reservar('2026-11-18 10:05-05'), '');
  assert.equal(seguimientos(), '1:EXPIRADO');
});

test('Cierre a las 48 h y reservas vencidas', () => {
  lead(1, '2026-11-17 21:07-05');
  lead(2, '2026-11-17 21:07-05');
  sql(`INSERT INTO pegaso.seguimientos_prospecto (prospecto_id, conversacion_id, estado, ultimo_mensaje_cliente_at, ventana_cierra_at, programado_para, enviado_at, reservada_hasta)
       VALUES (1, 1, 'ENVIADO', '2026-11-17 21:07-05', '2026-11-18 21:07-05', '2026-11-18 10:00-05', '2026-11-18 10:00-05', NULL),
              (2, 2, 'ENVIANDO', '2026-11-17 21:07-05', '2026-11-18 21:07-05', '2026-11-18 10:00-05', NULL, '2026-11-18 10:05-05');`);
  assert.equal(programar('2026-11-20 09:00-05'), '0|1|0|0');
  assert.equal(programar('2026-11-20 10:01-05'), '1|0|0|0');
  assert.equal(seguimientos(), '1:SIN_RESPUESTA\n2:ERROR');
});

// ------------------------------------------------------
// Guardia, envío y estados (usan now() real)
// ------------------------------------------------------

function enviando(id = 1) {
  lead(id, new Date(Date.now() - 6 * 3600e3).toISOString());
  sql(`INSERT INTO pegaso.seguimientos_prospecto (prospecto_id, conversacion_id, estado, ultimo_mensaje_cliente_at, ventana_cierra_at, programado_para, reserva, reservada_hasta)
       SELECT ${id}, ${id}, 'ENVIANDO', max(enviado_at), max(enviado_at) + interval '24 hours', now(), 'R${id}', now() + interval '5 minutes'
       FROM pegaso.mensajes WHERE conversacion_id = ${id} AND direccion = 'ENTRANTE';`);
}
const autorizar = (id, reserva) => sql(bind(query('Autorizar insistencia lead'), [id, reserva, 'Texto', '{"to":"+593"}'])).split('|');

test('La guardia permite el envío y deja pasar el cuerpo', () => {
  enviando();
  const fila = autorizar(1, 'R1');
  assert.deepEqual([fila[0], fila[1], fila[2], fila[3], fila[5], fila[6]], ['1', 'R1', '1', 'Texto', 't', '']);
  assert.equal(JSON.parse(fila[4]).to, '+593');
});

for (const [motivo, preparar] of [
  ['RESERVA_PERDIDA', () => sql(`UPDATE pegaso.seguimientos_prospecto SET reserva = 'OTRA';`)],
  ['CLIENTE_ESCRIBIO', () => sql(`INSERT INTO pegaso.mensajes (conversacion_id, direccion, tipo, contenido, mensaje_externo_id, enviado_at) VALUES (1, 'ENTRANTE', 'TEXTO', '10x5', 'w-nuevo', now());`)],
  ['INTERVENCION_HUMANA', () => sql(`INSERT INTO pegaso.mensajes (conversacion_id, direccion, tipo, contenido, mensaje_externo_id, enviado_at) VALUES (1, 'SALIENTE', 'TEXTO', 'Hola', 'h-1', now());`)],
  ['ATENCION_HUMANA', () => sql(`UPDATE pegaso.prospectos SET requiere_humano = TRUE;`)],
  ['CONVERSACION_AVANZADA', () => sql(`UPDATE pegaso.conversaciones SET contexto_comercial = '{"cotizacion": {"total": 53}}';`)],
  ['VENTANA_CERRADA', () => sql(`UPDATE pegaso.seguimientos_prospecto SET ventana_cierra_at = now() + interval '2 minutes';`)]
]) {
  test(`La guardia frena el envío: ${motivo}`, () => {
    enviando();
    preparar();
    const fila = autorizar(1, 'R1');
    assert.equal(fila[5], 'f');
    assert.equal(fila[6], motivo);
    const cancelado = sql(bind(query('Cancelar insistencia lead'), [1, 'R1', motivo]));
    if (motivo === 'RESERVA_PERDIDA') assert.equal(cancelado, '');
    else assert.equal(cancelado, motivo === 'VENTANA_CERRADA' ? '1|EXPIRADO' : '1|CANCELADO');
  });
}

test('Confirmación: ENVIADO, saliente del bot sin id externo e idempotente', () => {
  enviando();
  const texto = 'Buenos días 👋 Nos escribió por etiquetas adhesivas, ¿aún le interesa?';
  const confirmar = query('Confirmar insistencia enviada');
  assert.match(sql(bind(confirmar, [1, 'R1', 'yc-1', null, texto])), /^1\|\d+$/);
  assert.equal(sql(bind(confirmar, [1, 'R1', 'yc-1', null, texto])), '');
  assert.equal(sql(`SELECT estado || '|' || mensaje_externo_id || '|' || estado_entrega || '|' || (reserva IS NULL) FROM pegaso.seguimientos_prospecto;`), 'ENVIADO|yc-1|accepted|true');
  assert.equal(sql(`SELECT count(*) FROM pegaso.mensajes WHERE direccion = 'SALIENTE' AND mensaje_externo_id IS NULL AND contenido = '${texto}';`), '1');
});

test('Error de YCloud: ERROR sin reintento', () => {
  enviando();
  assert.equal(sql(bind(query('Registrar error insistencia lead'), [1, 'R1', '400 Bad Request'])), '1|ERROR');
  assert.equal(sql(`SELECT ultimo_error FROM pegaso.seguimientos_prospecto;`), '400 Bad Request');
});

test('Estados de entrega: avanza, no retrocede y guarda el precio', () => {
  enviando();
  sql(bind(query('Confirmar insistencia enviada'), [1, 'R1', 'yc-1', null, 'Texto']));
  const estado = query('Registrar estado insistencia lead');
  assert.equal(sql(bind(estado, ['yc-1', 'wamid.1', 'delivered', 'service', null, 0, 'USD', null])), '1|delivered|0.000000');
  assert.equal(sql(bind(estado, ['yc-1', null, 'sent', null, null, null, null, null])), '1|delivered|0.000000');
  assert.equal(sql(bind(estado, ['yc-1', null, 'read', null, null, null, null, null])), '1|read|0.000000');
  assert.equal(sql(bind(estado, ['otro', null, 'read', null, null, null, null, null])), '');
});

// ------------------------------------------------------
// Respuesta del cliente (Guardar mensaje entrante)
// ------------------------------------------------------

function enviado(estado = 'ENVIADO') {
  enviando();
  sql(`UPDATE pegaso.seguimientos_prospecto SET estado = '${estado}', enviado_at = now() - interval '1 hour', reserva = NULL;`);
}
const responder = (externo, boton) => sql(bind(query('Guardar mensaje entrante'),
  [1, null, 'TEXTO', boton === 'SEG_NO' ? 'Ya no, gracias' : 'Sí, quiero cotizar', externo, new Date().toISOString(), null, null, boton]));

test('Botón "Ya no, gracias": RECHAZADO', () => {
  enviado();
  assert.ok(responder('r-1', 'SEG_NO'));
  assert.equal(sql(`SELECT estado || '|' || respuesta || '|' || (respondido_at IS NOT NULL) FROM pegaso.seguimientos_prospecto;`), 'RECHAZADO|SEG_NO|true');
});

test('Botón "Sí, quiero cotizar": RESPONDIDO', () => {
  enviado();
  responder('r-1', 'SEG_SI');
  assert.equal(sql(`SELECT estado || '|' || respuesta FROM pegaso.seguimientos_prospecto;`), 'RESPONDIDO|SEG_SI');
});

test('Respuesta escrita tardía (después del cierre a 48 h) también cuenta', () => {
  enviado('SIN_RESPUESTA');
  responder('r-1', null);
  assert.equal(sql(`SELECT estado || '|' || respuesta FROM pegaso.seguimientos_prospecto;`), 'RESPONDIDO|TEXTO');
});

test('Webhook duplicado no vuelve a marcar la respuesta', () => {
  enviado();
  responder('r-1', 'SEG_SI');
  sql(`UPDATE pegaso.seguimientos_prospecto SET respuesta = 'MARCA';`);
  assert.equal(responder('r-1', 'SEG_NO'), '');
  assert.equal(sql(`SELECT estado || '|' || respuesta FROM pegaso.seguimientos_prospecto;`), 'RESPONDIDO|MARCA');
});

// ------------------------------------------------------
// Sprint 3 · Purga a 180 días (Anonimizar leads inactivos)
// ------------------------------------------------------

const AHORA_PURGA = '2027-07-01 03:30-05'; // 226 días después de los mensajes, 03:xx en Ecuador
const purga = cambios => sql(`UPDATE pegaso.configuracion_bot SET valor_json = valor_json || '${JSON.stringify(cambios)}'::jsonb WHERE clave = 'PURGA_DATOS_LEADS';`);
const anonimizar = (ahora = AHORA_PURGA) => sql(bind(query('Anonimizar leads inactivos'), [ahora]));

// Lead cerrado por la insistencia, con llamada a IA, aviso interno y métrica.
function leadCerrado(id, { estado = 'SIN_RESPUESTA', ...opciones } = {}) {
  lead(id, '2026-11-17 21:07-05', opciones);
  sql(`INSERT INTO pegaso.seguimientos_prospecto (prospecto_id, conversacion_id, estado, ultimo_mensaje_cliente_at, ventana_cierra_at, programado_para, enviado_at, creado_at)
       VALUES (${id}, ${id}, '${estado}', '2026-11-17 21:07-05', '2026-11-18 21:07-05', '2026-11-18 10:00-05', '2026-11-18 10:00-05', '2026-11-18 01:30-05');
     UPDATE pegaso.prospectos SET nombre_whatsapp = 'Cliente ${id}', ciudad = 'Quito', ultimo_ctwa_clid = 'CLID' WHERE id = ${id};
     INSERT INTO pegaso.ia_llamadas (proveedor, conversacion_id, prospecto_id, mensaje_resumen) VALUES ('GROQ', ${id}, ${id}, 'Precio de etiquetas');
     INSERT INTO pegaso.notificaciones_humano (prospecto_id, conversacion_id, evento_clave, payload) VALUES (${id}, ${id}, 'k${id}', '{"telefono": "x"}');
     INSERT INTO pegaso.metricas_preventa (mensaje_externo_id, conversacion_id, calificacion, accion, cache_faq, cerebro_requerido, caracteres_contexto, duracion_preparacion_ms)
       VALUES ('w${id}', ${id}, 'CONSULTA', 'PEDIR_MEDIDAS', TRUE, FALSE, 0, 0);`);
}

test('La purga nace apagada y en simulación', () => {
  leadCerrado(1);
  assert.equal(sql(`SELECT (valor_json->>'activo') || '|' || (valor_json->>'simulacion') FROM pegaso.configuracion_bot WHERE clave = 'PURGA_DATOS_LEADS';`), 'false|true');
  assert.equal(anonimizar(), 't|0|0|0|0|0|0');
});

test('En simulación solo cuenta candidatos', () => {
  leadCerrado(1);
  purga({ activo: true });
  assert.equal(anonimizar(), 't|1|0|0|0|0|0');
  assert.equal(sql('SELECT telefono FROM pegaso.prospectos;'), '593980000001');
});

test('Fuera de la hora configurada no hace nada', () => {
  leadCerrado(1);
  purga({ activo: true, simulacion: false });
  assert.equal(anonimizar('2027-07-01 10:00-05'), 'f|0|0|0|0|0|0');
});

test('Anonimiza el lead cerrado y conserva seguimientos y métricas', () => {
  leadCerrado(1);
  purga({ activo: true, simulacion: false });
  assert.equal(anonimizar(), 'f|1|1|1|3|1|1');
  assert.equal(sql(`SELECT telefono || '|' || COALESCE(nombre_whatsapp, '-') || '|' || COALESCE(ciudad, '-') || '|' ||
    COALESCE(ultimo_ctwa_clid, '-') || '|' || activo || '|' || (anonimizado_at IS NOT NULL) FROM pegaso.prospectos;`),
  'ANON-1|-|-|-|false|true');
  assert.equal(sql(`SELECT telefono || '|' || contexto_comercial::text FROM pegaso.conversaciones;`), 'ANON-1|{}');
  assert.equal(sql(`SELECT (SELECT count(*) FROM pegaso.mensajes) || '|' || (SELECT count(*) FROM pegaso.ia_llamadas) || '|' ||
    (SELECT count(*) FROM pegaso.notificaciones_humano);`), '0|0|0');
  assert.equal(sql(`SELECT (SELECT count(*) FROM pegaso.seguimientos_prospecto) || '|' || (SELECT count(*) FROM pegaso.metricas_preventa);`), '1|1');
  assert.equal(anonimizar(), 'f|0|0|0|0|0|0', 'idempotente');
  // Si la persona vuelve a escribir, se crea un prospecto nuevo con su número.
  sql(`INSERT INTO pegaso.prospectos (id, telefono, origen) VALUES (99, '593980000001', 'ANUNCIO_META');`);
});

test('Rechazado y expirado también se anonimizan', () => {
  leadCerrado(1, { estado: 'RECHAZADO' });
  leadCerrado(2, { estado: 'EXPIRADO' });
  purga({ activo: true, simulacion: false });
  assert.equal(anonimizar().split('|')[2], '2');
});

for (const [nombre, preparar] of [
  ['mensaje reciente', () => sql(`INSERT INTO pegaso.mensajes (conversacion_id, direccion, tipo, contenido, enviado_at) VALUES (1, 'ENTRANTE', 'TEXTO', 'Hola', '2027-06-01');`)],
  ['respondió la insistencia', () => sql(`UPDATE pegaso.seguimientos_prospecto SET estado = 'RESPONDIDO';`)],
  ['cotización', () => sql(`UPDATE pegaso.conversaciones SET contexto_comercial = '{"cotizacion": {"total": 53}}';`)],
  ['cliente registrado', () => sql(`INSERT INTO pegaso.clientes (id, nombre) VALUES (1, 'Cliente') ON CONFLICT DO NOTHING; UPDATE pegaso.conversaciones SET cliente_id = 1;`)],
  ['intervención humana', () => sql(`INSERT INTO pegaso.mensajes (conversacion_id, direccion, tipo, contenido, mensaje_externo_id, enviado_at) VALUES (1, 'SALIENTE', 'TEXTO', 'Hola', 'h1', '2026-11-18');`)],
  ['requiere humano', () => sql('UPDATE pegaso.prospectos SET requiere_humano = TRUE;')]
]) {
  test(`La purga no toca: ${nombre}`, () => {
    leadCerrado(1);
    preparar();
    purga({ activo: true, simulacion: false });
    assert.equal(anonimizar().split('|')[1], '0');
    assert.equal(sql('SELECT telefono FROM pegaso.prospectos ORDER BY id LIMIT 1;'), '593980000001');
  });
}
