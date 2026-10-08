# Tests

Pruebas para comprobar que un cambio no rompió la entrada, la cotización, el handoff ni la conversación.

```
tests/
├── fixtures/            # Pruebas automáticas de nodos Code (npm test)
├── cerebro-comercial/   # Conversaciones completas: qué decide el bot en cada turno (manual)
└── cotizacion/          # Precios y mensajes de cotización esperados (manual)
```

## Fixtures: pruebas automáticas de nodos Code

```bash
npm test                                              # corre todos
node scripts/run-node.mjs tests/fixtures/<archivo>    # corre uno e imprime la salida completa
```

`scripts/run-node.mjs` ejecuta el `.js` del nodo fuera de n8n, simulando `$input`, `$json` y `$('Nombre del nodo')` con los datos del fixture, y compara la salida con lo esperado.

```json
{
  "archivo": "code/03-conversacion/resolver-permiso-automatizacion.js",
  "descripcion": "MODO_PRUEBA activo y teléfono fuera de la lista: el bot no responde.",
  "input": [ { "clave": "MODO_PRUEBA", "valor_json": { "activo": true, "telefonos_permitidos": ["593999999999"] } } ],
  "nodos": {
    "Normalizar mensaje": [ { "telefono": "593987654321", "mensaje": "Hola" } ],
    "Preparar conversación": [ { "conversacion_id": 41 } ]
  },
  "esperado": { "modo_prueba": true, "puede_responder_bot": false }
}
```

| Campo | Qué es |
|---|---|
| `archivo` | Nodo Code a ejecutar |
| `input` | Items que recibe el nodo (`$input`). Un Postgres sin resultados con *Always Output Data* entrega `[{}]` |
| `nodos` | Salida de otros nodos que el código lee con `$('...')` |
| `esperado` | Campos que debe tener el primer item de salida (solo se comparan los que pongas). Los arrays se comparan completos; para revisar solo parte de un elemento usa el índice como clave: `"detalles": { "0": { "cantidad": 1000 } }` |
| `esperadoItem` | Opcional: campos del primer item **completo** (`json`, `binary`, `pairedItem`), p. ej. para comprobar que el binario se reenvía |
| `esperadoCantidad` | Opcional: cantidad exacta de items de salida (`0` = el nodo no devuelve nada y la rama se detiene) |
| `binarios` | Opcional: binarios por nodo (`{ "Descargar imagen YCloud": [ { "imagen": { "mimeType": "image/jpeg" } } ] }`) |
| `error` | En lugar de `esperado`: texto que debe contener el error que lanza el nodo |

Nombre: `<etapa>-<nodo>--<caso>.json`, por ejemplo `03-resolver-permiso--modo-prueba-autorizado.json`.

Los fixtures de las etapas 01–08 encadenan el mismo prospecto (Ana Pérez, `593987654321`, conversación 41, prospecto 16): la entrada de cada nodo es la salida real del anterior. Hay cuatro casos:

- "Hola, necesito etiquetas de 10x5 cm", del webhook de YCloud al Switch (`COTIZAR_P4`). Sigue por la cotización (07): sin cantidad, diseño existente, cotización 77 por $36, cierre y envío por YCloud (08).
- La variante 1x5 en la etapa 07 (rama no producible del cotizador). En la etapa 04 la misma medida ya termina en `MEDIDA_NO_PRODUCIBLE` y no llega al cotizador; los fixtures 07 se conservan para la rama de 1 a 2 cm (pendiente 8).
- Pregunta por el material: rama de respuesta comercial (05).
- "Pásame una cuenta para pagar" / "Hola. Envíeme un número de cuenta por favor.": rama de derivación humana (06) hasta el correo interno (`INTERESADO_PAGO`, ALTA).

Los fixtures del turno conversacional (`03-resolver-turno--*`) usan ids de mensaje propios por caso. Simulan lo que ve **cada ejecución** después de la espera: el mismo historial con distinto `Guardar mensaje entrante` decide quién responde (`--dos-mensajes-gana-ultimo` frente a `--dos-mensajes-anterior-no-reacciona`). "Preparar contexto IA" lee el historial con `$('Recuperar historial conversación')`, así que en sus fixtures las filas van en `nodos` y `input` es la salida del IF "¿Procesar turno?". La confirmación atómica ("Confirmar turno conversacional") es SQL y se prueba en n8n.

Los fixtures de imágenes siguen el recorrido de un turno con media:

- `01-preparar-entrada--imagen*`, `--audio-*` y `--sticker-*`: el descriptor que se guarda en `mensajes.contenido`.
- `01-preparar-entrada-no-soportada--*`: ubicación y audio sin `media_id` (derivación directa) y sticker (ignorado, sin item).
- `03-preparar-media-turno--*`: qué imágenes se analizan.
- `03-validar-analisis-imagen-groq--*`, `-deepseek--*`, `-openai--*`: la salida del "Analizar imagen …" de ese proveedor va en `input` (`output`, `text` o `error`); "Preparar media del turno" y "Descargar imagen YCloud" van en `nodos`, y el binario en `binarios` (para comprobar que el validador lo reenvía al siguiente proveedor).
- `03-preparar-contexto-ia--*` con media, incluidos `--espera-fallback-imagen` y `--fallo-total-imagen-no-continua` (sin item: `esperadoCantidad: 0`).
- `04-normalizar-decision-ia--imagen-*`: las derivaciones forzadas.
- `06-*--imagen-*` / `--envia-comprobante` / `--entrada-no-soportada-directa`.

La descarga (HTTP) y la IA visual se prueban en n8n (pendiente técnico 62). Ningún fixture usa enlaces ni claves reales.

Los que documentan un bug actual lo dicen en `descripcion` y citan el número de [pendientes técnicos](../docs/pendientes-tecnicos.md); al corregirlo, actualiza su `esperado`.

**Cómo crear uno desde n8n**: abre una ejecución real, entra al nodo, copia el JSON de *Input* en `input` y el de los nodos que referencia en `nodos`.

## Casos de conversación (manuales)

Un archivo `.json` por escenario en `cerebro-comercial/` o `cotizacion/`. Cada turno es un mensaje del cliente y lo que debe pasar; se prueban con el trigger "Mensaje entrante TEST" de n8n porque dependen de la IA.

```json
{
  "nombre": "Pide cuenta para pagar",
  "estado": "borrador",
  "contexto_inicial": { "prospecto_estado": "NUEVO", "contexto_comercial": {} },
  "turnos": [
    {
      "cliente": "pásame una cuenta",
      "esperado": { "accion": "DERIVAR_HUMANO", "motivo_derivacion": "SOLICITA_DATOS_PAGO" },
      "no_esperado": { "accion": "COTIZAR_P4" }
    }
  ]
}
```

- `estado`: `borrador` hasta que el comportamiento esté confirmado por negocio; luego `vigente`.
- `enviar_tras_ms` (opcional): tiempo desde el mensaje anterior. Por debajo de la ventana del turno (3000 ms) los mensajes se agrupan y solo el último responde; los casos en ráfaga se prueban con WhatsApp real, porque dos ejecuciones manuales en el editor no corren en paralelo. Sin este campo, cada mensaje se envía después de recibir la respuesta anterior.
- `cotizacion/precios.json` lista medidas, forma y cantidad con el total esperado de `calcular-precio-detalle.js`.
