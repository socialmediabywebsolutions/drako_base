# SocialFlow Legacy Read Models Local Validation Pack

This runbook is local-only. It does not use remote D1, does not deploy, and does not activate any switch.
Legacy runtime behavior and payload contracts remain unchanged.

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
2. Run legacy read models backfill in `--dry-run`.
3. Run legacy read models backfill apply.
4. Run strict parity check (no `--allow-drift`).
5. Run legacy prep/backfill/parity tests:
   - `tests/lib/socialflow-legacy-social-ownership-prep-contract.test.ts`
   - `tests/backfill-socialflow-legacy-read-models.test.ts`
   - `tests/check-socialflow-legacy-read-models-parity.test.ts`

If any step fails, the script exits non-zero (fail-closed).

## Safety Notes
- No remote D1 usage (`--remote` is not used).
- No deploy/workflow changes.
- No switch activation by default.
- No behavior or payload changes for legacy actions/repository flows.
