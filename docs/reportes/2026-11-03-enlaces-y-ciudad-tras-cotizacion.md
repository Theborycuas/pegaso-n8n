# Links del cliente y pregunta de ciudad tras la cotización

**Fecha:** 3 de noviembre de 2026 · **Workflow:** SISTEMA AUTOMATIZADO PEGASO (`09OF22FOxihypeeh`)
**Estado:** Implementado en local (código + `edit.json`, validadores OK). **No** publicado en n8n, sin commit ni `git push`.

Un cliente envió un link de Canva (`canva.link/…2533`) y el bot recotizó "2.533 → 3.000" etiquetas. Además, la primera cotización cerraba con "Adjúntenos su diseño para verificarle por favor."; Pegaso prefiere seguir la conversación preguntando la ciudad.

---

## 1. Diagnóstico

| Caso | Causa |
|---|---|
| Link leído como cantidad | En `Resolver contexto comercial`, si la IA no extrae cantidad y el texto trae **un solo número ≥ 1000 sin unidad**, se toma como cantidad del turno. El ID del link terminaba en `2533`. El link también llegaba completo al cerebro y al extractor. |
| Cierre de la primera cotización | `Preparar mensaje cotización` siempre pedía el diseño. El prompt del cerebro (§35) ya decía que ese nodo debía preguntar la ciudad, pero nunca se implementó. |
| Riesgo al preguntar la ciudad | `Preparar contexto IA` clasificaba cualquier saliente con "desde qué ciudad nos escribe" como `INFORMAR_UBICACION`. La cotización habría quedado marcada así y la respuesta del bot a la ciudad (o a "¿dónde están?") se habría omitido por "acción ya enviada". |

---

## 2. Decisiones

| Tema | Qué hace ahora |
|---|---|
| Link vs nombre de archivo | Un link (con `http(s)://`, `www.` o `dominio/ruta`) se reemplaza por `[ENLACE · servicio=Canva · tipo=DISENO]`, sin dígitos. Un nombre de archivo (`etiqueta 28,5x13,5cm perox.ai`) no tiene dominio con `/` y no se toca: sus medidas siguen valiendo. |
| Tipos de link | `DISENO` (Canva, Figma, Adobe), `ARCHIVO` (Drive, Dropbox, WeTransfer, OneDrive, MEGA, Fotos), `REFERENCIA` (redes sociales, Pinterest/Freepik), `UBICACION` (mapas), `WEB` (otros). |
| Link de diseño o archivo sin pedido nuevo | Con medidas o cotización previa → `DERIVAR_HUMANO`, motivo `ARCHIVO_DISENO` (notifica; transición fija "Permítame un momento por favor, ya revisamos el archivo que nos envió."). Sin medidas → `PEDIR_MEDIDAS`. |
| Link + medidas en el texto | Se cotiza con las medidas del texto; los números del link se ignoran. |
| Primera cotización | Cierra con `¿Desde qué ciudad nos escribe disculpe?` si la ciudad no se conoce y no se preguntó en los salientes recientes. Si ya se conoce, sigue pidiendo el diseño. Con varias opciones: "Le dejo estas opciones para que pueda compararlas. ¿Desde qué ciudad nos escribe disculpe?". Las cotizaciones siguientes mantienen su cierre. |
| Respuesta a la ciudad | El cerebro (§16) reconoce la ciudad, informa que Pegaso está en Quito y envía a todo el país, y pide el diseño. Si es Quito o alrededores: "Perfecto, nosotros también estamos en Quito. Adjúntenos su diseño para verificarle por favor." |

---

## 3. Qué se cambió

| Nodo | Versión | Cambio |
|---|---|---|
| Preparar contexto IA | 4.17 → **4.18** | Detecta y reemplaza links en el turno y el historial. Nuevos campos `mensaje_actual_original` y `enlaces_turno`. Una cotización no se clasifica como `INFORMAR_UBICACION` en `ultimo_saliente`. |
| Resolver contexto comercial | 3.22 → **3.23** | Quita links y marcadores antes de leer números, pares de medidas y patrones del turno. Un turno de solo link también se verifica (no acepta cantidad ni medidas atribuidas por la IA). |
| Preparar mensaje cotización | 2.10 → **2.11** | Cierre con pregunta de ciudad en la primera cotización. Nuevo campo informativo `cierre_pregunta_ciudad`. |
| Cerebro comercial Groq / DeepSeek / OpenAI (prompt) | — | Nueva sección 28.0 (links). §16: caso Quito y "una ciudad sola responde a la pregunta de la cotización". §35: describe el cierre real. |

---

## 4. Cómo se ve

```
Le adjunto la cotización:

-1.000 Etiquetas adhesivas de 10x10 cm rectangulares le saldrían en $75.00 dólares

¿Desde qué ciudad nos escribe disculpe?
```

```
Cliente: https://canva.link/6cckyn2fzpp2533
→ Cerebro recibe: [ENLACE · servicio=Canva · tipo=DISENO]   (sin 2533)
```

---

## 5. Verificación

- Detector de links con 12 casos: Canva con y sin `https`, Canva con parámetros + "Son de 14x7", Drive, WeTransfer + "3000 etiquetas de 5x5", Facebook, nombre de archivo `.ai`, "1 litro 7.5cm x 9cm", "Vaso de oz 2.5cm x 6cm", email, `10* 10`, `5000 de 10.2*10.2`. Ningún número de un link sobrevive; los demás números se conservan.
- Simulación de `Preparar mensaje cotización`: primera cotización sin ciudad, con varias opciones, con ciudad conocida, con ciudad ya preguntada y segunda cotización.
- `inject-code`, `validate-workflow`, `prepare-update` y `check-encoding` OK; sin mojibake en `edit.json` ni en el build. `activeVersion` no se modificó.

---

## 6. Riesgos y pendientes

- El bot no abre links: un link de diseño con cotización previa siempre pasa a humano.
- Un link escrito sin `http`, sin `www.` y sin `/` (p. ej. solo `canva.com`) no se reconoce como link; no trae números, así que no afecta cantidades.
- El correo de notificación muestra `mensaje_actual` con el marcador; el link completo queda en el chat de WhatsApp y en `mensaje_actual_original`.
- **Fuera de este cambio:** en la misma conversación, un audio generó tres líneas idénticas "1.000 Etiquetas adhesivas de 14x7 cm". Conviene revisarlo aparte.
