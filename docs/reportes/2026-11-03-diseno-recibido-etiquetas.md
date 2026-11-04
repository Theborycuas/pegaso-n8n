# Diseño de etiqueta recibido: cierre sin derivar, y fajillas

**Fecha:** 3 de noviembre de 2026 · **Workflow:** SISTEMA AUTOMATIZADO PEGASO (`09OF22FOxihypeeh`)
**Estado:** Implementado en local (código + `edit.json`, validadores OK). **No** publicado en n8n, sin commit ni `git push`. La imagen de trabajos realizados es opcional (§5).

Cuando el prospecto enviaba su diseño, el bot derivaba a humano ("Permítame un momento por favor, ya revisamos…") y la conversación quedaba detenida hasta que el asesor preguntaba si tenía el diseño original editable y seguía con el cierre. Ahora el bot sigue ese mismo cierre.

---

## 1. Diagnóstico

| Entrada | Por qué derivaba |
|---|---|
| Imagen del diseño | El resolver no tenía respuesta para "diseño recibido con cotización vigente"; decidía la IA y, por el prompt (CASO D, `revision=SI`), derivaba. |
| PDF / AI / CDR | Llega como `[ARCHIVO NO PROCESABLE · tipo=DOCUMENTO]`; `Normalizar decisión IA` lo derivaba (`ARCHIVO_NO_PROCESABLE`) salvo que el nombre trajera medidas. |
| Link de Canva / Drive | El prompt (§28.0 del cambio anterior) pedía derivar con `ARCHIVO_DISENO`. |
| Imagen en conversación de afiches | El resumen del análisis ("contenido=ETIQUETA_O_DISENO") contiene "etiqueta": el sistema creía que el cliente nombró etiquetas y mezclaba reglas (o derivaba por "fuera de catálogo"). |

---

## 2. Cómo conversa ahora (solo etiquetas adhesivas)

Una pregunta por mensaje, sin presionar:

| Momento | Respuesta del bot |
|---|---|
| Diseño sin medidas | "Recibimos su archivo, muchas gracias. Para cotizarle indíquenos por favor el ancho y el alto de sus etiquetas en centímetros." |
| Diseño con cotización, ciudad desconocida | "Mientras revisamos su diseño, indíquenos por favor: ¿desde qué ciudad nos escribe?" |
| Diseño con cotización, ciudad conocida | "Mientras revisamos su diseño, le comentamos que trabajamos con Polipropileno, el mejor material adhesivo: resiste refrigeración, congelación y humedad. ¿Usted cuenta con el diseño original editable disculpe?" (sin la frase del material si ya se informó) |
| Responde la ciudad | "Nosotros somos de Quito y realizamos envíos a todo el país 🇪🇨🚛. ¿Usted cuenta con el diseño original editable disculpe?" (Quito: "Perfecto, nosotros también estamos en Quito. …") |
| "No" (no tiene editable) | "Si en el diseño no hay ningún cambio, podemos rediseñarlo para la impresión y sacarlo en alta definición, sin que se pixele." + metodología de pedido (50% / 50%) + "Le adjunto algunos de nuestros trabajos." con imagen, si está configurada |
| "Sí" | "Perfecto, adjúntenos por favor el archivo original editable (PDF, AI o CDR) para revisarlo." + metodología |
| Envía el editable mientras se espera la respuesta | "Recibimos su archivo, muchas gracias." + metodología |
| Envía el archivo después de la metodología | Pasa a humano (`ARCHIVO_DISENO`): "Permítame un momento por favor, ya revisamos el archivo que nos envió." El asesor revisa el archivo y cierra. |
| La IA o la cotización iban a pedir "Adjúntenos su diseño…" pero ya llegó | Se reemplaza por la pregunta del editable (o se quita si ya se hizo). |

Qué cuenta como diseño: imagen clasificada como diseño, logo o referencia; imagen que el análisis no pudo interpretar; documento PDF, AI, CDR, EPS, PSD, SVG, PNG, JPG o ZIP; link de Canva, Figma, Adobe, Drive, Dropbox, WeTransfer, OneDrive o MEGA.

No cambia: comprobante de pago (sigue a humano), foto del envase, medidas escritas, boceto, reclamo, llamada, negociación, cantidad ≥ 6000.

**Otros productos:** en tarjetas, flyers, afiches, trípticos, hojas membretadas y calendarios este flujo no se activa; cada uno sigue su propia regla de diseño. Por ejemplo, una imagen en una conversación de afiches recibe la regla de diseño de afiches ($90 con diseño listo / $100 con diseño + metodología).

**Fajillas:** "¿Trabajan con fajillas?", "¿son como las de Tesalia / Dasani?" → "No trabajamos con fajillas plásticas. Trabajamos con etiquetas 100% adhesivas." (y pide medidas si aún no las tiene).

---

## 3. Qué se cambió

| Pieza | Versión | Cambio |
|---|---|---|
| Preparar contexto IA | 4.19 → **4.20** | Nuevo campo `diseno_recibido_turno` (`IMAGEN` / `ARCHIVO` / `ENLACE`), solo en conversaciones de etiquetas. La mención de etiquetas se mide en las palabras del cliente. |
| Normalizar decisión IA | 2.10 → **2.11** | No deriva por imagen/archivo "que requiere revisión" si es un diseño de etiqueta recibido. |
| Resolver contexto comercial | 3.24 → **3.25** | Flujo de diseño recibido (estado `contexto_comercial.diseno_recibido.paso`), regla de fajillas, imagen `IMAGEN_TRABAJOS`, no volver a pedir el diseño. La línea ETIQUETAS y el "fuera de catálogo" de los productos de catálogo usan solo el texto del cliente; el veredicto de imagen con textos de etiquetas solo aplica en etiquetas. |
| Preparar mensaje cotización | 2.11 → **2.12** | Si el diseño ya llegó y la ciudad se conoce, la primera cotización cierra con la pregunta del editable. |
| Cerebro comercial ×3 (prompt) | — | §27F (diseño de etiqueta recibido, solo etiquetas); CASO D y §28 aclaran que recibir el diseño no es revisión gráfica; §28.0 los links de diseño ya no derivan; §18 fajillas. |
| Obtener configuración MODO_PRUEBA | — | Lee también `IMAGEN_TRABAJOS`. |

---

## 4. Verificación

- Simulación de punta a punta (`Preparar contexto IA` → `Normalizar decisión IA` → `Resolver contexto comercial`) con la IA "derivando" como antes:
  - Conversación Pedregal (cotizado, ciudad conocida): imagen → pregunta editable; "No 🙈" → rediseño + metodología + imagen de trabajos; PDF final → humano.
  - Link de Canva con ciudad desconocida ya preguntada → pregunta editable; "Desde Ambato" → ubicación + editable; "Sí lo tengo en Illustrator" → pide el editable + metodología.
  - PDF como primer mensaje → pide medidas. Imagen ilegible con cotización → pregunta editable.
  - No aplica: imagen en conversación de afiches (responde la regla de afiches), comprobante de pago (sigue a humano).
  - Fajillas en dos formulaciones.
- Cierre de cotización con diseño recibido (con y sin ciudad).
- Regresión: calendarios (12 escenarios), links, pregunta de ciudad y totalizador sin cambios.
- `inject-code`, `validate-workflow`, `prepare-update`, `check-encoding` OK; `activeVersion` intacto; en `edit.json` solo cambian los 3 prompts y la consulta.

---

## 5. Cómo activarlo

1. (Opcional) Imagen de trabajos realizados, enviada una vez junto con la metodología:

```sql
INSERT INTO pegaso.configuracion_bot (clave, valor_json, actualizado_at)
VALUES
  ('IMAGEN_TRABAJOS', '{"activo": true, "url": "https://pegasoadhesivos.com/wp-content/uploads/AAAA/MM/<collage-trabajos>.jpg"}'::jsonb, NOW())
ON CONFLICT (clave) DO UPDATE
SET valor_json = EXCLUDED.valor_json,
    actualizado_at = NOW();
```

   WhatsApp envía una sola imagen por mensaje: conviene un collage. Sin la fila, el texto sale sin "Le adjunto algunos de nuestros trabajos.".
2. Publicar (`push.ps1`) y probar: cotizar, enviar una imagen de etiqueta, responder "No".

---

## 6. Riesgos y decisiones a confirmar

- **Imagen ilegible** en una conversación de etiquetas cotizada se toma como el diseño. Si fuera otra cosa (por ejemplo un comprobante que el análisis no reconoció), el cliente recibe la pregunta del editable; el comprobante por texto ("le adjunto el abono") sí sigue a humano.
- **Archivo después de la metodología** va a humano: es el punto donde el asesor revisa el editable y confirma el pedido.
- **Respuestas ambiguas** al editable ("no sé", "más o menos") no avanzan el flujo: decide la IA.
- El rediseño no menciona costo; si debe tener un valor, hay que definirlo.
