# Tests

Casos de prueba para comprobar que un cambio no rompió la cotización, el handoff ni la conversación. Todavía **no hay runner automático**: por ahora los casos son la especificación de lo esperado y se verifican a mano con el trigger "Mensaje entrante TEST" de n8n.

```
tests/
├── cerebro-comercial/   # Conversaciones completas: qué decide el bot en cada turno
├── cotizacion/          # Precios y mensajes de cotización esperados
└── fixtures/            # Entradas JSON capturadas de ejecuciones reales de n8n
```

## Casos de conversación

Un archivo `.json` por escenario. Cada turno es un mensaje del cliente y lo que debe pasar:

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

- `esperado`: campos que deben coincidir exactamente en la decisión final (o en la cotización).
- `no_esperado`: valores que **no** deben aparecer.
- `estado`: `borrador` hasta que el comportamiento esté confirmado por negocio; luego `vigente`.

## Casos de precio

`cotizacion/precios.json` lista medidas, forma y cantidad con el total esperado. Sirve para validar cualquier cambio en `code/07-cotizacion/calcular-precio-detalle.js`.

## Fixtures

`fixtures/` guarda la entrada real de un nodo Code (copiada desde una ejecución de n8n: panel del nodo → *Input* → JSON). Nombre sugerido: `<archivo-del-nodo>--<caso>.json`, por ejemplo `calcular-precio-detalle--10x5-rectangular.json`. Con eso se podrá ejecutar el nodo localmente sin n8n.
