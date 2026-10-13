# ======================================================
# PEGASO N8N - PULL WORKFLOW
# ======================================================
#
# RESPONSABILIDAD:
# - Identificar exactamente el workflow principal activo.
# - Descargar el JSON desde n8n.
# - Guardarlo como UTF-8 SIN BOM.
# - Crear snapshot local antes de reemplazar.
# - Ejecutar extract-code.mjs.
#
# NO modifica n8n.
# ======================================================

$ErrorActionPreference = "Stop"

$WF_NAME = "SISTEMA AUTOMATIZADO PEGASO"

$ROOT = Split-Path -Parent $PSScriptRoot

$WORKFLOW_FILE = Join-Path `
    $ROOT `
    "workflows\sistema-automatizado-pegaso.json"

$SNAPSHOT_DIR = Join-Path `
    $ROOT `
    "snapshots"

$EXTRACT_SCRIPT = Join-Path `
    $ROOT `
    "scripts\extract-code.mjs"

Write-Host ""
Write-Host "=============================================="
Write-Host " PEGASO N8N - PULL"
Write-Host "=============================================="
Write-Host ""

# ------------------------------------------------------
# 1. BUSCAR WORKFLOW
# ------------------------------------------------------

Write-Host "Buscando workflow..."

$allWorkflows = `
    n8n-cli workflow list --format=json |
    ConvertFrom-Json

$wf = @(
    $allWorkflows |
    Where-Object {
        $_.name -eq $WF_NAME -and
        $_.active -eq $true
    }
)

if ($wf.Count -ne 1) {

    throw @"
ERROR:
Se esperaba exactamente 1 workflow activo llamado:

$WF_NAME

Encontrados: $($wf.Count)

PULL CANCELADO.
"@
}

$WORKFLOW_ID = $wf[0].id

Write-Host "Workflow encontrado:"
Write-Host "  Nombre: $($wf[0].name)"
Write-Host "  ID:     $WORKFLOW_ID"
Write-Host ""

# ------------------------------------------------------
# 2. SNAPSHOT DEL ARCHIVO LOCAL ACTUAL
# ------------------------------------------------------

if (Test-Path $WORKFLOW_FILE) {

    if (-not (Test-Path $SNAPSHOT_DIR)) {
        New-Item `
            -ItemType Directory `
            -Path $SNAPSHOT_DIR |
            Out-Null
    }

    $stamp = Get-Date -Format "yyyyMMdd-HHmmss"

    $snapshotFile = Join-Path `
        $SNAPSHOT_DIR `
        "sistema-automatizado-pegaso-pre-pull-$stamp.json"

    Copy-Item `
        $WORKFLOW_FILE `
        $snapshotFile

    Write-Host "Snapshot local creado:"
    Write-Host "  $snapshotFile"
    Write-Host ""
}

# ------------------------------------------------------
# 3. DESCARGAR WORKFLOW
# ------------------------------------------------------

Write-Host "Descargando workflow desde n8n..."

$json = `
    n8n-cli workflow get `
        $WORKFLOW_ID `
        --format=json |
    Out-String

if ([string]::IsNullOrWhiteSpace($json)) {
    throw "ERROR: n8n devolvió un workflow vacío."
}

# Eliminar BOM si existiera
$json = $json.TrimStart([char]0xFEFF)

# ------------------------------------------------------
# 4. VALIDAR JSON ANTES DE GUARDAR
# ------------------------------------------------------

try {

    $parsed = `
        $json |
        ConvertFrom-Json

}
catch {

    throw "ERROR: n8n devolvió JSON inválido. No se modificó el archivo local."
}

if ($parsed.id -ne $WORKFLOW_ID) {

    throw @"
ERROR:
El workflow descargado no coincide con el esperado.

Esperado:
$WORKFLOW_ID

Recibido:
$($parsed.id)

PULL CANCELADO.
"@
}

# ------------------------------------------------------
# 5. GUARDAR UTF-8 SIN BOM
# ------------------------------------------------------

[System.IO.File]::WriteAllText(
    $WORKFLOW_FILE,
    $json,
    [System.Text.UTF8Encoding]::new($false)
)

Write-Host ""
Write-Host "Workflow descargado correctamente."
Write-Host ""
Write-Host "  ID:     $($parsed.id)"
Write-Host "  Nombre: $($parsed.name)"
Write-Host "  Nodos:  $($parsed.nodes.Count)"
Write-Host ""

# ------------------------------------------------------
# 5.1 ACTUALIZAR WORKFLOW EDITABLE
# ------------------------------------------------------

$EDIT_FILE = Join-Path `
    $ROOT `
    "workflows\sistema-automatizado-pegaso.edit.json"

Copy-Item `
    $WORKFLOW_FILE `
    $EDIT_FILE `
    -Force

Write-Host "Workflow editable sincronizado."
Write-Host ""

# ------------------------------------------------------
# 5.2 ACTUALIZAR ESTADO REMOTO BASE
# ------------------------------------------------------

$STATE_DIR = Join-Path `
    $ROOT `
    "state"

$STATE_FILE = Join-Path `
    $STATE_DIR `
    "remote-base.json"

if (-not (Test-Path $STATE_DIR)) {
    New-Item `
        -ItemType Directory `
        -Path $STATE_DIR |
        Out-Null
}

$state = [ordered]@{
    workflowId = $parsed.id
    workflowName = $parsed.name
    updatedAt = $parsed.updatedAt
    versionId = $parsed.versionId
    capturedAt = (Get-Date).ToUniversalTime().ToString("o")
}

$stateJson = `
    $state |
    ConvertTo-Json -Depth 10

[System.IO.File]::WriteAllText(
    $STATE_FILE,
    $stateJson,
    [System.Text.UTF8Encoding]::new($false)
)

Write-Host "Estado remoto base actualizado."
Write-Host ""

# ------------------------------------------------------
# 6. EXTRAER CODE NODES
# ------------------------------------------------------

if (-not (Test-Path $EXTRACT_SCRIPT)) {
    throw "ERROR: No existe extract-code.mjs"
}

Write-Host "Extrayendo Code Nodes..."
Write-Host ""

node $EXTRACT_SCRIPT

if ($LASTEXITCODE -ne 0) {
    throw "ERROR: extract-code.mjs terminó con error."
}

Write-Host ""
Write-Host "=============================================="
Write-Host " PULL COMPLETADO"
Write-Host "=============================================="
Write-Host ""
Write-Host "Producción NO fue modificada."
Write-Host ""