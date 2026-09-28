[CmdletBinding()]
param(
    [Alias("filter")]
    [string]$TestFilter,

    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$RemainingArguments
)

$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$dotnetExe = Join-Path $repoRoot ".dotnet\dotnet.exe"
$solutionPath = Join-Path $repoRoot "native\NyaLauncher\NyaLauncher.slnx"
$env:NUGET_PACKAGES = Join-Path $repoRoot ".nuget\packages"

if (-not (Test-Path -LiteralPath $dotnetExe)) {
    throw "Local .NET SDK not found. Run scripts/bootstrap-nya-launcher-sdk.ps1 first."
}

$dotnetArguments = @(
    "test",
    $solutionPath,
    "--configuration",
    "Release"
)

if ($TestFilter) {
    $dotnetArguments += @("--filter", $TestFilter)
}

if ($RemainingArguments) {
    $dotnetArguments += $RemainingArguments
}

& $dotnetExe @dotnetArguments
exit $LASTEXITCODE
