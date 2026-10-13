// ======================================================
// N8N NODE - PEGASO
// ======================================================
// Nombre: Analizar imagen OpenAI
// Node ID: cac07c7b-5251-40d5-a127-6c972b3113c7
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
// NODO N8N: VALIDAR AN├üLISIS IMAGEN GROQ
// PEGASO ADHESIVOS
// ARCHIVO: code/03-conversacion/validar-analisis-imagen.js
// VERSION: 2.1
// ======================================================
//
// RESPONSABILIDAD:
//
// - Recibir la salida de "Analizar imagen Groq Basic LLM".
// - Validar que el an├ílisis visual cumpla el contrato.
// - Recuperar el mensaje original desde "Preparar media del turno".
// - NO necesita recibir nuevamente el binario.
// - NO analiza la imagen.
// - NO decide la acci├│n comercial.
// - NO deriva directamente a humano.
// - Si Groq falla, devuelve analisis_valido = false para
//   permitir que el IF env├¡e el flujo a DeepSeek.
// - Extraer y normalizar medidas escritas expl├¡citamente en la imagen
//   sin estimarlas ni alterar el resto del contrato visual.
//
// IMPORTANTE:
//
// Esta misma l├│gica puede reutilizarse despu├®s para:
//
//   Validar an├ílisis imagen DeepSeek
//   Validar an├ílisis imagen OpenAI
//
// cambiando ├║nicamente PROVEEDOR_ANALISIS.
//
// ======================================================


const PROVEEDOR_ANALISIS = 'GROQ';


// ======================================================
// 1. CONSTANTES
// ======================================================

const CONTENIDOS_VALIDOS = [
  'ENVASE_O_PRODUCTO',
  'ETIQUETA_O_DISENO',
  'LOGO',
  'REFERENCIA_VISUAL',
  'MEDIDAS_ESCRITAS',
  'COMPROBANTE_PAGO',
  'EVIDENCIA_RECLAMO',
  'CAPTURA_DE_PANTALLA',
  'NO_RELACIONADO',
  'NO_DETERMINABLE'
];


const MOTIVOS_REVISION_VALIDOS = [
  'NINGUNO',
  'IMAGEN_ILEGIBLE',
  'IMAGEN_AMBIGUA',
  'DISENO_COMPLEJO',
  'OTRO'
];


const CONFIANZAS_VALIDAS = [
  'ALTA',
  'MEDIA',
  'BAJA'
];


const CONTENIDOS_ETIQUETA = [
  'ENVASE_O_PRODUCTO',
  'ETIQUETA_O_DISENO',
  'LOGO',
  'REFERENCIA_VISUAL',
  'MEDIDAS_ESCRITAS'
];


const LARGO_MAXIMO_RESUMEN = 500;
const LARGO_MAXIMO_CAMPO = 250;


// ======================================================
// 2. HELPERS
// ======================================================

function textoONull(
  valor,
  largo = LARGO_MAXIMO_CAMPO
) {

  if (
    valor === undefined ||
    valor === null
  ) {
    return null;
  }

  const limpio =
    String(valor)
      .replace(/\s+/g, ' ')
      .trim();

  if (!limpio) {
    return null;
  }

  return limpio.slice(
    0,
    largo
  );
}


function numeroONull(
  valor
) {

  if (
    valor === undefined ||
    valor === null ||
    valor === ''
  ) {
    return null;
  }

  const n =
    Number(valor);

  return Number.isFinite(n)
    ? n
    : null;
}


function booleanoONull(
  valor
) {

  if (
    valor === true ||
    valor === false
  ) {
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

  return null;
}


function medidaONull(
  valor
) {

  const n =
    numeroONull(valor);

  if (
    n === null ||
    n <= 0
  ) {
    return null;
  }

  return n;
}


function quitarCorchetes(
  valor
) {

  const texto =
    textoONull(valor);

  if (!texto) {
    return null;
  }

  return texto
    .replace(/\[/g, '(')
    .replace(/\]/g, ')');
}


function obtenerNodo(
  nombre
) {

  try {

    return (
      $(nombre)
        .first()
        .json ??
      {}
    );

  } catch (_) {

    return {};

  }
}


// ======================================================
// 3. LEER RESPUESTA DEL LLM
// ======================================================
//
// Dependiendo del nodo de n8n y del Output Parser,
// la respuesta puede llegar:
//
// {
//   output: {...}
// }
//
// {
//   output: "{...}"
// }
//
// {
//   text: "{...}"
// }
//
// o directamente como objeto.
//
// Tambi├®n puede llegar:
//
// {
//   error: ...
// }
//
// si el nodo est├í configurado con Continue On Fail.
//
// ======================================================

function leerSalidaIA(
  json
) {

  if (
    !json ||
    typeof json !== 'object'
  ) {

    return {
      error:
        'SALIDA_VACIA'
    };

  }


  // --------------------------------------------------
  // Error expl├¡cito del nodo
  // --------------------------------------------------

  if (json.error) {

    const detalle =
      textoONull(
        json.error?.message ??
        json.error
      );

    return {
      error:
        'IA_FALLIDA',

      detalle
    };

  }


  // --------------------------------------------------
  // Buscar salida probable
  // --------------------------------------------------

  let salida =
    json.output ??
    json.text ??
    json.response ??
    json.result ??
    json.data ??
    null;


  // Algunos nodos pueden devolver directamente
  // el contrato en el root.

  if (
    salida === null &&
    json.contenido_detectado !== undefined
  ) {

    salida =
      json;

  }


  // --------------------------------------------------
  // Parsear JSON string
  // --------------------------------------------------

  if (
    typeof salida === 'string'
  ) {

    let limpio =
      salida.trim();


    limpio =
      limpio.replace(
        /^```(?:json)?\s*/i,
        ''
      );


    limpio =
      limpio.replace(
        /\s*```$/,
        ''
      );


    try {

      salida =
        JSON.parse(
          limpio
        );

    } catch (_) {

      return {
        error:
          'JSON_INVALIDO',

        detalle:
          limpio.slice(
            0,
            300
          )
      };

    }

  }


  // --------------------------------------------------
  // Validar que sea objeto
  // --------------------------------------------------

  if (
    !salida ||
    typeof salida !== 'object' ||
    Array.isArray(salida)
  ) {

    return {
      error:
        'SALIDA_VACIA'
    };

  }


  return {
    datos:
      salida
  };
}


// ======================================================
// 4. VALIDAR CONTRATO
// ======================================================

function validarContrato(
  datos
) {

  if (
    !CONTENIDOS_VALIDOS.includes(
      datos.contenido_detectado
    )
  ) {

    return (
      'contenido_detectado inv├ílido'
    );

  }


  if (
    !CONFIANZAS_VALIDAS.includes(
      datos.confianza
    )
  ) {

    return (
      'confianza inv├ílida'
    );

  }


  if (
    !MOTIVOS_REVISION_VALIDOS.includes(
      datos.motivo_revision
    )
  ) {

    return (
      'motivo_revision inv├ílido'
    );

  }


  const camposBooleanos = [
    'envase_detectado',
    'etiqueta_visible',
    'diseno_visible',
    'requiere_revision_humana'
  ];


  for (
    const campo
    of camposBooleanos
  ) {

    if (
      booleanoONull(
        datos[campo]
      ) === null
    ) {

      return (
        `${campo} debe ser boolean`
      );

    }

  }


  const medidasNumericas = [
    'ancho_cm',
    'alto_cm',
    'diametro_cm'
  ];

  for (const campo of medidasNumericas) {
    const valor = datos[campo];

    if (
      valor !== undefined &&
      valor !== null &&
      medidaONull(valor) === null
    ) {
      return `${campo} debe ser number positivo o null`;
    }
  }


  if (
    !textoONull(
      datos.resumen_para_cerebro,
      LARGO_MAXIMO_RESUMEN
    )
  ) {

    return (
      'resumen_para_cerebro vac├¡o'
    );

  }


  return null;
}


// ======================================================
// 5. RECUPERAR CONTEXTO ORIGINAL
// ======================================================
//
// El nodo LLM puede devolver ├║nicamente:
//
// {
//   output: {...}
// }
//
// Por eso NO dependemos de que preserve:
//
// - mensaje_id
// - conversacion_id
// - caption
// - contenido_base
//
// Estos datos se recuperan desde:
//
// "Preparar media del turno"
//
// ======================================================

const origenes = (() => {

  try {

    return (
      $('Preparar media del turno')
        .all()
    );

  } catch (_) {

    return [];

  }

})();


// ======================================================
// 6. PROCESAR ITEMS
// ======================================================

const entradas =
  $input.all();


const resultados =
  entradas.map(
    (
      item,
      indice
    ) => {

      const input =
        item.json ?? {};


      const origen =
        origenes[indice]?.json ??
        origenes[0]?.json ??
        {};


      // ==================================================
      // IDENTIDAD
      // ==================================================

      const mensajeId =
        numeroONull(
          input.mensaje_id ??
          origen.mensaje_id
        );


      const conversacionId =
        numeroONull(
          input.conversacion_id ??
          origen.conversacion_id
        );


      const contenidoBase =
        textoONull(
          origen.contenido_base ??
          input.contenido_base,
          1500
        ) ??
        '[IMAGEN]';


      // ==================================================
      // LEER IA
      // ==================================================

      const lectura =
        leerSalidaIA(
          input
        );


      const errorContrato =
        lectura.datos
          ? validarContrato(
              lectura.datos
            )
          : null;


      // ==================================================
      // 7. AN├üLISIS INV├üLIDO
      // ==================================================
      //
      // Aqu├¡ NO derivamos humano todav├¡a.
      //
      // Groq inv├ílido
      //    Ôåô
      // IF false
      //    Ôåô
      // DeepSeek
      //
      // ==================================================

      if (
        lectura.error ||
        errorContrato
      ) {

        const errorAnalisis =
          lectura.error ??
          'SCHEMA_INVALIDO';


        const detalleError =
          lectura.detalle ??
          errorContrato ??
          null;


        return {
          json: {

            mensaje_id:
              mensajeId,

            conversacion_id:
              conversacionId,

            proveedor_analisis:
              PROVEEDOR_ANALISIS,


            // ------------------------------------------
            // RESULTADO
            // ------------------------------------------

            analisis_valido:
              false,

            requiere_revision:
              true,

            motivo_revision:
              'ANALISIS_NO_DISPONIBLE',


            // ------------------------------------------
            // DETECCI├ôN
            // ------------------------------------------

            comprobante_detectado:
              false,

            contenido_detectado:
              null,

            confianza:
              null,

            analisis:
              null,


            // ------------------------------------------
            // ERROR
            // ------------------------------------------

            error_analisis:
              errorAnalisis,

            detalle_error:
              detalleError,


            // ------------------------------------------
            // CONTEXTO PARA SIGUIENTE FALLBACK
            // ------------------------------------------

            contenido_base:
              contenidoBase,

            contenido_actualizado:
              (
                `${contenidoBase}\n` +
                `[CONTEXTO DE IMAGEN ┬À proveedor=${PROVEEDOR_ANALISIS} ┬À ` +
                'revision=SI ┬À motivo=ANALISIS_NO_DISPONIBLE] ' +
                'El an├ílisis autom├ítico de esta imagen no estuvo disponible.'
              )

          }
        };

      }


      // ==================================================
      // 8. AN├üLISIS V├üLIDO
      // ==================================================

      const datos =
        lectura.datos;


      const contenido =
        datos.contenido_detectado;


      const confianza =
        datos.confianza;


      // ==================================================
      // 8.1 MEDIDAS ESCRITAS
      // ==================================================
      //
      // Compatibilidad:
      // - Si el schema nuevo trae medidas_detectadas, se respeta.
      // - Si un fallback antiguo solo trae medidas_visibles, se infiere.
      // - Si existen ancho/alto/di├ímetro expl├¡citos, tambi├®n cuenta como
      //   medida detectada.
      //
      // Nunca se calculan medidas desde proporciones de la fotograf├¡a.
      // ==================================================

      const anchoCm =
        medidaONull(
          datos.ancho_cm
        );

      const altoCm =
        medidaONull(
          datos.alto_cm
        );

      const diametroCm =
        medidaONull(
          datos.diametro_cm
        );

      const medidasVisiblesOriginales =
        textoONull(
          datos.medidas_visibles,
          180
        );

      const medidaEstructuradaExiste =
        anchoCm !== null ||
        altoCm !== null ||
        diametroCm !== null;

      const medidasDetectadas =
        booleanoONull(
          datos.medidas_detectadas
        ) === true ||
        medidasVisiblesOriginales !== null ||
        medidaEstructuradaExiste;

      const medidasVisiblesDerivadas =
        [
          anchoCm !== null
            ? `ancho ${anchoCm} cm`
            : null,
          altoCm !== null
            ? `alto ${altoCm} cm`
            : null,
          diametroCm !== null
            ? `di├ímetro ${diametroCm} cm`
            : null
        ]
          .filter(Boolean)
          .join(' ┬À ');

      const medidasVisibles =
        medidasDetectadas
          ? (
              medidasVisiblesOriginales ??
              textoONull(
                medidasVisiblesDerivadas,
                180
              )
            )
          : null;


      // ==================================================
      // 9. NORMALIZAR AN├üLISIS
      // ==================================================

      const analisis = {

        contenido_detectado:
          contenido,


        producto_probable:
          contenido === 'NO_RELACIONADO'
            ? null
            : textoONull(
                datos.producto_probable
              ),


        envase_detectado:
          booleanoONull(
            datos.envase_detectado
          ) === true,


        forma_envase:
          textoONull(
            datos.forma_envase
          ),


        etiqueta_visible:
          booleanoONull(
            datos.etiqueta_visible
          ) === true,


        diseno_visible:
          booleanoONull(
            datos.diseno_visible
          ) === true,


        texto_visible_relevante:
          contenido === 'COMPROBANTE_PAGO'
            ? null
            : textoONull(
                datos.texto_visible_relevante
              ),


        colores_relevantes:
          Array.isArray(
            datos.colores_relevantes
          )
            ? datos.colores_relevantes
                .map(
                  color =>
                    textoONull(
                      color,
                      40
                    )
                )
                .filter(
                  Boolean
                )
                .slice(
                  0,
                  6
                )
            : [],


        medidas_detectadas:
          medidasDetectadas,

        ancho_cm:
          medidasDetectadas
            ? anchoCm
            : null,

        alto_cm:
          medidasDetectadas
            ? altoCm
            : null,

        diametro_cm:
          medidasDetectadas
            ? diametroCm
            : null,

        medidas_visibles:
          medidasVisibles,


        requiere_revision_humana:
          booleanoONull(
            datos.requiere_revision_humana
          ) === true,


        motivo_revision:
          datos.motivo_revision,


        confianza,


        resumen_para_cerebro:
          textoONull(
            datos.resumen_para_cerebro,
            LARGO_MAXIMO_RESUMEN
          )

      };


      // ==================================================
      // 10. DETERMINAR REVISI├ôN HUMANA
      // ======================================================

      let motivoRevision =
        null;


      if (
        analisis
          .requiere_revision_humana === true
      ) {

        motivoRevision =
          analisis.motivo_revision !==
          'NINGUNO'
            ? analisis.motivo_revision
            : 'OTRO';

      }


      else if (
        confianza ===
        'BAJA'
      ) {

        motivoRevision =
          'CONFIANZA_BAJA';

      }


      else if (
        contenido ===
        'NO_DETERMINABLE'
      ) {

        motivoRevision =
          'IMAGEN_AMBIGUA';

      }


      const requiereRevision =
        motivoRevision !==
        null;


      // ==================================================
      // 11. CONSTRUIR CONTEXTO LEGIBLE
      // ======================================================

      const cabecera = [

        'CONTEXTO DE IMAGEN',

        `proveedor=${PROVEEDOR_ANALISIS}`,

        `contenido=${contenido}`,

        `confianza=${confianza}`,

        `revision=${
          requiereRevision
            ? 'SI'
            : 'NO'
        }`,

        requiereRevision
          ? `motivo=${motivoRevision}`
          : null

      ]
        .filter(
          Boolean
        )
        .join(
          ' ┬À '
        );


      const detalle = [

        quitarCorchetes(
          analisis
            .resumen_para_cerebro
        ),


        analisis.producto_probable
          ? (
              'Producto probable: ' +
              `${quitarCorchetes(
                analisis.producto_probable
              )}.`
            )
          : null,


        analisis.forma_envase
          ? (
              'Envase: ' +
              `${quitarCorchetes(
                analisis.forma_envase
              )}.`
            )
          : null,


        analisis.texto_visible_relevante
          ? (
              'Texto visible: "' +
              `${quitarCorchetes(
                analisis.texto_visible_relevante
              )}".`
            )
          : null,


        analisis
          .colores_relevantes
          .length > 0
            ? (
                'Colores: ' +
                `${analisis
                  .colores_relevantes
                  .join(', ')}.`
              )
            : null,


        analisis.medidas_detectadas
          ? (
              'Medidas escritas en la imagen: ' +
              [
                analisis.ancho_cm !== null
                  ? `ancho=${analisis.ancho_cm} cm`
                  : null,
                analisis.alto_cm !== null
                  ? `alto=${analisis.alto_cm} cm`
                  : null,
                analisis.diametro_cm !== null
                  ? `di├ímetro=${analisis.diametro_cm} cm`
                  : null,
                analisis.medidas_visibles
                  ? `texto="${quitarCorchetes(
                      analisis.medidas_visibles
                    )}"`
                  : null
              ]
                .filter(Boolean)
                .join(' ┬À ') +
              '.'
            )
          : CONTENIDOS_ETIQUETA.includes(
              contenido
            )
              ? 'Sin medidas visibles.'
              : null

      ]
        .filter(
          Boolean
        )
        .join(
          ' '
        );


      // ==================================================
      // 12. SALIDA
      // ======================================================

      return {
        json: {

          mensaje_id:
            mensajeId,

          conversacion_id:
            conversacionId,

          proveedor_analisis:
            PROVEEDOR_ANALISIS,


          // ------------------------------------------
          // RESULTADO
          // ------------------------------------------

          analisis_valido:
            true,

          requiere_revision:
            requiereRevision,

          motivo_revision:
            motivoRevision,


          // ------------------------------------------
          // DETECCI├ôN
          // ------------------------------------------

          comprobante_detectado:
            contenido ===
            'COMPROBANTE_PAGO',

          contenido_detectado:
            contenido,

          confianza,

          medidas_detectadas:
            analisis.medidas_detectadas,

          ancho_cm:
            analisis.ancho_cm,

          alto_cm:
            analisis.alto_cm,

          diametro_cm:
            analisis.diametro_cm,

          medidas_visibles:
            analisis.medidas_visibles,

          medidas_para_cerebro: {
            detectadas:
              analisis.medidas_detectadas,

            ancho_cm:
              analisis.ancho_cm,

            alto_cm:
              analisis.alto_cm,

            diametro_cm:
              analisis.diametro_cm,

            texto_original:
              analisis.medidas_visibles,

            fuente:
              'IMAGEN'
          },


          // ------------------------------------------
          // ERROR
          // ------------------------------------------

          error_analisis:
            null,

          detalle_error:
            null,


          // ------------------------------------------
          // AN├üLISIS NORMALIZADO
          // ------------------------------------------

          analisis,


          // ------------------------------------------
          // CONTEXTO
          // ------------------------------------------

          contenido_base:
            contenidoBase,

          contenido_actualizado:
            (
              `${contenidoBase}\n` +
              `[${cabecera}] ${detalle}`
            )

        }
      };

    }
  );


return resultados;
