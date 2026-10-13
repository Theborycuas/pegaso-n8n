import fs from 'node:fs';
import path from 'node:path';

// ======================================================
// PEGASO N8N - EXTRACT CODE NODES
// ======================================================
//
// RESPONSABILIDAD:
// - Leer el workflow principal descargado desde n8n.
// - Detectar todos los nodos n8n-nodes-base.code.
// - Extraer parameters.jsCode.
// - Crear un archivo .js independiente por nodo.
// - Crear manifest.json relacionando:
//      archivo <-> nodeId <-> nodeName
//
// IMPORTANTE:
// - NO modifica el workflow.
// - NO modifica producción.
// - Operación completamente local.
// ======================================================

const ROOT = process.cwd();

const WORKFLOW_FILE = path.join(
  ROOT,
  'workflows',
  'sistema-automatizado-pegaso.json'
);

const OUTPUT_DIR = path.join(
  ROOT,
  'code',
  '_extraidos'
);

// ======================================================
// UTILIDADES
// ======================================================

function normalizeFileName(value) {
  return String(value ?? 'sin-nombre')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function ensureUniqueFileName(baseName, usedNames) {
  let candidate = baseName;
  let counter = 2;

  while (usedNames.has(candidate)) {
    candidate = `${baseName}-${counter}`;
    counter += 1;
  }

  usedNames.add(candidate);

  return candidate;
}

// ======================================================
// VALIDACIONES DEL ARCHIVO
// ======================================================

if (!fs.existsSync(WORKFLOW_FILE)) {
  console.error('');
  console.error('ERROR');
  console.error('No existe el archivo del workflow:');
  console.error(WORKFLOW_FILE);
  console.error('');
  process.exit(1);
}

let raw = fs.readFileSync(
    WORKFLOW_FILE,
    'utf8'
  );
  
  // ======================================================
  // NORMALIZAR ENCODING
  // ======================================================
  // PowerShell puede guardar UTF-8 con BOM.
  // JSON.parse() no siempre tolera U+FEFF al comienzo.
  //
  // Eliminamos únicamente el BOM inicial si existe.
  // ======================================================
  
  raw = raw.replace(/^\uFEFF/, '');
  
let workflow;

try {
  workflow = JSON.parse(raw);
} catch (error) {
  console.error('');
  console.error('ERROR');
  console.error(
    'El archivo del workflow no contiene JSON válido.'
  );
  console.error(error.message);
  console.error('');
  process.exit(1);
}

if (!Array.isArray(workflow.nodes)) {
  console.error('');
  console.error('ERROR');
  console.error(
    'El workflow no contiene un arreglo "nodes".'
  );
  console.error('');
  process.exit(1);
}

// ======================================================
// BUSCAR CODE NODES
// ======================================================

const codeNodes = workflow.nodes.filter(
  (node) =>
    node.type === 'n8n-nodes-base.code'
);

console.log('');
console.log(
  `Code Nodes encontrados: ${codeNodes.length}`
);

// ======================================================
// PREPARAR DIRECTORIO
// ======================================================

fs.rmSync(
  OUTPUT_DIR,
  {
    recursive: true,
    force: true,
  }
);

fs.mkdirSync(
  OUTPUT_DIR,
  {
    recursive: true,
  }
);

const usedNames = new Set();

const manifest = [];

// ======================================================
// EXTRAER CODE NODES
// ======================================================

for (const node of codeNodes) {

  const jsCode =
    node?.parameters?.jsCode;

  if (typeof jsCode !== 'string') {

    console.warn(
      `ADVERTENCIA: "${node.name}" no contiene parameters.jsCode`
    );

    continue;
  }

  const normalizedName =
    normalizeFileName(node.name) ||
    'code-node';

  const uniqueName =
    ensureUniqueFileName(
      normalizedName,
      usedNames
    );

  const fileName =
    `${uniqueName}.js`;

  const destination =
    path.join(
      OUTPUT_DIR,
      fileName
    );

  // --------------------------------------------
  // HEADER LOCAL
  // --------------------------------------------

  const header =
`// ======================================================
// N8N NODE - PEGASO
// ======================================================
// Nombre: ${node.name}
// Node ID: ${node.id}
// TypeVersion: ${node.typeVersion ?? 'N/D'}
//
// Workflow:
// ${workflow.name ?? 'N/D'}
//
// Workflow ID:
// ${workflow.id ?? 'N/D'}
//
// NOTA:
// Archivo generado automáticamente desde n8n.
// El header NO pertenece al código almacenado en n8n.
// ======================================================

`;

  fs.writeFileSync(
    destination,
    header +
      jsCode.trimEnd() +
      '\n',
    'utf8'
  );

  const lines =
    jsCode.split(/\r?\n/).length;

  manifest.push({
    nodeId: node.id,
    nodeName: node.name,
    fileName,
    relativeFile:
      `code/_extraidos/${fileName}`,
    typeVersion:
      node.typeVersion ?? null,
    lines,
  });
}

// ======================================================
// CREAR MANIFEST
// ======================================================

const manifestPath =
  path.join(
    OUTPUT_DIR,
    'manifest.json'
  );

const manifestData = {
  workflowId:
    workflow.id ?? null,

  workflowName:
    workflow.name ?? null,

  workflowUpdatedAt:
    workflow.updatedAt ?? null,

  extractedAt:
    new Date().toISOString(),

  workflowNodeCount:
    workflow.nodes.length,

  codeNodeCount:
    manifest.length,

  nodes:
    manifest,
};

fs.writeFileSync(
  manifestPath,
  JSON.stringify(
    manifestData,
    null,
    2
  ) + '\n',
  'utf8'
);

// ======================================================
// RESULTADO
// ======================================================

console.log('');
console.log(
  '=============================================='
);

console.log(
  ' PEGASO N8N - EXTRACCION COMPLETADA'
);

console.log(
  '=============================================='
);

console.log('');

console.log(
  `Workflow: ${workflow.name}`
);

console.log(
  `Workflow ID: ${workflow.id}`
);

console.log(
  `Total nodos: ${workflow.nodes.length}`
);

console.log(
  `Code Nodes extraídos: ${manifest.length}`
);

console.log('');

console.log(
  'Directorio:'
);

console.log(
  OUTPUT_DIR
);

console.log('');

console.log(
  'Manifest:'
);

console.log(
  manifestPath
);

console.log('');

console.log(
  'Archivos JS:'
);

for (const item of manifest) {

  console.log(
    ` - ${item.fileName} (${item.lines} líneas)`
  );

}

console.log('');