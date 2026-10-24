# Multi-Provider Activation Playbook (Safe Rollout)

Guide for enabling external providers (OpenAI, Anthropic) in the Steel AI Router.

> [!WARNING]
> Only activate external providers if the Budget Hard Limit is strictly configured and confirmed.

## 1. Pre-Flight Checks
- [ ] **Budget**: Verify `hard_limit_usd` is set for the target Tenant (Query `ai_cost_policies`).
- [ ] **Keys**: Verify `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` are present in Worker `vars` or Secrets.
- [ ] **Alerts**: Verify `ALERT_WEBHOOK_URL` is configured and responding.

## 2. Activation Procedure

### Phase 1: Canary (Inactive Pack)
Modify the "Enterprise" pack (or Custom Saas Policy) to include the provider but keep `is_active: 0`.

```sql
-- D1 Update
UPDATE saas_policy_packs 
SET policies_json = JSON_SET(policies_json, '$[2].is_active', 0) -- Update placeholder
WHERE pack_name = 'Enterprise';
```

### Phase 2: Canary Activation (Specific Tenant)
Target a specific SaaS/Tenant to override the policy to `is_active: 1`.

```sql
-- Insert specific policy override for Tenant X
INSERT INTO ai_provider_policies (id, tenant_id, provider, model, is_active)
VALUES ('pol_canary', 'test_tenant', 'openai', 'gpt-4o', 1);
```
*Run smoke test against `test_tenant`.*

### Phase 3: Rollout (Pack Update)
Once verified, update the Pack definition to enable it for all new projects.

```sql
UPDATE saas_policy_packs 
SET policies_json = JSON_SET(policies_json, '$[2].is_active', 1) 
WHERE pack_name = 'Enterprise';
```

## 3. Rollback Procedure (Emergency)

**Incident**: Cost Spike or Provider Error.

**Action 1: Immediate Deactivation**
Run this query immediately to disable the provider globally for a tenant or pack.
```sql
UPDATE ai_provider_policies SET is_active = 0 WHERE provider = 'openai';
```

**Action 2: Circuit Breaker Force Open**
Manually trip the breaker to force fallback to Cloudflare.
```sql
INSERT INTO ai_circuit_breakers (key, state, failure_count, updated_at) 
VALUES ('ai:openai:gpt-4o', 'OPEN', 100, datetime('now'))
ON CONFLICT(key) DO UPDATE SET state = 'OPEN';
```
