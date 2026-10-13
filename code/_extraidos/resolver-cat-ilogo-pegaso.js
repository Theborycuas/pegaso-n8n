// ======================================================
// N8N NODE - PEGASO
// ======================================================
// Nombre: Resolver cat├ílogo Pegaso
// Node ID: ec5fcae1-77b3-4f73-9643-6493270fee74
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
// RESOLVER CAT├üLOGO PEGASO
// ======================================================
// Entrada:
//   1 item por detalle desde "EXPANDIR DETALLES"
//
// Objetivo:
//   - Resolver producto_id del cat├ílogo Pegaso
//   - Resolver material_id
//   - Determinar si requiere cotizaci├│n manual
//
// IMPORTANTE:
// "mora", "frutilla", "queso", etc. NO son producto_id.
// producto_id representa el trabajo gr├ífico de Pegaso.
// ======================================================

const items = $input.all();

// ======================================================
// CAT├üLOGO MATERIALES
// ======================================================

const MATERIALES = {
  P4: {
    id: 1,
    nombre: 'Polipropileno P4',
    requiereManual: false
  },

  COUCHE: {
    id: 2,
    nombre: 'Papel couch├®',
    requiereManual: true
  },

  CARTULINA: {
    id: 3,
    nombre: 'Papel cartulina para carpetas',
    requiereManual: true
  },

  TRANSPARENTE: {
    id: 4,
    nombre: 'Adhesivo transparente',
    requiereManual: true
  },

  METALIZADO: {
    id: 5,
    nombre: 'Adhesivo metalizado',
    requiereManual: true
  },

  BOND: {
    id: 6,
    nombre: 'Papel Bond para libretines/talonarios',
    requiereManual: true
  }
};

// ======================================================
// CAT├üLOGO PRODUCTOS PEGASO
// ======================================================

const PRODUCTOS = {
  ETIQUETA_GENERICA: 1,
  ETIQUETA_RECTANGULAR: 2,
  ETIQUETA_TROQUELADA: 3,
  ETIQUETA_REDONDEADA: 4,
  ADHESIVO_TRANSPARENTE: 5,
  ADHESIVO_METALIZADO: 6,
  ADHESIVO_ECOLOGICO: 7,
  PAPEL_COUCHE_ADHESIVO: 8,
  CARTULINA_CARPETAS: 9,
  BOND_LIBRETINES: 10,
  BOND_TALONARIOS: 11
};

// ======================================================
// NORMALIZADOR DE TEXTO
// ======================================================

function normalizar(valor) {
  return String(valor ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase();
}

// ======================================================
// RESOLVER MATERIAL
// ======================================================

function resolverMaterial(data) {

  // El extractor todav├¡a puede no enviar material.
  // En etiquetas normales, el material por defecto de Pegaso es P4.
  const textoMaterial = normalizar(
    data.material ??
    data.material_nombre ??
    ''
  );

  // Si no especifica material:
  // usamos P4 como producto est├índar de Pegaso.
  if (!textoMaterial) {
    return MATERIALES.P4;
  }

  if (
    textoMaterial.includes('P4') ||
    textoMaterial.includes('POLIPROPILENO')
  ) {
    return MATERIALES.P4;
  }

  if (
    textoMaterial.includes('COUCHE') ||
    textoMaterial.includes('COUCHE')
  ) {
    return MATERIALES.COUCHE;
  }

  if (textoMaterial.includes('CARTULINA')) {
    return MATERIALES.CARTULINA;
  }

  if (textoMaterial.includes('TRANSPARENTE')) {
    return MATERIALES.TRANSPARENTE;
  }

  if (textoMaterial.includes('METALIZADO')) {
    return MATERIALES.METALIZADO;
  }

  if (textoMaterial.includes('BOND')) {
    return MATERIALES.BOND;
  }

  // Material mencionado pero no reconocido:
  // no inventamos un ID.
  return {
    id: null,
    nombre: data.material ?? data.material_nombre ?? null,
    requiereManual: true
  };
}

// ======================================================
// RESOLVER PRODUCTO PEGASO
// ======================================================

function resolverProducto(data, material) {

  const forma = normalizar(data.forma);

  // ----------------------------------------------------
  // Materiales especiales primero
  // ----------------------------------------------------

  if (material.id === 4) {
    return PRODUCTOS.ADHESIVO_TRANSPARENTE;
  }

  if (material.id === 5) {
    return PRODUCTOS.ADHESIVO_METALIZADO;
  }

  if (material.id === 2) {
    return PRODUCTOS.PAPEL_COUCHE_ADHESIVO;
  }

  if (material.id === 3) {
    return PRODUCTOS.CARTULINA_CARPETAS;
  }

  // ----------------------------------------------------
  // P4
  // ----------------------------------------------------

  if (material.id === 1) {

    if (
      forma === 'RECTANGULAR' ||
      forma === 'RECTANGULO' ||
      forma === 'RECTA'
    ) {
      return PRODUCTOS.ETIQUETA_RECTANGULAR;
    }

    if (
      forma === 'TROQUELADA' ||
      forma === 'TROQUELADO' ||
      forma === 'IRREGULAR'
    ) {
      return PRODUCTOS.ETIQUETA_TROQUELADA;
    }

    if (
      forma === 'REDONDEADA' ||
      forma === 'PUNTAS REDONDEADAS'
    ) {
      return PRODUCTOS.ETIQUETA_REDONDEADA;
    }

    // No inventamos una clasificaci├│n m├ís espec├¡fica.
    return PRODUCTOS.ETIQUETA_GENERICA;
  }

  // Material sin producto autom├ítico conocido.
  return null;
}

// ======================================================
// PROCESAR DETALLES
// ======================================================

return items.map((item) => {

  const data = item.json;

  const material = resolverMaterial(data);

  const productoId = resolverProducto(
    data,
    material
  );

  return {
    json: {
      ...data,

      // Cat├ílogo Pegaso
      producto_id: productoId,
      material_id: material.id,

      // Ayuda para depuraci├│n / trazabilidad
      material_resuelto: material.nombre,

      // Solo P4 tiene c├ílculo autom├ítico actualmente.
      requiere_cotizacion_manual:
        material.requiereManual === true ||
        material.id === null ||
        productoId === null
    }
  };
});
