# Decommissioned Workers Policy

Date: 2026-02-26
Owner scope: Holding (Campamento Base)

## Archived Workers

### `drako-base-3`

Status: `ARCHIVED`

- `workers.dev` subdomain: disabled (`enabled=false`, `previews_enabled=false`)
- custom domains: `0`
- zone routes: `0`
- schedules: `0`
- legacy ingress: blocked

## Hard Rules

1. Do not redeploy archived workers without explicit re-approval.
2. Do not re-enable `workers.dev` for archived workers.
3. Do not attach custom domains or routes to archived workers.
4. Keep archived worker code only as tomb documentation/fallback procedure.

## Deployment Guardrail

Root `package.json` scripts `cf:build`, `cf:deploy`, and `cf:preview` are blocked and routed to `archived:*` commands that fail closed with explicit messages.

## Automatic Drift Detection Enabled

Holding-level drift checks are enabled via:

- Script: `scripts/check-workers-drift.ts`
- Command: `npm run check:workers`
- Source of truth: `docs/config/workers-expected-state.json`
- Report outputs:
  - `docs/audits/workers-drift-latest.json`
  - `docs/audits/workers-drift-latest.md`

Validation enforced for archived workers (`drako-base-3`):

- `workers.dev` subdomain must remain disabled.
- schedules must remain empty.
- zone routes count must remain zero.
- custom domains count must remain zero.

Failure behavior:

- Script exits with code `1`.
- Error message includes:
  - `DRIFT DETECTED: <worker> resurrected`
- Optional auto-remediation for archived workers only:
  - `AUTO_REMEDIATE_ARCHIVED=true`
  - Actions allowed: disable subdomain, clear schedules.

## Hostnames And Routes Ownership Lock

An additional P0 ownership gate validates Cloudflare hostname/route targets:

- Script: `scripts/check-hostnames-drift.ts`
- Command: `npm run check:hostnames`
- Source of truth: `docs/config/workers-hostnames-expected-state.json`
- Report outputs:
  - `docs/audits/hostnames-drift-latest.json`
  - `docs/audits/hostnames-drift-latest.md`

Hard rule:

- `drako-base-3` must never be a target service in Workers Domains.
- `drako-base-3` must never be a target script in Workers Routes.

## Recovery Procedure (Only With Explicit Approval)

1. Re-enable subdomain using Cloudflare API:
   - `POST /accounts/{account_id}/workers/scripts/{name}/subdomain` with `{ "enabled": true }`
2. Re-deploy archived shim from:
   - `workers/drako-base-3-shims/wrangler.workers.toml`
3. Validate via:
   - `wrangler tail <worker>`
   - `GET /healths`
