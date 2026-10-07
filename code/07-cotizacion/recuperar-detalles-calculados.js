// ======================================================
// RECUPERAR DETALLES CALCULADOS
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