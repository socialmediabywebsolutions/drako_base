# SocialFlow Export Read Models Local Validation Pack

This runbook is local-only. It does not use remote D1, does not deploy, and does not activate any export read switch.
`apps/socialflow-runtime/src/lib/socialflow/exports-service.ts` keeps `RUNTIME_EXPORT_SOCIAL_DB_PREP_WRITE_SWITCH = false` as the safe default.
`SOCIALFLOW_EXPORT_READ_MODELS_SOCIAL_DB_READ_SWITCH` remains OFF by default unless explicitly set for local tests.

## Preconditions
- `migrations/0188_socialflow_export_read_models.sql` exists.
- Local D1 bindings resolve with `wrangler.workers.toml` (default):
  - `DRACO_DB`
  - `SOCIAL_DB`
- Local tables exist (or can be created via local migration/bootstrap workflow):
  - `DRACO_DB`: `saas`, `tenant_strategic_dossiers`, `agent_work_logs`, `orchestrator_messages`, `economic_events`, `saas_domains`
  - `SOCIAL_DB`: `socialflow_export_read_models`

## Manual Commands (Local Only)
Run from repository root.

1. Backfill dry-run:

```bash
pnpm tsx scripts/backfill-socialflow-export-read-models.ts --config=wrangler.workers.toml --dry-run
```

2. Backfill apply:

```bash
pnpm tsx scripts/backfill-socialflow-export-read-models.ts --config=wrangler.workers.toml
```

3. Parity strict (fails with exit code `2` on drift):

```bash
pnpm tsx scripts/check-socialflow-export-read-models-parity.ts --config=wrangler.workers.toml
```

4. Parity with drift allowed (returns `0` even if drift exists):

```bash
pnpm tsx scripts/check-socialflow-export-read-models-parity.ts --config=wrangler.workers.toml --allow-drift
```

5. Optional local-only probe to force SOCIAL_DB read path in runtime exports:

```bash
SOCIALFLOW_EXPORT_READ_MODELS_SOCIAL_DB_READ_SWITCH=1 npx vitest run apps/socialflow-runtime/src/lib/socialflow/exports-service.test.ts
```

## Validation Pack (Automated Local Sequence)
Run from repository root:

```bash
pnpm tsx scripts/validate-socialflow-export-read-models-local.ts --config=wrangler.workers.toml
```

The script executes in this exact order:
1. Verify `migrations/0188_socialflow_export_read_models.sql` exists.
2. Run export read models backfill in `--dry-run`.
3. Run export read models backfill apply.
4. Run strict parity check (no `--allow-drift`).
5. Run export validation tests:
   - `tests/lib/socialflow-export-social-read-prep-contract.test.ts`
   - `apps/socialflow-runtime/src/lib/socialflow/exports-service.test.ts`
   - `tests/backfill-socialflow-export-read-models.test.ts`
   - `tests/check-socialflow-export-read-models-parity.test.ts`

If any step fails, the script exits non-zero (fail-closed).

## Safety Notes
- No remote D1 usage (`--remote` is not used).
- No deploy/workflow changes.
- No switch activation for SOCIAL_DB export reads.
- `SOCIALFLOW_EXPORT_READ_MODELS_SOCIAL_DB_READ_SWITCH` is only for explicit local testing; do not set it in production defaults.
- No changes to export ZIP format, filenames, or payload contracts.
