#!/usr/bin/env node
// Sincroniza el código de los nodos de n8n con archivos del repo.
//
//   node scripts/n8n-sync.mjs status   -> compara archivos vs workflow JSON
//   node scripts/n8n-sync.mjs extract  -> workflow JSON -> code/ prompts/ schemas/
//   node scripts/n8n-sync.mjs build    -> code/ prompts/ schemas/ -> workflow JSON
//
// Opcional: --map=workflows/pegaso-whatsapp.map.json (por defecto todos los *.map.json)

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PENDING_MARKER = '@pendiente';

const CODE_TYPES = new Set(['n8n-nodes-base.code']);
const AI_TYPES = {
  INFORMATION_EXTRACTOR: '@n8n/n8n-nodes-langchain.informationExtractor',
  CHAIN_LLM: '@n8n/n8n-nodes-langchain.chainLlm',
  AGENT: '@n8n/n8n-nodes-langchain.agent',
  OUTPUT_PARSER: '@n8n/n8n-nodes-langchain.outputParserStructured',
};

const log = {
  ok: (msg) => console.log(`  ok    ${msg}`),
  info: (msg) => console.log(`  info  ${msg}`),
  warn: (msg) => console.log(`  WARN  ${msg}`),
  err: (msg) => console.log(`  ERROR ${msg}`),
};

const normalizeEol = (text) => text.replace(/\r\n/g, '\n');
const abs = (rel) => path.join(ROOT, rel);
const readText = (rel) => normalizeEol(fs.readFileSync(abs(rel), 'utf8'));
const isPending = (text) => text.includes(PENDING_MARKER);

function writeText(rel, text) {
  fs.mkdirSync(path.dirname(abs(rel)), { recursive: true });
  fs.writeFileSync(abs(rel), text.endsWith('\n') ? text : `${text}\n`, 'utf8');
}

function loadMaps(mapArg) {
  if (mapArg) return [mapArg];
  return fs
    .readdirSync(abs('workflows'))
    .filter((f) => f.endsWith('.map.json'))
    .map((f) => `workflows/${f}`);
}

// --- Acceso a los campos editables de cada tipo de nodo -------------------

const fields = {
  code: {
    get(node) {
      if (!CODE_TYPES.has(node.type)) throw new Error(`no es un nodo Code (${node.type})`);
      if (node.parameters?.language === 'python') throw new Error('nodo Code en Python, no soportado');
      return node.parameters?.jsCode ?? '';
    },
    set(node, value) {
      node.parameters = { ...node.parameters, jsCode: value };
    },
  },

  prompts: {
    get(node) {
      return stripExpressionPrefix(getPrompt(node));
    },
    set(node, value) {
      setPrompt(node, toExpression(value));
    },
  },

  schemas: {
    get(node) {
      const key = schemaKey(node);
      const raw = node.parameters?.[key] ?? '';
      try {
        return JSON.stringify(JSON.parse(raw), null, 2);
      } catch {
        return raw;
      }
    },
    set(node, value) {
      node.parameters = { ...node.parameters, [schemaKey(node)]: value };
    },
  },
};

// En n8n un campo con expresiones {{ }} se guarda con "=" al inicio; los .md no lo llevan.
const stripExpressionPrefix = (text) => (text.startsWith('=') ? text.slice(1) : text);
const toExpression = (text) => (text.includes('{{') ? `=${text}` : text);

function getPrompt(node) {
  const p = node.parameters ?? {};
  switch (node.type) {
    case AI_TYPES.INFORMATION_EXTRACTOR:
      return p.options?.systemPromptTemplate ?? '';
    case AI_TYPES.AGENT:
      return p.options?.systemMessage ?? '';
    case AI_TYPES.CHAIN_LLM:
      return findSystemMessage(p)?.message ?? '';
    default:
      throw new Error(`tipo de nodo sin prompt soportado (${node.type})`);
  }
}

function setPrompt(node, value) {
  const p = (node.parameters ??= {});
  switch (node.type) {
    case AI_TYPES.INFORMATION_EXTRACTOR:
      p.options = { ...p.options, systemPromptTemplate: value };
      return;
    case AI_TYPES.AGENT:
      p.options = { ...p.options, systemMessage: value };
      return;
    case AI_TYPES.CHAIN_LLM: {
      const msg = findSystemMessage(p);
      if (msg) msg.message = value;
      else {
        p.messages ??= {};
        p.messages.messageValues ??= [];
        p.messages.messageValues.unshift({ message: value });
      }
      return;
    }
    default:
      throw new Error(`tipo de nodo sin prompt soportado (${node.type})`);
  }
}

function findSystemMessage(params) {
  // En chainLlm el tipo por defecto es SystemMessagePromptTemplate y n8n omite el campo.
  return params.messages?.messageValues?.find(
    (m) => (m.type ?? 'SystemMessagePromptTemplate') === 'SystemMessagePromptTemplate',
  );
}

function schemaKey(node) {
  const allowed = [AI_TYPES.INFORMATION_EXTRACTOR, AI_TYPES.OUTPUT_PARSER];
  if (!allowed.includes(node.type)) {
    throw new Error(`el schema vive en otro nodo (${node.type}); mapea el Structured Output Parser`);
  }
  const schemaType = node.parameters?.schemaType;
  if (schemaType === 'manual') return 'inputSchema';
  if (schemaType === 'fromJson') return 'jsonSchemaExample';
  throw new Error(`schemaType "${schemaType ?? 'fromAttributes'}" no usa JSON; cámbialo a "manual"`);
}

// --- Comandos ------------------------------------------------------------

function forEachMapping(map, workflow, fn) {
  const byName = new Map(workflow.nodes.map((n) => [n.name, n]));
  for (const kind of ['code', 'prompts', 'schemas']) {
    for (const [file, nodeNames] of Object.entries(map[kind] ?? {})) {
      const nodes = [];
      for (const name of nodeNames) {
        const node = byName.get(name);
        if (node) nodes.push(node);
        else log.err(`${file}: nodo "${name}" no existe en el workflow`);
      }
      fn({ kind, file, nodes, field: fields[kind] });
    }
  }
}

function safeGet(field, node, file) {
  try {
    return normalizeEol(field.get(node));
  } catch (e) {
    log.err(`${file} -> "${node.name}": ${e.message}`);
    return null;
  }
}

function status(map, workflow) {
  const mapped = new Set();
  forEachMapping(map, workflow, ({ file, nodes, field }) => {
    nodes.forEach((n) => mapped.add(n.name));
    if (!fs.existsSync(abs(file))) return log.err(`${file}: archivo no existe`);
    const local = readText(file);
    if (isPending(local)) return log.info(`${file}: pendiente (sin contenido aún)`);
    for (const node of nodes) {
      const remote = safeGet(field, node, file);
      if (remote === null) continue;
      if (remote.trimEnd() === local.trimEnd()) log.ok(`${file} == "${node.name}"`);
      else log.warn(`${file} != "${node.name}" (difiere del workflow)`);
    }
  });

  const aiTypes = new Set(Object.values(AI_TYPES));
  for (const node of workflow.nodes) {
    if ((CODE_TYPES.has(node.type) || aiTypes.has(node.type)) && !mapped.has(node.name)) {
      log.warn(`nodo sin mapear: "${node.name}" (${node.type})`);
    }
  }
}

function extract(map, workflow) {
  forEachMapping(map, workflow, ({ file, nodes, field }) => {
    const values = nodes.map((n) => safeGet(field, n, file)).filter((v) => v !== null);
    if (values.length === 0) return;
    const distinct = new Set(values.map((v) => v.trimEnd()));
    if (distinct.size > 1) {
      log.warn(`${file}: los nodos ${nodes.map((n) => `"${n.name}"`).join(', ')} tienen contenido distinto; se usó el primero. Considera separar el archivo.`);
    }
    writeText(file, values[0]);
    log.ok(`${file} <- "${nodes[0].name}"`);
  });
}

function build(map, workflow, workflowFile) {
  let changes = 0;
  forEachMapping(map, workflow, ({ file, nodes, field }) => {
    if (!fs.existsSync(abs(file))) return log.err(`${file}: archivo no existe`);
    const local = readText(file);
    if (isPending(local)) return log.info(`${file}: pendiente, se omite`);
    const value = local.trimEnd();
    for (const node of nodes) {
      const current = safeGet(field, node, file);
      if (current === null || current.trimEnd() === value) continue;
      field.set(node, value);
      changes++;
      log.ok(`${file} -> "${node.name}"`);
    }
  });
  if (changes === 0) return log.info('sin cambios');
  fs.writeFileSync(abs(workflowFile), `${JSON.stringify(workflow, null, 2)}\n`, 'utf8');
  log.info(`${changes} nodo(s) actualizados en ${workflowFile}`);
}

const COMMANDS = { status, extract, build };

function main() {
  const [command, ...rest] = process.argv.slice(2);
  const mapArg = rest.find((a) => a.startsWith('--map='))?.slice('--map='.length);
  if (!COMMANDS[command]) {
    console.log('Uso: node scripts/n8n-sync.mjs <status|extract|build> [--map=workflows/x.map.json]');
    process.exit(1);
  }

  for (const mapFile of loadMaps(mapArg)) {
    console.log(`\n[${command}] ${mapFile}`);
    const map = JSON.parse(readText(mapFile));
    if (!fs.existsSync(abs(map.workflow))) {
      log.err(`no existe ${map.workflow}. Exporta el workflow desde n8n y guárdalo con ese nombre.`);
      process.exitCode = 1;
      continue;
    }
    const workflow = JSON.parse(readText(map.workflow));
    COMMANDS[command](map, workflow, map.workflow);
  }
}

main();
