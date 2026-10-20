import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const EDIT = path.join(REPO, 'workflows', 'sistema-automatizado-pegaso.edit.json');

const TEXTO_CIERRE =
  'Trabajamos tarjetas de presentación en papel Couche 300 gr, medida estándar 9x5 cm. ' +
  'El mínimo es 1000 unidades por diseño (mismo diseño; no se dividen en varios). ' +
  'Impresión a 1 o 2 caras al mismo precio. ' +
  'Entregas de tarjetas: si el pedido ingresa con abono lunes o martes, se envía el miércoles; ' +
  'si ingresa miércoles o jueves, se envía el viernes. ' +
  'Si necesita otra medida en Couche 300 gr (p. ej. estampitas), se calcula en múltiplos de la tarjeta 9x5 cm.';

const w = JSON.parse(fs.readFileSync(EDIT, 'utf8'));

function uid() {
  return crypto.randomUUID();
}

function patchSwitch(node) {
  const rules = node.parameters?.rules?.values;
  if (!Array.isArray(rules)) return false;
  let changed = false;
  for (const r of rules) {
    const cond = r.conditions?.conditions?.[0];
    if (cond?.rightValue === 'VALIDAR_ABONO') {
      cond.rightValue = 'INFORMAR_TARJETAS';
      r.outputKey = 'INFORMAR_TARJETAS';
      changed = true;
    }
  }
  return changed;
}

for (const n of w.nodes) {
  if (n.name === 'Enrutar acción comercial') patchSwitch(n);
}

const conn = w.connections['Enrutar acción comercial'];
if (conn?.main?.[16] && conn.main[16].length === 0) {
  conn.main[16] = [{ node: 'Preparar respuesta comercial', type: 'main', index: 0 }];
}

const cfg = w.nodes.find(x => x.name === 'Obtener configuración MODO_PRUEBA');
if (cfg?.parameters?.query && !cfg.parameters.query.includes('CATALOGO_TARJETAS')) {
  cfg.parameters.query = cfg.parameters.query.replace(
    "'IMAGEN_DATOS_PAGO'\n)",
    "'IMAGEN_DATOS_PAGO',\n    'CATALOGO_TARJETAS'\n)"
  );
}

const INSERT_BEFORE =
  '==================================================\n27. DISEÑO\n==================================================';

const BLOQUE = `==================================================
27A. TARJETAS DE PRESENTACIÓN (NO ES ETIQUETA)
==================================================

Si el cliente pide con claridad tarjetas de presentación / tarjetas de visita
(y NO pide etiquetas adhesivas):

intencion = CONSULTAR_PRECIO
accion = INFORMAR_TARJETAS
requiere_humano = false
motivo_derivacion = NINGUNO
producto = "tarjetas de presentación"

El sistema enviará automáticamente los 4 videos de acabados con su precio.
respuesta_sugerida = texto de cierre sobre Couche 300 gr, 9x5 cm, mínimo 1000
por diseño, 1 o 2 caras al mismo precio y entregas lunes-martes→miércoles /
miércoles-jueves→viernes.

NO uses COTIZAR_P4 ni PEDIR_MEDIDAS de etiquetas.
NO digas que solo trabajan etiquetas.
NO inventes precios distintos a los del catálogo.

Flyers, volantes, afiches u otro impreso (no tarjeta ni etiqueta):
accion = DERIVAR_HUMANO, requiere_humano = true, motivo_derivacion = OTRO.

Si mezcla etiqueta + tarjeta, aclara el producto con RESPONDER_GENERAL.


==================================================
27. DISEÑO
==================================================`;

let prompts = 0;
let schemas = 0;
for (const n of w.nodes) {
  if (
    typeof n.parameters?.text === 'string' &&
    n.parameters.text.includes(INSERT_BEFORE) &&
    !n.parameters.text.includes('INFORMAR_TARJETAS')
  ) {
    n.parameters.text = n.parameters.text.replace(INSERT_BEFORE, BLOQUE);
    prompts++;
  }
  if (
    typeof n.parameters?.inputSchema === 'string' &&
    n.parameters.inputSchema.includes('"PEDIR_MEDIDAS"')
  ) {
    const schema = JSON.parse(n.parameters.inputSchema);
    if (
      schema.properties?.accion?.enum &&
      !schema.properties.accion.enum.includes('INFORMAR_TARJETAS')
    ) {
      const idx = schema.properties.accion.enum.indexOf('INFORMAR_DISENO');
      if (idx >= 0) {
        schema.properties.accion.enum.splice(idx + 1, 0, 'INFORMAR_TARJETAS');
      } else {
        schema.properties.accion.enum.push('INFORMAR_TARJETAS');
      }
      n.parameters.inputSchema = JSON.stringify(schema, null, 2);
      schemas++;
    }
  }
}

const yImg = w.nodes.find(x => x.name === 'YCloud Enviar imagen');
const creds = yImg?.credentials;
const pos = yImg?.position || [3856, 784];

function httpVideoNode(name, index, x, y) {
  return {
    parameters: {
      method: 'POST',
      url: '=https://api.ycloud.com/v2/whatsapp/messages',
      authentication: 'genericCredentialType',
      genericAuthType: 'httpHeaderAuth',
      sendHeaders: true,
      headerParameters: {
        parameters: [
          {
            name: 'Content-Type',
            value: 'application/json'
          }
        ]
      },
      sendBody: true,
      specifyBody: 'json',
      jsonBody: `={{ $('Preparar envío WhatsApp').first().json.videos_tarjetas[${index}].body }}`,
      options: {}
    },
    id: uid(),
    name,
    type: 'n8n-nodes-base.httpRequest',
    typeVersion: 4.5,
    position: [x, y],
    credentials: creds,
    onError: 'continueRegularOutput'
  };
}

function waitNode(name, x, y) {
  return {
    parameters: {
      amount: 2
    },
    id: uid(),
    name,
    type: 'n8n-nodes-base.wait',
    typeVersion: 1.1,
    position: [x, y],
    webhookId: uid()
  };
}

const ifVideos = {
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
            "={{ $('Preparar envío WhatsApp').first().json.enviar_videos_tarjetas === true }}",
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
  name: 'IF: ¿Enviar videos tarjetas?',
  type: 'n8n-nodes-base.if',
  typeVersion: 2.3,
  position: [pos[0] - 220, pos[1] + 280]
};

const videoNodes = [0, 1, 2, 3].map((i) =>
  httpVideoNode(
    `YCloud Enviar video tarjetas ${i + 1}`,
    i,
    pos[0] + i * 48,
    pos[1] + 420
  )
);
const waitNodes = [0, 1, 2, 3].map((i) =>
  waitNode(
    `Esperar video tarjetas ${i + 1}`,
    pos[0] + i * 48 + 20,
    pos[1] + 560
  )
);

if (!w.nodes.find(x => x.name === 'IF: ¿Enviar videos tarjetas?')) {
  w.nodes.push(ifVideos, ...videoNodes, ...waitNodes);

  const envioConn = w.connections['If:¿Enviar por WhatsApp?'];
  if (envioConn?.main?.[0]?.[0]?.node === 'IF: ¿Enviar imagen informativa?') {
    envioConn.main[0] = [
      { node: 'IF: ¿Enviar videos tarjetas?', type: 'main', index: 0 }
    ];
  }

  w.connections['IF: ¿Enviar videos tarjetas?'] = {
    main: [
      [{ node: 'YCloud Enviar video tarjetas 1', type: 'main', index: 0 }],
      [{ node: 'IF: ¿Enviar imagen informativa?', type: 'main', index: 0 }]
    ]
  };

  w.connections['YCloud Enviar video tarjetas 1'] = {
    main: [[{ node: 'Esperar video tarjetas 1', type: 'main', index: 0 }]]
  };
  w.connections['Esperar video tarjetas 1'] = {
    main: [[{ node: 'YCloud Enviar video tarjetas 2', type: 'main', index: 0 }]]
  };
  w.connections['YCloud Enviar video tarjetas 2'] = {
    main: [[{ node: 'Esperar video tarjetas 2', type: 'main', index: 0 }]]
  };
  w.connections['Esperar video tarjetas 2'] = {
    main: [[{ node: 'YCloud Enviar video tarjetas 3', type: 'main', index: 0 }]]
  };
  w.connections['YCloud Enviar video tarjetas 3'] = {
    main: [[{ node: 'Esperar video tarjetas 3', type: 'main', index: 0 }]]
  };
  w.connections['Esperar video tarjetas 3'] = {
    main: [[{ node: 'YCloud Enviar video tarjetas 4', type: 'main', index: 0 }]]
  };
  w.connections['YCloud Enviar video tarjetas 4'] = {
    main: [[{ node: 'Esperar video tarjetas 4', type: 'main', index: 0 }]]
  };
  w.connections['Esperar video tarjetas 4'] = {
    main: [[{ node: 'YCloud Enviar Wts', type: 'main', index: 0 }]]
  };
}

fs.writeFileSync(EDIT, JSON.stringify(w, null, 2) + '\n');

console.log({
  texto_cierre_chars: TEXTO_CIERRE.length,
  prompts,
  schemas,
  sql: cfg?.parameters?.query?.includes('CATALOGO_TARJETAS'),
  switch16: conn?.main?.[16],
  ifVideos: !!w.nodes.find(x => x.name === 'IF: ¿Enviar videos tarjetas?'),
  videoNodes: w.nodes.filter(x =>
    x.name?.startsWith('YCloud Enviar video tarjetas')
  ).length
});
