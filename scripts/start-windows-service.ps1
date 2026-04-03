param(
  [string]$TaskName = "ReAgent"
)

$ErrorActionPreference = "Stop"

Start-ScheduledTask -TaskName $TaskName
Write-Host "Started ReAgent Windows task: $TaskName"
