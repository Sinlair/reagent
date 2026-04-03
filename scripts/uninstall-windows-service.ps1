param(
  [string]$TaskName = "ReAgent"
)

$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Split-Path -Parent $scriptDir
$serviceRoot = Join-Path $repoRoot "workspace\service"
$configPath = Join-Path $serviceRoot "windows-service.json"

if (Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue) {
  Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
}

if (Test-Path -LiteralPath $configPath) {
  Remove-Item -LiteralPath $configPath -Force
}

Write-Host "Uninstalled ReAgent Windows task: $TaskName"
