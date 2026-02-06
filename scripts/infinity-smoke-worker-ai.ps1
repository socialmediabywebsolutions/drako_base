
# scripts/infinity-smoke-worker-ai.ps1
# Executes a Steel-compliant smoke test against the AI Router
# Usage: powershell -File scripts/infinity-smoke-worker-ai.ps1

# Auto-Discovery of Worker URL (Fallbacks to Production)
$WorkerUrl = "https://autopilot-worker.socialmediabywebsolutions.workers.dev"
if ($env:WORKER_URL) { $WorkerUrl = $env:WORKER_URL }

$Route = "/internal/ai/run"
$Endpoint = "$WorkerUrl$Route"

# Steel Perfect: Secret Segregation
$BearerSecret = "be00df1c61b30cf365f90b909bc9663205ef12032fee8c9300fa6b817edd840d"
$OriginSecret = "998877665544332211aabbccddeeff00112233445566778899aabbccddeeff00" 

# Generate Correlation ID
$CorrelationId = [guid]::NewGuid().ToString()

# Define Headers as Hashtable
$Headers = @{
    "Authorization"           = "Bearer $BearerSecret"
    "X-Drako-Origin-Secret"   = "$OriginSecret"
    "X-Drako-Correlation-Id"  = "$CorrelationId" # Matching Worker expectation (was X-Drako-Correlation)
}

# Define Payload
$Body = @{
    tenantId = "smoke_tenant_v1"
    messages = @(
        @{ role = "user"; content = "Hello! Who are you?" }
    )
} | ConvertTo-Json -Depth 5

Write-Host "[SMOKE] Target: $Endpoint"
Write-Host "[SMOKE] Correlation ID: $CorrelationId"
Write-Host "[SMOKE] Label: infinity_smoke_$(Get-Date -Format 'yyyyMMdd_HHmmss')"

try {
    # Invoke-RestMethod for native PowerShell HTTP 
    $Response = Invoke-RestMethod -Uri $Endpoint -Method Post -Headers $Headers -Body $Body -ContentType "application/json"
    
    if ($Response.ok -eq $true) {
         Write-Host "[SMOKE] Success."
         # Output the correlation ID clearly so the orchestrator can capture it
         Write-Host "RESULT_CORRELATION_ID=$CorrelationId"
         # Dump response cleanly
         $Response | ConvertTo-Json -Depth 4
         exit 0
    } else {
         Write-Host "[SMOKE] Failed: Response returned ok=false"
         $Response | ConvertTo-Json -Depth 4
         exit 1
    }
}
catch {
    Write-Host "[SMOKE] Failed: Exception Encountered"
    Write-Error $_
    exit 1
}
