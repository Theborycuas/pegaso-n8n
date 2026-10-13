import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

// ======================================================
// PEGASO N8N - DOWNLOAD WORKFLOW
// ======================================================
//
// RESPONSABILIDAD:
// - Descargar el workflow principal directamente desde n8n.
// - Ejecutar n8n-cli correctamente en Windows mediante cmd.exe.
// - Interpretar la salida como UTF-8.
// - Validar estructura básica del workflow.
// - Eliminar pinData SOLO de la copia local versionable.
// - Guardar JSON como UTF-8 sin BOM.
//
// IMPORTANTE:
// - NO modifica producción.
// - NO modifica credenciales en n8n.
// - NO elimina pinData del workflow remoto.
// - Solo evita guardar pinData en el archivo local/Git.
// ======================================================

const ROOT = process.cwd();

const WORKFLOW_ID = '09OF22FOxihypeeh';

const OUTPUT_FILE = path.join(
  ROOT,
  'workflows',
  'sistema-automatizado-pegaso.json'
);

// ======================================================
// CABECERA
// ======================================================

console.log('');
console.log('==============================================');
console.log(' PEGASO N8N - DOWNLOAD WORKFLOW');
console.log('==============================================');
console.log('');

console.log('Descargando workflow desde n8n...');
console.log('');

// ======================================================
// CONSTRUIR COMANDO
// ======================================================

const command = [
  'n8n-cli',
  'workflow',
  'get',
  WORKFLOW_ID,
  '--format=json',
].join(' ');

// ======================================================
// EJECUTAR N8N CLI
// ======================================================

let stdout;

try {
  stdout = execFileSync(
    process.env.ComSpec || 'cmd.exe',
    [
      '/d',
      '/s',
      '/c',
      command,
    ],
    {
      encoding: 'utf8',
      maxBuffer: 100 * 1024 * 1024,
      windowsHide: true,
    }
  );
} catch (error) {
  console.error('');
  console.error('ERROR ejecutando n8n-cli.');
  console.error('');

  if (error.stderr) {
    console.error(
      Buffer.isBuffer(error.stderr)
        ? error.stderr.toString('utf8')
        : error.stderr
    );
  }

  throw error;
}

// ======================================================
// NORMALIZAR SALIDA
// ======================================================

let clean = stdout.replace(/^\uFEFF/, '');

// ======================================================
// PARSEAR JSON
// ======================================================

let workflow;

try {
  workflow = JSON.parse(clean);
} catch (error) {
  console.error('');
  console.error('ERROR: n8n-cli no devolvio JSON valido.');
  console.error(error.message);
  console.error('');
  process.exit(1);
}

// ======================================================
// VALIDACIONES
// ======================================================

if (workflow.id !== WORKFLOW_ID) {
  throw new Error(
    `Workflow inesperado. Esperado ${WORKFLOW_ID}, recibido ${workflow.id}`
  );
}

if (!Array.isArray(workflow.nodes)) {
  throw new Error(
    'El workflow descargado no contiene nodes[].'
  );
}

if (
  !workflow.connections ||
  typeof workflow.connections !== 'object'
) {
  throw new Error(
    'El workflow descargado no contiene connections validas.'
  );
}

// ======================================================
// SANITIZAR COPIA LOCAL
// ======================================================
//
// pinData puede contener datos reales capturados desde
// ejecuciones o pruebas manuales.
//
// Eso puede incluir:
//
// - API keys
// - headers
// - emails
// - payloads
// - datos personales
// - respuestas de servicios externos
//
// NO queremos versionarlo.
//
// IMPORTANTE:
// Esto NO elimina pinData del workflow remoto.
// Solo de la copia local que se guarda en Git.
// ======================================================

let pinDataRemoved = false;

if (
  Object.prototype.hasOwnProperty.call(
    workflow,
    'pinData'
  )
) {
  delete workflow.pinData;
  pinDataRemoved = true;
}

// ======================================================
// CREAR DIRECTORIO
// ======================================================

fs.mkdirSync(
  path.dirname(OUTPUT_FILE),
  {
    recursive: true,
  }
);

// ======================================================
// GUARDAR UTF-8 SIN BOM
// ======================================================

fs.writeFileSync(
  OUTPUT_FILE,
  JSON.stringify(
    workflow,
    null,
    2
  ) + '\n',
  'utf8'
);

// ======================================================
// RESULTADO
// ======================================================

console.log('Workflow descargado correctamente.');
console.log('');

console.log(`Nombre: ${workflow.name}`);
console.log(`ID: ${workflow.id}`);
console.log(`Nodos: ${workflow.nodes.length}`);
console.log(`UpdatedAt: ${workflow.updatedAt}`);
console.log(`VersionId: ${workflow.versionId}`);

console.log('');

console.log(
  `pinData eliminado de copia local: ${
    pinDataRemoved ? 'SI' : 'NO'
  }`
);

console.log('');

console.log('Archivo:');
console.log(OUTPUT_FILE);
console.log('');