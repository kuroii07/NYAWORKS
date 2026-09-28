[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$sdkRoot = Join-Path $repoRoot ".dotnet"
$dotnetExe = Join-Path $sdkRoot "dotnet.exe"
$nugetPackages = Join-Path $repoRoot ".nuget\packages"
$installerRoot = Join-Path $repoRoot "work\nya-launcher-sdk"
$installerPath = Join-Path $installerRoot "dotnet-install.ps1"

New-Item -ItemType Directory -Force -Path $sdkRoot, $nugetPackages, $installerRoot | Out-Null
$env:NUGET_PACKAGES = $nugetPackages

if (Test-Path -LiteralPath $dotnetExe) {
    $installedVersion = (& $dotnetExe --version).Trim()
    if ($LASTEXITCODE -eq 0 -and $installedVersion.StartsWith("10.")) {
        Write-Host "NyaLauncher SDK already available: $installedVersion"
        exit 0
    }
}

Invoke-WebRequest `
    -Uri "https://dot.net/v1/dotnet-install.ps1" `
    -OutFile $installerPath `
    -UseBasicParsing

& powershell.exe `
    -NoProfile `
    -ExecutionPolicy Bypass `
    -File $installerPath `
    -Channel "10.0" `
    -Quality "GA" `
    -InstallDir $sdkRoot `
    -NoPath

if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $dotnetExe)) {
    throw "Failed to install the repository-local .NET 10 SDK."
}

$resolvedVersion = (& $dotnetExe --version).Trim()
if ($LASTEXITCODE -ne 0 -or -not $resolvedVersion.StartsWith("10.")) {
    throw "Expected a .NET 10 SDK, received: $resolvedVersion"
}

Write-Host "NyaLauncher SDK ready: $resolvedVersion"
