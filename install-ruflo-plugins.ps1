# PowerShell script to install Ruflo plugins
# Windows-friendly alternative to bash script

Write-Host "Installing 13 Ruflo Plugins (PowerShell)" -ForegroundColor Green
Write-Host "=========================================" -ForegroundColor Green
Write-Host ""

$plugins = @(
    # Memory & Knowledge (3)
    "ruflo-agentdb",
    "ruflo-rag-memory",
    "ruflo-intelligence",
    # Orchestration (4)
    "ruflo-swarm",
    "ruflo-autopilot",
    "ruflo-goals",
    "ruflo-workflows",
    # Code Quality (4)
    "ruflo-testgen",
    "ruflo-docs",
    "ruflo-security-audit",
    "ruflo-observability",
    # Enterprise (2)
    "ruflo-federation",
    "ruflo-cost-tracker"
)

$count = 1
foreach ($plugin in $plugins) {
    Write-Host "$count/13: Installing $plugin..." -ForegroundColor Cyan

    # Try global ruflo command first, fall back to npx
    $result = & {
        $ErrorActionPreference = "SilentlyContinue"
        ruflo plugins install -n $plugin 2>&1
    }

    if ($LASTEXITCODE -ne 0) {
        Write-Host "Trying with npx..." -ForegroundColor Yellow
        npx ruflo@latest plugins install -n $plugin 2>&1
    }

    Start-Sleep -Seconds 2
    $count++
}

Write-Host ""
Write-Host "=========================================" -ForegroundColor Green
Write-Host "Plugin installation attempt complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Running final Ruflo setup..." -ForegroundColor Cyan
Write-Host ""

# Re-bootstrap intelligence
Write-Host "Step 1: Re-bootstrapping Ruflo intelligence..." -ForegroundColor Cyan
npx ruflo@latest hooks pretrain --depth deep 2>&1 | Select-Object -Last 10

Write-Host ""
Write-Host "Step 2: Verifying installation..." -ForegroundColor Cyan
npx ruflo@latest init --doctor 2>&1 | Select-Object -Last 15

Write-Host ""
Write-Host "=========================================" -ForegroundColor Green
Write-Host "✅ Ruflo setup complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Ready to use:" -ForegroundColor Cyan
Write-Host "  /phase-builder          - Spawn parallel agent team" -ForegroundColor White
Write-Host "  /swarm spawn            - Spawn specialized agent" -ForegroundColor White
Write-Host "  /agentdb search         - Search shared agent memory" -ForegroundColor White
Write-Host "  /memory save-result     - Export insights to memory" -ForegroundColor White
