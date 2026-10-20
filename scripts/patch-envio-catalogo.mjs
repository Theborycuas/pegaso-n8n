import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const EDIT = path.join(REPO, 'workflows', 'sistema-automatizado-pegaso.edit.json');

const w = JSON.parse(fs.readFileSync(EDIT, 'utf8'));

const BLOQUE_27C = `==================================================
27C. TOTAL DE VARIOS PRODUCTOS DE CATÁLOGO
==================================================

Si pide el TOTAL, CUÁNTO QUEDA o la SUMA de uno o más
productos de catálogo (tarjetas, volantes/flyers, afiches,
trípticos, hojas membretadas):

intencion = CONSULTAR_PRECIO
accion = RESPONDER_GENERAL
requiere_humano = false
motivo_derivacion = NINGUNO

NO uses INFORMAR_TARJETAS, INFORMAR_FLYERS, INFORMAR_AFICHES,
INFORMAR_TRIPTICOS ni INFORMAR_MEMBRETADAS en ese turno.
NO reenvíes videos ni fotos de catálogo.
NO uses COTIZAR_P4 (eso es etiquetas).
NO inventes precios: el sistema suma con la tabla y arma
el detalle del pedido.

Si falta un dato (acabado de tarjetas, A5/A6 o caras de
volantes, 500 o 1000 en producción rápida), RESPONDER_GENERAL
pidiendo SOLO lo que falta.

ENVÍO: si no se sabe si es Quito u otra ciudad, el sistema
pregunta. Si es otra ciudad fuera de Quito, suma $5.00 de
transporte. Quito / Sangolquí / retiro en el local: sin
ese recargo. No mezclar esto con INFORMAR_UBICACION
(dónde está Pegaso).

Dípticos/brochures u otro impreso sin precio: DERIVAR_HUMANO.


==================================================
27D. PRODUCCIÓN RÁPIDA (AFICHES, TRÍPTICOS, HOJAS MEMBRETADAS)
==================================================`;

let prompts = 0;

for (const n of w.nodes) {
  const t = n.parameters?.text;

  if (typeof t !== 'string' || !t.includes('27C. TOTAL')) {
    continue;
  }

  const next = t.replace(
    /==================================================\n27C\. TOTAL DE VARIOS PRODUCTOS DE CATÁLOGO\n==================================================[\s\S]*?==================================================\n27D\. PRODUCCIÓN RÁPIDA \(AFICHES, TRÍPTICOS, HOJAS MEMBRETADAS\)\n==================================================/,
    BLOQUE_27C
  );

  if (next !== t) {
    n.parameters.text = next;
    prompts += 1;
    console.log('patched', n.name);
  }
}

fs.writeFileSync(EDIT, JSON.stringify(w, null, 2) + '\n');
console.log({ prompts });
