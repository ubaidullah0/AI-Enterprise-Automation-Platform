# ============================================================
# AI Enterprise Platform — Start Script
# Run this from the project root before starting the servers
# ============================================================

Write-Host ""
Write-Host "  AI Enterprise Automation Platform" -ForegroundColor Cyan
Write-Host "  Clearing stale node processes..." -ForegroundColor Gray

# Kill any stale node processes holding ports
Get-Process -Name "node" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2

# Verify ports are free
$busy = Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue | Where-Object { $_.LocalPort -in @(4000,5173,5174,5175) }
if ($busy) {
    Write-Host "  WARNING: Some ports still busy. Retrying..." -ForegroundColor Yellow
    $busy | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }
    Start-Sleep -Seconds 2
}

Write-Host "  Ports cleared. You can now start your servers:" -ForegroundColor Green
Write-Host ""
Write-Host "  Terminal 1 (Backend):" -ForegroundColor Yellow
Write-Host "    cd apps\backend" -ForegroundColor White
Write-Host "    npm run dev" -ForegroundColor White
Write-Host ""
Write-Host "  Terminal 2 (Frontend):" -ForegroundColor Yellow
Write-Host "    cd apps\frontend" -ForegroundColor White
Write-Host "    npm run dev" -ForegroundColor White
Write-Host ""
Write-Host "  Then open: http://localhost:5174" -ForegroundColor Cyan
Write-Host "  Login: obaidkhan13542@gmail.com / Admin@1234" -ForegroundColor Cyan
Write-Host ""
