[CmdletBinding()]
param(
    [Parameter(Mandatory = $true, Position = 0)]
    [string]$PackagePath
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem
$package = [System.IO.Path]::GetFullPath($PackagePath)
if (-not (Test-Path -LiteralPath $package -PathType Leaf)) {
    throw "OGraf package not found: $package"
}

$tempRoot = Join-Path ([System.IO.Path]::GetTempPath()) ('ofxOGraf-verify-' + [Guid]::NewGuid().ToString('N'))
try {
    New-Item -ItemType Directory -Path $tempRoot | Out-Null
    $archive = [System.IO.Compression.ZipFile]::OpenRead($package)
    try {
        $seen = [System.Collections.Generic.HashSet[string]]::new([StringComparer]::Ordinal)
        $maxFiles = 4096
        $maxFileBytes = 128MB
        $maxPackageBytes = 512MB
        $totalBytes = 0
        if ($archive.Entries.Count -gt $maxFiles) {
            throw "ZIP contains $($archive.Entries.Count) entries; limit is $maxFiles."
        }
        foreach ($entry in $archive.Entries) {
            $portable = $entry.FullName.Replace('\', '/')
            if ($entry.Length -gt $maxFileBytes) {
                throw "ZIP entry exceeds the $maxFileBytes-byte limit: $portable"
            }
            $totalBytes += $entry.Length
            if ($totalBytes -gt $maxPackageBytes) {
                throw "Expanded ZIP exceeds the $maxPackageBytes-byte package limit."
            }
            if ([System.IO.Path]::IsPathRooted($portable) -or
                $portable.Split('/') -contains '..' -or
                -not $seen.Add($portable)) {
                throw "Unsafe or duplicate ZIP entry: $($entry.FullName)"
            }
        }
    } finally {
        $archive.Dispose()
    }
    [System.IO.Compression.ZipFile]::ExtractToDirectory($package, $tempRoot)
    & node (Join-Path $PSScriptRoot 'verify-package-integrity.mjs') $tempRoot
    if ($LASTEXITCODE -ne 0) {
        throw "OGraf package verification failed with exit code $LASTEXITCODE."
    }
    Write-Output "Verified OGraf package: $package"
} finally {
    if (Test-Path -LiteralPath $tempRoot) {
        Remove-Item -LiteralPath $tempRoot -Recurse -Force
    }
}