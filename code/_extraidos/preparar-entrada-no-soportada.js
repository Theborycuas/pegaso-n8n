// ======================================================
// N8N NODE - PEGASO
// ======================================================
// Nombre: Preparar entrada no soportada
// Node ID: b3f929c7-f9a4-4f39-9508-11d8b1d0c96f
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
// PREPARAR ENTRADA NO SOPORTADA
// PEGASO ADHESIVOS
// ======================================================
//
// Objetivo:
// Convertir una entrada de WhatsApp que todavía no puede
// procesar automáticamente el bot en un mensaje válido
// para continuar por:
// contacto → prospecto → conversación → handoff.
//
// NO deriva todavía.
// Solo marca que esta entrada deberá terminar en humano.
// ======================================================

const input = $input.first().json;


// ======================================================
// 1. HELPERS
// ======================================================

function textoONull(valor) {
  if (
    valor === undefined ||
    valor === null
  ) {
    return null;
  }

  const limpio = String(valor).trim();

  return limpio !== ''
    ? limpio
    : null;
}


// ======================================================
// 2. TIPO RECIBIDO
// ======================================================

const tipo =
  String(
    input.tipo ??
    'DESCONOCIDO'
  )
    .trim()
    .toUpperCase();


// ======================================================
// 3. MENSAJE ORIGINAL / DESCRIPTOR
// ======================================================

const mensajeOriginal =
  textoONull(input.mensaje);


// ======================================================
// 4. MOTIVO DE DERIVACIÓN
// ======================================================

let motivo =
  'FORMATO_NO_SOPORTADO';

let descripcion =
  'El cliente envió un formato que todavía no puede procesarse automáticamente.';


switch (tipo) {

  case 'STICKER':
    motivo =
      'STICKER_NO_PROCESABLE';

    descripcion =
      'El cliente envió un sticker que requiere revisión manual.';
    break;


  case 'UBICACION':
    motivo =
      'UBICACION_NO_PROCESABLE';

    descripcion =
      'El cliente compartió una ubicación que todavía no procesa automáticamente el flujo.';
    break;


  case 'CONTACTO':
    motivo =
      'CONTACTO_NO_PROCESABLE';

    descripcion =
      'El cliente compartió un contacto que todavía no procesa automáticamente el flujo.';
    break;


  case 'INTERACTIVO':
    motivo =
      'MENSAJE_INTERACTIVO_NO_PROCESABLE';

    descripcion =
      'El cliente envió una interacción de WhatsApp que requiere revisión.';
    break;


  case 'DESCONOCIDO':
    motivo =
      'FORMATO_DESCONOCIDO';

    descripcion =
      'WhatsApp recibió un tipo de mensaje desconocido para el flujo.';
    break;
}


// ======================================================
// 5. MENSAJE QUE PERSISTIREMOS
// ======================================================

const mensaje =
  mensajeOriginal ??
  `[${tipo}] ${descripcion}`;


// ======================================================
// 6. SALIDA
// ======================================================

return [
  {
    json: {

      ...input,

      mensaje,

      // ----------------------------------------------
      // CONTROL DE ENTRADA
      // ----------------------------------------------

      entrada_no_soportada:
        true,

      requiere_humano_entrada:
        true,

      motivo_derivacion_entrada:
        motivo,

      prioridad_derivacion_entrada:
        'NORMAL',

      requiere_notificacion_entrada:
        true,

      descripcion_entrada_no_soportada:
        descripcion,

      entrada_no_soportada_preparada:
        true
    }
  }
];
