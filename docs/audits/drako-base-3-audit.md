# drako-base-3 Sunset Audit

Date: 2026-02-26  
Scope: Read-only audit of `drako-base-3`, strangler replacement map, and safe decommission plan without SaaS worker changes.

## 1) What `drako-base-3` is

Evidence:

- [`wrangler.workers.toml`](/mnt/c/CAMPAMENTO%20BASE%20DRAKO/drako_base/wrangler.workers.toml):1
  - `name = "drako-base-3"`
  - `main = ".open-next/worker.js"`
  - OpenNext standalone Worker output (not Pages Functions runtime).
- [`package.json`](/mnt/c/CAMPAMENTO%20BASE%20DRAKO/drako_base/package.json)
  - legacy `cf:*` scripts are now guardrailed and blocked (`archived:cf:*` fail-closed).
- [`scripts/finalize-worker.js`](/mnt/c/CAMPAMENTO%20BASE%20DRAKO/drako_base/scripts/finalize-worker.js)
  - Generates/finalizes `.open-next/worker.js`.

Conclusion: `drako-base-3` is a legacy OpenNext Worker standalone runtime, not a Pages Functions app.

## 2) Current deploy target, bindings, and routes

From [`wrangler.workers.toml`](/mnt/c/CAMPAMENTO%20BASE%20DRAKO/drako_base/wrangler.workers.toml):

- D1:
  - `DRACO_DB -> drako_db_prod (5607a76a-97c7-45a9-a948-e545ba27eae7)`
- Queue producers:
  - `BILLING_QUEUE -> drako-billing-queue`
  - `SAAS_FACTORY_QUEUE -> drako-saas-factory-queue`
  - `PROVISIONING_QUEUE -> drako-provisioning-queue`
- Service:
  - `SCHEDULER -> drako-scheduler`
- AI binding:
  - `AI`

Cloudflare live check (API):

- Zone routes (`/zones/<zone_id>/workers/routes`): `0` active routes.
- Custom domains (`/accounts/<account_id>/workers/domains`):
  - `drako.systems -> saas-drakos-prod`
  - `drakos.drako.systems -> saas-drakos-prod`
  - `bases.drako.systems`/`base.drako.systems -> saas-bases-prod`
  - `mentorias.drako.systems`/`mentoria.drako.systems -> saas-mentorias-prod`
  - plus 5 other SaaS domains -> `saas-*` workers.
- `drako-base-3` has no active custom domain on the zone.

## 3) Public route surface exposed by legacy app

Routing entry:

- [`src/middleware.ts`](/mnt/c/CAMPAMENTO%20BASE%20DRAKO/drako_base/src/middleware.ts) applies to `/:path*`.

Route inventory generated from filesystem:

- API routes: `228`
  - full list: [`docs/audits/drako-base-3-api-routes.txt`](/mnt/c/CAMPAMENTO%20BASE%20DRAKO/drako_base/docs/audits/drako-base-3-api-routes.txt)
- Page routes: `70`
  - full list: [`docs/audits/drako-base-3-page-routes.txt`](/mnt/c/CAMPAMENTO%20BASE%20DRAKO/drako_base/docs/audits/drako-base-3-page-routes.txt)

High-density API prefixes (top):

- `/api/owner` (35)
- `/api/saas` (13)
- `/api/employees` (11)
- `/api/social` (11)
- `/api/campamento-base` (8)
- `/api/clinic` (8)
- `/api/customers` (8)
- `/api/drakos/auths/*`, `/api/mentorias/auths/*`, `/api/bases/*` still present in monolith source.

## 4) Source of truth and write paths

Legacy DB access path:

- [`src/lib/db.ts`](/mnt/c/CAMPAMENTO%20BASE%20DRAKO/drako_base/src/lib/db.ts) reads from `DRACO_DB`.
- Source references to `DRACO_DB` under `src/`: `158` matches.
- Root SQL migrations under `migrations/`: `74` files, `146` `CREATE TABLE` statements.

Implication:

- `drako-base-3` remains coupled to the old monolithic D1 schema (`drako_db_prod`) and can still write critical tables if traffic reaches workers.dev.

## 5) Traffic and dependency check

Repo references:

- Legacy worker URL remains in [`wrangler.workers.toml`](/mnt/c/CAMPAMENTO%20BASE%20DRAKO/drako_base/wrangler.workers.toml):77 and :111 (`NEXTAUTH_URL`).
- Historical docs/scripts still reference old Pages/worker legacy targets.

Cloudflare exposure:

- No zone route/custom-domain currently directs production domains to `drako-base-3`.
- `workers.dev` subdomain is disabled (`enabled=false`, `previews_enabled=false`).

## 6) What it does / does not do

What it does now:

- Remains deployable as monolith Worker with broad API/UI surface.
- Can still run via workers.dev URL and touch `DRACO_DB`, queues, and scheduler binding.

What it does not do now:

- It does not currently own `drako.systems`, `bases.drako.systems`, or `mentoria(s).drako.systems`.
- It does not currently own zone-level worker routes for `drako.systems`.

## 7) Strangler map (legacy -> target)

| Legacy route | New worker target | Action |
|---|---|---|
| `/healths` | `drako-core-worker` + billing + observability + ai-orchestrator | Local aggregated health in shim |
| `/registry/*` | `drako-core-worker` | Proxy/forward (preserve headers/body) |
| `/governance/*` | `drako-core-worker` | Proxy/forward (preserve headers/body) |
| `/audit/*` | `drako-core-worker` | Proxy/forward (preserve headers/body) |
| `/loop/*` | `drako-core-worker` | Proxy/forward (preserve headers/body) |
| `/billing/*` | `drako-billing-worker` | Proxy/forward (strip `/billing` prefix) |
| `/observability/*` | `drako-observability-worker` | Proxy/forward (strip `/observability` prefix) |
| `/ai/*` | `drako-ai-orchestrator-worker` | Proxy/forward (strip `/ai` prefix) |

Rule used:

- Prefer `308` only for safe read-only navigations.
- For auth/tokens or non-idempotent requests, proxy/forward preserving headers.

## 8) Cutover-safe shim implementation

Added sunset shim worker:

- [`workers/drako-base-3-shims/wrangler.workers.toml`](/mnt/c/CAMPAMENTO%20BASE%20DRAKO/drako_base/workers/drako-base-3-shims/wrangler.workers.toml)
- [`workers/drako-base-3-shims/src/workers.ts`](/mnt/c/CAMPAMENTO%20BASE%20DRAKO/drako_base/workers/drako-base-3-shims/src/workers.ts)
- [`workers/drako-base-3-shims/package.json`](/mnt/c/CAMPAMENTO%20BASE%20DRAKO/drako_base/workers/drako-base-3-shims/package.json)

Shim behavior:

- Workers-only fail-closed.
- Host allowlist fail-closed (default: `drako-base-3.socialmediabywebsolutions.workers.dev`).
- `/healths` returns shim status + upstream holding worker status checks.
- For mapped legacy routes, forwards to the correct holding worker.
- Unmapped routes return `410` with deprecation payload.
- Provisioner forwarding intentionally excluded in this gate because `drako-provisioner-worker` service binding is not present yet in Cloudflare account.

Execution evidence (real deploy):

- Deployed on script `drako-base-3`
- Version: `7f118bc5-d69f-42e1-8236-eceec6a35f4e`
- URL: `https://drako-base-3.socialmediabywebsolutions.workers.dev`

Smoke checks:

- `GET /healths` -> `200` with upstream statuses `core=200`, `billing=200`, `observability=200`, `ai=200`.
- `POST /registry/saases` (invalid payload) -> `400 INVALID_PAYLOADS` from `drako-core-worker` (proxy working).
- `GET /billing/healths` -> `200` from `drako-billing-worker` (prefix-stripping proxy working).
- `GET /site/panel` -> `410 LEGACY_ROUTES_SUNSETS` (sunset fail-closed behavior).

## 9) Decommission risk assessment

Risk level for immediate hard shutdown: **LOW**.

Why not OFF:

- Historical references still exist in archived docs/reports (non-runtime).

Why not HIGH:

- Production custom domains already moved to `saas-*` workers.
- Zone workers routes for `drako.systems` are currently empty.

## 10) Safe decommission checklist

1. Deploy shim over `drako-base-3` and monitor `wrangler tail`.
2. Confirm no critical traffic on workers.dev for 7-14 days.
3. Remove/replace `NEXTAUTH_URL` legacy value.
4. Keep no custom domains and no zone routes on `drako-base-3`.
5. Mark worker deprecated (`zz-archived-drako-base-3`) and stop deploy pipeline.
6. Optionally disable workers.dev subdomain for `drako-base-3` once traffic is zero.

## 11) Legacy references review

Inventory executed (grep scope):

- `NEXTAUTH_URL` legacy host references found in root `wrangler.workers.toml` (monolith legacy config file).
- Multiple historical docs/reports still include `drako-base-3`/`pages.dev` strings.
- Sunset shim files intentionally reference `drako-base-3` because they target that legacy script directly.
- Active root-level deploy scripts (`cf:build`, `cf:deploy`, `cf:preview`) are now blocked by `archived:*` guardrails.

Replacement policy:

- SaaS/public auth URLs: prefer `https://drako.systems` (or SaaS subdomain where applicable).
- Holding internal calls: use service bindings / dedicated worker URLs; never use `drako-base-3` ingress.

Notes:

- Historical references in archived docs/reports remain unchanged intentionally for traceability.
- Runtime ingress risk is blocked at edge level and by repo deploy policy.

## 12) Decommission

Decommission execution date: 2026-02-26.

Steps executed:

1. Traffic sampling completed:
   - Report: [`docs/audits/drako-base-3-traffic-report.md`](/mnt/c/CAMPAMENTO%20BASE%20DRAKO/drako_base/docs/audits/drako-base-3-traffic-report.md)
   - Window: `2026-02-26T18:31:28+01:00` to `2026-02-26T18:44:24+01:00`
   - Result: no HTTP traffic; one legacy cron exception only.
2. Removed legacy cron schedule from `drako-base-3`:
   - Before: `*/10 * * * *`
   - After: `[]`
3. Disabled workers.dev subdomain for `drako-base-3`:
   - Before: `{ enabled: true, previews_enabled: true }`
   - After: `{ enabled: false, previews_enabled: false }`
4. Verified public routing state remains isolated:
   - `custom domains for drako-base-3 = 0`
   - `zone workers routes = 0`
   - `drako.systems` and required subdomains still mapped to `saas-*`.

Rollback plan:

1. Re-enable subdomain:
   - `POST /accounts/{account_id}/workers/scripts/drako-base-3/subdomain` with `{ "enabled": true }`
2. Re-deploy shim:
   - `npx wrangler deploy --config workers/drako-base-3-shims/wrangler.workers.toml`
3. Re-run health checks and tail:
   - `curl -sS https://drako-base-3.socialmediabywebsolutions.workers.dev/healths`
   - `npx wrangler tail drako-base-3 --format json`

## 13) Cementerio

Final state: `ARCHIVED` and ingress disabled.

Pre-archive confirmation (this gate):

- Subdomain check (API): `{ enabled: true, previews_enabled: true }` (unexpected reactivation detected).
- Schedules check (API): `[{"cron":"*/10 * * * *"}]` (unexpected residual trigger).
- Routes check (API): `0`.
- Domains check (API): `drako-base-3 count = 0`.

Actions applied:

1. Re-deployed tomb shim with strict no-ingress targets:
   - [`workers/drako-base-3-shims/wrangler.workers.toml`](/mnt/c/CAMPAMENTO%20BASE%20DRAKO/drako_base/workers/drako-base-3-shims/wrangler.workers.toml)
   - `workers_dev = false`
   - `preview_urls = false`
2. Cleared schedules via API:
   - `PUT /accounts/{account}/workers/scripts/drako-base-3/schedules` payload `[]`.
3. Disabled subdomain via API:
   - `POST /accounts/{account}/workers/scripts/drako-base-3/subdomain` payload `{"enabled":false}`.
4. Added repo guardrails in `package.json`:
   - `cf:build`, `cf:deploy`, `cf:preview` now fail closed through `archived:*`.

Post-archive confirmation (API + curl):

- Subdomain: `{ enabled: false, previews_enabled: false }`.
- Schedules: `[]`.
- Zone routes count: `0`.
- Legacy custom domains count: `0`.
- `curl -I https://drako-base-3.socialmediabywebsolutions.workers.dev/healths` -> `404` (workers.dev ingress closed).

Rename attempt result:

- Attempted API rename `drako-base-3 -> zz-archived-drako-base-3` was not viable with current token/API flow.
- Response: `code 10000`, `PATCH method not allowed for the api_token authentication scheme`.
- Operational marker used instead: archive policy + no-ingress config + blocked deploy scripts.
