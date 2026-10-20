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

## Convenciones

- Nombre del archivo: `AAAA-MM-DD-tema-corto.md`.
- Cada reporte empieza con el resultado y el estado (publicado o no), y luego explica el diagnóstico, los cambios por nodo, la verificación, los riesgos y las decisiones pendientes.
- Sin datos de clientes, teléfonos, correos, tokens ni API keys. La evidencia de ejecuciones reales se describe de forma agregada.
- Si el cambio altera un nodo, el reporte no reemplaza a [FLUJO-WORKFLOW-PEGASO.md](../FLUJO-WORKFLOW-PEGASO.md): la ficha del nodo se actualiza allí y el reporte enlaza la sección.
