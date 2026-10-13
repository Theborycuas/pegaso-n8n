// ======================================================
// N8N NODE - PEGASO
// ======================================================
// Nombre: Preparar actualizaci├│n prospecto
// Node ID: 862e8f48-a08f-4ff8-ad24-797075d126d3
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
// PREPARAR ACTUALIZACI├ôN PROSPECTO
// ======================================================
// Objetivo:
// - Tomar la decisi├│n comercial ya normalizada.
// - Conservar datos previos del prospecto cuando
//   la nueva interacci├│n no aporta un valor nuevo.
// - Preparar exactamente los campos que actualizar├í
//   PostgreSQL en pegaso.prospectos.
// ======================================================

const data = $input.first().json;

// ------------------------------------------------------
// HELPERS
// ------------------------------------------------------

function textoUtil(valor) {
  if (valor === null || valor === undefined) return null;

  const texto = String(valor).trim();

  if (texto === '') return null;

  return texto;
}

function conservarTexto(nuevo, anterior) {
  const nuevoLimpio = textoUtil(nuevo);

  if (nuevoLimpio !== null) {
    return nuevoLimpio;
  }

  return textoUtil(anterior);
}

// ======================================================
// VALIDAR PROSPECTO
// ======================================================

const prospectoId =
  data.prospecto_id !== null &&
  data.prospecto_id !== undefined
    ? Number(data.prospecto_id)
    : null;

if (
  prospectoId === null ||
  !Number.isFinite(prospectoId)
) {
  throw new Error(
    'No se puede actualizar el prospecto: prospecto_id no existe o es inv├ílido.'
  );
}

// ======================================================
// PRODUCTO / INTER├ëS
// ======================================================

// El cerebro comercial devuelve "producto".
// El prospecto guarda "producto_interes".
//
// Si el mensaje nuevo no trae producto, conservamos
// prospecto_producto_interes.

const productoInteres = conservarTexto(
  data.producto,
  data.prospecto_producto_interes
);

// ======================================================
// UBICACI├ôN
// ======================================================

// Actualmente el contrato normalizado puede no traer
// ciudad/provincia todav├¡a.
//
// Si posteriormente el cerebro empieza a devolverlos,
// este c├│digo ya los soporta.
//
// Mientras tanto conserva lo que ya exist├¡a.

const ciudad = conservarTexto(
  data.ciudad,
  data.prospecto_ciudad
);

const provincia = conservarTexto(
  data.provincia,
  data.prospecto_provincia
);

// ======================================================
// INTENCI├ôN Y ACCI├ôN
// ======================================================

const ultimaIntencion = textoUtil(data.intencion);

const ultimaAccion = textoUtil(data.accion);

// ======================================================
// REQUIERE HUMANO
// ======================================================

const requiereHumano =
  typeof data.requiere_humano === 'boolean'
    ? data.requiere_humano
    : Boolean(data.prospecto_requiere_humano);

// ======================================================
// ESTADO COMERCIAL
// ======================================================
//
// Por ahora NO vamos a inventar una m├íquina de estados
// completa.
//
// Conservamos el estado actual.
// M├ís adelante:
//   NUEVO
//   COTIZANDO
//   COTIZADO
//   ...
//
// se manejar├ín seg├║n eventos concretos.

const estado =
  textoUtil(data.prospecto_estado) ??
  'NUEVO';

// ======================================================
// SALIDA
// ======================================================

return [
  {
    json: {
      ...data,

      // ID utilizado por el nodo PostgreSQL Update
      prospecto_id_update: prospectoId,

      // Valores finales a persistir
      prospecto_estado_update: estado,

      prospecto_producto_interes_update:
        productoInteres,

      prospecto_ciudad_update:
        ciudad,

      prospecto_provincia_update:
        provincia,

      prospecto_ultima_intencion_update:
        ultimaIntencion,

      prospecto_ultima_accion_update:
        ultimaAccion,

      prospecto_requiere_humano_update:
        requiereHumano,

      prospecto_actualizado_at:
        new Date().toISOString()
    }
  }
];
