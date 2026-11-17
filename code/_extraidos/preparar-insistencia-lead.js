// ======================================================
// N8N NODE - PEGASO
// ======================================================
// Nombre: Preparar insistencia lead
// Node ID: 2f2e7d2e-bbc4-4fcb-8f15-21c4ed006f15
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
// NODO N8N: Preparar insistencia lead
// ARCHIVO: code/_extraidos/preparar-insistencia-lead.js
// VERSION: 1.0
// RESPONSABILIDAD:
// - Por cada seguimiento reservado en "Reservar insistencias leads",
//   armar el mensaje de insistencia: saludo según la hora de Ecuador,
//   texto y botones "Sí, quiero cotizar" (SEG_SI) / "Ya no, gracias" (SEG_NO)
// - Emitir el cuerpo YCloud (mensaje interactivo de botones; dentro de la
//   ventana de 24 h no requiere plantilla aprobada)
// - NO enviar, NO escribir en PostgreSQL (lo hacen los nodos siguientes)
// ======================================================

// @pegaso-module code/preventa/insistencia-leads.js

function soloDigitos(valor) {
  return String(valor ?? '').replace(/\D/g, '');
}

return $input.all().map((item, indice) => {
  const fila = item.json ?? {};

  const saludo =
    saludoInsistencia(fila.hora_local);

  const texto =
    textoInsistencia(saludo, fila.producto_texto);

  const emisor =
    soloDigitos(fila.telefono_emisor) || '593962645735';

  return {
    json: {
      seguimiento_id: Number(fila.seguimiento_id),
      reserva: fila.reserva ?? null,
      conversacion_id: Number(fila.conversacion_id),
      texto,
      ycloud_body: {
        from: `+${emisor}`,
        to: `+${soloDigitos(fila.telefono)}`,
        type: 'interactive',
        interactive: {
          type: 'button',
          body: { text: texto },
          action: { buttons: botonesInsistencia() }
        }
      }
    },
    pairedItem: { item: indice }
  };
});
