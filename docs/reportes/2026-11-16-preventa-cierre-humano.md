# Primera entrega de preventa y cierre al humano

Estado preparado en local el 16 de noviembre de 2026. Publicación en n8n y prueba operativa pendientes. El workflow editable pasa de 209 a 225 nodos al incorporar ocho parejas de consulta y condición previas a los envíos de WhatsApp.

## Resultado implementado

- Reconocimiento contextual de aceptación comercial y de intención firme con detalles pendientes. La evidencia y la propuesta se conservan en `contexto_comercial.cierre_comercial`.
- Una confirmación breve se interpreta con la pregunta inmediatamente anterior. Se cubren consultas, negaciones y expresiones hipotéticas para evitar clasificarlas como aceptación.
- La compra aceptada conduce a la derivación existente, con transición breve y correo de prioridad alta. El correo contiene cotización, producto, cantidad, medidas, total conocido, diseño y fecha requerida disponibles.
- La solicitud de datos de pago que llega a la acción correspondiente conduce al encargado. El equipo coordina el cobro y los pasos posteriores.
- La rama de clientes registrados continúa al circuito de prospecto y conversación, conservando cliente, contacto y atención humana.
- La comparación de `PEDIR_PRODUCTO` utiliza el valor de los validadores. `REGISTRAR_ACEPTACION` tiene continuidad de respuesta. Las aceptaciones verificadas por el resolver utilizan la ruta `DERIVAR_HUMANO`.
- El INSERT entrante utiliza parámetros y la restricción única existente para terminar reintentos del mismo webhook con cero filas. La primera ejecución conserva el mensaje original.
- La actualización condicional del prospecto adjudica una sola derivación entre ejecuciones concurrentes.
- Los guardados comerciales tardíos preservan el contexto de la conversación cuando el prospecto ya está bajo atención humana.
- Antes de cada uno de los ocho HTTP de salida se consulta el estado persistido. Un mensaje supersedido o una intervención humana puede detener la salida. El handoff actual dispone de una excepción identificada para enviar su propia transición.

Los ocho destinos protegidos son texto, imagen, cuatro videos, saludo y nota de IVA. Sus cuerpos HTTP siguen leyendo los datos de `Preparar envío WhatsApp`.

## Comprobación de los casos compartidos

El caso «Necesito para los vasos de 7 onzas circular y que precio tiene» conserva la preventa y solicita medidas en centímetros en la prueba del resolver local. Esta corrección ya estaba presente antes de esta entrega y quedó cubierta por un caso de regresión.

El texto `10*15 cm` con las medidas extraídas continúa a `COTIZAR_P4` en la prueba local. Se comprueba además en PostgreSQL que una respuesta al mensaje anterior se detiene si llegaron medidas nuevas, mientras la respuesta al mensaje nuevo conserva permiso para avanzar.

La captura de respuestas idénticas es compatible con ejecuciones superpuestas y reintentos. La revisión cubre esos mecanismos con pruebas específicas. La causa exacta de esa conversación requiere sus ejecuciones y eventos originales de n8n.

## Verificación realizada

Pasaron **35 pruebas**, con 22 casos de lógica y contratos de nodos y 13 de consultas PostgreSQL y estructura de envío. Las pruebas SQL utilizan PostgreSQL 17 temporal en Docker, sin puertos publicados ni montajes del equipo. El contenedor se elimina al finalizar.

```powershell
node --test tests/preventa.test.mjs tests/preventa-postgres.test.mjs
node scripts/inject-code.mjs
node scripts/validate-workflow.mjs
node scripts/prepare-update.mjs
node scripts/check-encoding.mjs
git diff --check
```

La batería ejecuta el código de los nodos y las consultas que contiene el workflow editable. Cubre aceptación, confirmación contextual, consultas sin compra, evidencia y resumen a través de la finalización del handoff, escape HTML del correo de cierre, webhooks repetidos, derivación concurrente, humano que interviene, mensajes supersedidos, conservación del contexto y protección de las ocho salidas.

Los validadores de inyección, estructura, payload y encoding finalizaron correctamente. Los 71 nodos Code del build compilan sintácticamente. Se verificó la conservación de todos los identificadores existentes y la igualdad del nodo de cálculo de precio y de los tres prompts comerciales con la copia de partida. `activeVersion` conserva la versión descargada. El build y el payload se generaron en `build/` mediante los scripts existentes.

## Archivos de la entrega

- `code/_extraidos/resolver-contexto-comercial.js` contiene la detección de compra al final de la resolución comercial.
- `code/_extraidos/preparar-contexto-handoff.js`, `preparar-mensaje-transicion-humano.js` y `finalizar-derivacion-humana.js` conservan la evidencia y preparan la entrega.
- `code/_extraidos/peparar-notificacion-humano.js` prepara la ficha y el asunto del cierre.
- `code/_extraidos/preparar-envio-whatsapp.js` expone la marca del handoff propio para la autorización de salida.
- `workflows/sistema-automatizado-pegaso.edit.json` contiene las rutas corregidas, consultas parametrizadas y las ocho parejas de autorización.
- `tests/preventa.test.mjs` y `tests/preventa-postgres.test.mjs` verifican la primera entrega.
- `docs/FLUJO-WORKFLOW-PEGASO.md`, sección 19, documenta las fichas, conexiones y finales nuevos. El roadmap indica el avance local.

Al comenzar ya había cambios en `code/_extraidos/manifest.json` y `state/remote-base.json`. Permanecen como estado previo del espacio de trabajo.

## Límites y siguientes comprobaciones

Las pruebas locales ejecutan los nodos Code con contratos simulados y las consultas sobre tablas de prueba. Hace falta validar el flujo en la versión instalada de n8n, sus expresiones, las credenciales existentes, la estructura real de la base y la entrega de mensajes y correos.

La autorización precede a cada HTTP. Existe un intervalo entre la consulta de permiso y el envío externo en el que puede entrar otro evento. Las comprobaciones reducen respuestas tardías y reutilizan el tratamiento existente de ecos humanos y automáticos. La clasificación de esos ecos requiere comprobarse con YCloud real.

La adquisición condicional de la derivación impide que dos ejecuciones simultáneas continúen con la misma adjudicación. Una caída después de adjudicarla y antes de completar el aviso requiere recuperación operativa. La bandeja persistente con reintentos y acuse del correo sigue pendiente en el roadmap.

La afinación de naturalidad, la reducción del prompt y la ampliación de variantes conversacionales continúan en las siguientes entregas. Esta primera entrega establece el recorrido de aceptación y atención humana con pruebas de regresión.

Antes de publicar, comprobar el control de concurrencia remoto del script y ejecutar un smoke test en un flujo de ensayo. Después, probar los casos de las capturas, una aceptación de cotización, un cliente registrado, una intervención humana mientras se procesa la IA y el correo con resumen. La autorización explícita de publicación se rige por [las reglas del repositorio](../REGLAS-PARA-CURSOR.md).
