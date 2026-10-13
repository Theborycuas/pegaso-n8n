// ======================================================
// N8N NODE - PEGASO
// ======================================================
// Nombre: Normalizar intervención humana
// Node ID: f7e4c5f2-8a86-458b-b4d0-6e6d79b97bb9
// TypeVersion: 2
//
// Workflow:
// SISTEMA AUTOMATIZADO PEGASO
//
// Workflow ID:
// 09OF22FOxihypeeh
//
// NOTA:
// Archivo generado automáticamente desde n8n.
// El header NO pertenece al código almacenado en n8n.
// ======================================================

// ======================================================
// NORMALIZAR INTERVENCIÓN HUMANA
// PEGASO ADHESIVOS
// VERSION 1.0
// ======================================================

const input = $input.first()?.json ?? {};

function textoONull(valor) {
  if (valor === undefined || valor === null) {
    return null;
  }

  const t = String(valor).trim();
  return t !== '' ? t : null;
}

function telefono(valor) {
  if (valor === undefined || valor === null) {
    return null;
  }

  const t = String(valor)
    .replace(/\D/g, '')
    .trim();

  return t || null;
}


// ======================================================
// EVENTO NORMALIZADO
// ======================================================

const evento =
  input.evento_whatsapp ??
  input;


// ======================================================
// TELÉFONO CLIENTE
// ======================================================
//
// Para mensajes enviados por Pegaso:
//
// Pegaso = FROM
// Cliente = TO
//
// Si el normalizador ya resolvió telefono_cliente,
// lo usamos primero.
// ======================================================

const telefonoCliente =
  telefono(
    evento.telefono_cliente ??
    evento.to ??
    evento.destino ??
    null
  );

if (!telefonoCliente) {
  throw new Error(
    'INTERVENCION HUMANA: no se pudo resolver telefono_cliente.'
  );
}


// ======================================================
// TELÉFONO PEGASO
// ======================================================

const telefonoPegaso =
  telefono(
    evento.display_phone_number ??
    evento.from ??
    null
  );


// ======================================================
// TIPO
// ======================================================

const tipoOriginal =
  String(
    evento.tipo_mensaje ??
    evento.tipo ??
    'text'
  )
    .trim()
    .toLowerCase();

let tipo = 'DESCONOCIDO';

switch (tipoOriginal) {
  case 'text':
    tipo = 'TEXTO';
    break;

  case 'image':
    tipo = 'IMAGEN';
    break;

  case 'audio':
    tipo = 'AUDIO';
    break;

  case 'video':
    tipo = 'VIDEO';
    break;

  case 'document':
    tipo = 'DOCUMENTO';
    break;

  case 'sticker':
    tipo = 'STICKER';
    break;

  case 'location':
    tipo = 'UBICACION';
    break;
}


// ======================================================
// CONTENIDO
// ======================================================

let contenido = null;

if (tipo === 'TEXTO') {
  contenido =
    textoONull(
      evento.texto ??
      evento.text?.body ??
      evento.mensaje
    );
}

else if (tipo === 'IMAGEN') {
  const caption =
    textoONull(
      evento.caption
    );

  contenido =
    caption
      ? `[IMAGEN] ${caption}`
      : '[IMAGEN]';
}

else if (tipo === 'AUDIO') {
  contenido = '[AUDIO]';
}

else if (tipo === 'VIDEO') {
  const caption =
    textoONull(
      evento.caption
    );

  contenido =
    caption
      ? `[VIDEO] ${caption}`
      : '[VIDEO]';
}

else if (tipo === 'DOCUMENTO') {
  const caption =
    textoONull(
      evento.caption
    );

  contenido =
    caption
      ? `[DOCUMENTO] ${caption}`
      : '[DOCUMENTO]';
}

else {
  contenido =
    `[MENSAJE MANUAL ${tipo}]`;
}


// ======================================================
// SALIDA
// ======================================================

return [
  {
    json: {

      intervencion_humana: true,

      origen_mensaje: 'HUMANO',

      enviado_por_bot: false,

      canal: 'WHATSAPP',

      proveedor: 'YCLOUD',

      telefono_cliente:
        telefonoCliente,

      telefono_pegaso:
        telefonoPegaso,

      tipo,

      tipo_original:
        tipoOriginal,

      contenido,

      mensaje_externo_id:
        evento.mensaje_id ??
        evento.wamid ??
        null,

      proveedor_evento_id:
        evento.proveedor_evento_id ??
        null,

      enviado_at:
        evento.fecha_mensaje ??
        (
          evento.timestamp
            ? new Date(
                Number(evento.timestamp) * 1000
              ).toISOString()
            : new Date().toISOString()
        ),

      normalizado_at:
        new Date().toISOString()

    }
  }
];
