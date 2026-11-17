# Roadmap para calificar prospectos y cerrar la venta con Pegaso IA

El objetivo del chatbot es atender los mensajes de publicidad activa, resolver consultas, cotizar con las reglas de Pegaso e identificar a quien desea comprar. Su trabajo termina al registrar la aceptación comercial y derivar al equipo con un resumen útil. El equipo humano se encarga de cobros, validación de pagos, diseños, producción, despacho, envío y posventa.

Enfoque actualizado por indicación de Pegaso el 16 de noviembre de 2026. La definición de cierre comercial es la aceptación explícita de una propuesta identificable. La derivación también procede antes cuando el prospecto expresa intención firme de compra y requiere que una persona concrete los detalles pendientes. El momento de derivar debe aprovechar esa intención.

Este documento recoge el análisis de 11 archivos de chats y del workflow local de 209 nodos. Las propuestas quedan pendientes de implementación y prueba. La versión local del workflow declara `updatedAt` de 2026-11-16T04:43:49.433Z. La entrega de correos y el comportamiento actual en producción requieren comprobación operativa.

Primera entrega local iniciada el 16 de noviembre. Incluye aceptación contextual, entrega al encargado, ficha por correo, continuidad de clientes registrados, deduplicación de entrada y comprobación del permiso antes de los envíos. El workflow editable preparado tiene 225 nodos. La publicación, la prueba operativa, la optimización del prompt y la bandeja persistente de notificaciones siguen pendientes. El detalle de esta entrega está en [el reporte de implementación](reportes/2026-11-16-preventa-cierre-humano.md).

Segunda entrega local preparada el 17 de noviembre (puntos 2 y 5, y aviso persistente del punto 3). Incluye FAQs combinadas sin IA, detección de compra antes del cerebro, memoria del editable, calificación por turno, historial acotado, módulos en `code/preventa/`, métricas de preventa y avisos al encargado con reintento. El prompt comercial publicado se conserva. La versión compacta queda como candidata hasta evaluarla con casos reales (punto 4). Requiere `schema/preventa-eficiencia.sql` antes de publicar. Detalle en [el reporte de la segunda entrega](reportes/2026-11-17-preventa-eficiencia-avisos.md).

## 1. Qué enseñan los chats para la preventa

### Cobertura de la muestra

Se leyeron los 11 archivos completos de `D:\proyectosSoftware\pegaso n8n\Chats con cierres de ventas`. Corresponden a siete conversaciones. Cuatro archivos son exportaciones adicionales de conversaciones ya presentes. La atribución se hizo por contenido y participantes, pues algunos nombres de archivo corresponden a otro contacto.

Inventario de fuentes, con nombres relativos a esa carpeta.

- `chat 096 915 3378.md` contiene Glass Water, del 5 al 16 de noviembre.
- `chat Doris Tonato Helados Fredolone 😋.md` contiene Fredolone, del 30 de julio al 31 de octubre, con varios pedidos.
- `chat Elizabeth Sisa Allkupa Mikuna.md` contiene Allkupa Mikuna, del 20 al 24 de octubre.
- `chat Johana Vinos D-carlito.txt` contiene D-carlito, del 8 al 16 de noviembre.
- `chat Juan Loor - Jugos JuanPa.txt` contiene JuanPa, del 13 de octubre al 10 de noviembre.
- `chat Julio Morejon Jamaica Flower.md` contiene Jamaica Flower, del 8 al 16 de octubre.
- `chat Maria Belén Pinargote Agua Pedregal.md` contiene Pedregal, del 3 al 16 de noviembre.
- `chat Maria Belén Pinargote Agua Pedregal.txt` contiene Glass Water y complementa su exportación Markdown.
- `chat Monica Ilbay Cujano Agua Amanecer.md` contiene Agua Amanecer, del 20 al 24 de octubre.
- `chatMaria Belén Pinargote Agua Pedregal.md` contiene D-carlito y aporta contexto de mensajes citados.
- `chatMaria Belén Pinargote Agua Pedregal.txt` contiene Pedregal y complementa su exportación Markdown.

Los audios, imágenes, videos, documentos y stickers aparecen como referencias u omisiones. La revisión utiliza el texto visible y los mensajes citados disponibles. La etiqueta `Tú` reúne mensajes salientes y carece de información suficiente para atribuir cada respuesta al bot o a una persona. Las anotaciones automáticas de clasificación del chat requieren inspeccionar la herramienta de origen para relacionarlas con una automatización concreta.

La selección contiene cierres conocidos. Para medir conversión y distinguir consultas sin intención de compra hace falta añadir una muestra de consultas que terminaron sin venta.

### Glass Water

El contacto cotiza, vuelve días después, acepta, abona y posteriormente amplía su pedido. El 16 de noviembre acepta una nueva cotización y anuncia un depósito para el día siguiente.

La preventa debe recordar la propuesta elegida y detectar expresiones de avance como «Ya listo agale mañana le deposito». Con una propuesta identificable, esa frase permite registrar aceptación y entregar el contacto al equipo. Las ampliaciones y pagos que ocurren después quedan bajo la atención humana.

### Fredolone

La conversación contiene varios pedidos y una recompra expresada como «Las misma que hicimos la última vez no cambia nada». También aparecen correcciones de forma y de medidas.

El bot debe reconocer al cliente que vuelve, recuperar el contexto disponible y derivar pronto cuando llega dispuesto a comprar. La ficha de entrega debe conservar las últimas especificaciones confirmadas. Una solicitud de recompra puede derivarse con la referencia anterior y los cambios solicitados, aunque el precio vigente requiera revisión humana.

### Allkupa Mikuna

La cliente compara varias presentaciones, agrega y elimina líneas y termina aceptando cuatro diseños. Hay descuentos y envío incluido acordados por una persona.

La preventa necesita diferenciar comparación, selección y aceptación. Debe conservar la selección vigente y derivar la negociación o el cierre con todos los datos conocidos. Los acuerdos históricos de descuento y envío son contexto del caso y requieren una regla vigente para ofrecerlos automáticamente.

### D-carlito

La cliente repite varias veces que carece de editable y luego solicita los datos para transferir. Las correcciones de diseño y una incidencia de despacho ocurren después.

El bot debe recordar la respuesta sobre el editable. La solicitud de cuentas ligada a la propuesta es una señal fuerte para entregar la conversación al encargado. La gestión posterior del pago y del trabajo corresponde al equipo.

### JuanPa

El cliente vuelve dos semanas después, proporciona medidas en milímetros y selecciona dos sabores entre cuatro. La forma de corte genera una aclaración de precio antes de aceptar.

La preventa necesita continuidad entre sesiones, conversión de unidades y claridad sobre cantidad, presentación y corte. «Quiero coordinar para poderlas hacer» exige reconocer intención firme. Si persisten condiciones por concretar, la derivación debe transmitirlas al vendedor.

### Jamaica Flower

El cliente solicita una fecha urgente y después pide la cuenta para transferir el 50%. Las fechas y opciones de transporte requieren intervención comercial.

El bot debe detectar la fecha requerida y entregar el contacto para confirmar viabilidad. Una urgencia concreta y una intención de compra justifican derivación temprana. El equipo acuerda los compromisos de producción y entrega.

### Pedregal y Agua Amanecer

Pedregal retoma una cotización días después y pide los datos para transferencia. Agua Amanecer confirma que desea avanzar y requiere una llegada urgente. Ambas conversaciones incluyen posteriormente pagos, datos de envío, diseños y seguimiento.

La lección para el chatbot es reconocer la decisión de avanzar y entregar el historial relevante a tiempo. Los detalles posteriores permiten comprender qué debe recibir el encargado en el resumen de preventa y qué gestiones llevará personalmente.

## 2. Calificar interés y reconocer el cierre comercial

### Tres situaciones de preventa

- **Consulta informativa.** Pregunta por precio, material, ubicación o funcionamiento. El bot resuelve la duda y propone un siguiente paso pertinente, como facilitar medidas para cotizar.
- **Interés concreto.** Facilita medidas, cantidad, producto, diseño o fecha y compara opciones. El bot recuerda los datos, aclara las dudas y ayuda a elegir una propuesta.
- **Decisión de compra.** Acepta una cotización identificable, elige una opción y pide avanzar, solicita cuentas para ese trabajo o pide coordinar la compra. El bot registra el motivo y deriva al encargado.

La clasificación cambia según los mensajes y su contexto. Preguntar mucho puede formar parte de una compra real. Una consulta breve merece una respuesta útil y la oportunidad de avanzar. La cantidad de preguntas, el tono y la rapidez de respuesta aportan contexto, mientras la clasificación comercial se apoya en las acciones y compromisos expresados.

### Cierre comercial para el objetivo del chatbot

El cierre se registra cuando el prospecto acepta una propuesta identificable y expresa que desea realizar la compra. La evidencia debe apuntar a la cotización o a la opción elegida y al mensaje de aceptación. El evento puede llamarse `CIERRE_COMERCIAL_ACEPTADO` y utilizarse para medir el resultado de preventa.

El interés firme con condiciones pendientes genera una derivación como `INTERES_FIRME_PARA_COORDINAR`. Esta salida permite que el humano concrete lo que falta. Los datos disponibles acompañan la entrega, y los pendientes se señalan expresamente.

Las confirmaciones breves se interpretan con la pregunta previa. «Sí» después de «¿Desea realizar este pedido?» puede confirmar la compra. «Sí» después de «¿Le envío información del material?» mantiene la conversación en consulta. «Mañana le deposito» después de una propuesta aceptada permite registrar el cierre comercial y entregar la conversación al equipo. El importe bancario real lo corrobora el encargado.

La petición de una persona, una negociación, una excepción o un reclamo conserva sus motivos propios de derivación. El registro distingue esos motivos del cierre comercial aceptado para medir correctamente cada resultado.

## 3. Entrega al humano y notificación

### Secuencia de entrega

1. Identificar la aceptación comercial o la necesidad de coordinación humana.
2. Guardar el evento, su evidencia, el resumen comercial y el estado de derivación de la conversación.
3. Preparar una única transición breve para el prospecto, cuando corresponda y la atención humana todavía esté pendiente de inicio.
4. Encolar el correo al equipo con el evento y los datos conocidos.
5. Mantener la conversación bajo atención humana hasta una reactivación administrativa explícita.

Ejemplo de transición al registrar una compra aceptada.

> Perfecto, muchas gracias. Le comunicamos con el encargado para coordinar su compra. Ya le compartimos la cotización y los detalles que nos indicó.

El texto debe reflejar la transferencia realizada. La toma efectiva por una persona se registra aparte. Si ya existe intervención humana, la entrega actualiza la tarea interna correspondiente.

### Correo de cierre comercial

Asunto propuesto para una aceptación ligada a cotización.

`[CIERRE COMERCIAL] Cotización <id> · requiere coordinación humana`

Para intención firme con detalles pendientes.

`[INTERESADO EN COMPRAR] Conversación <id> · requiere coordinación`

El correo incluye los datos conocidos de la conversación.

- Nombre y contacto del prospecto, conversación y referencia accesible para atenderlo.
- Producto, cantidad, medidas, forma, presentaciones y cotización elegida.
- Precio cotizado y condiciones comerciales efectivamente comunicadas.
- Ciudad y fecha requerida, cuando se hayan facilitado.
- Diseño o referencia recibida y lo que el cliente dijo sobre el editable.
- Mensaje que evidencia la aceptación o el interés firme.
- Datos pendientes, motivo de derivación, fecha del evento y encargado asignado o pendiente de asignación.

La alerta de cierre informa de la aceptación comercial. El equipo corrobora los cobros, pagos y demás requisitos operativos durante su atención.

### Evitar interferencia en una conversación encaminada

El estado de atención humana debe persistirse antes de preparar nuevas respuestas comerciales. Cada envío automático pendiente debe comprobar de nuevo ese permiso inmediatamente antes de salir. Esto cubre mensajes que quedaron en debounce, una llamada a IA iniciada antes del cierre y eventos que llegan simultáneamente.

El control debe reutilizar `requiere_humano`, el contexto de handoff y el registro de intervención humana existentes. Una vez derivado, los mensajes siguientes se conservan como parte de la conversación del encargado. Las consultas posteriores sobre cuentas, pagos, cambios, aprobación, despacho o envío se atienden dentro de esa gestión humana.

La reanudación depende de una acción administrativa explícita, aprovechando el mecanismo `ACTIVEBOT` y comprobando el estado persistido de la derivación. También se debe revisar la posibilidad de una conversación nueva o de un contacto ya registrado para conservar la propiedad de atención entre sesiones.

### Entrega fiable del correo

Registrar el evento de cierre y su notificación pendiente junto con el estado de derivación. El envío puede reutilizar Brevo y Resend. Los fallos recuperables se reintentan desde ese registro, con una clave estable ligada a la conversación, cotización y evento de aceptación.

La recepción duplicada del mismo evento debe conservar una sola derivación y una sola alerta lógica. Una nueva oportunidad aceptada por el mismo contacto sí admite un evento nuevo. Si el proveedor deja incierto si aceptó un correo, se registra la incertidumbre y se consulta su estado o mecanismo de idempotencia antes de reenviar.

El fallo del correo mantiene la tarea visible y pendiente para el equipo. El estado de atención humana persiste durante su recuperación. La toma de atención se registra para distinguir aviso enviado de prospecto atendido. Los recordatorios propuestos son internos y se agrupan por derivación pendiente.

### Ejemplo de conversación hasta la entrega

1. El prospecto pregunta el precio desde un anuncio. El bot responde y pide las medidas necesarias para cotizar.
2. El prospecto indica producto, medidas y cantidad. El bot devuelve la cotización calculada por el flujo existente.
3. El prospecto pregunta por material y metodología. El bot aclara esas dudas, recuerda la cotización y pregunta si desea avanzar cuando el contexto lo permita.
4. El prospecto dice «Está bien, hagámoslas. Ayúdeme con los datos de cuenta».
5. El bot registra la aceptación de esa propuesta, guarda la derivación, prepara la transición y notifica al encargado.
6. El encargado continúa la conversación, acuerda el cobro, corrobora el pago y gestiona el trabajo con el cliente.

Si el prospecto llega diciendo «Quiero realizar el pedido que cotizamos», la entrega puede producirse en ese mismo turno. La conversación debe aprovechar los acuerdos disponibles y señalar cualquier dato que aún deba concretar el equipo.

## 4. Qué aporta la implementación actual

El workflow local inspeccionado contiene 209 nodos, incluidos 71 Code y 37 de PostgreSQL. Están presentes las FAQs previas a IA, el contexto comercial, las cotizaciones P4 deterministas, catálogos, audio, imagen, cascada de proveedores, intervención humana y comandos administrativos.

El correo clasifica interés de pago, pago reportado, archivos, negociación y reclamos. Brevo utiliza Resend como respaldo ante error. El contexto de handoff guarda motivo, intención, prioridad y mensaje del cliente. Son componentes reutilizables para la alerta de cierre comercial. [Preparación de alertas](../code/_extraidos/peparar-notificacion-humano.js) · [Contexto de derivación](../code/_extraidos/preparar-contexto-handoff.js)

Hallazgos relevantes para este enfoque.

1. La salida verdadera de `¿Cliente existente?` está vacía. Necesita un destino que respete la atención humana y permita entregar solicitudes de recompra al equipo.
2. `REGISTRAR_ACEPTACION` tiene una salida vacía. Debe conectarse al registro del cierre comercial y a la derivación. `PEDIR_PRODUCTO ` tiene un espacio final frente al valor de los validadores, que requiere corrección y prueba.
3. La rama de `¿Requiere atención humana?` termina después de guardar el mensaje entrante. Este comportamiento sirve como base para el silencio del bot durante la atención humana. La mejora relevante consiste en asegurar la entrega inicial y el respeto de ese estado por respuestas pendientes y sesiones posteriores.
4. Ambas salidas de `IF: ¿Requiere notificación?` apuntan al mismo preparador. Hay que definir la condición efectiva de aviso y deduplicación por derivación.
5. El correo contiene motivo, prioridad, último mensaje e identificadores. Puede enriquecerse con la propuesta elegida, la evidencia de aceptación y los datos conocidos.
6. El texto de cada cerebro ronda 59.900 caracteres y añade unos 3.450 de esquema. El historial libre se limita a 24 horas y 10 mensajes. La consulta recupera todos los mensajes antes del recorte. La optimización debe conservar los hechos de preventa y el estado de atención.
7. `STATUSIA` y el registro de intentos están presentes en el workflow local. Su operación efectiva requiere verificar tabla e inserciones. Los errores generales de IA ya tienen continuidad hacia derivación o normalización.

El esquema SQL también contiene tablas para pedidos, pagos y operaciones posteriores. Para el objetivo de preventa, los datos esenciales son la conversación, el prospecto, la cotización, la aceptación y la derivación. La existencia de las tablas operativas aporta contexto sobre el sistema completo. [Workflow inspeccionado](../workflows/sistema-automatizado-pegaso.edit.json) · [Esquema existente](../schema/pegaso_schema.sql)

La ruta actual `ENVIAR_DATOS_PAGO` ya existe. Su comportamiento se deberá alinear con el límite solicitado, situando la solicitud de cobro y coordinación bancaria bajo la atención del encargado al concretarse la compra. Ese ajuste necesita una entrega acotada con casos que cubran las consultas informativas sobre metodología y las solicitudes explícitas de compra.

## 5. Roadmap de cinco mejoras

### Punto 1. Asegurar rutas y transferencia de atención

**Resultado esperado.** El prospecto decidido llega al equipo y la conversación queda bajo atención humana.

- Conectar la aceptación comercial con la derivación y corregir las comparaciones de acciones.
- Completar el destino para clientes registrados y solicitudes de recompra.
- Respetar el estado de atención humana en todos los puntos de salida automática y en mensajes concurrentes o pendientes.
- Comprobar la reactivación administrativa y la continuidad entre sesiones.

Criterios de aceptación.

- «Hagámoslas» ligado a una cotización produce un evento de cierre, una derivación y una notificación lógica.
- La intervención humana bloquea las respuestas comerciales automáticas pendientes.
- Los mensajes posteriores quedan disponibles para el encargado.
- El regreso del contacto días después conserva la atención humana asignada hasta una reactivación administrativa explícita.

### Punto 2. Mejorar la conversación y calificar intención

**Resultado esperado.** Resolver consultas de publicidad y reconocer a quien quiere comprar con los datos y el contexto pertinentes.

- Utilizar los tres niveles de consulta, interés concreto y decisión de compra, actualizables por turno.
- Recordar producto, medidas, cantidad, opciones cotizadas y respuestas sobre diseño o editable.
- Contestar la duda actual y proponer un siguiente paso adecuado. Reconocer una decisión expresa de avanzar en cuanto aparezca.
- Reducir el contexto enviado a IA y acotar la consulta de historial manteniendo hechos de preventa y permiso de atención.
- Conservar las reglas de precio y las FAQs actuales, incluyendo preguntas combinadas.

Criterios de aceptación.

- Un cliente puede hacer varias preguntas y seguir avanzando comercialmente según sus respuestas.
- «Solo estoy viendo precios» conserva una atención informativa adecuada.
- «Quiero realizar ese pedido» recibe entrega inmediata al encargado con los datos conocidos.
- «Sí» se interpreta con la pregunta anterior y la propuesta identificada.
- El contexto de Johana conserva que carece de editable y evita repetir esa pregunta.

### Punto 3. Registrar y notificar el cierre comercial

**Resultado esperado.** El equipo recibe una entrega breve, completa y trazable en cuanto el prospecto decide comprar.

- Guardar aceptación, referencia de propuesta, evidencia del turno y motivo de derivación.
- Reutilizar el handoff y el correo para los eventos de cierre aceptado e interés firme con detalles pendientes.
- Añadir la ficha de preventa al correo y registrar la toma de atención.
- Persistir y reintentar la notificación, deduplicar eventos y mantener visible cualquier fallo pendiente.
- Configurar destinatarios, responsable y recordatorio interno según la operación del equipo.

Criterios de aceptación.

- El cierre comercial se registra al aceptar la propuesta, antes de la gestión humana del cobro.
- La solicitud de cuentas de un prospecto decidido activa la entrega al encargado.
- La falta de un dato secundario aparece en el resumen y permite que la entrega continúe.
- Un webhook repetido mantiene un único evento lógico de aceptación y aviso.
- El fallo de correo conserva derivación y tarea pendiente con posibilidad de recuperación.

### Punto 4. Evaluar con los chats reales y medir preventa

**Resultado esperado.** Cada entrega demuestra que mejora la calificación y el cierre respetando la atención humana.

- Preparar casos anonimizados de las siete conversaciones y añadir consultas reales que acabaron sin compra.
- Ejecutar una línea base antes de cambiar el comportamiento y repetirla tras cada entrega.
- Verificar respuesta, clasificación, propuesta elegida, momento de derivación y número de avisos.
- Probar el silencio del bot durante atención humana con mensajes nuevos, respuestas de IA tardías y ejecuciones concurrentes.
- Ejecutar los casos con destinos y datos de prueba. Los audios e imágenes omitidos requieren fixtures específicos.

Casos mínimos propuestos.

1. Consulta general de precio y material.
2. Muchas preguntas seguidas de una compra aceptada.
3. Consulta informativa sin decisión de compra.
4. Medidas, cantidad y corrección de forma antes de aceptar.
5. Varias opciones y elección de una propuesta concreta.
6. Falta de editable ya comunicada.
7. «Sí» como permiso para recibir información.
8. «Sí» como aceptación de una cotización.
9. «Mañana le deposito» tras aceptar una propuesta.
10. Solicitud de cuentas para realizar la compra.
11. Intención firme con datos todavía pendientes.
12. Urgencia o negociación que requiere un encargado.
13. Cliente registrado o recompra reconocida.
14. Webhook duplicado y cierre concurrente.
15. Respuesta de IA pendiente cuando comienza la intervención humana.
16. Mensaje de pago, diseño o envío recibido después de derivar.
17. Contacto que regresa días después con la atención humana activa.
18. Fallo de IA, fallo de Brevo y recuperación o fallo de Resend.

Criterios de aceptación.

- Cada aceptación identificada tiene entrega comprobada al equipo.
- Cada derivación activa mantiene el control humano de la conversación.
- Las consultas informativas se distinguen del cierre aceptado según el contexto.
- Los resultados registran fallos pendientes y diferencias frente a la línea base.

Las evaluaciones de n8n permiten comparar resultados de casos conocidos y revisar regresiones. La forma de ejecutarlas debe ajustarse a la instalación disponible. [Evaluaciones de n8n](https://docs.n8n.io/advanced-ai/evaluations/overview/)

### Punto 5. Modularizar y preparar el crecimiento

**Resultado esperado.** Atender más mensajes manteniendo consistencia y claridad sobre quién responde.

- Separar gradualmente entrada, contexto de preventa, decisión, cotización y derivación/notificación mediante contratos explícitos.
- Controlar las actualizaciones concurrentes de la misma conversación para conservar aceptación y propietario de atención.
- Medir volumen, latencias, uso de proveedores, carga PostgreSQL y notificaciones pendientes.
- Dimensionar ejecución y trabajadores según las mediciones y la versión instalada. [Subworkflows](https://docs.n8n.io/flow-logic/subworkflows/) · [Modo cola](https://docs.n8n.io/hosting/scaling/queue-mode/)

Criterios de aceptación.

- Cada extracción conserva las reglas comerciales y el permiso de respuesta en los casos evaluados.
- Las ejecuciones concurrentes respetan la derivación activa y deduplican el cierre.
- Las pruebas de carga reportan resultados observados para un objetivo basado en el volumen real.

## 6. Orden de trabajo e indicadores

Preparar primero la línea base del punto 4. Avanzar con las rutas y el control de atención del punto 1, la notificación de cierre del punto 3 y la conversación del punto 2. Modularizar gradualmente con el punto 5. Cada entrega incorpora sus casos antes de habilitar su comportamiento.

La primera entrega propuesta conecta aceptación, pausa persistente del bot y correo con resumen comercial, reforzando la protección frente a respuestas que estaban en curso. Debe probarse con el handoff existente, la intervención humana y la reactivación administrativa.

Indicadores de preventa propuestos.

- Contactos únicos de publicidad atendidos y consultas respondidas.
- Prospectos con interés concreto y cotizaciones enviadas.
- Propuestas aceptadas con evidencia de cierre comercial.
- Derivaciones por interés firme, por cierre y por otros motivos.
- Tiempo entre decisión de compra, aviso al equipo y toma de atención.
- Alertas duplicadas o pendientes de entrega.
- Respuestas automáticas emitidas durante una derivación activa.
- Coste y latencia por conversación de preventa.

Cada indicador debe definir su denominador y distinguir contacto, conversación y oportunidad para contar correctamente a quien regresa. El cierre del bot mide la aceptación comercial. Los resultados financieros pueden incorporarse después desde el registro del equipo para conocer qué proporción de las entregas terminó en venta efectivamente cobrada.

## 7. Estado y verificación del documento

La revisión original leyó los 11 exportados y agrupó siete conversaciones. Se inspeccionaron conexiones, reglas de enrutamiento, atención humana, correos, contexto y esquema SQL. Los 71 nodos Code del workflow local compilaron sintácticamente con `new Function`. El funcionamiento en n8n y WhatsApp requiere las pruebas operativas de cada entrega.

La actualización de alcance sitúa el cierre en la aceptación comercial y concentra el roadmap en publicidad, calificación, cotización y entrega al humano. La revisión anterior había ampliado las propuestas hacia la gestión posterior de pagos y producción. Las responsabilidades operativas quedan asignadas al equipo humano conforme a la indicación de Pegaso.

Esta entrega modifica el documento de roadmap. Las propuestas de código y despliegue quedan para las entregas correspondientes. Al iniciar esta actualización ya existían cambios locales en `code/_extraidos/manifest.json` y `state/remote-base.json`.
