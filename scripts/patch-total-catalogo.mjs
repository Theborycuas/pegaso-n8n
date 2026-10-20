import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const EDIT = path.join(REPO, 'workflows', 'sistema-automatizado-pegaso.edit.json');

const w = JSON.parse(fs.readFileSync(EDIT, 'utf8'));

const BLOQUE = `==================================================
27C. TOTAL DE VARIOS PRODUCTOS DE CATÁLOGO
==================================================

Si pide el TOTAL, CUÁNTO QUEDA o la SUMA de uno o más
productos de catálogo (tarjetas, volantes/flyers; después
otros con precio en tabla):

intencion = CONSULTAR_PRECIO
accion = RESPONDER_GENERAL
requiere_humano = false
motivo_derivacion = NINGUNO

NO uses INFORMAR_TARJETAS ni INFORMAR_FLYERS en ese turno.
NO reenvíes videos ni la foto de flyers.
NO uses COTIZAR_P4 (eso es etiquetas).
NO inventes precios: el sistema suma con la tabla.

Si falta el acabado de las tarjetas, el tamaño A5/A6 o si
las volantes son a 1 o 2 lados, RESPONDER_GENERAL pidiendo
SOLO lo que falta.

Afiches u otro impreso sin precio de catálogo: DERIVAR_HUMANO.


==================================================
27. DISEÑO
==================================================`;

let prompts = 0;

for (const n of w.nodes) {
  const t = n.parameters?.text;

  if (typeof t !== 'string' || !t.includes('27B. VOLANTES')) {
    continue;
  }

  let next = t.replace(
    '- Si mezcla flyers con etiquetas o tarjetas: RESPONDER_GENERAL\n  y aclara el producto. No cotices P4.',
    '- Si mezcla flyers con etiquetas: RESPONDER_GENERAL y aclara.\n  Si mezcla flyers con tarjetas y pide el total, ve a 27C.\n  No cotices P4.'
  );

  if (!next.includes('27C. TOTAL')) {
    next = next.replace(
      '==================================================\n27. DISEÑO\n==================================================',
      BLOQUE
    );
  }

  if (next !== t) {
    n.parameters.text = next;
    prompts += 1;
    console.log('patched', n.name);
  }
}

fs.writeFileSync(EDIT, JSON.stringify(w, null, 2) + '\n');
console.log({ prompts });
