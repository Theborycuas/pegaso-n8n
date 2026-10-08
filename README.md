# pegaso-n8n

Código fuente versionado del workflow **Pegaso WhatsApp** de n8n: el bot comercial de WhatsApp de Pegaso Adhesivos (atiende prospectos, cotiza etiquetas en P4 y deriva a un humano).

n8n guarda todo el workflow como un único JSON, con el código de cada nodo embebido como texto. Este repo separa esa lógica en archivos editables (un `.js` por nodo Code, prompts y schemas de la IA) y un script los sincroniza con el JSON.

## Documentación

| Documento | Para qué |
|---|---|
| [docs/arquitectura.md](docs/arquitectura.md) | Recorrido completo del mensaje, etapas y qué archivo implementa cada nodo |
| [docs/etapas/](docs/etapas/) | Configuración exacta de cada nodo por etapa (Postgres, IF, Merge, Code). Hoy: 01 a 08 (todas) |
| [docs/reglas-comerciales.md](docs/reglas-comerciales.md) | Mínimos, medidas, catálogo, fórmula de precio, clasificación A/B/C, acciones |
| [docs/flujo-handoff.md](docs/flujo-handoff.md) | Derivación a humano, mensajes de transición y correos internos |
| [docs/modelo-datos.md](docs/modelo-datos.md) | Tablas PostgreSQL y estructura de `contexto_comercial` |
| [docs/pendientes-tecnicos.md](docs/pendientes-tecnicos.md) | Bugs e inconsistencias conocidos, por prioridad |

## Estructura

```
pegaso-n8n/
├── workflows/
│   ├── pegaso-whatsapp.json        # Export del workflow (se importa en n8n)
│   ├── pegaso-whatsapp.map.json    # Qué archivo corresponde a qué nodo
│   └── snapshots/                  # Copias de producción antes de cambios grandes
├── code/                           # Un .js por nodo Code, agrupado por etapa del flujo
│   ├── 01-entrada/                 # Webhook YCloud → mensaje normalizado (y entradas no soportadas)
│   ├── 02-contacto-prospecto/      # Cliente existente / prospecto
│   ├── 03-conversacion/            # Conversación, modo prueba, turno, imágenes (Groq → DeepSeek → OpenAI), contexto IA
│   ├── 04-cerebro-comercial/       # Validación y reglas sobre la decisión de la IA
│   ├── 05-respuesta-comercial/     # Respuesta y estado del prospecto
│   ├── 06-derivacion-humana/       # Handoff a humano y notificaciones (Brevo/Resend)
│   ├── 07-cotizacion/              # Extractor IA, diseño, producibilidad y precios
│   └── 08-salida-whatsapp/         # Envío por YCloud
├── prompts/                        # Prompt de sistema de cada cerebro IA
├── schemas/                        # JSON Schema de salida de cada cerebro IA
├── tests/                          # Casos de conversación, precios y fixtures (npm test)
├── docs/
│   └── etapas/                     # Configuración nodo por nodo de cada etapa
└── scripts/
    ├── n8n-sync.mjs                # status | extract | build
    └── run-node.mjs                # Ejecuta nodos Code con fixtures (npm test)
```

Cuando varios nodos comparten la misma lógica (por ejemplo, los tres "Validar extracción" del fallback Groq → DeepSeek → OpenAI), apuntan al mismo archivo en el mapa. Un cambio de regla se hace una sola vez. Si la lógica depende del proveedor, cada nodo tiene su archivo (los tres "Validar análisis imagen Groq / DeepSeek / OpenAI" marcan `proveedor_analisis` y deciden el siguiente paso de la cascada), y el prompt y el schema siguen siendo compartidos.

`workflows/pegaso-whatsapp.json` no está en el repo todavía: `npm run status`, `build` y `extract` fallan hasta exportarlo (paso 1 del flujo de trabajo).

## Encabezado de cada archivo

Todo archivo de `code/` empieza con este bloque, que también queda visible dentro del nodo en n8n:

```js
// ======================================================
// NODO N8N: Preparar contexto IA
// ARCHIVO: code/03-conversacion/preparar-contexto-ia.js
// VERSION: 2.2
// RESPONSABILIDAD:
// - construir contexto para el cerebro comercial
// - NO decidir precio
// - NO modificar PostgreSQL
// ======================================================
```

- `NODO N8N` debe coincidir exactamente con el nombre del nodo y con `pegaso-whatsapp.map.json`.
- `VERSION`: sube el menor (2.2 → 2.3) en ajustes de regla y el mayor (2.x → 3.0) si cambia el contrato de entrada o salida del nodo.
- `RESPONSABILIDAD`: qué hace y, con `NO`, qué le corresponde a otro nodo. Actualízala si cambia.

## Flujo de trabajo

1. **Exportar** el workflow desde n8n (menú `...` → *Download*) y guardarlo como `workflows/pegaso-whatsapp.json`.
   Con CLI: `n8n export:workflow --id=<ID> --pretty --output=workflows/pegaso-whatsapp.json`.
2. **Comparar**: `npm run status` muestra qué archivos difieren del workflow y qué nodos no están mapeados.
3. **Editar** el `.js`, `.md` o `.schema.json` que corresponda al cambio de negocio (subir `VERSION`) y ejecutar `npm test`. Si el cambio altera un resultado a propósito, actualiza el `esperado` del fixture.
4. **Construir**: `npm run build` inyecta los cambios en `workflows/pegaso-whatsapp.json`.
5. **Importar** ese JSON en n8n (*Import from File* sobre el workflow) o con `n8n import:workflow --input=workflows/pegaso-whatsapp.json`. Antes de un cambio grande, guarda una copia en `workflows/snapshots/`.
6. **Commit** de los archivos editados y del JSON.

`npm run extract` hace lo contrario (workflow → archivos) y **sobrescribe** los archivos. Úsalo solo si alguien editó código directamente en n8n; revisa `git diff` después.

> **Primera sincronización**: los archivos ya tienen encabezados que los nodos de n8n todavía no. Exporta, ejecuta `npm run status` y luego `npm run build` + importar. No uses `extract` esa primera vez o se perderán los encabezados.

## Reglas

- Los cambios estructurales (nodos nuevos, conexiones, credenciales, consultas Postgres) se hacen en n8n y luego se vuelve a exportar. Si agregas un nodo Code, añádelo a `pegaso-whatsapp.map.json` y a `docs/arquitectura.md`.
- Si renombras un nodo en n8n, busca su nombre en `code/`: muchos nodos leen datos de otros con `$('Nombre del nodo')`.
- Si cambia una regla de negocio, actualiza `docs/reglas-comerciales.md` en el mismo commit.
- Los archivos con la marca `@pendiente` se ignoran en `build`.
- Los prompts usan expresiones de n8n (`{{ ... }}`). En n8n esos campos llevan `=` al inicio; el script lo agrega y lo quita solo, los `.md` no lo llevan.
- Los schemas se sincronizan solo si el nodo IA usa *Schema Type: Define using JSON Schema* (`manual`) o *Generate from JSON example* (`fromJson`).
- Nunca se versionan credenciales: el JSON exportado solo guarda referencias por ID.
