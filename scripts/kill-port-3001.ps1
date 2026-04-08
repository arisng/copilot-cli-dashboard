param(
    [Parameter(Position = 0)]
    [ValidateScript({ $_ -ge 1 -and $_ -le 65535 })]
    [int]$Port = 3001
)

# Kill the process(es) listening on TCP port $Port
# Usage: .\scripts\kill-port-3001.ps1 [<port>]

Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue |
  Select-Object -Unique OwningProcess |
  ForEach-Object {
    if ($_.OwningProcess -and $_.OwningProcess -ne 0) {
      Write-Host "Stopping PID $($_.OwningProcess) on port $Port"
      taskkill /PID $_.OwningProcess /F /T
    }
  }

Write-Host "Done. Verify with: Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue"