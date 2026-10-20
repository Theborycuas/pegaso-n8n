import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const EDIT = path.join(REPO, 'workflows', 'sistema-automatizado-pegaso.edit.json');

const w = JSON.parse(fs.readFileSync(EDIT, 'utf8'));

function uid() {
  return crypto.randomUUID();
}

function reglaInformar(accion) {
  return {
    conditions: {
      options: {
        caseSensitive: true,
        leftValue: '',
        typeValidation: 'strict',
        version: 3
      },
      conditions: [
        {
          id: uid(),
          leftValue: '={{$json.accion}}',
          rightValue: accion,
          operator: {
            type: 'string',
            operation: 'equals',
            name: 'filter.operator.equals'
          }
        }
      ],
      combinator: 'and'
    },
    renameOutput: true,
    outputKey: accion
  };
}

const ACCIONES_NUEVAS = [
  'INFORMAR_AFICHES',
  'INFORMAR_TRIPTICOS',
  'INFORMAR_MEMBRETADAS'
];

const sw = w.nodes.find(x => x.name === 'Enrutar acción comercial');
const rules = sw?.parameters?.rules?.values;
const conn = w.connections['Enrutar acción comercial'];

let switchAdded = 0;

if (Array.isArray(rules) && conn?.main) {
  for (const accion of ACCIONES_NUEVAS) {
    if (rules.some(r => r.outputKey === accion)) {
      continue;
    }
    rules.push(reglaInformar(accion));
    switchAdded += 1;
  }

  const fallback = conn.main[rules.length] ? null : conn.main.pop();
  while (conn.main.length < rules.length) {
    conn.main.push([
      { node: 'Preparar respuesta comercial', type: 'main', index: 0 }
    ]);
  }
  if (fallback) {
    conn.main.push(fallback);
  } else if (conn.main.length === rules.length) {
    conn.main.push([
      { node: 'Preparar respuesta comercial', type: 'main', index: 0 }
    ]);
  }
}

const cfg = w.nodes.find(x => x.name === 'Obtener configuración MODO_PRUEBA');
if (
  cfg?.parameters?.query &&
  !cfg.parameters.query.includes('CATALOGO_AFICHES')
) {
  cfg.parameters.query = cfg.parameters.query.replace(
    "'IMAGEN_FLYERS'\n)",
    "'IMAGEN_FLYERS',\n    'CATALOGO_AFICHES',\n    'CATALOGO_TRIPTICOS',\n    'CATALOGO_MEMBRETADAS'\n)"
  );
}

const BLOQUE_27D = `==================================================
27D. PRODUCCIÓN RÁPIDA (AFICHES, TRÍPTICOS, HOJAS MEMBRETADAS)
==================================================

Son productos distintos de etiquetas, tarjetas y flyers.
Precios, material y entregas NO se mezclan.
Ubicación, envíos a ciudades y datos de pago siguen las
secciones ya existentes (INFORMAR_UBICACION, INFORMAR_METODOLOGIA_PAGO).

PRIMER CONTACTO (no hay catalogo_*.enviada_at de ese producto):
intencion = CONSULTAR_PRECIO
accion = INFORMAR_AFICHES | INFORMAR_TRIPTICOS | INFORMAR_MEMBRETADAS
requiere_humano = false
motivo_derivacion = NINGUNO
respuesta_sugerida = la lista de precios del producto.
El sistema envía saludo (solo sesión nueva), la imagen y ese texto.

AFICHES:
- 1000 A3 (29.7 x 42 cm), full color 1 lado, Couche 150 gr: $100
- Si ya tiene el diseño listo para imprimir: $90
- Si preguntan 500: sí es posible, $85
- Entrega: 2 a 3 días hábiles

TRÍPTICOS:
- 1000 A4 (21 x 29.7 cm), full color ambos lados, doblados y cortados: $85
- Debe enviarnos el diseño listo. Si no tiene diseño: +$15
- Si preguntan 500: sí es posible, $69
- Entrega: 2 a 3 días hábiles

HOJAS MEMBRETADAS:
- 1000 A4 (21 x 29.7 cm), full color 1 lado, Bond 75 gr: $65
- Si preguntan 500: sí es posible, $50
- Entrega: 2 a 3 días hábiles

TURNOS SIGUIENTES:
- 500 → RESPONDER_GENERAL con el precio de 500
- material → INFORMAR_MATERIAL del producto
- entrega / tiempo → INFORMAR_ENTREGA: 2 a 3 días hábiles
  (NO la metodología semanal de etiquetas)
- diseño → INFORMAR_DISENO con la regla de ese producto
- ubicación / ciudad / envíos a provincias → INFORMAR_UBICACION
- precio de 1000 → RESPONDER_GENERAL con la lista
- otro tamaño, otro papel, dípticos, brochures u otra cosa
  fuera de este catálogo → DERIVAR_HUMANO

NO uses COTIZAR_P4 ni PEDIR_MEDIDAS de etiquetas.
NO inventes precios.


==================================================
27. DISEÑO
==================================================`;

let prompts = 0;
let schemas = 0;

for (const n of w.nodes) {
  if (typeof n.parameters?.text === 'string') {
    let t = n.parameters.text;

    t = t.replace(
      /Afiches u otro impreso que no sea etiqueta, tarjeta ni flyer: DERIVAR_HUMANO\.\nFlyers\/volantes tienen su propia sección 27B \(INFORMAR_FLYERS\)\./g,
      'Dípticos, brochures u otro impreso que no sea etiqueta, tarjeta, flyer, afiche, tríptico ni hoja membretada: DERIVAR_HUMANO.\nAfiches, trípticos y hojas membretadas: sección 27D.'
    );

    t = t.replace(
      /Afiches u otro impreso sin precio de catálogo: DERIVAR_HUMANO\./g,
      'Afiches, trípticos y hojas membretadas sí tienen precio (27D). Dípticos/brochures: DERIVAR_HUMANO.'
    );

    if (
      t.includes('27C. TOTAL') &&
      !t.includes('27D. PRODUCCIÓN RÁPIDA')
    ) {
      t = t.replace(
        '==================================================\n27. DISEÑO\n==================================================',
        BLOQUE_27D
      );
    } else if (
      t.includes('27B. VOLANTES') &&
      !t.includes('27D. PRODUCCIÓN RÁPIDA')
    ) {
      t = t.replace(
        '==================================================\n27. DISEÑO\n==================================================',
        BLOQUE_27D
      );
    }

    if (t !== n.parameters.text) {
      n.parameters.text = t;
      prompts += 1;
    }
  }

  if (
    typeof n.parameters?.inputSchema === 'string' &&
    n.parameters.inputSchema.includes('"PEDIR_MEDIDAS"')
  ) {
    const schema = JSON.parse(n.parameters.inputSchema);
    const enumeracion = schema.properties?.accion?.enum;
    if (Array.isArray(enumeracion)) {
      let changed = false;
      const idx = enumeracion.indexOf('INFORMAR_FLYERS');
      const insertAt = idx >= 0 ? idx + 1 : enumeracion.length;
      for (const accion of ACCIONES_NUEVAS) {
        if (!enumeracion.includes(accion)) {
          enumeracion.splice(insertAt, 0, accion);
          changed = true;
        }
      }
      if (changed) {
        n.parameters.inputSchema = JSON.stringify(schema, null, 2);
        schemas += 1;
      }
    }
  }
}

fs.writeFileSync(EDIT, JSON.stringify(w, null, 2) + '\n');

const swAfter = w.nodes.find(x => x.name === 'Enrutar acción comercial');
const keys = swAfter.parameters.rules.values.map(r => r.outputKey);

console.log({
  switchAdded,
  nRules: keys.length,
  nConns: w.connections['Enrutar acción comercial'].main.length,
  lastKeys: keys.slice(-5),
  lastConns: w.connections['Enrutar acción comercial'].main.slice(-5).map(x => x?.[0]?.node),
  sql: cfg?.parameters?.query?.includes('CATALOGO_AFICHES'),
  prompts,
  schemas
});
