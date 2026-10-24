# SocialFlow Runtime Seed Local Validation Pack

This runbook is local-only. It does not use remote D1 and does not enable runtime read switch by default.
`apps/socialflow-runtime/wrangler.toml` keeps `SOCIALFLOW_RUNTIME_SEED_SOCIAL_DB_READ_SWITCH="0"` as the safe default; switch-on is only for explicit local smoke commands.

## Preconditions
- `migrations/0187_socialflow_seed_metadata.sql` exists.
- `migrations/0001_init.sql` and `migrations/0013_tenant_columns.sql` exist for core `saas` compatibility.
- `migrations/0142_socialflow_auths.sql` exists for local SocialFlow auth tables.
- Local D1 bindings resolve with `wrangler.workers.toml` (default):
  - `DRACO_DB`
  - `SOCIAL_DB`

## Bootstrap Local DB (Required Before Validation/Smoke)
Run from repository root:

```bash
pnpm tsx scripts/bootstrap-socialflow-runtime-seed-smoke-local.ts --config=apps/socialflow-runtime/wrangler.toml
```

What it ensures (local only, idempotent):
1. `DRACO_DB.saas` table exists and has `tenant_id` + `blueprint_snapshot`.
2. `SOCIAL_DB.socialflow_seed_metadata` exists.
3. `SOCIALFLOW_AUTHS_DB` has `socialflow_users`, `socialflow_credentials`, `socialflow_sessions`.
4. Minimal seed rows exist for runtime seed smoke bootstrap context.

## Local Validation Sequence
Run from repository root:

```bash
pnpm tsx scripts/validate-socialflow-runtime-seed-local.ts --config=apps/socialflow-runtime/wrangler.toml
```

What it executes in order:
1. Verify migration `0187_socialflow_seed_metadata.sql` exists.
2. Run local backfill in dry-run mode.
3. Run local backfill apply mode.
4. Run strict local parity check (fails on drift).
5. Run runtime seed contract test suite.

If any step fails, the script exits non-zero (fail-closed).

## Optional Local Switch Probe
Default behavior keeps runtime seed social-read switch off.

To probe switch-enabled behavior locally in tests only:

```bash
SOCIALFLOW_RUNTIME_SEED_SOCIAL_DB_READ_SWITCH=1 npx vitest run tests/lib/socialflow-runtime-seed-contract.test.ts
```

This does not change production defaults and does not modify deploy/workflow configuration.

## Controlled Switch-On Local Test (No Prod)
To run the full local controlled test (baseline validation + switch-on contract suite):

```bash
pnpm tsx scripts/test-socialflow-runtime-seed-switch-local.ts
```

This command is local-only, fail-closed, and does not activate switch defaults in production.

## Runtime HTTP Smoke With Wrangler/OpenNext (Switch ON, Local Only)
This smoke validates runtime HTTP behavior on critical routes with switch enabled:
- `/api/socialflow/profile`
- `/api/socialflow/setup/status`

## Recommended Local Order (Exact)
1. Rebuild SocialFlow runtime artifacts (required after code changes):

```bash
pnpm socialflow-runtime:build
```

Why: `wrangler dev` serves `apps/socialflow-runtime/.open-next/worker.js`. If artifacts are stale, switch wiring updates in source may not be reflected at runtime.

2. Bootstrap local DB:

```bash
pnpm tsx scripts/bootstrap-socialflow-runtime-seed-smoke-local.ts --config=apps/socialflow-runtime/wrangler.toml
```

3. Validation pack:

```bash
pnpm tsx scripts/validate-socialflow-runtime-seed-local.ts --config=apps/socialflow-runtime/wrangler.toml
```

4. Start runtime locally with switch ON:

```bash
pnpm wrangler dev --local --config apps/socialflow-runtime/wrangler.toml --ip 127.0.0.1 --port 8787 \
  --var SOCIALFLOW_RUNTIME_SEED_SOCIAL_DB_READ_SWITCH:1 \
  --var SOCIALFLOW_AUTHS_SECRET:local-socialflow-runtime-secret \
  --var SOCIALFLOWS_AUTHS_SECRET:local-socialflow-runtime-secret
```

5. Run smoke in a second terminal:

```bash
pnpm tsx scripts/smoke-socialflow-runtime-seed-switch-local.ts --base-url=http://127.0.0.1:8787 --config=apps/socialflow-runtime/wrangler.toml --timeout-ms=25000
```

Expected smoke evidence:
- `EVIDENCE social-first ...` when active seed exists in `SOCIAL_DB`.
- social-first accepts explicit SocialFlow identities (`slug` alias or social seed `saas_id`) and rejects core identities.
- `EVIDENCE core-fallback contractTest=...` confirms fallback coverage from:
- `tests/lib/socialflow-runtime-seed-contract.test.ts` case `keeps_working_when_SOCIAL_DB_read_errors_and_core_fallback_is_available`.
- `SOCIALFLOW_RUNTIME_SEED_SMOKE_WARMUP ...` confirms route warmup completed before critical reads.
- `SOCIALFLOW_RUNTIME_SEED_SMOKE_RETRY ...` may appear transiently if Wrangler restarts sockets during local dev; smoke still fails closed if retries are exhausted.

The smoke is local-only, fail-closed, does not use remote D1, and does not change switch defaults.
