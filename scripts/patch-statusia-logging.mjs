/**
 * Añade logging de IA (cerebro) + comando STATUSIA al edit.json.
 * Idempotente: si los nodos ya existen, no los duplica.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const ROOT = process.cwd();
const EDIT = path.join(
  ROOT,
  'workflows',
  'sistema-automatizado-pegaso.edit.json'
);

const PREP_LOG = path.join(
  ROOT,
  'code',
  '_extraidos',
  'preparar-registro-ia.js'
);

const PREP_STATUSIA = path.join(
  ROOT,
  'code',
  '_extraidos',
  'preparar-reporte-statusia.js'
);

function readJson(file) {
  let raw = fs.readFileSync(file, 'utf8');
  raw = raw.replace(/^\uFEFF/, '');
  return JSON.parse(raw);
}

function uuid() {
  return crypto.randomUUID();
}

function stripHeader(js) {
  // El inject deja el cuerpo; aquí metemos el archivo completo
  // como jsCode (con header de archivo, igual que extract).
  return fs.readFileSync(js, 'utf8');
}

const workflow = readJson(EDIT);
const nodesByName = new Map(
  workflow.nodes.map(n => [n.name, n])
);

const PG_CRED = {
  postgres: {
    id: 'cVNzmPrhNK9kIMms',
    name: 'Postgres account 2'
  }
};

function ensureNode(def) {
  if (nodesByName.has(def.name)) {
    return nodesByName.get(def.name);
  }

  workflow.nodes.push(def);
  nodesByName.set(def.name, def);
  return def;
}

const prepLogCode =
  stripHeader(PREP_LOG);

const prepStatusiaCode =
  stripHeader(PREP_STATUSIA);

const INSERT_SQL = `INSERT INTO pegaso.ia_llamadas (
  proveedor,
  rol,
  modelo,
  exito,
  es_fallback,
  validation_reason,
  error_texto,
  tokens_estimados,
  tokens_prompt,
  tokens_completion,
  conversacion_id,
  prospecto_id,
  mensaje_resumen,
  request_resumen,
  response_json
) VALUES (
  NULLIF(TRIM('{{ $json.ia_log_proveedor }}'), ''),
  COALESCE(NULLIF(TRIM('{{ $json.ia_log_rol }}'), ''), 'CEREBRO'),
  NULLIF(TRIM('{{ $json.ia_log_modelo }}'), ''),
  (LOWER(TRIM('{{ $json.ia_log_exito }}')) IN ('true', '1', 't')),
  (LOWER(TRIM('{{ $json.ia_log_es_fallback }}')) IN ('true', '1', 't')),
  NULLIF(TRIM('{{ $json.ia_log_validation_reason }}'), ''),
  NULLIF(TRIM('{{ $json.ia_log_error_texto }}'), ''),
  NULLIF(TRIM('{{ $json.ia_log_tokens_estimados }}'), '')::int,
  NULLIF(TRIM('{{ $json.ia_log_tokens_prompt }}'), '')::int,
  NULLIF(TRIM('{{ $json.ia_log_tokens_completion }}'), '')::int,
  NULLIF(TRIM('{{ $json.ia_log_conversacion_id }}'), '')::bigint,
  NULLIF(TRIM('{{ $json.ia_log_prospecto_id }}'), '')::bigint,
  NULLIF(TRIM('{{ $json.ia_log_mensaje_resumen }}'), ''),
  NULLIF(TRIM('{{ $json.ia_log_request_resumen }}'), ''),
  NULLIF(TRIM('{{ $json.ia_log_response_json }}'), '')::jsonb
);`;

const CONSULTA_SQL = `WITH bounds AS (
  SELECT
    (now() AT TIME ZONE 'America/Guayaquil')::date AS hoy_ec
),
base AS (
  SELECT
    i.*,
    (i.creado_at AT TIME ZONE 'America/Guayaquil')::date AS dia_ec
  FROM pegaso.ia_llamadas i
  CROSS JOIN bounds b
  WHERE i.rol = 'CEREBRO'
    AND i.creado_at >= ((b.hoy_ec - 31)::timestamp AT TIME ZONE 'America/Guayaquil')
),
periodos AS (
  SELECT 'DIA'::text AS periodo, *
  FROM base, bounds
  WHERE dia_ec = hoy_ec
  UNION ALL
  SELECT 'SEMANA', base.*
  FROM base, bounds
  WHERE dia_ec >= (hoy_ec - 6)
  UNION ALL
  SELECT 'MES', base.*
  FROM base, bounds
  WHERE dia_ec >= date_trunc('month', hoy_ec)::date
)
SELECT
  periodo,
  proveedor,
  COUNT(*) FILTER (WHERE exito) AS exitos,
  COUNT(*) FILTER (WHERE NOT exito) AS fallos,
  COUNT(*) FILTER (WHERE es_fallback) AS fallbacks,
  COALESCE(SUM(tokens_estimados), 0) AS tokens_estimados_suma
FROM periodos
GROUP BY periodo, proveedor
ORDER BY
  CASE periodo WHEN 'DIA' THEN 1 WHEN 'SEMANA' THEN 2 ELSE 3 END,
  proveedor;`;

ensureNode({
  parameters: {
    jsCode: prepLogCode
  },
  id: uuid(),
  name: 'Preparar registro IA',
  type: 'n8n-nodes-base.code',
  typeVersion: 2,
  position: [-6200, 120]
});

ensureNode({
  parameters: {
    operation: 'executeQuery',
    query: INSERT_SQL,
    options: {}
  },
  id: uuid(),
  name: 'Insertar log IA',
  type: 'n8n-nodes-base.postgres',
  typeVersion: 2.7,
  position: [-6000, 120],
  credentials: PG_CRED,
  onError: 'continueRegularOutput'
});

ensureNode({
  parameters: {
    conditions: {
      options: {
        caseSensitive: true,
        leftValue: '',
        typeValidation: 'strict',
        version: 3
      },
      conditions: [
        {
          id: uuid(),
          leftValue: "={{ $json.comando_bot === 'STATUSIA' }}",
          rightValue: '',
          operator: {
            type: 'boolean',
            operation: 'true',
            singleValue: true
          }
        }
      ],
      combinator: 'and'
    },
    options: {}
  },
  id: uuid(),
  name: 'IF: ¿Comando STATUSIA?',
  type: 'n8n-nodes-base.if',
  typeVersion: 2.2,
  position: [-9920, 480]
});

ensureNode({
  parameters: {
    operation: 'executeQuery',
    query: CONSULTA_SQL,
    options: {}
  },
  id: uuid(),
  name: 'Consultar uso IA STATUSIA',
  type: 'n8n-nodes-base.postgres',
  typeVersion: 2.7,
  position: [-9680, 400],
  credentials: PG_CRED,
  onError: 'continueRegularOutput'
});

ensureNode({
  parameters: {
    jsCode: prepStatusiaCode
  },
  id: uuid(),
  name: 'Preparar reporte STATUSIA',
  type: 'n8n-nodes-base.code',
  typeVersion: 2,
  position: [-9440, 400]
});

// --- IF admin: aceptar STATUSIA ---
const ifAdmin =
  nodesByName.get('IF: ¿Comando administrador?');

if (ifAdmin?.parameters?.conditions?.conditions?.[0]) {
  ifAdmin.parameters.conditions.conditions[0].leftValue =
    `={{
  (() => {
    const evento = $json.evento_whatsapp ?? $json ?? {};

    const telefono = String(
      evento.telefono_cliente ??
      evento.from ??
      ''
    ).replace(/\\D/g, '');

    const texto = String(
      evento.texto ??
      evento.text?.body ??
      ''
    )
      .trim()
      .toUpperCase();

    const administradores = [
      '593996588558',
      '593999217750'
    ];

    return (
      administradores.includes(telefono) &&
      (
        ['STOP', 'START', 'STATUSIA'].includes(texto) ||
        /^ACTIVEBOT\\s+[+\\d][\\d\\s\\-().]*$/.test(texto)
      )
    );
  })()
}}`;
}

// --- Connections ---
const conn =
  workflow.connections;

function link(from, to, outputIndex = 0) {
  if (!conn[from]) {
    conn[from] = { main: [] };
  }

  if (!conn[from].main) {
    conn[from].main = [];
  }

  while (conn[from].main.length <= outputIndex) {
    conn[from].main.push([]);
  }

  const already =
    conn[from].main[outputIndex].some(
      c => c.node === to
    );

  if (!already) {
    conn[from].main[outputIndex].push({
      node: to,
      type: 'main',
      index: 0
    });
  }
}

// Logging paralelo (no rompe IF valid)
link(
  'Validar extracción Cerebro comercial',
  'Preparar registro IA'
);
link(
  'Validar extracción DeepSeek1',
  'Preparar registro IA'
);
link(
  'Validar extracción OpenApi1',
  'Preparar registro IA'
);
link(
  'Error ninguna IA funciono cerebro',
  'Preparar registro IA'
);
link('Preparar registro IA', 'Insertar log IA');

// STATUSIA: false de ACTIVEBOT → IF STATUSIA
// Antes: false → Actualizar MODO_PRUEBA
const ifActive =
  conn['IF: ¿Comando reactivar bot?'];

if (ifActive?.main?.[1]) {
  ifActive.main[1] = [
    {
      node: 'IF: ¿Comando STATUSIA?',
      type: 'main',
      index: 0
    }
  ];
}

link(
  'IF: ¿Comando STATUSIA?',
  'Consultar uso IA STATUSIA',
  0
);
link(
  'IF: ¿Comando STATUSIA?',
  'Actualizar configuración MODO_PRUEBA',
  1
);
link(
  'Consultar uso IA STATUSIA',
  'Preparar reporte STATUSIA'
);
link(
  'Preparar reporte STATUSIA',
  'Brevo - Enviar notificación humana'
);

fs.writeFileSync(
  EDIT,
  JSON.stringify(workflow, null, 2) + '\n',
  'utf8'
);

console.log('OK: patch STATUSIA + logging aplicado a edit.json');
