import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();

const EDIT_WORKFLOW_FILE = path.join(
  ROOT,
  'workflows',
  'sistema-automatizado-pegaso.edit.json'
);

const CODE_DIR = path.join(
  ROOT,
  'code',
  '_extraidos'
);

const MANIFEST_FILE = path.join(
  CODE_DIR,
  'manifest.json'
);

const BUILD_FILE = path.join(
  ROOT,
  'build',
  'sistema-automatizado-pegaso.build.json'
);

function readJson(file) {
  let raw = fs.readFileSync(file, 'utf8');
  raw = raw.replace(/^\uFEFF/, '');
  return JSON.parse(raw);
}

if (!fs.existsSync(EDIT_WORKFLOW_FILE)) {
  throw new Error(
    `No existe ${EDIT_WORKFLOW_FILE}`
  );
}

if (!fs.existsSync(MANIFEST_FILE)) {
  throw new Error(
    `No existe ${MANIFEST_FILE}`
  );
}

const workflow = readJson(
  EDIT_WORKFLOW_FILE
);

const manifest = readJson(
  MANIFEST_FILE
);

const nodesById = new Map(
  workflow.nodes.map(
    node => [node.id, node]
  )
);

let updated = 0;

for (const item of manifest.nodes) {

  const node = nodesById.get(
    item.nodeId
  );

  if (!node) {
    throw new Error(
      `No se encontró el nodo ID ${item.nodeId} (${item.nodeName})`
    );
  }

  const filePath = path.join(
    ROOT,
    item.relativeFile
  );

  if (!fs.existsSync(filePath)) {
    throw new Error(
      `No existe el archivo ${filePath}`
    );
  }

  let code = fs.readFileSync(
    filePath,
    'utf8'
  );

  // Quitar header generado por extract-code.mjs
  const marker =
    '// ======================================================\n\n';

  const index = code.indexOf(marker);

  if (index !== -1) {
    code = code.slice(
      index + marker.length
    );
  }

  code = code.replace(/\s+$/, '');

  node.parameters ??= {};
  node.parameters.jsCode = code;

  updated++;
}

fs.mkdirSync(
  path.dirname(BUILD_FILE),
  {
    recursive: true,
  }
);

fs.writeFileSync(
  BUILD_FILE,
  JSON.stringify(
    workflow,
    null,
    2
  ) + '\n',
  'utf8'
);

console.log('');
console.log(
  '=============================================='
);
console.log(
  ' PEGASO N8N - INJECT COMPLETADO'
);
console.log(
  '=============================================='
);
console.log('');
console.log(
  `Code Nodes actualizados: ${updated}`
);
console.log(
  `Build generado: ${BUILD_FILE}`
);
console.log('');