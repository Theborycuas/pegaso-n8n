// ======================================================
// N8N NODE - PEGASO
// ======================================================
// Nombre: Resolver turno conversacional
// Node ID: 6739d53a-956f-4bd6-8074-1a01e706192b
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
// NODO N8N: Resolver turno conversacional
// ARCHIVO: code/03-conversacion/resolver-turno-conversacional.js
// VERSION: 1.1
// RESPONSABILIDAD:
// - Tras "Esperar ventana de turno", decidir si esta ejecuci├│n sigue siendo la del ├║ltimo mensaje ENTRANTE de la conversaci├│n (latest-wins por mensajes.id)
// - Ignorar reenv├¡os del mismo mensaje_externo_id (reintentos del webhook): solo cuenta la primera fila
// - Si lleg├│ un mensaje posterior: continuar_procesamiento = false, resultado DEBOUNCE_SUPERSEDED, motivo MENSAJE_POSTERIOR_RECIBIDO (final v├ílido, sin error)
// - Si es la ├║ltima: armar el turno con los ENTRANTE con procesado = false posteriores al ├║ltimo SALIENTE anterior y no m├ís antiguos que turno_max_antiguedad_segundos
// - Entregar turno_texto (un mensaje por l├¡nea, en orden), los ids y el rango turno_desde_id / turno_hasta_id para "Preparar contexto IA" y "Confirmar turno conversacional"
// - Conservar identidad de conversaci├│n/prospecto/contacto durante toda la rama
// - Lanzar error solo si falta el id de "Guardar mensaje entrante" o esa fila no aparece en el historial (configuraci├│n rota)
// - NO escribir en PostgreSQL (la confirmaci├│n at├│mica la hace "Confirmar turno conversacional")
// - NO llamar a la IA ni decidir la acci├│n comercial
// ======================================================

const TURNO_MAX_ANTIGUEDAD_SEGUNDOS_DEFECTO = 600;


// ======================================================
// 1. HELPERS
// ======================================================

function numeroONull(valor) {
  if (
    valor === undefined ||
    valor === null ||
    valor === ''
  ) {
    return null;
  }

  const n = Number(valor);

  return Number.isFinite(n)
    ? n
    : null;
}


function textoONull(valor) {
  if (
    valor === undefined ||
    valor === null
  ) {
    return null;
  }

  const limpio =
    String(valor).trim();

  return limpio !== ''
    ? limpio
    : null;
}


function verdadero(valor) {
  return (
    valor === true ||
    valor === 'true' ||
    valor === 't' ||
    valor === 1 ||
    valor === '1'
  );
}


function direccion(fila) {
  return String(
    fila.direccion ?? ''
  )
    .trim()
    .toUpperCase();
}


function fechaMs(valor) {
  const ms =
    Date.parse(
      valor ?? ''
    );

  return Number.isFinite(ms)
    ? ms
    : null;
}


// ======================================================
// 2. MENSAJE DE ESTA EJECUCI├ôN
// ======================================================

const guardado =
  $('Guardar mensaje entrante').first().json ?? {};

const miId =
  numeroONull(
    guardado.id
  );

if (
  miId === null ||
  miId <= 0
) {
  throw new Error(
    'Resolver turno conversacional: "Guardar mensaje entrante" no devolvi├│ un id v├ílido.'
  );
}


// ======================================================
// 3. RECUPERAR IDENTIDAD DEL FLUJO
// ======================================================
//
// Esta rama recibe como input principal el historial de mensajes,
// por lo que no podemos depender de $input.first().json para
// recuperar prospecto/contacto.
//
// Intentamos obtener la identidad desde nodos anteriores estables.
//
// Prioridad:
// 1. Guardar mensaje entrante
// 2. Unificar conversaci├│n
// 3. Preparar conversaci├│n
// 4. Unificar prospecto
// 5. Resolver prospecto
//
// ======================================================

let unificarConversacion = {};
let prepararConversacion = {};
let unificarProspecto = {};
let resolverProspecto = {};

try {
  unificarConversacion =
    $('Unificar conversaci├│n').first().json ?? {};
} catch (error) {
  unificarConversacion = {};
}

try {
  prepararConversacion =
    $('Preparar conversaci├│n').first().json ?? {};
} catch (error) {
  prepararConversacion = {};
}

try {
  unificarProspecto =
    $('Unificar prospecto').first().json ?? {};
} catch (error) {
  unificarProspecto = {};
}

try {
  resolverProspecto =
    $('Resolver prospecto').first().json ?? {};
} catch (error) {
  resolverProspecto = {};
}


// ------------------------------------------------------
// IDs
// ------------------------------------------------------

const prospectoId =
  numeroONull(
    guardado.prospecto_id
  ) ??
  numeroONull(
    unificarConversacion.prospecto_id
  ) ??
  numeroONull(
    prepararConversacion.prospecto_id
  ) ??
  numeroONull(
    unificarProspecto.prospecto_id
  ) ??
  numeroONull(
    unificarProspecto.id
  ) ??
  numeroONull(
    resolverProspecto.prospecto_id
  ) ??
  numeroONull(
    resolverProspecto.id
  );


const clienteId =
  numeroONull(
    guardado.cliente_id
  ) ??
  numeroONull(
    unificarConversacion.cliente_id
  ) ??
  numeroONull(
    prepararConversacion.cliente_id
  ) ??
  numeroONull(
    unificarProspecto.cliente_id
  ) ??
  numeroONull(
    resolverProspecto.cliente_id
  );


const contactoId =
  numeroONull(
    guardado.contacto_id
  ) ??
  numeroONull(
    unificarConversacion.contacto_id
  ) ??
  numeroONull(
    prepararConversacion.contacto_id
  ) ??
  numeroONull(
    unificarProspecto.contacto_id
  ) ??
  numeroONull(
    resolverProspecto.contacto_id
  );


// ------------------------------------------------------
// Datos de contacto
// ------------------------------------------------------

const telefono =
  textoONull(
    guardado.telefono
  ) ??
  textoONull(
    unificarConversacion.telefono
  ) ??
  textoONull(
    prepararConversacion.telefono
  ) ??
  textoONull(
    unificarProspecto.telefono
  ) ??
  textoONull(
    resolverProspecto.telefono
  );


const nombreWhatsapp =
  textoONull(
    guardado.nombre_whatsapp
  ) ??
  textoONull(
    unificarConversacion.nombre_whatsapp
  ) ??
  textoONull(
    prepararConversacion.nombre_whatsapp
  ) ??
  textoONull(
    unificarProspecto.nombre_whatsapp
  ) ??
  textoONull(
    resolverProspecto.nombre_whatsapp
  );


// ======================================================
// 4. CONFIGURACI├ôN
// ======================================================

let config = {};

try {
  config =
    $('Resolver permiso automatizaci├│n').first().json ?? {};
} catch (error) {
  config = {};
}

const turnoMaxAntiguedadSegundos =
  numeroONull(
    config.turno_max_antiguedad_segundos
  ) ??
  TURNO_MAX_ANTIGUEDAD_SEGUNDOS_DEFECTO;


// ======================================================
// 5. MENSAJES DE LA CONVERSACI├ôN
// ======================================================
//
// El input principal de este nodo son las filas devueltas por:
//
// Recuperar historial conversaci├│n
//
// ======================================================

const filas =
  $input.all()
    .map(
      item => item.json
    )
    .filter(
      fila =>
        fila &&
        numeroONull(
          fila.id
        ) !== null
    )
    .map(
      fila => ({
        ...fila,
        id:
          Number(
            fila.id
          )
      })
    )
    .sort(
      (a, b) =>
        a.id - b.id
    );


const miFila =
  filas.find(
    fila =>
      fila.id === miId
  );

if (!miFila) {
  throw new Error(
    `Resolver turno conversacional: el mensaje ${miId} no aparece en "Recuperar historial conversaci├│n".`
  );
}


const conversacionId =
  numeroONull(
    guardado.conversacion_id
  ) ??
  numeroONull(
    miFila.conversacion_id
  ) ??
  numeroONull(
    unificarConversacion.conversacion_id
  ) ??
  numeroONull(
    unificarConversacion.id
  ) ??
  numeroONull(
    prepararConversacion.conversacion_id
  );


// ======================================================
// 6. VALIDACI├ôN M├ìNIMA DE IDENTIDAD
// ======================================================
//
// conversacion_id es indispensable.
//
// prospecto_id se conserva siempre que exista.
//
// No lanzamos error aqu├¡ por prospecto_id porque:
// - el debounce puede ser reutilizable
// - la derivaci├│n humana s├¡ puede exigirlo despu├®s
//
// ======================================================

if (
  conversacionId === null ||
  conversacionId <= 0
) {
  throw new Error(
    'Resolver turno conversacional: no se pudo resolver conversacion_id.'
  );
}


// ======================================================
// 7. ENTRANTES V├üLIDOS
// ======================================================
//
// Eliminamos duplicados por mensaje_externo_id.
//
// ======================================================

const externosVistos =
  new Set();

const entrantes =
  [];

let miEsDuplicado =
  false;


for (const fila of filas) {

  if (
    direccion(
      fila
    ) !== 'ENTRANTE'
  ) {
    continue;
  }

  const externo =
    textoONull(
      fila.mensaje_externo_id
    );

  const duplicado =
    externo !== null &&
    externosVistos.has(
      externo
    );

  if (
    externo !== null
  ) {
    externosVistos.add(
      externo
    );
  }

  if (duplicado) {

    if (
      fila.id === miId
    ) {
      miEsDuplicado =
        true;
    }

    continue;
  }

  entrantes.push(
    fila
  );
}


const ultimoEntranteId =
  entrantes.length > 0
    ? entrantes[
        entrantes.length - 1
      ].id
    : null;


// ======================================================
// 8. CONTRATO BASE DE IDENTIDAD
// ======================================================

const identidad = {

  conversacion_id:
    conversacionId,

  prospecto_id:
    prospectoId,

  cliente_id:
    clienteId,

  contacto_id:
    contactoId,

  telefono:
    telefono,

  nombre_whatsapp:
    nombreWhatsapp
};


// ======================================================
// 9. SALIDA SIN PROCESAR
// ======================================================

function noProcesar(
  resultado,
  motivo,
  extra = {}
) {

  return [
    {
      json: {

        success:
          true,

        flujo:
          'DEBOUNCE',

        ...identidad,

        mensaje_id:
          miId,

        continuar_procesamiento:
          false,

        resultado_turno:
          resultado,

        motivo_no_procesamiento:
          motivo,

        respuesta_automatica:
          false,

        mensaje_guardado:
          true,

        ultimo_entrante_id:
          ultimoEntranteId,

        ...extra,

        turno_resuelto_at:
          new Date().toISOString()

      }
    }
  ];
}


if (miEsDuplicado) {

  return noProcesar(
    'DUPLICADO',
    'MENSAJE_DUPLICADO',
    {
      mensaje_externo_id:
        textoONull(
          miFila.mensaje_externo_id
        )
    }
  );
}


if (
  ultimoEntranteId !== miId
) {

  return noProcesar(
    'DEBOUNCE_SUPERSEDED',
    'MENSAJE_POSTERIOR_RECIBIDO',
    {
      mensaje_posterior_id:
        ultimoEntranteId
    }
  );
}


// ======================================================
// 10. ARMAR EL TURNO
// ======================================================
//
// Turno = ENTRANTE v├ílidos que cumplen:
//
// - id <= este mensaje
// - id > ├║ltimo SALIENTE anterior a este mensaje
// - procesado = false
// - no m├ís antiguos que turno_max_antiguedad_segundos
//
// ======================================================

const ultimoSalienteAnteriorId =
  filas
    .filter(
      fila =>
        direccion(
          fila
        ) === 'SALIENTE' &&
        fila.id < miId
    )
    .reduce(
      (max, fila) =>
        Math.max(
          max,
          fila.id
        ),
      0
    );


const miFecha =
  fechaMs(
    guardado.enviado_at
  ) ??
  fechaMs(
    miFila.enviado_at
  );


let descartadosPorAntiguedad =
  0;


const turno =
  entrantes.filter(
    fila => {

      if (
        fila.id > miId ||
        fila.id <= ultimoSalienteAnteriorId
      ) {
        return false;
      }

      if (
        verdadero(
          fila.procesado
        )
      ) {
        return false;
      }

      const fecha =
        fechaMs(
          fila.enviado_at
        );

      if (
        miFecha !== null &&
        fecha !== null &&
        miFecha - fecha >
          turnoMaxAntiguedadSegundos * 1000
      ) {

        descartadosPorAntiguedad++;

        return false;
      }

      return true;
    }
  );


if (
  !turno.some(
    fila =>
      fila.id === miId
  )
) {

  return noProcesar(
    'YA_PROCESADO',
    'TURNO_YA_PROCESADO'
  );
}


// ======================================================
// 11. NORMALIZAR MENSAJES DEL TURNO
// ======================================================

const turnoMensajes =
  turno.map(
    fila => ({

      id:
        fila.id,

      contenido:
        String(
          fila.contenido ?? ''
        ).trim(),

      tipo:
        textoONull(
          fila.tipo
        ) ??
        'TEXTO',

      enviado_at:
        fila.enviado_at ??
        null

    })
  );


const turnoTexto =
  turnoMensajes
    .map(
      m =>
        m.contenido
    )
    .filter(
      Boolean
    )
    .join(
      '\n'
    );


// ======================================================
// 12. SALIDA PARA PROCESAR
// ======================================================

return [
  {
    json: {

      success:
        true,

      flujo:
        'DEBOUNCE',

      // -----------------------------------------------
      // IDENTIDAD
      // -----------------------------------------------

      ...identidad,


      // -----------------------------------------------
      // MENSAJE ACTUAL
      // -----------------------------------------------

      mensaje_id:
        miId,


      // -----------------------------------------------
      // CONTROL DE DEBOUNCE
      // -----------------------------------------------

      continuar_procesamiento:
        true,

      resultado_turno:
        'PROCESAR',

      motivo_no_procesamiento:
        null,

      ultimo_entrante_id:
        ultimoEntranteId,

      ultimo_saliente_anterior_id:
        ultimoSalienteAnteriorId ||
        null,


      // -----------------------------------------------
      // TURNO
      // -----------------------------------------------

      turno_mensaje_ids:
        turnoMensajes.map(
          m => m.id
        ),

      turno_desde_id:
        turnoMensajes[0]?.id ??
        miId,

      turno_hasta_id:
        miId,

      cantidad_mensajes_turno:
        turnoMensajes.length,

      turno_mensajes:
        turnoMensajes,

      turno_texto:
        turnoTexto,

      mensajes_descartados_por_antiguedad:
        descartadosPorAntiguedad,


      // -----------------------------------------------
      // CONTROL
      // -----------------------------------------------

      turno_resuelto_at:
        new Date().toISOString()

    }
  }
];
