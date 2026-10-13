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
// ======================================================

const conversacion =
  $input.first()?.json ?? {};

const evento =
  $('Normalizar intervención humana')
    .first()
    .json ?? {};


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
        evento.contenido ??
        '[MENSAJE ENVIADO MANUALMENTE]',

      mensaje_externo_id:
        evento.mensaje_externo_id ??
        null,

      enviado_at:
        evento.enviado_at ??
        new Date().toISOString(),

      procesado:
        true,

      origen_mensaje:
        'HUMANO',

      intervencion_humana:
        true

    }
  }
];
