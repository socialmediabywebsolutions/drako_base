# Cloudflare Deploy Order

Official deployment order and production checklist for Drako.

## Why This Matters

The main worker `drako-base-3` has a **service binding** `SCHEDULER` that references `drako-scheduler`. Cloudflare validates all service bindings at deploy time. If `drako-scheduler` does not exist in the account, the deploy fails with **error 10143**.

## Deploy Order (Mandatory)

```
1. drako-scheduler        (workers/drako-scheduler)
2. autopilot-worker       (workers/autopilot-worker)
3. preflight check        (verify deps exist)
4. drako-base-3           (main app via wrangler.workers.toml --env production)
```

### Automated (CI/CD)

Both GitHub Actions workflows (`build-worker.yml`, `deploy-workers.yml`) enforce this order automatically:
1. `deploy-deps` job deploys scheduler + autopilot
2. `deploy` job runs preflight check, then deploys main worker

### Manual

```bash
# Full pipeline (recommended):
npm run deploy:all
# Runs: deploy:scheduler -> deploy:preflight -> deploy:production

# Or step-by-step:
npm run deploy:scheduler      # Step 1
npm run deploy:preflight      # Step 2 (verify scheduler exists)
npm run deploy:production     # Step 3
```

## Preflight Checklist

Before deploying `drako-base-3`, confirm:

| Check | Command | Expected |
|---|---|---|
| drako-scheduler exists | `npx wrangler deployments list --name drako-scheduler` | Shows version(s) |
| Account ID matches | `npx wrangler whoami` | `874f900d672c1458ce134db296e6cbc6` |
| Worker name is exact | Check `workers/drako-scheduler/wrangler.toml` | `name = "drako-scheduler"` |
| API token has permissions | Deploy attempt succeeds | No auth errors |

The automated preflight script (`scripts/preflight-deploy.js`) checks these via the Cloudflare API.

## Production Resources

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
- No 500 errors -- the app keeps running
- `/api/health` reports `bindings.scheduler: "missing"`

## Adding New Service Bindings

If a new service binding is added:
1. Create the target worker first
2. Deploy the target worker
3. Add it to `REQUIRED_WORKERS` in `scripts/preflight-deploy.js`
4. Add the binding to `wrangler.workers.toml`
5. Deploy the main worker

See also: [cloudflare-service-bindings.md](./cloudflare-service-bindings.md) for technical details.
