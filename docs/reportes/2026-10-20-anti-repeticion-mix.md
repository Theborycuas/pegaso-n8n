# Anti-repetición, varias medidas informales y mix etiquetas + flyers

**Fecha:** 20 de octubre de 2026 · **Workflow:** SISTEMA AUTOMATIZADO PEGASO (`09OF22FOxihypeeh`)
**Estado:** Implementado en local (build + edit). **No** publicado en n8n, sin commit ni `git push`.

En producción el bot repetía Permítame / ubicación cuando el prospecto encadenaba mensajes; no leía `14*16 / 10.2*10.2`; y un pedido de flyers A6 más tres tamaños de etiquetas terminaba en “desde 6.000” o “¿desea flyers o etiquetas?”. Este cambio cubre esos tres casos. El aviso `*Precios no incluyen IVA*` sigue solo en trabajos que no son etiquetas.

---

## 1. Decisiones

| Tema | Qué hace ahora |
|---|---|
| Mensajes seguidos | Si el último SALIENTE (últimos 20 min) ya cubrió la misma acción (ubicación, material, Permítame, catálogo), no se reenvía. “¿Tienen local físico?” después de Quito se responde corto, sin repetir el párrafo. |
| `14*16 / 10.2*10.2 y 9.5*19.6` | Tres medidas P4 (el `*` cuenta como `x`). |
| `Son 2 tamaños 1 es de 13 x 7 y la otra es d 7 x 4` | Dos medidas P4; si también preguntan material, se cotiza (no se queda solo en la FAQ). |
| Flyers + etiquetas en el mismo hilo | Cotiza etiquetas P4 por un lado y volantes por el otro. No pregunta “¿flyers o etiquetas?”. No manda a humano por sumar 1000+1000+… hasta 6000. |
| IVA | Solo en el bloque de catálogo (flyers, tarjetas, afiches, trípticos, membretadas). Las líneas de etiquetas adhesivas no llevan IVA. |
| Mayorista ≥ 6000 | Solo si esa cantidad está **escrita** en el mensaje (o no es texto puro y no hay flyers). “4 cosas diferentes” + 1000 no es 6000. |

---

## 2. Qué se cambió

| Nodo | Versión | Cambio |
|---|---|---|
| Preparar contexto IA | 4.14 → **4.15** | Detecta flyers/tarjetas/afiches aunque el turno nombre etiquetas. No salta a `INFORMAR_*` en mix. `accion_equivalente` también cubre Permítame, Quito y material. |
| Validar extracción Groq / DeepSeek / OpenAI | 2.3 → **2.4** | `*` y `×` → `x`. Completa todas las medidas del texto. Omite A6/A5 (10.5×14.8, 14.8×21) si el texto habla de flyers. |
| Resolver contexto comercial | 3.17 → **3.18** | Pares de medida del turno; mix `CATALOGO_MIXTO`; anexo de flyers; anti-repetición por acción; ≥ 6000 solo si está escrito. |
| Preparar respuesta comercial | 2.3 → **2.4** | Omite parafrasis: dos Permítame distintos, o dos textos de Quito. |
| Preparar mensaje cotización | 2.9 → **2.10** | Si viene `anexo_catalogo_mixto`, lo pega después de las etiquetas (con IVA solo ahí). |

---

## 3. Cómo se ve

Etiquetas varias medidas:

```
Le adjunto la cotización:

-1.000 Etiquetas adhesivas de 14x16 cm rectangulares le saldrían en $… dólares
-1.000 Etiquetas adhesivas de 10.2x10.2 cm rectangulares le saldrían en $… dólares
-1.000 Etiquetas adhesivas de 9.5x19.6 cm rectangulares le saldrían en $… dólares
```

Mix flyers A6 1000 + etiquetas (sin caras de volante):

```
Le adjunto la cotización:

-1.000 Etiquetas adhesivas de 13x16 cm …
…

Volantes / flyers (1000 unidades) A6 (10.5 x 14.8 cm):
• 1 lado: $20
• 2 lados: $26

*Precios no incluyen IVA*
```

Si en ese turno aún no hay medidas de etiqueta, se envía el bloque de volantes y se pide ancho y alto solo para las adhesivas.

---

## 4. Riesgos

- Dos ejecuciones **en paralelo** (las dos leen el mismo último SALIENTE antes de guardar) aún pueden duplicar. El debounce de 3 s y omitir al segundo mensaje mitigan el caso habitual.
- Un 6000 escrito como “6 mil” en palabras sigue yendo a humano si la IA lo extrae y el turno no es de catálogo.
- Dípticos / brochures siguen a humano.
- Tras el catálogo de flyers, si eligen A5/A6 y caras se cotiza esa línea en texto (resolver 3.19); no se reenvía la imagen.
