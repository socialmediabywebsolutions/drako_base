# P2-24H - SocialFlow DRACO_DB Exports Blocker Resolution

## Scope

Resolve the remaining SocialFlow canary exports blocker caused by `DRACO_DB` legacy schema assumptions, without production cutover and without modifying production workers or DNS.

Constraints respected:

- no production worker replacement
- no production DNS cutover
- no workers.dev activation
- no public-open traffic
- no broad wildcard route
- no destructive database migration
- no `DRACO_DB` schema migration

## Initial blocker

Before P2-24H:

- `GET /api/socialflow/exports/current`: `503`
- error: `SOCIALFLOW_RUNTIME_DB_UNAVAILABLE`
- reason: `migrations-missing`

The endpoint failed before producing the export ZIP.

## Real root cause

Remote `DRACO_DB` audit showed the export tables exist:

- `saas`
- `tenant_strategic_dossiers`
- `agent_work_logs`
- `orchestrator_messages`
- `economic_events`
- `saas_domains`

But `saas` does not include the legacy columns expected by the canary export service:

- `blueprint_snapshot`
- `plan_tier`
- `mrr_eur`
- `cost_eur`
- `risk_level`

The staff canary tenant also has no real SocialFlow SaaS seed in `DRACO_DB`:

- tenant: `tenant_socialflow_canary_staff`
- lookup: no `socialflow` or `socialflows` SaaS row found

## Strategy chosen

Chosen strategy:

- make the isolated canary export service schema-aware
- read only columns that exist in `DRACO_DB.saas`
- use explicit safe defaults for missing optional export fields
- generate a tenant-scoped fallback SocialFlow export identity only when no SaaS seed exists
- include warnings in `meta.json`
- avoid writing `EXPORT_GENERATED` economic event when no real SaaS seed exists

Rejected strategy:

- applying compatibility columns to `drako_db_prod`

Reason:

- the current `DRACO_DB` binding is production-named (`drako_db_prod`)
- production schema changes were not required to make the canary export operational
- migrating production-named schema for a gated canary smoke would be higher blast radius than runtime compatibility

## Code changes

Updated:

- `apps/socialflow-runtime/src/lib/socialflow/exports-service.ts`
- `apps/socialflow-runtime/src/app/api/socialflow/exports/current/route.ts`

Behavior added:

- `PRAGMA table_info('saas')` driven column detection
- optional column fallback for missing `saas` export fields
- fallback SocialFlow export target when no tenant SaaS seed exists
- explicit warnings in export `meta.json`
- no `economic_events` write when no real SaaS seed exists
- `SOCIALFLOW_RUNTIME_EVENT:export_generated_success`

## Remote canary deployment

Deployed only the canary worker:

- worker: `saas-socialflows-runtime-canary`
- active version after P2-24H: `3ab939d8-6ed9-453c-a728-790a33968352`
- deploy output: `No deploy targets for saas-socialflows-runtime-canary`

No production worker, production DNS, or public routing was changed.

## Real export validation

Validation used:

- host: `socialflow-canary.drako.systems`
- gate: `x-socialflow-canary-gate`
- staff session: `socialflow-canary-staff+p2-24f@drako.systems`
- tenant: `tenant_socialflow_canary_staff`

Result:

- login: `200`
- export: `200`
- content type: `application/zip`
- content disposition: `attachment; filename="drako-export-socialflow-20260516.zip"`
- ZIP size observed: `2771` bytes

ZIP entries:

- `blueprint/`
- `blueprint/blueprint.json`
- `domains/`
- `domains/domain_status.json`
- `economics/`
- `economics/economic_events.csv`
- `economics/financials.csv`
- `execution/`
- `execution/orchestrator_messages.csv`
- `execution/work_logs.csv`
- `meta.json`

`meta.json`:

- `saasId`: `socialflow`
- `tenantId`: `tenant_socialflow_canary_staff`
- `slug`: `socialflow`
- `counts.logs`: `0`
- `counts.economic_events`: `1`
- `counts.domains`: `0`

Warnings in `meta.json`:

- no SocialFlow SaaS seed exists in `DRACO_DB`
- missing optional `DRACO_DB.saas` columns were defaulted
- no active Strategic Dossier exists for the tenant
- no blueprint snapshot exists
- `EXPORT_GENERATED` was not recorded because there is no real SaaS seed

## DRACO_DB write behavior

During the first smoke after the initial compatibility fix, one canary `EXPORT_GENERATED` event was inserted before the no-seed write guard was added:

- tenant: `tenant_socialflow_canary_staff`
- saas_id: `socialflow`
- type: `EXPORT_GENERATED`

After the final P2-24H guard:

- fallback exports no longer write new `EXPORT_GENERATED` economic events when the tenant has no real SaaS seed
- the existing event remains as audit evidence from the first smoke

## Observability

Live `wrangler tail` after final deploy captured:

- `SOCIALFLOW_RUNTIME_EVENT:auth_login_success`
- `SOCIALFLOW_RUNTIME_EVENT:export_generated_success`

No `db_unavailable` event was observed during the final export smoke.

## Tenant and data isolation

All export queries remain tenant-scoped:

- `tenant_strategic_dossiers`: `tenant_id = ?`
- `agent_work_logs`: `tenant_id = ? AND saas_id = ?`
- `orchestrator_messages`: `tenant_id = ?`
- `economic_events`: `tenant_id = ? AND saas_id = ?`
- `saas_domains`: `tenant_id = ? AND saas_id = ?`

Runtime assertions still validate returned `tenant_id` and `saas_id` before adding rows to the ZIP.

## What did not change

- no production worker was replaced
- no production DNS was changed
- no public traffic was opened
- no workers.dev was enabled
- no global wildcard route was added
- no `DRACO_DB` migration was applied
- no monolith runtime was changed
- no OAuth success was claimed

## Remaining risks

- `DRACO_DB` binding remains production-named
- canary staff tenant still has no real SocialFlow SaaS seed in `DRACO_DB`
- export content is structurally valid but sparse until real tenant dossier/log/domain/economic data exists
- one canary `EXPORT_GENERATED` event exists from the first P2-24H smoke before the no-seed write guard
- LinkedIn OAuth persistence still requires real human consent and token exchange

## Status

- exports blocker resolved: **yes**
- export smoke complete: **yes**
- `DRACO_DB` schema migration required: **no**
- canary still gated: **yes**
- production cutover ready: **no**
- next correct phase: **operator-assisted real LinkedIn consent and persistence verification, with exports now unblocked**
