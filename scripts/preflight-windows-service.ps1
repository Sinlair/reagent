param(
  [switch]$RequireAdmin
)

$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Split-Path -Parent $scriptDir
$serviceRoot = Join-Path $repoRoot "workspace\service"
$runnerScript = Join-Path $scriptDir "reagent-service-runner.ps1"
$configPath = Join-Path $serviceRoot "windows-service.json"
$envPath = Join-Path $repoRoot ".env"
$entryScript = Join-Path $repoRoot "dist\server.js"

$issues = [System.Collections.Generic.List[string]]::new()
$checks = [ordered]@{}

function Test-IsAdministrator {
  $currentIdentity = [Security.Principal.WindowsIdentity]::GetCurrent()
  $principal = [Security.Principal.WindowsPrincipal]::new($currentIdentity)
  return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

$checks.repoRoot = $repoRoot
$checks.envExists = Test-Path -LiteralPath $envPath
$checks.distExists = Test-Path -LiteralPath $entryScript
$checks.runnerExists = Test-Path -LiteralPath $runnerScript
$checks.serviceConfigExists = Test-Path -LiteralPath $configPath
$checks.isAdministrator = Test-IsAdministrator

try {
  $nodeCommand = Get-Command node -ErrorAction Stop
  $checks.nodeExe = $nodeCommand.Source
  $checks.nodeVersion = (& $nodeCommand.Source --version)
} catch {
  $issues.Add("Node.js was not found in PATH.")
}

if (-not $checks.envExists) {
  $issues.Add("Missing .env in repo root.")
}
if (-not $checks.distExists) {
  $issues.Add("Missing dist/server.js. Run npm.cmd run build first.")
}
if (-not $checks.runnerExists) {
  $issues.Add("Missing scripts/reagent-service-runner.ps1.")
}
if ($RequireAdmin -and -not $checks.isAdministrator) {
  $issues.Add("This command must run in an elevated PowerShell window.")
}

$result = [ordered]@{
  ok = ($issues.Count -eq 0)
  issues = @($issues)
  checks = $checks
}

$result | ConvertTo-Json -Depth 6

if ($issues.Count -gt 0) {
  exit 1
}
