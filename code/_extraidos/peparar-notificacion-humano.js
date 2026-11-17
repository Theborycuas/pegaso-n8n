// ======================================================
// N8N NODE - PEGASO
// ======================================================
// Nombre: Peparar notificacion humano
// Node ID: bc2e3649-a530-43b4-be61-72665ab148cf
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
// NODO N8N: Peparar notificacion humano
// ARCHIVO: code/06-derivacion-humana/preparar-notificacion-humano.js
// VERSION: 2.2
// RESPONSABILIDAD:
// - Construir una notificación INTERNA para Pegaso cuando una conversación requiere intervención humana
// - Clasificar la alerta en una categoría (INTERESADO_PAGO, PAGO_REPORTADO, SOLICITA_CONTACTO, ARCHIVO_REQUIERE_REVISION, NEGOCIACION, RECLAMO, REVISION_GENERAL)
// - Ajustar la prioridad de la alerta según la categoría
// - Generar asunto, texto plano y HTML del email con datos del prospecto y su último mensaje
// - Ante comprobante/reporte de pago: asunto "SE RECIBIÓ UN COMPROBANTE DE PAGO" (sin confirmar autenticidad)
// - Marcar canal_notificacion = EMAIL (destinos previstos: email Brevo/Resend; WhatsApp interno a futuro)
// - NO enviar el correo (lo hacen los nodos HTTP "Brevo - Enviar notificación humana" y, como respaldo, "Resend - Enviar notificación humana")
// - NO enviar nada al prospecto
// ======================================================

// @pegaso-module code/preventa/notificacion-humano.js

return $input.all().map((item, index) => {
  const input = item.json.payload ? {
    ...item.json.payload,
    notificacion_id: item.json.notificacion_id,
    notificacion_reserva: item.json.notificacion_reserva
  } : item.json;
  return { ...construirNotificacionHumano(input)[0], pairedItem: { item: index } };
});
