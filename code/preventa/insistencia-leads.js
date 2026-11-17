// Insistencia única a leads de anuncio que no responden.
// Roadmap: docs/ROADMAP-INSISTENCIA-LEADS-ANUNCIO.md
// Lo usan "Preparar insistencia lead" (texto y botones del envío)
// y "Preparar contexto IA" (respuesta del cliente a la insistencia).

const INSISTENCIA_BOTON_SI = 'SEG_SI';
const INSISTENCIA_BOTON_NO = 'SEG_NO';
const INSISTENCIA_TITULO_SI = 'Sí, quiero cotizar';
const INSISTENCIA_TITULO_NO = 'Ya no, gracias';

// "Resolver contexto comercial" puede acotar estos textos con sus
// reglas aprobadas (medidas ya solicitadas, rechazo/cierre). El
// rechazo usa el mismo texto que el resolver para "no gracias".
const RESPUESTA_INSISTENCIA_ACEPTADA =
  'Perfecto 🤗 Para enviarle el precio indíquenos por favor el ancho y el alto de sus etiquetas en centímetros. Con esos datos le cotizamos de inmediato.';

const RESPUESTA_INSISTENCIA_RECHAZADA =
  'Cualquier duda o inquietud hágamela saber, estamos para servirle.';

// Huella de la insistencia sobre texto normalizado
// (minúsculas, sin tildes ni signos).
const PATRON_HUELLA_INSISTENCIA =
  /\bnos escribio por\b.*\baun le interesa\b/;

const PATRON_RECHAZO_INSISTENCIA =
  /^(ya no|no|no gracias|ya no gracias|no me interesa|ya no me interesa|ya no necesito|no necesito|por ahora no|no por ahora|todavia no|aun no)( muchas)?( gracias)?$/;

const PATRON_ACEPTA_INSISTENCIA =
  /^(si|si claro|claro|claro que si|ok|okey|dale|de acuerdo|por favor|si por favor|si quiero|si quiero cotizar|quiero cotizar|si me interesa|me interesa|si aun me interesa|si todavia)( por favor)?( gracias)?$/;

function saludoInsistencia(horaLocal) {
  const hora = Number(horaLocal);

  if (!Number.isFinite(hora) || hora < 12) {
    return 'Buenos días';
  }

  return hora < 18 ? 'Buenas tardes' : 'Buenas noches';
}

function textoInsistencia(saludo, producto) {
  const productoTexto =
    String(producto ?? '').trim() || 'etiquetas adhesivas';

  return `${saludo} 👋 Nos escribió por ${productoTexto}, ¿aún le interesa? ` +
    'Si nos indica el ancho y alto en centímetros le cotizamos de inmediato.';
}

function botonesInsistencia() {
  return [
    { type: 'reply', reply: { id: INSISTENCIA_BOTON_SI, title: INSISTENCIA_TITULO_SI } },
    { type: 'reply', reply: { id: INSISTENCIA_BOTON_NO, title: INSISTENCIA_TITULO_NO } }
  ];
}

// textoPlano y ultimoSalientePlano ya normalizados.
// Devuelve 'RECHAZO', 'ACEPTA' o null.
function clasificarRespuestaInsistencia(textoPlano, ultimoSalientePlano) {
  const texto = String(textoPlano ?? '').trim();

  if (!texto || !PATRON_HUELLA_INSISTENCIA.test(String(ultimoSalientePlano ?? ''))) {
    return null;
  }

  if (PATRON_RECHAZO_INSISTENCIA.test(texto)) {
    return 'RECHAZO';
  }

  return PATRON_ACEPTA_INSISTENCIA.test(texto) ? 'ACEPTA' : null;
}
