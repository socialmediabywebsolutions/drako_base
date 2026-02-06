# Usage: powershell -File scripts/infinity-tail-worker.ps1
# Fix: Force Worker context to avoid Pages error

npx wrangler tail --cwd workers/autopilot-worker --format=pretty

$WorkerRoot = "workers/autopilot-worker"

Write-Host "🔍 [INFINITY] Starting tail for autopilot-worker..."
npx wrangler tail --cwd $WorkerRoot
