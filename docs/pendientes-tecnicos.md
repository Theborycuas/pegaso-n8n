# Pendientes técnicos

Posibles bugs e inconsistencias detectados al revisar el código y la configuración de los nodos (octubre 2026). **Ninguno está corregido todavía.** Los que dependen de configuración aún no documentada se marcan "verificar". Las etapas 01–03 ya tienen su configuración revisada (ver `docs/etapas/`).

Los números son identificadores fijos (los citan tests y otros documentos): no se renumeran. Al resolver uno, márcalo ~~tachado~~ con la fecha o bórralo, y actualiza la doc afectada.

## Prioridad alta (afectan al cliente o a los datos)

28. **El webhook no tiene autenticación.**
    "Webhook YCloud" tiene `Authentication: None`. Cualquiera que conozca la URL puede enviar mensajes falsos: gasta créditos de IA, crea prospectos basura y puede hacer que el bot escriba por WhatsApp a números arbitrarios desde el número de Pegaso. Solución: verificar la firma que YCloud envía en cada webhook (cabecera de firma con el secreto del endpoint) o, como mínimo, un *Header Auth* en el nodo.

1. **El contexto comercial guardado no llega a la IA.**
   Confirmado en código: `resolver-conversacion-prospecto.js` y `preparar-conversacion-creada.js` no copian `contexto_comercial` de la fila de `conversaciones` (ver fixture `03-resolver-conversacion--existente`). "Buscar conversación" es un Select sin columnas restringidas, así que la fila sí trae la columna si existe. Resultado: la cotización previa y el diseño siempre llegan vacíos a "Preparar contexto IA", y el bot "olvida" lo cotizado. *Verificar* que `conversaciones` tiene la columna `contexto_comercial` (la captura de "Crear conversación prospecto" no la muestra completa).

2. **La regla de medida no producible se pierde.**
   `recuperar-decision-comercial.js` lee `$('Resolver contexto comercial')`, que va **antes** de "Aplicar reglas comerciales". El cambio a `RESPONDER_NO_PRODUCIBLE` no llega al Switch. Además, esa acción no existe en el Switch (que tiene `MEDIDA_NO_PRODUCIBLE`).

3. **`MEDIDA_NO_PRODUCIBLE` no está en el schema ni en el prompt del cerebro.**
   El validador la exige para lados ≤ 1 cm, pero el schema no la permite. Una medida de 1 cm hace fallar a las tres IA y termina en "Error ninguna IA funciono cerebro".

4. **Si ninguna IA funciona, el cliente no recibe respuesta.**
   "Error ninguna IA funciono" (cerebro y cotización) devuelve un objeto fijo sin responder, sin marcar el mensaje ni avisar al equipo.

5. **El prospecto pasa a COTIZADO aunque la medida no sea producible.**
   `resolver-estado-post-cotizacion.js` pone `actualizar_estado_prospecto = true` siempre que haya prospecto, deshaciendo lo que decidió "Preparar contexto post cotización". *Verificar* la condición del IF "¿Actualizar prospecto cotizado?".

6. **Se guardan cotización y diseños antes de validar producibilidad.**
   "Validar producibilidad P4" corre después de "Insert cotización" y "Crear diseño": una medida 1×1 deja una cotización y diseños huérfanos en la base.

7. **Redondeo con error de punto flotante cobra $1 de más.**
   `Math.ceil(469.00000000000006)` = 470. Ejemplo: 10×14 rectangular × 5000 unidades. Se corrige redondeando a centavos antes del `ceil`.

## Prioridad media (reglas inconsistentes)

8. **Umbral de medida mínima distinto**: ≤ 1 cm en el cerebro, < 2 cm en cotización. Una etiqueta de 1,5 cm pasa el cerebro y se bloquea en cotización con un mensaje que habla de "1 cm o menos".

9. **Precios que no suben con el tamaño**:
   - 4×2 cm ($5,76/mil → $6) es mucho más barato que 3×3 ($18).
   - 4×5 ($14,40/mil) más barato que 4×4 ($20).
   - 9,9×10 ($71,28/mil) más caro que 10×10 ($67).
   - Con 10.000 unidades, los precios fijos no reciben descuento por volumen.

10. **Dos catálogos de estados de prospecto** (ver [reglas-comerciales.md §11](reglas-comerciales.md#11-estados-del-prospecto)). `resolver-estado-prospecto.js` lanza error con estados que usan otros nodos (INTERESADO, CALIFICADO…).

11. **Motivos de handoff con nombres distintos** entre `preparar-derivacion-humana.js` (SOLICITA_DATOS_PAGO, NEGOCIACION_COMERCIAL, DESEA_CONTINUAR_PEDIDO), el schema del cerebro (CONFIRMAR_PEDIDO, NEGOCIACION…) y `preparar-notificacion-humano.js` (SOLICITA_CUENTA, NEGOCIAR_PRECIO…). El caso más común —pedir datos de pago— sale con asunto genérico, y la notificación puede **bajar** la prioridad de ALTA a MEDIA.

12. **El material nunca llega al catálogo.** El schema del extractor no tiene `material` y "Preparar datos cotización" lo elimina; todo se cotiza como P4 y `requiere_cotizacion_manual` nunca se activa.

13. **`MODO_PRUEBA` abierto por error**: si `valor_json` no trae `activo`, el bot responde a todos.

14. **Cantidad anterior pisada por 1000**: el validador pone 1000 si falta la cantidad antes de consolidar con el contexto; si el cliente había pedido 5000 y luego solo cambia medidas, se recotiza con 1000.

15. **Diseños que solo difieren en sabor colisionan** (`resolver-diseno.js`, `preparar-diseno-creado.js`). Dos detalles idénticos en la misma cotización pueden duplicar uno y perder otro.

16. **Motivo de no producible siempre genérico**: `preparar-contexto-post-cotizacion.js` busca `motivo_no_producible`, pero P4 entrega `motivo_bloqueo`.

29. **La clasificación A/B/C no se guarda.** `pegaso.prospectos` no tiene columna de clasificación (confirmado en "Crear prospecto"). Cada mensaje la recalcula desde `estado`, así que la regla "la clasificación nunca baja" solo vale dentro de una misma ejecución: un prospecto que llegó a A por pedir cuenta vuelve a C/B en el siguiente mensaje si su estado no cambió.

30. **El historial no tiene límite.** "Recuperar historial conversación" usa *Return All* sin límite: en conversaciones largas el prompt del cerebro crece sin tope (más costo, más lentitud y riesgo de superar el contexto del modelo). Además incluye el mensaje actual, que también va aparte como `mensaje_actual`. Sugerencia: limitar a los últimos 20–30 mensajes (orden DESC + limit, y revertir en código) y excluir el `id` recién guardado.

31. **"Buscar conversación" no tiene orden.** Select con `Limit 1` y sin *Sort*: si un prospecto tiene más de una conversación que cumple las 3 condiciones, PostgreSQL devuelve cualquiera. *Verificar* las condiciones; si no filtran por `estado = ACTIVA`, agregar orden por `ultimo_mensaje_at DESC`.

32. **Formato de teléfono en `contactos.whatsapp`.** "Buscar Contacto" compara exacto contra el teléfono normalizado (`5939…`). Si en `contactos` hay números como `09…` o `+593…`, el cliente registrado no se reconoce y el bot le responde como prospecto. *Verificar* los datos o normalizar la columna.

## Prioridad baja (limpieza)

17. `resolver-permiso-automatizacion.js`: `mensaje_actual` siempre `null` (el texto viene en `mensaje`). Sin impacto hoy: ningún nodo posterior lo lee de ahí. (Resuelto: el IF "¿Requiere atención humana?" lee `prospecto_requiere_humano` de `$('Unificar prospecto')`.)
18. Prioridad de `tipo_actor` invertida entre `preparar-conversacion.js` (CONTACTO antes que PROSPECTO) y `preparar-contexto-ia.js`.
19. `ultimo_mensaje_saliente` se pierde en "Normalizar decisión IA", así que el anti-repetición de "Preparar respuesta comercial" no funciona. (El orden del historial está confirmado: `enviado_at ASC`, correcto.)
20. `preparar-prospecto-creado.js` no valida el `id` devuelto por el INSERT.
21. `preparar-notificacion-humano.js` inserta nombre y mensaje del cliente en el HTML del correo **sin escapar**.
22. `preparar-envio-whatsapp.js` lanza error (detiene la ejecución) cuando falta teléfono o contenido, en vez de marcar "no enviar".
23. `resolver-diseno.js` usa `$('Resolver catálogo Pegaso')` con tilde; el mapa tiene `Resolver catalogo Pegaso`. *Verificar* el nombre real del nodo.
24. Erratas en nombres de nodo: "Peparar notificacion humano", "EXECUTOR MOMENTANEP", y "siclo" en `finalizar-ciclo-comercial.js`.
25. "Error ninguna IA funciono" usa `details` en vez de `detalles`.
26. "Le adjunto la cotización" pero no se adjunta archivo; "$36.00 dólares" repite la moneda.
27. Código muerto: ternarios con ramas iguales (`resolver-contexto-comercial.js`, `expandir-detalles.js`), reglas repetidas en `validar-extraccion-cerebro.js`, alias de formas que nunca llegan.
33. "Crear prospecto" y "Crear conversación prospecto" mandan `creado_at` / `actualizado_at` en `null` y `creada_at` vacío. Si la tabla tiene `DEFAULT now()`, un `null` explícito lo anula y la fecha queda vacía. *Verificar* en la base; si quedan nulas, quitar esas columnas del mapeo (icono de papelera) para que actúe el default.
34. "Crear conversación prospecto" deja `contacto_id` vacío aunque el remitente sea un contacto sin cliente. n8n además muestra ⚠️ en *Values to Send*: refrescar columnas del mapeo.
35. Mensajes no procesables (imagen, audio, documento) y de clientes registrados terminan sin guardarse en `mensajes`: no queda rastro de que escribieron.
