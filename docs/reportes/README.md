# Reportes de cambios

Un reporte por intervención sobre el workflow **SISTEMA AUTOMATIZADO PEGASO**: qué se cambió, cómo y por qué, con la evidencia de verificación. Sirve para revisar un cambio antes de publicarlo en n8n y para entender después por qué el flujo se comporta como lo hace.

## Reportes

| Fecha | Reporte | Estado |
|---|---|---|
| 2026-10-13 | [Control conversacional determinístico: saludos, humanos, ecos, fechas y productos no P4](2026-10-13-control-conversacional.md) | Implementado en local, sin publicar en n8n ni commit |
| 2026-10-13 | [Auditoría funcional final antes de publicar: intervención humana, clientes y concurrencia](2026-10-13-auditoria-final-pre-push.md) | Solo análisis y pruebas; veredicto: listo para push con riesgos conocidos |
| 2026-10-13 | [Cierre de cotizaciones repetidas: "comparando alternativas" una sola vez](2026-10-13-cierre-cotizaciones-repetidas.md) | Implementado en local, sin publicar en n8n ni commit |
| 2026-10-13 | [Mínimo por diseño: no se reparte la cantidad entre diseños y no se deriva](2026-10-13-minimo-por-diseno.md) | Implementado en local, sin publicar en n8n ni commit |
| 2026-10-13 | [Comando ACTIVEBOT: reactivar el bot para un prospecto derivado a humano](2026-10-13-comando-activebot.md) | Implementado en local, sin publicar en n8n ni commit |
| 2026-10-13 | [Diseño sin creación de marca, no recotizar sin contexto y respuestas rápidas de anuncios](2026-10-13-diseno-recotizacion-ecos-anuncio.md) | Implementado en local, sin publicar en n8n ni commit |
| 2026-10-15 | [Imágenes informativas: material y metodología de producción](2026-10-15-foto-material.md) | Primera versión (material) publicada; imagen antes del texto y metodología en local, sin publicar ni commit; requiere crear `IMAGEN_METODOLOGIA` en `configuracion_bot` |
| 2026-10-15 | [Confirmación de medidas grandes antes de cotizar](2026-10-15-confirmacion-medidas-grandes.md) | Implementado en local, sin publicar en n8n ni commit |
| 2026-10-15 | [Tras la publicidad que pide medidas: acotar, no callar](2026-10-15-medidas-ya-solicitadas-no-callar.md) | Implementado en local, sin publicar en n8n ni commit |
| 2026-10-15 | [Datos bancarios por imagen y handoff solo con comprobante](2026-10-15-datos-pago-comprobante.md) | Implementado en local, sin publicar ni commit; requiere crear `IMAGEN_DATOS_PAGO` en `configuracion_bot` |
| 2026-10-15 | [Recotización por cantidad (no negociar)](2026-10-15-recotizacion-por-cantidad.md) | Implementado en local, sin publicar ni commit |
| 2026-10-19 | [Tarjetas de presentación: catálogo de acabados con videos](2026-10-19-tarjetas-presentacion.md) | Implementado en local, sin publicar ni commit |
| 2026-10-20 | [Volantes / flyers: imagen de catálogo y precios](2026-10-20-flyers-volantes.md) | Implementado en local, sin publicar ni commit |
| 2026-10-20 | [Producción rápida: afiches, trípticos y hojas membretadas](2026-10-20-produccion-rapida.md) | Implementado en local, sin publicar ni commit |
| 2026-10-20 | [Forma P4 y varias medidas](2026-10-20-forma-y-varias-medidas.md) | Implementado en local, sin publicar ni commit |
| 2026-10-20 | [Total de catálogo y envío $5](2026-10-20-total-catalogo.md) | Implementado en local, sin publicar ni commit |
| 2026-10-20 | [Anti-repetición, medidas con * y mix etiquetas + flyers](2026-10-20-anti-repeticion-mix.md) | Implementado en local, sin publicar ni commit |
| 2026-10-21 | [Auto-reply, cierre, archivos con medidas e interpretación de imagen](2026-10-21-auto-cierre-archivo-imagen.md) | Implementado en local, sin publicar ni commit |
| 2026-11-03 | [Links del cliente y pregunta de ciudad tras la cotización](2026-11-03-enlaces-y-ciudad-tras-cotizacion.md) | Implementado en local, sin publicar ni commit |
| 2026-11-03 | [Calendarios personalizados 2026](2026-11-03-calendarios.md) | Publicado (commits `c65cdad` y `a10742a`, imagen por defecto §7) |
| 2026-11-03 | [Diseño de etiqueta recibido: cierre sin derivar, y fajillas](2026-11-03-diseno-recibido-etiquetas.md) | Publicado (commit `47fdfdb`); `IMAGEN_TRABAJOS` opcional en `configuracion_bot` |
| 2026-11-04 | [Calendarios sin pedir medidas, misma medida en varios diseños y pregunta por el logo](2026-11-04-calendarios-disenos-logo.md) | Publicado (commit `a4130f6`) |
| 2026-11-04 | [IVA y envío, y no quedarse callado ante una pregunta](2026-11-04-iva-envio-no-callar.md) | Publicado (commit `adb414c`) |
| 2026-11-04 | [Libretas personalizadas A5](2026-11-04-libretas.md) | Publicado (commit `3f7f5f7`) |
| 2026-11-04 | [Troquel por lado menor a 5 cm](2026-11-04-troquel-lado-menor-5cm.md) | Implementado en local, sin publicar ni commit |
| 2026-11-05 | [Botellón / bidón, seguimiento de metodología y ubicación](2026-11-05-botellon-metodologia-seguimiento.md) | Implementado en local, sin publicar ni commit |
| 2026-11-05 | [Imágenes y documentos sin congelar ni derivar](2026-11-05-imagenes-sin-congelar.md) | Implementado en local, sin publicar ni commit |
| 2026-11-15 | [FAQ pre-IA desde historial real (sin Redis)](2026-11-15-faq-pre-ia.md) | Implementado en local, sin publicar ni commit |
| 2026-11-15 | [STATUSIA, logging de IA, Groq TPM y vasos/oz](2026-11-15-statusia-logging-vasos.md) | Implementado en local; requiere `schema/ia_llamadas.sql` antes de publicar |
| 2026-11-16 | [Primera entrega de preventa y cierre al humano](2026-11-16-preventa-cierre-humano.md) | Publicado (presente en la copia remota del 17-11) |
| 2026-11-17 | [Segunda entrega: eficiencia, modularización y avisos persistentes](2026-11-17-preventa-eficiencia-avisos.md) | Publicado |
| 2026-11-17 | [Ubicación y consumo de todas las IA](2026-11-17-ubicacion-y-consumo-ia.md) | Implementado en local; requiere `schema/ia_llamadas.sql` y credencial de la API de n8n |
| 2026-11-17 | [Insistencia a leads de anuncio · Sprint 1: base de datos y respuestas de botón](2026-11-17-insistencia-leads-sprint1.md) | Implementado en local, sin publicar ni commit; requiere `schema/seguimientos-leads.sql` antes de publicar |
| 2026-11-17 | [Insistencia a leads de anuncio · Sprint 2: rutina programada, respuesta del cliente y estados de entrega](2026-11-17-insistencia-leads-sprint2.md) | Implementado en local, sin publicar ni commit; requiere `schema/seguimientos-leads.sql`; la rutina nace apagada (`INSISTENCIA_LEADS`) |
| 2026-11-17 | [Insistencia a leads de anuncio · Sprint 3: purga a 180 días](2026-11-17-insistencia-leads-sprint3.md) | Implementado en local, sin publicar ni commit; requiere `schema/purga-leads.sql`; nace apagada y en simulación (`PURGA_DATOS_LEADS`) |
| 2026-11-17 | [Galería de trabajos: a pedido, por material y con la cotización](2026-11-17-galeria-trabajos.md) | V3.37 publicada; V3.38 (sin galería tras cireles o ciudad) en local, sin publicar ni commit. Se activa con la fila `GALERIA_TRABAJOS` de `configuracion_bot` |

## Convenciones

- Nombre del archivo: `AAAA-MM-DD-tema-corto.md`.
- Cada reporte empieza con el resultado y el estado (publicado o no), y luego explica el diagnóstico, los cambios por nodo, la verificación, los riesgos y las decisiones pendientes.
- Sin datos de clientes, teléfonos, correos, tokens ni API keys. La evidencia de ejecuciones reales se describe de forma agregada.
- Si el cambio altera un nodo, el reporte no reemplaza a [FLUJO-WORKFLOW-PEGASO.md](../FLUJO-WORKFLOW-PEGASO.md): la ficha del nodo se actualiza allí y el reporte enlaza la sección.
