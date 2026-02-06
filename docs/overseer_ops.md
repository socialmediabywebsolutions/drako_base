# Drako Overseer - SQL Operations

## 1. Top Negative Margin (Risk Watch)
Identify clients burning money faster than their plan covers.
```sql
SELECT 
    si.slug,
    si.plan_tier,
    si.trial_started_at,
    (SELECT count(*) FROM saas_agents WHERE instance_id = si.id AND status = 'active') * 5 as infra_cost,
    -- Simple Revenue Proxy (Trial = 0, Active = 290)
    CASE WHEN si.plan_tier = 'active' THEN 290 ELSE 0 END as revenue,
    (CASE WHEN si.plan_tier = 'active' THEN 290 ELSE 0 END) - 
    ((SELECT count(*) FROM saas_agents WHERE instance_id = si.id AND status = 'active') * 5) as margin
FROM saas_instances si
ORDER BY margin ASC
LIMIT 10;
```

## 2. Top Hard Blocks (Degraded Mode Candidates)
Identify high-risk clients hitting rate limits.
*(Requires Event Logs Table integration - Phase 6)*

## 3. Pulse Trend (Last 7 Days)
Identify "Zombie" clients vs "Power Users".
```sql
SELECT 
    si.slug,
    count(om.id) as interactions_7d
FROM saas_instances si
LEFT JOIN tenants t ON si.tenant_id = t.id
LEFT JOIN orchestrator_messages om ON om.thread_id = t.id
WHERE om.created_at > datetime('now', '-7 days')
GROUP BY si.slug
ORDER BY interactions_7d DESC;
```
