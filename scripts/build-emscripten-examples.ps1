[CmdletBinding()]
param(
    [string]$EmsdkRoot = $env:EMSDK,
    [string]$MakePath = '',
    [ValidateSet('example-basic', 'example-tutorials', 'example-imgui')]
    [string[]]$Examples = @('example-basic', 'example-tutorials', 'example-imgui'),
    [switch]$Serve,
    [ValidateSet('example-basic', 'example-tutorials', 'example-imgui')]
    [string]$ServeExample = 'example-basic',
    [ValidateRange(1, 65535)]
    [int]$Port = 8080
)

$ErrorActionPreference = 'Stop'
$repoRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$originalLocation = Get-Location

if ([string]::IsNullOrWhiteSpace($EmsdkRoot)) { $EmsdkRoot = 'C:\emsdk' }
$emscriptenDir = Join-Path $EmsdkRoot 'upstream\emscripten'
$empp = Join-Path $emscriptenDir 'em++.bat'
$emcc = Join-Path $emscriptenDir 'emcc.bat'
$emrun = Join-Path $emscriptenDir 'emrun.bat'

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
if (![string]::IsNullOrWhiteSpace($env:OF_ROOT)) {
    $normalizedOfRoot = $env:OF_ROOT -replace '\\', '/'
    if ($normalizedOfRoot -match '^([A-Za-z]):/(.+)$') {
        $drive = $matches[1].ToLowerInvariant()
        $rest = $matches[2]
        $normalizedOfRoot = "/$drive/$rest"
    }
    $env:OF_ROOT = $normalizedOfRoot
}

$appNames = @{
    'example-basic' = 'example-basic'
    'example-tutorials' = 'example-tutorials'
    'example-imgui' = 'example-imgui'
}

foreach ($example in $Examples) {
    $projectDir = Join-Path $repoRoot $example
    if (!(Test-Path -LiteralPath $projectDir)) {
        throw "Example directory was not found: $projectDir"
    }

    $appName = $appNames[$example]
    $emppForMake = $empp -replace '\\', '/'
    $emccForMake = $emcc -replace '\\', '/'

    Write-Host "Building $example for Emscripten..."
    Set-Location $projectDir
    & $MakePath -j2 APPNAME=$appName PLATFORM_OS=emscripten "CXX=cmd.exe /c $emppForMake" "CC=cmd.exe /c $emccForMake -r"
    $makeExit = $LASTEXITCODE
    Set-Location $originalLocation

    if ($makeExit -ne 0) {
        throw "Build failed for $example with exit code $makeExit"
    }

    $artifactDir = Join-Path $projectDir "bin\em\$appName"
    $required = @('index.html', 'index.js', 'index.wasm')
    $missing = $required | Where-Object { !(Test-Path -LiteralPath (Join-Path $artifactDir $_)) }
    if ($missing) {
        throw "$example did not produce required browser artifacts: $($missing -join ', ')"
    }
    Write-Host "Built $example => $artifactDir"
}

if ($Serve) {
    if (!(Test-Path -LiteralPath $emrun)) {
        throw "emrun was not found under: $EmsdkRoot"
    }
    if ($ServeExample -notin $Examples) {
        throw "-ServeExample '$ServeExample' must also be included in -Examples."
    }

    $serveDir = Join-Path $repoRoot "$ServeExample\bin\em\$($appNames[$ServeExample])"
    if (!(Test-Path -LiteralPath $serveDir)) {
        throw "Serve directory does not exist yet: $serveDir"
    }

    Write-Host "Serving $ServeExample at http://localhost:$Port/"
    & $emrun --no_browser --port $Port $serveDir
}
