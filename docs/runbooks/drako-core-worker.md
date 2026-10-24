# drako-core-worker runbook

## scope
`drako-core-worker` is the holding source of truth for:
- `saases_registry`
- `agents_registry`
- `governance_events`
- `audit_logs`
- `analyze_optimize_scale_runs`

It does **not** provision infrastructure, bill customers, run observability pipelines, or execute AI agents.

## bindings (production)
- D1: `DRKO_HOLDING_DB` -> `drako_holding_db` (`52752a5c-b290-4633-91c6-e2a371a0c669`)
- KV: `DRKO_GLOBAL_CONFIG` -> `DRKO_GLOBAL_CONFIG` (`2a333512ad9c4c25a166496c1c121781`)
- Queue producer: `DRKO_GLOBAL_EVENTS` -> `drako-global-events`

## runtime vars
- `DRKO_CORE_CONTEXT=holding`
- `DRKO_LOOP_NAME=ANALYZE_OPTIMIZE_SCALE`
- `WORKERS_ONLY_MODE=true`
- `GIT_SHA=4335ef9`
- `BUILD_VERSION=2026.02.25.1`

## routes
- `GET /healths`
- `POST /registry/saases`
- `POST /registry/agents`
- `POST /governance/events`
- `POST /audit/logs`
- `POST /loop/runs`

## event contract
### GovernanceEventSpec v1 (canonical)
`/governance/events` enforces this schema and uses it as the only queue payload for governance events.

```json
{
  "event_id": "uuid",
  "event_type": "provisioning.saas.created",
  "source": "drako-provisioner-worker",
  "saas_slug": "drakos",
  "tenant_id": "tenant_root",
  "actor_type": "system",
  "actor_id": "provisioner",
  "severity": "info",
  "occurred_at": "2026-02-25T23:10:00.000Z",
  "metadata": {},
  "trace_id": "trace_20260225_001",
  "correlation_id": "corr_20260225_001",
  "schema_version": "v1"
}
```

Allowed values:
- `severity`: `info | warn | error | critical`
- `schema_version`: `v1`

Compatibility rules:
- `v1` is immutable.
- future changes must create `v2` without breaking `v1`.
- payload inserted in `governance_events` (`event_json`) is exactly the same payload published to `DRKO_GLOBAL_EVENTS`.

## migration commands (executed)
```bash
cd workers/drako-core-worker
npx wrangler d1 migrations apply drako_holding_db --remote --config wrangler.workers.toml
```

Migrations applied:
- `0001_drako_core_foundations.sql`
- `0002_governance_event_contract_v1.sql`

Schema verification commands:
```bash
npx wrangler d1 execute drako_holding_db --remote --command "SELECT name, type FROM sqlite_master WHERE type='table' AND name IN ('saases_registry','agents_registry','governance_events','audit_logs','analyze_optimize_scale_runs') ORDER BY name;"
npx wrangler d1 execute drako_holding_db --remote --command "PRAGMA table_info(governance_events);"
npx wrangler d1 execute drako_holding_db --remote --command "PRAGMA table_info(audit_logs);"
npx wrangler d1 execute drako_holding_db --remote --command "SELECT * FROM drko_holding_migrations ORDER BY ROWID DESC LIMIT 5;"
```

## deploy commands (executed)
```bash
cd workers/drako-core-worker
npx wrangler deploy --config wrangler.workers.toml
```

Deploy evidence:
- worker URL: `https://drako-core-worker.socialmediabywebsolutions.workers.dev`
- queue producer attached: `drako-global-events`

## smoke tests (executed)
```bash
curl -sS https://drako-core-worker.socialmediabywebsolutions.workers.dev/healths
curl -sS -X POST https://drako-core-worker.socialmediabywebsolutions.workers.dev/registry/saases -H 'content-type: application/json' --data '{...}'
curl -sS -X POST https://drako-core-worker.socialmediabywebsolutions.workers.dev/registry/agents -H 'content-type: application/json' --data '{...}'
curl -sS -X POST https://drako-core-worker.socialmediabywebsolutions.workers.dev/governance/events -H 'content-type: application/json' --data '{...v1...}'
curl -sS -X POST https://drako-core-worker.socialmediabywebsolutions.workers.dev/audit/logs -H 'content-type: application/json' --data '{...}'
curl -sS -X POST https://drako-core-worker.socialmediabywebsolutions.workers.dev/loop/runs -H 'content-type: application/json' --data '{...}'
```

## audit coverage verification
Critical routes (`/registry/saases`, `/registry/agents`, `/governance/events`, `/loop/runs`) create `audit_logs` records with:
- `actor_type`
- `actor_id`
- `action`
- `target_type`
- `target_id`
- `metadata`
- `created_at`

## definition of done
- [x] Real IDs set in `workers/drako-core-worker/wrangler.workers.toml`
- [x] Remote migrations applied to `drako_holding_db`
- [x] Deploy completed successfully
- [x] Smoke tests passed for health and all POST endpoints
- [x] Audit logs generated for critical operations
- [x] `GovernanceEventSpec v1` documented and enforced in `/governance/events`
