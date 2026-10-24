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

## Batch Update 2026-02-26 (Billing + Observability)
Status: completed for relocation and validation only.

### D1 Target Decisions
- `DRKO_HOLDING_DB`: existing and active for core/provisioner.
- `DRKO_BILLING_DB`: preferred isolated target for billing. Not created yet.
- `DRKO_OBSERVABILITY_DB`: preferred isolated target for observability. Not created yet.
- Temporary dry-run bindings for `drako-billing-worker` and `drako-observability-worker` point to `drako_holding_db` only for validation. No remote `d1 migrations apply` executed.

### Rehome Executed (`git mv`, no duplicate SQL)
- Billing moved to `workers/drako-billing-worker/migrations/0001..0015`.
- Observability moved to `workers/drako-observability-worker/migrations/0001..0009`.
- Canonical files were removed from root `migrations/` by rename, not copy.

### Dependency Report (pre-apply)
Billing dependencies:
- `0001_billing_support_notes.sql`: `invoices`, `tickets`
- `0002_drako_subscriptions.sql`: `clients`, `saas`, `tenants`
- `0003_saas_billing.sql`: `clients`, `saas`, `tenants`
- `0004_clinic_pricing_inventory.sql`: none (new objects only)
- `0005_saas_tax_core.sql`: none (new objects only)
- `0006_drako_vendor_core.sql`: none (new objects only)
- `0007_drako_treasury_core.sql`: internal dependency on `drako_treasury_accounts`
- `0008_drako_stripe_mapping.sql`: none (new objects only)
- `0009_drako_stripe_webhook_events.sql`: none (new objects only)
- `0010_stripe_quick_setup.sql`: `tenants`, `saas_projects`
- `0011_holding_economics.sql`: `saas_instances`
- `0012_saas_lifecycle_economics.sql`: `saas_instances`
- `0013_mentoria_pricing.sql`: `saas_instances`, `saas_economic_events`
- `0014_mentoria_billing_cycles.sql`: `saas_instances`, `saas_economic_events`, `saas_economics_snapshots`
- `0015_stripe_invoicing.sql`: `saas_instances`, `saas_economic_events`

Observability dependencies:
- `0001_alerts_saas_id.sql`: `alerts`
- `0002_inbox_statuses.sql`: `saas`, `core_departments`
- `0003_devarchitect_alerts_metrics.sql`: `alerts`
- `0004_drako_domain_status_normalization.sql`: `saas_domains`
- `0005_drako_events_rollups.sql`: none (new rollup objects)
- `0006_saas_health_metrics.sql`: `tenants`, `saas_projects`
- `0007_unified_analytics.sql`: `tenants`, `saas_projects`
- `0008_overseer_columns.sql`: `saas_instances`
- `0009_reconciliation_engine.sql`: internal dependency on `reconciliation_logs`

### Interface Rule
If billing requires core context, consume holding events (`GovernanceEventSpec v1`) instead of cross-worker foreign keys.

### Validation Evidence (no remote apply)
- `pnpm exec tsc --noEmit --skipLibCheck --lib es2022,webworker --module esnext --moduleResolution bundler --types @cloudflare/workers-types workers/drako-billing-worker/src/workers.ts workers/drako-observability-worker/src/workers.ts`
- `pnpm exec wrangler deploy --dry-run --config workers/drako-billing-worker/wrangler.workers.toml`
- `pnpm exec wrangler deploy --dry-run --config workers/drako-observability-worker/wrangler.workers.toml`

## Batch Update 2026-02-26 (AI Orchestrator)
Status: completed (rehome + dedicated D1 + remote apply + deploy).

### D1 Target Decision
- `DRKO_AI_DB` now points to dedicated `drako_ai_orchestrator_db`.
- Database id: `1687ec14-17fc-456a-b740-03b6bd9213c2`.
- Migrations table: `drko_ai_migrations`.

### Rehome Executed (`git mv`, no duplicate SQL)
Moved from root `migrations/` to `workers/drako-ai-orchestrator-worker/migrations/`:
- `0004_saas_agents.sql` -> `0001_saas_agents.sql`
- `0006_orchestrator_messages.sql` -> `0002_orchestrator_messages.sql`
- `0017_saas_domains.sql` -> `0003_saas_domains.sql`
- `0023_email_intake_core.sql` -> `0004_email_intake_core.sql`
- `0028_saas_domains_core.sql` -> `0005_saas_domains_core.sql`
- `0030_hr_guardrails_enforcement.sql` -> `0006_hr_guardrails_enforcement.sql`
- `0032_saas_knowledge_core.sql` -> `0007_saas_knowledge_core.sql`
- `0033_knowledge_documents_meta.sql` -> `0008_knowledge_documents_meta.sql`
- `0036_conversations_core.sql` -> `0009_conversations_core.sql`
- `0038_whatsapp_gateway_core.sql` -> `0010_whatsapp_gateway_core.sql`
- `0046_drako_empire_runtime_constraints.sql` -> `0011_drako_empire_runtime_constraints.sql`
- `0047_drako_domain_verification.sql` -> `0012_drako_domain_verification.sql`
- `0054_drako_ai_governance.sql` -> `0013_drako_ai_governance.sql`
- `0073_saas_growth_intelligence.sql` -> `0014_saas_growth_intelligence.sql`
- `0105_drako_ai_router_v1.1.sql` -> `0015_drako_ai_router_v1.1.sql`
- `0106_cost_optimizer_and_packs.sql` -> `0016_cost_optimizer_and_packs.sql`
- `0109_enable_orchestrator.sql` -> `0017_enable_orchestrator.sql`
- `0110_orchestrator_dossier.sql` -> `0018_orchestrator_dossier.sql`
- `0114_agent_work_logs.sql` -> `0019_agent_work_logs.sql`
- `repair_remote_economic_events.sql` -> `0020_repair_remote_economic_events.sql`
- `repair_remote_saas_instances.sql` -> `0021_repair_remote_saas_instances.sql`

### Bootstrap
- Added `workers/drako-ai-orchestrator-worker/migrations/0000_bootstrap.sql`.
- Bootstrap includes minimal mirrors only (`tenants`, `saas`, `saas_projects`, `agents`, `employee_hr_settings`, `saas_domains`, `agents_registry_mirror`).
- No full core schema duplication. No cross-worker FK coupling.

### Dependency Notes
- `0001_saas_agents.sql` needs `saas` + `agents`.
- `0006_hr_guardrails_enforcement.sql` needs `employee_hr_settings`.
- `0014_saas_growth_intelligence.sql` needs `tenants` + `saas_projects`.
- `0017_enable_orchestrator.sql` needs `tenants`.
- `0018_orchestrator_dossier.sql` needs `tenants`.
- Remaining files create orchestrator-local structures.

### Validation Evidence
- `pnpm exec tsc --noEmit --skipLibCheck --lib es2022,webworker --module esnext --moduleResolution bundler --types @cloudflare/workers-types workers/drako-ai-orchestrator-worker/src/workers.ts`
- `pnpm exec wrangler deploy --dry-run --config workers/drako-ai-orchestrator-worker/wrangler.workers.toml`
- `pnpm exec wrangler d1 migrations apply drako_ai_orchestrator_db --remote --config workers/drako-ai-orchestrator-worker/wrangler.workers.toml`
- `pnpm exec wrangler d1 migrations list drako_ai_orchestrator_db --remote --config workers/drako-ai-orchestrator-worker/wrangler.workers.toml` => `No migrations to apply`
