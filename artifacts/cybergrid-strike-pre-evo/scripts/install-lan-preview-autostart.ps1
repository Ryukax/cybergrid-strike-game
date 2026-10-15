[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'

$watchdogPath = Join-Path $PSScriptRoot 'keep-lan-preview-running.ps1'
if (-not (Test-Path -LiteralPath $watchdogPath)) {
  throw "Preview watchdog is missing: $watchdogPath"
}

$runKey = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run'
$runValueName = 'CyberGridStrikeLanPreview'
$escapedPath = $watchdogPath.Replace('"', '""')
$runCommand = "powershell.exe -NoLogo -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$escapedPath`""

New-Item -Path $runKey -Force | Out-Null
New-ItemProperty -Path $runKey -Name $runValueName -Value $runCommand -PropertyType String -Force | Out-Null

Start-Process -FilePath 'powershell.exe' -ArgumentList @(
    '-NoLogo',
    '-NoProfile',
    '-WindowStyle', 'Hidden',
    '-ExecutionPolicy', 'Bypass',
    '-File', "`"$watchdogPath`""
  ) `
  -WindowStyle Hidden

Write-Output 'CyberGrid Strike LAN preview autostart is installed and running.'
Write-Output "Startup command: $runCommand"
