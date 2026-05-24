# SocialFlow Runtime Seed Local Validation Pack

This runbook is local-only. It does not use remote D1 and does not enable runtime read switch by default.

## Preconditions
- `migrations/0187_socialflow_seed_metadata.sql` exists.
- Local D1 bindings resolve with `wrangler.workers.toml` (default):
  - `DRACO_DB`
  - `SOCIAL_DB`

## Local Validation Sequence
Run from repository root:

```bash
pnpm tsx scripts/validate-socialflow-runtime-seed-local.ts
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
