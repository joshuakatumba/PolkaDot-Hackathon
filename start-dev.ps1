# SmartSave Dev Stack Launcher
# Run this script from the AutoTreasury root folder.
# It will: kill old node processes, start Hardhat, deploy contracts,
# update backend .env, and start the backend server.

Write-Host "`n[START] Cleaning up stale node processes..." -ForegroundColor Yellow
Get-Process -Name node -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Seconds 1
Write-Host "[OK] Done." -ForegroundColor Green

# 1. Start Hardhat node in a new window
Write-Host "`n[1/4] Starting Hardhat node on port 8545..." -ForegroundColor Yellow
$hardhat = Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot\contracts'; npx.cmd hardhat node" -PassThru
Write-Host "[OK] Hardhat node started (PID $($hardhat.Id)). Waiting for it to boot..." -ForegroundColor Green
Start-Sleep -Seconds 5

# 2. Deploy contracts
Write-Host "`n[2/4] Deploying contracts to local node..." -ForegroundColor Yellow
Set-Location "$PSScriptRoot\contracts"
npx.cmd hardhat run scripts/deploy.js --network localhost
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Deployment failed. Is the Hardhat node running?" -ForegroundColor Red
    exit 1
}
Write-Host "[OK] Contracts deployed." -ForegroundColor Green

# 3. Read deployed.json and update backend .env
Write-Host "`n[3/4] Updating backend .env with new contract addresses..." -ForegroundColor Yellow
$deployed = Get-Content "$PSScriptRoot\contracts\deployed.json" | ConvertFrom-Json
$envPath = "$PSScriptRoot\backend\.env"
$envContent = Get-Content $envPath -Raw
$envContent = $envContent -replace 'VAULT_ADDRESS=.*', "VAULT_ADDRESS=$($deployed.AutoTreasury)"
$envContent = $envContent -replace 'ROUTER_ADDRESS=.*', "ROUTER_ADDRESS=$($deployed.XCMRouter)"
$envContent = $envContent -replace 'STAKING_STRATEGY_ADDRESS=.*', "STAKING_STRATEGY_ADDRESS=$($deployed.NativeStakingStrategy)"
$envContent = $envContent -replace 'LENDING_STRATEGY_ADDRESS=.*', "LENDING_STRATEGY_ADDRESS=$($deployed.AssetHubLendingStrategy)"
$envContent = $envContent -replace 'DOT_ADDRESS=.*', "DOT_ADDRESS=$($deployed.MockDOT)"
$envContent = $envContent -replace 'USDC_ADDRESS=.*', "USDC_ADDRESS=$($deployed.MockUSDC)"
$envContent | Set-Content $envPath -NoNewline
Write-Host "[OK] .env updated:" -ForegroundColor Green
Write-Host "     AutoTreasury: $($deployed.AutoTreasury)"
Write-Host "     NativeStaking: $($deployed.NativeStakingStrategy)"
Write-Host "     LendingStrategy: $($deployed.AssetHubLendingStrategy)"

# 4. Also copy latest ABI to backend
Write-Host "`n[3b] Syncing ABI to backend..." -ForegroundColor Yellow
Copy-Item "$PSScriptRoot\contracts\artifacts\src\AutoTreasury.sol\AutoTreasury.json" "$PSScriptRoot\backend\src\abi\AutoTreasury.json" -Force
Write-Host "[OK] ABI synced." -ForegroundColor Green

# 5. Start backend in a new window
Write-Host "`n[4/4] Starting backend server on port 3001..." -ForegroundColor Yellow
$backend = Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot\backend'; npm.cmd run start" -PassThru
Write-Host "[OK] Backend started (PID $($backend.Id))." -ForegroundColor Green

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  DEV STACK RUNNING" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Hardhat Node:  http://127.0.0.1:8545"
Write-Host "  Backend API:   http://localhost:3001/api/vault/stats"
Write-Host "  Frontend:      http://localhost:3000"
Write-Host ""
Write-Host "  Frontend must be started separately:"
Write-Host "  cd frontend && npm.cmd run dev"
Write-Host "========================================`n" -ForegroundColor Cyan

Set-Location $PSScriptRoot
