# scripts/infinity-audit-check.ps1
# Verifies D1 audit logs for AI Router

Write-Host "[INFINITY] Checking D1 Audit Logs (DRACO_DB)..."

$CountQuery = "SELECT COUNT(*) as total FROM ai_request_audits WHERE correlation_id LIKE 'infinity_smoke%';"
$LatestQuery = "SELECT correlation_id, status, provider, model, latency_ms, error_code, created_at FROM ai_request_audits ORDER BY created_at DESC LIMIT 5;"

Write-Host "[INFINITY] Audit Count:"
npx wrangler d1 execute DRACO_DB --remote --command "$CountQuery"

Write-Host "[INFINITY] Latest 5 Smoke Audits:"
npx wrangler d1 execute DRACO_DB --remote --command "$LatestQuery"
