import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();

const BUILD_FILE = path.join(
  ROOT,
  'build',
  'sistema-automatizado-pegaso.build.json'
);

function fail(message) {
  console.error('');
  console.error('VALIDACION FALLIDA');
  console.error(message);
  console.error('');
  process.exit(1);
}

if (!fs.existsSync(BUILD_FILE)) {
  fail('No existe el build del workflow.');
}

let raw = fs.readFileSync(
  BUILD_FILE,
  'utf8'
);

raw = raw.replace(/^\uFEFF/, '');

let workflow;

try {
  workflow = JSON.parse(raw);
} catch (error) {
  fail(
    `JSON inválido: ${error.message}`
  );
}

if (!workflow.id) {
  fail('Falta workflow.id');
}

if (!workflow.name) {
  fail('Falta workflow.name');
}

if (!Array.isArray(workflow.nodes)) {
  fail('workflow.nodes no es un array');
}

if (
  !workflow.connections ||
  typeof workflow.connections !== 'object'
) {
  fail('workflow.connections no existe');
}

const ids = new Set();
const names = new Set();

for (const node of workflow.nodes) {

  if (!node.id) {
    fail(
      `Nodo sin id: ${node.name ?? 'SIN NOMBRE'}`
    );
  }

  if (ids.has(node.id)) {
    fail(
      `Node ID duplicado: ${node.id}`
    );
  }

  ids.add(node.id);

  if (!node.name) {
    fail(
      `Nodo ${node.id} sin name`
    );
  }

  if (names.has(node.name)) {
    console.warn(
      `ADVERTENCIA: nombre duplicado: ${node.name}`
    );
  }

  names.add(node.name);
}

for (
  const sourceName
  of Object.keys(
    workflow.connections
  )
) {

  if (!names.has(sourceName)) {
    fail(
      `connections referencia origen inexistente: ${sourceName}`
    );
  }

  const outputs =
    workflow.connections[sourceName];

  for (
    const outputType
    of Object.keys(outputs)
  ) {

    const groups =
      outputs[outputType];

    for (const group of groups) {

      for (const connection of group) {

        if (
          connection?.node &&
          !names.has(connection.node)
        ) {
          fail(
            `Conexion desde "${sourceName}" apunta a nodo inexistente "${connection.node}"`
          );
        }
      }
    }
  }
}

console.log('');
console.log(
  '=============================================='
);
console.log(
  ' PEGASO N8N - VALIDACION OK'
);
console.log(
  '=============================================='
);
console.log('');
console.log(
  `Workflow: ${workflow.name}`
);
console.log(
  `Nodos: ${workflow.nodes.length}`
);
console.log(
  `Conexiones origen: ${Object.keys(workflow.connections).length}`
);
console.log('');