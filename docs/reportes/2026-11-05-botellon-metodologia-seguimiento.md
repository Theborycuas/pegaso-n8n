# Botellón / bidón, seguimiento de metodología y ubicación

**Fecha:** 5 de noviembre de 2026 · **Workflow:** SISTEMA AUTOMATIZADO PEGASO (`09OF22FOxihypeeh`)
**Estado:** Implementado en local (build + edit). **No** publicado en n8n, sin commit ni `git push`.

---

## 1. Qué pasaba

El bot se quedaba callado en tres casos reales:

| Mensaje | Causa |
|---|---|
| "Para botellón de agua" (después del FAQ/refuerzo de medidas) | `PEDIR_MEDIDAS` + refuerzo ya enviado → `omitir_envio = MEDIDAS_YA_SOLICITADAS` |
| "Entiendo, entonces el pedido lo ingresaría el día lunes?" | Tras la imagen de metodología no había seguimiento; el anti-duplicado o un "Permítame…" dejaban el hilo colgado |
| "Puedo llamarle" / "Ayúdeme su ubicación" | Derivación a "Permítame…" y luego omisión de la misma acción |

---

## 2. Qué hace ahora

### Botella / botellón / bidón de agua

Si el prospecto nombra botella, botellón, bidón o garrafón **sin** dar medidas (y no es fajilla Tesalia/Dasani):

```
Podemos sugerirle en estas medidas.
Para botellas de 1L o de 600 ml pueden ser de dos medidas.

Las 1000 etiquetas de 12x5 cm rectangulares le saldrían en $47.00 dólares

Las 1000 etiquetas de 20x5 cm rectangulares le saldrían en $75.00 dólares

Y para bidón en las medidas de:

-1000 Etiquetas "Para Bidón 20L" en la medida de 14x8 cm en $80.00 dólares.
-1000 Etiquetas "Para Bidón 20L" en la medida 11x9 cm $75.00 dólares.
-1000 Etiquetas "Para Bidón 20L" en la medida 8x10 cm $59.00 dólares.

¿Usted tiene una medida en específico disculpe?
```

Esa sugerencia se envía una sola vez por conversación.

### Ingreso el lunes (tras metodología)

Si ya se envió la metodología de producción y preguntan si el pedido entra el lunes (u otro día de la ventana):

> Así es estimado, del lunes hasta el miércoles podemos ingresar el pedido. Le haríamos el envío el día viernes.

Y si aún falta:

- ciudad → `¿Desde qué ciudad nos escribe?`
- o diseño (si la ciudad ya se conoce o ya se preguntó) → `¿Usted ya cuenta con su diseño?`

### Ubicación / llamada

Tras un "Permítame…" o ante "dónde están / ubicación / puedo llamarle":

- Quito + envíos nacionales + pregunta de ciudad, o
- local físico (viernes 5 PM) si piden visitar / local.

---

## 3. Nodo

| Nodo | Versión | Cambio |
|---|---|---|
| Resolver contexto comercial | 3.30 → **3.31** | No omitir tras refuerzo si el turno habla de botellón/bidón; sugerencia de medidas; seguimiento metodología lunes–miércoles; ubicación/llamada sin callar. |

---

## 4. Pendiente

Publicar con `.\scripts\push.ps1` cuando se autorice. Probar: anuncio → "Para botellón de agua"; cotización + metodología → "¿ingresaría el lunes?"; "puedo llamarle" / "ubicación".
