// ======================================================
// NODO N8N: VALIDAR ANÁLISIS IMAGEN
// PEGASO ADHESIVOS
// VERSION: 2.0
// ======================================================
//
// RESPONSABILIDAD:
//
// Recibir la salida de CUALQUIER proveedor de visión:
//
//   - Groq
//   - DeepSeek
//   - OpenAI
//
// y convertirla a un contrato común.
//
// Este nodo es AGNÓSTICO AL PROVEEDOR.
//
// Entrada esperada:
//
//   salida del nodo "Analizar imagen <Proveedor>"
//
// Puede venir como:
//
//   json.output
//   json.text
//   json.response
//   json.content
//   json.message.content
//   json.data
//   JSON string
//
// También soporta errores generados por:
//
//   - descarga YCloud
//   - nodo LLM
//   - parser estructurado
//
// Empareja el resultado con:
//
//   "Preparar media del turno"
//
// NO:
//   - toma decisiones comerciales
//   - confirma pagos
//   - escribe PostgreSQL
//
// SI:
//   - valida contrato
//   - normaliza análisis
//   - determina si requiere revisión humana
//   - genera contexto enriquecido para el cerebro comercial
//
// ======================================================


// ======================================================
// 0. CONFIGURACIÓN
// ======================================================

const CONTENIDOS = [
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


const MOTIVOS_REVISION = [
  'NINGUNO',
  'IMAGEN_ILEGIBLE',
  'IMAGEN_AMBIGUA',
  'DISENO_COMPLEJO',
  'OTRO'
];


const CONFIANZAS = [
  'ALTA',
  'MEDIA',
  'BAJA'
];


const CONTENIDOS_DE_ETIQUETA = [
  'ENVASE_O_PRODUCTO',
  'ETIQUETA_O_DISENO',
  'LOGO',
  'REFERENCIA_VISUAL',
  'MEDIDAS_ESCRITAS'
];


const LARGO_MAXIMO_RESUMEN = 400;
const LARGO_MAXIMO_CAMPO = 200;


// ======================================================
// 1. HELPERS GENERALES
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


function booleanoONull(valor) {

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

  return null;
}


function sinCorchetes(valor) {

  if (valor === null) {
    return null;
  }

  return String(valor)
    .replace(/[\[\]]/g, '')
    .trim();
}


function quitarMarkdownJson(valor) {

  if (typeof valor !== 'string') {
    return valor;
  }

  return valor
    .trim()
    .replace(
      /^```(?:json)?\s*/i,
      ''
    )
    .replace(
      /\s*```$/,
      ''
    )
    .trim();
}


// ======================================================
// 2. DETECTAR PROVEEDOR
// ======================================================
//
// No afecta lógica.
// Solo sirve para diagnóstico.
//
// ======================================================

function detectarProveedor(json) {

  const modelo =
    textoONull(
      json?.model ??
      json?.modelo ??
      json?.provider ??
      json?.proveedor
    );

  if (modelo) {

    const upper =
      modelo.toUpperCase();

    if (
      upper.includes('GROQ') ||
      upper.includes('LLAMA')
    ) {
      return 'GROQ';
    }

    if (
      upper.includes('DEEPSEEK')
    ) {
      return 'DEEPSEEK';
    }

    if (
      upper.includes('GPT') ||
      upper.includes('OPENAI')
    ) {
      return 'OPENAI';
    }

  }

  return null;
}


// ======================================================
// 3. DETECTAR ERROR DEL NODO
// ======================================================

function detectarError(json) {

  if (
    !json ||
    typeof json !== 'object'
  ) {
    return null;
  }

  if (json.error) {

    if (
      typeof json.error === 'string'
    ) {
      return textoONull(
        json.error,
        500
      );
    }

    if (
      typeof json.error === 'object'
    ) {
      return (
        textoONull(
          json.error.message,
          500
        ) ??
        textoONull(
          json.error.description,
          500
        ) ??
        'ERROR_NODO'
      );
    }

    return 'ERROR_NODO';
  }


  if (
    json.success === false
  ) {

    return (
      textoONull(
        json.message,
        500
      ) ??
      textoONull(
        json.description,
        500
      ) ??
      'EJECUCION_FALLIDA'
    );

  }


  return null;
}


// ======================================================
// 4. EXTRAER POSIBLE SALIDA IA
// ======================================================
//
// Cada proveedor/nodo n8n puede envolver
// el resultado de manera distinta.
//
// ======================================================

function extraerSalidaBruta(json) {

  if (
    json === undefined ||
    json === null
  ) {
    return null;
  }


  // --------------------------------------------------
// Caso raro:
// el propio item ya ES el contrato
// --------------------------------------------------

  if (
    typeof json === 'object' &&
    !Array.isArray(json) &&
    json.contenido_detectado
  ) {
    return json;
  }


  if (
    typeof json !== 'object'
  ) {
    return json;
  }


  const candidatos = [

    json.output,

    json.text,

    json.response,

    json.content,

    json.result,

    json.data,

    json.message?.content,

    json.choices?.[0]
      ?.message
      ?.content,

    json.choices?.[0]
      ?.text

  ];


  for (
    const candidato
    of candidatos
  ) {

    if (
      candidato !== undefined &&
      candidato !== null
    ) {
      return candidato;
    }

  }


  return null;
}


// ======================================================
// 5. PARSEAR SALIDA IA
// ======================================================

function leerSalidaIA(json) {

  if (
    !json ||
    typeof json !== 'object'
  ) {

    return {
      error:
        'SALIDA_VACIA',

      detalle:
        null
    };

  }


  const errorNodo =
    detectarError(json);


  if (errorNodo) {

    return {
      error:
        'DESCARGA_O_IA_FALLIDA',

      detalle:
        errorNodo
    };

  }


  let salida =
    extraerSalidaBruta(json);


  if (
    salida === undefined ||
    salida === null
  ) {

    return {
      error:
        'SALIDA_VACIA',

      detalle:
        null
    };

  }


  // --------------------------------------------------
// Algunas integraciones devuelven array
// --------------------------------------------------

  if (
    Array.isArray(salida)
  ) {

    if (
      salida.length === 1 &&
      typeof salida[0] === 'object'
    ) {
      salida = salida[0];
    }

    else {

      return {
        error:
          'SALIDA_ARRAY_NO_SOPORTADA',

        detalle:
          null
      };

    }

  }


  // --------------------------------------------------
// JSON como texto
// --------------------------------------------------

  if (
    typeof salida === 'string'
  ) {

    const limpio =
      quitarMarkdownJson(
        salida
      );


    try {

      salida =
        JSON.parse(
          limpio
        );

    }

    catch (error) {

      return {
        error:
          'JSON_INVALIDO',

        detalle:
          textoONull(
            error.message,
            500
          )
      };

    }

  }


  // --------------------------------------------------
// El parser puede envolver en output otra vez
// --------------------------------------------------

  if (
    salida &&
    typeof salida === 'object' &&
    !Array.isArray(salida) &&
    salida.output &&
    typeof salida.output === 'object'
  ) {

    salida =
      salida.output;

  }


  if (
    !salida ||
    typeof salida !== 'object' ||
    Array.isArray(salida)
  ) {

    return {
      error:
        'SALIDA_VACIA',

      detalle:
        null
    };

  }


  return {
    datos:
      salida
  };
}


// ======================================================
// 6. VALIDAR CONTRATO
// ======================================================

function validar(datos) {

  if (
    !datos ||
    typeof datos !== 'object'
  ) {
    return 'salida no es objeto';
  }


  if (
    !CONTENIDOS.includes(
      datos.contenido_detectado
    )
  ) {
    return 'contenido_detectado inválido';
  }


  if (
    !CONFIANZAS.includes(
      datos.confianza
    )
  ) {
    return 'confianza inválida';
  }


  if (
    !MOTIVOS_REVISION.includes(
      datos.motivo_revision
    )
  ) {
    return 'motivo_revision inválido';
  }


  for (
    const campo
    of [
      'envase_detectado',
      'etiqueta_visible',
      'diseno_visible',
      'requiere_revision_humana'
    ]
  ) {

    if (
      booleanoONull(
        datos[campo]
      ) === null
    ) {

      return `${campo} debe ser boolean`;

    }

  }


  if (
    !textoONull(
      datos.resumen_para_cerebro
    )
  ) {
    return 'resumen_para_cerebro vacío';
  }


  return null;
}


// ======================================================
// 7. OBTENER ORÍGENES
// ======================================================

const entradas =
  $input.all();


let origenes = [];


try {

  origenes =
    $('Preparar media del turno')
      .all();

}

catch (error) {

  origenes =
    [];

}


// ======================================================
// 8. PROCESAR RESULTADOS
// ======================================================

const resultados =
  entradas.map(
    (
      item,
      indice
    ) => {

      const origen =
        origenes[indice]?.json ??
        {};


      const mensajeId =
        Number(
          origen.mensaje_id
        );


      const contenidoBase =
        textoONull(
          origen.contenido_base,
          1200
        ) ??
        '[IMAGEN]';


      const proveedor =
        detectarProveedor(
          item.json
        );


      const lectura =
        leerSalidaIA(
          item.json
        );


      const errorContrato =
        lectura.datos
          ? validar(
              lectura.datos
            )
          : null;


      // ==================================================
      // 8.1 ANÁLISIS INVÁLIDO
      // ==================================================

      if (
        lectura.error ||
        errorContrato
      ) {

        return {
          json: {

            mensaje_id:
              Number.isFinite(
                mensajeId
              )
                ? mensajeId
                : null,


            proveedor_analisis:
              proveedor,


            analisis_valido:
              false,


            requiere_revision:
              true,


            motivo_revision:
              'ANALISIS_NO_DISPONIBLE',


            comprobante_detectado:
              false,


            contenido_detectado:
              null,


            confianza:
              null,


            error_analisis:
              lectura.error ??
              'SCHEMA_INVALIDO',


            detalle_error:
              lectura.detalle ??
              errorContrato ??
              null,


            analisis:
              null,


            contenido_actualizado:
              `${contenidoBase}\n` +
              '[CONTEXTO DE IMAGEN · revision=SI · motivo=ANALISIS_NO_DISPONIBLE] ' +
              'La imagen no pudo revisarse automáticamente.'

          }
        };

      }


      // ==================================================
      // 8.2 ANÁLISIS VÁLIDO
      // ==================================================

      const datos =
        lectura.datos;


      const contenido =
        datos.contenido_detectado;


      const confianza =
        datos.confianza;


      const requiereRevisionIA =
        booleanoONull(
          datos.requiere_revision_humana
        ) === true;


      const analisis = {

        contenido_detectado:
          contenido,


        producto_probable:
          contenido ===
          'NO_RELACIONADO'
            ? null
            : textoONull(
                datos.producto_probable
              ),


        envase_detectado:
          booleanoONull(
            datos.envase_detectado
          ),


        forma_envase:
          textoONull(
            datos.forma_envase
          ),


        etiqueta_visible:
          booleanoONull(
            datos.etiqueta_visible
          ),


        diseno_visible:
          booleanoONull(
            datos.diseno_visible
          ),


        texto_visible_relevante:
          contenido ===
          'COMPROBANTE_PAGO'
            ? null
            : textoONull(
                datos.texto_visible_relevante
              ),


        colores_relevantes:
          Array.isArray(
            datos.colores_relevantes
          )
            ? datos
                .colores_relevantes
                .map(
                  color =>
                    textoONull(
                      color,
                      30
                    )
                )
                .filter(
                  Boolean
                )
                .slice(
                  0,
                  5
                )
            : [],


        medidas_visibles:
          textoONull(
            datos.medidas_visibles,
            60
          ),


        requiere_revision_humana:
          requiereRevisionIA,


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
      // 8.3 RESOLVER REVISIÓN HUMANA
      // ==================================================

      let motivoRevision =
        null;


      if (
        requiereRevisionIA
      ) {

        motivoRevision =
          datos.motivo_revision !==
          'NINGUNO'
            ? datos.motivo_revision
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
      // 8.4 CONSTRUIR CONTEXTO PARA CEREBRO COMERCIAL
      // ==================================================

      const cabecera = [

        'CONTEXTO DE IMAGEN',

        proveedor
          ? `proveedor=${proveedor}`
          : null,

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
          ' · '
        );


      const detalle = [

        sinCorchetes(
          analisis.resumen_para_cerebro
        ),


        analisis.producto_probable
          ? `Producto probable: ${
              sinCorchetes(
                analisis.producto_probable
              )
            }.`
          : null,


        analisis.forma_envase
          ? `Envase: ${
              sinCorchetes(
                analisis.forma_envase
              )
            }.`
          : null,


        analisis.texto_visible_relevante
          ? `Texto visible: "${
              sinCorchetes(
                analisis.texto_visible_relevante
              )
            }".`
          : null,


        analisis.colores_relevantes.length > 0
          ? `Colores: ${
              analisis
                .colores_relevantes
                .join(', ')
            }.`
          : null,


        analisis.medidas_visibles
          ? `Medidas escritas en la imagen: ${
              sinCorchetes(
                analisis.medidas_visibles
              )
            }.`
          : CONTENIDOS_DE_ETIQUETA.includes(
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
      // 8.5 SALIDA FINAL
      // ==================================================

      return {
        json: {

          mensaje_id:
            Number.isFinite(
              mensajeId
            )
              ? mensajeId
              : null,


          proveedor_analisis:
            proveedor,


          analisis_valido:
            true,


          requiere_revision:
            requiereRevision,


          motivo_revision:
            motivoRevision,


          comprobante_detectado:
            contenido ===
            'COMPROBANTE_PAGO',


          contenido_detectado:
            contenido,


          confianza,


          error_analisis:
            null,


          detalle_error:
            null,


          analisis,


          contenido_actualizado:
            `${contenidoBase}\n` +
            `[${cabecera}] ${detalle}`

        }
      };

    }
  );


// ======================================================
// 9. SALIDA
// ======================================================

return resultados;