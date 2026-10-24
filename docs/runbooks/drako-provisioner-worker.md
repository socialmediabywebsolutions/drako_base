# drako-provisioner-worker runbook

## scope
`drako-provisioner-worker` belongs to HOLDING and orchestrates SaaS provisioning intents.

Current phase behavior:
- builds dry-run provisioning plans
- registers provisioning intents through `drako-core-worker`
- emits governance events via `drako-core-worker` (`GovernanceEventSpec v1`)
- does **not** create D1/KV/R2/Queue resources yet

## bindings
- `DRKO_HOLDING_DB` (D1, read-only checks for existing slugs)
- `DRKO_GLOBAL_CONFIG` (KV, provisioning defaults)
- `DRKO_GLOBAL_EVENTS` (Queue producer, reserved)

## vars
- `DRKO_CORE_WORKER_URL`
- `DRKO_INTERNAL_TOKEN` (optional)
- `DRKO_PROVISIONER_CONTEXT=holding`
- `WORKERS_ONLY_MODE=true`

## routes
- `GET /healths`
- `POST /provision/saases/plan`
- `POST /provision/saases/apply`

## contract
Provisioner emits only `GovernanceEventSpec v1` event types:
- `provisioning.plan.created`
- `provisioning.apply.requested`

## behavior
### /provision/saases/plan
- validates input
- computes dry-run resources (`d1`, `kv`, `r2`, `queue`, `worker`, `domain`)
- estimates setup/monthly costs
- sends governance event to `drako-core-worker /governance/events`

### /provision/saases/apply
- validates input
- checks if slug already exists in `saases_registry`
- calls `drako-core-worker /registry/saases` with `statusName=provisioning`
- sends governance event `provisioning.apply.requested` via `drako-core-worker /governance/events`
- returns `intent-only` result

## commands
```bash
cd workers/drako-provisioner-worker
pnpm run checks
pnpm run deploys
```
