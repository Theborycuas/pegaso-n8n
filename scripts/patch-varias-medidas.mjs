import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const EDIT = path.join(REPO, 'workflows', 'sistema-automatizado-pegaso.edit.json');

const w = JSON.parse(fs.readFileSync(EDIT, 'utf8'));

const BLOQUE = `NO reduzcas un pedido múltiple a un solo detalle.

Si el mensaje actual tiene VARIAS LÍNEAS (reenvíos o varios
mensajes del mismo turno), cada línea con una medida distinta
es un detalle independiente. Ejemplos:
- 8cm alto x 9ancho
- 8cm de alto x 5 de ancho
- 18 de ancho x 7 de alto
El primer número es ancho_cm y el segundo es alto_cm.
`;

let prompts = 0;

for (const n of w.nodes) {
  const t = n.parameters?.text;

  if (typeof t !== 'string' || !t.includes('EXTRACTOR ESTRUCTURADO DE COTIZACIONES')) {
    continue;
  }

  if (t.includes('8cm alto x 9ancho')) {
    console.log('ya estaba', n.name);
    continue;
  }

  if (!t.includes('NO reduzcas un pedido múltiple a un solo detalle.')) {
    console.log('no halló ancla', n.name);
    continue;
  }

  n.parameters.text = t.replace(
    'NO reduzcas un pedido múltiple a un solo detalle.',
    BLOQUE.trimEnd()
  );
  prompts += 1;
  console.log('patched', n.name);
}

fs.writeFileSync(EDIT, JSON.stringify(w, null, 2) + '\n');
console.log({ prompts });
