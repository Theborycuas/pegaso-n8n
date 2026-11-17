// Textos de ubicación aprobados por Pegaso el 17-11-2026.
// Los patrones reciben texto normalizado: minúsculas y sin tildes.
const UBICACION_RESPUESTA_GENERAL =
  'Somos de la ciudad de Quito pero no tiene de qué preocuparse 🤗 ya que tenemos clientes a nivel nacional 🇪🇨 ' +
  'y les hacemos los envíos por medio de Servientrega 🚛 o por transporte depende de su requerimiento 🚌.';

const UBICACION_RESPUESTA_DIRECCION =
  'Nuestras oficinas están ubicadas en el Valle de los Chillos en el sector de Capelo y la planta de producción ' +
  'está ubicada en la ciudad de Quito en la Av. América y José Riofrío.\n' +
  '*En ambas direcciones le atendemos solo bajo previa cita por favor.*\n' +
  'Indíquenos, ¿cuándo tiene planificado visitarnos?';

// Seguimiento cuando la dirección ya se compartió: evita repetir el mismo bloque.
const UBICACION_RESPUESTA_CITA =
  'Con gusto. En ambas direcciones le atendemos solo bajo previa cita. Indíquenos, ¿cuándo tiene planificado visitarnos?';

const UBICACION_RESPUESTA_LLAMADA =
  'Con gusto le atendemos por este chat. Si prefiere visitarnos, le atendemos bajo previa cita en nuestras oficinas ' +
  'del Valle de los Chillos (sector Capelo) o en la planta de producción en Quito (Av. América y José Riofrío).';

// Pide la dirección en Quito, el local o una visita.
const UBICACION_PIDE_DIRECCION =
  /\b(direccion( exacta)?|ubicacion exacta|local fisico|tienen local|tiene local|un local|su local|el local|(sus|las) oficinas|(su|la) planta|para visitar(les|los)?|visitar(les|los)|puedo (ir|pasar|visitar(les|los)?)|podemos (ir|pasar)|ir a (verlos|visitarlos)|retiros? en (el )?local|retirar personalmente|parte de quito|en que sector|que sector|en quito donde|donde (estan|quedan|se encuentran|queda) en quito|(me|nos) (pasa|envia|comparte|manda) (su |la )?(ubicacion|direccion)|ayudeme (con )?(la |su )?(ubicacion|direccion)|ubicacion (en|de) quito|google maps)\b/;

// Pregunta en qué ciudad está Pegaso.
const UBICACION_PIDE_CIUDAD =
  /\b(donde (estan|quedan|se encuentran|son)|de donde (son|es|nos escriben)|en ?q(ue)? (ciudad|parte).{0,24}(encuentran|ubicados|estan|son|quedan)|de que ciudad (son|es)|que ciudad (son|es|estan)|ubicacion|estan ubicados)\b/;

function clasificarConsultaUbicacion(plano) {
  const texto = String(plano ?? '');
  if (UBICACION_PIDE_DIRECCION.test(texto)) return 'DIRECCION';
  if (UBICACION_PIDE_CIUDAD.test(texto)) return 'CIUDAD';
  return null;
}

// Clasifica un texto ya enviado: dirección en Quito o respuesta general de ciudad y envíos.
function familiaRespuestaUbicacion(plano) {
  const texto = String(plano ?? '');
  if (/\b(valle de los chillos|capelo|riofrio|previa cita)\b/.test(texto)) return 'DIRECCION';
  if (/\b(ciudad de quito|somos de quito|estamos ubicados|envios para todo el pais|clientes a nivel nacional|servientrega|local fisico)\b/.test(texto)) return 'GENERAL';
  return null;
}
