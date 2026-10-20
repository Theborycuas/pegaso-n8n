# Etiquetas P4: mismo precio de forma y varias medidas

**Fecha:** 20 de octubre de 2026 · **Workflow:** SISTEMA AUTOMATIZADO PEGASO (`09OF22FOxihypeeh`)
**Estado:** Implementado en local (build + edit). **No** publicado en n8n.

## 1. Circular, cuadrada y troquelado

Si preguntan si cuestan lo mismo cuadradas y circulares (o rectangular / troquelado):

> Así es, desde los 5 cm para abajo se usa troquel para realizar los cortes por lo que el precio es el mismo, sea rectangular, circular o troquelado

No se deriva a humano ni se vuelve a cotizar. En la fórmula, si ambos lados son ≤ 5 cm no se suma el +1 cm por forma.

## 2. Varias medidas en el mismo turno

El debounce ya junta reenvíos seguidos. El extractor y el validador ahora leen formatos como `8cm alto x 9ancho`, `8cm de alto x 5 de ancho` y `18 de ancho x 7 de alto`, y arman **un detalle por medida**. El mensaje queda:

```
Le adjunto la cotización:

-1.000 Etiquetas adhesivas de 8x9 cm rectangulares le saldrían en $55.00 dólares
-1.000 Etiquetas adhesivas de 8x5 cm rectangulares le saldrían en $31.00 dólares
-1.000 Etiquetas adhesivas de 18x7 cm rectangulares le saldrían en $93.00 dólares
```
