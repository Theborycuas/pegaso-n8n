// ======================================================
// VALIDAR EXTRACCIÓN CEREBRO COMERCIAL - V2.3
// ======================================================
// Valida:
// - contrato del Cerebro Comercial;
// - enums;
// - cotización P4;
// - continuidad conversacional;
// - medidas no producibles;
// - derivación humana;
// - clasificación A/B/C;
// - motivo de derivación;
// - notificación.
// ======================================================


// ======================================================
// 1. RECUPERAR Y NORMALIZAR RESPUESTA
// ======================================================

const item = $input.first().json;

let data =
  item.output ??
  item;

if (typeof data === 'string') {
  try {
    data = JSON.parse(data);
  } catch (error) {
    return [
      {
        json: {
          valid: false,
          validation_reason:
            'La IA devolvió texto pero no JSON válido.',
          raw:
            data
        }
      }
    ];
  }
}

if (
  data &&
  typeof data === 'object' &&
  data.output &&
  typeof data.output === 'object'
) {
  data = data.output;
}


// ======================================================
// 2. CATÁLOGOS
// ======================================================

const INTENCIONES = [
  'SOLICITAR_COTIZACION',
  'APORTAR_DATOS',
  'CONSULTAR_PRECIO',
  'CONSULTAR_MATERIAL',
  'CONSULTAR_MINIMO',
  'CONSULTAR_UBICACION',
  'CONSULTAR_METODOLOGIA',
  'CONSULTAR_ENTREGA',
  'CONSULTAR_DISENO',
  'ACEPTAR_COTIZACION',
  'CONSULTAR_PAGO',
  'REPORTAR_PAGO',
  'CONFIRMAR_PEDIDO',
  'SOLICITAR_LLAMADA',
  'SOLICITAR_HUMANO',
  'POSPONER_DECISION',
  'NEGOCIAR',
  'RECLAMO',
  'OTRO'
];

const ACCIONES = [
  'PEDIR_MEDIDAS',
  'PEDIR_PRODUCTO',
  'PEDIR_FORMA',
  'INFORMAR_MATERIAL',
  'INFORMAR_MINIMO',
  'INFORMAR_UBICACION',
  'INFORMAR_METODOLOGIA',
  'INFORMAR_METODOLOGIA_PAGO',
  'INFORMAR_ENTREGA',
  'INFORMAR_DISENO',
  'COTIZAR_P4',

  // ----------------------------------------------
  // NUEVO:
  // medida conocida pero técnicamente no producible
  // ----------------------------------------------
  'MEDIDA_NO_PRODUCIBLE',

  'REGISTRAR_ACEPTACION',
  'DERIVAR_HUMANO',
  'RESPONDER_GENERAL'
];

const FORMAS = [
  'RECTANGULAR',
  'CIRCULAR',
  'REDONDEADA',
  'TROQUELADA',
  'NO_ESPECIFICADA'
];

const MOTIVOS_DERIVACION = [
  'NINGUNO',
  'CONFIRMAR_PEDIDO',
  'SOLICITA_DATOS_PAGO',
  'REPORTA_PAGO',
  'ENVIA_COMPROBANTE',
  'SOLICITA_LLAMADA',
  'SOLICITA_HABLAR_CON_PERSONA',
  'ARCHIVO_DISENO',
  'IMAGEN_REQUIERE_REVISION',
  'ARCHIVO_NO_PROCESABLE',
  'DISENO_ESPECIAL',
  'NEGOCIACION',
  'RECLAMO',
  'PROBLEMA_PEDIDO',
  'PROBLEMA_PAGO',
  'PROBLEMA_ENTREGA',
  'OTRO'
];

const CLASIFICACIONES = [
  'A',
  'B',
  'C'
];

const CAMPOS_REQUERIDOS = [
  'intencion',
  'accion',
  'producto',
  'material',
  'cantidad',
  'ancho_cm',
  'alto_cm',
  'forma',
  'ciudad_detectada',
  'provincia_detectada',
  'datos_suficientes_para_cotizar',
  'requiere_humano',
  'motivo_derivacion',
  'requiere_notificacion',
  'clasificacion_prospecto',
  'respuesta_sugerida'
];


// ======================================================
// 3. HELPERS
// ======================================================

function numeroONull(valor) {
  return (
    valor === null ||
    (
      typeof valor === 'number' &&
      Number.isFinite(valor)
    )
  );
}

function textoONull(valor) {
  return (
    valor === null ||
    typeof valor === 'string'
  );
}

function invalido(reason) {
  return [
    {
      json: {
        ...(data && typeof data === 'object' ? data : {}),
        valid: false,
        validation_reason:
          reason
      }
    }
  ];
}


// ======================================================
// 4. ESTRUCTURA GENERAL
// ======================================================

if (
  !data ||
  typeof data !== 'object' ||
  Array.isArray(data)
) {
  return invalido(
    'La IA no devolvió un objeto válido.'
  );
}

for (const campo of CAMPOS_REQUERIDOS) {
  if (!(campo in data)) {
    return invalido(
      `Falta el campo obligatorio: ${campo}`
    );
  }
}


// ======================================================
// 5. ENUMS
// ======================================================

if (!INTENCIONES.includes(data.intencion)) {
  return invalido(
    `Intención inválida: ${data.intencion}`
  );
}

if (!ACCIONES.includes(data.accion)) {
  return invalido(
    `Acción inválida: ${data.accion}`
  );
}

if (!FORMAS.includes(data.forma)) {
  return invalido(
    `Forma inválida: ${data.forma}`
  );
}

if (
  !MOTIVOS_DERIVACION.includes(
    data.motivo_derivacion
  )
) {
  return invalido(
    `motivo_derivacion inválido: ${data.motivo_derivacion}`
  );
}

if (
  !CLASIFICACIONES.includes(
    data.clasificacion_prospecto
  )
) {
  return invalido(
    `clasificacion_prospecto inválida: ${data.clasificacion_prospecto}`
  );
}


// ======================================================
// 6. TIPOS
// ======================================================

if (
  typeof data.datos_suficientes_para_cotizar !== 'boolean'
) {
  return invalido(
    'datos_suficientes_para_cotizar debe ser boolean.'
  );
}

if (
  typeof data.requiere_humano !== 'boolean'
) {
  return invalido(
    'requiere_humano debe ser boolean.'
  );
}

if (
  typeof data.requiere_notificacion !== 'boolean'
) {
  return invalido(
    'requiere_notificacion debe ser boolean.'
  );
}

if (
  typeof data.respuesta_sugerida !== 'string'
) {
  return invalido(
    'respuesta_sugerida debe ser string.'
  );
}

for (
  const campo of [
    'producto',
    'material',
    'ciudad_detectada',
    'provincia_detectada'
  ]
) {
  if (!textoONull(data[campo])) {
    return invalido(
      `${campo} debe ser string o null.`
    );
  }
}

for (
  const campo of [
    'cantidad',
    'ancho_cm',
    'alto_cm'
  ]
) {
  if (!numeroONull(data[campo])) {
    return invalido(
      `${campo} debe ser número o null.`
    );
  }

  if (
    data[campo] !== null &&
    data[campo] <= 0
  ) {
    return invalido(
      `${campo} debe ser mayor que cero.`
    );
  }
}


// ======================================================
// 7. RESPUESTA SUGERIDA
// ======================================================
//
// COTIZAR_P4 es la única acción que puede llegar con
// respuesta vacía porque el nodo de cotización construye
// el mensaje final con el precio.
//
// TODAS las demás acciones deben mantener continuidad.
// ======================================================

if (
  data.accion !== 'COTIZAR_P4' &&
  data.respuesta_sugerida.trim() === ''
) {
  return invalido(
    `${data.accion} requiere respuesta_sugerida no vacía.`
  );
}


// ======================================================
// 7.1. CONTROL DE TONO
// ======================================================

if (
  data.respuesta_sugerida.includes('😊')
) {
  return invalido(
    'respuesta_sugerida no debe utilizar el emoji 😊.'
  );
}

if (
  /^(¡?Perfecto!?|Entendemos|Con gusto le explico)\b/i.test(
    data.respuesta_sugerida.trim()
  )
) {
  return invalido(
    'respuesta_sugerida inicia con una muletilla comercial no permitida.'
  );
}


// ======================================================
// 7.2. CONTROL ANTI-REPETICIÓN
// ======================================================

function normalizarParaComparar(valor) {
  return String(valor ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/^[\s¡!¿?.,;:*-]+|[\s¡!¿?.,;:*-]+$/g, '');
}

let ultimoMensajeSaliente = '';

try {
  ultimoMensajeSaliente =
    $('Preparar contexto IA')
      .first()
      .json
      .ultimo_mensaje_saliente ?? '';
} catch (_) {
  ultimoMensajeSaliente = '';
}

if (
  data.accion !== 'COTIZAR_P4' &&
  data.respuesta_sugerida.trim() !== '' &&
  ultimoMensajeSaliente
) {
  const actualNormalizado =
    normalizarParaComparar(
      data.respuesta_sugerida
    );

  const anteriorNormalizado =
    normalizarParaComparar(
      ultimoMensajeSaliente
    );

  if (
    actualNormalizado !== '' &&
    actualNormalizado === anteriorNormalizado
  ) {
    return invalido(
      'respuesta_sugerida repite exactamente el último mensaje saliente.'
    );
  }
}


// ======================================================
// 8. COTIZACIÓN P4
// ======================================================

if (
  data.accion === 'COTIZAR_P4'
) {

  if (
    data.cantidad === null
  ) {
    return invalido(
      'COTIZAR_P4 requiere cantidad. Si el cliente no indicó cantidad, debe usarse 1000.'
    );
  }

  if (
    data.ancho_cm === null ||
    data.alto_cm === null
  ) {
    return invalido(
      'COTIZAR_P4 requiere ancho_cm y alto_cm.'
    );
  }

  // ------------------------------------------------------
  // REGLA TÉCNICA DE PRODUCIBILIDAD
  // ------------------------------------------------------

  if (
    Number(data.ancho_cm) <= 1 ||
    Number(data.alto_cm) <= 1
  ) {
    return invalido(
      'COTIZAR_P4 no corresponde porque la medida contiene un lado de 1 cm o menos. Debe utilizar MEDIDA_NO_PRODUCIBLE.'
    );
  }

  if (
    data.datos_suficientes_para_cotizar !== true
  ) {
    return invalido(
      'COTIZAR_P4 requiere datos_suficientes_para_cotizar=true.'
    );
  }

  if (
    data.requiere_humano === true
  ) {
    return invalido(
      'COTIZAR_P4 no puede tener requiere_humano=true.'
    );
  }

  if (
    data.clasificacion_prospecto === 'C'
  ) {
    return invalido(
      'Un prospecto con datos suficientes para cotizar no debe clasificarse C.'
    );
  }
}


// ======================================================
// 9. PEDIR MEDIDAS
// ======================================================

if (
  data.accion === 'PEDIR_MEDIDAS'
) {

  if (
    data.ancho_cm !== null &&
    data.alto_cm !== null
  ) {
    return invalido(
      'PEDIR_MEDIDAS no corresponde porque ya existen ancho_cm y alto_cm.'
    );
  }

  if (
    data.datos_suficientes_para_cotizar === true
  ) {
    return invalido(
      'PEDIR_MEDIDAS no puede tener datos_suficientes_para_cotizar=true.'
    );
  }

  if (
    data.requiere_humano === true
  ) {
    return invalido(
      'PEDIR_MEDIDAS no debe requerir atención humana.'
    );
  }
}


// ======================================================
// 9.1. MEDIDA NO PRODUCIBLE
// ======================================================
//
// Pegaso no produce etiquetas con un lado de
// 1 cm o menos.
//
// En este caso:
//
// - las medidas YA existen;
// - no corresponde PEDIR_MEDIDAS;
// - no corresponde COTIZAR_P4;
// - no corresponde DERIVAR_HUMANO;
// - el BOT debe explicar la restricción y solicitar
//   otra medida.
//
// ======================================================

if (
  data.accion === 'MEDIDA_NO_PRODUCIBLE'
) {

  // ------------------------------------------------------
  // DEBE CONOCERSE ANCHO Y ALTO
  // ------------------------------------------------------

  if (
    data.ancho_cm === null ||
    data.alto_cm === null
  ) {
    return invalido(
      'MEDIDA_NO_PRODUCIBLE requiere ancho_cm y alto_cm.'
    );
  }


  // ------------------------------------------------------
  // LA MEDIDA DEBE SER REALMENTE NO PRODUCIBLE
  // ------------------------------------------------------

  const medidaNoProducible =
    Number(data.ancho_cm) <= 1 ||
    Number(data.alto_cm) <= 1;

  if (
    !medidaNoProducible
  ) {
    return invalido(
      'MEDIDA_NO_PRODUCIBLE solamente corresponde cuando ancho_cm o alto_cm es 1 cm o menos.'
    );
  }


  // ------------------------------------------------------
  // NO PUEDE PASAR A COTIZACIÓN
  // ------------------------------------------------------

  if (
    data.datos_suficientes_para_cotizar !== false
  ) {
    return invalido(
      'MEDIDA_NO_PRODUCIBLE requiere datos_suficientes_para_cotizar=false.'
    );
  }


  // ------------------------------------------------------
  // NO NECESITA HUMANO
  // ------------------------------------------------------

  if (
    data.requiere_humano !== false
  ) {
    return invalido(
      'MEDIDA_NO_PRODUCIBLE no debe requerir atención humana.'
    );
  }


  // ------------------------------------------------------
  // SIN MOTIVO DE DERIVACIÓN
  // ------------------------------------------------------

  if (
    data.motivo_derivacion !== 'NINGUNO'
  ) {
    return invalido(
      'MEDIDA_NO_PRODUCIBLE debe usar motivo_derivacion=NINGUNO.'
    );
  }


  // ------------------------------------------------------
  // SIN NOTIFICACIÓN INTERNA
  // ------------------------------------------------------

  if (
    data.requiere_notificacion !== false
  ) {
    return invalido(
      'MEDIDA_NO_PRODUCIBLE debe usar requiere_notificacion=false.'
    );
  }


  // ------------------------------------------------------
  // RESPUESTA OBLIGATORIA
  // ------------------------------------------------------

  if (
    typeof data.respuesta_sugerida !== 'string' ||
    data.respuesta_sugerida.trim() === ''
  ) {
    return invalido(
      'MEDIDA_NO_PRODUCIBLE requiere respuesta_sugerida no vacía.'
    );
  }


  // ------------------------------------------------------
  // INTENCIÓN PERMITIDA
  //
  // Normalmente será APORTAR_DATOS porque el cliente
  // acaba de proporcionar una nueva medida.
  //
  // También permitimos SOLICITAR_COTIZACION y
  // CONSULTAR_PRECIO porque puede llegar directamente
  // con la medida en el primer mensaje.
  // ------------------------------------------------------

  if (
    ![
      'APORTAR_DATOS',
      'SOLICITAR_COTIZACION',
      'CONSULTAR_PRECIO'
    ].includes(
      data.intencion
    )
  ) {
    return invalido(
      'MEDIDA_NO_PRODUCIBLE solamente admite APORTAR_DATOS, SOLICITAR_COTIZACION o CONSULTAR_PRECIO.'
    );
  }
}


// ======================================================
// 10. CANTIDAD COMERCIAL POR DEFECTO
// ======================================================
//
// Si ya existen ancho_cm y alto_cm y el cliente no indicó
// cantidad, usamos 1000 como mínimo comercial.
//
// Esto también aplica a MEDIDA_NO_PRODUCIBLE porque
// conservamos el contexto comercial completo, aunque
// obviamente no se vaya a calcular precio.
//
// ======================================================

if (
  data.ancho_cm !== null &&
  data.alto_cm !== null &&
  data.cantidad === null
) {
  data.cantidad = 1000;
}

if (
  data.ancho_cm !== null &&
  data.alto_cm !== null &&
  data.accion === 'PEDIR_MEDIDAS'
) {
  return invalido(
    'PEDIR_MEDIDAS no corresponde porque ya existen ancho_cm y alto_cm.'
  );
}


// ======================================================
// 11. PEDIR PRODUCTO / FORMA
// ======================================================

if (
  data.accion === 'PEDIR_PRODUCTO'
) {

  if (
    data.producto !== null &&
    String(
      data.producto
    ).trim() !== ''
  ) {
    return invalido(
      'PEDIR_PRODUCTO no corresponde porque producto ya existe.'
    );
  }

  if (
    data.ancho_cm !== null &&
    data.alto_cm !== null
  ) {
    return invalido(
      'PEDIR_PRODUCTO no corresponde para cotización P4 cuando ya existen medidas.'
    );
  }
}

if (
  data.accion === 'PEDIR_FORMA'
) {

  if (
    data.forma !== 'NO_ESPECIFICADA'
  ) {
    return invalido(
      'PEDIR_FORMA solamente corresponde cuando forma=NO_ESPECIFICADA.'
    );
  }

  if (
    data.ancho_cm !== null &&
    data.alto_cm !== null
  ) {
    return invalido(
      'PEDIR_FORMA no corresponde cuando ya existen medidas suficientes.'
    );
  }
}


// ======================================================
// 12. ACCIONES INFORMATIVAS
// ======================================================

const REGLAS_INFORMATIVAS = {

  INFORMAR_MATERIAL:
    'CONSULTAR_MATERIAL',

  INFORMAR_MINIMO:
    'CONSULTAR_MINIMO',

  INFORMAR_UBICACION:
    'CONSULTAR_UBICACION',

  INFORMAR_METODOLOGIA:
    'CONSULTAR_METODOLOGIA',

  INFORMAR_METODOLOGIA_PAGO:
    'CONSULTAR_PAGO',

  INFORMAR_ENTREGA:
    'CONSULTAR_ENTREGA',

  INFORMAR_DISENO:
    'CONSULTAR_DISENO'
};

for (
  const [accion, intencion]
  of Object.entries(
    REGLAS_INFORMATIVAS
  )
) {

  if (
    data.accion === accion &&
    data.intencion !== intencion
  ) {
    return invalido(
      `${accion} requiere intencion=${intencion}.`
    );
  }

  if (
    data.accion === accion &&
    data.requiere_humano === true
  ) {
    return invalido(
      `${accion} no debe requerir atención humana.`
    );
  }
}


// ======================================================
// 13. ACEPTACIÓN SIMPLE
// ======================================================

if (
  data.accion === 'REGISTRAR_ACEPTACION'
) {

  if (
    data.intencion !== 'ACEPTAR_COTIZACION'
  ) {
    return invalido(
      'REGISTRAR_ACEPTACION requiere intencion=ACEPTAR_COTIZACION.'
    );
  }

  if (
    data.requiere_humano === true
  ) {
    return invalido(
      'REGISTRAR_ACEPTACION no debe requerir humano.'
    );
  }

  if (
    data.clasificacion_prospecto !== 'A'
  ) {
    return invalido(
      'ACEPTAR_COTIZACION debe clasificar al prospecto como A.'
    );
  }
}


// ======================================================
// 14. DERIVACIÓN HUMANA
// ======================================================

if (
  data.accion === 'DERIVAR_HUMANO'
) {

  if (
    data.requiere_humano !== true
  ) {
    return invalido(
      'DERIVAR_HUMANO debe tener requiere_humano=true.'
    );
  }

  if (
    data.motivo_derivacion === 'NINGUNO'
  ) {
    return invalido(
      'DERIVAR_HUMANO requiere un motivo_derivacion distinto de NINGUNO.'
    );
  }

  if (
    data.requiere_notificacion !== true
  ) {
    return invalido(
      'DERIVAR_HUMANO debe tener requiere_notificacion=true.'
    );
  }

  if (
    data.respuesta_sugerida.trim() === ''
  ) {
    return invalido(
      'DERIVAR_HUMANO debe enviar un mensaje de transición al prospecto.'
    );
  }
}


// ======================================================
// 15. NO DERIVACIÓN
// ======================================================

if (
  data.requiere_humano === false
) {

  if (
    data.accion === 'DERIVAR_HUMANO'
  ) {
    return invalido(
      'DERIVAR_HUMANO requiere requiere_humano=true.'
    );
  }

  if (
    data.motivo_derivacion !== 'NINGUNO'
  ) {
    return invalido(
      'Si no requiere humano, motivo_derivacion debe ser NINGUNO.'
    );
  }

  if (
    data.requiere_notificacion !== false
  ) {
    return invalido(
      'Si no requiere humano, requiere_notificacion debe ser false.'
    );
  }
}


// ======================================================
// 16. INTENCIONES HUMANAS OBLIGATORIAS
// ======================================================

const INTENCIONES_HUMANAS = [
  'REPORTAR_PAGO',
  'CONFIRMAR_PEDIDO',
  'SOLICITAR_LLAMADA',
  'SOLICITAR_HUMANO',
  'NEGOCIAR',
  'RECLAMO'
];

if (
  INTENCIONES_HUMANAS.includes(
    data.intencion
  ) &&
  data.accion !== 'DERIVAR_HUMANO'
) {
  return invalido(
    `${data.intencion} debe utilizar accion=DERIVAR_HUMANO.`
  );
}


// ======================================================
// 17. COHERENCIA MOTIVO / INTENCIÓN
// ======================================================

if (
  data.intencion === 'CONFIRMAR_PEDIDO' &&
  data.motivo_derivacion !== 'CONFIRMAR_PEDIDO'
) {
  return invalido(
    'CONFIRMAR_PEDIDO debe usar motivo_derivacion=CONFIRMAR_PEDIDO.'
  );
}

if (
  data.intencion === 'SOLICITAR_LLAMADA' &&
  data.motivo_derivacion !== 'SOLICITA_LLAMADA'
) {
  return invalido(
    'SOLICITAR_LLAMADA debe usar motivo_derivacion=SOLICITA_LLAMADA.'
  );
}

if (
  data.intencion === 'SOLICITAR_HUMANO' &&
  data.motivo_derivacion !== 'SOLICITA_HABLAR_CON_PERSONA'
) {
  return invalido(
    'SOLICITAR_HUMANO debe usar motivo_derivacion=SOLICITA_HABLAR_CON_PERSONA.'
  );
}

if (
  data.intencion === 'NEGOCIAR' &&
  data.motivo_derivacion !== 'NEGOCIACION'
) {
  return invalido(
    'NEGOCIAR debe usar motivo_derivacion=NEGOCIACION.'
  );
}

if (
  data.intencion === 'REPORTAR_PAGO' &&
  ![
    'REPORTA_PAGO',
    'ENVIA_COMPROBANTE'
  ].includes(
    data.motivo_derivacion
  )
) {
  return invalido(
    'REPORTAR_PAGO debe usar motivo REPORTA_PAGO o ENVIA_COMPROBANTE.'
  );
}


// ======================================================
// 18. CONSULTA DE PAGO: DOS CASOS
// ======================================================
//
// A) Metodología:
//    INFORMAR_METODOLOGIA_PAGO
//
// B) Cuenta/datos concretos:
//    DERIVAR_HUMANO + SOLICITA_DATOS_PAGO
//
// ======================================================

if (
  data.intencion === 'CONSULTAR_PAGO'
) {

  if (
    ![
      'INFORMAR_METODOLOGIA_PAGO',
      'DERIVAR_HUMANO'
    ].includes(
      data.accion
    )
  ) {
    return invalido(
      'CONSULTAR_PAGO solamente puede usar INFORMAR_METODOLOGIA_PAGO o DERIVAR_HUMANO.'
    );
  }

  if (
    data.accion === 'DERIVAR_HUMANO' &&
    data.motivo_derivacion !== 'SOLICITA_DATOS_PAGO'
  ) {
    return invalido(
      'Una consulta de pago derivada a humano debe usar motivo_derivacion=SOLICITA_DATOS_PAGO.'
    );
  }

  if (
    data.accion === 'DERIVAR_HUMANO' &&
    data.clasificacion_prospecto !== 'A'
  ) {
    return invalido(
      'Un prospecto que solicita datos concretos para pagar debe clasificarse A.'
    );
  }
}


// ======================================================
// 19. POSPONER DECISIÓN
// ======================================================

if (
  data.intencion === 'POSPONER_DECISION'
) {

  if (
    data.accion !== 'RESPONDER_GENERAL'
  ) {
    return invalido(
      'POSPONER_DECISION debe usar RESPONDER_GENERAL.'
    );
  }

  if (
    data.requiere_humano !== false
  ) {
    return invalido(
      'POSPONER_DECISION no debe derivar a humano.'
    );
  }
}


// ======================================================
// 20. RESPONDER GENERAL
// ======================================================

if (
  data.accion === 'RESPONDER_GENERAL' &&
  ![
    'OTRO',
    'APORTAR_DATOS',
    'POSPONER_DECISION'
  ].includes(
    data.intencion
  )
) {
  return invalido(
    'RESPONDER_GENERAL solo admite OTRO, APORTAR_DATOS o POSPONER_DECISION.'
  );
}


// ======================================================
// 21. CLASIFICACIÓN MÍNIMA
// ======================================================

const CASOS_A_OBLIGATORIOS =
  data.intencion === 'ACEPTAR_COTIZACION' ||
  data.intencion === 'CONFIRMAR_PEDIDO' ||
  data.intencion === 'REPORTAR_PAGO' ||
  data.motivo_derivacion === 'SOLICITA_DATOS_PAGO' ||
  data.motivo_derivacion === 'ENVIA_COMPROBANTE';

if (
  CASOS_A_OBLIGATORIOS &&
  data.clasificacion_prospecto !== 'A'
) {
  return invalido(
    'Este caso debe clasificar al prospecto como A.'
  );
}


// ======================================================
// 22. SALIDA
// ======================================================

return [
  {
    json: {
      ...data,

      valid:
        true,

      validation_reason:
        null
    }
  }
];