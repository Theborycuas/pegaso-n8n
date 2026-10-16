# Confirmación de medidas grandes antes de cotizar

**Fecha:** 15 de octubre de 2026 · **Workflow:** SISTEMA AUTOMATIZADO PEGASO (`09OF22FOxihypeeh`)
**Estado:** implementado y verificado en local. **No** se publicó en n8n (`push.ps1` no se ejecutó), no hay commit ni `git push`.

Cuando el precio estimado por 1.000 etiquetas supera **$140**, el bot ya no envía la cotización de inmediato. Primero confirma con el prospecto que las medidas son correctas, porque en medidas grandes (p. ej. 20x30, 15x30, 100x100) el precio se dispara y a veces el cliente se equivoca al indicarlas.

---

## 1. Qué pasaba

El flujo cotizaba cualquier medida producible con cantidad 1.000 por defecto. Pedidos como 20x30 cm o 15x30 cm salían por encima de $160 por 1.000 etiquetas; 100x100 era absurdo. Pocos clientes pedían y confirmaban esas medidas a propósito.

## 2. Qué se cambió

### `Resolver contexto comercial` (V3.0 → V3.1): regla K

Antes de dejar pasar un `COTIZAR_P4`, estima el **precio por 1.000** con la misma lógica comercial de `Calcular precio detalle` (banda fija, 4x4, +1 por 5x5 o forma especial, factor por rango, tamaño grande > $130 → factor 0.67, `Math.ceil`).

| Situación | Resultado |
|---|---|
| Precio / 1000 ≤ $140 (p. ej. 10x10, 14x14, 5x5) | Cotiza como antes |
| Precio / 1000 > $140 y las medidas aún no están confirmadas | No cotiza. Envía confirmación y guarda `contexto_comercial.confirmacion_medidas_grandes` con `pendiente: true` |
| Prospecto confirma ("sí", "confirmo", "están bien"…) | `COTIZAR_P4` y marca `confirmadas: true` |
| Prospecto niega ("no", "me equivoqué"…) | Pide las medidas correctas y limpia la confirmación |
| Prospecto cambia a medidas chicas | Cotiza sin volver a preguntar |
| Prospecto cambia a otras medidas grandes | Vuelve a pedir confirmación de las nuevas |
| Mismas medidas ya confirmadas | Cotiza sin preguntar otra vez |

Mensaje de confirmación:

> Solo por confirmar: ¿requiere sus etiquetas de 20x30 cm? Le consulto porque son medidas grandes y el precio se calcula en base a ellas. Confírmenos por favor si esas son las medidas correctas en las que necesita sus etiquetas.

El umbral es el **precio por 1.000**, no el total del pedido. La fuente de verdad del cobro sigue siendo `Calcular precio detalle` en la ruta de cotización; la estimación solo decide si hay que confirmar.

Ficha actualizada en [FLUJO-WORKFLOW-PEGASO.md](../FLUJO-WORKFLOW-PEGASO.md) §11.

## 3. Verificación

19 casos sobre el código real, todos OK: umbral (20x30, 15x30, 100x100, 15x15 piden confirmación; 10x10, 5x5, 14x14 cotizan), confirmación, negación, respuesta vaga, corrección a medida chica o grande, y re-cotización con medidas ya confirmadas.

Regresiones anteriores (correcciones, imágenes, control conversacional, auditoría, mínimo por diseño, cierre, precios, ACTIVEBOT): todas OK. Validadores (`inject-code`, `validate-workflow` 189 nodos, `check-encoding`): OK.

## 4. Cómo activarlo

Publicar el workflow en n8n. No requiere fila nueva en `configuracion_bot`.

Probar, por ejemplo: "Necesito 1000 etiquetas de 20x30" → debe pedir confirmación; "Sí, confirmo" → cotización; "Necesito 10x10" → cotiza de una.

## 5. Riesgos

- La estimación está alineada con `Calcular precio detalle`, pero si ese nodo cambia de fórmula hay que actualizar la estimación en `Resolver contexto comercial`.
- Si el cliente confirma con un mensaje ambiguo ("ok gracias"), puede interpretarse como afirmación. Si niega y corrige en el mismo mensaje ("no, son de 10x10"), prima la corrección de medidas.
- Multi-detalle (varias medidas en un mismo pedido) no se estima por detalle: la regla mira el par ancho/alto consolidado del turno.
