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

## Recovery Procedure (Only With Explicit Approval)

1. Re-enable subdomain using Cloudflare API:
   - `POST /accounts/{account_id}/workers/scripts/{name}/subdomain` with `{ "enabled": true }`
2. Re-deploy archived shim from:
   - `workers/drako-base-3-shims/wrangler.workers.toml`
3. Validate via:
   - `wrangler tail <worker>`
   - `GET /healths`
