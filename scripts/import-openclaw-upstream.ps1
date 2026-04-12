param(
  [string]$SourcePath = "E:\Internship\program\openclaw"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Assert-PathWithin {
  param(
    [string]$ParentPath,
    [string]$ChildPath,
    [string]$Label
  )

  $parent = [System.IO.Path]::GetFullPath($ParentPath).TrimEnd("\")
  $child = [System.IO.Path]::GetFullPath($ChildPath).TrimEnd("\")
  if (-not $child.StartsWith($parent, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "$Label path '$child' is outside '$parent'."
  }
}

$repoRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot ".."))
$sourceRoot = [System.IO.Path]::GetFullPath($SourcePath)
$upstreamRoot = Join-Path $repoRoot "upstream"
$destRoot = Join-Path $upstreamRoot "openclaw"

if (-not (Test-Path -LiteralPath $sourceRoot -PathType Container)) {
  throw "OpenClaw source directory not found: $sourceRoot"
}

if (-not (Test-Path -LiteralPath (Join-Path $sourceRoot "package.json") -PathType Leaf)) {
  throw "OpenClaw source directory is missing package.json: $sourceRoot"
}

if (-not (Test-Path -LiteralPath (Join-Path $sourceRoot "openclaw.mjs") -PathType Leaf)) {
  throw "OpenClaw source directory is missing openclaw.mjs: $sourceRoot"
}

Assert-PathWithin -ParentPath $repoRoot -ChildPath $destRoot -Label "Destination"

New-Item -ItemType Directory -Path $upstreamRoot -Force | Out-Null

if (Test-Path -LiteralPath $destRoot) {
  Remove-Item -LiteralPath $destRoot -Recurse -Force
}

New-Item -ItemType Directory -Path $destRoot -Force | Out-Null

$excludedTopLevelNames = @(".git", "node_modules", ".agents", ".vscode", ".pi")
$excludedRelativePaths = @(
  "apps/ios",
  "apps/macos",
  "apps/shared/OpenClawKit",
  "Swabble"
)

Get-ChildItem -LiteralPath $sourceRoot -Force | ForEach-Object {
  if ($excludedTopLevelNames -contains $_.Name) {
    return
  }

  Copy-Item -LiteralPath $_.FullName -Destination $destRoot -Recurse -Force
}

$excludedRelativePaths | ForEach-Object {
  $relativePath = $_
  $targetPath = Join-Path $destRoot $relativePath
  Assert-PathWithin -ParentPath $destRoot -ChildPath $targetPath -Label "Excluded destination"
  if (Test-Path -LiteralPath $targetPath) {
    Remove-Item -LiteralPath $targetPath -Recurse -Force
  }
}

$commit = (& git -C $sourceRoot rev-parse HEAD).Trim()
$trackedFileCount = [int]((& git -C $sourceRoot ls-files | Measure-Object).Count)
$extensionCount = if (Test-Path -LiteralPath (Join-Path $destRoot "extensions") -PathType Container) {
  [int]((Get-ChildItem -LiteralPath (Join-Path $destRoot "extensions") -Directory | Measure-Object).Count)
} else {
  0
}

$metadata = [ordered]@{
  importedAt = (Get-Date).ToString("o")
  sourcePath = $sourceRoot
  sourceCommit = $commit
  trackedFileCount = $trackedFileCount
  extensionCount = $extensionCount
  destinationPath = $destRoot
  excludedTopLevelNames = $excludedTopLevelNames
  excludedRelativePaths = $excludedRelativePaths
}

$metadataPath = Join-Path $destRoot ".reagent-import.json"
$metadata | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $metadataPath -Encoding UTF8

Write-Host "Imported OpenClaw sources"
Write-Host "Source: $sourceRoot"
Write-Host "Destination: $destRoot"
Write-Host "Commit: $commit"
Write-Host "Tracked files: $trackedFileCount"
Write-Host "Extensions: $extensionCount"
