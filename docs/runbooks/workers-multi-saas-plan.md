# Executable Plan: Multi-Worker SaaS Holding (Workers-first)

## Goal
Move from single-worker monolith to one Worker per SaaS while keeping Campamento Base as control tower.

## Phase 1: Prepare Shared Runtime Modules

1. Add shared modules under `packages/shared/`:
   - `platforms-failures.ts` for Workers-only fail-closed checks.
   - `hosts-fencings.ts` for strict host allowlist enforcement.
   - `auths-isolations.ts` for isolated cookies and JWT checks.
   - `dashboards-templates.ts` for client/admin dark UI surfaces.
   - `workers-handlers.ts` for standard worker routing and health endpoints.

## Phase 2: Provision 8 SaaS Workers

Create worker folders:

- `workers/drakos/`
- `workers/mentorias/`
- `workers/bases/`
- `workers/socialflows/`
- `workers/cryptos/`
- `workers/invoices/`
- `workers/analytics/`
- `workers/automations/`

Each worker contains:

- `src/workers.ts`
- `wrangler.workers.toml`

## Phase 3: SaaS Apps Scaffolding

Create per-SaaS app metadata:

- `apps/<slug>/routings.json`
- `apps/<slug>/dashboards/clients.html`
- `apps/<slug>/dashboards/admins.html`

## Phase 4: Deploy and Validate

Deploy commands:

```bash
cd workers/drakos && wrangler deploy --config wrangler.workers.toml
cd workers/mentorias && wrangler deploy --config wrangler.workers.toml
cd workers/bases && wrangler deploy --config wrangler.workers.toml
cd workers/socialflows && wrangler deploy --config wrangler.workers.toml
cd workers/cryptos && wrangler deploy --config wrangler.workers.toml
cd workers/invoices && wrangler deploy --config wrangler.workers.toml
cd workers/analytics && wrangler deploy --config wrangler.workers.toml
cd workers/automations && wrangler deploy --config wrangler.workers.toml
```

Health checks:

```bash
curl -sS https://drakos.drako.systems/api/health | jq .
curl -sS https://mentorias.drako.systems/api/health | jq .
curl -sS https://bases.drako.systems/api/health | jq .
```

Expected:

- `workersOnly: true`
- `resolvedContext` equals slug
- `workerName` equals worker

## Phase 5: Traffic Migration Without Downtime

1. Add new custom domains to each worker.
2. Keep monolith worker active during verification window.
3. Enable temporary `308` redirects from legacy domains.
4. Move DNS per domain in batches.
5. Tail logs per worker (`wrangler tail`) and validate auth isolation.
6. Disable legacy endpoints after stable cutover.
