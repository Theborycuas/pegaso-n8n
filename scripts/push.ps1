# ======================================================
# PEGASO N8N - PUSH SEGURO
# ======================================================
#
# RESPONSABILIDAD:
# - Verificar que produccion no cambio desde el ultimo pull.
# - Inyectar Code Nodes locales.
# - Validar estructura.
# - Preparar payload compatible con API.
# - Crear snapshot remoto pre-push.
# - Actualizar workflow en n8n.
# - Descargar nuevamente mediante Node para preservar UTF-8.
# - Verificar resultado remoto.
# - Actualizar base local y remote-base.json.
# - Re-extraer Code Nodes.
#
# IMPORTANTE:
# - Este script SI modifica produccion.
# - Si detecta cambios remotos posteriores al ultimo pull,
#   cancela el push.
# ======================================================

$ErrorActionPreference = "Stop"

# ======================================================
# CONFIGURACION
# ======================================================

$ROOT = Split-Path -Parent $PSScriptRoot

$STATE_FILE = Join-Path `
    $ROOT `
    "state\remote-base.json"

$BUILD_FILE = Join-Path `
    $ROOT `
    "build\sistema-automatizado-pegaso.build.json"

$UPDATE_FILE = Join-Path `
    $ROOT `
    "build\sistema-automatizado-pegaso.update.json"

$WORKFLOW_FILE = Join-Path `
    $ROOT `
    "workflows\sistema-automatizado-pegaso.json"

$EDIT_FILE = Join-Path `
    $ROOT `
    "workflows\sistema-automatizado-pegaso.edit.json"

$SNAPSHOT_DIR = Join-Path `
    $ROOT `
    "snapshots"

$INJECT_SCRIPT = Join-Path `
    $ROOT `
    "scripts\inject-code.mjs"

$VALIDATE_SCRIPT = Join-Path `
    $ROOT `
    "scripts\validate-workflow.mjs"

$PREPARE_UPDATE_SCRIPT = Join-Path `
    $ROOT `
    "scripts\prepare-update.mjs"

$DOWNLOAD_SCRIPT = Join-Path `
    $ROOT `
    "scripts\download-workflow.mjs"

$EXTRACT_SCRIPT = Join-Path `
    $ROOT `
    "scripts\extract-code.mjs"

# Ecuador (America/Guayaquil) no usa horario de verano: UTC-5.
function Format-HoraEcuador {
    param(
        [string]$Iso
    )

    if ([string]::IsNullOrWhiteSpace($Iso)) {
        return $Iso
    }

    try {
        $utc = [datetimeoffset]::Parse($Iso).ToUniversalTime()
        $ecuador = $utc.ToOffset([timespan]::FromHours(-5))
        return $ecuador.ToString("yyyy-MM-dd HH:mm:ss") + " (Ecuador)"
    }
    catch {
        return $Iso
    }
}

# ======================================================
# CABECERA
# ======================================================

Write-Host ""
Write-Host "=============================================="
Write-Host " PEGASO N8N - PUSH SEGURO"
Write-Host "=============================================="
Write-Host ""

# ======================================================
# 1. VALIDAR ARCHIVOS BASE
# ======================================================

if (-not (Test-Path $STATE_FILE)) {
    throw "ERROR: No existe state\remote-base.json. Ejecuta pull primero."
}

if (-not (Test-Path $EDIT_FILE)) {
    throw "ERROR: No existe workflow editable."
}

if (-not (Test-Path $INJECT_SCRIPT)) {
    throw "ERROR: No existe scripts\inject-code.mjs"
}

if (-not (Test-Path $VALIDATE_SCRIPT)) {
    throw "ERROR: No existe scripts\validate-workflow.mjs"
}

if (-not (Test-Path $PREPARE_UPDATE_SCRIPT)) {
    throw "ERROR: No existe scripts\prepare-update.mjs"
}

if (-not (Test-Path $DOWNLOAD_SCRIPT)) {
    throw "ERROR: No existe scripts\download-workflow.mjs"
}

if (-not (Test-Path $EXTRACT_SCRIPT)) {
    throw "ERROR: No existe scripts\extract-code.mjs"
}

# ======================================================
# 2. LEER ESTADO BASE
# ======================================================

$state = Get-Content `
    $STATE_FILE `
    -Raw |
    ConvertFrom-Json

$WORKFLOW_ID = $state.workflowId

if ([string]::IsNullOrWhiteSpace($WORKFLOW_ID)) {
    throw "ERROR: remote-base.json no contiene workflowId."
}

Write-Host "Workflow:"
Write-Host "  ID: $WORKFLOW_ID"
Write-Host "  Nombre: $($state.workflowName)"
Write-Host ""

# ======================================================
# 3. CONSULTAR PRODUCCION ACTUAL
# ======================================================

Write-Host "Verificando estado actual de produccion..."
Write-Host ""

$remoteJson = `
    n8n-cli workflow get `
        $WORKFLOW_ID `
        --format=json |
    Out-String

$remoteJson = $remoteJson.TrimStart([char]0xFEFF)

try {
    $remote = $remoteJson | ConvertFrom-Json
}
catch {
    throw "ERROR: No se pudo interpretar el workflow remoto."
}

Write-Host "  updatedAt local:  $(Format-HoraEcuador $state.updatedAt)"
Write-Host "  updatedAt remoto: $(Format-HoraEcuador $remote.updatedAt)"
Write-Host "  versionId local:  $($state.versionId)"
Write-Host "  versionId remoto: $($remote.versionId)"
Write-Host ""

# ======================================================
# 4. BLOQUEO POR CAMBIO REMOTO
# ======================================================

if (
    $remote.updatedAt -ne $state.updatedAt -or
    $remote.versionId -ne $state.versionId
) {

    Write-Host ""
    Write-Host "=============================================="
    Write-Host " PUSH CANCELADO"
    Write-Host "=============================================="
    Write-Host ""
    Write-Host "Produccion cambio desde el ultimo PULL."
    Write-Host ""
    Write-Host "No se sobrescribira ningun cambio remoto."
    Write-Host ""
    Write-Host "Ejecuta primero:"
    Write-Host ""
    Write-Host "  .\scripts\pull.ps1"
    Write-Host ""
    Write-Host "Luego revisa o reaplica tus cambios locales."
    Write-Host ""

    exit 2
}

Write-Host "Produccion coincide con la base local."
Write-Host ""

# ======================================================
# 5. INYECTAR CODE NODES
# ======================================================

Write-Host "Inyectando Code Nodes..."
Write-Host ""

node $INJECT_SCRIPT

if ($LASTEXITCODE -ne 0) {
    throw "ERROR: inject-code.mjs fallo."
}

# ======================================================
# 6. VALIDAR WORKFLOW
# ======================================================

Write-Host ""
Write-Host "Validando workflow..."
Write-Host ""

node $VALIDATE_SCRIPT

if ($LASTEXITCODE -ne 0) {
    throw "ERROR: validate-workflow.mjs fallo."
}

# ======================================================
# 7. PREPARAR PAYLOAD
# ======================================================

Write-Host ""
Write-Host "Preparando payload..."
Write-Host ""

node $PREPARE_UPDATE_SCRIPT

if ($LASTEXITCODE -ne 0) {
    throw "ERROR: prepare-update.mjs fallo."
}

if (-not (Test-Path $UPDATE_FILE)) {
    throw "ERROR: No se genero el archivo update."
}

# ======================================================
# 8. LEER PAYLOAD
# ======================================================

$updatePayload = Get-Content `
    $UPDATE_FILE `
    -Raw |
    ConvertFrom-Json

if (-not $updatePayload.name) {
    throw "ERROR: Payload sin name."
}

if (-not $updatePayload.nodes) {
    throw "ERROR: Payload sin nodes."
}

if (-not $updatePayload.connections) {
    throw "ERROR: Payload sin connections."
}

# ======================================================
# 9. SNAPSHOT REMOTO PRE-PUSH
# ======================================================

if (-not (Test-Path $SNAPSHOT_DIR)) {
    New-Item `
        -ItemType Directory `
        -Path $SNAPSHOT_DIR |
        Out-Null
}

$stamp = Get-Date -Format "yyyyMMdd-HHmmss"

$prePushSnapshot = Join-Path `
    $SNAPSHOT_DIR `
    "sistema-automatizado-pegaso-pre-push-$stamp.json"

[System.IO.File]::WriteAllText(
    $prePushSnapshot,
    $remoteJson,
    [System.Text.UTF8Encoding]::new($false)
)

Write-Host ""
Write-Host "Snapshot remoto creado:"
Write-Host "  $prePushSnapshot"
Write-Host ""

# ======================================================
# 10. RESUMEN ANTES DE ESCRIBIR
# ======================================================

$connectionCount = @(
    $updatePayload.connections.PSObject.Properties
).Count

Write-Host "=============================================="
Write-Host " CAMBIOS A ENVIAR"
Write-Host "=============================================="
Write-Host ""
Write-Host "Workflow: $($updatePayload.name)"
Write-Host "Nodos: $($updatePayload.nodes.Count)"
Write-Host "Conexiones origen: $connectionCount"
Write-Host ""

# ======================================================
# 11. UPDATE REMOTO
# ======================================================

Write-Host "Actualizando n8n..."
Write-Host ""

n8n-cli workflow update `
    $WORKFLOW_ID `
    --file=$UPDATE_FILE

if ($LASTEXITCODE -ne 0) {
    throw "ERROR: n8n-cli workflow update fallo."
}

Write-Host ""
Write-Host "Update enviado."
Write-Host ""

# ======================================================
# 12. ESPERAR BREVE SINCRONIZACION
# ======================================================

Start-Sleep -Seconds 1

# ======================================================
# 13. DESCARGAR RESULTADO REMOTO VIA NODE
# ======================================================

Write-Host "Descargando estado remoto post-push..."
Write-Host ""

node $DOWNLOAD_SCRIPT

if ($LASTEXITCODE -ne 0) {
    throw "ERROR: download-workflow.mjs fallo despues del push."
}

if (-not (Test-Path $WORKFLOW_FILE)) {
    throw "ERROR: No existe el workflow descargado post-push."
}

$newRemoteJson = [System.IO.File]::ReadAllText(
    $WORKFLOW_FILE,
    [System.Text.Encoding]::UTF8
)

$newRemoteJson = $newRemoteJson.TrimStart([char]0xFEFF)

try {
    $newRemote = $newRemoteJson | ConvertFrom-Json
}
catch {
    throw "ERROR: No se pudo interpretar el workflow remoto post-push."
}

# ======================================================
# 14. VERIFICACIONES POST-PUSH
# ======================================================

if ($newRemote.id -ne $WORKFLOW_ID) {
    throw @"
ERROR:
El workflow remoto devuelto tiene otro ID.

Esperado:
$WORKFLOW_ID

Recibido:
$($newRemote.id)
"@
}

if ($newRemote.nodes.Count -ne $updatePayload.nodes.Count) {
    throw @"
ERROR:
La cantidad de nodos remota no coincide.

Local:
$($updatePayload.nodes.Count)

Remoto:
$($newRemote.nodes.Count)
"@
}

$newConnectionCount = @(
    $newRemote.connections.PSObject.Properties
).Count

if ($newConnectionCount -ne $connectionCount) {
    throw @"
ERROR:
La cantidad de origenes con conexiones no coincide.

Local:
$connectionCount

Remoto:
$newConnectionCount
"@
}

Write-Host ""
Write-Host "Verificacion post-push OK."
Write-Host ""
Write-Host "Nuevo updatedAt: $(Format-HoraEcuador $newRemote.updatedAt)"
Write-Host "Nuevo versionId: $($newRemote.versionId)"
Write-Host "Nodos remotos: $($newRemote.nodes.Count)"
Write-Host "Conexiones origen remotas: $newConnectionCount"
Write-Host ""

# ======================================================
# 15. ACTUALIZAR WORKFLOW EDITABLE
# ======================================================

Copy-Item `
    $WORKFLOW_FILE `
    $EDIT_FILE `
    -Force

Write-Host "Workflow editable sincronizado."
Write-Host ""

# ======================================================
# 16. ACTUALIZAR REMOTE-BASE
# ======================================================

$newState = [ordered]@{
    workflowId = $newRemote.id
    workflowName = $newRemote.name
    updatedAt = $newRemote.updatedAt
    versionId = $newRemote.versionId
    capturedAt = (Get-Date).ToUniversalTime().ToString("o")
}

$newStateJson = `
    $newState |
    ConvertTo-Json -Depth 10

[System.IO.File]::WriteAllText(
    $STATE_FILE,
    $newStateJson,
    [System.Text.UTF8Encoding]::new($false)
)

Write-Host "remote-base.json actualizado."
Write-Host ""

# ======================================================
# 17. RE-EXTRAER CODE NODES
# ======================================================

Write-Host "Re-extrayendo Code Nodes..."
Write-Host ""

node $EXTRACT_SCRIPT

if ($LASTEXITCODE -ne 0) {
    throw "ERROR: extract-code.mjs fallo despues del push."
}

# ======================================================
# 18. RESULTADO FINAL
# ======================================================

Write-Host ""
Write-Host "=============================================="
Write-Host " PUSH COMPLETADO CORRECTAMENTE"
Write-Host "=============================================="
Write-Host ""
Write-Host "n8n fue actualizado."
Write-Host ""
Write-Host "Workflow:"
Write-Host "  $($newRemote.name)"
Write-Host ""
Write-Host "ID:"
Write-Host "  $($newRemote.id)"
Write-Host ""
Write-Host "Nodos:"
Write-Host "  $($newRemote.nodes.Count)"
Write-Host ""
Write-Host "Conexiones origen:"
Write-Host "  $newConnectionCount"
Write-Host ""
Write-Host "updatedAt:"
Write-Host "  $(Format-HoraEcuador $newRemote.updatedAt)"
Write-Host ""
Write-Host "versionId:"
Write-Host "  $($newRemote.versionId)"
Write-Host ""