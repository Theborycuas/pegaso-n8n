#!/usr/bin/env node
// Ejecuta un nodo Code de n8n fuera de n8n usando un fixture.
//
//   node scripts/run-node.mjs                          -> corre todos los tests/fixtures/*.json
//   node scripts/run-node.mjs tests/fixtures/x.json    -> corre uno e imprime la salida completa
//
// Formato del fixture:
// {
//   "archivo": "code/01-entrada/normalizar-mensaje.js",
//   "descripcion": "...",
//   "input": [ { ...json del item 0 }, ... ],          -> $input / $json
//   "nodos": { "Nombre nodo": [ { ...json }, ... ] },   -> $('Nombre nodo')
//   "esperado": { ...campos que debe tener la salida[0].json },
//   "error": "texto"                                   -> en vez de esperado: el nodo debe lanzar este error
// }

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FIXTURES_DIR = path.join(ROOT, 'tests', 'fixtures');
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;

const toItems = (jsons = []) => jsons.map((json) => ({ json }));

function nodeAccessor(name, jsons) {
  if (!jsons) {
    const fail = () => {
      throw new Error(`El fixture no define la salida del nodo "${name}"`);
    };
    return { isExecuted: false, all: fail, first: fail, last: fail, get item() { return fail(); } };
  }
  const items = toItems(jsons);
  return {
    isExecuted: true,
    all: () => items,
    first: () => items[0],
    last: () => items[items.length - 1],
    get item() { return items[0]; },
  };
}

export async function runNode(fixture) {
  const code = fs.readFileSync(path.join(ROOT, fixture.archivo), 'utf8');
  const items = toItems(fixture.input ?? [{}]);
  const $input = {
    all: () => items,
    first: () => items[0],
    last: () => items[items.length - 1],
    get item() { return items[0]; },
  };
  const $ = (name) => nodeAccessor(name, fixture.nodos?.[name]);
  const fn = new AsyncFunction('$input', '$json', '$', code);
  const result = await fn($input, items[0]?.json ?? {}, $);
  const list = Array.isArray(result) ? result : [result];
  return list.map((r) => (r && typeof r === 'object' && 'json' in r ? r.json : r));
}

function diff(expected, actual, prefix = '') {
  if (expected !== null && typeof expected === 'object' && !Array.isArray(expected)) {
    if (actual === null || typeof actual !== 'object') return [`${prefix || '(raíz)'}: se esperaba objeto, llegó ${JSON.stringify(actual)}`];
    return Object.entries(expected).flatMap(([k, v]) => diff(v, actual[k], prefix ? `${prefix}.${k}` : k));
  }
  return JSON.stringify(expected) === JSON.stringify(actual)
    ? []
    : [`${prefix}: esperado ${JSON.stringify(expected)}, obtenido ${JSON.stringify(actual)}`];
}

async function check(file) {
  const fixture = JSON.parse(fs.readFileSync(file, 'utf8'));
  const name = path.relative(ROOT, file);
  try {
    const output = await runNode(fixture);
    if (fixture.error) return [`${name}: se esperaba error "${fixture.error}" y el nodo terminó bien`];
    return diff(fixture.esperado ?? {}, output[0]).map((d) => `${name}: ${d}`);
  } catch (e) {
    if (fixture.error && e.message.includes(fixture.error)) return [];
    return [`${name}: error inesperado: ${e.message}`];
  }
}

async function main() {
  const arg = process.argv[2];
  if (arg) {
    const fixture = JSON.parse(fs.readFileSync(path.resolve(arg), 'utf8'));
    console.log(JSON.stringify(await runNode(fixture), null, 2));
    return;
  }

  const files = fs.readdirSync(FIXTURES_DIR).filter((f) => f.endsWith('.json')).sort();
  let failed = 0;
  for (const f of files) {
    const errors = await check(path.join(FIXTURES_DIR, f));
    if (errors.length === 0) console.log(`  ok    ${f}`);
    else {
      failed++;
      errors.forEach((e) => console.log(`  FALLA ${e}`));
    }
  }
  console.log(`\n${files.length - failed}/${files.length} fixtures correctos`);
  if (failed) process.exitCode = 1;
}

if (path.resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) main();
