// ======================================================
// N8N NODE - PEGASO
// ======================================================
// Nombre: Preparar respuesta comercial
// Node ID: 29a9ba73-a457-44ed-88e2-71ffd76be125
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
// PREPARAR RESPUESTA COMERCIAL - V2.5
// ======================================================
//
// Recibe la decisión comercial resuelta.
//
// Defensa adicional:
// - si la decisión trae omitir_envio (acción ya atendida,
//   medidas ya solicitadas sin dato nuevo) o la respuesta es
//   idéntica al último SALIENTE de "Preparar contexto IA",
//   o es la misma familia (Permítame… / ubicación Quito),
//   NO se envía: respuesta_final queda como marcador
//   [RESPUESTA AUTOMÁTICA OMITIDA · motivo=...] para que el
//   SALIENTE registrado cierre el turno sin llegar al cliente.
// - V2.4: omite parafrasis de la misma acción (Permítame
//   archivo vs imagen; tres textos de Quito distintos).
//
// ======================================================

const PREFIJO_RESPUESTA_OMITIDA = '[RESPUESTA AUTOMÁTICA OMITIDA';

const items =
  $input.all();

let contextoIA = {};

try {
  contextoIA =
    $('Preparar contexto IA').first().json ?? {};
} catch (error) {
  contextoIA = {};
}


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


    const omisionSolicitada =
      data.omitir_envio === true;

    if (
      !respuesta &&
      !omisionSolicitada
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
        contextoIA.ultimo_saliente?.contenido ??
        contextoIA.ultimo_mensaje_saliente ??
        ''
      ).trim();

    const respuestaNorm =
      normalizarParaComparar(respuesta);

    const ultimoNorm =
      normalizarParaComparar(ultimoMensaje);

    const mismoPermita =
      respuestaNorm.startsWith('permitame un momento') &&
      ultimoNorm.startsWith('permitame un momento');

    const mismaUbicacion =
      (
        /\bciudad de quito\b|\bestamos ubicados\b|\benvios para todo el pais\b/.test(
          respuestaNorm
        )
      ) &&
      (
        /\bciudad de quito\b|\bestamos ubicados\b|\benvios para todo el pais\b/.test(
          ultimoNorm
        )
      );

    const mismoInicio =
      respuestaNorm.length >= 40 &&
      ultimoNorm.length >= 40 &&
      respuestaNorm.slice(0, 48) === ultimoNorm.slice(0, 48);

    const noPudimosLeer =
      /no pudimos (leer|visualizar)|podria (escribirnos nuevamente|reenviarlo)/.test(
        respuestaNorm
      );

    const ultimoYaPidioMedidasORequerimiento =
      /\ben que medidas|ancho y alto|cual es su requerimiento|con mucho gusto le podemos ayudar/.test(
        ultimoNorm
      );

    const esDuplicado =
      !omisionSolicitada &&
      ultimoMensaje !== '' &&
      (
        respuestaNorm === ultimoNorm ||
        mismoPermita ||
        mismaUbicacion ||
        mismoInicio ||
        (noPudimosLeer && ultimoYaPidioMedidasORequerimiento)
      );

    const omitirEnvio =
      omisionSolicitada ||
      esDuplicado;

    const motivoOmisionEnvio =
      omisionSolicitada
        ? (data.motivo_omision_envio ?? 'OMISION_SOLICITADA')
        : esDuplicado
          ? 'RESPUESTA_IDENTICA_A_ULTIMO_SALIENTE'
          : null;

    if (omitirEnvio) {
      respuesta =
        `${PREFIJO_RESPUESTA_OMITIDA} · motivo=${motivoOmisionEnvio}]`;
    }


    return {
      json: {
        ...data,

        respuesta_duplicada_evitable:
          esDuplicado,

        omitir_envio:
          omitirEnvio,

        motivo_omision_envio:
          motivoOmisionEnvio,

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
