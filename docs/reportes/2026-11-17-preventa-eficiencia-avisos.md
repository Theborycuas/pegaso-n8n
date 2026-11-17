# Segunda entrega de preventa: eficiencia, modularización y avisos persistentes

Estado: preparado en local el 17 de noviembre de 2026. **No publicado.** Antes de publicar hay que aplicar `schema/preventa-eficiencia.sql` en PostgreSQL. La prueba operativa en n8n, WhatsApp y correo sigue pendiente.

Cubre los puntos 2 y 5 del [roadmap](../ROADMAP-CIERRE-VENTAS-IA.md) y cierra el pendiente del punto 3 (aviso persistente con reintento). La entrega la empezó otro agente, que se detuvo a mitad. Esta revisión completó el trabajo y corrigió lo que podía dañar el comportamiento que ya funcionaba.

## Resultado

- **Menos llamadas a la IA.** Las preguntas frecuentes compatibles se responden juntas sin llamar al cerebro. Por ejemplo, «¿qué material usan, hacen envíos e incluye IVA?» recibe las tres respuestas aprobadas. Antes solo se respondía la primera. Si dos respuestas terminan preguntando la ciudad, la pregunta aparece una sola vez al final.
- **La decisión de compra se reconoce antes de la IA.** Frases como «Hagámoslas», «Quiero hacer el pedido» o «Páseme la cuenta» derivan al encargado sin pagar una llamada al cerebro. La misma regla, en un único módulo, se usa en `Preparar contexto IA` y en `Resolver contexto comercial`.
- **Más precisión al separar consultas de compras.** «Hola, quiero hacer etiquetas» es el primer mensaje típico de un anuncio. Sigue en manos del bot, que pregunta medidas y cotiza. Con una cotización vigente, «quiero hacer las etiquetas» cuenta como aceptación. Si al aceptar el cliente da medidas o cantidades nuevas, el encargado recibe una entrega de coordinación con el cambio señalado. No se acepta la cotización anterior.
- **Memoria del editable.** Si el cliente ya dijo que no tiene editable, el bot no vuelve a preguntarlo y avanza con su imagen.
- **Calificación por turno.** Cada turno queda como `CONSULTA`, `INTERES_CONCRETO` o `DECISION_COMPRA` en el contexto y en la métrica.
- **Historial acotado.** `Recuperar historial conversación` ya no lee toda la conversación en cada mensaje. Solo trae lo necesario para el turno, la detección de intervención humana y el contexto de 24 h.
- **Aviso al encargado que no se pierde.** La derivación y su aviso se guardan en la misma sentencia SQL. Si fallan Brevo y Resend, el aviso queda pendiente y se reintenta con espera creciente. Si una ejecución se corta antes del correo, el aviso se recupera cuando vence su reserva de 5 minutos. El bot sigue en pausa durante todo el proceso.
- **Modularización.** La lógica de compra, las FAQs y el correo al encargado viven en `code/preventa/`. Se insertan en los nodos al construir el workflow.

## Decisión sobre el prompt comercial

El otro agente reemplazaba los tres prompts del cerebro (unos 60.000 caracteres) por uno de 32 líneas (`prompts/cerebro-comercial.md`). **Ese reemplazo no se aplica en esta entrega.** El prompt publicado contiene reglas que el código no cubre:

- precios de calendarios;
- papel de flyers y tarjetas;
- mínimos de 200 en calendarios;
- entregas de 2 a 3 días en producción rápida;
- campos `catalogo_*.enviada_at`, que no existían en el contexto compacto.

Reemplazarlo sin evaluarlo con conversaciones reales habría cambiado respuestas que hoy funcionan.

El costo se controla así:

1. Se evitan llamadas al cerebro con FAQs combinadas y detección previa de compra. `metricas_preventa` permite medirlo.
2. El texto fijo del prompt va antes de los datos variables. OpenAI y DeepSeek cachean automáticamente ese prefijo y cobran menos por los tokens repetidos. En Groq depende del modelo. Hay una prueba que comprueba que los datos variables siguen al final.

`prompts/cerebro-comercial.md` y `code/preventa/contexto-modelo.js` quedan como candidatos, sin conectar. Se activarán cuando la evaluación del punto 4 del roadmap demuestre que no empeoran las respuestas.

## Correcciones hechas sobre el trabajo previo

- El registro del aviso podía detener la derivación: si el aviso no se insertaba, el `CROSS JOIN` devolvía cero filas. Ahora se usa `LEFT JOIN` con `ON CONFLICT DO NOTHING`. Además, `conversacion_id` y la fecha del handoff admiten ausencia.
- La métrica podía romper el guardado del contexto si `accion` llegaba vacía, por la columna `NOT NULL`. Ahora tiene valores por defecto en SQL y en la expresión. Ya no usa encadenamiento opcional.
- `UNION` sobre `SELECT *` en el historial dependía de los tipos de columna. Ahora une identificadores y conserva el orden cronológico anterior (`enviado_at, id`).
- Se quitó la inyección de SQL y del prompt desde archivos en `inject-code.mjs`. Habría sobrescrito en silencio cualquier cambio hecho en n8n a esos nodos. Las consultas siguen en el workflow, como el resto de los nodos PostgreSQL.
- La recuperación revisa cada 10 minutos en vez de cada 5.

## Coordinación con el trabajo de STATUSIA

Durante esta entrega otro agente trabajó en paralelo sobre STATUSIA. Cambió `preparar-reporte-statusia.js`, añadió `scripts/patch-statusia-query.mjs` y reemplazó la consulta `Consultar uso IA STATUSIA`. Esta entrega no toca esos archivos. Si se quiere ver en STATUSIA el bloque de preventa (FAQ cacheadas, llamadas evitadas, avisos pendientes), hay que agregarlo a la consulta de ese trabajo con `pegaso.metricas_preventa` y `pegaso.notificaciones_humano`.

## Verificación

```powershell
node --test tests/preventa.test.mjs tests/eficiencia-preventa.test.mjs tests/preventa-postgres.test.mjs
node scripts/inject-code.mjs
node scripts/validate-workflow.mjs
node scripts/prepare-update.mjs
node scripts/check-encoding.mjs
```

- 66 pruebas aprobadas: 23 de nodos, 21 de módulos y 22 de SQL contra PostgreSQL 17 temporal en Docker, sin red y con eliminación al terminar. Las pruebas SQL aplican la misma migración que producción.
- Las pruebas SQL nuevas cubren:
  - aviso creado con la derivación;
  - un único aviso con derivaciones concurrentes;
  - derivación que continúa aunque el aviso no se pueda registrar;
  - confirmación solo con la reserva correcta;
  - reintento con espera;
  - recuperación de un envío interrumpido;
  - una métrica por mensaje;
  - historial acotado que conserva la última intervención humana y la última reactivación.
- Una prueba de nodos comprueba que el correo del reintento, armado desde el `payload` guardado, tiene el mismo asunto, la misma categoría y los mismos datos de cotización que el de la ruta principal.
- Validadores de inyección, estructura, payload y encoding: correctos. Los 71 nodos Code del build compilan. Ningún nodo conserva directivas sin expandir. Al extraer el build se reconstruyen exactamente los archivos fuente.
- Comparado con la copia publicada: los tres prompts, `Calcular precio detalle` y `Calcular resumen cotización` son idénticos, y se conservan todos los IDs de nodo.

## Pasos para publicar

1. Aplicar `schema/preventa-eficiencia.sql` en PostgreSQL. Es idempotente. La consulta final, comentada en el archivo, debe devolver 2.
2. Revisar que el trabajo paralelo de STATUSIA esté terminado, porque comparte `workflows/sistema-automatizado-pegaso.edit.json`.
3. Con autorización explícita, ejecutar `push.ps1`.
4. Prueba funcional:
   - «¿qué material usan y hacen envíos?»;
   - «Hola, quiero hacer etiquetas», que debe cotizar sin derivar;
   - cotización seguida de «Hagámoslas», que debe derivar y enviar un correo `[CIERRE COMERCIAL]`;
   - comprobar en `notificaciones_humano` que el aviso queda `ENVIADA`;
   - el comando `STATUSIA`.

## Límites

- Las reglas de compra y las FAQs son deterministas y están cubiertas por pruebas con frases de los chats reales. Frases muy distintas siguen llegando al cerebro, que conserva su sección de intención de pedido.
- El aviso se reintenta sin límite de intentos, como máximo una vez por hora. Si el proveedor de correo no confirma la entrega, el aviso puede llegar duplicado. Se prefiere ese riesgo a perder una venta.
- La evaluación de naturalidad y del prompt compacto con conversaciones reales (punto 4) sigue pendiente.
