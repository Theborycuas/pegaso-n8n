# Guía de uso de `pegaso-n8n` (runbook)

Qué hacer, en qué orden, para cambiar el workflow **SISTEMA AUTOMATIZADO PEGASO** sin dañar producción. El detalle técnico de cada script está en [ARQUITECTURA-PEGASO-N8N.md](ARQUITECTURA-PEGASO-N8N.md); qué hace cada nodo y cómo se conectan, en [FLUJO-WORKFLOW-PEGASO.md](FLUJO-WORKFLOW-PEGASO.md).

**Todos los comandos se ejecutan en PowerShell desde la raíz del repositorio** (`pegaso-n8n/`). Los scripts usan el directorio actual como raíz.

> ⚠️ **Aviso vigente (13 oct 2026): encoding.** Hoy `pull.ps1` guarda los archivos con caracteres dañados (`ó` → `├│`). Producción está bien; el daño es local. **No ejecutes `push.ps1` sobre archivos con mojibake.** Mientras `pull.ps1` no se corrija, usa el [procedimiento temporal](#0-procedimiento-temporal-de-encoding) después de cada pull.

---

## 0. Procedimiento temporal de encoding

Usa este procedimiento después de **cada** `.\scripts\pull.ps1` hasta que el script se corrija. Solo escribe archivos locales.

```powershell
.\scripts\pull.ps1
node scripts/download-workflow.mjs
Copy-Item workflows\sistema-automatizado-pegaso.json workflows\sistema-automatizado-pegaso.edit.json -Force
node scripts/extract-code.mjs
```

Comprobación (debe decir `OK`):

```powershell
node -e "const t=require('fs').readFileSync('workflows/sistema-automatizado-pegaso.edit.json','utf8');const n=(t.match(/[\u2500-\u257F]/g)||[]).length;console.log(n===0?'OK: sin mojibake CP850':'MOJIBAKE: '+n+' caracteres sospechosos')"
node scripts/check-encoding.mjs
```

La primera vez, `git status` mostrará muchos `.js` renombrados (por ejemplo `aplicar-m-nimo-de-impresi-n.js` → `aplicar-minimo-de-impresion.js`). Es lo esperado: son los nombres correctos. Commitea esa corrección sola, sin mezclarla con otros cambios.

---

## 1. Flujo diario normal

1. **Partir de un árbol limpio.** `pull.ps1` sobrescribe el workflow, el editable y `code/_extraidos/` sin preguntar.
   ```powershell
   git status
   ```
   Si hay cambios sin commitear, commitéalos o guárdalos antes de seguir.
2. **Traer producción:**
   ```powershell
   .\scripts\pull.ps1
   ```
   Busca el workflow activo llamado `SISTEMA AUTOMATIZADO PEGASO`, guarda un snapshot del archivo local anterior en `snapshots/`, descarga el JSON, lo copia al editable, actualiza `state/remote-base.json` y re-extrae los Code Nodes. **No modifica producción.**
   (Mientras siga vigente el aviso: aplica el [procedimiento temporal](#0-procedimiento-temporal-de-encoding).)
3. **Revisar si producción traía cambios** que no estaban en Git: `git status` / `git diff`. Si los hay, commitéalos primero ("sync desde n8n") para separarlos de tu cambio.
4. **Editar** (`code/_extraidos/*.js` o `workflows/…edit.json`).
5. **Revisar el diff:**
   ```powershell
   git diff
   ```
6. **Verificar en local (opcional, recomendado):** solo escribe en `build/`.
   ```powershell
   node scripts/inject-code.mjs
   node scripts/validate-workflow.mjs
   node scripts/prepare-update.mjs
   ```
7. **Subir a n8n:**
   ```powershell
   .\scripts\push.ps1
   ```
8. **Validar en n8n:** abrir el workflow en la UI, comprobar el nodo cambiado, que los nombres se ven bien (con tildes) y que la versión publicada es la nueva (ver §10).
9. **Probar funcionalmente** (mensaje de prueba por WhatsApp o ejecución con datos de prueba).
10. **Commit y push a GitHub:**
    ```powershell
    git status
    git add -A
    git commit -m "Descripción del cambio"
    git push origin main
    ```

---

## 2. Diferencia entre n8n y Git

| Acción | Comando | Origen → Destino |
|---|---|---|
| PULL n8n | `.\scripts\pull.ps1` | n8n producción → archivos locales |
| PUSH n8n | `.\scripts\push.ps1` | archivos locales → **n8n producción** |
| PULL Git | `git pull` | GitHub → repo local |
| PUSH Git | `git push` | repo local → **GitHub** |

Son procesos **diferentes e independientes**:

- `push.ps1` cambia producción pero **no** sube nada a GitHub.
- `git push` sube commits a GitHub pero **no** cambia nada en n8n.
- Un cambio está completo cuando pasó por los dos: `push.ps1` (producción) y `git push` (historial).

---

## 3. Modificar un Code Node existente

Ejemplo: *"Actualizar el prompt del Cerebro Comercial"*.

1. `.\scripts\pull.ps1` (+ procedimiento temporal si aplica).
2. Buscar el nodo: abrir `code/_extraidos/manifest.json` y localizar el `nodeName` → `relativeFile`. O buscar texto en `code/_extraidos/`. El contexto que recibe el cerebro comercial se arma en `Preparar contexto IA` (`code/_extraidos/preparar-contexto-ia.js`). Si el texto está en el parámetro de un nodo IA (`informationExtractor`, `chainLlm`), no es un Code Node: ver §4.
3. Editar el `.js`, **debajo del header**. No borrar ni modificar el header. Guardar con saltos de línea **LF**.
4. Si la misma lógica existe en nodos gemelos (por ejemplo `Validar extracción Cerebro comercial` / `DeepSeek1` / `OpenApi1`), aplicar el cambio en todos.
5. `git diff`.
6. `.\scripts\push.ps1`.
7. Comprobar el nodo en n8n.
8. Probar funcionalmente.
9. `git add -A` + `git commit`.
10. `git push origin main`.

No edites `parameters.jsCode` dentro de `workflows/…edit.json` para un nodo que tiene `.js` en el manifest: `inject-code.mjs` lo reemplaza por el contenido del `.js` y tu edición se pierde. Hazlo solo si hay una razón técnica explícita (por ejemplo, un Code Node nuevo que todavía no está en el manifest).

---

## 4. Modificar un nodo no-Code

Ejemplos: HTTP Request (URL, headers, body), Postgres (SQL), IF / Switch (condiciones), Edit Fields (Set), expresiones `={{ … }}`, prompts de nodos IA.

Estos cambios se hacen en **`workflows/sistema-automatizado-pegaso.edit.json`**, en `nodes[i].parameters` del nodo correspondiente. Busca el nodo por `name` o `id`.

Cuidado estructural:

- Cambia solo `parameters`. No toques `id`, `name`, `type`, `typeVersion` ni `credentials` salvo que sea el objetivo.
- Los valores que empiezan por `=` son expresiones de n8n; conserva el `=`.
- El JSON es enorme: edita con búsqueda exacta y revisa `git diff` línea por línea.
- **No edites `activeVersion`.** Es la copia de la versión publicada; no se envía en el push.
- Ejecuta la verificación local (§1, paso 6) antes de `push.ps1`.

Alternativa más segura para cambios grandes: hacerlos en la UI de n8n, guardar/publicar y luego `.\scripts\pull.ps1` (ver §10).

---

## 5. Crear un nodo

En `workflows/…edit.json`, añadir un objeto a `nodes[]` con:

| Campo | Requisito |
|---|---|
| `id` | UUID **único** (no copiar el de otro nodo) |
| `name` | **Único** en todo el workflow |
| `type` | Tipo exacto, p. ej. `n8n-nodes-base.code`, `n8n-nodes-base.postgres` |
| `typeVersion` | La misma versión que usan nodos del mismo tipo en el workflow |
| `parameters` | Parámetros del nodo |
| `position` | `[x, y]` |
| `credentials` | Solo si el nodo las necesita, referenciando una credencial **existente** en n8n (`id` + `name`) |

Y añadir sus conexiones en `connections`:

```json
"Nodo origen": {
  "main": [
    [ { "node": "Nodo nuevo", "type": "main", "index": 0 } ]
  ]
},
"Nodo nuevo": {
  "main": [
    [ { "node": "Nodo destino", "type": "main", "index": 0 } ]
  ]
}
```

- Las claves y los destinos de `connections` son **nombres** de nodo.
- En nodos IF, `main[0]` es la salida *true* y `main[1]` la *false*.

Luego: verificación local (inject, validate, prepare-update) → `push.ps1`. Si es un Code Node, se sube con el `jsCode` escrito en el JSON y el push le genera su `.js` en `code/_extraidos/`.

Copiar un nodo existente como plantilla es práctico, pero **cambia siempre `id` y `name`**.

---

## 6. Eliminar un nodo

No basta con borrarlo de `nodes[]`. Antes de borrar:

1. **Conexiones entrantes:** buscar `"node": "Nombre exacto"` en `connections` y quitar esas entradas.
2. **Conexiones salientes:** quitar la clave `"Nombre exacto": { … }` de `connections`.
3. **Referencias por nombre** en todo el repo:
   ```powershell
   git grep -n "Nombre exacto" -- code workflows/sistema-automatizado-pegaso.edit.json
   ```
   Revisar especialmente `$('Nombre exacto')` y `$node["Nombre exacto"]` en Code Nodes y expresiones.
4. Reconectar los nodos anterior y siguiente si el flujo debe continuar.
5. Si es un **Code Node**, quitar también su entrada de `code/_extraidos/manifest.json` y su `.js`. Si no, `inject-code.mjs` falla con "No se encontró el nodo ID…". Es el único caso en el que se edita el manifest a mano; el siguiente push/pull lo regenera.
6. Verificación local → `push.ps1`.

`validate-workflow.mjs` detecta conexiones a nodos inexistentes, pero **no** detecta `$('Nodo')` rotos dentro del código. Esos fallan en ejecución.

---

## 7. Renombrar un nodo — ⚠️ ALTO RIESGO

El nombre es la clave de `connections` y lo usan 43 de los 69 Code Nodes vía `$('…')`, además de expresiones en nodos no-Code.

Antes de renombrar:

1. Búsqueda global del nombre exacto:
   ```powershell
   git grep -n "Nombre actual" -- code workflows/sistema-automatizado-pegaso.edit.json
   ```
2. Actualizar en `edit.json`: `nodes[].name`, la clave en `connections` y todos los `"node": "Nombre actual"`.
3. Actualizar expresiones `$('Nombre actual')` / `$node["Nombre actual"]` en parámetros de nodos.
4. Actualizar los `.js` de `code/_extraidos/` que lo referencian.
5. Verificación local → `push.ps1`.

Tras el push, `extract` genera el `.js` con el nuevo nombre de archivo (Git lo verá como renombrado). Si es posible, renombra desde la UI de n8n (que actualiza las referencias de expresiones) y luego haz `pull.ps1`, revisando igualmente los Code Nodes.

---

## 8. Cambiar el ID de un nodo — ⛔ NO HACER

Salvo necesidad técnica excepcional y explícita.

- **Manifest:** `inject-code.mjs` busca los nodos por `nodeId`. Un ID cambiado hace fallar el push o inyecta código en el nodo equivocado.
- **Trazabilidad:** el ID es lo que identifica al nodo entre versiones, diffs y snapshots.
- **Sincronización:** n8n trata un ID nuevo como un nodo distinto.
- **Referencias internas:** n8n y sus registros de ejecución usan el ID.

Si dos nodos tienen el mismo ID, `validate-workflow.mjs` falla. Corrige el duplicado nuevo, nunca el original.

---

## 9. Credenciales

**Regla absoluta:** NUNCA poner API keys, tokens ni contraseñas en:

- headers manuales de nodos HTTP Request
- Code Nodes
- el workflow JSON (`.json`, `.edit.json`)
- README o `docs/`
- mensajes de commit o commits

Usar **Credentials de n8n**. Ejemplo conceptual para un HTTP Request (así están hoy Brevo, Resend, YCloud, Groq y Deepgram):

```
Authentication:       Generic Credential Type
Generic Auth Type:    Header Auth
Credential:           <credencial creada en n8n>
                        Name:  api-key            (o Authorization)
                        Value: ********           (se guarda solo en n8n)
```

En el JSON solo queda una referencia:

```json
"credentials": {
  "httpHeaderAuth": { "id": "<id de la credencial>", "name": "<nombre>" }
}
```

Las credenciales se crean y modifican **solo en la UI de n8n**. No cambies `credentials` en `edit.json` salvo para asignar una credencial ya existente.

---

## 10. Publish en n8n

El workflow descargado tiene `versionId` (última versión guardada) y `activeVersionId` + `activeVersion` (versión publicada, la que se ejecuta). Si cambias el workflow desde la UI y la instalación usa versiones publicadas, **guardar no basta**: hay que **publicar** para que `activeVersion` refleje el cambio.

Comprobación tras un cambio:

```powershell
node -e "const w=JSON.parse(require('fs').readFileSync('workflows/sistema-automatizado-pegaso.json','utf8'));console.log(w.versionId===w.activeVersionId?'Publicado: la ultima version es la activa':'ATENCION: hay cambios guardados sin publicar')"
```

Después de **cualquier** cambio manual en n8n:

```powershell
.\scripts\pull.ps1
```

antes de seguir trabajando en local. Si no lo haces, `push.ps1` cancelará (porque producción cambió) o, peor, trabajarás sobre una base vieja.

Después de un `push.ps1`, verifica en la UI que la versión publicada es la nueva. El script no publica explícitamente.

---

## 11. Si `push.ps1` cancela

Mensaje "PUSH CANCELADO – Produccion cambio desde el ultimo PULL": el `updatedAt` o el `versionId` remotos no coinciden con `state/remote-base.json`.

**No forzar.** No edites `remote-base.json` para saltarte la comprobación.

1. Guardar tus cambios: `git add -A` + `git commit -m "WIP: cambio local"` (o anota/copia lo que cambiaste).
2. `.\scripts\pull.ps1` (+ procedimiento temporal). Esto sobrescribe tus archivos con producción.
3. Revisar diferencias: `git diff HEAD~1 --stat` y `git diff` para ver qué cambió en producción frente a tu commit.
4. Reaplicar tus cambios sobre la versión nueva (a mano o con `git checkout HEAD~1 -- <archivo>` **solo** si el archivo no cambió en producción).
5. Verificación local (inject, validate, prepare-update).
6. `.\scripts\push.ps1`.

---

## 12. Si GitHub bloquea un push

Mensaje `GH013: Repository rule violations` / `Push cannot contain secrets`.

- **No uses el enlace "allow secret"** como solución normal: el secreto quedaría publicado en el historial.
- Procedimiento:
  1. Leer el mensaje de GitHub: indica commit, archivo y línea de cada secreto.
  2. Identificar el nodo en esa línea del workflow.
  3. En la UI de n8n, mover el valor a **Credentials** (§9) y quitar el header/valor manual.
  4. Guardar y **publicar** en n8n (§10).
  5. `.\scripts\pull.ps1` (+ procedimiento temporal).
  6. Comprobar que el secreto ya no existe (usa un fragmento corto del inicio del valor, no la clave completa):
     ```powershell
     git grep -n "<prefijo del secreto>"
     ```
  7. Si el secreto solo está en el último commit sin publicar: `git add -A` + `git commit --amend --no-edit`. Si está en varios commits sin publicar, pide ayuda antes de reescribir historial.
  8. `git push origin main`.
- Si el secreto **llegó a publicarse** en algún momento, además hay que **rotarlo** en el proveedor.

---

## 13. Archivos que NO deben editarse manualmente

| Archivo | ¿Editar manualmente? | Motivo |
|---|---|---|
| `workflows/sistema-automatizado-pegaso.json` | **No** | Copia de producción. Lo sobrescriben `pull.ps1` y `push.ps1`. Es la fuente de `extract-code.mjs` |
| `workflows/sistema-automatizado-pegaso.edit.json` | **Sí, con cuidado** | Fuente de los cambios estructurales y no-Code. Se sobrescribe en cada pull/push: sube o commitea antes |
| `build/*.json` | **No** | Derivados de `inject-code.mjs` / `prepare-update.mjs` en cada push. Ignorados por Git |
| `code/_extraidos/*.js` | **Sí** (código debajo del header) | Fuente del código de los Code Nodes. No tocar el header. Se regeneran en cada pull/push |
| `code/_extraidos/manifest.json` | **No** (salvo al eliminar un Code Node, §6) | Generado por `extract-code.mjs`. Relaciona archivo ↔ nodeId ↔ nombre |
| `state/remote-base.json` | **No** | Control de concurrencia. Editarlo anula la protección contra sobrescribir producción |
| `snapshots/*` | **No** | Respaldos automáticos. No versionados. Úsalos solo para consultar o recuperar |
| `scripts/*` | **No en el trabajo diario** | Herramientas operativas. Cambiarlas es una tarea propia, revisada y probada aparte |
| `.gitignore` | **Solo con revisión** | Protege snapshots, build y secretos. No quitar esas entradas |

---

## 14. Checklist antes de push a n8n

- [ ] El árbol estaba limpio antes del pull (`git status`)
- [ ] Hice `.\scripts\pull.ps1` (y el procedimiento temporal de encoding)
- [ ] La comprobación de mojibake dice `OK`
- [ ] Revisé `git diff`
- [ ] No cambié IDs accidentalmente
- [ ] No renombré nodos sin revisar referencias (`connections`, `$('…')`, `$node[…]`)
- [ ] No añadí secretos
- [ ] `inject-code`, `validate-workflow` y `prepare-update` pasan
- [ ] Producción no cambió desde el pull (lo verifica `push.ps1`; si cancela, ver §11)
- [ ] Existe el snapshot pre-push en `snapshots/` (lo crea `push.ps1`)
- [ ] `push.ps1` terminó con "PUSH COMPLETADO CORRECTAMENTE"
- [ ] Verifiqué en la UI de n8n (nodo, tildes, versión publicada)
- [ ] Probé funcionalmente

## 15. Checklist antes de GitHub

- [ ] `git status` revisado
- [ ] No hay secretos (`git diff --cached` revisado)
- [ ] No hay snapshots en el commit
- [ ] No hay `.env`
- [ ] No hay API keys
- [ ] No hay mojibake en los archivos del commit
- [ ] Commit revisado (`git show --stat`)
- [ ] `git push origin main`

---

## 16. Comandos rápidos

```powershell
# Sincronizar desde n8n (no modifica producción)
.\scripts\pull.ps1

# Verificación local (solo escribe en build/)
node scripts/inject-code.mjs
node scripts/validate-workflow.mjs
node scripts/prepare-update.mjs

# Revisar encoding
node scripts/check-encoding.mjs

# Subir a n8n (MODIFICA PRODUCCIÓN)
.\scripts\push.ps1

# Estado Git
git status

# Ver cambios
git diff

# Commit
git add -A
git commit -m "..."

# Subir a GitHub
git push origin main
```
