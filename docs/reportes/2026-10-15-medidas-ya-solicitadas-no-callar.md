# Tras la publicidad que pide medidas: acotar, no callar

**Fecha:** 15 de octubre de 2026 · **Workflow:** SISTEMA AUTOMATIZADO PEGASO (`09OF22FOxihypeeh`)
**Estado:** implementado y verificado en local. **No** se publicó en n8n, no hay commit ni `git push`.

Cuando el anuncio de Facebook ya respondió pidiendo medidas y el prospecto vuelve a escribir sin darlas (p. ej. "Medidas y precios"), el bot ya no se calla: acota pidiendo el ancho y el alto en centímetros.

---

## 1. Qué pasaba

Conversación real desde un anuncio:

1. Saludo automático del anuncio.
2. Cliente: "¿Precio de las etiquetas adhesivas?"
3. Respuesta automática del anuncio: "Claro, con mucho gusto… En qué medidas requiere sus etiquetas…"
4. Cliente: "Medidas y precios"
5. El flujo llegó a `Preparar envío WhatsApp` con `enviar_whatsapp: false` y `motivo_no_envio: RESPUESTA_OMITIDA_DUPLICADA`, texto `[RESPUESTA AUTOMÁTICA OMITIDA · motivo=MEDIDAS_YA_SOLICITADAS]`.

**Por qué `false`.** No era un fallo de YCloud ni del IF de envío. La regla 12.2 de `Resolver contexto comercial` detectaba que las medidas ya se habían pedido (la respuesta automática del anuncio tiene huella `PEDIR_MEDIDAS`) y, como el turno no aportaba ancho/alto, marcaba `omitir_envio`. Eso era correcto para no repetir la misma pregunta genérica en el mismo instante que llega el eco del anuncio, pero incorrecto un turno después: el cliente sí escribió algo y se quedó sin respuesta.

## 2. Qué se cambió

### `Resolver contexto comercial` (V3.1 → V3.2)

Si `PEDIR_MEDIDAS` y las medidas ya se solicitaron, y el turno **no** aporta datos:

- **Antes:** `omitir_envio = true` (`MEDIDAS_YA_SOLICITADAS`) → silencio.
- **Ahora:** se envía una pregunta acotada:

> Para enviarle el precio indíquenos por favor el ancho y el alto de sus etiquetas en centímetros. Con esos datos le cotizamos de inmediato.

Si el turno aporta solo un lado, se mantiene el mensaje de "solo nos falta el alto/ancho". Si el cliente repite exactamente el mismo texto acotado, `Preparar respuesta comercial` sigue pudiendo omitir por duplicado idéntico (evita spam).

La omisión por eco automático **en el mismo turno** (regla 12.4 / `seguimiento_tras_automatizacion`) no cambia: si la publicidad acaba de responder, el bot no duplica; si faltan medidas, solo pregunta medidas.

## 3. Verificación

Casos sobre código real: "Medidas y precios" e "quiero el precio" tras el anuncio → envía la acotación (`enviar_whatsapp: true`); con 10x10 → cotiza; solo ancho → pide el alto. Regresiones de medidas grandes, correcciones, conversacional y precios: OK. `inject-code` inyectó V3.2 en el build.

## 4. Cómo activarlo

Publicar el workflow en n8n. No requiere configuración en base.

## 5. Riesgos

- Si el cliente insiste muchas veces sin dar medidas, la segunda respuesta idéntica a la acotación puede omitirse otra vez (anti-duplicado). Es preferible a un bucle.
- El texto de la publicidad sigue siendo el de WhatsApp Business; este cambio solo afecta lo que responde el bot de n8n después.
