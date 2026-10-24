# Ops Dashboards (D1 Monitoring)

Standard SQL queries for monitoring the Steel AI Router. Run these via Cloudflare Dashboard (D1) or `wrangler d1 execute`.

## 1. Top Tenants by Cost (Current Month)
**Goal**: Identify who is spending the most.
```sql
SELECT tenant_id, saas_id, current_cost_usd, hard_limit_usd, current_month 
FROM ai_cost_policies 
ORDER BY current_cost_usd DESC 
LIMIT 10;
```

## 2. Request Status Breakdown (Last 24h)
**Goal**: Spot error spikes (402, 429, 500).
```sql
SELECT 
    strftime('%Y-%m-%d %H:00', created_at) as hour_bucket,
    status,
    COUNT(*) as count
FROM ai_request_audits
WHERE created_at >= datetime('now', '-24 hours')
GROUP BY hour_bucket, status
ORDER BY hour_bucket DESC, status;
```

## 3. Latency Check (p95 Approximation)
**Goal**: Detect performance degradation.
```sql
SELECT 
    provider, 
    model, 
    AVG(latency_ms) as avg_latency, 
    MAX(latency_ms) as max_latency
FROM ai_request_audits
WHERE created_at >= datetime('now', '-1 hour')
AND status = 200
GROUP BY provider, model;
```

## 4. Recent Alerts (Soft/Hard/SLA)
**Goal**: Audit automatic enforcement actions.
```sql
SELECT created_at, tenant_id, provider, status, error_code, metadata
FROM ai_request_audits
WHERE error_code IN ('COST_HARD_LIMIT', 'COST_SOFT_LIMIT', 'LATENCY_SLA_BREACH')
OR metadata LIKE '%policy_override%'
ORDER BY created_at DESC
LIMIT 50;
```

## 5. Circuit Breaker State
**Goal**: Check for OPEN breakers.
```sql

## 6. Portfolio View (Revenue vs Cost)
**Goal**: Tracking the "Holding" performance (Burn Rate).
```sql
SELECT 
    s.tenant_id,
    s.saas_id,
    p.pack_name,
    p.monthly_price_usd as revenue_est,
    c.current_cost_usd as cost_real,
    (p.monthly_price_usd - c.current_cost_usd) as margin_est,
    s.status as sub_status
FROM saas_subscriptions s
JOIN saas_policy_packs p ON s.stripe_price_id LIKE '%' || p.stripe_product_id || '%' -- (Loose join for V1, or match via ID)
LEFT JOIN ai_cost_policies c ON s.tenant_id = c.tenant_id AND (s.saas_id = c.saas_id OR (s.saas_id IS NULL AND c.saas_id IS NULL))
ORDER BY margin_est ASC;
```

## 7. Subscription Health
**Goal**: Identify churn or payment issues.
```sql

## 8. SaaS in Risk (Cost > Soft Limit)
**Goal**: Identify SaaS consuming margin.
```sql
SELECT *
FROM (
  SELECT
    tenant_id,
    saas_id,
    current_cost_usd,
    soft_limit_usd,
    hard_limit_usd
  FROM ai_cost_policies
)
WHERE current_cost_usd > soft_limit_usd;
```

## 9. Frozen Tenants (Cost > Hard Limit)
**Goal**: Identify blocked SaaS.
```sql
SELECT tenant_id, saas_id, current_cost_usd, hard_limit_usd
FROM ai_cost_policies
WHERE current_cost_usd >= hard_limit_usd;
```
