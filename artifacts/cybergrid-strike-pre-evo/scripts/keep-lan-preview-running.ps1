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
$linkPath = Join-Path $stateRoot 'current-link.txt'
$probeUrl = "http://127.0.0.1:$Port$BasePath"
$lastPublishedUrl = $null
$lastNetworkCheckAt = [DateTime]::MinValue

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

function Publish-LanPreviewUrl {
  try {
    $configuration = Get-NetIPConfiguration -ErrorAction Stop |
      Where-Object {
        $_.IPv4DefaultGateway -and
        $_.NetAdapter.Status -eq 'Up' -and
        $_.IPv4Address
      } |
      Sort-Object InterfaceMetric |
      Select-Object -First 1
    $address = $configuration.IPv4Address |
      Where-Object { $_.IPAddress -notlike '169.254.*' } |
      Select-Object -First 1 -ExpandProperty IPAddress
    if (-not $address) {
      return
    }

    $lanUrl = "http://${address}:$Port$BasePath"
    Set-Content -LiteralPath $linkPath -Value $lanUrl -Encoding utf8
    if ($script:lastPublishedUrl -ne $lanUrl) {
      Write-PreviewLog "Phone / Safari link: $lanUrl"
      $script:lastPublishedUrl = $lanUrl
    }
  }
  catch {
    Write-PreviewLog "Could not resolve the current LAN address: $($_.Exception.Message)"
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
  Publish-LanPreviewUrl

  while ($true) {
    $now = Get-Date
    if (($now - $lastNetworkCheckAt).TotalSeconds -ge 30) {
      Publish-LanPreviewUrl
      $lastNetworkCheckAt = $now
    }

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
        # Vite's development client follows Vite's own modern browser floor and
        # can fail before the game bundle runs on older iOS Safari. Serve the
        # Safari-targeted production bundle on the phone/LAN port instead.
        Write-PreviewLog 'Building Safari-compatible phone bundle.'
        $previousErrorActionPreference = $ErrorActionPreference
        $ErrorActionPreference = 'Continue'
        try {
          & $pnpm run build 2>&1 | ForEach-Object {
            Add-Content -LiteralPath $logPath -Value ([string]$_)
          }
          $buildExitCode = $LASTEXITCODE
        }
        finally {
          $ErrorActionPreference = $previousErrorActionPreference
        }
        if ($buildExitCode -ne 0) {
          throw "Production build exited with code $buildExitCode."
        }

        Write-PreviewLog "Launching Safari-compatible CyberGrid Strike at $probeUrl"
        $ErrorActionPreference = 'Continue'
        try {
          & $pnpm run serve 2>&1 | ForEach-Object {
            Add-Content -LiteralPath $logPath -Value ([string]$_)
          }
          $previewExitCode = $LASTEXITCODE
        }
        finally {
          $ErrorActionPreference = $previousErrorActionPreference
        }
        Write-PreviewLog "Preview process exited with code $previewExitCode; restarting."
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
