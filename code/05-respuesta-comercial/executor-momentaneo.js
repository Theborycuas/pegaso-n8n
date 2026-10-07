// ======================================================
// NODO N8N: EXECUTOR MOMENTANEP
// ARCHIVO: code/05-respuesta-comercial/executor-momentaneo.js
// VERSION: 1.0
// RESPONSABILIDAD:
// - Marcar el final de la ejecución del workflow con un item fijo (placeholder temporal).
// - Devolver message 'LLEGO AL FINAL.', details vacío, cantidad_detalles=0 y source=NONE.
// - NO procesar ni propagar datos del ciclo comercial.
// - NO escribir en PostgreSQL ni enviar mensajes.
// ======================================================
return [
    {
      json: {
       
        message: 'LLEGO AL FINAL.',
        details: [],
        cantidad_detalles: 0,
        source: 'NONE'
      }
    }
  ];