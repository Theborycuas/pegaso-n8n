# Reportes de cambios

Un reporte por intervención sobre el workflow **SISTEMA AUTOMATIZADO PEGASO**: qué se cambió, cómo y por qué, con la evidencia de verificación. Sirve para revisar un cambio antes de publicarlo en n8n y para entender después por qué el flujo se comporta como lo hace.

## Reportes

| Fecha | Reporte | Estado |
|---|---|---|
| 2026-10-13 | [Control conversacional determinístico: saludos, humanos, ecos, fechas y productos no P4](2026-10-13-control-conversacional.md) | Implementado en local, sin publicar en n8n ni commit |
| 2026-10-13 | [Auditoría funcional final antes de publicar: intervención humana, clientes y concurrencia](2026-10-13-auditoria-final-pre-push.md) | Solo análisis y pruebas; veredicto: listo para push con riesgos conocidos |

## Convenciones

- Nombre del archivo: `AAAA-MM-DD-tema-corto.md`.
- Cada reporte empieza con el resultado y el estado (publicado o no), y luego explica el diagnóstico, los cambios por nodo, la verificación, los riesgos y las decisiones pendientes.
- Sin datos de clientes, teléfonos, correos, tokens ni API keys. La evidencia de ejecuciones reales se describe de forma agregada.
- Si el cambio altera un nodo, el reporte no reemplaza a [FLUJO-WORKFLOW-PEGASO.md](../FLUJO-WORKFLOW-PEGASO.md): la ficha del nodo se actualiza allí y el reporte enlaza la sección.
