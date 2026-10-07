// ======================================================
// PREPARAR RESPUESTA COMERCIAL - V2.2
// ======================================================
//
// Recibe la decisión comercial resuelta.
//
// Defensa adicional:
// evita enviar exactamente el mismo texto que el último
// mensaje saliente registrado en el historial reciente.
//
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
