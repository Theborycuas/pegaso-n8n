# Imágenes informativas: material y metodología de producción

**Fecha:** 15 de octubre de 2026 · **Workflow:** SISTEMA AUTOMATIZADO PEGASO (`09OF22FOxihypeeh`)
**Estado:**
- **Primera versión (imagen del material, enviada después del texto):** publicada por Pegaso y probada con éxito.
- **Segunda versión (imagen antes del texto e imagen de metodología):** implementada y verificada en local. **No** se publicó en n8n, no hay commit ni `git push`. La imagen de metodología requiere crear la fila `IMAGEN_METODOLOGIA` (sección 4).

Cuando el prospecto pregunta por el material o por los tiempos y el proceso de producción, el bot envía primero la imagen correspondiente y luego su respuesta de texto. Cada imagen se envía una sola vez por conversación.

---

## 1. Decisiones de Pegaso

| Tema | Decisión |
|---|---|
| Orden | Primero la imagen y luego el texto (cambio pedido después de probar la primera versión) |
| Frecuencia | Cada imagen, solo la primera vez en la conversación; después, solo texto |
| Respuesta automática del anuncio | Si el anuncio ya explicó el material y el bot solo pregunta las medidas, también envía la imagen |
| Enlaces | En la tabla `configuracion_bot`, claves `IMAGEN_MATERIAL` e `IMAGEN_METODOLOGIA`: se cambian o apagan sin republicar |

## 2. Cuándo se envía cada imagen

| Imagen | Clave | Acción del bot | Ejemplos |
|---|---|---|---|
| Material | `IMAGEN_MATERIAL` | `INFORMAR_MATERIAL` | "¿En qué material son?", "¿Con qué material trabajan?" |
| Metodología de producción | `IMAGEN_METODOLOGIA` | `INFORMAR_ENTREGA`, `INFORMAR_METODOLOGIA`, o una fecha pedida que el bot responde con la metodología | "¿Cuántos días demora?", "¿Para cuándo las tiene listas?", "¿Cómo es el proceso?", "Las necesito para el viernes" |

La metodología de pago (`INFORMAR_METODOLOGIA_PAGO`) no lleva imagen.

## 3. Qué se cambió

### 3.1 `Obtener configuración MODO_PRUEBA` (Postgres)

La consulta trae también `IMAGEN_MATERIAL` e `IMAGEN_METODOLOGIA`. `Resolver permiso automatización` busca sus filas por clave, así que no se ve afectado (verificado).

### 3.2 `Resolver contexto comercial` (V2.8 → V3.0)

La regla 12.5 elige la imagen según la acción (tabla de la sección 2) y la marca cuando se cumplen todas estas condiciones:

- la respuesta sí se envía;
- la fila de esa imagen tiene `activo = true` y un `url` que empieza con `https://`;
- la conversación no recibió antes esa imagen.

Salida: `enviar_imagen_informativa`, `imagen_informativa` (`MATERIAL` o `METODOLOGIA`) e `imagen_informativa_url`. Reemplazan a `enviar_imagen_material` e `imagen_material_url` de la primera versión; por eso la versión sube a 3.0. El contexto guarda `imagen_material` o `imagen_metodologia` con `{ url, enviada_at }`. Las conversaciones que ya recibieron la imagen del material con la primera versión no la vuelven a recibir.

### 3.3 `Preparar envío WhatsApp` (2.2 → 3.0)

Lee los campos nuevos y emite `enviar_imagen`, `imagen_informativa` y `ycloud_request_imagen.body` (`type = image`, `image.link`).

### 3.4 Orden de envío

| Nodo | Cambio |
|---|---|
| IF: ¿Enviar imagen informativa? | Antes `IF: ¿Enviar imagen material?` (mismo id). Ahora va justo después de `If:¿Enviar por WhatsApp?` [T]. [T] imagen; [F] directo al texto |
| YCloud Enviar imagen | Antes `YCloud Enviar imagen material` (mismo id). Ahora **continúa ante error**: si la imagen falla, el texto se envía igual |
| Esperar antes del texto (nuevo) | Wait de 3 segundos entre la imagen y el texto |
| YCloud Enviar Wts | Ahora es el último nodo. Toma el body de `$('Preparar envío WhatsApp')`, porque su entrada puede ser la respuesta de la imagen |

**Por qué la espera.** WhatsApp procesa una imagen enviada por enlace más despacio que un texto. Si se envían seguidas, el texto puede llegar antes. Los 3 segundos solo se agregan cuando hay imagen.

Fichas actualizadas en [FLUJO-WORKFLOW-PEGASO.md](../FLUJO-WORKFLOW-PEGASO.md): §2, §8, §11 y §16.

## 4. Cómo activarlo

1. **Publicar el workflow** en n8n.
2. **La fila del material** ya existe y no cambia.
3. **Crear la fila de la metodología.** El enlace se verificó: responde una imagen JPEG de unos 550 KB.

```sql
INSERT INTO pegaso.configuracion_bot (clave, valor_json)
VALUES ('IMAGEN_METODOLOGIA', '{"activo": true, "url": "https://pegasoadhesivos.com/wp-content/uploads/2026/10/Metodologia-de-produccion.jpeg"}'::jsonb)
ON CONFLICT (clave) DO UPDATE
SET valor_json = EXCLUDED.valor_json,
    actualizado_at = NOW();
```

Para apagar una imagen sin borrar el enlace (cambiar la clave según corresponda):

```sql
UPDATE pegaso.configuracion_bot
SET valor_json = jsonb_set(valor_json, '{activo}', 'false'::jsonb),
    actualizado_at = NOW()
WHERE clave = 'IMAGEN_METODOLOGIA';
```

Requisitos para enlaces nuevos: https público que abra solo la imagen (no una página), JPG o PNG de hasta 5 MB. Los enlaces para compartir de Google Drive o Facebook no sirven.

4. **Probar** desde un teléfono de prueba. Usar un número que no haya recibido ya la imagen del material, o quitar `imagen_material` de su `contexto_comercial`.
   - "¿En qué material son?" debe traer la imagen del material y luego el texto.
   - "¿Cuántos días demora?" debe traer la imagen de la metodología y luego el texto.
   - Repetir cada pregunta: debe llegar solo el texto.

## 5. Verificación

Pruebas sobre el código real de los nodos y la configuración del workflow editable: 41 casos, todos OK.

| Grupo | Casos |
|---|---|
| Material | Texto igual; imagen marcada y guardada en el contexto; request de imagen con mismo emisor y destino; el texto sigue siendo `text` |
| Metodología | `INFORMAR_ENTREGA`, `INFORMAR_METODOLOGIA` y fecha pedida envían la imagen de metodología; haber recibido la del material no lo impide |
| Una vez por imagen | Material repetido y metodología repetida: solo texto; se conserva la fecha original |
| Configuración | Sin filas, `activo = false`, `http://`, sin `url`, sin nodo de configuración o solo el material configurado: no hay imagen y el contexto no se marca; `valor_json` como texto JSON funciona |
| Otras acciones | Ubicación, metodología de pago y pedir medidas: sin imagen |
| Anuncio | El anuncio respondió el material: imagen y pregunta de medidas. Con medidas ya conocidas: no se envía nada |
| Prueba o manual | No se envía nada |
| Workflow | Orden IF → imagen → espera → texto; rama [F] directo al texto; continuar ante error; 3 s; nombres viejos eliminados; expresiones de IF, imagen y texto evaluadas; misma credencial; consulta con las dos claves |

Regresiones anteriores (control conversacional, correcciones de diseño y recotización, auditoría, mínimo por diseño, cierre de cotizaciones, precios, ACTIVEBOT): todas OK. Validadores (`inject-code`, `validate-workflow` con 189 nodos, `check-encoding`): OK. `activeVersion` de `edit.json` sin cambios.

## 6. Riesgos y límites

- **Respuestas un poco más lentas.** Cuando hay imagen, el texto llega unos 3 segundos después de ella.
- **Orden no garantizado al 100 %.** Si WhatsApp tarda más de 3 segundos en procesar la imagen, el texto podría llegar primero. Se puede subir la espera en el nodo `Esperar antes del texto`.
- **Imagen fallida.** El texto llega igual, pero la conversación ya quedó marcada y la imagen no se reintenta. La ejecución en n8n no queda en error, así que hay que revisar el resultado del nodo `YCloud Enviar imagen` para detectarlo.
- **Las imágenes no quedan en `mensajes`.** Solo queda la marca en `contexto_comercial`.
- **Depende de que la IA clasifique bien la pregunta.** Si el cliente pregunta el material junto con sus medidas y la IA cotiza, va la cotización sin imagen.
- **"Una vez por conversación"** cuenta toda la vida de la conversación, no solo las últimas 24 h. Para reenviar a alguien, quitar `imagen_material` o `imagen_metodologia` de su `contexto_comercial`.
