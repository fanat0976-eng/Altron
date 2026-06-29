# Altron Installer Script
# Usage: .\install.ps1

$ErrorActionPreference = "Stop"

Write-Host "=== Altron AI Gateway Installer ===" -ForegroundColor Cyan
Write-Host ""

# Check Node.js
try {
    $nodeVersion = node --version
    Write-Host "[OK] Node.js $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "[ERROR] Node.js not found. Install from https://nodejs.org" -ForegroundColor Red
    exit 1
}

# Check npm
try {
    $npmVersion = npm --version
    Write-Host "[OK] npm $npmVersion" -ForegroundColor Green
} catch {
    Write-Host "[ERROR] npm not found" -ForegroundColor Red
    exit 1
}

# Check Rust (for Tauri)
$hasRust = $false
try {
    $rustVersion = rustc --version
    Write-Host "[OK] Rust $rustVersion" -ForegroundColor Green
    $hasRust = $true
} catch {
    Write-Host "[WARN] Rust not found (optional for Tauri desktop app)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Installing dependencies..." -ForegroundColor Cyan

# Install backend dependencies
Write-Host "  Backend..." -ForegroundColor Gray
npm install

# Install frontend dependencies
Write-Host "  Frontend..." -ForegroundColor Gray
Push-Location ui
npm install
Pop-Location

Write-Host ""
Write-Host "Building frontend..." -ForegroundColor Cyan
Push-Location ui
npm run build
Pop-Location

Write-Host ""
Write-Host "=== Installation Complete ===" -ForegroundColor Green
Write-Host ""
Write-Host "To start Altron:" -ForegroundColor Cyan
Write-Host "  Backend:  npm run dev" -ForegroundColor White
Write-Host "  Frontend: cd ui && npm run dev" -ForegroundColor White
Write-Host "  Desktop:  cd ui && npm run tauri:dev" -ForegroundColor White
Write-Host ""
Write-Host "API:" -ForegroundColor Cyan
Write-Host "  HTTP: http://localhost:3000" -ForegroundColor White
Write-Host "  WS:   ws://localhost:3000/ws" -ForegroundColor White
Write-Host "  MCP:  http://localhost:3001" -ForegroundColor White
