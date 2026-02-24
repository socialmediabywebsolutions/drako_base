# Cloudflare Deploy Order

Official deployment order and production checklist for Drako.

## Why This Matters

The main worker `drako-base-3` has a **service binding** `SCHEDULER` that references `drako-scheduler`. Cloudflare validates all service bindings at deploy time. If `drako-scheduler` does not exist in the account, the deploy fails with **error 10143**.

## Deploy Order (Mandatory)

```
1. drako-scheduler        (workers/drako-scheduler)
2. autopilot-worker       (workers/autopilot-worker)
3. drako-base-3           (main app via wrangler.workers.toml --env production)
```

### Automated (CI/CD)

Both GitHub Actions workflows (`build-worker.yml`, `deploy-workers.yml`) enforce this order automatically via the `deploy-deps` job which runs before the main deploy.

### Manual

```bash
# Step 1: Deploy dependency workers
npm run deploy:scheduler
# Equivalent: cd workers/drako-scheduler && npx wrangler deploy

# Step 2: Deploy main app (only after step 1 succeeds)
npm run deploy:production
# Equivalent: npx wrangler deploy --config wrangler.workers.toml --env production

# Or all at once:
npm run deploy:all
```

## Production Checklist

Before deploying `drako-base-3`, verify these resources exist in Cloudflare:

| Resource | Type | Required By |
|---|---|---|
| `drako_db_prod` | D1 Database | Main worker + Scheduler |
| `drako-billing-queue` | Queue | Main worker (producer) |
| `drako-saas-factory-queue` | Queue | Main worker (producer + consumer) |
| `drako-provisioning-queue` | Queue | Main worker (producer) + Scheduler (consumer) |
| `drako-scheduler` | Worker | Main worker service binding (`SCHEDULER`) |
| `autopilot-worker` | Worker | Autonomous operations |

## Graceful Degradation

If `drako-scheduler` is not reachable at runtime:
- **Rate limiting** bypassed (fail-open) with `console.warn`
- No 500 errors — the app keeps running
- `/api/health` reports `bindings.scheduler: "missing"`

**Log to watch for:**
```
[SCHEDULER] Service binding unavailable -- rate limiting bypassed (fail-open).
```

## Changing Bindings

If a new service binding is added:
1. Create the target worker first
2. Deploy the target worker
3. Add the binding to `wrangler.workers.toml`
4. Deploy the main worker

See also: [cloudflare-service-bindings.md](./cloudflare-service-bindings.md) for technical details.
