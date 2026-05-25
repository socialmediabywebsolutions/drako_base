# SocialFlow Legacy Read Models Local Validation Pack

This runbook is local-only. It does not use remote D1, does not deploy, and does not activate any switch by default.
Legacy runtime behavior and payload contracts remain unchanged.
`SOCIALFLOW_LEGACY_READ_MODELS_SOCIAL_DB_READ_SWITCH` stays OFF by default unless explicitly set in local test commands.

## Preconditions
- `migrations/0190_socialflow_legacy_read_models.sql` exists.
- Local D1 bindings resolve with `wrangler.workers.toml` (default):
  - `DRACO_DB`
  - `SOCIAL_DB`
- Local core source tables exist:
  - `tenant_strategic_dossiers`
  - `agent_work_logs`
  - `tenants`
  - `saas`
  - `saas_domains`
- Local SOCIAL_DB target tables exist:
  - `socialflow_legacy_strategic_dossiers`
  - `socialflow_legacy_tenant_progress`
  - `socialflow_legacy_agent_work_logs`
  - `socialflow_legacy_repository_context`

## Manual Commands (Local Only)
Run from repository root.

1. Backfill dry-run:

```bash
pnpm tsx scripts/backfill-socialflow-legacy-read-models.ts --config=wrangler.workers.toml --dry-run
```

2. Backfill apply:

```bash
pnpm tsx scripts/backfill-socialflow-legacy-read-models.ts --config=wrangler.workers.toml
```

3. Parity strict (fails with exit code `2` on drift):

```bash
pnpm tsx scripts/check-socialflow-legacy-read-models-parity.ts --config=wrangler.workers.toml
```

4. Parity with drift allowed (returns `0` even with drift):

```bash
pnpm tsx scripts/check-socialflow-legacy-read-models-parity.ts --config=wrangler.workers.toml --allow-drift
```

## Validation Pack (Automated Local Sequence)
Run from repository root:

```bash
pnpm tsx scripts/validate-socialflow-legacy-read-models-local.ts --config=wrangler.workers.toml
```

The script executes in this exact order:
1. Verify `migrations/0190_socialflow_legacy_read_models.sql` exists.
2. Run local bootstrap for legacy read models schema.
3. Run legacy read models backfill in `--dry-run`.
4. Run legacy read models backfill apply.
5. Run strict parity check (no `--allow-drift`).
6. Run legacy prep/backfill/parity tests:
   - `tests/lib/socialflow-legacy-social-ownership-prep-contract.test.ts`
   - `tests/backfill-socialflow-legacy-read-models.test.ts`
   - `tests/check-socialflow-legacy-read-models-parity.test.ts`

If any step fails, the script exits non-zero (fail-closed).

## Explicit Local Bootstrap (No Prod)
Run schema bootstrap directly when preparing a fresh local D1:

```bash
pnpm tsx scripts/bootstrap-socialflow-legacy-read-models-smoke-local.ts --config=wrangler.workers.toml
```

This step applies/verifies the local SOCIAL_DB preparatory schema from:
- `migrations/0190_socialflow_legacy_read_models.sql`

It guarantees these tables exist before backfill/parity:
- `socialflow_legacy_strategic_dossiers`
- `socialflow_legacy_tenant_progress`
- `socialflow_legacy_agent_work_logs`
- `socialflow_legacy_repository_context`

## Optional Local Switch Probe (No Prod)
Default behavior keeps the legacy read-model switch OFF.

To probe SOCIAL_DB reads locally while preserving production defaults:

```bash
SOCIALFLOW_LEGACY_READ_MODELS_SOCIAL_DB_READ_SWITCH=1 npx vitest run tests/lib/socialflow-legacy-read-models-switch.test.ts
```

Expected behavior with switch ON:
1. Reads from `socialflow_legacy_strategic_dossiers` when row is present.
2. Reads from `socialflow_legacy_tenant_progress` when row is present.
3. Reads from `socialflow_legacy_agent_work_logs` when rows are present.
4. Reads repository context from `socialflow_legacy_repository_context` when row is present.
5. Falls back to core-backed reads when SOCIAL_DB is missing, row is missing, or read fails.

## Switch-ON Local Smoke (No Prod)
Run full local smoke with switch ON:

```bash
pnpm tsx scripts/smoke-socialflow-legacy-read-models-switch-local.ts --config=wrangler.workers.toml
```

Strict recommended order:
1. `bootstrap-socialflow-legacy-read-models-smoke-local.ts`
2. `validate-socialflow-legacy-read-models-local.ts`
3. `smoke-socialflow-legacy-read-models-switch-local.ts`

Expected smoke evidence:
- `EVIDENCE social-db-legacy-read`
- `EVIDENCE core-fallback-legacy-read`
- `EVIDENCE payload-compatible`
- `EVIDENCE default-off-core-backed`

Operator bypass only (not final validation):

```bash
pnpm tsx scripts/smoke-socialflow-legacy-read-models-switch-local.ts --config=wrangler.workers.toml --assume-validated
```

`--assume-validated` is only an operator shortcut and does not replace final strict validation.

## Safety Notes
- No remote D1 usage (`--remote` is not used).
- No deploy/workflow changes.
- No switch activation by default.
- No behavior or payload changes for legacy actions/repository flows.
- The switch command above is local-only and must not be used as a production default.
- No remote D1 (`--remote`) usage is allowed for this validation/smoke flow.
