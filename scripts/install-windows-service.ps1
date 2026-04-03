param(
  [string]$TaskName = "ReAgent",
  [int]$RestartDelaySeconds = 5
)

$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Split-Path -Parent $scriptDir
$serviceRoot = Join-Path $repoRoot "workspace\service"
$runnerScript = Join-Path $scriptDir "reagent-service-runner.ps1"
$configPath = Join-Path $serviceRoot "windows-service.json"
$preflightScript = Join-Path $scriptDir "preflight-windows-service.ps1"

$preflight = & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $preflightScript -RequireAdmin | ConvertFrom-Json
if (-not $preflight.ok) {
  throw ("Preflight failed: " + (($preflight.issues | ForEach-Object { $_ }) -join "; "))
}

$nodeExe = [string]$preflight.checks.nodeExe
$entryScript = Join-Path $repoRoot "dist\server.js"

New-Item -ItemType Directory -Force -Path $serviceRoot | Out-Null

$config = [ordered]@{
  taskName = $TaskName
  nodeExe = $nodeExe
  entryScript = $entryScript
  workingDirectory = $repoRoot
  runnerScript = $runnerScript
  restartDelaySeconds = $RestartDelaySeconds
  installedAt = (Get-Date).ToString("o")
}

$config | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $configPath -Encoding UTF8

$action = New-ScheduledTaskAction `
  -Execute "powershell.exe" `
  -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$runnerScript`""

$triggers = @(
  (New-ScheduledTaskTrigger -AtStartup),
  (New-ScheduledTaskTrigger -AtLogOn)
)

$settings = New-ScheduledTaskSettingsSet `
  -AllowStartIfOnBatteries `
  -DontStopIfGoingOnBatteries `
  -StartWhenAvailable `
  -MultipleInstances IgnoreNew

$principal = New-ScheduledTaskPrincipal `
  -UserId "SYSTEM" `
  -LogonType ServiceAccount `
  -RunLevel Highest

Register-ScheduledTask `
  -TaskName $TaskName `
  -Action $action `
  -Trigger $triggers `
  -Settings $settings `
  -Principal $principal `
  -Force | Out-Null

Start-ScheduledTask -TaskName $TaskName
Write-Host "Installed ReAgent Windows task: $TaskName"
