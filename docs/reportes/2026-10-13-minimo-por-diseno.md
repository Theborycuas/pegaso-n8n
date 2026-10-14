# Mínimo por diseño: no se reparte la cantidad entre diseños y no se deriva

**Fecha:** 13 de octubre de 2026 · **Workflow:** SISTEMA AUTOMATIZADO PEGASO (`09OF22FOxihypeeh`)
**Estado:** implementado y verificado en local. **No** se publicó en n8n (`push.ps1` no se ejecutó), no hay commit ni `git push`.

Cuando un prospecto pide repartir una cantidad entre varios diseños con menos de 1.000 etiquetas por diseño, el bot ahora le explica con claridad que no es posible. Le dice cuánto necesitaría y para cuántos diseños le alcanza, **sin llamar a la IA y sin derivar al humano**. Siempre mínimo 1.000 por diseño y en múltiplos de 1.000.

---

## 1. Qué pasaba

Conversación real, después de varias cotizaciones de 10x14 cm:

| Cliente | Bot (antes) |
|---|---|
| "Ok pero me puede hacer 1500 de un diseño y 1000 de otro y 500 de otro diseño.?" | La IA explicó el mínimo (sección 19 del prompt), pero de forma genérica |
| "Pero quiero las 3000 para 5 diseños. Eso no se puede ?" | "Permítame un momento por favor, ya verificamos su requerimiento." → **derivó al humano** |

Causas:

1. **Ninguna regla determinística detectaba "repartir la cantidad entre diseños".** La regla del mínimo existía solo como texto en el prompt (sección 19) y en `Aplicar mínimo de impresión`, que actúa sobre la cantidad de **una** cotización. La IA tomó la insistencia del cliente como negociación (sección 29 del prompt: `NEGOCIAR` → `DERIVAR_HUMANO`).
2. **Falso positivo de fecha.** En `Resolver contexto comercial`, el detector de fechas reconocía "**para 5** diseños" como "para el 5". Aun con la acción correcta, la respuesta se habría reemplazado por el texto de la metodología semanal.

## 2. Qué se cambió

### 2.1 `Preparar contexto IA` (4.2 → 4.3): regla pre-IA `DIVISION_MINIMO_DISENOS`

Se agregó una tercera regla previa a la IA, después de `SALUDO_SIMPLE` y `PRODUCTO_NO_P4`, que tienen prioridad. Igual que las otras, solo aplica a texto sin multimedia.

**Cuándo aplica.** El texto habla de diseños: diseño, modelo, sabor, nombre, variedad, versión, texto, tipo, referencia, arte, marca, color, producto o presentación, o "uno … y otro". Además, el reparto pedido es **imposible**:

| Forma del pedido | Ejemplo | Cuándo es imposible |
|---|---|---|
| Cantidades por diseño | "1500 de un diseño y 1000 de otro y 500 de otro" | Alguna cantidad es menor a 1.000 o no es múltiplo de 1.000 |
| Cantidad por cada diseño | "500 de cada sabor", "5 diseños de 500" | La cantidad por diseño es menor a 1.000 o no es múltiplo de 1.000 |
| Total entre N diseños | "las 3000 para 5 diseños", "5 diseños pero solo 3000 etiquetas", "mil etiquetas con 4 nombres diferentes", "mitad de un diseño y mitad de otro" | El total es menor a N × 1.000 (con "varios" o "diferentes" se asume N = 2) |

Las cantidades se leen con separador de miles ("1.500") y en palabras ("mil", "dos mil").

**Cuándo NO aplica (decide el cerebro como antes):**
- repartos posibles: "3000 para 3 diseños", "1000 de un diseño y 1000 de otro";
- un solo diseño: "4000 de un diseño";
- textos sin reparto: "Necesito 1000 etiquetas de 10x14", "¿Cuál es el mínimo?";
- falsos amigos: "Pago la mitad de 300 ahora y la otra mitad después", "Mi nombre es Ana…", "3000 etiquetas en diferentes colores".

**Qué decide:** `intencion = CONSULTAR_MINIMO`, `accion = INFORMAR_MINIMO`, `requiere_humano = false` y `requiere_cerebro_comercial = false`, así que no se llama a la IA. Expone `division_disenos` (tipo, cantidades, diseños) para diagnóstico.

**Respuesta determinística:** una base fija, un detalle calculado y una pregunta de cierre.

> No es posible dividir la cantidad entre varios diseños: cada diseño requiere mínimo 1.000 etiquetas y trabajamos en múltiplos de 1.000. Si cambia una letra o palabra ya se considera otro diseño. *(detalle)* ¿Con cuántos diseños desea que le coticemos?

| Pedido | Detalle calculado |
|---|---|
| 1500 / 1000 / 500 | "Para sus 3 diseños las cantidades podrían ser: 1.500 → 2.000, 1.000 y 500 → 1.000 (4.000 en total)." |
| 3000 para 5 diseños | "Para 5 diseños necesitaría mínimo 5.000 etiquetas (1.000 por diseño). Con 3.000 etiquetas podemos hacerle hasta 3 diseños de 1.000." |
| 500 de cada sabor | "Cada diseño necesita 1.000 etiquetas, no 500." |
| 5 diseños de 500 | "Para 5 diseños necesitaría 1.000 de cada uno: 5.000 etiquetas en total." |
| 1000 en varios modelos | "Con 1.000 etiquetas podemos hacerle 1 diseño." |

El redondeo hacia arriba (1.500 → 2.000) es el mismo que ya usa la cotización ("3.500 → 4.000").

### 2.2 `Resolver contexto comercial` (V2.5 → V2.6): fecha sin falsos positivos

En el patrón "para / hasta / antes de + número", se excluyen los números seguidos de diseños, sabores, nombres, modelos, marcas, productos, etc. "Para el 5" y "15 de noviembre" se siguen detectando como fecha.

### 2.3 Lo que no cambió

- No cambiaron los prompts, los nodos (ni nombres ni conexiones), las tablas ni el SQL.
- `Aplicar mínimo de impresión` y el cálculo de precios siguen igual.
- La derivación por 6000 o más, los productos no P4 y los saludos siguen igual.

## 3. Verificación

Se ejecutó el código real de los nodos en la ruta completa posterior al Wait: `Resolver turno conversacional` → `Preparar contexto IA` → `Normalizar decisión IA` → `Resolver contexto comercial` → `Preparar respuesta comercial` → `Preparar envío WhatsApp`.

| Prueba | Resultado |
|---|---|
| Los 2 mensajes reales de la conversación | Regla aplicada, `INFORMAR_MINIMO`, 0 llamadas a la IA, 1 envío, sin "Permítame" ni metodología, sin fecha guardada |
| 12 variantes que deben aplicar (separador de miles, "mil", "dos mil", "mitad", "varios", "cada", marcas, productos) | OK |
| 10 variantes que no deben aplicar | OK: decide el cerebro |
| "para el 5" y "15 de noviembre" siguen siendo fecha | OK |
| "1000 tarjetas de presentación en 2 diseños" | Gana `PRODUCTO_NO_P4` (deriva como cotización especial) |
| Regresión conversacional, auditoría, cierre de cotizaciones | `TODAS OK` |
| Regresión de precios | `TODOS LOS CASOS OK` |
| `inject-code.mjs`, `validate-workflow.mjs`, `check-encoding.mjs` | OK (184 nodos) |

## 4. Límites conocidos

- **Fuera del patrón:** si el cliente lo dice de una forma que el detector no reconoce (por ejemplo, sin número o sin palabra de diseño), decide el cerebro como antes y todavía puede tomarlo como negociación y derivar. La regla prioriza no equivocarse sobre cubrirlo todo.
- **Una sola respuesta por turno:** si el mismo mensaje trae otra pregunta (por ejemplo, el envío), la respuesta cubre solo el mínimo por diseño.
- **Prospectos ya derivados:** el prospecto de la conversación real quedó con `requiere_humano = true` por la derivación anterior. El bot no lo atenderá hasta que alguien restablezca la bandera en la base.

## 5. Publicar y revertir

- **Publicar:** el cambio está solo en `code/_extraidos/`. Se publica junto con el resto con `push.ps1`.
- **Revertir:** `git checkout -- code/_extraidos/preparar-contexto-ia.js code/_extraidos/resolver-contexto-comercial.js`. Ojo: ambos archivos también tienen cambios del [control conversacional](2026-10-13-control-conversacional.md) sin commit. Para revertir solo esta regla, quitar el bloque `DIVISION_MINIMO_DISENOS` y las palabras agregadas al patrón de fecha.
