# Auto-reply, cierre, archivos con medidas e interpretación de imagen

**Fecha:** 21 de octubre de 2026 · **Workflow:** SISTEMA AUTOMATIZADO PEGASO (`09OF22FOxihypeeh`)
**Estado:** Implementado en local (build + edit). **No** publicado en n8n, sin commit ni `git push`.

Tras el saludo automático de Meta/publicidad el bot mandaba un tercer mensaje (“No pudimos leer…”, “Bienvenido…”). Un “No muchas gracias” se contestaba recordando la cotización. Un `.ai` con medidas en el nombre no se cotizaba. Una foto de producto se trataba como diseño. “Vaso de oz 2.5cm x 6cm” se iba a humano.

---

## 1. Decisiones

| Tema | Qué hace ahora |
|---|---|
| Auto-reply de anuncio / “ausente” | Si WhatsApp Business ya saludó o pidió medidas, el bot **no** repite el saludo ni dice “No pudimos leer”. Continúa con un complemento: `Para enviarle el precio indíquenos por favor el ancho y el alto de sus etiquetas en centímetros. Con esos datos le cotizamos de inmediato.` Ese refuerzo se envía una sola vez. |
| “No muchas gracias” | Solo: `Cualquier duda o inquietud hágamela saber, estamos para servirle.` Sin vigencia ni insistir. |
| “Muy gentil” | `Gracias a usted por escribirnos. Quedamos atentos a cualquier requerimiento o inquietud que tenga, estamos para servirle.` |
| Archivo `.ai` / `.pdf` | Se lee el **nombre** y el caption. Si hay medidas (`28,5x13,5cm etiqueta perox.ai`), se cotiza; no se deriva a “ya revisamos el archivo”. |
| Foto de producto vs diseño | Veredicto comercial: envase, diseño, boceto, medidas manuscritas, referencia o imagen no etiqueta. No llama “diseño” a una foto de producto. Si las medidas cotizadas no coinciden con las de la imagen, pregunta cuál usar. |
| `De 1 litro . 7.5cm x 9cm` / `Vaso de oz 2.5cm x 6cm` | Extrae las medidas en cm. “Vaso” con medidas no es producto no P4. Confirma: `Requiere sus etiquetas en las medidas de 7.5 cm x 9 cm, 4.5 cm x 12 cm y de 2.5 cm x 6 cm?` |

---

## 2. Qué se cambió

| Nodo | Versión | Cambio |
|---|---|---|
| Normalizar evento WhatsApp | 2.2 → **2.3** | Extrae `media_filename` (YCloud/Meta `filename` / `fileName`). |
| Preparar entrada WhatsApp | 2.1 → **2.2** | El mensaje de documento incluye el nombre de archivo + caption. |
| Preparar contexto IA | 4.16 → **4.17** | Ecos de “¿Cuál es su requerimiento?” / “con mucho gusto…” como SALUDO / PEDIR_MEDIDAS. Archivo con medidas no es `ARCHIVO_NO_PROCESABLE`. “Vaso” con cm no es `PRODUCTO_NO_P4`. Pasa `imagenes_clasificacion`. |
| Normalizar decisión IA | 2.8 → **2.9** | No deriva un documento a humano si el turno ya trae medidas. |
| Resolver contexto comercial | 3.20 → **3.21** | Omite PEDIR_MEDIDAS si ya se pidieron; cierre de rechazo; confirmación de lista etiquetada (litro/oz/vaso); veredicto de imagen; inyecta `detalles` de varios pares. |
| Preparar respuesta comercial | 2.4 → **2.5** | Omite “No pudimos leer” si el último saliente ya pidió medidas o requerimiento. |
| Validar análisis imagen Groq / DeepSeek / OpenAI | 2.1 → **2.2** | `veredicto_comercial` (FOTO_PRODUCTO, DISENO_ETIQUETA, BOCETO, MEDIDAS_MANUSCRITAS, REFERENCIA_NO_FINAL, IMAGEN_NO_ETIQUETA). |

---

## 3. Cómo se ve

Después del FAQ del anuncio (saludo + “En qué medidas…”):

```
Para enviarle el precio indíquenos por favor el ancho y el alto de sus etiquetas en centímetros. Con esos datos le cotizamos de inmediato.
```

Rechazo:

```
No muchas gracias
→ Cualquier duda o inquietud hágamela saber, estamos para servirle.
```

Lista de envases:

```
De 1 litro . 7.5cm x 9cm
De 1/2 litro. 4.5cm x 12cm
Vaso de oz 2.5cm x 6cm
→ Requiere sus etiquetas en las medidas de 7.5 cm x 9 cm, 4.5 cm x 12 cm y de 2.5 cm x 6 cm? Si es correcto, le cotizamos 1.000 unidades de cada una.
```

---

## 4. Riesgos

- El binario `.ai`/`.pdf` sigue sin abrirse: solo se cotiza si el **nombre o caption** trae medidas.
- El veredicto de imagen usa el enum actual del LLM más heurísticas sobre el resumen; no cambia el prompt del nodo LangChain.
- Confirmar la lista añade un turno extra antes de cotizar (sirve cuando rectifican el vaso).
