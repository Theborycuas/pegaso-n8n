// ======================================================
// N8N NODE - PEGASO
// ======================================================
// Nombre: Preparar galería trabajos
// Node ID: f07313df-fde0-4208-9b4c-d5d498a69070
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
// PREPARAR GALERÍA TRABAJOS - V1.0
// ======================================================
//
// Convierte galeria_trabajos de "Preparar envío WhatsApp"
// en un item por foto o video. "YCloud Enviar galería
// trabajos" los envía en orden, uno por lote.
// ======================================================

let envio = {};
try {
  envio = $('Preparar envío WhatsApp').first().json ?? {};
} catch (_) {
  envio = {};
}

const medios =
  envio.enviar_galeria_trabajos === true && Array.isArray(envio.galeria_trabajos)
    ? envio.galeria_trabajos
    : [];

return medios
  .filter(medio => medio?.body?.to && medio?.body?.type)
  .map(medio => ({
    json: {
      orden: medio.orden,
      body: medio.body
    }
  }));
