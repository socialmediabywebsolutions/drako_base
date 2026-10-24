# Cloudflare Service Bindings — Drako System

Service bindings allow one Cloudflare Worker to call another directly, bypassing the public internet. This document explains how Drako uses them, why deployments can fail, and the correct deployment order.

---

## Service Binding: `SCHEDULER`

### What is it?
`SCHEDULER` is a Cloudflare Service Binding that connects the main `drako-base-3` worker to the `drako-scheduler` worker.

**Defined in** `wrangler.workers.toml`:
```toml
[[env.production.services]]
binding = "SCHEDULER"
service = "drako-scheduler"
```

**Used in code:**
- `src/lib/rate-limit/scheduler-client.ts` — calls `SCHEDULER.fetch(...)` to perform tenant-scoped rate limit checks via the `RateLimiterDO` Durable Object.
- `src/lib/security/tenant-rate-limit.ts` — gateway that checks if the binding is available before invoking the client.

### Why does deployment fail with error 10143?
Cloudflare validates all service bindings at deploy time. If the referenced worker (`drako-scheduler`) does not exist in the account, the deploy is rejected with:

```
Service binding 'SCHEDULER' references Worker 'drako-scheduler' which was not found. [code: 10143]
```

The fix is simple: **deploy `drako-scheduler` first**, before deploying `drako-base-3`.

---

## Production Prerequisites Checklist

Before deploying `drako-base-3`, all of the following must exist in the Cloudflare account:

| Resource | Type | Required By |
|---|---|---|
| `drako_db_prod` | D1 Database | Main worker, Scheduler |
| `drako-billing-queue` | Queue | Main worker (producer) |
| `drako-saas-factory-queue` | Queue | Main worker (producer + consumer) |
| `drako-provisioning-queue` | Queue | Main worker (producer) + Scheduler (consumer) |
| `drako-scheduler` | Worker | Main worker service binding |

---

## How to Deploy (Correct Order)

### Option A: Automated (Recommended)
```bash
# Builds the OpenNext worker then deploys scheduler first, then the main app
npm run cf:build
npm run deploy:all
```

### Option B: Step-by-step
```bash
# Step 1: Deploy the Scheduler Worker
npm run deploy:scheduler
# Equivalent to: cd workers/drako-scheduler && npx wrangler deploy

# Step 2 (after scheduler is live): Deploy Main App
npm run deploy:production
# Equivalent to: npx wrangler deploy --config wrangler.workers.toml --env production
```

---

## Graceful Degradation (Hotfix Behavior)

If `drako-scheduler` is not available (binding missing), the system will:
- **Rate limiting** → fail-open (all requests allowed through with a `console.warn`)
- **No 500 errors** are thrown

This is intentional so that a missing scheduler does not take down the entire application. However, rate limiting is disabled until the scheduler is deployed.

**Log to watch for:**
```
[SCHEDULER] Service binding unavailable — rate limiting bypassed (fail-open). Deploy drako-scheduler to restore enforcement.
```

---

## drako-scheduler Worker Details

| Field | Value |
|---|---|
| **Worker name** | `drako-scheduler` |
| **Config** | `workers/drako-scheduler/wrangler.toml` |
| **Entry point** | `workers/drako-scheduler/src/index.ts` |
| **Durable Object** | `RateLimiterDO` (token bucket rate limiting per tenant) |
| **Cron triggers** | `*/5 * * * *` (Job Reaper), `*/15 * * * *` (Reconciliation) |
| **Queue consumer** | `drako-provisioning-queue` |
| **D1 binding** | `drako_db_prod` |
