[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$dotnetExe = Join-Path $repoRoot ".dotnet\dotnet.exe"
$projectPath = Join-Path $repoRoot "native\NyaLauncher\src\NyaLauncher\NyaLauncher.csproj"
$outputPath = Join-Path $repoRoot "outputs\nya-launcher-p1"
$env:NUGET_PACKAGES = Join-Path $repoRoot ".nuget\packages"

if (-not (Test-Path -LiteralPath $dotnetExe)) {
    throw "Local .NET SDK not found. Run scripts/bootstrap-nya-launcher-sdk.ps1 first."
}

New-Item -ItemType Directory -Force -Path $outputPath | Out-Null

& $dotnetExe publish $projectPath `
    --configuration Release `
    --runtime win-x64 `
    --self-contained true `
    -p:PublishSingleFile=true `
    -p:IncludeNativeLibrariesForSelfExtract=true `
    --output $outputPath

exit $LASTEXITCODE
