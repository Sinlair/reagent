param(
  [string]$TaskName = "ReAgent"
)

$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Split-Path -Parent $scriptDir
$serviceRoot = Join-Path $repoRoot "workspace\service"
$stopFlagPath = Join-Path $serviceRoot "stop.flag"
$statePath = Join-Path $serviceRoot "runner-state.json"

New-Item -ItemType Directory -Force -Path $serviceRoot | Out-Null
Set-Content -LiteralPath $stopFlagPath -Value "stop" -Encoding ASCII

if (Test-Path -LiteralPath $statePath) {
  $state = Get-Content -LiteralPath $statePath -Raw | ConvertFrom-Json
  if ($state.pid) {
    Stop-Process -Id ([int]$state.pid) -Force -ErrorAction SilentlyContinue
  }
}

if (Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue) {
  Stop-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
}

Write-Host "Stopped ReAgent Windows task: $TaskName"
