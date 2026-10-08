# Pendientes técnicos

Posibles bugs e inconsistencias detectados al revisar el código y la configuración de los nodos (octubre 2026). Los corregidos quedan ~~tachados~~ con la fecha; los que además requieren un cambio manual en n8n lo indican. Los que dependen de configuración aún no documentada se marcan "verificar". Las etapas 01–08 ya tienen su configuración revisada (ver `docs/etapas/`).

Los números son identificadores fijos (los citan tests y otros documentos): no se renumeran. Al resolver uno, márcalo ~~tachado~~ con la fecha o bórralo, y actualiza la doc afectada.

## Prioridad alta (afectan al cliente o a los datos)

28. **El webhook no tiene autenticación.**
    "Webhook YCloud" tiene `Authentication: None`. Cualquiera que conozca la URL puede enviar mensajes falsos: gasta créditos de IA, crea prospectos basura y puede hacer que el bot escriba por WhatsApp a números arbitrarios desde el número de Pegaso. Solución: verificar la firma que YCloud envía en cada webhook (cabecera de firma con el secreto del endpoint) o, como mínimo, un *Header Auth* en el nodo.

36. **"Preparar actualización prospecto" pisa el prospecto en cada mensaje.**
    Recibe `$input` de "Guardar contexto comercial", que es un UPDATE y devuelve la **fila de conversaciones**, no la decisión. Esa fila no tiene `intencion`, `accion`, `producto`, `prospecto_estado` ni `prospecto_ciudad`, así que "Actualizar prospecto comercial" escribe `estado = NUEVO`, `ultima_intencion`, `ultima_accion`, `producto_interes`, `ciudad` y `provincia` en `null`, y `requiere_humano = false`. Un prospecto COTIZADO vuelve a NUEVO con el siguiente mensaje (y la rama de respuesta lo pasa a EN_CONVERSACION). Fixture: `04-preparar-actualizacion-prospecto--recibe-fila-conversacion`. *Verificar* con una ejecución (entrada del nodo) o con `SELECT estado, ultima_intencion, ultima_accion FROM pegaso.prospectos`: si `ultima_intencion` está siempre vacía, está confirmado. Solución: leer `$('Aplicar reglas comerciales determinísticas').first().json` en lugar de `$input`.

41. **Todas las cotizaciones quedan a nombre del cliente 1.**
    "EDT Datos cotización" tiene `cliente_id: 1` y `contacto_id: 1` escritos a mano. Ese `cliente_id` viaja por toda la etapa 07:
    - las cotizaciones y los diseños de **todos** los prospectos quedan en el cliente 1;
    - un prospecto puede reutilizar el diseño "Etiqueta 10x5 cm rectangular" creado para otro;
    - en la rama no producible, "Guardar mensaje comercial" guarda el mensaje del prospecto con `cliente_id = 1`.

    La cotización tampoco queda ligada al prospecto ni a la conversación (solo vía `contexto_comercial`). Fixtures: `07-expandir-detalles--nombre-tecnico`, `07-validar-producibilidad-p4--medida-1x5` y `07-construir-mensaje-comercial--no-producible-hereda-cliente-1`. Solución: usar `$('Recuperar decisión comercial').first().json.cliente_id` / `contacto_id`. Si un prospecto no tiene cliente, decidir si la cotización se guarda con `prospecto_id`, lo que requiere una columna nueva o un cliente por prospecto. *Verificar* el mapeo de "Insert cotización".

1. ~~**El contexto comercial guardado no llega a la IA, y cada mensaje lo borra.**~~ **Resuelto 2026-10-07** (solo código, sin cambios en n8n).
   ~~`resolver-conversacion-prospecto.js` no copiaba `contexto_comercial` de la fila de `conversaciones`, y "Preparar contexto IA" reconstruía el objeto descartando `handoff`, `ultima_restriccion_comercial`, `producto`, `material` y leyendo `cotizacion.cantidad` en vez de `cantidad_solicitada` / `cantidad_cotizable`.~~
   Ahora "Resolver conversación prospecto" (v1.1) expone `conversacion_contexto_comercial` y "Preparar contexto IA" (v3.0) conserva todas las claves (`...previo`). Fixtures: `03-resolver-conversacion--existente`, `03-preparar-contexto-ia--conserva-memoria`, `03-preparar-contexto-ia--nuevo-turno-con-memoria`. `preparar-conversacion-creada.js` no necesita cambio: una conversación recién creada no tiene memoria.

2. ~~**La regla de medida no producible se pierde.**~~ **Resuelto 2026-10-07 — requiere confirmar en n8n que la salida `MEDIDA_NO_PRODUCIBLE` del Switch vaya a "Preparar respuesta comercial".**
   ~~"Resolver contexto comercial" convertía `MEDIDA_NO_PRODUCIBLE` en `COTIZAR_P4` y "Recuperar decisión comercial" ignoraba el `RESPONDER_NO_PRODUCIBLE` de "Aplicar reglas comerciales determinísticas".~~
   Ahora "Resolver contexto comercial" (v2.3) termina en `MEDIDA_NO_PRODUCIBLE`, "Aplicar reglas comerciales determinísticas" (v2.0) usa ese mismo nombre y solo actúa en acciones de cotización, y "Recuperar decisión comercial" (v2.3) aplica su bloqueo. Fixtures: `04-resolver-contexto-comercial--medida-no-producible`, `04-aplicar-reglas-comerciales--medida-1cm`, `--derivacion-no-se-bloquea`, `04-recuperar-decision-comercial--respeta-medida-no-producible` y `--sin-restriccion-usa-resolver`.

3. ~~**`MEDIDA_NO_PRODUCIBLE` no está en el schema ni en el prompt del cerebro.**~~ **Resuelto 2026-10-07 — requiere `npm run build` para llevar schema y prompt a n8n.**
   ~~El validador la exige para lados ≤ 1 cm, pero el schema no la permite.~~ Agregada al enum de `schemas/cerebro-comercial.schema.json` y explicada en `prompts/cerebro-comercial.md` §8.

4. **Si ninguna IA funciona, el cliente no recibe respuesta.**
   "Error ninguna IA funciono" (cerebro y cotización) devuelve un objeto fijo sin responder, sin marcar el mensaje ni avisar al equipo.

5. **El prospecto pasa a COTIZADO aunque la medida no sea producible.**
   `resolver-estado-post-cotizacion.js` pone `actualizar_estado_prospecto = true` siempre que haya prospecto, deshaciendo lo que decidió "Preparar contexto post cotización". Confirmado: el IF "IF ¿Actualizar prospecto cotizado" evalúa ese campo, y "Actualizar prospecto cotizado" escribe `COTIZADO` con `ultima_intencion = SOLICITAR_COTIZACION` y `ultima_accion = COTIZAR_P4` fijos. Fixture: `07-resolver-estado-post-cotizacion--no-producible-marca-cotizado`. Solución: respetar `contexto.actualizar_estado_prospecto` en el `existeProspecto && …`.

6. **Se guardan cotización y diseños antes de validar producibilidad.**
   "Validar producibilidad P4" corre después de "Insert cotización" y "Crear diseño": una medida no producible deja una cotización sin detalles ni totales y diseños de una medida imposible en la base. Desde 2026-10-07 los lados ≤ 1 cm ya no llegan al cotizador (pendiente 2); sigue pasando con lados de más de 1 y menos de 2 cm (pendiente 8). Confirmado con la configuración ([etapas/07](etapas/07-cotizacion.md)). Fixture: `07-validar-producibilidad-p4--medida-1x5`.

7. **Redondeo con error de punto flotante cobra $1 de más.**
   `Math.ceil(469.00000000000006)` = 470. Ejemplo: 10×14 rectangular × 5000 unidades. Se corrige redondeando a centavos antes del `ceil`. Fixture: `07-calcular-precio-detalle--redondeo-flotante` (al corregirlo, su esperado pasa a 469).

## Prioridad media (reglas inconsistentes)

8. **Umbral de medida mínima distinto**: ≤ 1 cm en el cerebro, < 2 cm en cotización. Una etiqueta de 1,5 cm pasa el cerebro y se bloquea en cotización con un mensaje genérico ("No podemos producir las etiquetas con las medidas indicadas…"). Fixture: `07-construir-mensaje-no-producible--medida-1-5cm`.

42. **"Calcular precio detalle" empareja por posición.**
    Toma nombre, sabor, `cantidad_original` y `minimo_aplicado` de `$('EXPANDIR DETALLES').all()[index]`. Pero sus items vienen de "Unificar diseños" (Append), que pone primero una rama y luego la otra. Con detalles de diseño existente y nuevo mezclados, cada fila recibe los datos de otro detalle. El precio es correcto, porque usa las medidas de la fila, pero el nombre y la aclaración de cantidad del mensaje no. Fixture: `07-calcular-precio-detalle--emparejado-por-indice`. Solución: emparejar por `detalle_index`, que requiere guardarlo o propagarlo, o por medidas y diseño.

43. **El segundo mensaje de la cotización nunca sale.**
    "Preparar mensaje cotización" genera `mensaje_variacion_precio` ("El precio se calcula en base a las medidas…") y `mensajes_comerciales` con dos textos. Pero "Guardar mensaje comercial" solo guarda `mensaje_comercial`, y la etapa 08 envía una fila. Decidir si se envía, por ejemplo con un segundo INSERT o un Split de `mensajes_comerciales`, o si se elimina.

45. **"1.000 → 1.000" cuando el cliente no dio cantidad.**
    "EXPANDIR DETALLES" no propaga `cantidad_asumida` y cambia `cantidad_original: null` por la cantidad. "Preparar mensaje cotización" ve entonces `minimo_aplicado = true`, `cantidad_asumida = false` y `cantidad_original = 1000`, y agrega "…las cantidades solicitadas se ajustan así: 1.000 → 1.000." Ocurre cuando el extractor devuelve `cantidad: null`. Fixtures: `07-expandir-detalles--nombre-tecnico` y `07-preparar-mensaje-cotizacion`. Solución: en `expandir-detalles.js` conservar `cantidad_original` tal cual y propagar `cantidad_asumida`.

46. **Sin detalles válidos igual se crea la cotización y la ejecución falla.**
    Después de "Preparar datos cotización" no hay un IF sobre `can_quote`. Con `NO_VALID_DETAILS` (p. ej. el extractor no encontró medidas) se ejecuta "Insert cotización" y luego "EXPANDIR DETALLES" lanza error: el cliente no recibe respuesta y queda una cotización vacía. Fixtures: `07-preparar-datos-cotizacion--sin-medidas` y `07-expandir-detalles--sin-detalles`.

47. **"Update cotizacion_detalles" pone `requiere_cotizacion_manual = false` siempre.**
    El toggle de esa columna está apagado en el mapeo, así que pisa el valor del INSERT. Hoy no se nota porque todo es P4 (pendiente 12). Solución: mapear `{{ $json.requiere_cotizacion_manual }}` o quitar la columna del UPDATE.

9. **Precios que no suben con el tamaño**:
   - 4×2 cm ($5,76/mil → $6) es mucho más barato que 3×3 ($18).
   - 4×5 ($14,40/mil) más barato que 4×4 ($20).
   - 9,9×10 ($71,28/mil) más caro que 10×10 ($67).
   - Con 10.000 unidades, los precios fijos no reciben descuento por volumen.

10. **Dos catálogos de estados de prospecto** (ver [reglas-comerciales.md §11](reglas-comerciales.md#11-estados-del-prospecto)). `resolver-estado-prospecto.js` lanza error con estados que usan otros nodos (INTERESADO, CALIFICADO…). Fixture: `05-resolver-estado-prospecto--estado-fuera-de-catalogo`.

11. ~~**Motivos de handoff con nombres distintos** entre `preparar-derivacion-humana.js`, el schema del cerebro y `preparar-notificacion-humano.js`: pedir datos de pago salía con asunto genérico y la notificación podía bajar la prioridad de ALTA a MEDIA.~~ **Resuelto 2026-10-07** (solo código). "Peparar notificacion humano" (v3.0) reconoce los nombres de los tres nodos (`SOLICITA_DATOS_PAGO` → `INTERESADO_PAGO`, `CONFIRMAR_PEDIDO` / `DESEA_CONTINUAR_PEDIDO` → `CONTINUAR_PEDIDO`, `NEGOCIACION` / `NEGOCIACION_COMERCIAL` → `NEGOCIACION`…) y la prioridad solo sube. Fixtures: `06-preparar-notificacion-humano--datos-pago-interesado-pago` y `--llamada-no-baja-prioridad`.

12. **El material nunca llega al catálogo.** El schema del extractor no tiene `material` y "Preparar datos cotización" lo elimina; todo se cotiza como P4 y `requiere_cotizacion_manual` nunca se activa (y si se activara, "Update cotizacion_detalles" la vuelve a `false`, pendiente 47). Fixture de lo que pasaría con couché: `07-resolver-catalogo-pegaso--couche-manual`.

13. **`MODO_PRUEBA` abierto por error**: si `valor_json` no trae `activo`, el bot responde a todos.

14. **Cantidad anterior pisada por 1000**: el validador pone 1000 si falta la cantidad antes de consolidar con el contexto; si el cliente había pedido 5000 y luego solo cambia medidas, se recotiza con 1000.

15. **Diseños que solo difieren en sabor colisionan** (`resolver-diseno.js`, `preparar-diseno-creado.js`). Dos detalles idénticos en la misma cotización pueden duplicar uno y perder otro.

16. **Motivo de no producible siempre genérico**: `preparar-contexto-post-cotizacion.js` busca `motivo_no_producible`, pero P4 entrega `motivo_bloqueo`. Fixture: `07-preparar-contexto-post-cotizacion--no-producible`.

29. **La clasificación A/B/C no se guarda.** `pegaso.prospectos` no tiene columna de clasificación (confirmado en "Crear prospecto"). Cada mensaje la recalcula desde `estado`, así que la regla "la clasificación nunca baja" solo vale dentro de una misma ejecución: un prospecto que llegó a A por pedir cuenta vuelve a C/B en el siguiente mensaje si su estado no cambió.

30. **El historial no tiene límite.** "Recuperar historial conversación" usa *Return All* sin límite: en conversaciones largas el prompt del cerebro crece sin tope (más costo, más lentitud y riesgo de superar el contexto del modelo). Sugerencia: limitar los mensajes que se pasan al prompt (p. ej. los últimos 30) **dentro de "Preparar contexto IA"**; no limitar la consulta, porque "Resolver turno conversacional" necesita ver los ENTRANTE pendientes y el último SALIENTE. ~~Además incluye el mensaje actual, que también va aparte como `mensaje_actual`.~~ Resuelto 2026-10-07: el historial excluye los mensajes del turno.

31. **"Buscar conversación" no tiene orden.** Select con `Limit 1` y sin *Sort*: si un prospecto tiene más de una conversación que cumple las 3 condiciones, PostgreSQL devuelve cualquiera. *Verificar* las condiciones; si no filtran por `estado = ACTIVA`, agregar orden por `ultimo_mensaje_at DESC`.

37. **Salidas del Switch "Enrutar acción comercial" sin documentar.**
    Tiene 20 salidas y Fallback. Algunas corresponden a acciones que el validador no admite (`PEDIR_CANTID…`, `ENVIAR_DA…`, `VALIDAR_A…`, una de las dos `REGISTRA…`) y la de cotización se llama `COTIZAR` mientras la acción es `COTIZAR_P4`. *Verificar* el valor de cada regla y adónde va Fallback: si la regla compara con `COTIZAR`, las cotizaciones terminarían en Fallback.

38. ~~**"Marcar mensaje entrante procesado" busca por `mensaje_externo_id`.**~~ **Resuelto 2026-10-07 — requiere aplicar el cambio en n8n.**
    ~~En ejecuciones con "Mensaje entrante TEST" ese campo es `null`: el UPDATE no encuentra filas y la rama de respuesta se detiene ahí.~~
    El nodo se elimina: "Confirmar turno conversacional" (etapa 04) marca por `id` los mensajes de todo el turno, en las tres ramas. Cambio manual: borrar el nodo y conectar "Guardar mensaje saliente" → "Actualizar actividad conversación" ([etapas/05](etapas/05-respuesta-comercial.md)).

50. **Mensaje que llega mientras el turno anterior todavía responde.**
    El debounce cubre los mensajes que llegan antes de que el turno se confirme. Si uno llega **después** de "Confirmar turno conversacional" y antes de que se guarde la respuesta (sobre todo en la cotización, que tarda varios segundos más por el extractor), es un turno nuevo:
    - no repite los mensajes ya confirmados (fixture `03-resolver-turno--en-vuelo-excluye-confirmados`), pero el cerebro todavía no ve la respuesta anterior en el historial;
    - la memoria se leyó en "Buscar conversación", antes de la espera, y puede no traer el resultado de la cotización en curso;
    - "Guardar contexto comercial" de este turno y "Guardar contexto post cotización" del anterior escriben la misma columna: gana el último.

    Con un mensaje como "porfa" que llega justo ahí, el cerebro podría volver a cotizar. Solución posible: serializar por conversación (no responder mientras otro turno de la misma conversación no haya guardado su saliente), lo que requiere marcar "turno en curso" en la base. *Medir* primero cuántas veces ocurre.

51. **Una ejecución superada después de la IA ya escribió contexto y prospecto.** "Confirmar turno conversacional" va después de "Guardar contexto comercial" y "Actualizar prospecto comercial", para no tocar expresiones de nodos existentes. Si llega un mensaje mientras la IA piensa, la ejecución vieja escribe su interpretación parcial y gasta una llamada de IA antes de detenerse; la nueva la sobrescribe segundos después. Solo queda mal si la nueva falla. Solución: mover la confirmación justo después de "Aplicar reglas comerciales determinísticas" y cambiar las expresiones `$json…` de "Guardar contexto comercial" por `$('Aplicar reglas comerciales determinísticas').first().json…`.

52. **Idempotencia por `mensaje_externo_id` solo lógica.** Un reenvío del webhook se inserta igual en `mensajes` (fila duplicada) y su ejecución espera y consulta antes de descartarse (`MENSAJE_DUPLICADO`); no llega a la IA ni responde. Solución mínima: índice único parcial en `mensaje_externo_id` + "Guardar mensaje entrante" con `INSERT … ON CONFLICT DO NOTHING RETURNING *` (Execute Query) y un IF que corte si no devolvió fila. Fuera de este cambio: reemplaza un nodo existente y exige limpiar duplicados antes de crear el índice.

53. **El debounce necesita ejecuciones en paralelo.** Si n8n corre las ejecuciones de a una (`N8N_CONCURRENCY_PRODUCTION_LIMIT = 1`, o modo cola con un solo worker de concurrencia 1), el segundo mensaje no se guarda hasta que termina el primero: no hay agrupación (cada mensaje se responde aparte, 3 s más tarde) aunque tampoco duplicados. *Verificar* la configuración del servidor.

54. **Mensajes retenidos que entran a un turno posterior.** Los mensajes bloqueados por MODO_PRUEBA o recibidos en atención humana quedan `procesado = false`. Si en menos de 10 min se libera al prospecto (`requiere_humano = false`) o se apaga el modo prueba, y no hubo un SALIENTE guardado en medio, el siguiente turno los incluye, aunque el asesor ya los haya contestado por fuera del bot. Solución: al liberar a un prospecto, marcar `procesado = true` en sus ENTRANTE pendientes.

55. **Reinicio de n8n durante la espera.** El Wait de 3 s vive en memoria: si n8n se reinicia justo ahí, esa ejecución se pierde y el mensaje queda sin respuesta hasta que el cliente vuelva a escribir (entonces entra en el turno si tiene menos de 10 min). Bajo impacto.

### Imágenes (flujo V1, 2026-10-07)

56. **Enlace firmado guardado en `mensajes.contenido`.** La línea `[MEDIA_PENDIENTE]` incluye el `link` de YCloud. Como hoy no existe "Guardar análisis imagen" (pendiente 63), **todas** las imágenes lo conservan, también las analizadas. Sin la API key no sirve pasados unos minutos; con ella, 30 días. Mitigación posible: un job que reemplace las líneas pendientes con más de 1 día por `[CONTEXTO DE IMAGEN · revision=SI · motivo=IMAGEN_NO_ANALIZADA]`.

57. **Imágenes por Meta Cloud API sin enlace.** La rama Meta de "Normalizar evento WhatsApp" no trae `link` (Meta exige pedir la URL por `media_id` con su token). Esas imágenes quedan `IMAGEN_NO_DESCARGABLE` y se derivan a revisión humana. Hoy el webhook productivo es YCloud.

58. **Sin antivirus ni verificación de contenido real.** El MIME viene declarado por WhatsApp. El HTTP Request no limita el tamaño (WhatsApp limita imágenes a 5 MB) y no hay escaneo: el binario solo va a los modelos visuales (Groq, DeepSeek, OpenAI) y no se guarda. Si llega `application/octet-stream` o un MIME falso, los tres rechazan la imagen y el turno va a revisión humana ("Preparar derivación imagen fallida"). Recomendado: `N8N_DEFAULT_BINARY_DATA_MODE=filesystem` para no cargar binarios en memoria.

59. ~~**Emparejamiento por posición en "Validar análisis imagen".**~~ **Resuelto 2026-10-07.** Los tres validadores recuperan el item de "Preparar media del turno" y el binario de "Descargar imagen YCloud" por `pairedItem` / `itemMatching`, no por índice. Sigue siendo necesario que "Descargar imagen YCloud" y los "Analizar imagen …" usen *On Error: Continue (regular output)*: con *Stop Workflow* la imagen no llega a la cascada.

60. **Turnos con más de 3 imágenes.** Solo se analizan 3; las demás quedan "no analizadas" y el turno se deriva. Medir si los clientes mandan álbumes grandes antes de subir el tope (cada imagen suma 4–8 s y costo de IA).

61. **Texto del cliente que imita líneas de sistema.** Un TEXTO que contenga "[CONTEXTO DE IMAGEN · …]" no activa derivación ni descarga (solo se leen filas no TEXTO), pero el cerebro lo ve como texto. Riesgo bajo: el cerebro solo podría derivar o pedir medidas.

62. **Prueba real pendiente en n8n.** Descarga e IA visual no tienen fixtures (dependen de YCloud, Groq, DeepSeek y OpenAI). Probar en MODO_PRUEBA los casos de [etapas/03](etapas/03-conversacion.md#imágenes-del-turno), forzando también la caída de Groq y de los tres, y revisar latencia y costo por imagen.

63. **El análisis de imagen no se guarda.** No existe "Guardar análisis imagen": el `[CONTEXTO DE IMAGEN …]` vive solo en la ejecución. El turno siguiente ve la imagen como "no analizada" en el historial (no vuelve a derivar, pero el cerebro pierde el detalle), y el enlace firmado queda en `contenido` (pendiente 56). "Preparar contexto IA" ya expone `media_actualizaciones` (`mensaje_id`, `contenido_actualizado`): falta un Postgres Update después de él (`UPDATE pegaso.mensajes SET contenido = … WHERE id = …`, una vez por elemento).

64. **"Analizar imagen DeepSeek1" probablemente no ve la imagen.** Los modelos de chat de DeepSeek no aceptan imágenes. Si el nodo usa un modelo sin visión, recibe solo el texto y su salida debería ser `NO_DETERMINABLE` / `revision=SI` (el prompt lo exige); en el peor caso inventa. *Verificar* el modelo configurado y, si no tiene visión, reemplazarlo por otro proveedor visual o quitarlo de la cascada (Groq → OpenAI).

65. **Nombres de los Structured Output Parser de DeepSeek y OpenAI desconocidos.** El map solo sincroniza el schema de análisis de imagen con "Schema análisis imagen". Si DeepSeek y OpenAI tienen su propio parser (p. ej. "Schema análisis imagen1"), `npm run build` no los actualiza. Corregir el map con los nombres reales del export.

66. **Derivaciones directas sin "Confirmar turno conversacional".** La entrada no soportada y la imagen fallida van a la derivación humana sin pasar por la etapa 04, así que los ENTRANTE del turno quedan `procesado = false`. El SALIENTE de transición acota el siguiente turno y el prospecto queda `requiere_humano = true`, así que no se reprocesan; solo reaparecerían si se libera al prospecto (ver 54).

67. **Carrera entre una derivación directa y un texto del mismo turno.** Si el cliente manda una ubicación y un texto en la misma ventana, gana la ejecución del último mensaje: si es el texto, la ubicación entra como `[ENTRADA NO SOPORTADA …]` en el turno, va al cerebro y "Normalizar decisión IA" fuerza `ENTRADA_NO_SOPORTADA`; si es la ubicación, se deriva directo y el texto solo queda en el mensaje original del correo. En ambos casos hay un solo handoff.

68. **`mensajes.tipo` con valores nuevos.** Las entradas no soportadas se guardan con `tipo` = `UBICACION`, `CONTACTO`, `INTERACTIVO` o `DESCONOCIDO`. *Verificar* que la columna no tenga un `CHECK` ni un enum que los rechace (ver [modelo-datos.md](modelo-datos.md)).

69. **`npm run status` / `build` / `extract` necesitan el export del workflow.** `workflows/pegaso-whatsapp.json` no está en la carpeta, así que los tres comandos fallan hasta exportarlo desde n8n. Tras exportarlo, correr `npm run status` y corregir en el map los nombres que no existan.

32. **Formato de teléfono en `contactos.whatsapp`.** "Buscar Contacto" compara exacto contra el teléfono normalizado (`5939…`). Si en `contactos` hay números como `09…` o `+593…`, el cliente registrado no se reconoce y el bot le responde como prospecto. *Verificar* los datos o normalizar la columna.

## Prioridad baja (limpieza)

17. `resolver-permiso-automatizacion.js`: `mensaje_actual` siempre `null` (el texto viene en `mensaje`). Sin impacto hoy: ningún nodo posterior lo lee de ahí. (Resuelto: el IF "¿Requiere atención humana?" lee `prospecto_requiere_humano` de `$('Unificar prospecto')`.)
18. Prioridad de `tipo_actor` invertida entre `preparar-conversacion.js` (CONTACTO antes que PROSPECTO) y `preparar-contexto-ia.js`.
19. `ultimo_mensaje_saliente` se pierde en "Normalizar decisión IA", así que el anti-repetición de "Preparar respuesta comercial" no funciona (fixture `05-preparar-respuesta-comercial--duplicada`). El validador sí lo controla. (El orden del historial está confirmado: `enviado_at ASC`, correcto.)
20. `preparar-prospecto-creado.js` no valida el `id` devuelto por el INSERT.
21. ~~`preparar-notificacion-humano.js` inserta nombre y mensaje del cliente en el HTML del correo **sin escapar**.~~ **Resuelto 2026-10-07**: v3.0 escapa todos los datos del cliente.
22. `preparar-envio-whatsapp.js` lanza error (detiene la ejecución) cuando falta contenido, en vez de marcar "no enviar". Fixture: `08-preparar-envio-whatsapp--sin-contenido`. El teléfono ya se busca en varios nodos (v1.1); si no aparece en ninguno, el error es intencional (`08-preparar-envio-whatsapp--sin-telefono`).
24. Erratas en nombres de nodo: "Peparar notificacion humano", "EXECUTOR MOMENTANEP", y "siclo" en `finalizar-ciclo-comercial.js`.
25. "Error ninguna IA funciono" usa `details` en vez de `detalles` (fixture `07-error-ninguna-ia-cotizacion`).
26. "Le adjunto la cotización" pero no se adjunta archivo; "$36.00 dólares" repite la moneda.
27. Código muerto: ternarios con ramas iguales (`resolver-contexto-comercial.js`, `expandir-detalles.js`), reglas repetidas en `validar-extraccion-cerebro.js`, alias de formas que nunca llegan.
33. "Crear prospecto" y "Crear conversación prospecto" mandan `creado_at` / `actualizado_at` en `null` y `creada_at` vacío. Si la tabla tiene `DEFAULT now()`, un `null` explícito lo anula y la fecha queda vacía. *Verificar* en la base; si quedan nulas, quitar esas columnas del mapeo (icono de papelera) para que actúe el default.
34. "Crear conversación prospecto" deja `contacto_id` vacío aunque el remitente sea un contacto sin cliente. n8n además muestra ⚠️ en *Values to Send*: refrescar columnas del mapeo.
35. Mensajes de clientes registrados terminan sin guardarse en `mensajes`: no queda rastro de que escribieron. (Imagen, audio, video y documento de prospectos **ya se guardan** desde el flujo de imágenes, 2026-10-07; ubicaciones, contactos e interactivos también, como entrada no soportada; los stickers y reacciones siguen sin guardarse.)
39. ~~`procesado` inconsistente entre ramas~~ (**resuelto 2026-10-07 — requiere aplicar los cambios en n8n**; semántica en [modelo-datos.md](modelo-datos.md#semántica-de-procesado)):
    - ~~Solo la 05 marca el entrante como procesado; en la derivación humana (06) y en la cotización (07) el entrante queda `false`.~~ Ahora lo marca "Confirmar turno conversacional" antes del Switch, para las tres ramas.
    - ~~En la derivación humana el saliente queda `false`.~~ Cambio manual: `procesado = true` en "Guardar mensaje transición humano" ([etapas/06](etapas/06-derivacion-humana.md)).
    - En un SALIENTE, `procesado = true` significa "escrito por el bot", no "entregado".
    - **Sigue abierto:** el id que devuelve YCloud no se guarda en ningún saliente, así que no hay forma de saber si se entregó.
40. "Actualizar actividad conversación" repite el `ultimo_mensaje_at` que ya escribió "Guardar contexto comercial", con la hora del mensaje entrante (en el handoff se usa `$now`). n8n muestra ⚠️ en sus columnas: refrescar el mapeo. En la cotización pasa lo mismo: "Actualizar actividad conversación cotización" y "Guardar contexto post cotización" escriben los dos `$now`.
44. Los Set "EDT Datos cotización" y "EDT Datos del detalle" leen `$json.details` / `.item.json.details`, pero "Preparar datos cotización" devuelve `detalles`: el campo `detalles` de ambos queda vacío. Sin impacto (EXPANDIR lee los detalles directamente), pero confunde. Fixture: `07-preparar-datos-cotizacion--listo`.
48. `cotizacion_detalles.descripcion` siempre queda vacía: ningún nodo produce `descripcion`. El nombre y el sabor del detalle solo quedan en `disenos`, y el sabor se pierde (ver 15).
49. Etiquetas circulares: "Preparar mensaje cotización" describe solo el ancho ("5 cm circulares"). Si el cliente pide 5x3 circular (ovalada), el mensaje no muestra el alto, aunque el precio sí lo usa.
