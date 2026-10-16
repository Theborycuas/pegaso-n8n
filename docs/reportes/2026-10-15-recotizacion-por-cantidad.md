# Recotización por cantidad (no negociar)

**Fecha:** 15 de octubre de 2026 · **Workflow:** SISTEMA AUTOMATIZADO PEGASO  
**Estado:** implementado y verificado en local. Sin publicar ni commit.

## Qué pasaba

Tras cotizar 1.000 etiquetas:

- “Y si hago 10.000 en cuanto me queda?” → handoff genérico (correcto en fondo: ≥ 6.000 no tiene precio automático).
- “Si envío a hacer 5000 baja el precios?” → mismo handoff de **negociación**, en lugar de recotizar.

La IA interpretaba “baja el precio” como `NEGOCIAR`, no como cambio de cantidad.

## Rangos que sí existen

| Cantidad | Comportamiento |
|---|---|
| 1.000–2.000 | Precio automático (factor 0.75) |
| 3.000–5.000 | Precio automático mejor (factor 0.67) |
| ≥ 6.000 | Sin precio automático → `DERIVAR_HUMANO` / `COTIZACION_ESPECIAL` |

No hay un “catálogo” de precios fijos por cantidad aparte de esos factores en `Calcular precio detalle`.

## Qué se cambió

- Prompt §15 y NEGOCIAR: ejemplos de “con 5000 baja…” / “en cuanto con 10000”; no usar NEGOCIAR si trae cantidad concreta.
- `Resolver contexto comercial` V3.4: convierte negociación+cantidad nueva en `COTIZAR_P4` (&lt; 6000) o mayorista (≥ 6000); rescata cantidad ≥ 1000 del texto si la IA no la extrajo.
- Cotización V2.9: prefijo “Así es, el precio se calcula en base a las medidas y cantidades.” al recotizar por cantidad.
- Transición humano: mensaje claro para cantidades desde 6.000.

## Verificación

`%TEMP%/pegaso-tests/recotizacion-cantidad.mjs`: todas OK. inject / validate / encoding: OK.
