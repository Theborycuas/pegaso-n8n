import fs from 'node:fs';
import path from 'node:path';

const EDIT = path.join(
  process.cwd(),
  'workflows',
  'sistema-automatizado-pegaso.edit.json'
);

const CONSULTA = `WITH bounds AS (
  SELECT (now() AT TIME ZONE 'America/Guayaquil')::date AS hoy_ec
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
  SELECT 'DIA'::text AS periodo, base.*
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

function patchNodes(nodes) {
  if (!Array.isArray(nodes)) {
    return 0;
  }

  let n = 0;

  for (const node of nodes) {
    if (node.name !== 'Consultar uso IA STATUSIA') {
      continue;
    }

    node.parameters ??= {};
    node.parameters.query = CONSULTA;
    node.alwaysOutputData = true;
    node.onError = 'continueRegularOutput';
    n += 1;
  }

  return n;
}

const raw = fs.readFileSync(EDIT, 'utf8').replace(/^\uFEFF/, '');
const workflow = JSON.parse(raw);
const updated =
  patchNodes(workflow.nodes) +
  patchNodes(workflow.activeVersion?.nodes);

fs.writeFileSync(EDIT, JSON.stringify(workflow, null, 2) + '\n');
console.log(`OK: Consultar uso IA STATUSIA actualizado (${updated} copia/s)`);
