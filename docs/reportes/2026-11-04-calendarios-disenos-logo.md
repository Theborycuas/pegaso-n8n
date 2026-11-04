# Calendarios sin pedir medidas, misma medida en varios diseños y pregunta por el logo

**Fecha:** 4 de noviembre de 2026 · **Workflow:** SISTEMA AUTOMATIZADO PEGASO (`09OF22FOxihypeeh`)
**Estado:** Publicado (commit `a4130f6`).

---

## 1. Calendarios: se pidió ancho y alto y el texto llegó antes que la imagen

**Qué pasó:** el prospecto escribió "Buenos dias"; WhatsApp Business respondió el saludo automático ("¿Cuál es su requerimiento?") y el bot añadió "Para enviarle el precio indíquenos… el ancho y el alto de sus etiquetas". Ese refuerzo salió por el "Buenos dias", no por la pregunta de calendarios, que se respondió en el turno siguiente con la imagen. Además, el texto "Le adjunto los precios…" se vio antes que la imagen.

**Corrección:**

| Tema | Ahora |
|---|---|
| Refuerzo de medidas tras una automatización | Solo con contexto de etiquetas: lead de anuncio, línea ETIQUETAS, cotización vigente o una automatización de medidas o material. Un "Buenos días" orgánico tras el saludo automático no se responde (ya se preguntó el requerimiento). |
| Texto de calendarios | "Le adjunto los precios, modelos y cantidades. Revísele por favor y si tiene alguna duda coméntenos para ayudarle." |
| Orden imagen → texto | La espera "Esperar antes del texto" sube de 3 a 7 segundos (WhatsApp tarda en procesar una imagen descargada desde URL). Aplica a todas las imágenes de catálogo e informativas. |

---

## 2. Misma medida en varios diseños

**Qué pasó:** "Quiero que me cotice 3000 etiquetas, son 3 modelos diferentes, 1000 de cada una de 14x7 cm" se cotizó como 3 líneas de 1.000 a $74.

**Corrección (en `Aplicar mínimo de impresión`, antes del precio):**

| Caso | Cotización |
|---|---|
| Misma medida y forma, el cliente habla de varios diseños ("3 modelos", "diferentes", "1000 de cada una") | Una línea con la cantidad total: "-3.000 Etiquetas adhesivas de 14x7 cm rectangulares (3 diseños de 1.000 cada uno) le saldrían en $197.00 dólares" (antes 3 × $74 = $222). |
| Misma medida repetida sin hablar de diseños (reenvío) | Una sola línea, sin sumar. |
| Medidas diferentes | Una línea por medida, como antes. Si hay dos diseños de 10x5 y uno de 5x5, salen 2.000 de 10x5 y 1.000 de 5x5. |

---

## 3. Etiquetas de más de $70: preguntar por el logo

**Qué pasó:** con una cotización de $129 el cliente preguntó "¿Ya incluye la publicidad en etiquetas?" y el bot derivó a humano; el asesor preguntó "¿Usted cuenta con su logo?".

**Corrección:** con una cotización de etiquetas de más de $70, si pregunta si incluye o si le hacen el diseño (o "la publicidad"):

1. "¿Usted cuenta con su logo disculpe?"
2. **Sí** →

   > Le comento cómo es nuestra metodología de trabajo.
   > Si no cuenta con el diseño nosotros le enviamos una propuesta de diseño con los requerimientos que usted solicite, con la opción a 5 cambios en base al diseño enviado.
   >
   > Para ingresar su pedido e iniciar con su diseño solicitamos que nos ayude con el 50% de abono del valor acordado.
   > Una vez listo el trabajo le adjuntamos fotos y videos de evidencia para que nos ayude con el saldo del 50%. Y poder adjuntarle la guía.

   Si después envía su logo, pasa al asesor (igual que el archivo final del flujo de diseño).
3. **No** → texto de "No creamos logos ni marcas…" (CASO E del prompt).

Con $70 o menos sigue la respuesta del cerebro (§27, CASOS A y B). Solo etiquetas; no aplica a tarjetas, flyers, afiches, trípticos, membretadas ni calendarios.

---

## 4. Qué se cambió

| Pieza | Versión | Cambio |
|---|---|---|
| Resolver contexto comercial | 3.26 → **3.27** | Refuerzo de medidas solo con contexto de etiquetas; texto de calendarios; pregunta por el logo (`diseno_recibido.paso` = `ESPERA_LOGO` / `METODOLOGIA_ENVIADA` / `SIN_LOGO`). |
| Aplicar mínimo de impresión | 2.4 → **2.5** | Une detalles con la misma medida si hay varios diseños; expone `fusion_disenos`. |
| Preparar mensaje cotización | 2.12 → **2.13** | Anota "(N diseños de X cada uno)" en la línea unida. |
| Esperar antes del texto (Wait) | — | 3 → 7 segundos. |
| Cerebro comercial ×3 (prompt) | — | §27E con el texto nuevo de calendarios; §27F con la regla del logo para cotizaciones > $70. |

---

## 5. Verificación

- Simulación de punta a punta: "Buenos dias" orgánico tras el saludo automático (no se envía nada) y luego "Quisiera saber el costo de los calendarios" (imagen + texto nuevo).
- Logo: $129 + "¿Ya incluye la publicidad en etiquetas?" (con la IA derivando) → pregunta por el logo → "Si" → metodología → llega el logo → asesor. $129 + "No tengo logo" → no creamos logos. $53 → responde el cerebro.
- Unión de detalles: 3 modelos de 1000 de 14x7 → 3.000 ($197 con `Calcular precio detalle`); reenvío 10x5 + 10x5 → una línea de 1.000; mezcla de medidas → una línea por medida.
- Regresión: diseño recibido, fajillas, calendarios, links y pregunta de ciudad sin cambios. `inject-code`, `validate-workflow`, `prepare-update`, `check-encoding` OK.

---

## 6. A confirmar

- La espera de 7 s reduce el riesgo, pero WhatsApp no garantiza el orden; si vuelve a pasar, la alternativa es enviar el texto como pie de la imagen (cambio estructural en la salida).
- La pregunta por el logo usa el total de la última cotización (`contexto_comercial.cotizacion.total`); con varias líneas es la suma.
