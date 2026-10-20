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
  if (typeof n.parameters?.text !== 'string') continue;
  if (
    n.parameters.text.includes('NO inventes precios') &&
    !n.parameters.text.includes('no incluyen IVA')
  ) {
    n.parameters.text = n.parameters.text.replace(
      /NO inventes precios[^\n]*/g,
      '$&\nEl sistema envía al final: *Los precios adjuntos no incluyen IVA*'
    );
  }
}

if (!w.nodes.find(x => x.name === 'IF: ¿Enviar nota IVA?')) {
  const yWts = w.nodes.find(x => x.name === 'YCloud Enviar Wts');
  const creds = yWts?.credentials;
  const pos = yWts?.position || [4224, 1040];

  const ifIva = {
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
              "={{ $('Preparar envío WhatsApp').first().json.enviar_nota_iva === true }}",
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
    name: 'IF: ¿Enviar nota IVA?',
    type: 'n8n-nodes-base.if',
    typeVersion: 2.3,
    position: [pos[0] + 200, pos[1]]
  };

  const waitIva = {
    parameters: { amount: 2 },
    id: uid(),
    name: 'Esperar nota IVA',
    type: 'n8n-nodes-base.wait',
    typeVersion: 1.1,
    position: [pos[0] + 360, pos[1] - 80],
    webhookId: uid()
  };

  const httpIva = {
    parameters: {
      method: 'POST',
      url: '=https://api.ycloud.com/v2/whatsapp/messages',
      authentication: 'genericCredentialType',
      genericAuthType: 'httpHeaderAuth',
      sendHeaders: true,
      headerParameters: {
        parameters: [{ name: 'Content-Type', value: 'application/json' }]
      },
      sendBody: true,
      specifyBody: 'json',
      jsonBody:
        "={{ $('Preparar envío WhatsApp').first().json.ycloud_request_nota_iva.body }}",
      options: {}
    },
    id: uid(),
    name: 'YCloud Enviar nota IVA',
    type: 'n8n-nodes-base.httpRequest',
    typeVersion: 4.5,
    position: [pos[0] + 520, pos[1] - 80],
    credentials: creds,
    onError: 'continueRegularOutput'
  };

  w.nodes.push(ifIva, waitIva, httpIva);

  w.connections['YCloud Enviar Wts'] = {
    main: [[{ node: 'IF: ¿Enviar nota IVA?', type: 'main', index: 0 }]]
  };
  w.connections['IF: ¿Enviar nota IVA?'] = {
    main: [
      [{ node: 'Esperar nota IVA', type: 'main', index: 0 }],
      []
    ]
  };
  w.connections['Esperar nota IVA'] = {
    main: [[{ node: 'YCloud Enviar nota IVA', type: 'main', index: 0 }]]
  };
}

fs.writeFileSync(EDIT, JSON.stringify(w, null, 2) + '\n');
console.log({
  ifIva: !!w.nodes.find(x => x.name === 'IF: ¿Enviar nota IVA?'),
  afterWts: w.connections['YCloud Enviar Wts']?.main?.[0]?.[0]?.node
});
