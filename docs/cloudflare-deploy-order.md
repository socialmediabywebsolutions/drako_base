# Cloudflare Deploy Order

Official deployment order and production checklist for Drako.

## Why This Matters

The main worker `drako-base-3` has a **service binding** `SCHEDULER` that references `drako-scheduler`.
Cloudflare validates all service bindings at deploy time. If `drako-scheduler` does not exist, deploy fails with **error 10143**.

## Deploy Order (Mandatory)

```
1. drako-scheduler          (workers/drako-scheduler)
2. autopilot-worker          (workers/autopilot-worker)
3. saas-factory-worker       (workers/saas-factory-worker)
4. preflight check           (scripts/preflight-deploy.js)
5. drako-base-3              (wrangler.workers.toml --env production)
```

### Automated (CI/CD)

Both GitHub Actions workflows enforce this:
1. `deploy-deps` job deploys: scheduler → autopilot → saas-factory-worker
2. `deploy` job runs: preflight → wrangler deploy main

### Manual

```bash
# Full pipeline (recommended):
npm run deploy:all
# Runs: deploy:scheduler → deploy:saas-factory → deploy:preflight → deploy:production

# Or step-by-step:
npm run deploy:scheduler        # 1) drako-scheduler
npm run deploy:saas-factory     # 2) saas-factory-worker
npm run deploy:preflight        # 3) Verify deps exist
npm run deploy:production       # 4) drako-base-3
```

## Domain Routes (Manual, One-Time Setup)

> **IMPORTANT**: Domain routes are NOT managed by Wrangler. They are configured once in Cloudflare Dashboard.
> This avoids requiring Zone permissions in the API token (prevents error 10000).

### Setup Instructions

1. Go to **Cloudflare Dashboard** → **Workers & Pages** → **drako-base-3**
2. Click **Settings** → **Triggers** (or **Routes**)
3. Add these routes:

| Route Pattern | Worker |
|---|---|
| `drako.systems/*` | drako-base-3 |
| `www.drako.systems/*` | drako-base-3 |

4. Save. Done — this only needs to be done once (or if the worker name changes).

### Verify

```bash
curl -I https://drako.systems/api/health
# Should return 200 OK
```

## Preflight Checklist

The automated preflight (`scripts/preflight-deploy.js`) checks these via the Cloudflare API:

| Check | Expected |
|---|---|
| `drako-scheduler` exists in account | ✅ |
| `saas-factory-worker` exists in account | ✅ |
| API token is valid | ✅ |

## Production Resources

| Resource | Type | Required By |
|---|---|---|
| `drako_db_prod` | D1 Database | Main + Scheduler + SaaS Factory |
| `drako-billing-queue` | Queue | Main (producer) |
| `drako-saas-factory-queue` | Queue | Main (producer) + SaaS Factory Worker (consumer) |
| `drako-provisioning-queue` | Queue | Main (producer) + Scheduler (consumer) |
| `drako-scheduler` | Worker | Main (SCHEDULER binding) |
| `saas-factory-worker` | Worker | Queue consumer for SaaS Factory |
| `autopilot-worker` | Worker | Autonomous operations |

## Queue Consumption

| Queue | Consumer Worker | Verify |
|---|---|---|
| `drako-provisioning-queue` | drako-scheduler | Dashboard → Queues → drako-provisioning-queue → Consumers |
| `drako-saas-factory-queue` | saas-factory-worker | Dashboard → Queues → drako-saas-factory-queue → Consumers |
| `drako-billing-queue` | — (producer only) | No consumer yet |

## Graceful Degradation

If `drako-scheduler` is not reachable at runtime:
- Rate limiting bypassed (fail-open) with `console.warn`
- `/api/health` reports `bindings.scheduler: "missing"`

## Adding New Service Bindings

1. Create and deploy the target worker first
2. Add it to `REQUIRED_WORKERS` in `scripts/preflight-deploy.js`
3. Add the binding to `wrangler.workers.toml`
4. Deploy the main worker

See also: [cloudflare-service-bindings.md](./cloudflare-service-bindings.md)
