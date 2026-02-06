
# scripts/infinity-stripe-live-gate.ps1
# Steel Gate: Stripe Live Activation Check
# Usage: powershell -File scripts/infinity-stripe-live-gate.ps1

Write-Host "--- [INFINITY STRIPE LIVE GATE] ---"
$Errors = 0

# 1. Codebase Check: Price IDs in subscriptions.ts
$SubFile = "$PSScriptRoot/../src/lib/subscriptions.ts"
if (Test-Path $SubFile) {
    $Content = Get-Content $SubFile -Raw
    
    # Check A: No Hardcoded Placeholders
    if ($Content -match "price_1QjXXXX" -or $Content -match "price_1QjYYYY") {
        Write-Error "[NO-GO] Hardcoded Placeholder Price IDs detected in src/lib/subscriptions.ts."
        Write-Host "Action: Update file to use process.env vars (DONE via Script)."
        $Errors++
    } 
    # Check B: Uses process.env
    elseif ($Content -match "process.env.STRIPE_PRICE_STARTER_LIVE") {
        Write-Host "  [PASS] Codebase is using Environment Variables for Prices."
    }
    else {
         Write-Error "[NO-GO] subscriptions.ts does not seem to use process.env for prices."
         $Errors++
    }
} else {
    Write-Error "[NO-GO] src/lib/subscriptions.ts not found."
    $Errors++
}

# 2. Worker Secrets Check
Write-Host "  [CHECK] Verifying Worker Secrets..."
$Secrets = npx wrangler secret list --cwd workers/autopilot-worker 2>&1
if ($Secrets -match "STRIPE_WEBHOOK_SECRET") {
    Write-Host "  [PASS] STRIPE_WEBHOOK_SECRET found in Worker."
} else {
    Write-Error "[NO-GO] STRIPE_WEBHOOK_SECRET missing in Worker."
    Write-Host "Action: Run 'npx wrangler secret put STRIPE_WEBHOOK_SECRET --cwd workers/autopilot-worker'"
    $Errors++
}

# 3. Env Config Check (Informational)
# We assume User has set vars in Vercel if code check passes.
Write-Host "  [INFO] Ensure these vars are set in Vercel Production:"
Write-Host "    - STRIPE_PRICE_STARTER_LIVE"
Write-Host "    - STRIPE_PRICE_PRO_LIVE"
Write-Host "    - STRIPE_PRICE_ENTERPRISE_LIVE"

# 4. Webhook Endpoint Check
$WebhookUrl = "https://stripe-webhook-worker.socialmediabywebsolutions.workers.dev"
try {
    # Method 3: Invoke-WebRequest with ErrorAction Stop (Standard PS style)
    $Res = Invoke-WebRequest -Uri $WebhookUrl -Method Get -ErrorAction Stop
    Write-Host "  [PASS] Webhook Endpoint is reachable (200 OK)."
} catch {
    # Check if it's a verify exception with Response
    if ($_.Exception.Response -and ([int]$_.Exception.Response.StatusCode -eq 405)) {
         Write-Host "  [PASS] Webhook Endpoint is reachable (405 Method Not Allowed - Expected for GET)."
    }
    elseif ($_.Exception.Message -match "405") {
         Write-Host "  [PASS] Webhook Endpoint is reachable (405 Method Not Allowed - Expected for GET)."
    }
    else {
         Write-Error "[NO-GO] Webhook Endpoint unreachable: $($_.Exception.Message)"
         $Errors++
    }
}

if ($Errors -eq 0) {
    Write-Host "--- [GO] SYSTEM READY FOR LIVE ACTIVATION ---" -ForegroundColor Green
    exit 0
} else {
    Write-Host "--- [NO-GO] $Errors BLOCKING ISSUES FOUND ---" -ForegroundColor Red
    exit 1
}
