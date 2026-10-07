// ======================================================
// NODO N8N: Resolver catalogo Pegaso
// ARCHIVO: code/07-cotizacion/resolver-catalogo-pegaso.js
// VERSION: 1.0
// RESPONSABILIDAD:
// - Procesar 1 item por detalle proveniente de "EXPANDIR DETALLES"
// - Resolver material_id desde material/material_nombre; sin material, usar P4 (Polipropileno, id 1)
// - Resolver producto_id del catálogo Pegaso según material y forma (producto_id = trabajo gráfico, no el sabor: "mora", "frutilla", "queso" NO son producto_id)
// - Marcar requiere_cotizacion_manual si el material no es P4, no se reconoce o no tiene producto automático
// - Adjuntar material_resuelto para trazabilidad
// - NO inventar IDs para materiales no reconocidos (material_id = null)
// - NO consultar PostgreSQL: los catálogos de materiales y productos están fijos en el código
// ======================================================

const items = $input.all();

// ======================================================
// CATÁLOGO MATERIALES
// ======================================================

const MATERIALES = {
  P4: {
    id: 1,
    nombre: 'Polipropileno P4',
    requiereManual: false
  },

  COUCHE: {
    id: 2,
    nombre: 'Papel couché',
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
// CATÁLOGO PRODUCTOS PEGASO
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

  // El extractor todavía puede no enviar material.
  // En etiquetas normales, el material por defecto de Pegaso es P4.
  const textoMaterial = normalizar(
    data.material ??
    data.material_nombre ??
    ''
  );

  // Si no especifica material:
  // usamos P4 como producto estándar de Pegaso.
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

    // No inventamos una clasificación más específica.
    return PRODUCTOS.ETIQUETA_GENERICA;
  }

  // Material sin producto automático conocido.
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

      // Catálogo Pegaso
      producto_id: productoId,
      material_id: material.id,

      // Ayuda para depuración / trazabilidad
      material_resuelto: material.nombre,

      // Solo P4 tiene cálculo automático actualmente.
      requiere_cotizacion_manual:
        material.requiereManual === true ||
        material.id === null ||
        productoId === null
    }
  };
});