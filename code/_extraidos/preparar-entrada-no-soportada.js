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
// Convertir una entrada de WhatsApp que todav├¡a no puede
// procesar autom├íticamente el bot en un mensaje v├ílido
// para continuar por:
// contacto ÔåÆ prospecto ÔåÆ conversaci├│n ÔåÆ handoff.
//
// NO deriva todav├¡a.
// Solo marca que esta entrada deber├í terminar en humano.
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
// 4. MOTIVO DE DERIVACI├ôN
// ======================================================

let motivo =
  'FORMATO_NO_SOPORTADO';

let descripcion =
  'El cliente envi├│ un formato que todav├¡a no puede procesarse autom├íticamente.';


switch (tipo) {

  case 'STICKER':
    motivo =
      'STICKER_NO_PROCESABLE';

    descripcion =
      'El cliente envi├│ un sticker que requiere revisi├│n manual.';
    break;


  case 'UBICACION':
    motivo =
      'UBICACION_NO_PROCESABLE';

    descripcion =
      'El cliente comparti├│ una ubicaci├│n que todav├¡a no procesa autom├íticamente el flujo.';
    break;


  case 'CONTACTO':
    motivo =
      'CONTACTO_NO_PROCESABLE';

    descripcion =
      'El cliente comparti├│ un contacto que todav├¡a no procesa autom├íticamente el flujo.';
    break;


  case 'INTERACTIVO':
    motivo =
      'MENSAJE_INTERACTIVO_NO_PROCESABLE';

    descripcion =
      'El cliente envi├│ una interacci├│n de WhatsApp que requiere revisi├│n.';
    break;


  case 'DESCONOCIDO':
    motivo =
      'FORMATO_DESCONOCIDO';

    descripcion =
      'WhatsApp recibi├│ un tipo de mensaje desconocido para el flujo.';
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
