# AI Orchestrator Runbook

## Objetivo
Gobernar el uso del endpoint `/api/orchestrator` con cuotas, rate limits y circuit breaker sin exponer prompts ni datos sensibles.

## Variables de entorno
- `DRACO_AI_RATE_LIMIT_ENABLED` (default: true)
- `DRACO_AI_RPM_PER_TENANT` (default: 60)
- `DRACO_AI_RPM_PER_SAAS` (default: 30)
- `DRACO_AI_MONTHLY_TOKENS_SOFT` (default: 200000)
- `DRACO_AI_MONTHLY_TOKENS_HARD` (default: 300000)
- `DRACO_AI_CB_FAILURE_THRESHOLD` (default: 5)
- `DRACO_AI_CB_COOLDOWN_SECONDS` (default: 300)
- `DRACO_AI_CB_HALF_OPEN_TRIALS` (default: 2)

## D1: tablas relevantes
- `ai_usage_counters`: contadores mensuales por tenant/saas.
- `ai_rate_limit_buckets`: buckets por ventana de rate limit.
- `ai_circuit_breakers`: estado del breaker por tenant/saas/proveedor.

## Consultas útiles
1) Ver contadores de un tenant:
```sql
SELECT * FROM ai_usage_counters WHERE key LIKE 'TENANT_ID:%' ORDER BY updated_at DESC;
```

2) Ver breaker por proveedor:
```sql
SELECT * FROM ai_circuit_breakers WHERE key LIKE 'TENANT_ID:%:fireworks';
```

3) Ver buckets recientes:
```sql
SELECT * FROM ai_rate_limit_buckets ORDER BY updated_at DESC LIMIT 20;
```

## Reset manual de breaker
Para desbloquear un breaker abierto:
```sql
UPDATE ai_circuit_breakers
SET state = 'CLOSED', failure_count = 0, success_count = 0, cooldown_until = NULL, last_error = NULL, updated_at = CURRENT_TIMESTAMP
WHERE key = 'TENANT_ID:SAAS_SLUG:fireworks';
```

## Eventos esperados
- `ai.request.started` / `ai.request.completed` / `ai.request.failed`
- `ai.ratelimit.blocked`
- `ai.quota.soft_exceeded` / `ai.quota.hard_blocked`
- `ai.circuit.open` / `ai.circuit.half_open` / `ai.circuit.closed`

## Action Queue
Se generan acciones cuando:
- Hard quota bloquea (`AI hard quota blocked`).
- Rate limit bloqueado repetidamente (`AI abuse suspected`).
- Circuit breaker se abre por fallos (`AI provider unstable`).
