import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();

const FILE = path.join(
  ROOT,
  'workflows',
  'sistema-automatizado-pegaso.json'
);

const text = fs.readFileSync(
  FILE,
  'utf8'
);

// ======================================================
// SECUENCIAS SOSPECHOSAS DE MOJIBAKE
// ======================================================
//
// U+00C3 -> caracter típico cuando UTF-8 fue leído como Latin1
// U+00C2 -> idem
// U+00E2 -> inicio frecuente de secuencias UTF-8 mal decodificadas
//
// No usamos literalmente los símbolos para evitar que
// PowerShell / consola vuelva a dañarlos.
// ======================================================

const suspiciousCodePoints = [
  '\u00C3',
  '\u00C2',
  '\u00E2',
];

const lines = text.split(/\r?\n/);

const matches = [];

for (
  let lineNumber = 0;
  lineNumber < lines.length;
  lineNumber++
) {
  const line = lines[lineNumber];

  if (
    suspiciousCodePoints.some(
      value => line.includes(value)
    )
  ) {
    matches.push({
      line: lineNumber + 1,
      text: line.slice(0, 250),
    });
  }
}

console.log('');
console.log('==============================================');
console.log(' PEGASO N8N - CHECK ENCODING');
console.log('==============================================');
console.log('');

if (matches.length === 0) {
  console.log('OK: no se detectaron secuencias tipicas de mojibake.');
  console.log('');
  process.exit(0);
}

console.log(
  `ADVERTENCIA: se encontraron ${matches.length} lineas sospechosas.`
);

console.log('');

for (const match of matches.slice(0, 30)) {
  console.log(
    `Linea ${match.line}: ${JSON.stringify(match.text)}`
  );
}

if (matches.length > 30) {
  console.log('');
  console.log(
    `... y ${matches.length - 30} coincidencias adicionales.`
  );
}

console.log('');

process.exit(2);