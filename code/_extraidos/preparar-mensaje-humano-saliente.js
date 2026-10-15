// ======================================================
// N8N NODE - PEGASO
// ======================================================
// Nombre: Preparar mensaje humano saliente
// Node ID: 9f4cda82-ef34-4917-9737-2f20f2d934ca
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
// PREPARAR MENSAJE HUMANO SALIENTE
// PEGASO ADHESIVOS
// VERSION 1.2
// RESPONSABILIDAD:
// - Armar la fila SALIENTE del echo de WhatsApp Business
//   (humano o automatización) para "Guardar mensaje humano
//   saliente", conservando mensaje_externo_id.
// - origen_mensaje / intervencion_humana vienen de
//   "Normalizar intervención humana", salvo que "Buscar
//   prospecto intervención humana" marque
//   respuesta_rapida_apertura: el eco es la respuesta
//   automática de una pregunta rápida del anuncio y se
//   guarda como AUTOMATICO (no humano).
// ======================================================

const PREFIJO_AUTOMATICO =
  '[AUTOMATICO WHATSAPP BUSINESS';

const conversacion =
  $input.first()?.json ?? {};

const evento =
  $('Normalizar intervención humana')
    .first()
    .json ?? {};

let respuestaRapidaApertura = false;

try {
  respuestaRapidaApertura =
    $('Buscar prospecto intervención humana')
      .first()
      .json
      ?.respuesta_rapida_apertura === true;
} catch (_) {
  respuestaRapidaApertura = false;
}

const automaticoPorApertura =
  evento.intervencion_humana !== false &&
  respuestaRapidaApertura;

const contenidoBase =
  evento.contenido ??
  '[MENSAJE ENVIADO MANUALMENTE]';


const conversacionId =
  Number(
    conversacion.conversacion_id
  );

if (
  !Number.isFinite(conversacionId) ||
  conversacionId <= 0
) {
  throw new Error(
    'MENSAJE HUMANO: conversacion_id inválido.'
  );
}


return [
  {
    json: {

      conversacion_id:
        conversacionId,

      cliente_id:
        conversacion.cliente_id ?? null,

      prospecto_id:
        conversacion.prospecto_id ?? null,

      telefono:
        conversacion.telefono ??
        evento.telefono_cliente ??
        null,

      direccion:
        'SALIENTE',

      tipo:
        evento.tipo ??
        'TEXTO',

      contenido:
        automaticoPorApertura
          ? `${PREFIJO_AUTOMATICO} · accion=NINGUNA · motivo=RESPUESTA_RAPIDA_APERTURA] ${contenidoBase}`
          : contenidoBase,

      mensaje_externo_id:
        evento.mensaje_externo_id ??
        null,

      enviado_at:
        evento.enviado_at ??
        new Date().toISOString(),

      procesado:
        true,

      origen_mensaje:
        automaticoPorApertura
          ? 'AUTOMATICO_WHATSAPP_BUSINESS'
          : evento.origen_mensaje ?? 'HUMANO',

      intervencion_humana:
        evento.intervencion_humana !== false &&
        !automaticoPorApertura,

      respuesta_rapida_apertura:
        automaticoPorApertura

    }
  }
];
