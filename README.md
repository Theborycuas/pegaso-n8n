# pegaso-n8n

Código fuente versionado del workflow **Pegaso WhatsApp** de n8n: nodos Code, prompts de los cerebros IA y sus schemas de salida.

n8n guarda todo el workflow como un único JSON, con el código de cada nodo embebido como texto. Este repo separa esa lógica en archivos editables y un script los sincroniza con el JSON.

## Estructura

```
pegaso-n8n/
├── workflows/
│   ├── pegaso-whatsapp.json        # Export del workflow (fuente para importar en n8n)
│   └── pegaso-whatsapp.map.json    # Qué archivo corresponde a qué nodo
├── code/                           # Un .js por nodo Code, agrupado por etapa del flujo
│   ├── 01-entrada/                 # Webhook YCloud → mensaje normalizado
│   ├── 02-contacto-prospecto/      # Cliente existente / prospecto
│   ├── 03-conversacion/            # Conversación, modo prueba, permisos, contexto IA
│   ├── 04-cerebro-comercial/       # Validación y reglas sobre la decisión de la IA
│   ├── 05-respuesta-comercial/     # Respuesta por acción comercial y estado del prospecto
│   ├── 06-derivacion-humana/       # Handoff a humano y notificaciones (Brevo/Resend)
│   ├── 07-cotizacion/              # Extractor IA, diseño, producibilidad y precios
│   └── 08-salida-whatsapp/         # Envío por YCloud
├── prompts/                        # Prompt de sistema de cada cerebro IA
│   ├── cerebro-comercial.md
│   └── extractor-cotizacion.md
├── schemas/                        # JSON Schema de salida de cada cerebro IA
│   ├── cerebro-comercial.schema.json
│   └── extractor-cotizacion.schema.json
└── scripts/
    └── n8n-sync.mjs                # status | extract | build
```

Cuando varios nodos comparten la misma lógica (por ejemplo, los tres "Validar extracción" del fallback Groq → DeepSeek → OpenAI), apuntan al mismo archivo en el mapa. Así, un cambio de regla se hace una sola vez.

## Flujo de trabajo

1. **Exportar** el workflow desde n8n (menú `...` → *Download*) y guardarlo como `workflows/pegaso-whatsapp.json`.
   Con acceso a la CLI: `n8n export:workflow --id=<ID> --pretty --output=workflows/pegaso-whatsapp.json`.
2. **Extraer** el código a archivos: `npm run extract`.
3. **Editar** el archivo `.js`, `.md` o `.schema.json` que corresponda al cambio de negocio.
4. **Revisar** las diferencias: `npm run status`.
5. **Construir** el JSON con los cambios: `npm run build`.
6. **Importar** `workflows/pegaso-whatsapp.json` en n8n (*Import from File* sobre el workflow) o con
   `n8n import:workflow --input=workflows/pegaso-whatsapp.json`.
7. **Commit** de los archivos editados y del JSON.

## Reglas

- Los cambios estructurales (nodos nuevos, conexiones, credenciales) se hacen en n8n y luego se vuelve a exportar.
  Si agregas un nodo Code, añádelo también a `pegaso-whatsapp.map.json`.
- Los archivos con la marca `@pendiente` se ignoran en `build`, para no sobrescribir nodos con contenido vacío.
- Si un prompt usa expresiones de n8n (`{{ $json... }}`), el archivo debe empezar con `=`, igual que en n8n.
- Los schemas se sincronizan solo si el nodo IA usa *Schema Type: Define using JSON Schema* (`manual`) o *Generate from JSON example* (`fromJson`).
- Nunca se versionan credenciales: el JSON exportado solo guarda referencias por ID.
