$ErrorActionPreference = "Stop"

function Test-Endpoint {
    param($Url, $ExpectedPattern, $CheckRedirectTo)
    Write-Host "Testing $Url ..." -NoNewline
    
    try {
        $response = Invoke-WebRequest -Uri $Url -Method Get -AllowUnencrypted
        
        if ($response.StatusCode -eq 200) {
            Write-Host " [OK] (200)" -ForegroundColor Green
            
            if ($ExpectedPattern -and $response.Content -match $ExpectedPattern) {
                Write-Host "  -> Content Match: Found '$ExpectedPattern'" -ForegroundColor Green
            } elseif ($ExpectedPattern) {
                Write-Host "  -> Content Mismatch: '$ExpectedPattern' NOT found" -ForegroundColor Red
            }

            if ($CheckRedirectTo) {
                 # Compare final URI
                 $finalUri = $response.BaseResponse.ResponseUri.AbsoluteUri
                 if ($finalUri -match $CheckRedirectTo) {
                     Write-Host "  -> Redirect Verified: Ends with '$CheckRedirectTo'" -ForegroundColor Green
                 } else {
                     Write-Host "  -> Redirect Failed: Got '$finalUri', expected '$CheckRedirectTo'" -ForegroundColor Red
                 }
            }

        } else {
             Write-Host " [FAIL] StatusCode: $($response.StatusCode)" -ForegroundColor Red
        }
    } catch {
        Write-Host " [ERROR] $_" -ForegroundColor Red
    }
}

Write-Host "`n--- Phase 10 Routing Verification ---`n"

$BaseUrl = "http://localhost:3000"

# 1. Test Portfolio Registry
Test-Endpoint -Url "$BaseUrl/saas" -ExpectedPattern "Drako"
Test-Endpoint -Url "$BaseUrl/saas" -ExpectedPattern "MentorIA"

# 2. Test Slug Access
Test-Endpoint -Url "$BaseUrl/saas/drako" -ExpectedPattern "Drako"
Test-Endpoint -Url "$BaseUrl/saas/mentoria" -ExpectedPattern "MentorIA"

# 3. Test Legacy Redirection
# Assumes 'saas-drako-core' is the ID for slug 'drako'
Test-Endpoint -Url "$BaseUrl/saas/saas-drako-core" -CheckRedirectTo "/saas/drako"

Write-Host "`nDone."
