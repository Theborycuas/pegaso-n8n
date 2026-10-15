# Foto del material en la respuesta del bot

**Fecha:** 15 de octubre de 2026 · **Workflow:** SISTEMA AUTOMATIZADO PEGASO (`09OF22FOxihypeeh`)
**Estado:** implementado y verificado en local. **No** se publicó en n8n (`push.ps1` no se ejecutó), no hay commit ni `git push`. La foto no se envía hasta que Pegaso cree la fila de configuración `IMAGEN_MATERIAL` (sección 4).

Cuando el prospecto pregunta por el material ("¿Con qué material trabajan?", "¿En qué material hacen las etiquetas?"), el bot responde como antes y, en un segundo mensaje, envía la foto del material (etiquetas adhesivas de polipropileno). La foto se envía una sola vez por conversación.

---

## 1. Decisiones de Pegaso

| Tema | Decisión |
|---|---|
| Formato | Primero el texto y luego la foto, como dos mensajes. Si la foto falla, el cliente ya recibió el texto |
| Frecuencia | Solo la primera vez que pregunta por el material en la conversación; después, solo texto |
| Respuesta automática del anuncio | Si el anuncio ya explicó el material y el bot solo pregunta las medidas, también envía la foto (la respuesta del anuncio no la lleva) |
| Enlace de la foto | En la tabla `configuracion_bot`, clave `IMAGEN_MATERIAL`: se puede cambiar o apagar sin republicar el workflow |

## 2. Qué se cambió

### 2.1 `Obtener configuración MODO_PRUEBA` (Postgres)

La consulta ahora también trae la clave `IMAGEN_MATERIAL`. `Resolver permiso automatización` busca sus filas por clave, así que la fila nueva no la afecta (verificado).

### 2.2 `Resolver contexto comercial` (V2.7 → V2.8)

Nueva regla 12.5, "Foto del material". Marca `enviar_imagen_material = true` e `imagen_material_url` cuando se cumplen todas estas condiciones:

- la acción final es `INFORMAR_MATERIAL`;
- la respuesta sí se envía (no es una respuesta omitida);
- la fila `IMAGEN_MATERIAL` existe, tiene `activo = true` y un `url` que empieza con `https://`;
- la conversación no recibió la foto antes (`contexto_comercial.imagen_material.enviada_at` vacío).

Al marcarla guarda `contexto_comercial.imagen_material = { url, enviada_at }`, que es lo que impide repetirla.

### 2.3 `Preparar envío WhatsApp` (2.1 → 2.2)

Si la decisión comercial trae la marca y el texto se va a enviar, emite `enviar_imagen = true` y `ycloud_request_imagen.body`:

```json
{ "from": "<número Pegaso>", "to": "<cliente>", "type": "image", "image": { "link": "<url configurada>" } }
```

El request del texto no cambia.

### 2.4 Nodos nuevos

| Nodo | Tipo | Qué hace |
|---|---|---|
| IF: ¿Enviar imagen material? | IF | Después de `YCloud Enviar Wts`; pasa si `Preparar envío WhatsApp` emitió `enviar_imagen` |
| YCloud Enviar imagen material | HTTP POST a YCloud, misma credencial `YCloud API` | Envía la foto |

Conexión: `YCloud Enviar Wts` → `IF: ¿Enviar imagen material?` → [T] `YCloud Enviar imagen material`. Al ir después del texto, la foto solo sale si el texto se envió bien.

Fichas actualizadas en [FLUJO-WORKFLOW-PEGASO.md](../FLUJO-WORKFLOW-PEGASO.md): §2 (vista general), §8 (configuración), §11 (Resolver contexto comercial) y §16 (salida WhatsApp).

## 3. Verificación

Pruebas sobre el código real de los nodos y la configuración del workflow editable, 26 casos, todos OK:

| Grupo | Casos |
|---|---|
| Primera pregunta de material | El texto se envía igual; se marca la foto; el contexto guarda `enviada_at`; request `type = image` con el enlace, mismo emisor y destino que el texto |
| Una sola vez | Con `enviada_at` previo solo va el texto y se conserva la fecha original |
| Configuración | Sin fila, `activo = false`, enlace `http://`, sin `url` o sin nodo de configuración: solo texto y el contexto no se marca. `valor_json` guardado como texto JSON también funciona |
| Otras acciones | Ubicación y pedir medidas no envían foto |
| Anuncio | El anuncio respondió el material: el bot pregunta medidas y envía la foto. El anuncio respondió y ya hay medidas: no se envía nada y la foto no se marca |
| Ejecución de prueba o manual | No se envía ni texto ni foto |
| Workflow | Expresión del IF, cuerpo del HTTP, conexiones, misma credencial, consulta con `IMAGEN_MATERIAL`; `Resolver permiso automatización` sigue igual |

Regresiones anteriores: control conversacional, correcciones de diseño y recotización, auditoría, mínimo por diseño, cierre de cotizaciones, precios y ACTIVEBOT. Todas OK. Validadores del repositorio (`inject-code`, `validate-workflow` con 188 nodos, `check-encoding`) OK.

## 4. Cómo activarlo

1. **Subir la foto a un enlace público https** que entregue el archivo directo, no una página. Por ejemplo, subirla al sitio web de Pegaso y copiar la dirección de la imagen. Sirven JPG o PNG de hasta 5 MB. Los enlaces para compartir de Google Drive o Facebook no sirven porque devuelven una página, no la imagen. Para comprobarlo, el enlace abierto en el navegador debe mostrar solo la imagen.
2. **Publicar el workflow** en n8n.
3. **Crear la configuración** en PostgreSQL (reemplazar el enlace):

```sql
INSERT INTO pegaso.configuracion_bot (clave, valor_json)
VALUES ('IMAGEN_MATERIAL', '{"activo": true, "url": "https://ENLACE-DE-LA-FOTO.jpg"}'::jsonb)
ON CONFLICT (clave) DO UPDATE
SET valor_json = EXCLUDED.valor_json,
    actualizado_at = NOW();
```

Para apagarla sin borrar el enlace:

```sql
UPDATE pegaso.configuracion_bot
SET valor_json = jsonb_set(valor_json, '{activo}', 'false'::jsonb),
    actualizado_at = NOW()
WHERE clave = 'IMAGEN_MATERIAL';
```

4. **Probar** desde un teléfono de prueba: preguntar "¿En qué material son?" debe traer el texto y luego la foto; preguntarlo otra vez, solo el texto.

## 5. Riesgos y límites

- **Enlace caído o incorrecto.** El HTTP de la foto falla y la ejecución queda en error en n8n, pero el cliente ya recibió el texto. Como la conversación quedó marcada, no se reintenta. Revisar el enlace con el paso 4.
- **La foto no queda en `mensajes`.** Solo queda la marca en `contexto_comercial.imagen_material`. Un asesor que revise el historial en la base no la verá como mensaje.
- **Depende de que la IA clasifique `INFORMAR_MATERIAL`.** Si el cliente pregunta el material junto con medidas y la IA cotiza, va la cotización sin foto.
- **"Una vez por conversación"** cuenta toda la vida de la conversación del prospecto, no solo las últimas 24 h. Si se quiere reenviar a alguien, hay que quitar `imagen_material` de su `contexto_comercial`.
