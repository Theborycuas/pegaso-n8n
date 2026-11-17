# Galería de trabajos en el enganche

Estado: implementado en local el 17 de noviembre de 2026. **No publicado ni en commit.** Se activa al cargar la fila `GALERIA_TRABAJOS` en `configuracion_bot`. Sin esa fila el flujo se comporta igual que antes.

## Qué hace

En las conversaciones de etiquetas, el bot envía una galería de fotos y videos de trabajos realizados después de responder:

| Momento | Se reconoce porque la respuesta dice |
|---|---|
| Pregunta por cireles | «impresión offset» |
| Pregunta por el material | «Polipropileno» |
| Ciudad: el bot dice desde dónde escribimos | «somos de Quito», «somos de la ciudad de Quito», «también estamos en Quito» |

El orden es el mismo que usan los asesores en WhatsApp Business:

1. la respuesta;
2. la galería;
3. «Le adjunto varios de nuestros trabajos.».

**Una sola vez.** El envío queda registrado en `contexto_comercial.galeria_trabajos` (`clave`, `motivo`, `medios`, `enviada_at`). Tampoco se envía si en el historial reciente un asesor ya escribió «Le adjunto varios de nuestros trabajos», como en las capturas.

**No se envía** en estos casos:
- cotizaciones, derivaciones a humano o datos de pago;
- tarjetas, flyers y otros productos de catálogo;
- respuestas omitidas, por ejemplo cuando la respuesta automática del anuncio ya contestó;
- si en ese mismo turno salen la imagen `IMAGEN_TRABAJOS` o un catálogo.

**La galería corresponde al producto del prospecto.** Se busca en lo que el prospecto escribió (mensaje actual e historial entrante) la primera galería cuyas palabras aparezcan. Ejemplos: «botellones» elige AGUA y «yogurt» elige LÁCTEOS. Si ninguna coincide, se usa la galería `predeterminada`.

## Cómo se envía sin volverse lento ni colgarse

- **No usa IA ni tokens.** Todo es código y configuración.
- **Un solo nodo HTTP para todas las fotos.** `Preparar galería trabajos` convierte la lista en un item por medio. `YCloud Enviar galería trabajos` los envía de uno en uno, cada 600 ms y en orden. Diez medios tardan unos 6 segundos.
- **Sin caption,** para que WhatsApp los agrupe como galería.
- **Cada request tiene un timeout de 20 s y continúa ante error:** un link roto no detiene los demás ni el flujo.
- **La misma guardia de salida que el resto de mensajes.** Si el cliente escribió otra vez o un humano tomó la conversación, la galería no sale.
- **El cierre sale una sola vez** (`Esperar cierre galería` con `executeOnce`), 4 s después del último medio.
- **Máximo 15 medios por galería** y solo links `https`.

Sobre la agrupación: la API envía cada foto como un mensaje. WhatsApp agrupa en galería los medios consecutivos sin texto, pero la forma de mostrarlos depende de la app del cliente. Las fotos llegan igual aunque no se agrupen.

## Cómo cargar los links

Ejecutar en PostgreSQL con los links que subiste al servidor. Las `palabras` se comparan sin tildes ni mayúsculas y aceptan plural: «botellon» reconoce «botellones». El tipo sale de la extensión (`.mp4`, `.mov` o `.3gp` = video). Si un link no tiene extensión, usa `{"url": "...", "tipo": "video"}`.

```sql
INSERT INTO pegaso.configuracion_bot (clave, valor_json, actualizado_at)
VALUES (
  'GALERIA_TRABAJOS',
  '{
    "activo": true,
    "texto_cierre": "Le adjunto varios de nuestros trabajos.",
    "galerias": [
      {
        "clave": "AGUA",
        "palabras": ["agua", "botella", "botellon", "bidon", "galon", "purificada", "alcalina"],
        "medios": [
          "https://pegasoadhesivos.com/wp-content/uploads/AAAA/MM/<agua-1>.jpg",
          "https://pegasoadhesivos.com/wp-content/uploads/AAAA/MM/<agua-2>.mp4"
        ]
      },
      {
        "clave": "LACTEOS",
        "palabras": ["leche", "yogurt", "yogur", "queso", "lacteo", "kumis"],
        "medios": [
          "https://pegasoadhesivos.com/wp-content/uploads/AAAA/MM/<lacteos-1>.jpg"
        ]
      },
      {
        "clave": "GENERAL",
        "predeterminada": true,
        "medios": [
          "https://pegasoadhesivos.com/wp-content/uploads/AAAA/MM/<general-1>.jpg"
        ]
      }
    ]
  }'::jsonb,
  NOW()
)
ON CONFLICT (clave) DO UPDATE
SET valor_json = EXCLUDED.valor_json,
    actualizado_at = NOW();
```

Para agregar o quitar fotos después basta con actualizar esta fila. No hay que tocar el flujo. Para apagar la galería, cambiar `"activo"` a `false`.

## Cambios por nodo

Detalle en [FLUJO-WORKFLOW-PEGASO.md §23](../FLUJO-WORKFLOW-PEGASO.md#23-galería-de-trabajos).

| Nodo | Cambio |
|---|---|
| Obtener configuración MODO_PRUEBA | Lee también `GALERIA_TRABAJOS` |
| Resolver contexto comercial | V3.35 → **V3.36**. Decide la galería con el módulo `code/preventa/galeria-trabajos.js` y la registra en el contexto |
| Preparar envío WhatsApp | V3.7 → **V3.8**. Arma los cuerpos YCloud de la galería y del cierre |
| 7 nodos nuevos | `IF: ¿Enviar galería trabajos?`, `Autorizar salida galería trabajos`, `IF permiso salida galería trabajos`, `Preparar galería trabajos` (Code), `YCloud Enviar galería trabajos`, `Esperar cierre galería` y `YCloud Enviar cierre galería`. Cuelgan de la rama falsa de `IF: ¿Enviar nota IVA?`, que estaba libre, y usan la credencial existente YCloud API |

## Límites

- El envío se registra en el contexto antes de salir. Si en ese momento la guardia bloquea la salida porque el cliente escribió de nuevo, o la respuesta se omite por duplicada, la galería no se vuelve a intentar en esa conversación.
- La detección de una galería enviada a mano mira los últimos mensajes del historial que recibe el bot, que son 10.
- Las galerías de tarjetas y flyers siguen con sus videos e imágenes propios.

## Verificación

```powershell
node --test tests/preventa.test.mjs tests/eficiencia-preventa.test.mjs tests/ubicacion.test.mjs tests/consumo-ia.test.mjs tests/galeria-trabajos.test.mjs tests/insistencia-leads.test.mjs tests/insistencia-rutina.test.mjs
node scripts/inject-code.mjs
node scripts/validate-workflow.mjs
node scripts/prepare-update.mjs
node scripts/check-encoding.mjs
```

- Pasan 112 pruebas, 10 de ellas nuevas en `tests/galeria-trabajos.test.mjs`:
  - momentos de enganche;
  - elección por producto, con plural y sin falsos positivos («aguacate» no es AGUA);
  - una sola vez, también si la envió un asesor;
  - sin configuración no hay cambios;
  - cotización y derivación excluidas;
  - salida del resolver;
  - cuerpos YCloud sin caption;
  - un item por medio;
  - cableado del flujo: lotes de 1, `executeOnce` y la misma guardia de salida.
- Validadores correctos: 254 nodos y 74 Code Nodes compilados. Los prompts y el cálculo de precios son idénticos a producción.

## Pasos para publicar

1. Con autorización, ejecutar `push.ps1`.
2. Cargar la fila `GALERIA_TRABAJOS` con los links reales.
3. Probar desde un número de prueba:
   - «¿Cobran cireles?»: respuesta, galería y cierre;
   - repetir la pregunta: la galería no se repite;
   - «Precio de etiquetas para botellones» seguido de «¿Qué material son?»: galería AGUA.
