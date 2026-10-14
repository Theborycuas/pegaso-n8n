# Cierre de cotizaciones repetidas: "comparando alternativas" una sola vez

**Fecha:** 13 de octubre de 2026 · **Workflow:** SISTEMA AUTOMATIZADO PEGASO (`09OF22FOxihypeeh`)
**Estado:** implementado y verificado en local. **No** se publicó en n8n (`push.ps1` no se ejecutó), no hay commit ni `git push`.

Cuando un cliente pide varias cotizaciones seguidas, el bot ya no repite en cada una "Veo que estamos comparando varias alternativas. Si gusta, indíquenos cuáles son sus opciones favoritas y le ayudamos a definir la más conveniente.". Esa frase sale una sola vez. Las cotizaciones siguientes cierran con "Verifíquele a detalle por favor.".

---

## 1. Qué pasaba

En una conversación real, el cliente pidió 1.000, 2.000, 3.500 (ajustado a 4.000) y 3.000 etiquetas de 10x14 cm. Desde la cuarta cotización, **todas** cerraban con el mismo texto de "comparando alternativas".

La causa está en `resolverCierreCotizacion`, dentro de `Preparar mensaje cotización`. El cierre se elegía solo por la cantidad de cotizaciones previas en los últimos 6 SALIENTE (`mensajes_salientes_recientes`, que arma `Preparar contexto IA`):

| Cotizaciones previas | Cierre (antes) |
|---|---|
| 0 | "Adjúntenos su diseño para verificarle por favor." (o "Le dejo estas opciones…" si hay varias) |
| 1 | "Si desea, también podemos revisarle otra medida…" |
| 2 | "Verifiquele por favor " |
| 3 o más | "Veo que estamos comparando varias alternativas…" **siempre** |

## 2. Qué se cambió

Solo cambió `code/_extraidos/preparar-mensaje-cotizacion.js` (V2.7 → V2.8):

- **Una sola vez:** antes de elegir el cierre se revisa si alguno de los salientes recientes ya contiene "comparando varias alternativas" (`cierreComparacionYaEnviado`).
- **Tres o más cotizaciones previas:** si la frase no se envió, se envía; si ya se envió, el cierre es "Verifíquele a detalle por favor.".
- **Dos cotizaciones previas:** el texto pasó de "Verifiquele por favor " a "Verifíquele por favor.", con tilde y sin espacio final.
- **Salida nueva, solo informativa:** `cierre_comparacion_ya_enviado`. Ningún nodo posterior la lee.

| Cotización n.º | Cierre (ahora) |
|---|---|
| 1 | Pide el diseño (sin cambios) |
| 2 | Ofrece otra medida (sin cambios) |
| 3 | "Verifíquele por favor." |
| 4 | "Veo que estamos comparando varias alternativas. Si gusta, indíquenos cuáles son sus opciones favoritas y le ayudamos a definir la más conveniente." |
| 5 en adelante | "Verifíquele a detalle por favor." |

**Por qué así:** la frase de comparación es útil una vez, para invitar al cliente a decidir. Repetida en cada cotización suena automática. La detección usa el texto ya guardado en `pegaso.mensajes` (`Guardar mensaje comercial` guarda `mensaje_comercial`, que incluye el cierre). Por eso no hizo falta tocar tablas, nodos ni prompts.

**Qué no cambió:**
- el cálculo de precios, el mínimo de impresión y el ajuste a múltiplos de 1000;
- la línea "A partir de 3.000 etiquetas podemos mejorarle el precio.";
- el mensaje de variación de precio;
- los contratos de salida.

## 3. Verificación

Se ejecutó el código real del nodo con siete cotizaciones seguidas. Cada mensaje generado alimentó la ventana de los últimos 6 salientes de la cotización siguiente.

| Prueba | Resultado |
|---|---|
| Secuencia 1ª → 7ª | Diseño → otra medida → "Verifíquele por favor." → "comparando…" → "Verifíquele a detalle por favor." ×3 |
| "comparando…" aparece una sola vez | OK |
| Primera cotización con varias opciones | Sin cambios ("Le dejo estas opciones…") |
| Tres previas sin "comparando" en la ventana | Lo envía |
| Regresión de precios | `TODOS LOS CASOS OK` |
| Regresión conversacional | `TODAS OK` |
| `inject-code.mjs`, `validate-workflow.mjs`, `check-encoding.mjs` | OK (184 nodos) |

## 4. Límite conocido

La ventana es de 6 salientes (`MAX_SALIENTES_RECIENTES` en `Preparar contexto IA`). Si después de la frase de comparación hay 6 salientes más, la frase sale de la ventana y puede volver a enviarse una vez. En la práctica significa como mucho una vez cada 6 mensajes del bot, no en cada cotización.

## 5. Publicar y revertir

- **Publicar:** el cambio está solo en `code/_extraidos/`. Se publica junto con el resto con `push.ps1`, que lo inyecta en el workflow.
- **Revertir:** `git checkout -- code/_extraidos/preparar-mensaje-cotizacion.js` y quitar la línea de la ficha del nodo en [FLUJO-WORKFLOW-PEGASO.md](../FLUJO-WORKFLOW-PEGASO.md).
