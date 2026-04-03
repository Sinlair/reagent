$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Split-Path -Parent $scriptDir
$serviceRoot = Join-Path $repoRoot "workspace\service"
$configPath = Join-Path $serviceRoot "windows-service.json"
$stdoutLog = Join-Path $serviceRoot "reagent-service.out.log"
$stderrLog = Join-Path $serviceRoot "reagent-service.err.log"
$statePath = Join-Path $serviceRoot "runner-state.json"
$stopFlagPath = Join-Path $serviceRoot "stop.flag"

function Write-ServiceLog {
  param(
    [string]$Message
  )

  $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
  Add-Content -LiteralPath $stdoutLog -Value "[$timestamp] $Message"
}

function Save-RunnerState {
  param(
    [hashtable]$State
  )

  $payload = [ordered]@{
    updatedAt = (Get-Date).ToString("o")
  }

  foreach ($key in $State.Keys) {
    $payload[$key] = $State[$key]
  }

  $payload | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $statePath -Encoding UTF8
}

New-Item -ItemType Directory -Force -Path $serviceRoot | Out-Null

if (-not (Test-Path -LiteralPath $configPath)) {
  throw "Missing service config at $configPath. Run the installer first."
}

$config = Get-Content -LiteralPath $configPath -Raw | ConvertFrom-Json
$nodeExe = [string]$config.nodeExe
$entryScript = [string]$config.entryScript
$workingDirectory = [string]$config.workingDirectory
$restartDelaySeconds = if ($config.restartDelaySeconds) { [int]$config.restartDelaySeconds } else { 5 }

if (-not (Test-Path -LiteralPath $nodeExe)) {
  throw "Configured node executable was not found: $nodeExe"
}

if (-not (Test-Path -LiteralPath $entryScript)) {
  throw "Configured entry script was not found: $entryScript"
}

if (Test-Path -LiteralPath $stopFlagPath) {
  Remove-Item -LiteralPath $stopFlagPath -Force
}

Set-Location -LiteralPath $workingDirectory
Write-ServiceLog "ReAgent service runner started."

while ($true) {
  if (Test-Path -LiteralPath $stopFlagPath) {
    Write-ServiceLog "Stop flag detected. Exiting runner."
    Save-RunnerState @{
      status = "stopped"
      reason = "stop-flag"
      pid = $null
      exitCode = $null
    }
    Remove-Item -LiteralPath $stopFlagPath -Force
    break
  }

  Write-ServiceLog "Starting ReAgent server process."
  $process = Start-Process `
    -FilePath $nodeExe `
    -ArgumentList @($entryScript) `
    -WorkingDirectory $workingDirectory `
    -RedirectStandardOutput $stdoutLog `
    -RedirectStandardError $stderrLog `
    -PassThru `
    -WindowStyle Hidden

  Save-RunnerState @{
    status = "running"
    pid = $process.Id
    exitCode = $null
  }

  $process.WaitForExit()
  $exitCode = $process.ExitCode

  if (Test-Path -LiteralPath $stopFlagPath) {
    Write-ServiceLog "ReAgent server exited after a requested stop."
    Save-RunnerState @{
      status = "stopped"
      reason = "stop-flag"
      pid = $null
      exitCode = $exitCode
    }
    Remove-Item -LiteralPath $stopFlagPath -Force
    break
  }

  Write-ServiceLog "ReAgent server exited with code $exitCode. Restarting in $restartDelaySeconds second(s)."
  Save-RunnerState @{
    status = "restarting"
    pid = $null
    exitCode = $exitCode
  }
  Start-Sleep -Seconds $restartDelaySeconds
}
