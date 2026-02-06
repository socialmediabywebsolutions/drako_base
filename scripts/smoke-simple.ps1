$Url = "https://autopilot-worker.socialmediabywebsolutions.workers.dev/internal/ai/run"
$Headers = @{
    "Authorization"          = "Bearer be00df1c61b30cf365f90b909bc9663205ef12032fee8c9300fa6b817edd840d"
    "X-Drako-Origin-Secret"  = "be00df1c61b30cf365f90b909bc9663205ef12032fee8c9300fa6b817edd840d"
    "x-drako-correlation-id" = "infinity_smoke_mock_v2"
}
$Body = @{
    messages = @(
        @{ role = "user"; content = "Hi" }
    )
    taskType = "smoke_test"
    mode     = "fast"
} | ConvertTo-Json
Invoke-RestMethod -Uri $Url -Method Post -Headers $Headers -Body $Body -ContentType "application/json"
