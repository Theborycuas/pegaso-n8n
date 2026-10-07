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
| `esperado` | Campos que debe tener el primer item de salida (solo se comparan los que pongas) |
| `error` | En lugar de `esperado`: texto que debe contener el error que lanza el nodo |

Nombre: `<etapa>-<nodo>--<caso>.json`, por ejemplo `03-resolver-permiso--modo-prueba-autorizado.json`.

Los fixtures de las etapas 01–03 encadenan un mismo caso (Ana Pérez, `593987654321`, "Hola, necesito etiquetas de 10x5 cm") desde el webhook de YCloud hasta "Preparar contexto IA". Los que documentan un bug actual lo dicen en `descripcion` y citan el número de [pendientes técnicos](../docs/pendientes-tecnicos.md); al corregirlo, actualiza su `esperado`.

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
- `cotizacion/precios.json` lista medidas, forma y cantidad con el total esperado de `calcular-precio-detalle.js`.
