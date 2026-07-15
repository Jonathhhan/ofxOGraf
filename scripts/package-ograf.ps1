[CmdletBinding()]
param(
    [string]$SourceDir = (Join-Path $PSScriptRoot '..\ograf'),
    [string]$OutputPath = (Join-Path $PSScriptRoot '..\build\ofxOGraf-graphic.zip'),
    [switch]$AllowMissingRuntime,
    [string]$TemplateDefinition = '',
    [string]$AssetRoot = ''
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem
Add-Type -AssemblyName System.IO.Compression
$source = [System.IO.Path]::GetFullPath($SourceDir)
$output = [System.IO.Path]::GetFullPath($OutputPath)
$manifestPath = Join-Path $source 'graphic.ograf.json'

if (-not (Test-Path -LiteralPath $manifestPath -PathType Leaf)) {
    throw "OGraf manifest not found: $manifestPath"
}

$manifest = Get-Content -Raw -LiteralPath $manifestPath | ConvertFrom-Json
if ($manifest.'$schema' -ne 'https://ograf.ebu.io/v1/specification/json-schemas/graphics/schema.json') {
    throw 'The manifest does not target the OGraf v1 Graphics schema.'
}

if (-not $TemplateDefinition) {
    $candidateDefinition = Join-Path $source 'template-definition.json'
    if (Test-Path -LiteralPath $candidateDefinition -PathType Leaf) {
        $TemplateDefinition = $candidateDefinition
    }
}

if ($TemplateDefinition) {
    $definitionPath = [System.IO.Path]::GetFullPath($TemplateDefinition)
    $definitionAssetRoot = if ($AssetRoot) {
        [System.IO.Path]::GetFullPath($AssetRoot)
    } else {
        Join-Path $source 'data'
    }
    # The JSON result is also the package allowlist. Keep the descriptor as
    # the authority for template-owned files instead of archiving every file
    # that happens to be in data/ on the authoring workstation.
    $definitionValidationJson = & node (Join-Path $PSScriptRoot 'validate-template-definition.mjs') `
        --json --strict --check-assets --asset-root $definitionAssetRoot $definitionPath
    if ($LASTEXITCODE -ne 0) {
        throw 'TemplateDefinition validation failed.'
    }
    try {
        $definitionValidation = ($definitionValidationJson | Out-String | ConvertFrom-Json)
        $declaredAssets = @($definitionValidation.results[0].assets)
    } catch {
        throw "Could not read TemplateDefinition validation result: $($_.Exception.Message)"
    }
}

$required = @($manifest.main, 'scene.json')
if (-not $AllowMissingRuntime) {
    $required += @('dist/ofxOGraf.js', 'dist/ofxOGraf.wasm')
}
foreach ($relative in $required) {
    $path = Join-Path $source $relative
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
        throw "Required package file is missing: $relative"
    }
}

$outputDirectory = Split-Path -Parent $output
New-Item -ItemType Directory -Force -Path $outputDirectory | Out-Null
$stage = Join-Path $outputDirectory ('.ofxOGraf-stage-' + [Guid]::NewGuid().ToString('N'))

try {
    New-Item -ItemType Directory -Force -Path $stage | Out-Null

    if ($TemplateDefinition) {
        # Preserve the renderer/runtime layout but deliberately exclude its
        # untracked data directory. Only assets declared in the descriptor
        # are copied below, at their portable data-relative paths.
        Get-ChildItem -LiteralPath $source -Force |
            Where-Object { $_.Name -ne 'data' } |
            ForEach-Object { Copy-Item -LiteralPath $_.FullName -Destination $stage -Recurse -Force }

        Copy-Item -LiteralPath $definitionPath -Destination (Join-Path $stage 'template-definition.json') -Force
        foreach ($asset in $declaredAssets) {
            $relativePath = [string]$asset.path
            $destination = Join-Path (Join-Path $stage 'data') ($relativePath -replace '/', '\\')
            $destinationDirectory = Split-Path -Parent $destination
            New-Item -ItemType Directory -Force -Path $destinationDirectory | Out-Null
            Copy-Item -LiteralPath ([string]$asset.absolutePath) -Destination $destination -Force
        }

        # Validate the final filesystem layout, not merely the source tree.
        & node (Join-Path $PSScriptRoot 'validate-template-definition.mjs') `
            --strict --check-assets --asset-root (Join-Path $stage 'data') (Join-Path $stage 'template-definition.json')
        if ($LASTEXITCODE -ne 0) {
            throw 'Staged TemplateDefinition validation failed.'
        }
    } else {
        Copy-Item -Path (Join-Path $source '*') -Destination $stage -Recurse -Force
    }

    if (Test-Path -LiteralPath $output) {
        Remove-Item -LiteralPath $output
    }

    # Archive the staged folder contents so the manifest is at the ZIP root.
    # The SuperFlyTV server also accepts nested manifests, but a root manifest
    # is the most portable package layout.
    $archive = [System.IO.Compression.ZipFile]::Open($output, [System.IO.Compression.ZipArchiveMode]::Create)
    try {
        Get-ChildItem -LiteralPath $stage -File -Recurse | ForEach-Object {
            $relativePath = $_.FullName.Substring($stage.Length).TrimStart('\', '/').Replace('\', '/')
            $entry = $archive.CreateEntry($relativePath, [System.IO.Compression.CompressionLevel]::Optimal)
            $input = [System.IO.File]::OpenRead($_.FullName)
            $entryStream = $entry.Open()
            try {
                $input.CopyTo($entryStream)
            } finally {
                $entryStream.Dispose()
                $input.Dispose()
            }
        }
    } finally {
        $archive.Dispose()
    }
    Write-Output $output
} finally {
    if (Test-Path -LiteralPath $stage) {
        Remove-Item -LiteralPath $stage -Recurse -Force
    }
}
