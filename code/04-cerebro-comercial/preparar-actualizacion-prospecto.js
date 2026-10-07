// ======================================================
// PREPARAR ACTUALIZACIÓN PROSPECTO
// ======================================================
// Objetivo:
// - Tomar la decisión comercial ya normalizada.
// - Conservar datos previos del prospecto cuando
//   la nueva interacción no aporta un valor nuevo.
// - Preparar exactamente los campos que actualizará
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
    'No se puede actualizar el prospecto: prospecto_id no existe o es inválido.'
  );
}

// ======================================================
// PRODUCTO / INTERÉS
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
// UBICACIÓN
// ======================================================

// Actualmente el contrato normalizado puede no traer
// ciudad/provincia todavía.
//
// Si posteriormente el cerebro empieza a devolverlos,
// este código ya los soporta.
//
// Mientras tanto conserva lo que ya existía.

const ciudad = conservarTexto(
  data.ciudad,
  data.prospecto_ciudad
);

const provincia = conservarTexto(
  data.provincia,
  data.prospecto_provincia
);

// ======================================================
// INTENCIÓN Y ACCIÓN
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
// Por ahora NO vamos a inventar una máquina de estados
// completa.
//
// Conservamos el estado actual.
// Más adelante:
//   NUEVO
//   COTIZANDO
//   COTIZADO
//   ...
//
// se manejarán según eventos concretos.

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