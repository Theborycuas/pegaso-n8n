// ======================================================
// NODO N8N: Finalizar ciclo comercial
// ARCHIVO: code/05-respuesta-comercial/finalizar-ciclo-comercial.js
// VERSION: 1.0
// RESPONSABILIDAD:
// - Cerrar la rama de respuesta comercial devolviendo un item fijo de fin de ciclo.
// - Devolver message fijo, details vacío, cantidad_detalles=0 y source=NONE.
// - NO propagar los datos del ciclo comercial (descarta el input).
// - NO escribir en PostgreSQL ni enviar mensajes.
// ======================================================
return [
    {
      json: {      
        message: 'Finalizado el siclo comercial',
        details: [],
        cantidad_detalles: 0,
        source: 'NONE'
      }
    }
  ];