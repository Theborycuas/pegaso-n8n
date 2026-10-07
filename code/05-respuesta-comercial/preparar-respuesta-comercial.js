// ======================================================
// NODO N8N: Preparar respuesta comercial
// ARCHIVO: code/05-respuesta-comercial/preparar-respuesta-comercial.js
// VERSION: 2.2
// RESPONSABILIDAD:
// - Recibir la decisión comercial resuelta (todos los items) y validar conversacion_id.
// - Exigir respuesta_sugerida no vacía; lanzar error si la acción no generó texto.
// - Evitar enviar el mismo texto que ultimo_mensaje_saliente, reemplazándolo por una pregunta neutra.
// - Construir respuesta_final y el objeto mensaje_saliente (SALIENTE, TEXTO) para insertar en mensajes.
// - NO generar contenido comercial nuevo ni decidir la acción.
// - NO escribir en PostgreSQL (lo hace "Guardar mensaje saliente") ni enviar por WhatsApp.
// ======================================================

const items =
  $input.all();


function normalizarParaComparar(valor) {
  return String(valor ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/^[\s¡!¿?.,;:*-]+|[\s¡!¿?.,;:*-]+$/g, '');
}


return items.map(
  (item) => {

    const data =
      item.json;

    const conversacionId =
      Number(
        data.conversacion_id
      );

    if (
      !conversacionId ||
      conversacionId <= 0
    ) {
      throw new Error(
        'No existe conversacion_id válido.'
      );
    }


    let respuesta =
      String(
        data.respuesta_sugerida ?? ''
      ).trim();


    if (
      !respuesta
    ) {
      throw new Error(
        `La acción ${data.accion ?? 'DESCONOCIDA'} no generó respuesta_sugerida.`
      );
    }


    // ==================================================
    // ANTI-REPETICIÓN
    // ==================================================

    const ultimoMensaje =
      String(
        data.ultimo_mensaje_saliente ??
        ''
      ).trim();

    const esDuplicado =
      ultimoMensaje !== '' &&
      normalizarParaComparar(respuesta) ===
      normalizarParaComparar(ultimoMensaje);


    if (
      esDuplicado
    ) {
      // No enviamos literalmente el mismo mensaje.
      // Usamos una salida neutra para solicitar precisión.
      respuesta =
        '¿Qué parte desea que revisemos o aclaremos por favor?';
    }


    return {
      json: {
        ...data,

        respuesta_duplicada_evitable:
          esDuplicado,

        respuesta_final:
          respuesta,

        mensaje_saliente: {
          conversacion_id:
            conversacionId,

          cliente_id:
            data.cliente_id != null
              ? Number(data.cliente_id)
              : null,

          direccion:
            'SALIENTE',

          tipo:
            'TEXTO',

          contenido:
            respuesta
        }
      }
    };
  }
);
