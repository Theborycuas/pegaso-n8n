import fs from 'node:fs';
import path from 'node:path';

const directive = /^\/\/ @pegaso-module (code\/preventa\/[a-z0-9-]+\.js)$/gm;

export function compileNode(code, root = process.cwd()) {
  return code.replace(directive, (_, relativeFile) => {
    const moduleCode = fs.readFileSync(path.join(root, relativeFile), 'utf8').trim();
    if (moduleCode.includes('@pegaso-module')) {
      throw new Error(`Los módulos deben ser independientes: ${relativeFile}`);
    }
    return `// PEGASO_MODULE_BEGIN ${relativeFile}\n${moduleCode}\n// PEGASO_MODULE_END ${relativeFile}`;
  });
}

export function extractNode(code, root = process.cwd()) {
  return code.replace(
    /^\/\/ PEGASO_MODULE_BEGIN (code\/preventa\/[a-z0-9-]+\.js)\n([\s\S]*?)\n\/\/ PEGASO_MODULE_END \1$/gm,
    (_, relativeFile, remoteCode) => {
      const moduleCode = fs.readFileSync(path.join(root, relativeFile), 'utf8').trim();
      if (moduleCode !== remoteCode.trim()) {
        throw new Error(`El módulo remoto cambió. Revisar antes de extraer: ${relativeFile}`);
      }
      return `// @pegaso-module ${relativeFile}`;
    }
  );
}
