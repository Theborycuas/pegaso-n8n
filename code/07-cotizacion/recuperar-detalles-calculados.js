// ======================================================
// NODO N8N: Recuperar detalles calculados
// ARCHIVO: code/07-cotizacion/recuperar-detalles-calculados.js
// VERSION: 1.0
// RESPONSABILIDAD:
// - Recuperar todos los items de "Calcular precio detalle" tras el update de la cotización (que deja 1 solo item en el flujo)
// - Lanzar error si no existen detalles calculados
// - Reemitir cada detalle como item independiente (copia superficial) para "Update cotizacion_detalles"
// - NO modificar ni recalcular ningún campo del detalle
// ======================================================

const detalles =
  $('Calcular precio detalle').all();


if (
  !detalles ||
  detalles.length === 0
) {

  throw new Error(
    'No existen detalles calculados para actualizar.'
  );

}


return detalles.map(
  (item) => {

    return {

      json: {
        ...item.json
      }

    };

  }
);