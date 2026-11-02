$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $projectRoot

Write-Host 'Starting AsliKaun backend on http://127.0.0.1:8000 ...'
$backend = Start-Process -FilePath 'python' -ArgumentList 'run_server.py' -WorkingDirectory $projectRoot -PassThru

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

    Write-Host 'Backend is ready. Starting frontend on http://localhost:3000 ...'
    npm --prefix frontend run dev -- --host 0.0.0.0
} finally {
    if ($backend -and -not $backend.HasExited) {
        Stop-Process -Id $backend.Id -Force
    }
}
