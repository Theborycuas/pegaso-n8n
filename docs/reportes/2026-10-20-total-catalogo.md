# Total de varios productos de catálogo

**Fecha:** 20 de octubre de 2026 · **Workflow:** SISTEMA AUTOMATIZADO PEGASO (`09OF22FOxihypeeh`)
**Estado:** Implementado en local (build + edit). **No** publicado en n8n.

Cuando el prospecto ya vio precios y pregunta el **total** de lo pedido (por ejemplo 1000 tarjetas UV selectivo + 1000 volantes A6 a un lado), el bot **desglosa y suma**. No reenvía videos ni la foto de flyers.

## 1. Decisiones

| Tema | Decisión |
|---|---|
| Qué es un total | “cuánto sería el total”, “cuánto queda”, “suma”, o precio de más de un producto de catálogo |
| Datos completos | Se responde el desglose + total + `*Precios no incluyen IVA*` |
| Falta acabado (tarjetas) | Preguntar UV brillante / Mate / Mate + UV selectivo / Mate + Pan de Oro |
| Falta tamaño o caras (volantes) | Preguntar A6 o A5, y 1 o 2 lados |
| Cantidad | Por defecto 1000; mínimo 1000 del mismo diseño; millar (1000, 2000…) |
| Puntas redondeadas | Solo si las nombra: UV selectivo $45 / Pan de Oro $100 |
| Afiches u otro sin precio | Siguen a humano hasta tener fila en la tabla |
| Etiquetas | No se mezclan: siguen P4 |

Precios por 1000 (mismos del catálogo):

- Tarjetas 9×5 cm: UV brillante $24 · Mate $30 · Mate + UV selectivo $40 · Mate + Pan de Oro $95
- Volantes Couche 115 gr: A6 1 lado $20 / 2 lados $26 · A5 1 lado $32 / 2 lados $41

Ejemplo del hilo: 1000 tarjetas Mate + UV selectivo ($40) + 1000 volantes A6 1 lado ($20) → **Total $60**.

## 2. Dónde vive

La tabla y la suma están en **Resolver contexto comercial** (no en la IA). Para agregar afiches u otro producto más adelante: fila de precio + opciones requeridas; si no hay precio, no se inventa.
