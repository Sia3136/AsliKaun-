$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $projectRoot

Write-Host 'Starting AsliKaun backend on http://127.0.0.1:8000 ...'
$backend = Start-Process -FilePath 'python' -ArgumentList 'run_server.py' -WorkingDirectory $projectRoot -PassThru

$mobileApp = $null
try {
    $ready = $false
    for ($attempt = 0; $attempt -lt 30; $attempt++) {
        Start-Sleep -Seconds 1
        try {
            Invoke-WebRequest -Uri 'http://127.0.0.1:8000/docs' -UseBasicParsing -TimeoutSec 2 | Out-Null
            $ready = $true
            break
        } catch {
            if ($backend.HasExited) { throw 'Backend exited before becoming ready.' }
        }
    }
    if (-not $ready) { throw 'Backend did not become ready within 30 seconds.' }

    # Previously this script never started the driver mobile app, so its
    # "Driver app" button in the admin dashboard pointed at an unused
    # port (8443) with nothing listening — it looked broken even though
    # the app itself works fine once actually launched. Starting it here
    # too so one script brings up everything live.
    Write-Host 'Backend is ready. Starting driver app on http://localhost:8443 ...'
    $mobileApp = Start-Process -FilePath 'npm' -ArgumentList '--prefix', 'frontend/mobile-app', 'run', 'dev' -WorkingDirectory $projectRoot -PassThru -WindowStyle Hidden

    Write-Host 'Starting admin dashboard on http://localhost:3000 ...'
    npm --prefix frontend run dev -- --host 0.0.0.0
} finally {
    if ($backend -and -not $backend.HasExited) {
        Stop-Process -Id $backend.Id -Force
    }
    if ($mobileApp -and -not $mobileApp.HasExited) {
        Stop-Process -Id $mobileApp.Id -Force
    }
}
