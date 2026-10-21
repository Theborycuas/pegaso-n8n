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
// VERSION: 4.16
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
// - Excluir del historial los marcadores internos (respuesta omitida
//   y bot reactivado por administrador).
// - Exponer ultimo_saliente (origen BOT / AUTOMATICO / HUMANO,
//   acción equivalente, si llegó después del inicio del turno)
//   y medidas_ya_solicitadas para el anti-duplicado.
// - V4.5: si el cliente escribe que adjunta abono/comprobante/pago
//   (o el análisis trae señales de transferencia) y hay imagen en el
//   turno, fuerza comprobante_detectado para handoff de pago — no
//   "revisamos la imagen".
// - V4.6: tarjetas de presentación → INFORMAR_TARJETAS (catálogo de
//   videos). Ya no van a PRODUCTO_NO_P4/humano. Flyers/afiches siguen
//   derivando. La detección de tarjetas aplica también con multimedia.
// - V4.7: el primer contacto de tarjetas no vierte material/entregas/
//   caras. Solo INFORMAR_TARJETAS si el catálogo aún no se envió.
//   Los siguientes turnos van al cerebro (con producto_linea).
// - V4.8: flyers/volantes → INFORMAR_FLYERS (imagen + precios).
//   Ya no van a PRODUCTO_NO_P4. Afiches siguen derivando.
// - V4.9: typos de producto (vonates→volantes) y mínimo de
//   catálogo sin mezclar estampitas/etiquetas.
// - V4.10: lista de flyers cierra con *Precios no incluyen IVA*.
// - V4.11: el cierre de tarjetas usa el mismo aviso de IVA.
// - V4.12: si pide total con datos de catálogo (acabado,
//   A5/A6, 1 o 2 lados) no se salta a INFORMAR_*: el
//   resolver suma. Tarejtes y similares cuentan como tarjetas.
// - V4.13: FAQ P4: circular y cuadrada cuestan lo mismo
//   hasta 5 cm (troquel).
// - V4.14: afiches, trípticos y hojas membretadas salen
//   de PRODUCTO_NO_P4. Primer contacto INFORMAR_* con
//   imagen + precios (producción rápida, 2-3 días hábiles).
//   Dípticos y brochures siguen a humano.
// - V4.15: flyers/tarjetas/afiches se detectan también
//   si el turno nombra etiquetas (mix). No se salta a
//   INFORMAR_* ni a PRODUCTO_NO_P4: el resolver cotiza
//   cada línea. Anti-repetición de ubicación / Permítame.
// - V4.16: PRODUCTO_NO_P4 usa motivo PRODUCTO_NO_P4 (no
//   el texto de 6.000 etiquetas). Más trabajos que no
//   manejamos (banners, lonas, cajas, textil, etc.).
// - Reglas pre-IA solo para texto sin multimedia:
//   SALUDO_SIMPLE (respuesta corta fija), PRODUCTO_NO_P4
//   (DERIVAR_HUMANO + COTIZACION_ESPECIAL) y
//   DIVISION_MINIMO_DISENOS (INFORMAR_MINIMO: no se puede
//   repartir la cantidad con menos de 1000 por diseño; nunca
//   deriva). Cuando aplican se
//   emite decision con el contrato del cerebro y
//   requiere_cerebro_comercial = false para saltar la IA.
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

const PREFIJO_AUTOMATICO_WHATSAPP_BUSINESS = '[AUTOMATICO WHATSAPP BUSINESS';

const PREFIJO_RESPUESTA_OMITIDA = '[RESPUESTA AUTOMÁTICA OMITIDA';

const PREFIJO_BOT_REACTIVADO = '[BOT REACTIVADO POR ADMINISTRADOR';

// Marcadores internos: se guardan como SALIENTE, nunca se envían
// y no forman parte de la conversación con el cliente.
function esMarcadorInterno(contenido) {
  const t = String(contenido ?? '').trim();
  return t.startsWith(PREFIJO_RESPUESTA_OMITIDA) || t.startsWith(PREFIJO_BOT_REACTIVADO);
}

const OFFSET_HORA_ECUADOR = -5;


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


function normalizarTexto(valor) {
  return String(valor ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function distanciaLevenshtein(a, b) {
  if (a === b) {
    return 0;
  }

  if (a.length === 0) {
    return b.length;
  }

  if (b.length === 0) {
    return a.length;
  }

  const fila =
    Array.from(
      { length: b.length + 1 },
      (_, i) => i
    );

  for (let i = 1; i <= a.length; i++) {
    let previo = i - 1;
    fila[0] = i;

    for (let j = 1; j <= b.length; j++) {
      const tmp = fila[j];
      const costo =
        a[i - 1] === b[j - 1] ? 0 : 1;

      fila[j] = Math.min(
        fila[j] + 1,
        fila[j - 1] + 1,
        previo + costo
      );

      previo = tmp;
    }
  }

  return fila[b.length];
}

function mencionaLemas(textoPlano, lemas) {
  for (const lema of lemas) {
    if (new RegExp(`\\b${lema}\\b`).test(textoPlano)) {
      return true;
    }
  }

  const tokens =
    textoPlano.split(' ').filter(t => t.length >= 5);

  for (const token of tokens) {
    for (const lema of lemas) {
      if (Math.abs(token.length - lema.length) > 1) {
        continue;
      }

      if (distanciaLevenshtein(token, lema) <= 1) {
        return true;
      }
    }
  }

  return false;
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


// ------------------------------------------------------
// COMPROBANTE: señal del análisis + texto del cliente
// ------------------------------------------------------
//
// Una captura de transferencia a veces llega como
// CAPTURA_DE_PANTALLA o con revision=SI. Si el cliente
// dice "adjunto el abono" o el validador marcó
// comprobante, priorizamos la ruta de pago.
//
// ------------------------------------------------------

const TEXTO_SUGIERE_COMPROBANTE =
  /\b(abono|comprobante|voucher|transfer[ií](encia|í|i)|ya\s+pag(u[eé]|o|amos)|adjunt[oa]\s+(el\s+)?(abono|comprobante|pago|transfer)|pagu[eé]|deposit[eéo]|dep[oó]sito|pago\s+(realizado|enviado|hecho))\b/i;

const VISUAL_SUGIERE_COMPROBANTE =
  /transferencia\s+exitosa|proceso\s+exitoso|comprobante\s+nro|n\.?\s*de\s+comprobante|banco\s+pichincha|produbanco|banco\s+guayaquil|deuna|monto\s+enviado|valor\s+transferido|pago\s+inmediato|jard[ií]n\s+azuayo/i;

for (const analisis of analisisImagenes) {
  if (analisis.analisis_valido === false) {
    continue;
  }

  if (analisis.comprobante_detectado === true) {
    comprobanteDetectado = true;
  }

  if (
    String(analisis.contenido_detectado ?? '')
      .toUpperCase() === 'COMPROBANTE_PAGO'
  ) {
    comprobanteDetectado = true;
  }

  const blobVisual = [
    analisis.contenido_detectado,
    analisis.analisis?.texto_visible_relevante,
    analisis.analisis?.resumen_para_cerebro,
    analisis.contenido_actualizado
  ].join(' ');

  if (VISUAL_SUGIERE_COMPROBANTE.test(blobVisual)) {
    comprobanteDetectado = true;
  }
}

const hayImagenEnTurno =
  mensajesTurno.some(m => m.tipo === 'IMAGEN') ||
  imagenesAnalizadas > 0;

const textoClienteTurno = mensajesTurno
  .filter(m => m.tipo === 'TEXTO' || m.tipo === 'IMAGEN')
  .map(m => {
    if (m.tipo === 'TEXTO') {
      return String(m.contenido ?? '');
    }

    // Caption real del cliente, sin el bloque [CONTEXTO DE IMAGEN...]
    return String(m.contenido ?? '')
      .split('\n')
      .filter(l => !/^\[CONTEXTO DE IMAGEN/i.test(l.trim()))
      .join(' ');
  })
  .join(' ');

if (
  hayImagenEnTurno &&
  TEXTO_SUGIERE_COMPROBANTE.test(textoClienteTurno)
) {
  comprobanteDetectado = true;
}

// Comprobante: el humano verifica el pago; no usar el
// mensaje genérico de "revisamos la imagen".
if (comprobanteDetectado) {
  revisionImagen = false;
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
      (
        revisionImagen &&
        !comprobanteDetectado
      ) ||
      revisionAudio ||
      archivoNoProcesable
    ),

  motivo_derivacion:
    archivoNoProcesable
      ? 'ARCHIVO_NO_PROCESABLE'

      : comprobanteDetectado
        ? 'ENVIA_COMPROBANTE'

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

      if (esMarcadorInterno(row.contenido)) {
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
// 7.1 ÚLTIMO SALIENTE Y ACCIÓN EQUIVALENTE
// ======================================================
//
// Origen de cada SALIENTE en pegaso.mensajes:
// - BOT: sin mensaje_externo_id (lo guarda este flujo).
// - AUTOMATICO: eco con prefijo [AUTOMATICO WHATSAPP BUSINESS.
// - HUMANO: cualquier otro eco de WhatsApp Business.
//
// Se recorre el historial completo y no solo la ventana: el
// eco automático de un anuncio suele llegar DESPUÉS del primer
// mensaje del turno.
//
// ======================================================

function origenSaliente(row) {
  if (textoONull(row.mensaje_externo_id) === null) {
    return 'BOT';
  }

  return String(row.contenido ?? '')
    .trim()
    .startsWith(PREFIJO_AUTOMATICO_WHATSAPP_BUSINESS)
    ? 'AUTOMATICO'
    : 'HUMANO';
}


function accionEquivalenteSaliente(contenido) {
  const texto =
    String(contenido ?? '').trim();

  const prefijo =
    texto.match(
      /^\[AUTOMATICO WHATSAPP BUSINESS[^\]]*accion=([A-Z_]+)/
    );

  if (prefijo) {
    return prefijo[1] === 'NINGUNA'
      ? null
      : prefijo[1];
  }

  const plano =
    normalizarTexto(texto);

  if (
    /\ben que medidas\b|\bque medidas (requiere|necesita|desea|tendrian|tendria)\b|\bancho y alto\b|\bsolo nos falta el (ancho|alto)\b/.test(plano)
  ) {
    return 'PEDIR_MEDIDAS';
  }

  if (
    /^(hola|buen[oa]s?( dias| tardes| noches)?)\b.*\ben que (podemos|le podemos|puedo|le puedo) ayudarle\b/.test(plano)
  ) {
    return 'SALUDO';
  }

  if (
    /\bpermitame un momento por favor\b/.test(plano)
  ) {
    return 'DERIVAR_HUMANO';
  }

  if (
    /\bciudad de quito\b|\bestamos ubicados\b|\bdesde que ciudad nos escribe\b|\blocal fisico\b|\benvios para todo el pais\b/.test(
      plano
    )
  ) {
    return 'INFORMAR_UBICACION';
  }

  if (
    /\bpolipropileno\b|\balta adherencia\b|\brefrigeracion y congelacion\b|\bmaterial termo\b/.test(
      plano
    )
  ) {
    return 'INFORMAR_MATERIAL';
  }

  return null;
}


const turnoDesdeId =
  hayTurno
    ? numeroONull(
        turno.turno_desde_id
      )
    : null;


const salientesConversacion =
  itemsHistorial
    .map(item => item.json ?? {})
    .filter(row =>
      String(row.direccion ?? '').toUpperCase() === 'SALIENTE' &&
      textoONull(row.contenido) !== null &&
      !esMarcadorInterno(row.contenido) &&
      numeroONull(row.id) !== null
    )
    .sort((a, b) => numeroONull(a.id) - numeroONull(b.id))
    .map(row => ({
      id:
        numeroONull(row.id),

      origen:
        origenSaliente(row),

      accion_equivalente:
        accionEquivalenteSaliente(row.contenido),

      enviado_at:
        row.enviado_at ?? null,

      contenido:
        String(row.contenido).trim().slice(0, LARGO_MAXIMO_CONTENIDO_HISTORIAL)
    }));


const ultimoSalienteFila =
  salientesConversacion.length > 0
    ? salientesConversacion[salientesConversacion.length - 1]
    : null;


const ultimoSaliente =
  ultimoSalienteFila
    ? {
        ...ultimoSalienteFila,

        posterior_al_turno:
          turnoDesdeId !== null &&
          ultimoSalienteFila.id > turnoDesdeId
      }
    : null;


// Las medidas ya se pidieron si el último SALIENTE con acción
// reconocible (ignorando saludos) dentro de la ventana fue
// PEDIR_MEDIDAS, sin importar si lo envió el bot, la
// automatización de WhatsApp Business o un humano.

let medidasYaSolicitadas = false;

for (
  let i = salientesConversacion.length - 1;
  i >= 0;
  i--
) {
  const saliente =
    salientesConversacion[i];

  const fecha =
    fechaMs(saliente.enviado_at);

  if (
    fecha !== null &&
    fecha < limiteHistorialMs
  ) {
    break;
  }

  if (saliente.accion_equivalente === 'SALUDO') {
    continue;
  }

  medidasYaSolicitadas =
    saliente.accion_equivalente === 'PEDIR_MEDIDAS';

  break;
}


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
// 10.1 REGLAS PRE-IA
// ======================================================
//
// Solo texto sin multimedia. Ante cualquier duda decide el
// cerebro: una regla solo aplica si el texto es inequívoco.
//
// SALUDO_SIMPLE: todas las palabras pertenecen al vocabulario
// de saludo y al menos una es un saludo núcleo.
// "Hola, necesito etiquetas de 5x5" NO es saludo simple.
//
// PRODUCTO_NO_P4: el texto nombra un impreso que no es
// etiqueta adhesiva y NO menciona etiquetas/stickers/adhesivos.
//
// DIVISION_MINIMO_DISENOS: el cliente quiere repartir una
// cantidad entre varios diseños (sabores, nombres, modelos)
// y la división es imposible: menos de 1000 por diseño o
// cantidades por diseño que no son múltiplo de 1000. Se
// explica el mínimo sin derivar. "3000 para 3 diseños" es
// posible y lo decide el cerebro.
//
// ======================================================

const VOCABULARIO_SALUDO = new Set([
  'hola', 'holi', 'ola', 'alo', 'hey', 'hi', 'hello',
  'buenas', 'buenos', 'buena', 'buen', 'dia', 'dias',
  'tarde', 'tardes', 'noche', 'noches', 'saludos', 'saludo',
  'que', 'tal', 'como', 'esta', 'estan', 'estas', 'muy', 'y',
  'senor', 'senora', 'senorita', 'sr', 'sra', 'srta',
  'estimado', 'estimada', 'estimados', 'amigo', 'amiga',
  'a', 'todos', 'usted', 'ustedes'
]);

const NUCLEO_SALUDO = new Set([
  'hola', 'holi', 'ola', 'alo', 'hey', 'hi', 'hello',
  'buenas', 'buenos', 'buena', 'buen', 'saludos', 'saludo'
]);

const PRODUCTOS_TARJETAS = [
  {
    patron:
      /\btar[ej]\w{3,8}s?\b|\btarjetas?( de (presentacion|visita|negocio|negocios)| personales?| corporativas?)?\b/,
    producto: 'tarjetas de presentación'
  },
  {
    patron: /\bestampitas?\b.*\bcouche\b|\bcouche\b.*\bestampitas?\b/,
    producto: 'estampitas / couche (vía tarjetas)'
  }
];

const LEMAS_FLYERS = [
  'volante', 'volantes', 'vonates', 'bolantes', 'volates',
  'flyer', 'flyers', 'flayer', 'flayers', 'flier', 'fliers'
];

const LEMAS_TARJETAS = [
  'tarjeta', 'tarjetas', 'tarejtes', 'estampita', 'estampitas'
];

const PRODUCTOS_FLYERS = [
  {
    patron: /\b(flyers?|flayers?|fliers?|volantes?|vonates?|bolantes?|volates?)\b/,
    producto: 'flyers / volantes'
  }
];

const LEMAS_AFICHES = [
  'afiche', 'afiches', 'afishes'
];

const LEMAS_TRIPTICOS = [
  'triptico', 'tripticos', 'tryptico', 'trypticos'
];

const LEMAS_MEMBRETADAS = [
  'membretada', 'membretadas', 'membrete', 'membretes'
];

const PRODUCTOS_AFICHES = [
  {
    patron: /\bafiches?\b/,
    producto: 'afiches'
  }
];

const PRODUCTOS_TRIPTICOS = [
  {
    patron: /\btripticos?\b/,
    producto: 'trípticos'
  }
];

const PRODUCTOS_MEMBRETADAS = [
  {
    patron: /\bhojas? membretadas?\b|\bmembretadas?\b|\bmembretes?\b/,
    producto: 'hojas membretadas'
  }
];

const PRODUCTOS_NO_P4 = [
  { patron: /\bcarpetas?\b/, producto: 'carpetas' },
  { patron: /\btalonarios?\b/, producto: 'talonarios' },
  { patron: /\bboletos?\b/, producto: 'boletos' },
  { patron: /\bentradas? (para|de)\b/, producto: 'entradas' },
  { patron: /\bformularios?\b/, producto: 'formularios' },
  { patron: /\bdipticos?\b/, producto: 'dípticos' },
  { patron: /\bbrochures?\b/, producto: 'brochures' },
  { patron: /\bbanners?\b/, producto: 'banners' },
  { patron: /\blonas?\b/, producto: 'lonas' },
  { patron: /\bpendones?\b/, producto: 'pendones' },
  { patron: /\broll\s*ups?\b|\brollups?\b/, producto: 'roll up' },
  { patron: /\bgigantografias?\b/, producto: 'gigantografías' },
  { patron: /\bplotter\b/, producto: 'plotter' },
  { patron: /\bimanes?\b|\bmagneticos?\b/, producto: 'imanes' },
  { patron: /\bcajas?\b|\bempaques?\b|\bpackaging\b/, producto: 'cajas / empaque' },
  { patron: /\bservilletas?\b|\bvasos?\b/, producto: 'servilletas / vasos' },
  { patron: /\bcamisetas?\b|\bpolos?\b|\bgorras?\b|\buniformes?\b|\bsublimacion\b/, producto: 'textil' },
  { patron: /\blanyards?\b|\bcredenciales?\b|\bpuls(era|eras)\b/, producto: 'lanyards / credenciales' },
  { patron: /\bpines?\b|\bbotones?\b|\bllaveros?\b/, producto: 'pines / llaveros' },
  { patron: /\bcalendarios?\b|\bagendas?\b|\blibretas?\b/, producto: 'calendarios / agendas' },
  { patron: /\brecetarios?\b|\bfactureros?\b|\bsellos?\b/, producto: 'recetarios / sellos' },
  { patron: /\binvitaciones?\b/, producto: 'invitaciones' },
  { patron: /\bdisplays?\b|\btotems?\b|\bdummies?\b/, producto: 'displays' },
  { patron: /\bacrilico\b|\bfoam\b|\bmdf\b|\bcanvas\b|\blienzo\b/, producto: 'sustrato no manejado' }
];

const MENCIONA_ETIQUETA =
  /\b(etiquetas?|stickers?|adhesiv[oa]s?|calcomanias?|pegatinas?|rotulos?|vinil|viniles)\b/;

const RESPUESTA_TRANSICION_NO_P4 =
  'Permítame un momento por favor, verificamos su requerimiento.';

const RESPUESTA_PRECIO_FORMA_TROQUEL =
  'Así es, desde los 5 cm para abajo se usa troquel para realizar los cortes por lo que el precio es el mismo, sea rectangular, circular o troquelado';

const RESPUESTA_CIERRE_TARJETAS =
  'Le adjunto videos y precios de los acabados que manejamos en tarjetas de presentación\n\n' +
  '*Precios no incluyen IVA*';

const RESPUESTA_MINIMO_CATALOGO =
  'El mínimo es 1000 unidades por diseño, del mismo diseño. No es posible dividir en varios diseños.';

const RESPUESTA_CIERRE_FLYERS =
  'Le adjunto tamaños y precios de volantes / flyers (1000 unidades):\n\n' +
  'A6 (10.5 x 14.8 cm)\n' +
  '• 1 lado: $20\n' +
  '• 2 lados: $26\n\n' +
  'A5 (21 x 14.8 cm)\n' +
  '• 1 lado: $32\n' +
  '• 2 lados: $41\n\n' +
  '*Precios no incluyen IVA*';

const RESPUESTA_CIERRE_AFICHES =
  'Le adjunto tamaños y precios de afiches:\n\n' +
  '1000 afiches A3 (29.7 x 42 cm)\n' +
  '• Full color, 1 lado, Couche 150 gr: $100\n' +
  '• Si ya tiene el diseño listo para imprimir: $90\n\n' +
  '*Precios no incluyen IVA*';

const RESPUESTA_CIERRE_TRIPTICOS =
  'Le adjunto tamaños y precios de trípticos:\n\n' +
  '1000 trípticos A4 (21 x 29.7 cm)\n' +
  '• Full color, ambos lados, doblados y cortados: $85\n' +
  '• Debe enviarnos el diseño listo. Si no tiene diseño, el diseño es $15 adicionales.\n\n' +
  '*Precios no incluyen IVA*';

const RESPUESTA_CIERRE_MEMBRETADAS =
  'Le adjunto tamaños y precios de hojas membretadas:\n\n' +
  '1000 hojas membretadas A4 (21 x 29.7 cm)\n' +
  '• Full color, 1 lado, papel Bond 75 gr: $65\n\n' +
  '*Precios no incluyen IVA*';


const MINIMO_POR_DISENO = 1000;

const PALABRA_DISENO =
  '(?:disenos?|modelos?|sabor(?:es)?|nombres?|variedad(?:es)?|version(?:es)?|textos?|tipos?|referencias?|artes?|marcas?|color(?:es)?|productos?|presentacion(?:es)?)';

const CANTIDAD_DISENOS =
  '(\\d{1,2}|un|uno|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|varios|varias|diferentes|distintos|distintas)';

const NUMEROS_PALABRA = {
  un: 1, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5,
  seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10
};

// Como normalizarTexto, pero conserva cantidades:
// "1.500" -> 1500, "dos mil" -> 2000, "mil" -> 1000.
function textoCantidades(valor) {
  return String(valor ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/(\d)[.,](?=\d{3}\b)/g, '$1')
    .replace(
      /\b(\d{1,3}|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez) mil\b/g,
      (_, n) => String((NUMEROS_PALABRA[n] ?? Number(n)) * 1000)
    )
    .replace(/\bmil\b/g, '1000')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// null = "varios / diferentes": al menos 2, número desconocido.
function numeroDisenos(token) {
  if (/^\d+$/.test(token)) {
    return Number(token);
  }

  return NUMEROS_PALABRA[token] ?? null;
}

function cantidadValidaPorDiseno(q) {
  return q >= MINIMO_POR_DISENO && q % MINIMO_POR_DISENO === 0;
}

function ajustarCantidadPorDiseno(q) {
  return Math.max(
    MINIMO_POR_DISENO,
    Math.ceil(q / MINIMO_POR_DISENO) * MINIMO_POR_DISENO
  );
}

function detectarDivisionDisenos(textoOriginal) {
  const t = textoCantidades(textoOriginal);

  const nombraDisenos =
    new RegExp(`\\b${PALABRA_DISENO}\\b`).test(t);

  if (!nombraDisenos && !/\b(otro|otra)\b/.test(t)) {
    return null;
  }

  // "1500 de un diseño y 1000 de otro y 500 de otro"
  const porDiseno =
    [...t.matchAll(
      /\b(\d{3,})\b (?:(?:etiquetas|unidades|stickers) )?(?:de|del|para|con|en) (?:un|una|uno|otro|otra|el otro|la otra|el primero?|el segundo|el tercero?)\b/g
    )].map(m => Number(m[1]));

  if (porDiseno.length >= 2) {
    return porDiseno.every(cantidadValidaPorDiseno)
      ? null
      : { tipo: 'CANTIDADES_POR_DISENO', cantidades: porDiseno };
  }

  // "500 de cada diseño" / "5 diseños de 500"
  const deCada = t.match(
    new RegExp(`\\b(\\d{3,})\\b (?:(?:etiquetas|unidades|stickers) )?(?:de|para|por|en) cada (?:uno|una|${PALABRA_DISENO})\\b`)
  );

  const nDisenosDe = t.match(
    new RegExp(`\\b${CANTIDAD_DISENOS} ${PALABRA_DISENO} (?:\\w+ )?de (\\d{3,})\\b`)
  );

  if (deCada || nDisenosDe) {
    const q = Number(deCada ? deCada[1] : nDisenosDe[2]);

    return cantidadValidaPorDiseno(q)
      ? null
      : {
          tipo: 'CANTIDAD_POR_CADA_DISENO',
          cantidad_por_diseno: q,
          disenos: nDisenosDe ? numeroDisenos(nDisenosDe[1]) : null
        };
  }

  // "las 3000 para 5 diseños" / "5 diseños pero solo 3000 etiquetas"
  // "1000 etiquetas, mitad de un diseño y mitad de otro"
  let total = null;
  let disenos = null;

  const totalAntes = t.match(
    new RegExp(`\\b(\\d{3,})\\b (?:\\w+ ){0,3}?(?:para|en|de|con|entre) (?:los |las )?${CANTIDAD_DISENOS} (?:\\w+ )?${PALABRA_DISENO}\\b`)
  );

  const totalDespues = t.match(
    new RegExp(`\\b${CANTIDAD_DISENOS} ${PALABRA_DISENO}\\b (?:\\w+ ){0,4}?(\\d{3,}) (?:etiquetas|unidades|stickers|en total)\\b`)
  );

  if (nombraDisenos && /\bmitad\b/.test(t)) {
    const primera = t.match(/\b(\d{3,})\b/);
    total = primera ? Number(primera[1]) : null;
    disenos = 2;
  } else if (totalAntes) {
    total = Number(totalAntes[1]);
    disenos = numeroDisenos(totalAntes[2]);
  } else if (totalDespues) {
    total = Number(totalDespues[2]);
    disenos = numeroDisenos(totalDespues[1]);
  }

  if (total === null || disenos === 1) {
    return null;
  }

  const minimoNecesario =
    (disenos ?? 2) * MINIMO_POR_DISENO;

  return total < minimoNecesario
    ? { tipo: 'TOTAL_ENTRE_DISENOS', total, disenos }
    : null;
}

function formatoMiles(n) {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

function respuestaDivisionDisenos(division) {
  const base =
    'No es posible dividir la cantidad entre varios diseños: ' +
    'cada diseño requiere mínimo 1.000 etiquetas y trabajamos en múltiplos de 1.000. ' +
    'Si cambia una letra o palabra ya se considera otro diseño.';

  let detalle = '';

  if (division.tipo === 'CANTIDADES_POR_DISENO') {
    const partes = division.cantidades.map(q => {
      const ajustada = ajustarCantidadPorDiseno(q);
      return ajustada === q
        ? formatoMiles(q)
        : `${formatoMiles(q)} → ${formatoMiles(ajustada)}`;
    });

    const lista =
      partes.slice(0, -1).join(', ') + ' y ' + partes[partes.length - 1];

    const totalAjustado = division.cantidades
      .map(ajustarCantidadPorDiseno)
      .reduce((s, q) => s + q, 0);

    detalle =
      `Para sus ${division.cantidades.length} diseños las cantidades podrían ser: ` +
      `${lista} (${formatoMiles(totalAjustado)} en total).`;
  } else if (division.tipo === 'CANTIDAD_POR_CADA_DISENO') {
    detalle = division.disenos
      ? `Para ${division.disenos} diseños necesitaría 1.000 de cada uno: ` +
        `${formatoMiles(division.disenos * MINIMO_POR_DISENO)} etiquetas en total.`
      : `Cada diseño necesita 1.000 etiquetas, no ${formatoMiles(division.cantidad_por_diseno)}.`;
  } else {
    const posibles = Math.floor(division.total / MINIMO_POR_DISENO);

    const necesita = division.disenos
      ? `Para ${division.disenos} diseños necesitaría mínimo ` +
        `${formatoMiles(division.disenos * MINIMO_POR_DISENO)} etiquetas (1.000 por diseño).`
      : '';

    const alcance =
      posibles >= 2
        ? `Con ${formatoMiles(division.total)} etiquetas podemos hacerle hasta ${posibles} diseños de 1.000.`
        : posibles === 1
          ? `Con ${formatoMiles(division.total)} etiquetas podemos hacerle 1 diseño.`
          : '';

    detalle = [necesita, alcance].filter(Boolean).join(' ');
  }

  return `${base} ${detalle} ¿Con cuántos diseños desea que le coticemos?`
    .replace(/\s+/g, ' ')
    .trim();
}


function saludoHorario(textoPlano) {
  if (/\bnoches?\b/.test(textoPlano)) {
    return 'Buenas noches';
  }

  if (/\btardes?\b/.test(textoPlano)) {
    return 'Buenas tardes';
  }

  if (/\bdias?\b/.test(textoPlano)) {
    return 'Buenos días';
  }

  const horaEcuador =
    new Date(
      Date.now() + OFFSET_HORA_ECUADOR * 3600 * 1000
    ).getUTCHours();

  if (horaEcuador >= 5 && horaEcuador < 12) {
    return 'Buenos días';
  }

  if (horaEcuador >= 12 && horaEcuador < 19) {
    return 'Buenas tardes';
  }

  return 'Buenas noches';
}


function decisionBase() {
  return {
    intencion: 'OTRO',
    accion: 'RESPONDER_GENERAL',
    producto: null,
    material: null,
    cantidad: null,
    ancho_cm: null,
    alto_cm: null,
    forma: 'NO_ESPECIFICADA',
    ciudad_detectada: null,
    provincia_detectada: null,
    datos_suficientes_para_cotizar: false,
    requiere_humano: false,
    motivo_derivacion: 'NINGUNO',
    respuesta_sugerida: ''
  };
}


let reglaPreIA = null;

let decisionPreIA = null;

let productoNoP4Detectado = null;

let productoTarjetasDetectado = null;

let productoFlyersDetectado = null;

let productoAfichesDetectado = null;

let productoTripticosDetectado = null;

let productoMembretadasDetectado = null;

let divisionDisenosDetectada = null;

const textoTurnoPlano =
  normalizarTexto(textoTurno);

const productoTarjetas =
  textoTurnoPlano !== ''
    ? (
        PRODUCTOS_TARJETAS.find(p => p.patron.test(textoTurnoPlano)) ??
        (
          mencionaLemas(textoTurnoPlano, LEMAS_TARJETAS)
            ? { producto: 'tarjetas de presentación' }
            : null
        )
      )
    : null;

const catalogoTarjetasYaEnviado =
  String(
    objeto(contextoComercial.catalogo_tarjetas).enviada_at ?? ''
  ).trim() !== '';

const productoFlyers =
  textoTurnoPlano !== ''
    ? (
        PRODUCTOS_FLYERS.find(p => p.patron.test(textoTurnoPlano)) ??
        (
          mencionaLemas(textoTurnoPlano, LEMAS_FLYERS)
            ? { producto: 'flyers / volantes' }
            : null
        )
      )
    : null;

const catalogoFlyersYaEnviado =
  String(
    objeto(contextoComercial.catalogo_flyers).enviada_at ?? ''
  ).trim() !== '';

function productoCatalogoRapido(productos, lemas, nombre) {
  if (textoTurnoPlano === '') {
    return null;
  }

  return productos.find(p => p.patron.test(textoTurnoPlano)) ??
    (
      mencionaLemas(textoTurnoPlano, lemas)
        ? { producto: nombre }
        : null
    );
}

const productoAfiches =
  productoCatalogoRapido(
    PRODUCTOS_AFICHES,
    LEMAS_AFICHES,
    'afiches'
  );

const productoTripticos =
  productoCatalogoRapido(
    PRODUCTOS_TRIPTICOS,
    LEMAS_TRIPTICOS,
    'trípticos'
  );

const productoMembretadas =
  productoCatalogoRapido(
    PRODUCTOS_MEMBRETADAS,
    LEMAS_MEMBRETADAS,
    'hojas membretadas'
  );

const catalogoAfichesYaEnviado =
  String(
    objeto(contextoComercial.catalogo_afiches).enviada_at ?? ''
  ).trim() !== '';

const catalogoTripticosYaEnviado =
  String(
    objeto(contextoComercial.catalogo_tripticos).enviada_at ?? ''
  ).trim() !== '';

const catalogoMembretadasYaEnviado =
  String(
    objeto(contextoComercial.catalogo_membretadas).enviada_at ?? ''
  ).trim() !== '';

const mezclaTarjetasYFlyers =
  productoTarjetas !== null &&
  productoFlyers !== null;

const mezclaCatalogoImpreso =
  [
    productoTarjetas,
    productoFlyers,
    productoAfiches,
    productoTripticos,
    productoMembretadas
  ].filter(Boolean).length > 1;

const mezclaEtiquetasYCatalogo =
  MENCIONA_ETIQUETA.test(textoTurnoPlano) &&
  (
    productoTarjetas !== null ||
    productoFlyers !== null ||
    productoAfiches !== null ||
    productoTripticos !== null ||
    productoMembretadas !== null
  );

const PIDE_PRECIO_CATALOGO =
  /\b(precios?|total|cuanto |a como|vale|valor|cotiz|suma)\b/.test(
    textoTurnoPlano
  );

const specsTarjetasCompletas =
  /\b(uv selectiv\w*|selectiv\w*|pan de oro|uv brillant\w*|mate)\b/.test(
    textoTurnoPlano
  );

const specsFlyersCompletas =
  /\b(a5|a6)\b/.test(textoTurnoPlano) &&
  /\b((una|1|un|dos|2) (solo )?(lado|lados|cara|caras)|ambos lados|un lado|un solo lado)\b/.test(
    textoTurnoPlano
  );

const pideTotalCatalogoCompleto =
  PIDE_PRECIO_CATALOGO &&
  (
    mezclaTarjetasYFlyers ||
    (productoTarjetas !== null && specsTarjetasCompletas) ||
    (productoFlyers !== null && specsFlyersCompletas)
  );

// Primer contacto de tarjetas o flyers (también con imagen/archivo).
// Si el catálogo ya salió, no se salta el cerebro.
// Si pide el total con datos, el resolver suma: no INFORMAR_*.
// Si nombra tarjetas y flyers juntos, el cerebro no salta.
if (mezclaCatalogoImpreso || mezclaEtiquetasYCatalogo) {
  productoTarjetasDetectado = productoTarjetas?.producto ?? null;
  productoFlyersDetectado = productoFlyers?.producto ?? null;
  productoAfichesDetectado = productoAfiches?.producto ?? null;
  productoTripticosDetectado = productoTripticos?.producto ?? null;
  productoMembretadasDetectado = productoMembretadas?.producto ?? null;
} else if (
  productoTarjetas &&
  !catalogoTarjetasYaEnviado &&
  !pideTotalCatalogoCompleto
) {
  reglaPreIA = 'TARJETAS_PRESENTACION';
  productoTarjetasDetectado = productoTarjetas.producto;

  decisionPreIA = {
    ...decisionBase(),
    intencion: 'CONSULTAR_PRECIO',
    accion: 'INFORMAR_TARJETAS',
    producto: 'tarjetas de presentación',
    requiere_humano: false,
    motivo_derivacion: 'NINGUNO',
    respuesta_sugerida: RESPUESTA_CIERRE_TARJETAS
  };
} else if (productoTarjetas) {
  productoTarjetasDetectado = productoTarjetas.producto;
} else if (
  productoFlyers &&
  !catalogoFlyersYaEnviado &&
  !pideTotalCatalogoCompleto
) {
  reglaPreIA = 'FLYERS_VOLANTES';
  productoFlyersDetectado = productoFlyers.producto;

  decisionPreIA = {
    ...decisionBase(),
    intencion: 'CONSULTAR_PRECIO',
    accion: 'INFORMAR_FLYERS',
    producto: 'flyers / volantes',
    requiere_humano: false,
    motivo_derivacion: 'NINGUNO',
    respuesta_sugerida: RESPUESTA_CIERRE_FLYERS
  };
} else if (productoFlyers) {
  productoFlyersDetectado = productoFlyers.producto;
} else if (
  productoAfiches &&
  !catalogoAfichesYaEnviado
) {
  reglaPreIA = 'AFICHES';
  productoAfichesDetectado = productoAfiches.producto;

  decisionPreIA = {
    ...decisionBase(),
    intencion: 'CONSULTAR_PRECIO',
    accion: 'INFORMAR_AFICHES',
    producto: 'afiches',
    requiere_humano: false,
    motivo_derivacion: 'NINGUNO',
    respuesta_sugerida: RESPUESTA_CIERRE_AFICHES
  };
} else if (productoAfiches) {
  productoAfichesDetectado = productoAfiches.producto;
} else if (
  productoTripticos &&
  !catalogoTripticosYaEnviado
) {
  reglaPreIA = 'TRIPTICOS';
  productoTripticosDetectado = productoTripticos.producto;

  decisionPreIA = {
    ...decisionBase(),
    intencion: 'CONSULTAR_PRECIO',
    accion: 'INFORMAR_TRIPTICOS',
    producto: 'trípticos',
    requiere_humano: false,
    motivo_derivacion: 'NINGUNO',
    respuesta_sugerida: RESPUESTA_CIERRE_TRIPTICOS
  };
} else if (productoTripticos) {
  productoTripticosDetectado = productoTripticos.producto;
} else if (
  productoMembretadas &&
  !catalogoMembretadasYaEnviado
) {
  reglaPreIA = 'HOJAS_MEMBRETADAS';
  productoMembretadasDetectado = productoMembretadas.producto;

  decisionPreIA = {
    ...decisionBase(),
    intencion: 'CONSULTAR_PRECIO',
    accion: 'INFORMAR_MEMBRETADAS',
    producto: 'hojas membretadas',
    requiere_humano: false,
    motivo_derivacion: 'NINGUNO',
    respuesta_sugerida: RESPUESTA_CIERRE_MEMBRETADAS
  };
} else if (productoMembretadas) {
  productoMembretadasDetectado = productoMembretadas.producto;
}

if (
  decisionPreIA === null &&
  mediaTurno.cantidad_media === 0 &&
  textoTurnoPlano !== ''
) {

  const tokens =
    textoTurnoPlano
      .split(' ')
      .map(t => t.replace(/(.)\1+/g, '$1'));

  const esSaludoSimple =
    tokens.length > 0 &&
    tokens.length <= 6 &&
    tokens.every(t => VOCABULARIO_SALUDO.has(t)) &&
    tokens.some(t => NUCLEO_SALUDO.has(t));

  const productoNoP4 =
    MENCIONA_ETIQUETA.test(textoTurnoPlano)
      ? null
      : PRODUCTOS_NO_P4.find(p => p.patron.test(textoTurnoPlano)) ?? null;

  const formasPrecioMencionadas =
    [
      /\bcuadrad/.test(textoTurnoPlano),
      /\bcircular|\bredond/.test(textoTurnoPlano),
      /\brectangul/.test(textoTurnoPlano),
      /\btroquel/.test(textoTurnoPlano)
    ].filter(Boolean).length;

  const preguntaMismoPrecioFormaP4 =
    formasPrecioMencionadas >= 2 &&
    /\b(lo mismo|igual(es)?|mismo precio|cuesta?n? igual)\b/.test(
      textoTurnoPlano
    ) &&
    productoTarjetas === null &&
    productoFlyers === null &&
    productoAfiches === null &&
    productoTripticos === null &&
    productoMembretadas === null;

  if (esSaludoSimple) {
    reglaPreIA = 'SALUDO_SIMPLE';

    decisionPreIA = {
      ...decisionBase(),
      respuesta_sugerida:
        `${saludoHorario(textoTurnoPlano)} 🤗 ¿En qué podemos ayudarle?`
    };
  } else if (productoNoP4) {
    reglaPreIA = 'PRODUCTO_NO_P4';

    productoNoP4Detectado = productoNoP4.producto;

    decisionPreIA = {
      ...decisionBase(),
      intencion: 'SOLICITAR_COTIZACION',
      accion: 'DERIVAR_HUMANO',
      requiere_humano: true,
      motivo_derivacion: 'PRODUCTO_NO_P4',
      respuesta_sugerida: RESPUESTA_TRANSICION_NO_P4
    };
  } else if (preguntaMismoPrecioFormaP4) {
    reglaPreIA = 'PRECIO_FORMA_TROQUEL';

    decisionPreIA = {
      ...decisionBase(),
      intencion: 'OTRO',
      accion: 'RESPONDER_GENERAL',
      respuesta_sugerida: RESPUESTA_PRECIO_FORMA_TROQUEL
    };
  } else {
    divisionDisenosDetectada =
      detectarDivisionDisenos(textoTurno);

    if (divisionDisenosDetectada) {
      reglaPreIA = 'DIVISION_MINIMO_DISENOS';

      const esCatalogoImpreso =
        productoTarjetasDetectado !== null ||
        productoFlyersDetectado !== null ||
        textoONull(contextoComercial.producto_linea) === 'TARJETAS_PRESENTACION' ||
        textoONull(contextoComercial.producto_linea) === 'FLYERS_VOLANTES';

      decisionPreIA = {
        ...decisionBase(),
        intencion: 'CONSULTAR_MINIMO',
        accion: 'INFORMAR_MINIMO',
        respuesta_sugerida:
          esCatalogoImpreso
            ? RESPUESTA_MINIMO_CATALOGO
            : respuestaDivisionDisenos(divisionDisenosDetectada)
      };
    }
  }
}


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
        mensajesSalientesRecientes,

      ultimo_saliente:
        ultimoSaliente,

      medidas_ya_solicitadas:
        medidasYaSolicitadas,


      // ==================================================
      // REGLAS PRE-IA
      // ==================================================

      regla_pre_ia:
        reglaPreIA,

      producto_no_p4:
        productoNoP4Detectado,

      producto_tarjetas:
        productoTarjetasDetectado,

      producto_flyers:
        productoFlyersDetectado,

      producto_afiches:
        productoAfichesDetectado,

      producto_tripticos:
        productoTripticosDetectado,

      producto_membretadas:
        productoMembretadasDetectado,

      division_disenos:
        divisionDisenosDetectada,

      requiere_cerebro_comercial:
        decisionPreIA === null,

      ...(
        decisionPreIA
          ? { decision: decisionPreIA }
          : {}
      )
    }
  }
];
