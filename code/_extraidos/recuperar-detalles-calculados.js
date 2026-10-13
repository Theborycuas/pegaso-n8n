// ======================================================
// N8N NODE - PEGASO
// ======================================================
// Nombre: Recuperar detalles calculados
// Node ID: 72a84bd2-0212-4ffa-9a0c-45cdfed144a4
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
