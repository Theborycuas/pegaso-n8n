# Diseño sin creación de marca, no recotizar sin contexto y respuestas rápidas de anuncios

**Fecha:** 13 de octubre de 2026 · **Workflow:** SISTEMA AUTOMATIZADO PEGASO (`09OF22FOxihypeeh`)
**Estado:** implementado y verificado en local. **No** se publicó en n8n (`push.ps1` no se ejecutó), no hay commit ni `git push`.

Tres correcciones pedidas a partir de conversaciones reales:

1. **Diseño.** El bot ya no ofrece crear diseños ni marcas. Explica que Pegaso es productor de impresión, que replica un ejemplo con el logo del cliente y que no crea logos.
2. **Recotización sin contexto.** El bot ya no reenvía la cotización cuando el cliente dice algo que no cambia el pedido ("Para botella de 500 ml"), cuando pide otras medidas sin darlas ("Son en otras medidas") ni cuando retoma la conversación después de 24 h sin referirse a lo anterior.
3. **Respuestas rápidas de anuncios.** La respuesta automática de la pregunta rápida del anuncio de Facebook sobre el material ya no se toma como intervención humana y no deriva al humano. Además hay una red de seguridad para respuestas de anuncio que aún no están registradas.

---

## 1. Qué pasaba

| Caso | Bot (antes) | Causa |
|---|---|---|
| Cliente sin diseño: "Es para emprender", "No necesito tantas etiquetas" | Enviaba la metodología de propuesta (2 cambios, $8, 50 %) y luego pedía nombre de la marca y colores "y con eso la elaboramos" | El texto de diseño vivía solo en el prompt del cerebro (sección 27, CASO A) y ofrecía crear el diseño |
| Con una cotización de 1.000 etiquetas 7x11.5 ya enviada, el cliente dice "Para botella de 500 ml" | Reenviaba la misma cotización | La IA tomó "500 ml" como cantidad 500; `Resolver contexto comercial` lo redondeó a 1.000 y, al ver un `COTIZAR_P4` con datos completos en memoria, recotizó |
| Luego dice "Son en otras medidas" | Reenviaba otra vez la cotización 7x11.5 | La IA respondió `COTIZAR_P4` con las medidas de la memoria; ninguna regla exigía un cambio real para recotizar |
| Primer mensaje "¿De qué material son sus etiquetas?" desde un anuncio | El prospecto quedó en `DERIVAR_HUMANO` con `requiere_humano = true` | La respuesta automática del anuncio llega a n8n como eco de WhatsApp Business, igual que un mensaje escrito por un asesor. Su texto no estaba en la lista de automatizaciones conocidas, así que se clasificó como humano |

## 2. Qué se cambió

### 2.1 Prompt del cerebro comercial (Groq, DeepSeek y OpenAI; los tres idénticos)

- **Sección 6 (identidad):** Pegaso es productor gráfico; su fuerte es la impresión de etiquetas adhesivas. No crea logos, marcas ni identidad de marca.
- **Sección 27, CASO A (no tiene diseño):** la respuesta base es el texto indicado por Pegaso:
  > "Podemos ayudarle con una propuesta de diseño en base a su requerimiento, pero es importante que usted tenga muy claro cómo requiere su diseño. Somos productores, es decir, nuestro fuerte es la impresión de etiquetas adhesivas. Si usted nos envía un ejemplo, lo replicamos y le ponemos su logo. Su logo ya lo debe tener listo, NO creamos logos. Siempre recomendamos que realicen su diseño de forma profesional en su ciudad con un diseñador y nos envíe el original editable para nosotros imprimir."

  Además prohíbe pedir nombre de la marca, colores o "qué información debe llevar", y prohíbe decir "con eso lo elaboramos".
- **CASO B (quiere ver el diseño antes de pagar):** conserva la metodología (50 % de abono, propuesta con su ejemplo y su logo, 2 cambios, $8 adicional, evidencia antes del saldo). Ahora solo se usa cuando el cliente pide ver la propuesta, no ante cualquier pregunta de diseño.
- **CASO E (nuevo; no tiene logo, está emprendiendo o pide crear la marca):** "No creamos logos ni marcas; somos productores…". Si en el mismo turno dice que no necesita tantas etiquetas, agrega el mínimo de impresión.
- **Sección 5.1 (nueva), "Razona lo que pide ahora antes de cotizar":** `COTIZAR_P4` solo si el cliente aporta un dato nuevo (medida, cantidad, forma) o pide precio de forma explícita. "Otras medidas" sin medidas → pedir medidas. Mililitros, gramos, litros u onzas describen el envase, no la cantidad de etiquetas.
- **Secciones 7 y 19:** la cantidad por defecto de 1.000 solo aplica si el cliente quiere cotizar; ejemplos nuevos del mínimo ("No necesito tantas etiquetas", "Solo necesito 100", "¿Hacen menos de 1000?").
- **Validaciones finales 40 a 42 (nuevas):** antes de responder, la IA comprueba que no recotiza sin cambio, que no tomó ml/gramos como cantidad y que no ofreció crear logos o marcas.

### 2.2 `Resolver contexto comercial` (V2.6 → V2.7): guardas determinísticas

El prompt orienta a la IA; estas reglas garantizan el resultado aunque la IA se equivoque.

**Verificación de números del turno.** Si el turno es solo texto y no tiene números escritos en palabras, la cantidad y las medidas que la IA atribuye al mensaje actual deben aparecer escritas en él:

- "500 ml", "250 g", "1 litro", "16 oz" no cuentan como cantidad.
- Las medidas aceptan centímetros, milímetros (÷10) o metros (×100).
- Lo descartado se informa en `datos_descartados_turno`.
- Con imágenes, audios o números en palabras ("dos mil") se confía en la IA como antes.

**Regla J, "No recotizar sin un cambio real"** (`ajuste_recotizacion`). Aplica cuando la IA pide `COTIZAR_P4` pero el turno no modificó ningún dato de la cotización:

| Situación | Acción final | Respuesta |
|---|---|---|
| El cliente pide "otras medidas" sin darlas | `PEDIR_MEDIDAS` | "Indíquenos por favor las nuevas medidas de sus etiquetas (ancho y alto en centímetros) para cotizarle." |
| Sesión nueva (sin mensajes en 24 h) y no se refiere a lo anterior ("lo mismo", "la vez pasada", "la cotización anterior"…) | `PEDIR_MEDIDAS` si pregunta precio; si no, `RESPONDER_GENERAL` | Pregunta de medidas, o el texto de la IA (respaldo: "¿En qué podemos ayudarle con sus etiquetas?") |
| Cotización vigente y el cliente no pide precio ni se refiere a la cotización | `RESPONDER_GENERAL` | El texto de la IA (respaldo: "Gracias por la información. Si necesita cotizar otra medida o cantidad, indíquenos por favor ancho, alto y cantidad.") |

Se sigue recotizando cuando cambian medida, cantidad o forma, cuando el cliente pide precio explícitamente ("¿Cuánto me salen?") y cuando se refiere a lo anterior ("Quiero las mismas etiquetas de la vez pasada").

**Seguimiento tras una respuesta automática.** Si una automatización de WhatsApp Business o del anuncio ya respondió la pregunta del cliente (por ejemplo, el material), antes el bot omitía su envío y quedaba en silencio. Ahora, si es una pregunta informativa y todavía no se pidieron medidas, el bot envía solo: "¿En qué medidas necesita sus etiquetas? Indíquenos ancho y alto por favor." (`seguimiento_tras_automatizacion`). Si las medidas ya se pidieron, sigue omitiendo.

### 2.3 Respuestas rápidas de anuncios

**Huella registrada (`Normalizar evento WhatsApp` 2.1 → 2.2).** Se agregó a `AUTOMATIZACIONES_WHATSAPP_BUSINESS` la respuesta del anuncio sobre el material ("Trabajamos con plástico polipropileno de alta adherencia…", coincidencia por inicio del texto, `accion_equivalente = INFORMAR_MATERIAL`). Ese eco ahora es `SALIENTE_AUTOMATICO`, se guarda con el prefijo `[AUTOMATICO WHATSAPP BUSINESS · accion=INFORMAR_MATERIAL]` y no levanta `requiere_humano`.

**Red de seguridad para respuestas sin huella.** Cubre respuestas del anuncio que todavía no están en la lista.

- `Buscar prospecto intervención humana` calcula `respuesta_rapida_apertura`. Exige tres condiciones a la vez:
  - el eco es texto de 80 caracteres o más;
  - llega a 15 s o menos del último mensaje del cliente;
  - ese mensaje abre la conversación (no hay otros mensajes del prospecto entre 24 h y 30 s antes).
- `Marcar prospecto requiere humano2` no levanta la bandera si `respuesta_rapida_apertura` es verdadera.
- `Preparar mensaje humano saliente` (1.1 → 1.2) guarda ese eco como automático: `[AUTOMATICO WHATSAPP BUSINESS · accion=NINGUNA · motivo=RESPUESTA_RAPIDA_APERTURA]`, `intervencion_humana = false`.

Fichas actualizadas en [FLUJO-WORKFLOW-PEGASO.md](../FLUJO-WORKFLOW-PEGASO.md): §4 (Normalizar evento WhatsApp), §6 (ruta de intervención humana), §11 (cerebro y Resolver contexto comercial) y §18 (observaciones 17 y 20).

## 3. Verificación

Pruebas ejecutadas sobre el código real de los nodos y el prompt del workflow editable:

| Grupo | Casos | Resultado |
|---|---|---|
| Recotización | "Para botella de 500 ml" (no recotiza, conserva la cotización, descarta la cantidad), "Son en otras medidas" (pide medidas), "Ahora necesito 2000", "Mejor de 8x12", "Mejor dos mil", "¿Cuánto me salen?" (sí recotizan), pregunta de ubicación tras cotizar (responde la pregunta) | 9/9 OK |
| Sesión nueva (más de 24 h) | Pregunta de precio sin medidas (pide medidas), "sigo interesado" (no cotiza), "las mismas de la vez pasada" (cotiza) | 3/3 OK |
| Primera cotización | "7x11.5 para botella de 500 ml" cotiza 1.000, no 500 | 1/1 OK |
| Ecos de anuncio | Huella del material, prefijo, red de seguridad (automático en apertura, humano fuera de ella), expresión de `Marcar prospecto requiere humano2` en sus tres casos | 7/7 OK |
| Turno tras la respuesta del anuncio | El turno no se bloquea; el bot solo pregunta medidas (con huella y sin huella) | 3/3 OK |
| Prompt | Tres proveedores idénticos; texto nuevo de diseño; sin la metodología en el CASO A; CASO E; sección 5.1 y validaciones 40–42 | 6/6 OK |
| SQL de `Buscar prospecto intervención humana` en PostgreSQL (PGlite) | Eco largo a 4 s (sí), eco 2 s antes de guardar el entrante (sí), con saludo automático intermedio (sí), eco corto (no), eco a 40 s (no), mensajes 2 h antes (no), último contacto hace 30 h (sí), sin entrante guardado (no), imagen (no) | 9/9 OK |

Regresiones anteriores: control conversacional, auditoría, mínimo por diseño, cierre de cotizaciones, precios y derivación, y ACTIVEBOT. Todas OK. En la regresión de precios, los casos sintéticos usaban `mensaje_actual: 'msg'`; se ajustaron para que el mensaje contenga los números del caso, igual que en una conversación real.

Validadores del repositorio: `inject-code` (69 nodos Code), `validate-workflow` (186 nodos) y `check-encoding` OK.

## 4. Riesgos conocidos

- **Solo una respuesta de anuncio tiene huella.** Las demás preguntas rápidas del anuncio dependen de la red de seguridad. Para cubrirlas con certeza hay que registrar el texto exacto de cada respuesta.
- **Texto registrado escrito por un asesor.** Si un asesor pega a mano la respuesta del material, se toma como automatización y el bot no se detiene.
- **Red de seguridad, dos casos raros:**
  - si el eco llega antes de que se guarde el mensaje del cliente, se trata como humano (comportamiento anterior);
  - si un asesor pega un texto largo en los primeros 15 s de una conversación nueva, se trata como automático.
- **Verificación de números.** Si el cliente escribe la cantidad de una forma no prevista (por ejemplo "un millar"), no hay número escrito ni palabra numérica reconocida, así que la cantidad de la IA se descarta. Con una cotización vigente el bot respondería sin recotizar; el cliente tendría que repetir la cantidad con cifras.
- **El prompt orienta, no garantiza.** La IA puede seguir redactando el diseño con matices distintos; las guardas determinísticas cubren la recotización, no el texto de diseño.

## 5. Pendiente de Pegaso

- Enviar la lista completa de preguntas rápidas del anuncio con sus respuestas, para registrar una huella por cada una.
- Publicar en n8n cuando se revise este cambio.
