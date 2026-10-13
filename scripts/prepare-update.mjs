import fs from 'node:fs';
import path from 'node:path';

// ======================================================
// PEGASO N8N - PREPARE UPDATE
// ======================================================
//
// RESPONSABILIDAD:
// - Leer el workflow ya construido desde /build.
// - Generar un payload compatible con n8n Public API.
// - Excluir campos de solo lectura.
// - Evitar enviar description: null.
// - Mantener únicamente campos permitidos/relevantes.
// - Guardar el payload final que consumirá push.ps1.
//
// NO modifica producción.
// ======================================================

const ROOT = process.cwd();

const BUILD_FILE = path.join(
  ROOT,
  'build',
  'sistema-automatizado-pegaso.build.json'
);

const UPDATE_FILE = path.join(
  ROOT,
  'build',
  'sistema-automatizado-pegaso.update.json'
);

// ======================================================
// UTILIDADES
// ======================================================

function readJson(file) {
  let raw = fs.readFileSync(file, 'utf8');

  // Eliminar BOM UTF-8 si existiera.
  raw = raw.replace(/^\uFEFF/, '');

  return JSON.parse(raw);
}

function hasOwn(object, property) {
  return Object.prototype.hasOwnProperty.call(
    object,
    property
  );
}

// ======================================================
// VALIDAR ARCHIVO DE ENTRADA
// ======================================================

if (!fs.existsSync(BUILD_FILE)) {
  throw new Error(
    `No existe el build: ${BUILD_FILE}`
  );
}

// ======================================================
// LEER WORKFLOW
// ======================================================

let workflow;

try {
  workflow = readJson(BUILD_FILE);
} catch (error) {
  throw new Error(
    `No se pudo leer el build JSON: ${error.message}`
  );
}

// ======================================================
// VALIDACIONES BASE
// ======================================================

if (
  typeof workflow.name !== 'string' ||
  workflow.name.trim() === ''
) {
  throw new Error(
    'workflow.name es obligatorio y debe ser string.'
  );
}

if (!Array.isArray(workflow.nodes)) {
  throw new Error(
    'workflow.nodes debe ser un array.'
  );
}

if (
  !workflow.connections ||
  typeof workflow.connections !== 'object' ||
  Array.isArray(workflow.connections)
) {
  throw new Error(
    'workflow.connections debe ser un objeto.'
  );
}

if (
  workflow.settings !== undefined &&
  (
    workflow.settings === null ||
    typeof workflow.settings !== 'object' ||
    Array.isArray(workflow.settings)
  )
) {
  throw new Error(
    'workflow.settings debe ser un objeto cuando existe.'
  );
}

// ======================================================
// PAYLOAD MÍNIMO PARA N8N PUBLIC API
// ======================================================
//
// Campos principales editables:
//
// - name
// - nodes
// - connections
// - settings
//
// NO enviamos campos de solo lectura como:
//
// - id
// - active
// - createdAt
// - updatedAt
// - versionId
// - versionCounter
// - triggerCount
// - shared
// - tags
// - meta
// - isArchived
// - project
// etc.
//
// ======================================================

const payload = {
  name: workflow.name,
  nodes: workflow.nodes,
  connections: workflow.connections,
  settings: workflow.settings ?? {},
};

// ======================================================
// CAMPOS OPCIONALES
// ======================================================

// ------------------------------------------------------
// DESCRIPTION
// ------------------------------------------------------
//
// n8n rechaza:
//
// "description": null
//
// Por eso únicamente la enviamos cuando realmente
// contiene un string.
//
// Una cadena vacía "" sí es string y es válida.
// ------------------------------------------------------

if (
  typeof workflow.description === 'string'
) {
  payload.description = workflow.description;
}

// ------------------------------------------------------
// STATIC DATA
// ------------------------------------------------------
//
// Se conserva si existe explícitamente.
// Puede contener estado interno de ciertos nodos.
//
// No inventamos el campo cuando el workflow no lo tiene.
// ------------------------------------------------------

if (
  hasOwn(workflow, 'staticData') &&
  workflow.staticData !== undefined
) {
  payload.staticData = workflow.staticData;
}

// ------------------------------------------------------
// PIN DATA
// ------------------------------------------------------
//
// Datos fijados manualmente en nodos durante desarrollo.
// Se conserva si el workflow los contiene.
// ------------------------------------------------------

if (
  hasOwn(workflow, 'pinData') &&
  workflow.pinData !== undefined
) {
  payload.pinData = workflow.pinData;
}

// ------------------------------------------------------
// NODE GROUPS
// ------------------------------------------------------
//
// Solo se envía cuando realmente es un array.
// ------------------------------------------------------

if (
  Array.isArray(workflow.nodeGroups)
) {
  payload.nodeGroups = workflow.nodeGroups;
}

// ======================================================
// VALIDAR PAYLOAD FINAL
// ======================================================

if (
  typeof payload.name !== 'string' ||
  payload.name.trim() === ''
) {
  throw new Error(
    'payload.name inválido.'
  );
}

if (!Array.isArray(payload.nodes)) {
  throw new Error(
    'payload.nodes no es un array.'
  );
}

if (
  !payload.connections ||
  typeof payload.connections !== 'object' ||
  Array.isArray(payload.connections)
) {
  throw new Error(
    'payload.connections inválido.'
  );
}

if (
  !payload.settings ||
  typeof payload.settings !== 'object' ||
  Array.isArray(payload.settings)
) {
  throw new Error(
    'payload.settings inválido.'
  );
}

// Protección específica contra el error que ya vimos.
//
// Si por cualquier motivo description acabara presente,
// nunca debe ser null ni otro tipo distinto de string.

if (
  hasOwn(payload, 'description') &&
  typeof payload.description !== 'string'
) {
  throw new Error(
    'payload.description existe pero no es string.'
  );
}

// ======================================================
// PREPARAR DIRECTORIO
// ======================================================

fs.mkdirSync(
  path.dirname(UPDATE_FILE),
  {
    recursive: true,
  }
);

// ======================================================
// GUARDAR PAYLOAD
// ======================================================

fs.writeFileSync(
  UPDATE_FILE,
  JSON.stringify(
    payload,
    null,
    2
  ) + '\n',
  'utf8'
);

// ======================================================
// ESTADÍSTICAS
// ======================================================

const connectionCount =
  Object.keys(payload.connections).length;

const hasDescription =
  hasOwn(payload, 'description');

// ======================================================
// RESULTADO
// ======================================================

console.log('');
console.log(
  '=============================================='
);

console.log(
  ' PEGASO N8N - PAYLOAD PREPARADO'
);

console.log(
  '=============================================='
);

console.log('');

console.log(
  `Nombre: ${payload.name}`
);

console.log(
  `Nodos: ${payload.nodes.length}`
);

console.log(
  `Origenes con conexiones: ${connectionCount}`
);

console.log(
  `Description enviada: ${hasDescription ? 'SI' : 'NO'}`
);

if (hasDescription) {
  console.log(
    `Description tipo: ${typeof payload.description}`
  );
}

console.log(
  `StaticData enviada: ${hasOwn(payload, 'staticData') ? 'SI' : 'NO'}`
);

console.log(
  `PinData enviada: ${hasOwn(payload, 'pinData') ? 'SI' : 'NO'}`
);

console.log(
  `NodeGroups enviados: ${hasOwn(payload, 'nodeGroups') ? 'SI' : 'NO'}`
);

console.log('');

console.log('Archivo:');

console.log(
  UPDATE_FILE
);

console.log('');