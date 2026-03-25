# Kill the process(es) listening on TCP port 3001
# Usage: .\scripts\kill-port-3001.ps1

Get-NetTCPConnection -LocalPort 3001 -ErrorAction SilentlyContinue |
  Select-Object -Unique OwningProcess |
  ForEach-Object { 
    if ($_.OwningProcess -and $_.OwningProcess -ne 0) {
      Write-Host "Stopping PID $($_.OwningProcess) on port 3001"
      taskkill /PID $_.OwningProcess /F /T
    }
  }

Write-Host "Done. Verify with: Get-NetTCPConnection -LocalPort 3001 -ErrorAction SilentlyContinue"