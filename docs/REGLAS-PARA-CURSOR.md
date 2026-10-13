# Reglas para Cursor / agentes de IA en `pegaso-n8n`

Este repositorio controla el workflow de **producción** del bot comercial de WhatsApp de Pegaso. Un error puede afectar a clientes reales. Estas reglas son obligatorias para cualquier agente que trabaje aquí.

## Antes de actuar

1. Leer [ARQUITECTURA-PEGASO-N8N.md](ARQUITECTURA-PEGASO-N8N.md) y [GUIA-USO-PEGASO-N8N.md](GUIA-USO-PEGASO-N8N.md). Para ubicar un nodo, sus entradas, salidas y quién lo referencia, usar [FLUJO-WORKFLOW-PEGASO.md](FLUJO-WORKFLOW-PEGASO.md).
2. Al crear, renombrar, conectar, desconectar o eliminar un nodo, actualizar también `FLUJO-WORKFLOW-PEGASO.md` (ficha, diagrama y puntos finales).
3. Inspeccionar los archivos reales antes de asumir nada: `manifest.json`, el nodo en `edit.json`, el `.js` correspondiente. No confiar en documentación o estructuras antiguas (`npm run`, `code/01-entrada/`, `docs/etapas/`, `pegaso-whatsapp.map.json` ya no existen).
4. Ejecutar `git status` y verificar el encoding (procedimiento de la guía, §0) antes de editar.

## Producción y Git

- **No ejecutar `.\scripts\push.ps1`** sin autorización explícita del usuario en ese momento.
- **No ejecutar `n8n-cli workflow update`** (ni ningún comando que escriba en n8n) directamente.
- **No ejecutar `git push`** sin autorización explícita.
- **No modificar producción** sin autorización.
- No usar `git push --force`, `git reset --hard` ni reescribir historial publicado.
- `pull.ps1` y `extract-code.mjs` sobrescriben archivos locales: no ejecutarlos con cambios sin commitear sin avisar al usuario.
- **Si producción cambió** (`push.ps1` cancela, o `updatedAt`/`versionId` no coinciden), no sobrescribirla: detenerse e informar.

## Nodos

- **No cambiar node IDs** sin permiso explícito.
- **No renombrar nodos** sin un análisis completo de referencias: `connections` (claves y destinos), `$('Nombre')` y `$node["Nombre"]` en Code Nodes y expresiones.
- **No eliminar nodos** sin limpiar sus conexiones entrantes y salientes y sus referencias. Si es un Code Node, quitar también su entrada del manifest.
- **No editar `activeVersion`** dentro del workflow JSON.
- Si una tarea afecta a un Code Node, **editar su archivo en `code/_extraidos/`**, debajo del header, sin modificar el header y con saltos LF. No editar su `jsCode` dentro de `edit.json`.
- Si se requieren cambios estructurales, modificar `workflows/sistema-automatizado-pegaso.edit.json` con **extrema precaución** y cambios mínimos.
- Si la lógica está duplicada en nodos gemelos (variantes por proveedor de IA), avisar y aplicar el cambio de forma coherente.

## Secretos y credenciales

- **No insertar secretos** (API keys, tokens, contraseñas) en ningún archivo, commit ni mensaje.
- **No colocar API keys en JSON**, headers manuales ni Code Nodes.
- **No tocar `credentials`** de los nodos salvo para asignar una credencial ya existente, y solo si se pide.
- Si se detecta un secreto en el repo, detenerse e informar sin repetir su valor.

## Archivos protegidos

- **No modificar `state/remote-base.json`** manualmente.
- **No modificar `snapshots/`.**
- No editar `workflows/sistema-automatizado-pegaso.json` ni `build/*`.
- No modificar `scripts/` salvo que la tarea sea explícitamente sobre los scripts.

## Forma de trabajar

- **Preferir cambios mínimos.**
- **No refactorizar** subsistemas no relacionados con la tarea.
- **Preservar la lógica que funciona.**
- **Revisar `git diff`** antes de dar un cambio por terminado.
- **Ejecutar los validadores** antes de proponer un push (solo escriben en `build/`):
  ```powershell
  node scripts/inject-code.mjs
  node scripts/validate-workflow.mjs
  node scripts/prepare-update.mjs
  node scripts/check-encoding.mjs
  ```
- **Detenerse si se detectan inconsistencias** (mojibake, IDs duplicados, manifest desalineado, producción cambiada, secretos) e informar al usuario en lugar de improvisar una solución.
- Al terminar, indicar al usuario qué archivos cambiaron y qué pasos le quedan (`push.ps1`, prueba funcional, `git commit`, `git push`).
