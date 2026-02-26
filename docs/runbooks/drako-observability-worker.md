# drako-observability-worker Runbook

## Scope
- Holding worker for observability domain only.
- No SaaS product logic.
- Workers-only execution.

## Resource IDs
- Worker name: `drako-observability-worker`
- D1 binding: `DRKO_OBSERVABILITY_DB`
- D1 database name: `drako_observability_db`
- D1 database id: `98ae48e9-c254-4f0a-b757-5d41b7a3be1d`
- KV binding: `DRKO_GLOBAL_CONFIG` (`2a333512ad9c4c25a166496c1c121781`)
- Queue producer binding: `DRKO_GLOBAL_EVENTS` (`drako-global-events`)
- Migrations table: `drko_observability_migrations`

## Migration Strategy
- Dedicated D1 for observability.
- Bootstrap-only mirrors in `0000_bootstrap.sql` for dependency resolution.
- No copy of full holding core tables.
- No cross-database FKs to holding D1.

## Commands Executed
```bash
pnpm exec wrangler d1 create drako_observability_db
pnpm exec wrangler deploy --dry-run --config workers/drako-observability-worker/wrangler.workers.toml
pnpm exec wrangler d1 migrations apply drako_observability_db --remote --config workers/drako-observability-worker/wrangler.workers.toml
pnpm exec wrangler d1 migrations list drako_observability_db --remote --config workers/drako-observability-worker/wrangler.workers.toml
pnpm exec wrangler deploy --config workers/drako-observability-worker/wrangler.workers.toml
curl -sS https://drako-observability-worker.socialmediabywebsolutions.workers.dev/healths
```

## Migration Apply Result
- Applied files:
  - `0000_bootstrap.sql`
  - `0001_alerts_saas_id.sql` ... `0009_reconciliation_engine.sql`
- Result: `No migrations to apply` after apply.

## Schema Verification
Remote table inventory contains expected domain tables:
- `drko_observability_migrations`
- `alerts`
- `inbox_messages`
- `campamento_events`
- `campamento_event_rollups_daily`
- `saas_health_metrics`
- `holding_metrics_snapshots`
- `saas_daily_metrics`
- `reconciliation_logs`
- `reconciliation_mismatches`

Migration registry rows:
- `0000_bootstrap.sql` through `0009_reconciliation_engine.sql` are present in `drko_observability_migrations`.

## Smoke Test
`GET /healths` response:
```json
{
  "ok": true,
  "workerName": "drako-observability-worker",
  "context": "holding",
  "workersOnly": true
}
```

## DoD Checklist
- [x] Dedicated D1 created and bound
- [x] Bootstrap minimal dependency layer created
- [x] Remote migrations applied with dedicated migrations table
- [x] Worker deployed
- [x] `/healths` smoke test returns `ok: true`
- [x] No SaaS workers changed in this gate
