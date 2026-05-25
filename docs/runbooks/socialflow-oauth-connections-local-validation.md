# SocialFlow OAuth Connections Local Validation Pack

This runbook is local-only. It does not use remote D1, does not deploy, and does not activate OAuth switches by default.
`src/lib/socialflow/linkedin/repository.ts` keeps `RUNTIME_LINKEDIN_OAUTH_SOCIAL_DB_PREP_WRITE_SWITCH = false` as the safe default.
`SOCIALFLOW_LINKEDIN_OAUTH_SOCIAL_DB_READ_SWITCH` remains OFF by default unless explicitly set for local tests.

## Preconditions
- `migrations/0189_socialflow_oauth_connections.sql` exists.
- Core source tables exist in local `DRACO_DB`:
  - `drako_integration_connections`
  - `drako_integration_credentials`
- Target table exists in local `SOCIAL_DB`:
  - `socialflow_oauth_connections`
- Local D1 bindings resolve with `wrangler.workers.toml` (default):
  - `DRACO_DB`
  - `SOCIAL_DB`

## Manual Commands (Local Only)
Run from repository root.

1. Backfill dry-run:

```bash
pnpm tsx scripts/backfill-socialflow-oauth-connections.ts --config=wrangler.workers.toml --dry-run
```

2. Backfill apply:

```bash
pnpm tsx scripts/backfill-socialflow-oauth-connections.ts --config=wrangler.workers.toml
```

3. Parity strict (fails with exit code `2` on drift):

```bash
pnpm tsx scripts/check-socialflow-oauth-connections-parity.ts --config=wrangler.workers.toml
```

4. Parity with drift allowed (returns `0` even with drift):

```bash
pnpm tsx scripts/check-socialflow-oauth-connections-parity.ts --config=wrangler.workers.toml --allow-drift
```

## Validation Pack (Automated Local Sequence)
Run from repository root:

```bash
pnpm tsx scripts/validate-socialflow-oauth-connections-local.ts --config=wrangler.workers.toml
```

The script executes in this exact order:
1. Verify `migrations/0189_socialflow_oauth_connections.sql` exists.
2. Run OAuth connections backfill in `--dry-run`.
3. Run OAuth connections backfill apply.
4. Run strict parity check (no `--allow-drift`).
5. Run OAuth validation tests:
   - `tests/lib/socialflow-linkedin-oauth.test.ts`
   - `tests/lib/socialflow-linkedin-oauth-social-ownership-prep-contract.test.ts`
   - `tests/backfill-socialflow-oauth-connections.test.ts`
   - `tests/check-socialflow-oauth-connections-parity.test.ts`

If any step fails, the script exits non-zero (fail-closed).

## Optional Local Switch Probe (No Prod)
To test social-first OAuth read behavior locally while preserving production defaults:

```bash
SOCIALFLOW_LINKEDIN_OAUTH_SOCIAL_DB_READ_SWITCH=1 npx vitest run tests/lib/linkedin-connection.test.ts
```

Expected behavior with switch ON:
1. Uses `SOCIAL_DB.socialflow_oauth_connections` when a valid prepared row exists.
2. Falls back to core-backed projection when SOCIAL_DB row is missing.
3. Falls back to core-backed projection when SOCIAL_DB read fails.

## Switch-ON Local Smoke (No Prod)
Run full local smoke with switch ON:

```bash
pnpm tsx scripts/smoke-socialflow-oauth-connections-switch-local.ts --config=wrangler.workers.toml
```

Expected smoke evidence:
- `EVIDENCE social-db-oauth-read`
- `EVIDENCE core-fallback-oauth-read`
- `EVIDENCE default-off-core-backed`

Operator bypass only (not final validation):

```bash
pnpm tsx scripts/smoke-socialflow-oauth-connections-switch-local.ts --config=wrangler.workers.toml --assume-validated
```

`--assume-validated` is only an operator shortcut and does not replace final strict validation.

## Safety Notes
- No remote D1 usage (`--remote` is not used).
- No deploy/workflow changes.
- No switch activation by default.
- No changes to connect/callback behavior.
- No changes to token/authMeta format or encryption behavior.
