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

const BLOQUE_VIEJO = `==================================================
27A. TARJETAS DE PRESENTACIÓN (NO ES ETIQUETA)
==================================================`;

const BLOQUE_NUEVO = `==================================================
27A. TARJETAS DE PRESENTACIÓN (NO ES ETIQUETA)
==================================================

Las tarjetas y las etiquetas son productos distintos: precios,
material y entregas NO se mezclan.

- Si el mensaje actual pide tarjetas de presentación / visita
  (y NO pide etiquetas adhesivas), o contexto_comercial.producto_linea
  = TARJETAS_PRESENTACION: responde SOLO reglas de tarjetas.
- Si pide etiquetas, stickers o adhesivos: responde SOLO reglas
  de etiquetas (P4, metodología semanal de viernes).
- Si mezcla ambos en el mismo mensaje: RESPONDER_GENERAL y
  aclara qué producto necesita. No cotices P4 ni reenvíes el catálogo.

PRIMER CONTACTO (no hay catalogo_tarjetas.enviada_at):
intencion = CONSULTAR_PRECIO
accion = INFORMAR_TARJETAS
requiere_humano = false
motivo_derivacion = NINGUNO
producto = "tarjetas de presentación"
respuesta_sugerida = "Le adjunto videos y precios de los acabados que manejamos en tarjetas de presentación"

El sistema envía un saludo corto, los 4 videos con precio y esa frase.
NO expliques en este turno el material, el mínimo, las caras ni las entregas.
Deja que el cliente pregunte.

TURNOS SIGUIENTES (ya se envió el catálogo), según pregunte:
- material / papel / couche → INFORMAR_MATERIAL:
  Couche 300 gr, medida estándar 9x5 cm.
- tiempo / entrega / para cuándo → INFORMAR_ENTREGA:
  si el pedido ingresa con abono lunes o martes, se envía el miércoles;
  si ingresa miércoles o jueves, se envía el viernes.
  NO uses la metodología semanal de etiquetas (viernes 17:00).
- 1 o 2 caras / ambos lados → RESPONDER_GENERAL:
  mismo precio; comúnmente ambos lados.
- mínimo / varios diseños → INFORMAR_MINIMO:
  1000 por diseño, mismo diseño, no se divide.
- acabado / precio → no inventes precios; remite a los videos.
- estampitas u otra medida Couche 300 gr → múltiplos de 9x5 cm
  (18x10 cm equivale a 2 tarjetas).

NO uses COTIZAR_P4 ni PEDIR_MEDIDAS de etiquetas mientras la línea sea tarjetas.
NO digas que solo trabajan etiquetas.
NO inventes precios distintos a los del catálogo.

Flyers, volantes, afiches u otro impreso (no tarjeta ni etiqueta):
accion = DERIVAR_HUMANO, requiere_humano = true, motivo_derivacion = OTRO.


`;

let prompts = 0;
for (const n of w.nodes) {
  if (
    typeof n.parameters?.text === 'string' &&
    n.parameters.text.includes(BLOQUE_VIEJO)
  ) {
    const start = n.parameters.text.indexOf(BLOQUE_VIEJO);
    const end = n.parameters.text.indexOf(
      '==================================================\n27. DISEÑO',
      start
    );
    if (start >= 0 && end > start) {
      n.parameters.text =
        n.parameters.text.slice(0, start) +
        BLOQUE_NUEVO +
        n.parameters.text.slice(end);
      prompts++;
    }
  }
}

const yImg = w.nodes.find(x => x.name === 'YCloud Enviar imagen');
const creds = yImg?.credentials;
const video1 = w.nodes.find(x => x.name === 'YCloud Enviar video tarjetas 1');
const pos = video1?.position || [3856, 1200];

if (!w.nodes.find(x => x.name === 'YCloud Enviar saludo tarjetas')) {
  const saludo = {
    parameters: {
      method: 'POST',
      url: '=https://api.ycloud.com/v2/whatsapp/messages',
      authentication: 'genericCredentialType',
      genericAuthType: 'httpHeaderAuth',
      sendHeaders: true,
      headerParameters: {
        parameters: [
          { name: 'Content-Type', value: 'application/json' }
        ]
      },
      sendBody: true,
      specifyBody: 'json',
      jsonBody:
        "={{ $('Preparar envío WhatsApp').first().json.ycloud_request_saludo_tarjetas.body }}",
      options: {}
    },
    id: uid(),
    name: 'YCloud Enviar saludo tarjetas',
    type: 'n8n-nodes-base.httpRequest',
    typeVersion: 4.5,
    position: [pos[0] - 180, pos[1] - 140],
    credentials: creds,
    onError: 'continueRegularOutput'
  };

  const espera = {
    parameters: {
      amount: 2
    },
    id: uid(),
    name: 'Esperar saludo tarjetas',
    type: 'n8n-nodes-base.wait',
    typeVersion: 1.1,
    position: [pos[0] - 40, pos[1] - 140],
    webhookId: uid()
  };

  w.nodes.push(saludo, espera);

  const ifVideos = w.connections['IF: ¿Enviar videos tarjetas?'];
  if (ifVideos?.main?.[0]?.[0]?.node === 'YCloud Enviar video tarjetas 1') {
    ifVideos.main[0] = [
      { node: 'YCloud Enviar saludo tarjetas', type: 'main', index: 0 }
    ];
  }

  w.connections['YCloud Enviar saludo tarjetas'] = {
    main: [[{ node: 'Esperar saludo tarjetas', type: 'main', index: 0 }]]
  };
  w.connections['Esperar saludo tarjetas'] = {
    main: [[{ node: 'YCloud Enviar video tarjetas 1', type: 'main', index: 0 }]]
  };
}

fs.writeFileSync(EDIT, JSON.stringify(w, null, 2) + '\n');

console.log({
  prompts,
  saludo: !!w.nodes.find(x => x.name === 'YCloud Enviar saludo tarjetas'),
  ifVideosTrue: w.connections['IF: ¿Enviar videos tarjetas?']?.main?.[0]?.[0]?.node,
  afterSaludo: w.connections['Esperar saludo tarjetas']?.main?.[0]?.[0]?.node
});
