# Kill the process(es) listening on TCP port 3001
# Usage: .\scripts\kill-port-3001.ps1

$port = 3001
$connections = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
if (!$connections) {
    Write-Host "No process is listening on port $port."
    return
}

$uniquePids = $connections | Select-Object -Unique OwningProcess | Where-Object { $_.OwningProcess -and $_.OwningProcess -ne 0 }
if (!$uniquePids) {
    Write-Host "No valid PIDs found on port $port."
    return
}

foreach ($entry in $uniquePids) {
    $pid = $entry.OwningProcess
    Write-Host "Stopping PID $pid on port $port..."
    taskkill /PID $pid /F /T
}

Write-Host "Done. Verify with: Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue"