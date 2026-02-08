
Write-Host "🚀 Running Phase 13 Export Verification..." -ForegroundColor Cyan

# Check if server is running (optional but good practice)
# Test-NetConnection -ComputerName localhost -Port 3000

# Run the TypeScript verification script
# We use npx tsx to execute it directly without compilation step if tsx is available
npx tsx scripts/verify-export.ts

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Verification Passed!" -ForegroundColor Green
} else {
    Write-Host "❌ Verification Failed. Ensure local server is running on port 3000." -ForegroundColor Red
}
