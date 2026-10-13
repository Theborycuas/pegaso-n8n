# Arquitectura de `pegaso-n8n`

Documento técnico del estado **actual** del repositorio. Todo lo descrito aquí se obtuvo inspeccionando los archivos y scripts que existen hoy; no describe estructuras anteriores.

> **Estado inspeccionado:** 13 oct 2026, commit `645bbf5` en `main` (sincronizado con `origin/main`).
> Las cantidades (nodos, conexiones, Code Nodes) corresponden a ese momento y cambian con cada `pull.ps1`. La fuente actual siempre es `code/_extraidos/manifest.json` y `state/remote-base.json`.

Documentos relacionados:

- [GUIA-USO-PEGASO-N8N.md](GUIA-USO-PEGASO-N8N.md): runbook operativo (qué hacer paso a paso).
- [REGLAS-PARA-CURSOR.md](REGLAS-PARA-CURSOR.md): reglas para agentes de IA que trabajen en el repo.
- [FLUJO-WORKFLOW-PEGASO.md](FLUJO-WORKFLOW-PEGASO.md): recorrido del workflow nodo por nodo y sus conexiones.

---

## 1. Propósito del repositorio

`pegaso-n8n` permite trabajar el workflow principal de Pegaso desde Cursor/local con un enfoque **workflow-as-code**: el workflow de producción se descarga como JSON, el código de cada nodo Code se separa en un `.js` editable, y los cambios se vuelven a subir a n8n con validaciones y control de concurrencia.

```
n8n producción
   │  .\scripts\pull.ps1        (n8n-cli workflow get)
   ▼
workflows/sistema-automatizado-pegaso.json        (copia fiel de producción)
   │  copia
   ▼
workflows/sistema-automatizado-pegaso.edit.json   (workflow editable)
   │  scripts/extract-code.mjs
   ▼
code/_extraidos/*.js + manifest.json              (un .js por Code Node)
   │  edición en Cursor
   ▼
   │  .\scripts\push.ps1
   │    ├─ verifica que producción no cambió (state/remote-base.json)
   │    ├─ scripts/inject-code.mjs       → build/…build.json
   │    ├─ scripts/validate-workflow.mjs
   │    ├─ scripts/prepare-update.mjs    → build/…update.json
   │    ├─ snapshot remoto pre-push      → snapshots/
   │    ├─ n8n-cli workflow update
   │    ├─ scripts/download-workflow.mjs (re-descarga)
   │    └─ scripts/extract-code.mjs      (re-extrae)
   ▼
n8n producción
```

El repositorio **no** contiene `package.json`, tests ni `npm run …`. Todo se opera con los dos scripts PowerShell (`pull.ps1`, `push.ps1`) y los seis scripts Node (`.mjs`) de `scripts/`.

---

## 2. Workflow principal

| Dato | Valor (estado inspeccionado) | Fuente |
|---|---|---|
| Nombre exacto | `SISTEMA AUTOMATIZADO PEGASO` | `state/remote-base.json`, `pull.ps1` (`$WF_NAME`) |
| Workflow ID | `09OF22FOxihypeeh` | `state/remote-base.json`, `download-workflow.mjs` (constante) |
| Activo | `true` | workflow JSON |
| `updatedAt` base | `2026-10-13T16:28:08.664Z` | `state/remote-base.json` |
| `versionId` base | `3e62b91c-b61b-4a0e-a921-7897ed11c8d4` | `state/remote-base.json` |
| `activeVersionId` | igual a `versionId` (versión publicada = última guardada) | workflow JSON |
| Nodos totales | 182 | workflow JSON / manifest |
| Code Nodes | 69 | manifest (`codeNodeCount`) |
| Nodos origen con conexiones | 169 | `Object.keys(connections)` |
| Settings | `executionOrder: v1`, `binaryMode: separate` | workflow JSON |
| Archivo principal | `workflows/sistema-automatizado-pegaso.json` | |
| Archivo editable | `workflows/sistema-automatizado-pegaso.edit.json` | |
| Build | `build/sistema-automatizado-pegaso.build.json` | |
| Payload de update | `build/sistema-automatizado-pegaso.update.json` | |

Distribución de nodos por tipo (estado inspeccionado):

| Tipo | Cantidad |
|---|---|
| `n8n-nodes-base.code` | 69 |
| `n8n-nodes-base.postgres` | 34 |
| `n8n-nodes-base.if` | 34 |
| `n8n-nodes-base.httpRequest` | 9 |
| `@n8n/n8n-nodes-langchain.informationExtractor` | 6 |
| `n8n-nodes-base.set` | 3 |
| `n8n-nodes-base.merge` | 3 |
| `n8n-nodes-base.webhook` | 3 (`Webhook Get`, `Webhook Post`, `Webhook YCloud`) |
| `n8n-nodes-base.respondToWebhook` | 3 |
| `@n8n/n8n-nodes-langchain.lmChatOpenAi` / `lmChatGroq` / `lmChatDeepSeek` | 3 / 3 / 3 |
| `@n8n/n8n-nodes-langchain.outputParserStructured` | 3 |
| `@n8n/n8n-nodes-langchain.chainLlm` | 3 |
| `n8n-nodes-base.switch` | 1 |
| `n8n-nodes-base.wait` | 1 |
| `n8n-nodes-base.manualTrigger` | 1 |

Nodos aislados (sin conexiones de flujo) en el estado inspeccionado: `Webhook Post`, `Respond to Webhook Post`, `Enviar WhatsApp Cloud API1` y `Execute a SQL query`.

El recorrido completo nodo por nodo (qué hace cada uno, de quién recibe, a quién envía, ramas true/false) está en [FLUJO-WORKFLOW-PEGASO.md](FLUJO-WORKFLOW-PEGASO.md).

### Estructura interna del JSON descargado

El JSON que devuelve `n8n-cli workflow get` contiene, además de `nodes` y `connections`, campos de solo lectura (`id`, `active`, `createdAt`, `updatedAt`, `versionId`, `versionCounter`, `triggerCount`, `shared`, `tags`, `meta`, `isArchived`…) y un objeto **`activeVersion`** con una segunda copia completa de `nodes` y `connections` (la versión publicada). Por eso cualquier valor aparece **dos veces** en el archivo (por ejemplo, un secreto hardcodeado aparece en `nodes` y en `activeVersion.nodes`).

Solo `nodes`, `connections`, `settings` y algunos opcionales se envían en el push (ver `prepare-update.mjs`).

---

## 3. Arquitectura de carpetas

Árbol real (sin `.git/`):

```
pegaso-n8n/
├── .cursor/
│   └── rules/
│       └── pegaso-n8n.mdc            # Regla de Cursor (alwaysApply). Ver "Inconsistencias".
├── build/                            # IGNORADO por Git. Derivados de push.ps1
│   ├── sistema-automatizado-pegaso.build.json
│   └── sistema-automatizado-pegaso.update.json
├── code/
│   └── _extraidos/                   # Un .js por Code Node + manifest.json (69 + 1)
├── docs/                             # Esta documentación
├── scripts/
│   ├── pull.ps1
│   ├── push.ps1
│   ├── download-workflow.mjs
│   ├── extract-code.mjs
│   ├── inject-code.mjs
│   ├── validate-workflow.mjs
│   ├── prepare-update.mjs
│   └── check-encoding.mjs
├── snapshots/                        # IGNORADO por Git. Copias automáticas pre-pull / pre-push
├── state/
│   └── remote-base.json              # Base de concurrencia (último estado remoto conocido)
├── workflows/
│   ├── sistema-automatizado-pegaso.json
│   └── sistema-automatizado-pegaso.edit.json
├── .gitattributes                    # * text=auto eol=lf
├── .gitignore
└── README.md
```

| Carpeta | Para qué sirve | ¿Versionada? |
|---|---|---|
| `workflows/` | JSON completo del workflow: copia de producción y copia editable | Sí |
| `code/_extraidos/` | Código de cada Code Node como `.js` + `manifest.json` | Sí |
| `scripts/` | Herramientas de sincronización con n8n | Sí |
| `state/` | `remote-base.json`: control de concurrencia | Sí |
| `build/` | Workflow con código inyectado y payload para la API | **No** (`.gitignore`) |
| `snapshots/` | Respaldos automáticos antes de pull/push | **No** (`.gitignore`) |
| `docs/` | Documentación | Sí |
| `.cursor/rules/` | Reglas para el agente de Cursor | Sí |

---

## 4. Archivos de workflow

| Archivo | Quién lo genera | ¿Fuente o derivado? | ¿Editar a mano? | Cuándo se regenera |
|---|---|---|---|---|
| `workflows/sistema-automatizado-pegaso.json` | `pull.ps1` (vía PowerShell) y `download-workflow.mjs` (dentro de `push.ps1`) | **Derivado**: copia de producción | **No** | En cada `pull.ps1` y al final de cada `push.ps1` |
| `workflows/sistema-automatizado-pegaso.edit.json` | Copia de `…pegaso.json` hecha por `pull.ps1` y `push.ps1` | **Fuente** de la estructura (nodos no-Code, conexiones, parámetros) | Sí, con cuidado | Se **sobrescribe** en cada `pull.ps1` y al final de cada `push.ps1` |
| `build/sistema-automatizado-pegaso.build.json` | `inject-code.mjs` | Derivado: `edit.json` + código de `code/_extraidos/` | No | En cada `push.ps1` |
| `build/sistema-automatizado-pegaso.update.json` | `prepare-update.mjs` | Derivado: subconjunto de `build.json` aceptado por la API | No | En cada `push.ps1` |

Puntos clave:

- **`sistema-automatizado-pegaso.json`** es la referencia de "lo que hay en producción". `extract-code.mjs` lee **este** archivo, no el `.edit.json`.
- **`sistema-automatizado-pegaso.edit.json`** es lo que `push.ps1` envía (después de inyectarle el código). Los cambios estructurales se hacen aquí.
- Para los Code Nodes listados en el manifest, el `parameters.jsCode` del `.edit.json` **se ignora**: `inject-code.mjs` lo reemplaza por el contenido del `.js` correspondiente.
- Tanto `pull.ps1` como `push.ps1` **sobrescriben** `.edit.json` sin comprobar si tenía cambios locales sin subir.

---

## 5. Code Nodes

### 5.1 `code/_extraidos/`

Contiene un `.js` por cada nodo de tipo `n8n-nodes-base.code` (69 en el estado inspeccionado) y `manifest.json`.

Cada `.js` tiene un **header local** seguido del código real del nodo:

```js
// ======================================================
// N8N NODE - PEGASO
// ======================================================
// Nombre: Finalizar ciclo comercial
// Node ID: bb0cdcce-1f5d-4f2f-ab29-3528dda20787
// TypeVersion: 2
//
// Workflow:
// SISTEMA AUTOMATIZADO PEGASO
//
// Workflow ID:
// 09OF22FOxihypeeh
//
// NOTA:
// Archivo generado automáticamente desde n8n.
// El header NO pertenece al código almacenado en n8n.
// ======================================================

return [ ... ];
```

El header **no** se sube a n8n. El código debajo es el contenido literal del nodo Code (script con `return` top-level, usa `$input`, `$json`, `$('Nodo')`); no es un módulo: no usa `import`/`require`/`export`.

### 5.2 Cómo `extract-code.mjs` genera los `.js`

1. Lee `workflows/sistema-automatizado-pegaso.json` (quita BOM si existe).
2. Filtra `nodes` con `type === 'n8n-nodes-base.code'`.
3. **Borra completamente** `code/_extraidos/` (`fs.rmSync`) y lo vuelve a crear.
4. Para cada nodo con `parameters.jsCode`:
   - Nombre de archivo = nombre del nodo normalizado: NFD, sin diacríticos, minúsculas, todo lo que no sea `[a-z0-9]` → `-`. Si se repite, añade `-2`, `-3`…
   - Escribe header + `jsCode`.
5. Escribe `manifest.json`.

Consecuencia: el nombre del archivo **depende del nombre del nodo**. Si el nodo se renombra, en el siguiente extract el archivo cambia de nombre (Git lo verá como borrado + creado).

### 5.3 `manifest.json`

```json
{
  "workflowId": "09OF22FOxihypeeh",
  "workflowName": "SISTEMA AUTOMATIZADO PEGASO",
  "workflowUpdatedAt": "2026-10-13T16:28:08.664Z",
  "extractedAt": "…",
  "workflowNodeCount": 182,
  "codeNodeCount": 69,
  "nodes": [
    {
      "nodeId": "e581adfb-04f8-4998-a994-c6d425bd395c",
      "nodeName": "Calcular precio detalle",
      "fileName": "calcular-precio-detalle.js",
      "relativeFile": "code/_extraidos/calcular-precio-detalle.js",
      "typeVersion": 2,
      "lines": 1465
    }
  ]
}
```

Relaciona **archivo ↔ `nodeId` ↔ `nodeName`**. Es la tabla que usa `inject-code.mjs` para saber en qué nodo va cada archivo.

### 5.4 Cómo `inject-code.mjs` los vuelve a introducir

1. Lee `workflows/sistema-automatizado-pegaso.edit.json` y `code/_extraidos/manifest.json`.
2. Para cada entrada del manifest busca el nodo **por `nodeId`** en `edit.json`. Si no lo encuentra → error y se detiene.
3. Lee `relativeFile`. Si no existe → error.
4. Quita el header: busca la **primera** aparición de `// ======================================================\n\n` (línea separadora seguida de línea vacía, con saltos LF) y descarta todo lo anterior.
5. Quita espacios finales y asigna el resultado a `node.parameters.jsCode`.
6. Escribe `build/sistema-automatizado-pegaso.build.json`.

Implicaciones:

- **El `nodeId` es la clave.** Si se cambia el `id` de un nodo en `edit.json`, el manifest deja de encontrarlo y `inject` falla. Si se cambia en el manifest, el código se inyectaría en otro nodo o fallaría. No cambiar IDs.
- **El nombre del nodo también es sensible**: `connections` usa nombres de nodo (no IDs) como claves y destinos, y 43 de los 69 Code Nodes leen datos de otros nodos con `$('Nombre del nodo')`. Las expresiones de nodos no-Code también usan `$('…')`.
- Un Code Node **nuevo** en `edit.json` (sin entrada en el manifest) se sube con el `jsCode` que tenga en el JSON; tras el push, `extract` le crea su `.js`.
- Un Code Node **eliminado** de `edit.json` que siga en el manifest hace fallar `inject` ("No se encontró el nodo ID…").
- Si un `.js` se guarda con saltos de línea **CRLF**, el marcador del header no coincide y el header **se sube a n8n** como parte del código. `.gitattributes` fuerza LF en Git, pero el editor debe guardar en LF.
- Si se borra el header manualmente y el código contiene una línea separadora seguida de línea vacía, `inject` recortaría código. No borrar el header.

### 5.5 Clasificación funcional de los Code Nodes

Clasificación **inferida por los nombres** de los nodos (no verificada recorriendo todas las conexiones). Los nombres de archivo actuales aparecen con caracteres corruptos (ver §8); aquí se muestran los nombres correctos de los nodos.

| Grupo | Code Nodes |
|---|---|
| Entrada WhatsApp / webhooks (6) | Validar verificación Meta · Normalizar evento WhatsApp · Preparar entrada WhatsApp · Normalizar mensaje · Preparar entrada no soportada · Preparar handoff entrada no soportada |
| Control del bot, modo prueba e intervención humana (5) | Procesar comando BOT · Resolver permiso automatización · Finalizar mensaje modo prueba · Normalizar intervención humana · Preparar mensaje humano saliente |
| Contacto, prospectos y conversación (8) | Resolver contacto · Preparar conversación · Resolver prospecto · Preparar prospecto creado · Resolver conversación prospecto · Preparar conversación creada · Preparar actualización prospecto · Resolver estado prospecto |
| Turno conversacional (2) | Resolver turno conversacional · Preparar media del turno |
| Imágenes (IA con cascada Groq → DeepSeek → OpenAI) (4) | Validar análisis imagen Groq · Validar análisis imagen DeepSeek · Analizar imagen OpenAI · Preparar derivación imagen fallida |
| Audio (Groq → fallback Deepgram) (5) | Preparar audio del turno · Validar transcripción audio · Preparar fallback Deepgram · Validar transcripción audio Deepgram · Aplicar transcripciones al turno |
| Cerebro comercial (IA) (12) | Preparar contexto IA · Validar extracción Cerebro comercial · Validar extracción DeepSeek1 · Validar extracción OpenApi1 · Error ninguna IA funciono cerebro · Normalizar decisión IA · Aplicar reglas comerciales determinísticas · Recuperar decisión comercial · Resolver contexto comercial · Construir mensaje comercial · Preparar respuesta comercial · Finalizar ciclo comercial |
| Cotización (19) | Validar extracción Groq · Validar extracción DeepSeek · Validar extracción OpenApi · Error ninguna IA funciono · Preparar datos cotización · EXPANDIR DETALLES · Resolver catálogo Pegaso · Validar producibilidad P4 · Construir mensaje no producible · Aplicar mínimo de impresión · Calcular precio detalle · Recuperar detalles calculados · Calcular resumen cotización · Resolver diseño · Preparar diseño creado · Preparar mensaje cotización · Preparar contexto post cotización · Resolver estado post cotización · Finalizar cotización comercial |
| Handoff humano (6) | Preparar derivación humana · Preparar contexto handoff · Preparar mensaje transición humano · Peparar notificacion humano · Finalizar derivación humana · Finalizar mensaje atención humana |
| Salida WhatsApp (1) | Preparar envío WhatsApp |
| Sin clasificar (1) | EXECUTOR MOMENTANEP |

Observaciones:

- Los tres "Validar extracción Groq / DeepSeek / OpenApi" (842 líneas cada uno) pertenecen al extractor de **cotización**; "Validar extracción Cerebro comercial / DeepSeek1 / OpenApi1" (1137 líneas cada uno) al **cerebro comercial**. Son copias de la misma lógica en nodos distintos: un cambio de regla debe replicarse en las tres.
- Lo mismo ocurre con los tres nodos de análisis de imagen (1219 líneas cada uno) y los dos de transcripción de audio (1034 líneas cada uno).
- `Peparar notificacion humano` tiene una errata en el nombre; renombrarlo es un cambio de alto riesgo (ver guía).

---

## 6. Scripts operativos

Todos los `.mjs` usan `process.cwd()` como raíz del repo. Los `.ps1` resuelven sus rutas con `$PSScriptRoot`, pero llaman a `node <script>` **sin cambiar de directorio**. **Todos los scripts deben ejecutarse desde la raíz del repositorio.**

Dependencias comunes: Node.js (inspeccionado: v22), `n8n-cli` instalado globalmente (npm) y configurado con acceso a la instancia de n8n. La configuración/API key de `n8n-cli` vive fuera del repo.

### 6.1 `scripts/pull.ps1`

| | |
|---|---|
| Propósito | Traer el workflow de producción al repo local |
| Inputs | Producción (vía `n8n-cli workflow list` y `workflow get`) |
| Outputs | `workflows/…pegaso.json`, `workflows/…edit.json`, `state/remote-base.json`, `code/_extraidos/*`, `snapshots/…-pre-pull-<fecha>.json` |
| ¿Modifica producción? | **No** |
| ¿Modifica archivos locales? | **Sí, sobrescribe** el workflow, el editable, el estado y todo `code/_extraidos/` |
| Dependencias | `n8n-cli`, Node, `extract-code.mjs` |
| Cuándo usarlo | Antes de empezar cualquier cambio; después de cualquier cambio hecho en la UI de n8n; cuando `push.ps1` cancela por cambio remoto |

Pasos reales:

1. `n8n-cli workflow list --format=json` y filtra por `name == "SISTEMA AUTOMATIZADO PEGASO"` **y** `active == true`. Si no hay exactamente 1 → cancela.
2. Si existe `workflows/…pegaso.json`, lo copia a `snapshots/sistema-automatizado-pegaso-pre-pull-<yyyyMMdd-HHmmss>.json` (snapshot del **archivo local anterior**, no de producción).
3. `n8n-cli workflow get <id> --format=json | Out-String` (a través del pipeline de PowerShell). Quita BOM.
4. Valida que sea JSON y que el `id` coincida.
5. Escribe `workflows/…pegaso.json` en UTF-8 sin BOM.
6. Copia ese archivo sobre `workflows/…edit.json`.
7. Escribe `state/remote-base.json` (`workflowId`, `workflowName`, `updatedAt`, `versionId`, `capturedAt`).
8. Ejecuta `node scripts/extract-code.mjs`.

Errores que detecta: workflow no encontrado o duplicado, respuesta vacía, JSON inválido, ID distinto, fallo de `extract`.

Lo que **no** hace: no comprueba si hay cambios locales sin subir (los pisa), no elimina `pinData`, no usa `download-workflow.mjs`, no ejecuta `check-encoding.mjs`. **Defecto conocido de encoding**: ver §8.

### 6.2 `scripts/push.ps1`

| | |
|---|---|
| Propósito | Subir los cambios locales a producción de forma controlada |
| Inputs | `state/remote-base.json`, `workflows/…edit.json`, `code/_extraidos/*`, producción |
| Outputs | Producción actualizada; `build/*.json`; `snapshots/…-pre-push-<fecha>.json`; `workflows/*.json`, `state/remote-base.json` y `code/_extraidos/*` regenerados |
| ¿Modifica producción? | **SÍ** |
| ¿Modifica archivos locales? | Sí (build, snapshots, workflows, state, code/_extraidos) |
| Dependencias | `n8n-cli`, Node, los 5 `.mjs` restantes (no usa `check-encoding.mjs`) |
| Cuándo usarlo | Solo después de `pull.ps1`, editar, revisar `git diff` y estar listo para afectar producción |

Pasos reales:

1. Verifica que existan `state/remote-base.json`, `edit.json` y los scripts.
2. Lee `workflowId` de `remote-base.json`.
3. `n8n-cli workflow get <id>` (vía PowerShell) para leer `updatedAt` y `versionId` actuales.
4. **Bloqueo por concurrencia**: si `updatedAt` o `versionId` remotos difieren de `remote-base.json` → imprime "PUSH CANCELADO" y sale con código 2. No toca nada.
5. `node scripts/inject-code.mjs` → `build/…build.json`.
6. `node scripts/validate-workflow.mjs`.
7. `node scripts/prepare-update.mjs` → `build/…update.json`.
8. Verifica que el payload tenga `name`, `nodes`, `connections`.
9. Guarda el JSON remoto leído en el paso 3 como `snapshots/…-pre-push-<fecha>.json`.
10. Muestra resumen (nodos, conexiones).
11. **`n8n-cli workflow update <id> --file=build/…update.json`** ← único paso que escribe en producción. Reemplaza `nodes`, `connections` y `settings` completos (no es un merge).
12. Espera 1 s.
13. `node scripts/download-workflow.mjs` (descarga vía Node, sin `pinData`).
14. Verifica que ID, cantidad de nodos y cantidad de orígenes con conexiones coincidan con el payload.
15. Copia `workflows/…pegaso.json` sobre `edit.json`.
16. Actualiza `state/remote-base.json` con el nuevo `updatedAt`/`versionId`.
17. `node scripts/extract-code.mjs`.
18. Imprime "PUSH COMPLETADO CORRECTAMENTE".

Errores que detecta: falta de archivos base, producción cambiada desde el último pull, fallos de inject/validate/prepare, payload incompleto, fallo del update, discrepancias post-push en ID/nodos/conexiones.

Lo que **no** hace: no busca secretos, no ejecuta `check-encoding.mjs`, no detecta mojibake, no hace `git commit` ni `git push`, no publica explícitamente una versión en n8n.

### 6.3 `scripts/download-workflow.mjs`

| | |
|---|---|
| Propósito | Descargar el workflow preservando UTF-8 |
| Inputs | Producción (`n8n-cli workflow get 09OF22FOxihypeeh`, ID **hardcodeado**) |
| Outputs | `workflows/sistema-automatizado-pegaso.json` (sin `pinData`, UTF-8 sin BOM, LF) |
| ¿Modifica producción? | No |
| ¿Modifica archivos locales? | Sí, sobrescribe `workflows/…pegaso.json` (no toca `edit.json`, `state` ni `code/`) |
| Dependencias | `n8n-cli` ejecutado mediante `cmd.exe /d /s /c`, Node |
| Cuándo usarlo | Lo invoca `push.ps1` (paso 13). Manualmente solo en procedimientos de recuperación (ver guía) |

Detecta: error al ejecutar `n8n-cli`, JSON inválido, ID distinto, ausencia de `nodes[]` o `connections`. Elimina `pinData` **solo** de la copia local (no de producción).

### 6.4 `scripts/extract-code.mjs`

| | |
|---|---|
| Propósito | Convertir los Code Nodes en archivos `.js` + manifest |
| Inputs | `workflows/sistema-automatizado-pegaso.json` |
| Outputs | `code/_extraidos/*.js`, `code/_extraidos/manifest.json` |
| ¿Modifica producción? | No |
| ¿Modifica archivos locales? | **Sí: borra y recrea `code/_extraidos/` completo** |
| Cuándo usarlo | Lo ejecutan `pull.ps1` y `push.ps1`. Ejecutarlo a mano descarta cualquier edición local no subida |

Detecta: archivo inexistente, JSON inválido, ausencia de `nodes`. Advierte si un Code Node no tiene `jsCode`.

### 6.5 `scripts/inject-code.mjs`

| | |
|---|---|
| Propósito | Reinsertar el código de los `.js` en el workflow editable |
| Inputs | `workflows/…edit.json`, `code/_extraidos/manifest.json`, `code/_extraidos/*.js` |
| Outputs | `build/sistema-automatizado-pegaso.build.json` |
| ¿Modifica producción? | No |
| ¿Modifica archivos locales? | Solo escribe en `build/` (no toca `edit.json`) |
| Cuándo usarlo | Lo ejecuta `push.ps1`. Se puede ejecutar a mano como parte de una verificación local (ver guía) |

Detecta: `edit.json` o manifest inexistentes, nodo del manifest no encontrado por ID, `.js` inexistente.

### 6.6 `scripts/validate-workflow.mjs`

| | |
|---|---|
| Propósito | Validación estructural del build |
| Inputs | `build/sistema-automatizado-pegaso.build.json` |
| Outputs | Solo consola (exit 1 si falla) |
| ¿Modifica algo? | No |

Detecta: JSON inválido; falta de `id`, `name`, `nodes[]` o `connections`; nodo sin `id`; **IDs duplicados**; nodo sin `name`; conexiones cuyo origen o destino no existe como nombre de nodo. Los **nombres duplicados** solo generan advertencia.

No detecta: referencias rotas en expresiones o código (`$('Nodo')`), errores de sintaxis JavaScript, parámetros inválidos, credenciales faltantes, secretos, mojibake.

### 6.7 `scripts/prepare-update.mjs`

| | |
|---|---|
| Propósito | Generar el payload que acepta la API pública de n8n |
| Inputs | `build/sistema-automatizado-pegaso.build.json` |
| Outputs | `build/sistema-automatizado-pegaso.update.json` |
| ¿Modifica producción? | No |
| ¿Modifica archivos locales? | Solo `build/` |

Payload: `name`, `nodes`, `connections`, `settings` (o `{}`), y opcionalmente `description` (solo si es string, porque n8n rechaza `description: null`), `staticData` (si existe), `pinData` (si existe) y `nodeGroups` (si es array). Excluye campos de solo lectura (`id`, `active`, `updatedAt`, `versionId`, `activeVersion`, etc.).

Detecta: `name` vacío, `nodes` no array, `connections` no objeto, `settings` inválido, `description` no string.

### 6.8 `scripts/check-encoding.mjs`

| | |
|---|---|
| Propósito | Detectar mojibake en el workflow descargado |
| Inputs | `workflows/sistema-automatizado-pegaso.json` |
| Outputs | Consola; exit 0 si OK, exit 2 si hay líneas sospechosas |
| ¿Modifica algo? | No |
| Cuándo usarlo | Manualmente después de un pull (no lo invoca ningún otro script) |

Busca `U+00C3` (`Ã`), `U+00C2` (`Â`) y `U+00E2` (`â`): el patrón de UTF-8 leído como Latin-1/Windows-1252. **No detecta** el patrón CP850 (caracteres de dibujo de cajas `U+2500–U+257F`, p. ej. `├│` en lugar de `ó`), que es justamente el que produce hoy `pull.ps1` (ver §8).

---

## 7. Control de concurrencia

`state/remote-base.json` guarda el último estado de producción que el repo local conoce:

```json
{
  "workflowId": "09OF22FOxihypeeh",
  "workflowName": "SISTEMA AUTOMATIZADO PEGASO",
  "updatedAt": "2026-10-13T16:28:08.664Z",
  "versionId": "3e62b91c-b61b-4a0e-a921-7897ed11c8d4",
  "capturedAt": "2026-10-13T16:39:00.1956740Z"
}
```

| Campo | Significado |
|---|---|
| `workflowId` | ID del workflow en n8n; `push.ps1` lo usa para leer y actualizar |
| `workflowName` | Nombre en el momento de la captura (informativo) |
| `updatedAt` | Fecha de última modificación en n8n cuando se hizo el pull/push |
| `versionId` | Identificador de la versión guardada en n8n |
| `capturedAt` | Cuándo se escribió este archivo localmente (UTC) |

Lo escriben `pull.ps1` (paso 7) y `push.ps1` (paso 16). **No se edita a mano.**

Protección: antes de escribir, `push.ps1` relee producción. Si `updatedAt` **o** `versionId` difieren de `remote-base.json`, alguien cambió producción después del último pull (desde la UI o desde otra copia del repo) y el push **se cancela** para no sobrescribir esos cambios. Editar `remote-base.json` para "forzar" el push anularía esa protección.

Limitación: existe una ventana corta entre la verificación (paso 3) y el update (paso 11) en la que un cambio remoto no sería detectado.

---

## 8. Encoding

### Decisión

Todos los archivos se escriben en **UTF-8 sin BOM**. `.gitattributes` define `* text=auto eol=lf`, así que Git almacena LF. Los scripts quitan un BOM inicial (`U+FEFF`) antes de `JSON.parse`, porque PowerShell puede añadirlo y `JSON.parse` no lo tolera.

### Problema de mojibake

El workflow contiene mucho texto en español (nombres de nodos con tildes, `¿`, mensajes a clientes dentro de los Code Nodes). Si la salida de `n8n-cli` (bytes UTF-8) se decodifica con otra página de códigos, cada carácter acentuado se convierte en dos caracteres basura (mojibake), por ejemplo `ó` → `├│` (CP850) o `ó` → `Ã³` (Windows-1252). Si ese texto se sube, la basura llega a producción: nombres de nodos y mensajes que ve el cliente.

### Por qué existe `download-workflow.mjs`

Ejecuta `n8n-cli` desde Node con `execFileSync(..., { encoding: 'utf8' })`, de modo que los bytes se interpretan como UTF-8 sin pasar por el pipeline de PowerShell. Por eso `push.ps1` lo usa para la descarga post-push ("para preservar UTF-8").

### Por qué no transportar el JSON por PowerShell

En PowerShell 5 (Windows), `n8n-cli … | Out-String` decodifica la salida con `[Console]::OutputEncoding`, que en esta máquina es **CP850** (`ibm850`). Además `Out-String` convierte los saltos a CRLF. Cada transformación innecesaria es un punto donde el texto se puede dañar sin error visible.

### Estado actual (defecto conocido, sin corregir)

`pull.ps1` sigue descargando por el pipeline de PowerShell. Evidencia inspeccionada:

| Archivo | Caracteres `U+2500–U+257F` | Acentos correctos | Origen |
|---|---|---|---|
| `workflows/sistema-automatizado-pegaso.json` (y `.edit.json`, idénticos) | 11 698 | 2 568 | `pull.ps1` |
| `snapshots/…-pre-pull-20261013-113857.json` (mismo `updatedAt`) | 0 | 8 042 | descarga vía Node |

- 89 nombres de nodos y 64 Code Nodes del workflow local tienen mojibake (`Calcular resumen cotizaci├│n`).
- Por eso los `.js` se llaman `calcular-resumen-cotizaci-n.js`, `aplicar-m-nimo-de-impresi-n.js`, etc. Con nombres correctos serían `calcular-resumen-cotizacion.js`, `aplicar-minimo-de-impresion.js`.
- El commit `645bbf5` (publicado en GitHub) contiene esa versión dañada.
- La última descarga hecha por Node (mismo `updatedAt`) no tiene mojibake, lo que indica que **producción está bien** y el daño es solo local.
- `check-encoding.mjs` devuelve OK porque no busca el patrón CP850.
- Los snapshots `pre-push` también se generan por PowerShell, así que tienen el mismo daño y **no sirven para restaurar** tal cual.

**Riesgo:** si se ejecuta `push.ps1` con los archivos actuales, se enviaría el texto dañado a producción (nombres de nodos y textos de los Code Nodes). La verificación post-push no lo detectaría porque solo compara cantidades.

Corrección recomendada (no aplicada en esta tarea): que `pull.ps1` use `download-workflow.mjs` para la descarga (o fije `[Console]::OutputEncoding = [System.Text.Encoding]::UTF8` antes de llamar a `n8n-cli`), y ampliar `check-encoding.mjs` para que detecte `U+2500–U+257F`. La guía describe un procedimiento temporal seguro.

---

## 9. Seguridad y secretos

Reglas:

- **Ninguna API key, token o contraseña se escribe en el workflow JSON**, ni en headers manuales, ni en Code Nodes, ni en docs, ni en commits.
- Los servicios externos se autentican con **Credentials de n8n**. El JSON exportado solo contiene la referencia (`credentials: { <tipo>: { id, name } }`), nunca el valor.
- Estado inspeccionado: los 9 HTTP Request (YCloud, Meta Graph, **Brevo**, **Resend**, Groq, Deepgram y descargas de media) usan `authentication: genericCredentialType` + `httpHeaderAuth`. Los nodos Postgres, OpenAI, Groq y DeepSeek usan sus credenciales nativas. Un escaneo de patrones de claves (Brevo, Resend, OpenAI, Groq, Meta, JWT, `Bearer <literal>`) sobre el workflow actual no encontró coincidencias.
- **`pinData`** puede contener datos reales de ejecuciones (payloads, teléfonos, emails, respuestas de APIs). `download-workflow.mjs` lo elimina de la copia local. `pull.ps1` **no** lo elimina (hoy el `pinData` local está vacío, `{}`), y `prepare-update.mjs` lo reenvía si está presente.
- **`snapshots/`** está en `.gitignore`: los snapshots son copias completas del workflow (incluido `pinData`) y no se versionan.
- **`build/`** está en `.gitignore`.
- La **API key de `n8n-cli`** pertenece a la configuración del CLI fuera del repo. Nunca se copia a scripts ni a archivos versionados.
- `.env`, `.env.*`, `*.secret` y `credentials/` están en `.gitignore`.
- El workflow contiene direcciones de correo en los cuerpos de los nodos Brevo/Resend. No son secretos, pero son datos personales versionados; valorar moverlas a variables de n8n.

### Lección del incidente de GitHub Push Protection

Al recargar la estructura del repo, el workflow descargado contenía las API keys de Brevo y Resend escritas directamente en los headers de dos nodos HTTP Request (y por tanto duplicadas en `nodes` y `activeVersion.nodes`, en el `.json` y en el `.edit.json`). GitHub Push Protection **bloqueó correctamente** el `git push`, así que las claves nunca llegaron al repositorio remoto.

Solución aplicada:

1. En n8n, se movieron ambas claves a **Credentials** (Header Auth) y se quitaron los headers manuales de los nodos.
2. Se guardó/publicó la nueva versión del workflow en n8n.
3. Se ejecutó `.\scripts\pull.ps1` para traer la versión sin secretos.
4. Se comprobó que las claves ya no aparecían en los archivos.
5. Se reescribió el commit pendiente (`git commit --amend`) sin secretos y se hizo `git push`.

Conclusión: Push Protection es una red de seguridad, no un proceso. Cualquier secreto que exista en n8n como texto plano terminará en el JSON en el siguiente pull.

---

## 10. Git

Se versiona:

- `workflows/sistema-automatizado-pegaso.json` y `.edit.json`
- `code/_extraidos/*.js` y `manifest.json`
- `state/remote-base.json`
- `scripts/*`
- `docs/*`, `README.md`, `.gitignore`, `.gitattributes`, `.cursor/rules/*`

No se versiona (`.gitignore`): `snapshots/`, `build/`, `.env`, `.env.*`, `*.secret`, `credentials/`, `node_modules/`, `*.tmp`, `*.bak`, `Thumbs.db`, `.DS_Store`.

### n8n y Git son sincronizaciones distintas

| Comando | Qué sincroniza |
|---|---|
| `.\scripts\pull.ps1` | n8n producción → archivos locales |
| `.\scripts\push.ps1` | archivos locales → **n8n producción** |
| `git pull` | GitHub → repositorio local |
| `git push origin main` | commits locales → **GitHub** |

- `push.ps1` **no** hace commit ni push a GitHub.
- `git push` **no** cambia nada en n8n.
- Después de un `push.ps1` exitoso, los archivos locales cambian (re-descarga y re-extracción); ese resultado es lo que se commitea.
- `git pull` puede traer un `edit.json`/`.js` distinto de producción; lo que manda en producción es siempre n8n. Si `git pull` trae cambios, compararlos con un `pull.ps1` antes de hacer `push.ps1`.

Configuración observada: `core.autocrlf=true` en la máquina y `.gitattributes` con `eol=lf`. Como `pull.ps1` escribe con CRLF, Git avisa "CRLF will be replaced by LF"; el contenido versionado queda en LF.

---

## 11. Estado actual

Estado comprobado el 13 oct 2026 (solo lectura y ejecución en copia temporal):

| Aspecto | Estado | Cómo se comprobó |
|---|---|---|
| Git `main` sincronizado con `origin/main` | Sí (`645bbf5`) | `git branch -vv`, `git status` |
| Secretos en el workflow versionado | No se encontraron | Escaneo de patrones sobre los archivos actuales |
| Brevo y Resend con Credentials | Sí (`httpHeaderAuth`) | Inspección de nodos HTTP Request |
| `remote-base.json` coherente con el workflow local | Sí (mismo `updatedAt`/`versionId`) | Comparación de archivos |
| `.json` y `.edit.json` idénticos | Sí | `git diff --no-index` |
| Extracción | 69/69 Code Nodes en el manifest | `manifest.json` |
| Inject + validate + prepare-update | OK; ida y vuelta sin diferencias (0 nodos distintos entre `edit.json` y `build.json`) | Ejecutados en una **copia temporal** del repo |
| Encoding de los archivos locales | **Dañado** (mojibake CP850) | Conteo de caracteres, ver §8 |
| Encoding en producción | Correcto según la última descarga vía Node | Snapshot `pre-pull-20261013-113857` |
| `pull.ps1` | Funciona, pero introduce mojibake | Inspección del código y de los archivos generados |
| `push.ps1` | No ejecutado en esta revisión. **No usar** hasta corregir el encoding local | — |
| Publicación en n8n | `versionId == activeVersionId` | Workflow JSON |

### Inconsistencias encontradas

1. **Mojibake** en workflow, editable, `.js`, manifest y commit `645bbf5` (§8).
2. `check-encoding.mjs` no detecta el patrón CP850 y no lo ejecuta ningún script.
3. `pull.ps1` no usa `download-workflow.mjs` ni elimina `pinData`; `download-workflow.mjs` sí lo hace. Los dos caminos de descarga producen archivos distintos (encoding, `pinData`, saltos de línea).
4. `download-workflow.mjs` tiene el Workflow ID hardcodeado; `pull.ps1` lo busca por nombre y estado activo.
5. `pull.ps1` y `extract-code.mjs` sobrescriben ediciones locales sin avisar.
6. Snapshots `pre-push` generados por PowerShell (dañados) y sin política de limpieza (~2,2 MB cada uno).
7. `README.md` (secciones Estructura, Encabezado, Flujo de trabajo, Reglas) y `.cursor/rules/pegaso-n8n.mdc` describen una estructura anterior que ya no existe (`npm run build/extract`, `npm test`, `code/01-entrada/…`, `prompts/`, `schemas/`, `tests/`, `docs/etapas/`, `pegaso-whatsapp.map.json`, encabezado `NODO N8N/VERSION/RESPONSABILIDAD`).
8. Cuatro nodos aislados: `Webhook Post`, `Respond to Webhook Post`, `Enviar WhatsApp Cloud API1`, `Execute a SQL query`. Otros posibles problemas del flujo (ramas sin conectar, condiciones dudosas) están en [FLUJO-WORKFLOW-PEGASO.md §18](FLUJO-WORKFLOW-PEGASO.md#18-observaciones-y-posibles-problemas).
9. Lógica duplicada en varios Code Nodes por proveedor de IA (§5.5).
