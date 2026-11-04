# IVA y envío, y no quedarse callado ante una pregunta

**Fecha:** 4 de noviembre de 2026 · **Workflow:** SISTEMA AUTOMATIZADO PEGASO (`09OF22FOxihypeeh`)
**Estado:** Implementado en local (código + `edit.json`, validadores OK). **No** publicado en n8n, sin commit ni `git push`.

---

## 1. Qué pasó

Tras el catálogo de calendarios (imagen + "Le adjunto los precios, modelos y cantidades…"), el prospecto preguntó "Y esos precios incluyen IVA.? Me hacen llegar a Cuenca.?" y el bot no respondió.

Ejecución revisada (solo lectura, `n8n-cli execution get --includeData`):

| Nodo | Resultado |
|---|---|
| Cerebro comercial | Respondió bien: "Los precios adjuntos no incluyen IVA. Sí realizamos envíos a Cuenca…" |
| Resolver contexto comercial | Reemplazó esa respuesta por el texto del catálogo de calendarios: la palabra "precios" activó la regla "pregunta de precio → catálogo" del bloque de calendarios. |
| Preparar respuesta comercial | El texto era idéntico al último saliente → `RESPUESTA_IDENTICA_A_ULTIMO_SALIENTE`, no se envió nada. |

La misma regla de "precio → catálogo" existe en tarjetas, volantes y producción rápida, así que el fallo se repetía en esas líneas.

---

## 2. Corrección

### IVA y envío (todas las líneas)

| Pregunta | Respuesta |
|---|---|
| IVA en etiquetas adhesivas | "Sí, el precio de las etiquetas adhesivas incluye IVA." |
| IVA en tarjetas, volantes, afiches, trípticos, membretadas, calendarios | "No está incluido IVA." |
| Envío con ciudad conocida o escrita en el mensaje | "No está incluido el valor del envío; a Cuenca es de $5.00 dólares aproximadamente." |
| Envío sin ciudad | "No está incluido el valor del envío; es de $5.00 dólares aproximadamente. ¿Desde qué ciudad nos escribe disculpe?" |
| Envío en Quito | "… es de $5.00 dólares aproximadamente. En Quito también puede retirar su pedido en nuestro local." |
| "¿Me hacen llegar…?", "¿Envían a…?", "¿Hacen envíos?" | Antepone "Sí, realizamos envíos a todo el país 🇪🇨🚛." |

El caso real ahora responde:

> No está incluido IVA.
>
> Sí, realizamos envíos a todo el país 🇪🇨🚛. No está incluido el valor del envío; a Cuenca es de $5.00 dólares aproximadamente.

**Cuándo reemplaza y cuándo añade:**
- **Reemplaza** el texto de la IA, el cierre de un catálogo ya enviado o un "Permítame…" por pregunta abierta. En ese turno no se reenvía la imagen ni los videos.
- **Añade al final** cuando el turno ya trae una respuesta fija con datos: primer envío del catálogo, precio de "500 de escritorio" o material. Si el texto ya dice "*Precios no incluyen IVA*", no lo repite.
- **No aplica** a cotizaciones de etiquetas (`COTIZAR_P4`), datos de pago, derivaciones por cantidad, producto fuera de catálogo o término desconocido (p. ej. "plastificados"), ni a intenciones humanas fuertes (reclamo, pago, pedir asesor).

### No quedarse callado

Si el cliente hace una pregunta (signo "?" o "qué / cuánto / incluye / hacen / pueden…") y la respuesta que va a salir repite el último mensaje del bot, ya no se silencia. Deriva a humano con:

> Permítame un momento por favor, ya verificamos su requerimiento.

(`motivo_derivacion = OTRO`, `regla_derivacion = PREGUNTA_SIN_RESPUESTA`). No se aplica a:
- un "Permítame…" repetido (ya está derivado);
- cotizaciones;
- mensajes que no son pregunta ("ok gracias").

En fajillas, si el cliente insiste ("¿son como las de Dasani?"), responde con otra redacción en lugar de derivar: "No, nuestras etiquetas no son fajillas plásticas como las de Tesalia o Dasani; son 100% adhesivas."

El texto de derivación pasa a ser "Permítame un momento por favor, **ya** verificamos su requerimiento." en todos los nodos que usaban la versión sin "ya".

### Prompt de los tres cerebros

- **§17A (nueva):** IVA y valor del envío con las reglas de arriba; `RESPONDER_GENERAL`, sin reenviar catálogo ni cotización.
- **§33:** si no sabe realmente la respuesta, `DERIVAR_HUMANO` con el texto anterior. Si la respuesta está en las instrucciones, la da. Nunca responde una pregunta nueva repitiendo el último saliente.

---

## 3. Qué se cambió

| Pieza | Cambio |
|---|---|
| Resolver contexto comercial | 3.27 → **3.28**. Secciones 12.11b (IVA/envío) y 12.11c (pregunta sin respuesta); `derivacionPorTerminoDesconocido`; medios suprimidos al reemplazar; fajillas repetida con otra redacción; salida `respuesta_iva_envio`. |
| Preparar contexto IA, Preparar mensaje transición humano, Error ninguna IA funcionó (×2) | Texto "Permítame un momento por favor, ya verificamos su requerimiento." |
| Cerebro comercial ×3 (prompt) | §17A nueva y regla de "no sabe" en §33. |

---

## 4. Verificación

- Caso real reproducido con el contexto y la respuesta del cerebro de la ejecución: ahora responde IVA + envío a Cuenca, sin imagen.
- IVA solo; envío sin ciudad (pregunta la ciudad); envío en Quito; etiquetas con IVA incluido; etiquetas con IVA + envío a Guayaquil; afiches tras el catálogo; "500 de escritorio, ¿incluye IVA?" (precio sin duplicar la nota); material + envío a Loja (se añade); primer contacto con IVA (catálogo + "No está incluido IVA.").
- Pregunta que repetiría el catálogo ("¿esos precios son por unidad?") → deriva con el texto nuevo. "ok gracias" no deriva. "Le envío el diseño a su correo" no se toma como pregunta de envío. "Plastificados + IVA" sigue derivando.
- Regresión (salidas comparadas contra HEAD): diseño recibido, logo, calendarios, links, cierre y ciudad sin cambios, salvo el texto con "ya" y la redacción de fajillas repetida.
- `inject-code`, `validate-workflow`, `prepare-update`, `check-encoding` OK.

---

## 5. A confirmar

- **Envío de etiquetas:** se aplica la misma respuesta ("No está incluido el valor del envío", ~$5.00). Si en etiquetas el envío sí está incluido, se ajusta.
- **Quito:** el total de catálogo no suma transporte en Quito (retiro en el local). Por eso la respuesta de envío en Quito menciona los $5.00 y la opción de retirar en el local.
- **Cotización de etiquetas con IVA en el mismo mensaje** ("1000 de 10x5, ¿incluye IVA?"): sale la cotización, que no menciona el IVA. Es poco frecuente y no se cambió.
