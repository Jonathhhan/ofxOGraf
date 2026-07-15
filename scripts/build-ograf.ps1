[CmdletBinding()]
param(
    [string]$EmsdkRoot = $env:EMSDK,
    [string]$MakePath = ''
)

$ErrorActionPreference = 'Stop'
$repoRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$projectDir = Join-Path $repoRoot 'example-basic'
$originalLocation = Get-Location
$artifactDir = Join-Path $projectDir 'bin\em\ofxOGraf'
$distDir = Join-Path $repoRoot 'ograf\dist'

if ([string]::IsNullOrWhiteSpace($EmsdkRoot)) { $EmsdkRoot = 'C:\emsdk' }
$emscriptenDir = Join-Path $EmsdkRoot 'upstream\emscripten'
$empp = Join-Path $emscriptenDir 'em++.bat'
$emcc = Join-Path $emscriptenDir 'emcc.bat'
if (!(Test-Path -LiteralPath $empp) -or !(Test-Path -LiteralPath $emcc)) {
    throw "Emscripten was not found under: $EmsdkRoot"
}

if ([string]::IsNullOrWhiteSpace($MakePath)) {
    $shimMake = 'C:\of-tools\make.exe'
    if (Test-Path -LiteralPath $shimMake) { $MakePath = $shimMake }
    elseif ($command = Get-Command make -ErrorAction SilentlyContinue) { $MakePath = $command.Source }
    else { throw 'GNU Make was not found. Pass -MakePath or add make to PATH.' }
}

$shellPaths = @('C:\of-tools', 'C:\git\usr\bin') | Where-Object { Test-Path -LiteralPath $_ }
if ($shellPaths.Count -gt 0) {
    $env:PATH = (($shellPaths -join ';') + ';' + $env:PATH)
}
$env:PATH = "$emscriptenDir;$EmsdkRoot;$env:PATH"
Set-Location $projectDir
# GNU Make invokes the MSYS shell, which otherwise strips the backslashes from
# C:\emsdk paths before cmd.exe sees them.
$emppForMake = $empp -replace '\\', '/'
$emccForMake = $emcc -replace '\\', '/'
& $MakePath -j2 APPNAME=ofxOGraf OGRAF_BUILD=1 PLATFORM_OS=emscripten "CXX=cmd.exe /c $emppForMake" "CC=cmd.exe /c $emccForMake -r"
$makeExit = $LASTEXITCODE
Set-Location $originalLocation

$required = @('index.js', 'index.wasm')
$missing = $required | Where-Object { !(Test-Path -LiteralPath (Join-Path $artifactDir $_)) }
if ($missing) { throw "OGraf Emscripten build did not produce: $($missing -join ', ')" }

New-Item -ItemType Directory -Force -Path $distDir | Out-Null
Copy-Item -LiteralPath (Join-Path $artifactDir 'index.js') -Destination (Join-Path $distDir 'ofxOGraf.js') -Force
Copy-Item -LiteralPath (Join-Path $artifactDir 'index.wasm') -Destination (Join-Path $distDir 'ofxOGraf.wasm') -Force
if (Test-Path -LiteralPath (Join-Path $artifactDir 'index.data')) {
    Copy-Item -LiteralPath (Join-Path $artifactDir 'index.data') -Destination (Join-Path $distDir 'ofxOGraf.data') -Force
}

if ($makeExit -ne 0) {
    Write-Warning "Make exited with $makeExit after generating the required artifacts; continuing to package them."
}

& (Join-Path $PSScriptRoot 'package-ograf.ps1') -SourceDir (Join-Path $repoRoot 'ograf')
if ($LASTEXITCODE -ne 0) { throw 'OGraf packaging failed.' }
