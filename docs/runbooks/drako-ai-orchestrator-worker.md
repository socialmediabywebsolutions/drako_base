# drako-ai-orchestrator-worker Runbook

## Scope
- Holding worker for AI orchestrator domain only.
- Focus: raw runs, model routing decisions, AI cost controls, orchestrator states.
- Workers-only execution.

## Resource IDs
- Worker name: `drako-ai-orchestrator-worker`
- D1 binding: `DRKO_AI_DB`
- D1 database name: `drako_ai_orchestrator_db`
- D1 database id: `1687ec14-17fc-456a-b740-03b6bd9213c2`
- KV binding: `DRKO_GLOBAL_CONFIG` (`2a333512ad9c4c25a166496c1c121781`)
- Queue producer binding: `DRKO_GLOBAL_EVENTS` (`drako-global-events`)
- Migrations table: `drko_ai_migrations`

## Migration Strategy
- Dedicated D1 for orchestrator domain.
- Bootstrap only in `0000_bootstrap.sql` for required dependencies.
- No full core duplication and no cross-database FKs.
- Rehome performed by `git mv` from root migrations.

## Commands Executed
```bash
pnpm exec wrangler d1 create drako_ai_orchestrator_db
pnpm exec wrangler deploy --dry-run --config workers/drako-ai-orchestrator-worker/wrangler.workers.toml
pnpm exec wrangler d1 migrations apply drako_ai_orchestrator_db --remote --config workers/drako-ai-orchestrator-worker/wrangler.workers.toml
pnpm exec wrangler d1 migrations list drako_ai_orchestrator_db --remote --config workers/drako-ai-orchestrator-worker/wrangler.workers.toml
pnpm exec wrangler deploy --config workers/drako-ai-orchestrator-worker/wrangler.workers.toml
curl -sS https://drako-ai-orchestrator-worker.socialmediabywebsolutions.workers.dev/healths
```

## Migration Apply Result
- Applied files:
  - `0000_bootstrap.sql`
  - `0001_saas_agents.sql` ... `0021_repair_remote_saas_instances.sql`
- Final state: `No migrations to apply`.

## Schema Verification
Remote table inventory includes expected orchestrator domain tables:
- `drko_ai_migrations`
- `orchestrator_messages`
- `ai_usage_counters`
- `ai_rate_limit_buckets`
- `ai_circuit_breakers`
- `ai_provider_policies`
- `ai_request_audits`
- `ai_cost_policies`
- `saas_policy_packs`
- `agent_work_logs`
- `tenant_strategic_dossiers`
- `saas_growth_events`
- `campamento_provisioning`
- plus minimal mirrors/bootstrap and compatibility repair tables.

Migration registry rows:
- `0000_bootstrap.sql` through `0021_repair_remote_saas_instances.sql` are present in `drko_ai_migrations`.

## Smoke Test
`GET /healths` response:
```json
{
  "ok": true,
  "workerName": "drako-ai-orchestrator-worker",
  "context": "holding",
  "workersOnly": true
}
```

## DoD Checklist
- [x] Dedicated D1 created and bound
- [x] Bootstrap minimal dependency layer created
- [x] Canonical migrations rehomed with `git mv` (no duplicates)
- [x] Remote migrations applied with dedicated migrations table
- [x] Worker deployed
- [x] `/healths` smoke test returns `ok: true`
- [x] No SaaS workers changed in this gate
