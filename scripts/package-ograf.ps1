[CmdletBinding()]
param(
    [string]$SourceDir = (Join-Path $PSScriptRoot '..\ograf'),
    [string]$OutputPath = (Join-Path $PSScriptRoot '..\build\ofxOGraf-graphic.zip'),
    [switch]$AllowMissingRuntime
)

$ErrorActionPreference = 'Stop'
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

$required = @(
    $manifest.main,
    'scene.json'
)
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
if (Test-Path -LiteralPath $output) {
    Remove-Item -LiteralPath $output
}

# Archive the folder contents so the manifest is at the ZIP root. The
# SuperFlyTV server also accepts nested manifests, but a root manifest is the
# most portable package layout.
Compress-Archive -Path (Join-Path $source '*') -DestinationPath $output -CompressionLevel Optimal
Write-Output $output
