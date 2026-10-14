# ======================================================
# PEGASO N8N - PULL WORKFLOW SEGURO
# ======================================================
#
# RESPONSABILIDAD:
# - Identificar exactamente el workflow principal activo.
# - Crear snapshot local antes de reemplazar.
# - Descargar el workflow usando download-workflow.mjs
#   para preservar UTF-8 correctamente.
# - Sincronizar workflow editable.
# - Actualizar state/remote-base.json.
# - Ejecutar extract-code.mjs.
# - Validar encoding CP850 / box-drawing.
#
# NO modifica n8n.
#
# IMPORTANTE:
# - NO transporta el JSON por Out-String.
# - NO usa PowerShell para decodificar la salida JSON de n8n.
# ======================================================

$ErrorActionPreference = "Stop"

$WF_NAME = "SISTEMA AUTOMATIZADO PEGASO"

$ROOT = Split-Path -Parent $PSScriptRoot

$WORKFLOW_FILE = Join-Path `
    $ROOT `
    "workflows\sistema-automatizado-pegaso.json"

$EDIT_FILE = Join-Path `
    $ROOT `
    "workflows\sistema-automatizado-pegaso.edit.json"

$SNAPSHOT_DIR = Join-Path `
    $ROOT `
    "snapshots"

$STATE_DIR = Join-Path `
    $ROOT `
    "state"

$STATE_FILE = Join-Path `
    $STATE_DIR `
    "remote-base.json"

$DOWNLOAD_SCRIPT = Join-Path `
    $ROOT `
    "scripts\download-workflow.mjs"

$EXTRACT_SCRIPT = Join-Path `
    $ROOT `
    "scripts\extract-code.mjs"

$CHECK_ENCODING_SCRIPT = Join-Path `
    $ROOT `
    "scripts\check-encoding.mjs"

Write-Host ""
Write-Host "=============================================="
Write-Host " PEGASO N8N - PULL SEGURO"
Write-Host "=============================================="
Write-Host ""

# ------------------------------------------------------
# 1. VALIDAR DEPENDENCIAS
# ------------------------------------------------------

if (-not (Test-Path $DOWNLOAD_SCRIPT)) {
    throw "ERROR: No existe download-workflow.mjs"
}

if (-not (Test-Path $EXTRACT_SCRIPT)) {
    throw "ERROR: No existe extract-code.mjs"
}

# ------------------------------------------------------
# 2. BUSCAR WORKFLOW ACTIVO
# ------------------------------------------------------

Write-Host "Buscando workflow activo..."

$allWorkflowsRaw = n8n-cli workflow list --format=json

if ($LASTEXITCODE -ne 0) {
    throw "ERROR: n8n-cli workflow list terminó con error."
}

try {
    $allWorkflows = $allWorkflowsRaw | ConvertFrom-Json
}
catch {
    throw "ERROR: No se pudo interpretar la lista de workflows."
}

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
# 3. SNAPSHOT DEL ARCHIVO LOCAL ACTUAL
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
        $snapshotFile `
        -Force

    Write-Host "Snapshot local creado:"
    Write-Host "  $snapshotFile"
    Write-Host ""
}

# ------------------------------------------------------
# 4. DESCARGAR WORKFLOW POR NODE / UTF-8
# ------------------------------------------------------

Write-Host "Descargando workflow desde n8n mediante Node..."
Write-Host ""

node $DOWNLOAD_SCRIPT

if ($LASTEXITCODE -ne 0) {
    throw "ERROR: download-workflow.mjs terminó con error."
}

if (-not (Test-Path $WORKFLOW_FILE)) {
    throw "ERROR: download-workflow.mjs no generó el workflow esperado."
}

Write-Host ""

# ------------------------------------------------------
# 5. LEER Y VALIDAR WORKFLOW DESCARGADO
# ------------------------------------------------------

try {

    $json = [System.IO.File]::ReadAllText(
        $WORKFLOW_FILE,
        [System.Text.Encoding]::UTF8
    )

    $json = $json.TrimStart([char]0xFEFF)

    $parsed = $json | ConvertFrom-Json

}
catch {
    throw "ERROR: El workflow descargado no contiene JSON válido."
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

Write-Host "Workflow validado:"
Write-Host "  ID:        $($parsed.id)"
Write-Host "  Nombre:    $($parsed.name)"
Write-Host "  Nodos:     $($parsed.nodes.Count)"
Write-Host "  UpdatedAt: $($parsed.updatedAt)"
Write-Host "  VersionId: $($parsed.versionId)"
Write-Host ""

# ------------------------------------------------------
# 6. VALIDAR MOJIBAKE CP850 / BOX-DRAWING
# ------------------------------------------------------

Write-Host "Validando caracteres sospechosos de encoding..."

$boxDrawingCount = 0

foreach ($char in $json.ToCharArray()) {

    $code = [int][char]$char

    if ($code -ge 0x2500 -and $code -le 0x257F) {
        $boxDrawingCount++
    }
}

if ($boxDrawingCount -gt 0) {

    throw @"
ERROR:
Se detectaron caracteres box-drawing sospechosos.

Cantidad:
$boxDrawingCount

Esto puede indicar mojibake CP850.

PULL CANCELADO.
No se sincronizará el editable ni se extraerán Code Nodes.
"@
}

Write-Host "Encoding base OK."
Write-Host "  Caracteres box-drawing sospechosos: 0"
Write-Host ""

# ------------------------------------------------------
# 7. SINCRONIZAR WORKFLOW EDITABLE
# ------------------------------------------------------

Copy-Item `
    $WORKFLOW_FILE `
    $EDIT_FILE `
    -Force

Write-Host "Workflow editable sincronizado."
Write-Host ""

# ------------------------------------------------------
# 8. ACTUALIZAR REMOTE BASE
# ------------------------------------------------------

if (-not (Test-Path $STATE_DIR)) {
    New-Item `
        -ItemType Directory `
        -Path $STATE_DIR |
        Out-Null
}

$state = [ordered]@{
    workflowId   = $parsed.id
    workflowName = $parsed.name
    updatedAt    = $parsed.updatedAt
    versionId    = $parsed.versionId
    capturedAt   = (Get-Date).ToUniversalTime().ToString("o")
}

$stateJson = `
    $state |
    ConvertTo-Json -Depth 10

[System.IO.File]::WriteAllText(
    $STATE_FILE,
    $stateJson + [Environment]::NewLine,
    [System.Text.UTF8Encoding]::new($false)
)

Write-Host "Estado remoto base actualizado."
Write-Host ""

# ------------------------------------------------------
# 9. EXTRAER CODE NODES
# ------------------------------------------------------

Write-Host "Extrayendo Code Nodes..."
Write-Host ""

node $EXTRACT_SCRIPT

if ($LASTEXITCODE -ne 0) {
    throw "ERROR: extract-code.mjs terminó con error."
}

Write-Host ""

# ------------------------------------------------------
# 10. VALIDAR LOS .JS EXTRAÍDOS CONTRA CP850
# ------------------------------------------------------

Write-Host "Validando Code Nodes extraídos..."

$CODE_DIR = Join-Path `
    $ROOT `
    "code\_extraidos"

$totalBoxDrawing = 0

$jsFiles = Get-ChildItem `
    -Path $CODE_DIR `
    -Filter "*.js" `
    -File

foreach ($file in $jsFiles) {

    $content = [System.IO.File]::ReadAllText(
        $file.FullName,
        [System.Text.Encoding]::UTF8
    )

    $fileCount = 0

    foreach ($char in $content.ToCharArray()) {

        $code = [int][char]$char

        if ($code -ge 0x2500 -and $code -le 0x257F) {
            $fileCount++
        }
    }

    if ($fileCount -gt 0) {

        Write-Host `
            "  ERROR: $($file.Name) => $fileCount caracteres sospechosos"

        $totalBoxDrawing += $fileCount
    }
}

if ($totalBoxDrawing -gt 0) {

    throw @"
ERROR:
Se detectó mojibake CP850 en los Code Nodes extraídos.

Total:
$totalBoxDrawing

PULL CANCELADO.
"@
}

Write-Host "Code Nodes encoding OK."
Write-Host "  Caracteres box-drawing sospechosos: 0"
Write-Host ""

# ------------------------------------------------------
# 11. CHECK ENCODING LEGACY ADICIONAL
# ------------------------------------------------------

if (Test-Path $CHECK_ENCODING_SCRIPT) {

    Write-Host "Ejecutando check-encoding.mjs..."
    Write-Host ""

    node $CHECK_ENCODING_SCRIPT

    if ($LASTEXITCODE -ne 0) {
        throw "ERROR: check-encoding.mjs detectó problemas."
    }

    Write-Host ""
}

# ------------------------------------------------------
# 12. FIN
# ------------------------------------------------------

Write-Host "=============================================="
Write-Host " PULL COMPLETADO CORRECTAMENTE"
Write-Host "=============================================="
Write-Host ""
Write-Host "Workflow:"
Write-Host "  $($parsed.name)"
Write-Host ""
Write-Host "ID:"
Write-Host "  $($parsed.id)"
Write-Host ""
Write-Host "Nodos:"
Write-Host "  $($parsed.nodes.Count)"
Write-Host ""
Write-Host "UpdatedAt:"
Write-Host "  $($parsed.updatedAt)"
Write-Host ""
Write-Host "VersionId:"
Write-Host "  $($parsed.versionId)"
Write-Host ""
Write-Host "Producción NO fue modificada."
Write-Host ""