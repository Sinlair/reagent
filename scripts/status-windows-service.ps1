param(
  [string]$TaskName = "ReAgent"
)

$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Split-Path -Parent $scriptDir
$serviceRoot = Join-Path $repoRoot "workspace\service"
$configPath = Join-Path $serviceRoot "windows-service.json"
$statePath = Join-Path $serviceRoot "runner-state.json"
$stdoutLog = Join-Path $serviceRoot "reagent-service.out.log"
$stderrLog = Join-Path $serviceRoot "reagent-service.err.log"

$task = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
$taskInfo = if ($task) { Get-ScheduledTaskInfo -TaskName $TaskName } else { $null }
$runnerState = if (Test-Path -LiteralPath $statePath) { Get-Content -LiteralPath $statePath -Raw | ConvertFrom-Json } else { $null }
$config = if (Test-Path -LiteralPath $configPath) { Get-Content -LiteralPath $configPath -Raw | ConvertFrom-Json } else { $null }
$processAlive = $false
if ($runnerState -and $runnerState.pid) {
  $processAlive = [bool](Get-Process -Id ([int]$runnerState.pid) -ErrorAction SilentlyContinue)
}

[ordered]@{
  taskName = $TaskName
  taskRegistered = [bool]$task
  taskState = if ($taskInfo) { $taskInfo.State.ToString() } else { "missing" }
  lastRunTime = if ($taskInfo) { $taskInfo.LastRunTime } else { $null }
  lastTaskResult = if ($taskInfo) { $taskInfo.LastTaskResult } else { $null }
  nextRunTime = if ($taskInfo) { $taskInfo.NextRunTime } else { $null }
  runnerState = $runnerState
  processAlive = $processAlive
  configPath = if ($config) { $configPath } else { $null }
  stdoutLog = if (Test-Path -LiteralPath $stdoutLog) { $stdoutLog } else { $null }
  stderrLog = if (Test-Path -LiteralPath $stderrLog) { $stderrLog } else { $null }
} | ConvertTo-Json -Depth 6
