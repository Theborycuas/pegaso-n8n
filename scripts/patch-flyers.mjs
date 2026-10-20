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

for (const n of w.nodes) {
  if (n.name !== 'Enrutar acción comercial') continue;
  const rules = n.parameters?.rules?.values;
  if (!Array.isArray(rules)) continue;
  let seenAceptacion = 0;
  for (const r of rules) {
    const cond = r.conditions?.conditions?.[0];
    if (cond?.rightValue === 'REGISTRAR_ACEPTACION') {
      seenAceptacion += 1;
      if (seenAceptacion === 2) {
        cond.rightValue = 'INFORMAR_FLYERS';
        r.outputKey = 'INFORMAR_FLYERS';
      }
    }
  }
}

const conn = w.connections['Enrutar acción comercial'];
if (conn?.main?.[14] && conn.main[14].length === 0) {
  conn.main[14] = [{ node: 'Preparar respuesta comercial', type: 'main', index: 0 }];
}

const cfg = w.nodes.find(x => x.name === 'Obtener configuración MODO_PRUEBA');
if (cfg?.parameters?.query && !cfg.parameters.query.includes('CATALOGO_FLYERS')) {
  cfg.parameters.query = cfg.parameters.query.replace(
    "'CATALOGO_TARJETAS'\n)",
    "'CATALOGO_TARJETAS',\n    'CATALOGO_FLYERS',\n    'IMAGEN_FLYERS'\n)"
  );
}

const BLOQUE_27B = `==================================================
27B. VOLANTES / FLYERS (NO ES ETIQUETA NI TARJETA)
==================================================

Las etiquetas, las tarjetas y los flyers son productos distintos.
Precios, material y entregas NO se mezclan.

- Si pide flyers, flayers o volantes (y NO etiquetas ni tarjetas),
  o contexto_comercial.producto_linea = FLYERS_VOLANTES:
  responde SOLO reglas de flyers.
- Si mezcla flyers con etiquetas o tarjetas: RESPONDER_GENERAL
  y aclara el producto. No cotices P4.

PRIMER CONTACTO (no hay catalogo_flyers.enviada_at):
intencion = CONSULTAR_PRECIO
accion = INFORMAR_FLYERS
requiere_humano = false
motivo_derivacion = NINGUNO
producto = "flyers / volantes"
respuesta_sugerida = lista de precios A6/A5 a 1 y 2 caras (1000 unidades).
El sistema envía saludo, la imagen del catálogo y ese texto.
NO expliques material ni entregas en este turno.

TURNOS SIGUIENTES:
- material / papel / couche → INFORMAR_MATERIAL: Couche 115 gr.
- tiempo / entrega → INFORMAR_ENTREGA: abono lun-mar → miércoles;
  mié-jue → viernes (igual que tarjetas; NO metodología de etiquetas).
- 1 o 2 caras / A5 / A6 / precio → RESPONDER_GENERAL con la lista:
  A6 10.5x14.8 cm: 1 lado $20, 2 lados $26;
  A5 21x14.8 cm: 1 lado $32, 2 lados $41 (1000 unidades).
- otro tamaño (A4, A3…), otro papel, plastificado, urgente u otra
  cosa fuera de ese catálogo → DERIVAR_HUMANO.

NO uses COTIZAR_P4 ni PEDIR_MEDIDAS de etiquetas en línea flyers.
NO digas que solo trabajan etiquetas.
NO inventes precios.

Afiches u otro impreso que no sea etiqueta, tarjeta ni flyer:
accion = DERIVAR_HUMANO.


==================================================
27. DISEÑO
==================================================`;

let prompts = 0;
let schemas = 0;
for (const n of w.nodes) {
  if (typeof n.parameters?.text === 'string') {
    n.parameters.text = n.parameters.text.replace(
      /Flyers, volantes, afiches u otro impreso \(no tarjeta ni etiqueta\):\naccion = DERIVAR_HUMANO, requiere_humano = true, motivo_derivacion = OTRO\./g,
      'Afiches u otro impreso que no sea etiqueta, tarjeta ni flyer: DERIVAR_HUMANO.\nFlyers/volantes tienen su propia sección 27B (INFORMAR_FLYERS).'
    );

    if (
      n.parameters.text.includes('27A. TARJETAS') &&
      !n.parameters.text.includes('27B. VOLANTES')
    ) {
      n.parameters.text = n.parameters.text.replace(
        '==================================================\n27. DISEÑO\n==================================================',
        BLOQUE_27B
      );
      prompts++;
    }
  }

  if (
    typeof n.parameters?.inputSchema === 'string' &&
    n.parameters.inputSchema.includes('"PEDIR_MEDIDAS"')
  ) {
    const schema = JSON.parse(n.parameters.inputSchema);
    if (
      schema.properties?.accion?.enum &&
      !schema.properties.accion.enum.includes('INFORMAR_FLYERS')
    ) {
      const idx = schema.properties.accion.enum.indexOf('INFORMAR_TARJETAS');
      if (idx >= 0) {
        schema.properties.accion.enum.splice(idx + 1, 0, 'INFORMAR_FLYERS');
      } else {
        schema.properties.accion.enum.push('INFORMAR_FLYERS');
      }
      n.parameters.inputSchema = JSON.stringify(schema, null, 2);
      schemas++;
    }
  }
}

const saludoHttp = w.nodes.find(x => x.name === 'YCloud Enviar saludo tarjetas');
if (saludoHttp?.parameters) {
  saludoHttp.parameters.jsonBody =
    "={{ $('Preparar envío WhatsApp').first().json.ycloud_request_saludo.body }}";
}

if (!w.nodes.find(x => x.name === 'IF: ¿Enviar saludo?')) {
  const ifVideos = w.nodes.find(x => x.name === 'IF: ¿Enviar videos tarjetas?');
  const pos = ifVideos?.position || [3600, 1024];

  const ifSaludo = {
    parameters: {
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
            leftValue:
              "={{ $('Preparar envío WhatsApp').first().json.enviar_saludo === true }}",
            rightValue: '',
            operator: {
              type: 'boolean',
              operation: 'true',
              singleValue: true
            }
          }
        ],
        combinator: 'and'
      },
      options: {}
    },
    id: uid(),
    name: 'IF: ¿Enviar saludo?',
    type: 'n8n-nodes-base.if',
    typeVersion: 2.3,
    position: [pos[0] - 200, pos[1]]
  };

  w.nodes.push(ifSaludo);

  const wa = w.connections['If:¿Enviar por WhatsApp?'];
  if (wa?.main?.[0]?.[0]?.node === 'IF: ¿Enviar videos tarjetas?') {
    wa.main[0] = [{ node: 'IF: ¿Enviar saludo?', type: 'main', index: 0 }];
  }

  w.connections['IF: ¿Enviar videos tarjetas?'] = w.connections['IF: ¿Enviar videos tarjetas?'] || {};
  const videosTrueWas = w.connections['IF: ¿Enviar videos tarjetas?'].main?.[0];
  const videosFalse = w.connections['IF: ¿Enviar videos tarjetas?'].main?.[1];

  w.connections['IF: ¿Enviar saludo?'] = {
    main: [
      [{ node: 'YCloud Enviar saludo tarjetas', type: 'main', index: 0 }],
      [{ node: 'IF: ¿Enviar videos tarjetas?', type: 'main', index: 0 }]
    ]
  };

  if (videosTrueWas?.[0]?.node === 'YCloud Enviar saludo tarjetas') {
    w.connections['IF: ¿Enviar videos tarjetas?'].main = [
      [{ node: 'YCloud Enviar video tarjetas 1', type: 'main', index: 0 }],
      videosFalse
    ];
  }

  w.connections['Esperar saludo tarjetas'] = {
    main: [[{ node: 'IF: ¿Enviar videos tarjetas?', type: 'main', index: 0 }]]
  };
}

fs.writeFileSync(EDIT, JSON.stringify(w, null, 2) + '\n');

console.log({
  prompts,
  schemas,
  sql: cfg?.parameters?.query?.includes('CATALOGO_FLYERS'),
  switch14: conn?.main?.[14],
  whatsapp: w.connections['If:¿Enviar por WhatsApp?']?.main?.[0]?.[0]?.node,
  ifSaludoT: w.connections['IF: ¿Enviar saludo?']?.main?.[0]?.[0]?.node,
  ifSaludoF: w.connections['IF: ¿Enviar saludo?']?.main?.[1]?.[0]?.node,
  ifVideosT: w.connections['IF: ¿Enviar videos tarjetas?']?.main?.[0]?.[0]?.node,
  afterWaitSaludo: w.connections['Esperar saludo tarjetas']?.main?.[0]?.[0]?.node
});
