# Total de varios productos de catálogo

**Fecha:** 20 de octubre de 2026 · **Workflow:** SISTEMA AUTOMATIZADO PEGASO (`09OF22FOxihypeeh`)
**Estado:** Implementado en local (build + edit). **No** publicado en n8n.

Cuando el prospecto ya vio precios y pregunta el **total** de lo pedido (por ejemplo 1000 tarjetas UV selectivo + 1000 volantes A6 a un lado), el bot **desglosa y suma** en un pedido actualizado. Si falta un dato (acabado, tamaño, caras, 500 o 1000), lo pregunta. Si el envío es a **otra ciudad fuera de Quito**, suma **$5.00 de transporte**. Quito, Sangolquí o retiro en el local: sin ese recargo.

## 1. Decisiones

| Tema | Decisión |
|---|---|
| Qué es un total | “cuánto sería el total”, “cuánto queda”, “suma”, o precio de más de un producto de catálogo |
| Datos completos | Se responde el desglose + total + `*Precios no incluyen IVA*` |
| Falta acabado (tarjetas) | Preguntar UV brillante / Mate / Mate + UV selectivo / Mate + Pan de Oro |
| Falta tamaño o caras (volantes) | Preguntar A6 o A5, y 1 o 2 lados |
| Cantidad | Por defecto 1000; mínimo 1000 del mismo diseño; millar (1000, 2000…) |
| Puntas redondeadas | Solo si las nombra: UV selectivo $45 / Pan de Oro $100 |
| Afiches / trípticos / membretadas | 500 o 1000 con precio de catálogo (ver producción rápida) |
| Falta ciudad de envío | Preguntar si es otra ciudad fuera de Quito |
| Otra ciudad (Guayaquil, Cuenca, etc.) | Línea `-Envío por Transporte $5.00 dólares` sumada al total |
| Quito / Sangolquí / retiro | Sin recargo de transporte |
| Etiquetas | No se mezclan: siguen P4 |

Precios por 1000 (mismos del catálogo):

- Tarjetas 9×5 cm: UV brillante $24 · Mate $30 · Mate + UV selectivo $40 · Mate + Pan de Oro $95
- Volantes Couche 115 gr: A6 1 lado $20 / 2 lados $26 · A5 1 lado $32 / 2 lados $41

Formato del pedido:

```
Le adjunto el detalle de su pedido actualizado:

-1000 tarjetas de presentación en acabado Mate + UV selectivo $40 dólares
-1000 volantes A6 (10.5 x 14.8 cm) a 1 lado $20 dólares
-Envío por Transporte $5.00 dólares
*Total $65.00 dólares*
```

## 2. Dónde vive

La tabla, la suma y el transporte están en **Resolver contexto comercial** (V3.17). Afiches, trípticos y hojas membretadas ya tienen fila (500 y 1000). Dípticos/brochures siguen a humano.
