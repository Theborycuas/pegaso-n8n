// ======================================================
// N8N NODE - PEGASO
// ======================================================
// Nombre: Preparar contexto IA
// Node ID: 0c46fe20-0143-4c5a-8050-f4795b50e8a2
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
// NODO N8N: Preparar contexto IA
// ARCHIVO: code/03-conversacion/preparar-contexto-ia.js
// VERSION: 4.1
// ======================================================
//
// RESPONSABILIDAD:
//
// - Construir el contexto final para el cerebro comercial.
// - Mantener "Preparar conversación" como fuente de verdad
//   para identidad y memoria comercial persistida.
// - Usar prioritariamente el turno ENRIQUECIDO recibido por
//   la entrada del nodo (audio transcrito, imágenes, etc.).
// - Usar "Resolver turno conversacional" como fallback.
// - Incorporar análisis de imagen válido desde Groq,
//   DeepSeek u OpenAI.
// - Propagar medidas escritas detectadas en imágenes de forma
//   estructurada (ancho/alto/diámetro) sin romper el contexto actual.
// - Incorporar transcripciones de audio ya aplicadas al turno.
// - NO entregar links de multimedia al cerebro.
// - Limitar el historial libre a una ventana reciente.
// - Limitar el número máximo de mensajes históricos.
// - Detectar si empieza una nueva sesión por inactividad.
// - Conservar contexto_comercial estructurado aunque el
//   historial libre haya expirado.
// - NO llamar a IA.
// - NO escribir PostgreSQL.
//
// ======================================================


// ======================================================
// 0. CONFIGURACIÓN
// ======================================================

const VENTANA_HISTORIAL_HORAS = 24;

const MAX_MENSAJES_HISTORIAL = 24;

const MAX_SALIENTES_RECIENTES = 6;

const LARGO_MAXIMO_CONTENIDO_HISTORIAL = 4000;


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


function booleano(valor, defecto = false) {
  if (typeof valor === 'boolean') {
    return valor;
  }

  if (
    valor === 'true' ||
    valor === 1 ||
    valor === '1'
  ) {
    return true;
  }

  if (
    valor === 'false' ||
    valor === 0 ||
    valor === '0'
  ) {
    return false;
  }

  return defecto;
}


function primeroDefinido(...valores) {
  for (const valor of valores) {
    if (
      valor !== undefined &&
      valor !== null &&
      valor !== ''
    ) {
      return valor;
    }
  }

  return null;
}


function objeto(valor) {
  return (
    valor &&
    typeof valor === 'object' &&
    !Array.isArray(valor)
  )
    ? valor
    : {};
}


function fechaMs(valor) {
  if (!valor) {
    return null;
  }

  const ms =
    Date.parse(valor);

  return Number.isFinite(ms)
    ? ms
    : null;
}


function clasificacionDesdeEstado(estado) {
  const valor =
    textoONull(estado)
      ?.toUpperCase() ??
    null;

  if (!valor) {
    return null;
  }

  if (
    [
      'INTERESADO',
      'ACEPTADO',
      'PAGO_PENDIENTE',
      'ABONO_REPORTADO',
      'EN_PROCESO'
    ].includes(valor)
  ) {
    return 'A';
  }

  if (
    [
      'COTIZADO',
      'CALIFICADO',
      'EN_SEGUIMIENTO',
      'CONTACTADO'
    ].includes(valor)
  ) {
    return 'B';
  }

  return 'C';
}


// ======================================================
// 2. CONTEXTO ACTUAL
// ======================================================

let actual = {};

try {
  actual =
    $('Preparar conversación')
      .first()
      .json ?? {};
} catch (error) {
  throw new Error(
    'Preparar contexto IA: no se pudo recuperar "Preparar conversación".'
  );
}


// ======================================================
// 3. RESOLVER TURNO
// ======================================================
//
// PRIORIDAD:
//
// 1. Entrada actual del nodo.
//
//    Esto permite recibir:
//      - Aplicar transcripciones al turno
//      - futuros enriquecedores multimedia
//
// 2. Resolver turno conversacional.
//
// Así NO perdemos las transcripciones que acabamos de
// aplicar al turno.
//
// ======================================================

const entradaNodo =
  $input.first()?.json ?? {};


let turnoOriginal = {};

try {
  turnoOriginal =
    $('Resolver turno conversacional')
      .first()
      .json ?? {};
} catch (error) {
  turnoOriginal = {};
}


const entradaTieneTurno =
  Array.isArray(
    entradaNodo.turno_mensajes
  ) &&
  entradaNodo.turno_mensajes.length > 0;


const turno =
  entradaTieneTurno
    ? {
        ...turnoOriginal,
        ...entradaNodo
      }
    : turnoOriginal;


// ======================================================
// 3.1 IDS DEL TURNO
// ======================================================

const turnoMensajeIds =
  turno.continuar_procesamiento === true &&
  Array.isArray(turno.turno_mensaje_ids)
    ? turno.turno_mensaje_ids
        .map(numeroONull)
        .filter(id => id !== null)
    : Array.isArray(turno.turno_mensajes)
      ? turno.turno_mensajes
          .map(m => numeroONull(m.id))
          .filter(id => id !== null)
      : [];


const hayTurno =
  turnoMensajeIds.length > 0 &&
  (
    textoONull(turno.turno_texto) !== null ||
    (
      Array.isArray(turno.turno_mensajes) &&
      turno.turno_mensajes.length > 0
    )
  );


// ======================================================
// 4. MEDIA DEL TURNO
// ======================================================

const PREFIJO_PENDIENTE =
  '[MEDIA_PENDIENTE]';


const LINEA_IMAGEN_NO_ANALIZADA =
  '[CONTEXTO DE IMAGEN · revision=SI · motivo=IMAGEN_NO_ANALIZADA] ' +
  'La imagen no pudo revisarse automáticamente.';


const LINEA_AUDIO_NO_TRANSCRITO =
  '[TRANSCRIPCION DE AUDIO · revision=SI · motivo=AUDIO_NO_TRANSCRITO] ' +
  'El audio no pudo transcribirse automáticamente.';


function quitarPendientes(
  contenido,
  tipo = null,
  reemplazar = true
) {
  const tipoNormalizado =
    String(tipo ?? '')
      .trim()
      .toUpperCase();

  return String(contenido ?? '')
    .split('\n')
    .flatMap(linea => {
      const limpia =
        linea.trim();

      if (
        !limpia.startsWith(
          PREFIJO_PENDIENTE
        )
      ) {
        return [linea];
      }

      if (!reemplazar) {
        return [];
      }

      if (tipoNormalizado === 'IMAGEN') {
        return [
          LINEA_IMAGEN_NO_ANALIZADA
        ];
      }

      if (tipoNormalizado === 'AUDIO') {
        return [
          LINEA_AUDIO_NO_TRANSCRITO
        ];
      }

      return [
        `[ARCHIVO NO PROCESABLE · tipo=${tipoNormalizado || 'DESCONOCIDO'}] ` +
        'El archivo no pudo procesarse automáticamente.'
      ];
    })
    .join('\n')
    .trim();
}


function atributosCabecera(linea) {
  const cabecera =
    linea.match(
      /^\[([^\]]*)\]/
    );

  if (!cabecera) {
    return {};
  }

  return Object.fromEntries(
    cabecera[1]
      .split('·')
      .map(parte =>
        parte
          .trim()
          .split('=')
      )
      .filter(par =>
        par.length === 2
      )
      .map(([clave, valor]) => [
        clave.trim(),
        valor.trim()
      ])
  );
}


// ======================================================
// 4.1 RECUPERAR ANÁLISIS DE IMÁGENES
// ======================================================
//
// Tomamos análisis válidos de cualquier proveedor.
//
// La prioridad natural es:
//
// Groq
//   ↓ fallback
// DeepSeek
//   ↓ fallback
// OpenAI
//
// Como cada mensaje_id debería terminar válido en un solo
// proveedor, almacenamos solo análisis_valido=true.
//
// ======================================================

function obtenerItemsNodo(nombre) {
  try {
    return $(nombre)
      .all()
      .map(item => item.json ?? {});
  } catch (_) {
    return [];
  }
}


const analisisImagenes = [
  ...obtenerItemsNodo(
    'Validar análisis imagen Groq'
  ),
  ...obtenerItemsNodo(
    'Validar análisis imagen DeepSeek'
  ),
  ...obtenerItemsNodo(
    'Analizar imagen OpenAI'
  ),
  ...obtenerItemsNodo(
    'Validar análisis imagen OpenAI'
  )
];


const contenidoAnalizado =
  new Map();

const medidasImagenPorMensaje =
  new Map();


for (const analisis of analisisImagenes) {
  const mensajeId =
    numeroONull(
      analisis.mensaje_id
    );

  const contenido =
    textoONull(
      analisis.contenido_actualizado
    );

  if (
    mensajeId === null ||
    contenido === null
  ) {
    continue;
  }

  if (
    analisis.analisis_valido === false
  ) {
    continue;
  }

  // Primero que llega válido gana.
  // Normalmente será Groq.
  if (
    !contenidoAnalizado.has(
      mensajeId
    )
  ) {
    contenidoAnalizado.set(
      mensajeId,
      contenido
    );
  }

  const analisisNormalizado =
    objeto(
      analisis.analisis
    );

  const medidasDetectadas =
    booleano(
      primeroDefinido(
        analisis.medidas_detectadas,
        analisisNormalizado.medidas_detectadas
      ),
      false
    );

  const anchoCm =
    numeroONull(
      primeroDefinido(
        analisis.ancho_cm,
        analisisNormalizado.ancho_cm
      )
    );

  const altoCm =
    numeroONull(
      primeroDefinido(
        analisis.alto_cm,
        analisisNormalizado.alto_cm
      )
    );

  const diametroCm =
    numeroONull(
      primeroDefinido(
        analisis.diametro_cm,
        analisisNormalizado.diametro_cm
      )
    );

  const medidasVisibles =
    textoONull(
      primeroDefinido(
        analisis.medidas_visibles,
        analisisNormalizado.medidas_visibles
      )
    );

  if (
    medidasDetectadas ||
    anchoCm !== null ||
    altoCm !== null ||
    diametroCm !== null ||
    medidasVisibles !== null
  ) {
    medidasImagenPorMensaje.set(
      mensajeId,
      {
        mensaje_id:
          mensajeId,

        proveedor:
          textoONull(
            analisis.proveedor_analisis
          ),

        contenido_detectado:
          textoONull(
            analisis.contenido_detectado ??
            analisisNormalizado.contenido_detectado
          ),

        confianza:
          textoONull(
            analisis.confianza ??
            analisisNormalizado.confianza
          ),

        ancho_cm:
          anchoCm,

        alto_cm:
          altoCm,

        diametro_cm:
          diametroCm,

        texto_original:
          medidasVisibles,

        fuente:
          'IMAGEN'
      }
    );
  }
}


// ======================================================
// 4.2 MENSAJES DEL TURNO
// ======================================================

const mensajesTurnoOrigen =
  hayTurno &&
  Array.isArray(
    turno.turno_mensajes
  )
    ? turno.turno_mensajes
    : [
        {
          id: null,
          tipo:
            actual.tipo,

          contenido:
            hayTurno
              ? turno.turno_texto
              : actual.mensaje
        }
      ];


const mensajesTurno =
  mensajesTurnoOrigen.map(m => {

    const id =
      numeroONull(
        m.id
      );

    const tipo =
      (
        textoONull(
          m.tipo
        ) ??
        'TEXTO'
      ).toUpperCase();


    let contenido =
      contenidoAnalizado.get(id) ??
      m.contenido ??
      '';


    // --------------------------------------------------
    // TEXTO
    // --------------------------------------------------

    if (tipo === 'TEXTO') {
      contenido =
        String(contenido)
          .trim();
    }

    // --------------------------------------------------
    // MEDIA
    // --------------------------------------------------

    else {
      contenido =
        quitarPendientes(
          contenido,
          tipo,
          true
        );
    }


    return {
      ...m,

      id,

      tipo,

      contenido
    };
  });


// ======================================================
// 4.3 TEXTO FINAL DEL TURNO
// ======================================================

const textoTurno =
  mensajesTurno
    .map(m =>
      textoONull(
        m.contenido
      )
    )
    .filter(Boolean)
    .join('\n');


const medidasImagenTurno =
  mensajesTurno
    .map(m =>
      medidasImagenPorMensaje.get(
        numeroONull(m.id)
      ) ?? null
    )
    .filter(Boolean);


// ======================================================
// 4.4 RESUMEN DE MEDIA
// ======================================================

let imagenesAnalizadas = 0;

let audiosTranscritos = 0;

let comprobanteDetectado = false;

let revisionImagen = false;

let revisionAudio = false;

let archivoNoProcesable = false;


for (const m of mensajesTurno) {

  if (m.tipo === 'TEXTO') {
    continue;
  }


  for (
    const linea of String(
      m.contenido ?? ''
    )
      .split('\n')
      .map(l => l.trim())
  ) {

    // --------------------------------------------------
    // ARCHIVO NO PROCESABLE
    // --------------------------------------------------

    if (
      linea.startsWith(
        '[ARCHIVO NO PROCESABLE'
      )
    ) {
      archivoNoProcesable =
        true;
    }


    // --------------------------------------------------
    // IMAGEN
    // --------------------------------------------------

    if (
      m.tipo === 'IMAGEN' &&
      linea.startsWith(
        '[CONTEXTO DE IMAGEN'
      )
    ) {

      const atributos =
        atributosCabecera(
          linea
        );

      if (atributos.contenido) {
        imagenesAnalizadas++;
      }

      if (
        atributos.revision === 'SI'
      ) {
        revisionImagen =
          true;
      }

      if (
        atributos.contenido ===
        'COMPROBANTE_PAGO'
      ) {
        comprobanteDetectado =
          true;
      }
    }


    // --------------------------------------------------
    // AUDIO
    // --------------------------------------------------

    if (
      m.tipo === 'AUDIO' &&
      linea.startsWith(
        '[TRANSCRIPCION DE AUDIO'
      )
    ) {

      const atributos =
        atributosCabecera(
          linea
        );

      if (
        atributos.revision === 'SI'
      ) {
        revisionAudio =
          true;
      } else {
        audiosTranscritos++;
      }
    }
  }
}


// Si "Aplicar transcripciones al turno" ya resolvió
// explícitamente el estado, lo respetamos.

if (
  turno.requiere_revision_audio === true
) {
  revisionAudio =
    true;
}


const mediaTurno = {

  cantidad_media:
    mensajesTurno.filter(
      m =>
        m.tipo !== 'TEXTO'
    ).length,

  imagenes_analizadas:
    imagenesAnalizadas,

  audios_transcritos:
    audiosTranscritos,

  comprobante_detectado:
    comprobanteDetectado,

  requiere_revision_imagen:
    revisionImagen,

  requiere_revision_audio:
    revisionAudio,

  archivo_no_procesable:
    archivoNoProcesable,

  medidas_detectadas_imagen:
    medidasImagenTurno.length > 0,

  cantidad_imagenes_con_medidas:
    medidasImagenTurno.length,

  medidas_imagen:
    medidasImagenTurno,

  requiere_revision_humana:
    (
      revisionImagen ||
      revisionAudio ||
      archivoNoProcesable
    ),

  motivo_derivacion:
    archivoNoProcesable
      ? 'ARCHIVO_NO_PROCESABLE'

      : revisionImagen
        ? 'IMAGEN_REQUIERE_REVISION'

        : revisionAudio
          ? 'AUDIO_REQUIERE_REVISION'

          : null
};


// ======================================================
// 5. RECUPERAR HISTORIAL COMPLETO
// ======================================================

let itemsHistorial = [];

try {
  itemsHistorial =
    $('Recuperar historial conversación')
      .all();
} catch (error) {
  itemsHistorial =
    [];
}


const idsTurno =
  new Set(
    turnoMensajeIds
  );


const externosTurno =
  new Set(
    itemsHistorial
      .map(item =>
        item.json ?? {}
      )
      .filter(row =>
        idsTurno.has(
          numeroONull(
            row.id
          )
        )
      )
      .map(row =>
        textoONull(
          row.mensaje_externo_id
        )
      )
      .filter(Boolean)
  );


const externosVistos =
  new Set();


// ======================================================
// 5.1 REFERENCIA TEMPORAL DEL TURNO
// ======================================================
//
// Preferimos la fecha del último mensaje del turno.
// Si no existe, usamos recibido_at.
// Último fallback: ahora.
//
// ======================================================

const fechasTurno =
  mensajesTurno
    .map(m =>
      fechaMs(
        m.enviado_at
      )
    )
    .filter(ms =>
      ms !== null
    );


const referenciaTurnoMs =
  fechasTurno.length > 0
    ? Math.max(
        ...fechasTurno
      )
    : (
        fechaMs(
          actual.recibido_at
        ) ??
        Date.now()
      );


const limiteHistorialMs =
  referenciaTurnoMs -
  (
    VENTANA_HISTORIAL_HORAS *
    60 *
    60 *
    1000
  );


// ======================================================
// 5.2 LIMPIAR Y FILTRAR HISTORIAL
// ======================================================

let historialCandidato =
  itemsHistorial
    .map(item =>
      item.json ?? null
    )
    .filter(row => {

      if (!row) {
        return false;
      }


      const id =
        numeroONull(
          row.id
        );


      const externo =
        textoONull(
          row.mensaje_externo_id
        );


      // -----------------------------------------------
      // NO incluir turno actual
      // -----------------------------------------------

      if (
        idsTurno.has(id)
      ) {
        return false;
      }


      // -----------------------------------------------
      // NO incluir duplicados externos
      // -----------------------------------------------

      if (
        externo !== null
      ) {

        if (
          externosTurno.has(
            externo
          ) ||
          externosVistos.has(
            externo
          )
        ) {
          return false;
        }

        externosVistos.add(
          externo
        );
      }


      // -----------------------------------------------
      // Debe tener contenido
      // -----------------------------------------------

      const tieneContenido =
        row.contenido !== undefined &&
        row.contenido !== null &&
        String(
          row.contenido
        ).trim() !== '';

      if (!tieneContenido) {
        return false;
      }


      // -----------------------------------------------
      // VENTANA TEMPORAL
      // -----------------------------------------------

      const fecha =
        fechaMs(
          row.enviado_at
        );

      if (
        fecha !== null &&
        fecha < limiteHistorialMs
      ) {
        return false;
      }


      return true;
    })
    .sort((a, b) => {

      const fechaA =
        fechaMs(
          a.enviado_at
        ) ?? 0;

      const fechaB =
        fechaMs(
          b.enviado_at
        ) ?? 0;

      if (fechaA !== fechaB) {
        return fechaA - fechaB;
      }

      return (
        numeroONull(a.id) ?? 0
      ) -
      (
        numeroONull(b.id) ?? 0
      );
    });


// ======================================================
// 5.3 LÍMITE DE MENSAJES
// ======================================================
//
// Conservamos los MÁS RECIENTES.
//
// ======================================================

if (
  historialCandidato.length >
  MAX_MENSAJES_HISTORIAL
) {
  historialCandidato =
    historialCandidato.slice(
      -MAX_MENSAJES_HISTORIAL
    );
}


// ======================================================
// 5.4 HISTORIAL FINAL PARA IA
// ======================================================

const historial =
  historialCandidato
    .map(row => {

      const tipo =
        (
          textoONull(
            row.tipo
          ) ??
          'TEXTO'
        ).toUpperCase();


      let contenido =
        row.contenido ?? '';


      if (
        tipo !== 'TEXTO'
      ) {
        contenido =
          quitarPendientes(
            contenido,
            tipo,
            false
          );
      }


      contenido =
        String(
          contenido ?? ''
        )
          .trim()
          .slice(
            0,
            LARGO_MAXIMO_CONTENIDO_HISTORIAL
          );


      return {

        direccion:
          textoONull(
            row.direccion
          ),

        contenido,

        tipo,

        enviado_at:
          row.enviado_at ??
          null
      };
    })
    .filter(row =>
      textoONull(
        row.contenido
      ) !== null
    );


// ======================================================
// 6. DETECTAR SESIÓN NUEVA POR INACTIVIDAD
// ======================================================
//
// Si NO hay historial dentro de las últimas 24 horas,
// consideramos que este es un nuevo episodio
// conversacional.
//
// NO borramos la memoria comercial.
//
// ======================================================

const sesionConversacionalNueva =
  historial.length === 0;


// ======================================================
// 7. MEMORIA DE RESPUESTAS SALIENTES
// ======================================================

const mensajesSalientesRecientes =
  historial
    .filter(row =>
      String(
        row.direccion ?? ''
      ).toUpperCase() ===
      'SALIENTE'
    )
    .map(row =>
      String(
        row.contenido ?? ''
      ).trim()
    )
    .filter(Boolean)
    .slice(
      -MAX_SALIENTES_RECIENTES
    );


const ultimoMensajeSaliente =
  mensajesSalientesRecientes.length > 0
    ? mensajesSalientesRecientes[
        mensajesSalientesRecientes.length - 1
      ]
    : null;


// ======================================================
// 8. IDENTIDAD DEL ACTOR
// ======================================================

const clienteId =
  numeroONull(
    actual.cliente_id
  );


const contactoId =
  numeroONull(
    actual.contacto_id
  );


const prospectoId =
  numeroONull(
    actual.prospecto_id
  );


let tipoActor =
  textoONull(
    actual.tipo_actor
  );


if (!tipoActor) {

  if (
    clienteId !== null
  ) {
    tipoActor =
      'CLIENTE';
  }

  else if (
    prospectoId !== null
  ) {
    tipoActor =
      'PROSPECTO';
  }

  else if (
    contactoId !== null
  ) {
    tipoActor =
      'CONTACTO';
  }

  else {
    tipoActor =
      'DESCONOCIDO';
  }
}


tipoActor =
  tipoActor.toUpperCase();


// ======================================================
// 9. CONTEXTO COMERCIAL PREVIO
// ======================================================
//
// La memoria comercial estructurada NO se elimina aunque
// la sesión conversacional sea nueva.
//
// Así evitamos perder:
//
// - cotizaciones reales
// - estado del prospecto
// - ciudad conocida
// - producto de interés
// - handoff
//
// Pero el cerebro ya NO verá 100 mensajes antiguos.
//
// ======================================================

const previo =
  actual.contexto_comercial &&
  typeof actual.contexto_comercial ===
    'object' &&
  !Array.isArray(
    actual.contexto_comercial
  )
    ? actual.contexto_comercial
    : {};


const cotizacionPrevia =
  objeto(
    previo.cotizacion
  );


const prospectoPrevio =
  objeto(
    previo.prospecto
  );


// ======================================================
// 9.1 COTIZACIÓN
// ======================================================

const cotizacionId =
  numeroONull(
    primeroDefinido(
      actual.cotizacion_id,
      actual.ultima_cotizacion_id,
      cotizacionPrevia.id,
      cotizacionPrevia.cotizacion_id
    )
  );


const cotizacionEstado =
  textoONull(
    primeroDefinido(
      actual.cotizacion_estado,
      actual.ultima_cotizacion_estado,
      cotizacionPrevia.estado
    )
  );


const cotizacionCantidad =
  numeroONull(
    primeroDefinido(
      actual.cotizacion_cantidad,
      actual.ultima_cotizacion_cantidad,
      cotizacionPrevia.cantidad,
      cotizacionPrevia.cantidad_cotizable,
      cotizacionPrevia.cantidad_solicitada
    )
  );


const cotizacionAncho =
  numeroONull(
    primeroDefinido(
      actual.cotizacion_ancho_cm,
      actual.ultima_cotizacion_ancho_cm,
      cotizacionPrevia.ancho_cm
    )
  );


const cotizacionAlto =
  numeroONull(
    primeroDefinido(
      actual.cotizacion_alto_cm,
      actual.ultima_cotizacion_alto_cm,
      cotizacionPrevia.alto_cm
    )
  );


const cotizacionForma =
  textoONull(
    primeroDefinido(
      actual.cotizacion_forma,
      actual.ultima_cotizacion_forma,
      cotizacionPrevia.forma
    )
  );


const cotizacionPrecio =
  numeroONull(
    primeroDefinido(
      actual.cotizacion_precio_total,
      actual.cotizacion_total,
      actual.ultima_cotizacion_total,
      cotizacionPrevia.precio_total,
      cotizacionPrevia.total
    )
  );


// ======================================================
// 9.2 PROSPECTO
// ======================================================

const prospectoEstado =
  textoONull(
    primeroDefinido(
      actual.prospecto_estado,
      prospectoPrevio.estado
    )
  );


const prospectoProductoInteres =
  textoONull(
    primeroDefinido(
      actual.prospecto_producto_interes,
      prospectoPrevio.producto_interes
    )
  );


const prospectoUltimaIntencion =
  textoONull(
    primeroDefinido(
      actual.prospecto_ultima_intencion,
      prospectoPrevio.ultima_intencion
    )
  );


const prospectoUltimaAccion =
  textoONull(
    primeroDefinido(
      actual.prospecto_ultima_accion,
      prospectoPrevio.ultima_accion
    )
  );


const prospectoClasificacion =
  textoONull(
    primeroDefinido(
      actual.prospecto_clasificacion,
      prospectoPrevio.clasificacion
    )
  )?.toUpperCase() ??
  clasificacionDesdeEstado(
    prospectoEstado
  );


const prospectoCiudad =
  textoONull(
    primeroDefinido(
      actual.prospecto_ciudad,
      previo.ubicacion?.ciudad
    )
  );


const prospectoProvincia =
  textoONull(
    primeroDefinido(
      actual.prospecto_provincia,
      previo.ubicacion?.provincia
    )
  );


const prospectoDisenoEstado =
  textoONull(
    primeroDefinido(
      actual.prospecto_diseno_estado,
      actual.diseno_estado,
      previo.diseno?.estado
    )
  );


// ======================================================
// 10. OBJETO contexto_comercial
// ======================================================

const contextoComercial = {

  ...previo,


  // --------------------------------------------------
  // METADATO DE SESIÓN
  // --------------------------------------------------

  sesion: {
    ...objeto(
      previo.sesion
    ),

    nueva_por_inactividad:
      sesionConversacionalNueva,

    ventana_historial_horas:
      VENTANA_HISTORIAL_HORAS,

    actualizado_at:
      new Date().toISOString()
  },


  // --------------------------------------------------
  // PROSPECTO
  // --------------------------------------------------

  prospecto: {

    ...prospectoPrevio,

    id:
      prospectoId,

    estado:
      prospectoEstado,

    clasificacion:
      prospectoClasificacion,

    producto_interes:
      prospectoProductoInteres,

    requiere_humano:
      booleano(
        actual.prospecto_requiere_humano,
        false
      ),

    ultima_intencion:
      prospectoUltimaIntencion,

    ultima_accion:
      prospectoUltimaAccion
  },


  // --------------------------------------------------
  // UBICACIÓN
  // --------------------------------------------------

  ubicacion: {

    ...objeto(
      previo.ubicacion
    ),

    ciudad:
      prospectoCiudad,

    provincia:
      prospectoProvincia
  },


  // --------------------------------------------------
  // DISEÑO
  // --------------------------------------------------

  diseno: {

    ...objeto(
      previo.diseno
    ),

    estado:
      prospectoDisenoEstado
  },


  // --------------------------------------------------
  // COTIZACIÓN
  // --------------------------------------------------

  cotizacion: {

    ...cotizacionPrevia,

    existe:
      (
        cotizacionId !== null ||
        Boolean(
          cotizacionEstado
        )
      ),

    id:
      cotizacionId,

    estado:
      cotizacionEstado,

    cantidad:
      cotizacionCantidad,

    ancho_cm:
      cotizacionAncho,

    alto_cm:
      cotizacionAlto,

    forma:
      cotizacionForma,

    precio_total:
      cotizacionPrecio,

    moneda:
      textoONull(
        primeroDefinido(
          actual.cotizacion_moneda,
          cotizacionPrevia.moneda,
          'USD'
        )
      )
  }
};


// ======================================================
// 11. SALIDA
// ======================================================

return [
  {
    json: {

      // ==================================================
      // CONVERSACIÓN
      // ==================================================

      conversacion_id:
        numeroONull(
          actual.conversacion_id ??
          turno.conversacion_id
        ),

      conversacion_estado:
        textoONull(
          actual.conversacion_estado
        ),

      conversacion_nueva:
        booleano(
          actual.conversacion_nueva,
          false
        ),

      sesion_conversacional_nueva:
        sesionConversacionalNueva,

      ventana_historial_horas:
        VENTANA_HISTORIAL_HORAS,


      conversacion_cliente_id:
        numeroONull(
          actual.conversacion_cliente_id
        ),

      conversacion_contacto_id:
        numeroONull(
          actual.conversacion_contacto_id
        ),

      conversacion_prospecto_id:
        numeroONull(
          actual.conversacion_prospecto_id
        ),


      // ==================================================
      // CLIENTE / CONTACTO
      // ==================================================

      cliente_id:
        clienteId,

      contacto_id:
        contactoId,

      contacto_nombre:
        textoONull(
          actual.contacto_nombre
        ),

      es_cliente_registrado:
        booleano(
          actual.es_cliente_registrado,
          false
        ),


      // ==================================================
      // PROSPECTO
      // ==================================================

      prospecto_existe:
        (
          prospectoId !== null ||
          booleano(
            actual.prospecto_existe,
            false
          )
        ),

      prospecto_id:
        prospectoId,

      prospecto_estado:
        prospectoEstado,

      prospecto_clasificacion:
        prospectoClasificacion,

      prospecto_nombre:
        textoONull(
          actual.prospecto_nombre
        ),

      prospecto_producto_interes:
        prospectoProductoInteres,

      prospecto_ciudad:
        prospectoCiudad,

      prospecto_provincia:
        prospectoProvincia,

      prospecto_diseno_estado:
        prospectoDisenoEstado,

      prospecto_ultima_intencion:
        prospectoUltimaIntencion,

      prospecto_ultima_accion:
        prospectoUltimaAccion,

      prospecto_requiere_humano:
        booleano(
          actual.prospecto_requiere_humano,
          false
        ),


      // ==================================================
      // ACTOR
      // ==================================================

      tipo_actor:
        tipoActor,


      // ==================================================
      // MENSAJE ACTUAL
      // ==================================================

      telefono:
        textoONull(
          actual.telefono ??
          turno.telefono
        ),

      nombre_whatsapp:
        textoONull(
          actual.nombre_whatsapp ??
          turno.nombre_whatsapp
        ),

      mensaje_actual:
        textoTurno,

      mensaje_disparador:
        (
          textoONull(
            actual.tipo
          ) ??
          'TEXTO'
        ).toUpperCase() ===
        'TEXTO'
          ? actual.mensaje ?? ''
          : quitarPendientes(
              actual.mensaje,
              actual.tipo,
              false
            ),

      turno_mensaje_ids:
        turnoMensajeIds,

      turno_desde_id:
        hayTurno
          ? numeroONull(
              turno.turno_desde_id
            )
          : null,

      turno_hasta_id:
        hayTurno
          ? numeroONull(
              turno.turno_hasta_id
            )
          : null,

      cantidad_mensajes_turno:
        hayTurno
          ? mensajesTurno.length
          : 1,

      turno_mensajes:
        mensajesTurno,

      tipo_mensaje:
        textoONull(
          actual.tipo
        ) ??
        (
          mensajesTurno.length === 1
            ? mensajesTurno[0].tipo
            : 'MULTIPLE'
        ),

      canal:
        textoONull(
          actual.canal
        ) ??
        'WHATSAPP',

      mensaje_externo_id:
        textoONull(
          actual.mensaje_externo_id
        ),

      recibido_at:
        actual.recibido_at ??
        null,


      // ==================================================
      // MEDIA DEL TURNO
      // ==================================================

      media_turno:
        mediaTurno,

      medidas_imagen_turno:
        medidasImagenTurno,

      medidas_detectadas_en_imagen:
        medidasImagenTurno.length > 0,


      // ==================================================
      // AUDIO
      // ==================================================

      transcripciones_audio:
        Array.isArray(
          turno.transcripciones_audio
        )
          ? turno.transcripciones_audio
          : [],

      audio_procesado:
        turno.audio_procesado === true,

      audio_listo_para_cerebro:
        turno.audio_listo_para_cerebro !== false,

      transcripciones_aplicadas:
        turno.transcripciones_aplicadas === true,


      // ==================================================
      // CONTEXTO COMERCIAL
      // ==================================================

      contexto_comercial:
        contextoComercial,


      // ==================================================
      // HISTORIAL RECIENTE
      // ==================================================

      historial,

      cantidad_mensajes_historial:
        historial.length,

      limite_mensajes_historial:
        MAX_MENSAJES_HISTORIAL,


      // ==================================================
      // CONTROL ANTI-REPETICIÓN
      // ==================================================

      ultimo_mensaje_saliente:
        ultimoMensajeSaliente,

      mensajes_salientes_recientes:
        mensajesSalientesRecientes
    }
  }
];
