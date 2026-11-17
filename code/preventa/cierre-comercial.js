function normalizarPreventa(valor) {
  return String(valor ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[¿?¡!.,;:]/g, ' ').replace(/\s+/g, ' ').trim();
}

function resolverCompraPreventa({ mensaje, ultimoSaliente, cotizacion = {}, catalogo = {},
  modificoDatos = false, sesionNueva = false, mensajeExternoId = null }) {
  const texto = normalizarPreventa(mensaje);
  const dudas = texto
    .replace(/\bno hay (ningun |ninguna )?(problemas?|inconvenientes?)\b/g, '')
    .replace(/\bno (tengo|cuento con|dispongo de) (el |un )?(editable|archivo editable|diseno original)\b/g, '');
  const pospone = /\b(no|todavia no|aun no|despues|luego|quizas|tal vez|talvez)\b|\b(solo|solamente) (estoy |quiero )?(viendo|cotizando|consultando|preguntando)\b|\b(si (compro|pido|hago|hiciera)|cuanto cuesta|como (hago|puedo)|que precio|antes de)\b/.test(dudas);
  const cotizacionValida = cotizacion.estado === 'COTIZADA' && Number(cotizacion.cotizacion_id) > 0;
  const catalogoValido = catalogo.estado === 'TOTAL' && catalogo.total !== null && Number.isFinite(Number(catalogo.total));
  const hayPropuesta = cotizacionValida || catalogoValido;
  // Pedido o compra expresados como decisión. Válidos aunque falte la propuesta.
  const decidePedido = /\b(hagamosl[ao]s?|hagal[ao]s?|agale|proceda|deme haciendo|me d[ae] haciendo|quiero comprar|quiero (hacer|realizar|confirmar|coordinar) (el |mi |un |ese |este )?(pedido|compra)|quiero coordinar para poderl[ao]s hacer|necesito (hacer|realizar|confirmar) (el |mi |un )?pedido|confirmo (el |mi )?pedido|avancemos|sigamos con (el|mi) pedido)\b/.test(texto);
  // «Quiero hacer etiquetas» abre una consulta de anuncio. Solo decide si ya existe una propuesta.
  const eligeProducto = hayPropuesta &&
    /\b(quiero|necesito) (hacer|realizar|mandar a hacer) (las |los |estas |esas |mis )(etiquetas|adhesivos|tarjetas|volantes|flyers|calendarios|libretas|trabajo)\b/.test(texto);
  const pideCuenta = /\b(pas[ae](me)?|envie(me)?|ayud[ae](me)?|necesito|deme)\b.{0,65}\b(cuenta|datos bancarios|datos para (la )?transferencia)\b/.test(texto);
  const anunciaAbono = /\b(ya|manana|hoy|ahorita)\b.{0,35}\b(le )?(deposito|transfiero|hago (el |la )?(pago|abono)|realizo (el )?abono)\b/.test(texto);
  const confirmaBreve = /^(si( por favor)?|de acuerdo|esta bien|ok( esta bien)?|listo|perfecto|correcto)$/.test(texto);
  const preguntaCompra = /\b(desea|quiere|gustaria)\b.{0,45}\b(avanzar|avancemos|continuar|continuemos|realizar|confirmar|proceder)\b.{0,30}\b(pedido|compra)\b|\b(esta de acuerdo|me confirma)\b.{0,45}\b(cotizacion|pedido|compra)\b/.test(normalizarPreventa(ultimoSaliente));
  if (pospone || !(decidePedido || eligeProducto || pideCuenta || anunciaAbono ||
    (confirmaBreve && preguntaCompra && !sesionNueva))) {
    return null;
  }
  const cambioPendiente = modificoDatos || /\b(pero|cambiar|cambie|otra medida|otro tamano)\b/.test(texto);
  const vuelveACotizacion = /\b(cotiz\w*|lo de ayer|las mismas|el mismo pedido|ese pedido)\b/.test(texto);
  const aceptada = hayPropuesta && !cambioPendiente && (!sesionNueva || vuelveACotizacion);
  return {
    tipo: aceptada ? 'CIERRE_COMERCIAL_ACEPTADO' : 'INTERES_FIRME_PARA_COORDINAR',
    cotizacion_id: cotizacionValida ? cotizacion.cotizacion_id : null,
    propuesta: cotizacionValida ? { ...cotizacion } : null,
    pedido_catalogo: catalogoValido ? catalogo : null,
    cambio_pendiente: cambioPendiente,
    mensaje_cliente: String(mensaje ?? '').trim(), mensaje_externo_id: mensajeExternoId,
    registrado_at: new Date().toISOString()
  };
}
