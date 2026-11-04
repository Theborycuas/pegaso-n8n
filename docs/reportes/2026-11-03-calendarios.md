# Calendarios personalizados 2026

**Fecha:** 3 de noviembre de 2026 · **Workflow:** SISTEMA AUTOMATIZADO PEGASO (`09OF22FOxihypeeh`)
**Estado:** Publicado (commit `c65cdad`). **Actualización 3 nov:** imagen del catálogo con URL por defecto y texto corto (§7), en local, sin publicar ni commit.

El bot atiende y vende calendarios en tres presentaciones: de pared (A3 y A4), de escritorio y de bolsillo. Antes, "calendarios" estaba en la lista de productos que no manejamos y se derivaba a humano.

---

## 1. Catálogo

| Presentación | 200 | 500 | 1000 | Material (solo si lo preguntan) |
|---|---|---|---|---|
| De pared A3 (29 × 42 cm) | $80 | $110 | $160 | Couche 300 gr |
| De pared A4 (21 × 29.7 cm) | $65 | $85 | $110 | Couche 300 gr |
| De escritorio | $90 | $125 | $165 | Cartulina plegable .14 |
| De bolsillo (tamaño tarjeta de presentación) | — | — | $24 | Couche 300 gr |

- Precios sin IVA (misma nota que el resto del catálogo).
- Entrega y pago: igual que afiches, trípticos y hojas membretadas (2 a 3 días hábiles; la metodología de pago existente).
- Diseño: 1 propuesta con posibilidad de 5 cambios sobre lo propuesto. El cliente debe tener listo su logo, slogan, fotos e información de direcciones y contactos.

---

## 2. Cómo conversa

| Situación | Respuesta |
|---|---|
| Primer mensaje que nombra calendarios | Saludo horario (solo sesión nueva) + imagen del catálogo + lista de precios. Si ya trae tipo y cantidad ("precio de 500 calendarios de escritorio"), añade "Los 500 calendarios de escritorio le saldrían en $125.00 dólares." |
| "200 de pared A4" | "Los 200 calendarios de pared A4 (21 x 29.7 cm) le saldrían en $65.00 dólares." |
| "Cuánto me salen 500 de pared A3 y 1000 de bolsillo" | Detalle del pedido con varias líneas y la pregunta de envío ($5 fuera de Quito), como el resto del catálogo. |
| Falta un dato ("1000 calendarios de pared") | Pregunta solo lo que falta (A3 o A4, tipo o cantidad). La respuesta suelta ("A4", "500") completa el pedido. |
| Otra cantidad ("300 de escritorio") | "En calendarios de pared y de escritorio trabajamos 200, 500 o 1000 unidades; los de bolsillo, 1000 unidades. ¿De cuántas cotizamos?" |
| Material | Según el tipo: pared/bolsillo Couche 300 gr, escritorio cartulina plegable .14 (los tres si no se sabe cuál). |
| Entrega | "La entrega es de 2 a 3 días hábiles." |
| Diseño | Metodología de 1 propuesta + 5 cambios. |
| Mínimo | 200 en pared y escritorio; bolsillo 1000. |
| Anillado, plastificado, otro tamaño u otra cosa fuera del catálogo | `DERIVAR_HUMANO` ("Permítame un momento por favor, verificamos su requerimiento."). |
| "Calendario de bolsillo tipo tarjeta" | Es calendario, no abre el catálogo de tarjetas de presentación. "Calendarios y tarjetas" juntos sí es una mezcla (lo decide el cerebro). |

Agendas y libretas siguen derivándose a humano.

**Además:** la respuesta de diseño de afiches, trípticos y hojas membretadas ahora también explica la metodología (1 propuesta + 5 cambios y lo que el cliente debe tener listo). Sus precios no cambian.

---

## 3. Qué se cambió

| Pieza | Versión | Cambio |
|---|---|---|
| Preparar contexto IA | 4.18 → **4.19** | Regla pre-IA `CALENDARIOS` → `INFORMAR_CALENDARIOS`. Calendarios salen de `PRODUCTO_NO_P4`. "Tarjeta" como formato del calendario no abre tarjetas. Nuevo campo `producto_calendarios`. |
| Resolver contexto comercial | 3.23 → **3.24** | Línea `CALENDARIOS`; lista de precios + imagen `CATALOGO_CALENDARIOS`; `contexto_comercial.catalogo_calendarios` se marca aunque no haya imagen; totalizador con tipo y cantidad (varias líneas por tipo); FAQ de material, entrega, diseño, mínimo y precio por línea; metodología de diseño también en afiches, trípticos y membretadas. |
| Validar extracción Cerebro comercial / DeepSeek1 / OpenApi1 | 2.9 → **2.10** | Aceptan `INFORMAR_CALENDARIOS` y la línea `CALENDARIOS` para `RESPONDER_GENERAL` de catálogo. Las tres copias siguen idénticas. |
| Normalizar decisión IA | 2.9 → **2.10** | La ruta de calendarios no se tumba por una imagen que requiere revisión (igual que el resto del catálogo). |
| Cerebro comercial Groq / DeepSeek / OpenAI | — | Prompt §27E (calendarios); §27A/27C/27D los mencionan; enum `accion` con `INFORMAR_CALENDARIOS`. |
| Obtener configuración MODO_PRUEBA | — | La consulta lee también `CATALOGO_CALENDARIOS`. |
| Enrutar acción comercial | sin cambio | `INFORMAR_CALENDARIOS` sale por el *fallback*, que ya va a Preparar respuesta comercial. |

---

## 4. Verificación

- Funciones del totalizador con 9 frases (una o varias líneas, A3/A4/escritorio/bolsillo, "2026" no se toma como cantidad, 300 no manejado, mezcla con tarjetas) y dos conversaciones de datos faltantes ("A4", "500").
- Simulación de punta a punta (`Preparar contexto IA` → `Normalizar decisión IA` → `Resolver contexto comercial`) en 12 escenarios: primer contacto con y sin imagen configurada, con pedido incluido, bolsillo tipo tarjeta, material, diseño, entrega, línea sin palabra de precio, total con varias líneas, cantidad no manejada, fuera de catálogo y agendas (siguen a humano).
- Regresión: primer contacto de tarjetas y afiches sin cambios; diseño de afiches con la metodología añadida; links y pregunta de ciudad del cambio anterior siguen pasando.
- `inject-code`, `validate-workflow`, `prepare-update` y `check-encoding` OK. `activeVersion` no se modificó; en `edit.json` solo cambiaron 7 valores (3 prompts, 3 schemas, 1 consulta).

---

## 5. Cómo activarlo

1. Subir la imagen del catálogo de calendarios a la web (como las de afiches) y cargar su URL:

```sql
INSERT INTO pegaso.configuracion_bot (clave, valor_json, actualizado_at)
VALUES
  ('CATALOGO_CALENDARIOS', '{"activo": true, "url": "https://pegasoadhesivos.com/wp-content/uploads/AAAA/MM/<imagen-calendarios>.jpg"}'::jsonb, NOW())
ON CONFLICT (clave) DO UPDATE
SET valor_json = EXCLUDED.valor_json,
    actualizado_at = NOW();
```

   Sin esa fila el bot envía solo la lista de precios (sin imagen).
2. Publicar el workflow (`push.ps1`).
3. Probar en una conversación sin `catalogo_calendarios`: "¿Tienen calendarios?", luego "200 de pared A4", "¿de qué material es el de escritorio?" y "¿hacen el diseño?".

---

## 6. Decisiones a confirmar

- **Cantidades fuera de tabla** (100, 300, 2000…): hoy se responde con las cantidades que manejamos. Si los pedidos mayores a 1000 deben ir a humano o tener otro precio, hay que definirlo.
- **Calendario de bolsillo:** se describe como "tamaño tarjeta de presentación"; no se indica acabado.
- **Diseño:** el texto no dice si el diseño está incluido en el precio del calendario; solo explica la metodología.
- La lista de precios está en `Preparar contexto IA` y en dos puntos de `Resolver contexto comercial`: si cambia un precio, cambiar los tres (y la tabla `PRECIOS_CALENDARIOS`).

---

## 7. Actualización: imagen del catálogo y texto corto

Cuando el prospecto pregunta por calendarios por primera vez, el bot envía la imagen del catálogo y luego el texto:

```
[imagen] https://pegasoadhesivos.com/wp-content/uploads/2026/11/Artes-Calendarios_Mesa-de-trabajo-1-copia-5.png
Le adjunto los precios, modelos y cantidades
```

- Material, entrega, diseño y mínimo se responden solo cuando el cliente los pregunta (§2).
- Si el primer mensaje ya trae tipo y cantidad ("precio de 500 calendarios de escritorio"), se añade ese precio debajo.
- La URL queda como valor por defecto en `Resolver contexto comercial` (V3.26), igual que afiches, trípticos y hojas membretadas: **no hace falta** crear la fila en `configuracion_bot`. La fila `CATALOGO_CALENDARIOS` (§5) sirve para cambiar la imagen sin publicar el workflow, o para desactivarla con `"activo": false`.
- Si la imagen está desactivada, el bot envía la lista completa de precios en texto (para que el mensaje no quede sin información).
- La imagen se envía por el CDN de WordPress (`i0.wp.com`, igual que los otros catálogos): se comprobó que responde (PNG de 315 KB; el original pesa 3 MB).
- Prompt §27E de los tres cerebros: el texto del primer contacto es el corto y el resto se informa cuando lo pregunte.
