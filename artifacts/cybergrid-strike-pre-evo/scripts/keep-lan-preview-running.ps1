[CmdletBinding()]
param(
  [int]$Port = 5174,
  [string]$BasePath = '/cybergrid-strike-pre-evo/'
)

$ErrorActionPreference = 'Stop'

$createdNew = $false
$mutex = [System.Threading.Mutex]::new(
  $true,
  'Local\CyberGridStrikeLanPreview',
  [ref]$createdNew
)

if (-not $createdNew) {
  exit 0
}

$projectRoot = Split-Path -Parent $PSScriptRoot
$stateRoot = Join-Path $env:LOCALAPPDATA 'CyberGridStrikePreview'
$logPath = Join-Path $stateRoot 'server.log'
$probeUrl = "http://127.0.0.1:$Port$BasePath"

New-Item -ItemType Directory -Path $stateRoot -Force | Out-Null

if ((Test-Path -LiteralPath $logPath) -and
    (Get-Item -LiteralPath $logPath).Length -gt 5MB) {
  Move-Item -LiteralPath $logPath -Destination "$logPath.previous" -Force
}

function Write-PreviewLog {
  param([string]$Message)

  $timestamp = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
  Add-Content -LiteralPath $logPath -Value "[$timestamp] $Message"
}

function Test-PreviewReady {
  try {
    $response = Invoke-WebRequest -UseBasicParsing -Uri $probeUrl -TimeoutSec 2
    return $response.StatusCode -ge 200 -and $response.StatusCode -lt 400
  }
  catch {
    return $false
  }
}

function Resolve-Pnpm {
  $bundledPnpm = Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\bin\fallback\pnpm.cmd'

  if (Test-Path -LiteralPath $bundledPnpm) {
    return $bundledPnpm
  }

  $command = Get-Command pnpm.cmd -ErrorAction SilentlyContinue
  if ($command) {
    return $command.Source
  }

  throw 'pnpm.cmd could not be found.'
}

function Add-BundledNodeToPath {
  $bundledNode = Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin'

  if (Test-Path -LiteralPath $bundledNode) {
    $env:Path = "$bundledNode;$env:Path"
  }
}

try {
  Write-PreviewLog 'Preview watchdog started.'

  while ($true) {
    if (Test-PreviewReady) {
      Start-Sleep -Seconds 5
      continue
    }

    $listener = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue

    if ($listener) {
      Write-PreviewLog "Port $Port is occupied by another process; retrying."
      Start-Sleep -Seconds 15
      continue
    }

    try {
      Add-BundledNodeToPath
      $pnpm = Resolve-Pnpm
      $env:PORT = [string]$Port
      $env:BASE_PATH = $BasePath

      Push-Location $projectRoot
      try {
        Write-PreviewLog "Launching CyberGrid Strike at $probeUrl"
        & $pnpm run dev 2>&1 | ForEach-Object {
          Add-Content -LiteralPath $logPath -Value ([string]$_)
        }
        Write-PreviewLog "Preview process exited with code $LASTEXITCODE; restarting."
      }
      finally {
        Pop-Location
      }
    }
    catch {
      Write-PreviewLog "Launch failed: $($_.Exception.Message)"
    }

    Start-Sleep -Seconds 3
  }
}
finally {
  if ($createdNew) {
    $mutex.ReleaseMutex()
  }
  $mutex.Dispose()
}
