function construirContextoModelo({ mensaje, contexto = {}, historial = [], ultimoSaliente,
  media = {}, sesionNueva = false, esCliente = false, nombre = null }) {
  const limitar = (valor, maximo) => String(valor ?? '').slice(0, maximo);
  // Lista explícita de hechos comerciales. Las URLs y archivos permanecen en el flujo.
  const cotizacion = contexto.cotizacion ?? {};
  const diseno = contexto.diseno_recibido ?? {};
  const memoria = {
    producto_linea: contexto.producto_linea,
    ubicacion: contexto.ubicacion,
    cotizacion: Object.fromEntries([
      'cotizacion_id', 'estado', 'producto', 'material', 'cantidad_solicitada',
      'cantidad_cotizable', 'ancho_cm', 'alto_cm', 'forma', 'total', 'cantidad_detalles'
    ].filter(key => cotizacion[key] !== undefined).map(key => [key, cotizacion[key]])),
    pedido_catalogo: contexto.pedido_catalogo,
    editable: contexto.editable,
    diseno_recibido: {
      tipo: diseno.tipo, clase: diseno.clase, paso: diseno.paso,
      recibido: Boolean(diseno.recibido_at)
    },
    confirmacion_medidas_grandes: contexto.confirmacion_medidas_grandes,
    confirmacion_lista_medidas: contexto.confirmacion_lista_medidas,
    fecha_deseada_cliente: contexto.fecha_deseada_cliente,
    ultimo_turno: contexto.ultimo_turno
  };
  const contextoCompacto = JSON.stringify(memoria);
  // Una propuesta extraordinariamente grande requiere contexto completo para interpretarse.
  // Se indica su presencia y se deja la revisión al encargado, conservando los datos en DB.
  const memoriaModelo = contextoCompacto.length <= 5000 ? memoria : {
    producto_linea: memoria.producto_linea, cotizacion: memoria.cotizacion,
    editable: memoria.editable, contexto_extenso_requiere_humano: true
  };
  return {
    es_cliente: esCliente, nombre: limitar(nombre, 80), sesion_nueva: sesionNueva,
    mensaje: limitar(mensaje, 8000), mensaje_truncado: String(mensaje ?? '').length > 8000,
    memoria: memoriaModelo, ultimo_saliente: limitar(ultimoSaliente, 1000),
    historial: historial.slice(-6).map(item => ({
      direccion: item.direccion, contenido: limitar(item.contenido, 450)
    })),
    media: {
      comprobante_detectado: media.comprobante_detectado,
      requiere_revision_humana: media.requiere_revision_humana,
      motivo_derivacion: media.motivo_derivacion,
      medidas_imagen: media.medidas_imagen,
      imagenes_clasificacion: media.imagenes_clasificacion,
      audios_transcritos: media.audios_transcritos
    }
  };
}
