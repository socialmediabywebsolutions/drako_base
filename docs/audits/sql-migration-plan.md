# SQL Migration Plan

Generated on: 2026-02-25T23:45:00Z

## Scope
This plan executes SQL reuse first: inventory, classification, and relocation without creating duplicate SQL scripts.

Hard constraints applied:
- do not create new SQL files except strict compatibility conversions (`ALTER` / `IF NOT EXISTS`) when needed
- keep Cloudflare Workers-first boundaries
- prioritize holding workers before SaaS workers

## Current Baseline
- Total SQL files inventoried: `218` ([sql-inventory.md](/mnt/c/CAMPAMENTO%20BASE%20DRAKO/drako_base/docs/audits/sql-inventory.md))
- Highest duplication hotspot: `migrations/*` mirrored under `workers/autopilot-worker/migrations/*`
- Immediate relocations completed in this phase:
  - `migrations/0060_release_governance.sql` -> `workers/drako-core-worker/migrations/0003_release_governance.sql`
  - `migrations/0130_provisioning_jobs.sql` -> `workers/drako-provisioner-worker/migrations/0001_provisioning_jobs.sql`
  - `migrations/0131_multi_tenant_coherence.sql` -> `workers/drako-provisioner-worker/migrations/0002_multi_tenant_coherence.sql`

## Domain Classification Rules
- `drako-core-worker`: registry, governance, audit, tenant coherence, release governance
- `drako-billing-worker`: Stripe, subscriptions, invoicing, pricing, tax, treasury
- `drako-observability-worker`: alerts, rollups, analytics, health/status snapshots, reconciliation metrics
- `drako-ai-orchestrator-worker`: agents, orchestrator runs, AI routing, prompt/eval runtime, knowledge orchestration
- `drako-provisioner-worker`: provisioning jobs, factory/project materialization, onboarding provisioning states
- `saases-workers`: product tables and vertical product data

## Deployment Order And Dependencies
1. `drako-core-worker` migrations first.
- reason: holding source of truth (`registry`, `governance`, `audit`, `loop`) is dependency root.
- apply order:
  1. `0001_drako_core_foundations.sql`
  2. `0002_governance_event_contract_v1.sql`
  3. `0003_release_governance.sql`

2. `drako-provisioner-worker` migrations second.
- reason: provisioning state machine depends on tenant/registry coherence from core.
- apply order:
  1. `0001_provisioning_jobs.sql`
  2. `0002_multi_tenant_coherence.sql`

3. `drako-billing-worker` migration relocation batch.
- source candidates: `migrations/0016_drako_subscriptions.sql`, `migrations/0049_drako_stripe_mapping.sql`, `migrations/0050_drako_stripe_webhook_events.sql`, `migrations/0122_stripe_invoicing.sql`, `migrations/0126_holding_multi_saas_monetization.sql`.

4. `drako-observability-worker` migration relocation batch.
- source candidates: `migrations/0003_alerts_saas_id.sql`, `migrations/0051_drako_events_rollups.sql`, `migrations/0065_saas_health_metrics.sql`, `migrations/0132_reconciliation_engine.sql`.

5. `drako-ai-orchestrator-worker` migration relocation batch.
- source candidates: `migrations/0054_drako_ai_governance.sql`, `migrations/0105_drako_ai_router_v1.1.sql`, `migrations/0114_agent_work_logs.sql`, `migrations/0109_enable_orchestrator.sql`, `migrations/0110_orchestrator_dossier.sql`.

6. SaaS worker batches last.
- move vertical tables by slug to each `workers/<slug>/migrations` directory.

## Relocation Strategy (No Duplicates)
- Use `git mv` to move canonical SQL files from `migrations/` into target worker directories.
- Do not copy SQL files.
- Keep one canonical location per migration file.
- If a moved migration can fail on already-applied schema, create a compatibility migration in the target worker only when necessary:
  - defensive checks
  - `IF NOT EXISTS` on creation
  - non-breaking `ALTER` guards

## Rollout Controls
- Before each batch:
  - `wrangler d1 migrations list ...`
  - dry-run deploy of worker config
- Apply per worker with independent migrations table names.
- Verify with post-apply checks (`sqlite_master`, key table columns, indexes).

## Phase Deliverables Completed
- [x] push blocking resolved (commits published to `origin/main`)
- [x] SQL inventory generated (`docs/audits/sql-inventory.md`)
- [x] SQL migration plan generated (`docs/audits/sql-migration-plan.md`)
- [x] initial relocation committed for core/provisioner SQL migrations (no SQL duplication)

## Next Batch (explicitly pending)
- relocate and normalize billing/observability/ai-orchestrator SQL sets
- convert any legacy duplicate-create scripts into compatibility-safe migration sequence per worker
- do not apply mass migrations until each batch has worker-local dry-run and dependency checks
