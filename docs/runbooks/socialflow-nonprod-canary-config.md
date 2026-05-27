# SocialFlow Nonprod Canary Config

This runbook prepares and validates a non-production SocialFlow canary target only. It does not deploy. Remote D1 usage is limited to explicitly approved non-production provisioning or schema phases documented below.

## Current State

- `apps/socialflow-runtime/wrangler.toml` is the OpenNext runtime canary config for local/nonprod preparation.
- `workers/socialflows-runtime-canary/wrangler.workers.toml` mirrors the nonprod canary safety posture for the worker scaffold.
- Both configs must remain non-deployable while they use placeholder D1 ids.
- Production SocialFlow remains in `workers/socialflows/wrangler.workers.toml`.

## Required Nonprod D1 Bindings

The canary config must use isolated non-production databases:

- `DRACO_DB`: `drako_db_socialflow_canary`
- `SAASES_DB`: `saas_socialflows_registry_canary_db`
- `SOCIAL_DB`: `saas_socialflows_canary_db`
- `SOCIALFLOW_AUTHS_DB`: `saas_socialflow_auths_canary_db`

Placeholder ids beginning with `00000000-0000-4000-8000-` are intentionally not deployable. Replace them only after real non-production D1 databases exist.

## Manual D1 Creation Checklist

This repository phase does not create remote D1 databases. The operator must create non-production D1 databases manually in Cloudflare before replacing placeholders.

Suggested non-production database names:

- Core projection: `drako_db_socialflow_canary`
- SocialFlow product data: `saas_socialflows_canary_db`
- SocialFlow auth/OAuth state: `saas_socialflow_auths_canary_db`
- SocialFlow registry/SaaS metadata if separated from `SOCIAL_DB`: `saas_socialflows_registry_canary_db`

Recommended binding mapping after real D1 creation:

- `DRACO_DB` -> `drako_db_socialflow_canary`
- `SOCIAL_DB` -> `saas_socialflows_canary_db`
- `SOCIALFLOW_AUTHS_DB` -> `saas_socialflow_auths_canary_db`
- `SAASES_DB` -> `saas_socialflows_registry_canary_db` if separate, otherwise the canary SocialFlow registry/product D1 chosen by architecture.

After creation:

1. Copy the real non-production `database_id` values from Cloudflare.
2. Paste them manually into the canary config.
3. Keep `SOCIALFLOW_NONPROD_CANARY_DEPLOYABLE = "false"` until a dedicated activation phase approves deployment.
4. Run the guard command before any workflow or deploy preparation.
5. Do not reuse production database ids.
6. Do not use database names containing `prod`.

## Manual D1 Nonprod Creation And Placeholder Replacement

Do not run these commands during repository-only prep phases. They are the manual operator commands for a later Cloudflare nonprod provisioning step:

```bash
wrangler d1 create drako_db_socialflow_canary
wrangler d1 create saas_socialflows_canary_db
wrangler d1 create saas_socialflow_auths_canary_db
wrangler d1 create saas_socialflows_registry_canary_db
```

Expected binding map:

| Binding | D1 database_name | Purpose |
| --- | --- | --- |
| `DRACO_DB` | `drako_db_socialflow_canary` | Core/Campamento Base projection used only for nonprod fallback/parity. |
| `SOCIAL_DB` | `saas_socialflows_canary_db` | SocialFlow-owned runtime seed, exports, OAuth projections, and legacy read models. |
| `SOCIALFLOW_AUTHS_DB` | `saas_socialflow_auths_canary_db` | SocialFlow auth/OAuth nonprod state. |
| `SAASES_DB` | `saas_socialflows_registry_canary_db` | SocialFlow SaaS registry/metadata projection if separated from `SOCIAL_DB`. |

If architecture decides to keep `SAASES_DB` collapsed into `SOCIAL_DB` for nonprod, document that decision in the phase notes and still keep the `SAASES_DB` binding explicit in config.

After each `wrangler d1 create ...` command, Cloudflare prints a `database_id`. Copy only those real non-production ids into:

- `apps/socialflow-runtime/wrangler.toml`
- `workers/socialflows-runtime-canary/wrangler.workers.toml`

Replace only the `database_id` values that currently start with `00000000-0000-4000-8000-`. Keep the matching `database_name` aligned to the nonprod names above.

Do not touch:

- production config in `workers/socialflows/wrangler.workers.toml`;
- any `.github/workflows/**` file;
- any switch value;
- routes, runtime behavior, payloads, or OAuth logic.

Keep this line unchanged after replacing real nonprod ids:

```toml
SOCIALFLOW_NONPROD_CANARY_DEPLOYABLE = "false"
```

During placeholder replacement, keep all switches OFF until the dedicated runtime seed activation phase:

```toml
SOCIALFLOW_RUNTIME_SEED_SOCIAL_DB_READ_SWITCH = "0"
SOCIALFLOW_EXPORT_READ_MODELS_SOCIAL_DB_READ_SWITCH = "0"
SOCIALFLOW_LINKEDIN_OAUTH_SOCIAL_DB_READ_SWITCH = "0"
SOCIALFLOW_LEGACY_READ_MODELS_SOCIAL_DB_READ_SWITCH = "0"
```

Then run:

```bash
pnpm tsx scripts/check-socialflow-nonprod-canary-config.ts
```

Expected status after all placeholders are replaced with real non-production ids:

```text
NON_DEPLOYABLE_REAL_NONPROD_CONFIG
```

The guard must not report:

- `NON_DEPLOYABLE_PLACEHOLDER_CONFIG`, because that means placeholder ids remain;
- `DEPLOYABLE_REAL_NONPROD_CONFIG`, unless a later explicit deployability phase approves it;
- any error mentioning `prod`, productive ids, switches not OFF, missing bindings, or missing rollback state.

If the guard still reports placeholders, check the `placeholders` array in the JSON output. It lists exactly which bindings still need real non-production `database_id` values.

## Current Real Nonprod D1 Bindings

Created for the SocialFlow canary nonprod target:

| Binding | D1 database_name | D1 database_id |
| --- | --- | --- |
| `DRACO_DB` | `drako_db_socialflow_canary` | `ca873dbd-2c44-49ae-bf14-e1ce7f217fde` |
| `SAASES_DB` | `saas_socialflows_registry_canary_db` | `6951995a-141f-4338-acc5-f65be3d8c91e` |
| `SOCIAL_DB` | `saas_socialflows_canary_db` | `349fa685-044e-4292-b6e9-b1cafd35896e` |
| `SOCIALFLOW_AUTHS_DB` | `saas_socialflow_auths_canary_db` | `213b115b-9363-4a21-82d6-8db58c98d6df` |

Current expected guard status:

```text
NON_DEPLOYABLE_REAL_NONPROD_CONFIG
```

This status confirms real non-production D1 ids are present while deployment remains blocked.

## Nonprod Ownership Migrations

This step applies only the preparatory SocialFlow ownership schema to the real non-production `SOCIAL_DB`.
It does not deploy workers, does not activate switches, does not run backfill, and does not change OAuth/connect/callback behavior.

The migration target must remain:

```text
SOCIAL_DB -> saas_socialflows_canary_db
```

The database name must not contain `prod`, all switches must stay OFF, and `SOCIALFLOW_NONPROD_CANARY_DEPLOYABLE` must remain `false`.

Dry-run first. This prints the exact remote commands without executing them:

```bash
pnpm tsx scripts/apply-socialflow-nonprod-ownership-migrations.ts --dry-run
```

Verify current remote schema without applying files:

```bash
pnpm tsx scripts/apply-socialflow-nonprod-ownership-migrations.ts --verify-only
```

If verification reports missing tables and the guard status is still `NON_DEPLOYABLE_REAL_NONPROD_CONFIG`, apply the schema to nonprod only:

```bash
pnpm tsx scripts/apply-socialflow-nonprod-ownership-migrations.ts --apply
```

Then verify again:

```bash
pnpm tsx scripts/apply-socialflow-nonprod-ownership-migrations.ts --verify-only
```

Expected migrations:

| Migration | Target binding | Expected table(s) |
| --- | --- | --- |
| `0187_socialflow_seed_metadata.sql` | `SOCIAL_DB` | `socialflow_seed_metadata` |
| `0188_socialflow_export_read_models.sql` | `SOCIAL_DB` | `socialflow_export_read_models` |
| `0189_socialflow_oauth_connections.sql` | `SOCIAL_DB` | `socialflow_oauth_connections` |
| `0190_socialflow_legacy_read_models.sql` | `SOCIAL_DB` | `socialflow_legacy_strategic_dossiers`, `socialflow_legacy_tenant_progress`, `socialflow_legacy_agent_work_logs`, `socialflow_legacy_repository_context` |

Remote commands are limited to:

```bash
wrangler d1 execute saas_socialflows_canary_db --remote --file migrations/0187_socialflow_seed_metadata.sql
wrangler d1 execute saas_socialflows_canary_db --remote --file migrations/0188_socialflow_export_read_models.sql
wrangler d1 execute saas_socialflows_canary_db --remote --file migrations/0189_socialflow_oauth_connections.sql
wrangler d1 execute saas_socialflows_canary_db --remote --file migrations/0190_socialflow_legacy_read_models.sql
wrangler d1 execute saas_socialflows_canary_db --remote --command "SELECT name FROM sqlite_master WHERE type='table';"
wrangler d1 execute saas_socialflows_canary_db --remote --command "PRAGMA table_info(<table_name>);"
```

Do not run:

- `wrangler deploy`
- `wrangler d1 execute` against any database containing `prod`
- remote backfill
- remote OAuth smoke with real credentials
- any switch activation

OAuth remains schema-only at this stage. Keep `SOCIALFLOW_LINKEDIN_OAUTH_SOCIAL_DB_READ_SWITCH = "0"` until a later nonprod switch phase explicitly approves OAuth validation.

## Nonprod Ownership Backfill Without OAuth

This step backfills non-sensitive SocialFlow ownership read models in real non-production D1 only.
It does not deploy, does not activate switches, and explicitly excludes OAuth, tokens, credentials, and `socialflow_oauth_connections`.

Allowed source and target:

```text
source DRACO_DB -> drako_db_socialflow_canary
target SOCIAL_DB -> saas_socialflows_canary_db
```

The script refuses to run if either DB name contains `prod`, if placeholders remain, if canary is deployable, or if any switch is not `"0"`.

Dry-run first. It may read nonprod D1 metadata/data to calculate planned operations, but it does not write:

```bash
pnpm tsx scripts/backfill-socialflow-nonprod-ownership-read-models.ts --dry-run
```

Verify-only checks source/target availability and target counts without writing:

```bash
pnpm tsx scripts/backfill-socialflow-nonprod-ownership-read-models.ts --verify-only
```

Apply writes only non-OAuth read models into `SOCIAL_DB` nonprod:

```bash
pnpm tsx scripts/backfill-socialflow-nonprod-ownership-read-models.ts --apply
```

Then verify again:

```bash
pnpm tsx scripts/backfill-socialflow-nonprod-ownership-read-models.ts --verify-only
```

Backfill groups included:

| Group | Source DB/table(s) | Target DB/table |
| --- | --- | --- |
| Runtime seed | `DRACO_DB.saas` | `SOCIAL_DB.socialflow_seed_metadata` |
| Exports | `DRACO_DB.saas`, `tenant_strategic_dossiers`, `agent_work_logs`, `orchestrator_messages`, `economic_events`, `saas_domains` | `SOCIAL_DB.socialflow_export_read_models` |
| Legacy dossiers | `DRACO_DB.tenant_strategic_dossiers` | `SOCIAL_DB.socialflow_legacy_strategic_dossiers` |
| Legacy progress | `DRACO_DB.tenants` | `SOCIAL_DB.socialflow_legacy_tenant_progress` |
| Legacy work logs | `DRACO_DB.agent_work_logs` | `SOCIAL_DB.socialflow_legacy_agent_work_logs` |
| Legacy repository context | `DRACO_DB.saas`, `saas_domains` | `SOCIAL_DB.socialflow_legacy_repository_context` |

Explicitly not touched:

- `SOCIAL_DB.socialflow_oauth_connections`
- `DRACO_DB.drako_integration_credentials`
- `DRACO_DB.drako_integration_connections`
- encrypted access/refresh/id tokens
- OAuth connect/callback behavior

If `DRACO_DB` nonprod is empty or not yet bootstrapped, the script reports zero rows with warnings such as `SOURCE_TABLE_MISSING` and does not fail. That is safe at this stage; the next phase should run nonprod parity after source projections exist.

Next phase after this backfill:

```text
SocialFlow nonprod ownership parity without OAuth
```

## Nonprod Ownership Parity Without OAuth

This step compares non-production `DRACO_DB` source projections against non-production `SOCIAL_DB` ownership read models.
It is read-only: no deploy, no migrations, no backfill, no switch activation, and no remote writes.

Allowed source and target:

```text
source DRACO_DB -> drako_db_socialflow_canary
target SOCIAL_DB -> saas_socialflows_canary_db
```

Run strict parity first when the source canary DB is expected to contain core source tables:

```bash
pnpm tsx scripts/check-socialflow-nonprod-ownership-parity.ts
```

Current canary source may still be empty or not bootstrapped. In that case, use the explicit empty-source acknowledgement:

```bash
pnpm tsx scripts/check-socialflow-nonprod-ownership-parity.ts --allow-empty-source
```

JSON output is available for audit artifacts:

```bash
pnpm tsx scripts/check-socialflow-nonprod-ownership-parity.ts --allow-empty-source --json
```

If drift is expected during a controlled investigation, it must be acknowledged explicitly:

```bash
pnpm tsx scripts/check-socialflow-nonprod-ownership-parity.ts --allow-drift
```

Parity reads these source tables only:

- `DRACO_DB.saas`
- `DRACO_DB.tenant_strategic_dossiers`
- `DRACO_DB.agent_work_logs`
- `DRACO_DB.tenants`
- `DRACO_DB.saas_domains`

Parity reads these target tables only:

- `SOCIAL_DB.socialflow_seed_metadata`
- `SOCIAL_DB.socialflow_export_read_models`
- `SOCIAL_DB.socialflow_legacy_strategic_dossiers`
- `SOCIAL_DB.socialflow_legacy_tenant_progress`
- `SOCIAL_DB.socialflow_legacy_agent_work_logs`
- `SOCIAL_DB.socialflow_legacy_repository_context`

Explicitly not touched:

- `SOCIAL_DB.socialflow_oauth_connections`
- `DRACO_DB.drako_integration_connections`
- `DRACO_DB.drako_integration_credentials`
- tokens
- credentials
- `authMeta`
- OAuth connect/callback behavior

Expected exit codes:

- `0`: parity OK, drift allowed, or empty source accepted explicitly.
- `1`: operational/config error.
- `2`: drift detected in strict mode.
- `3`: empty source detected without `--allow-empty-source`.

After strict parity is green, run the switches-off smoke before activating the runtime seed read switch.

## Nonprod Source Data Bootstrap Without OAuth

This step creates a minimal, synthetic, non-sensitive source dataset in `DRACO_DB` canary so nonprod backfill and parity can validate real rows without touching production.
It writes only to `drako_db_socialflow_canary`; it does not write to `SOCIAL_DB`, `SAASES_DB`, or `SOCIALFLOW_AUTHS_DB`.

Run dry-run first:

```bash
pnpm tsx scripts/bootstrap-socialflow-nonprod-source-data.ts --dry-run
```

Verify current canary source state:

```bash
pnpm tsx scripts/bootstrap-socialflow-nonprod-source-data.ts --verify-only
```

Apply the minimal synthetic source data only after reviewing dry-run/verify output:

```bash
pnpm tsx scripts/bootstrap-socialflow-nonprod-source-data.ts --apply
```

Verify again:

```bash
pnpm tsx scripts/bootstrap-socialflow-nonprod-source-data.ts --verify-only
```

Tables touched in `DRACO_DB` canary:

- `saas`
- `tenants`
- `saas_domains`
- `tenant_strategic_dossiers`
- `agent_work_logs`
- `orchestrator_messages`
- `economic_events`

Synthetic canary data inserted or ensured:

- tenant: `tenant_socialflow_canary`
- SaaS: `saas_socialflow_canary`
- slug: `socialflow`
- domain: `socialflow-canary.local`
- dossier: `dossier_socialflow_canary`
- work log: `worklog_socialflow_canary`
- orchestrator message: `message_socialflow_canary`
- economic event: `event_socialflow_canary`

Observed schema posture of the synthetic canary source after bootstrap:

- `tenants` uses `tenant_id` as the primary key in this nonprod seed, not `id`;
- `saas_domains` is intentionally minimal and does not include `is_primary`;
- this is sufficient for the nonprod ownership backfill/parity flow documented here;
- this is not evidence of production drift by itself, but it is a compatibility debt if someone tries to reuse older standalone local backfill/parity scripts that assume richer core schemas.

Explicitly not touched:

- `SOCIAL_DB`
- `SAASES_DB`
- `SOCIALFLOW_AUTHS_DB`
- `socialflow_oauth_connections`
- `drako_integration_connections`
- `drako_integration_credentials`
- tokens
- credentials
- `authMeta`
- secrets
- real customer or personal data

Safety invariants:

- all SocialFlow switches remain `"0"`;
- `SOCIALFLOW_NONPROD_CANARY_DEPLOYABLE` remains `"false"`;
- no deploy;
- no production database;
- no OAuth/tokens/credentials;
- no destructive SQL.

After this bootstrap, rerun:

```bash
pnpm tsx scripts/backfill-socialflow-nonprod-ownership-read-models.ts --apply
pnpm tsx scripts/check-socialflow-nonprod-ownership-parity.ts
```

Strict parity should no longer require `--allow-empty-source` once the source bootstrap and backfill have both completed.

Strict parity classification for this phase:

- `missingInSocial` before backfill is expected and means `SOCIAL_DB` is still empty for the ownership tables;
- `emptySources` after bootstrap is not expected and should be treated as incomplete source data;
- `mismatched` after backfill should be treated as either a mapping bug or a real drift investigation, not hidden with `--allow-drift`;
- `missingInCore` after backfill usually means residual rows in `SOCIAL_DB` that are not justified by current canary source data and should be audited explicitly.

## Smoke With Switches Off

Once strict parity is green, the pre-activation smoke for S3.11L should stay fully read-only:

```bash
pnpm tsx scripts/smoke-socialflow-nonprod-canary-with-switches-off.ts
```

What this smoke does:

- re-runs the canary guard on both `wrangler` configs and requires `NON_DEPLOYABLE_REAL_NONPROD_CONFIG`;
- checks read-only D1 accessibility for `DRACO_DB`, `SAASES_DB`, `SOCIAL_DB`, and `SOCIALFLOW_AUTHS_DB` using `SELECT 1 AS ok`;
- re-runs `bootstrap-socialflow-nonprod-source-data.ts --verify-only`;
- re-runs `backfill-socialflow-nonprod-ownership-read-models.ts --verify-only`;
- re-runs strict `check-socialflow-nonprod-ownership-parity.ts` without `--allow-empty-source`;
- asserts `remoteWrites: 0` end to end;
- keeps OAuth out of scope and does not read OAuth tables, tokens, credentials, or secrets.

Expected exit criteria:

- all four switches remain `"0"`;
- `SOCIALFLOW_NONPROD_CANARY_DEPLOYABLE` remains `"false"`;
- source verify returns `VERIFY_OK`;
- ownership verify returns `VERIFY_OK` with non-zero `targetCounts` for all six read-model tables;
- strict parity returns `PARITY_OK` with `matched > 0`, `missingInSocial: 0`, `missingInCore: 0`, `mismatched: 0`, `emptySources: 0`;
- next phase recommendation is only `SOCIALFLOW_RUNTIME_SEED_SOCIAL_DB_READ_SWITCH`.

This smoke is intentionally not an HTTP canary smoke. For this phase, read-only config plus D1 verification is the safe path because no deploy, auth bypass, or switch activation is allowed.

## Runtime Seed Switch On Smoke

S3.11M activates only the runtime seed read switch in nonprod/canary config:

```toml
SOCIALFLOW_RUNTIME_SEED_SOCIAL_DB_READ_SWITCH = "1"
SOCIALFLOW_EXPORT_READ_MODELS_SOCIAL_DB_READ_SWITCH = "0"
SOCIALFLOW_LINKEDIN_OAUTH_SOCIAL_DB_READ_SWITCH = "0"
SOCIALFLOW_LEGACY_READ_MODELS_SOCIAL_DB_READ_SWITCH = "0"
```

Run the local contract smoke:

```bash
pnpm tsx scripts/smoke-socialflow-nonprod-runtime-seed-switch.ts
```

What this smoke does:

- re-runs the canary guard on both `wrangler` configs and requires `NON_DEPLOYABLE_REAL_NONPROD_CONFIG`;
- requires only `SOCIALFLOW_RUNTIME_SEED_SOCIAL_DB_READ_SWITCH = "1"`;
- requires exports, OAuth, and legacy read switches to remain `"0"`;
- runs the runtime seed contract test suite with the runtime seed switch enabled;
- confirms contract coverage for SOCIAL_DB-first read, core fallback, and SOCIAL_DB failure fallback;
- performs no deploy, no remote D1 command, no backfill, no migration, and no OAuth/token/credential access.

Immediate rollback is a config-only change back to:

```toml
SOCIALFLOW_RUNTIME_SEED_SOCIAL_DB_READ_SWITCH = "0"
```

Rollback posture must be explicit:

```toml
SOCIALFLOW_NONPROD_CANARY_DEPLOYABLE = "false"
SOCIALFLOW_CANARY_ROLLBACK_SWITCH_STATE = "all-switches-off"
```

Future deployability must remain explicit. A config with real non-production D1 ids is accepted with `SOCIALFLOW_NONPROD_CANARY_DEPLOYABLE = "false"`. If a later phase intentionally prepares deployability, it must use real non-production D1 ids and add an explicit future approval flag:

```toml
SOCIALFLOW_NONPROD_CANARY_ALLOW_DEPLOY_WITH_REAL_D1 = "true"
```

Do not set that flag while placeholder ids remain.

## Runtime Seed Switch Separation Validation

S3.11N validates that runtime seed ON improves SocialFlow SaaS separation without activating more switches.

Required baseline:

```bash
pnpm tsx scripts/check-socialflow-nonprod-canary-config.ts
pnpm tsx scripts/smoke-socialflow-nonprod-runtime-seed-switch.ts
pnpm tsx scripts/smoke-socialflow-nonprod-runtime-seed-switch.ts --json
pnpm tsx scripts/check-socialflow-nonprod-ownership-parity.ts
```

Expected posture:

- `SOCIALFLOW_RUNTIME_SEED_SOCIAL_DB_READ_SWITCH = "1"`;
- exports, OAuth, and legacy read switches remain `"0"`;
- `SOCIALFLOW_NONPROD_CANARY_DEPLOYABLE = "false"`;
- guard reports `NON_DEPLOYABLE_REAL_NONPROD_CONFIG`;
- runtime seed smoke reports `RUNTIME_SEED_SWITCH_SMOKE_OK`;
- strict parity reports `PARITY_OK` without `--allow-empty-source`;
- smoke and parity report `remoteWrites: 0`;
- OAuth/tokens/credentials stay excluded.

Boundary validation:

```bash
npx vitest run tests/architecture/socialflow-draco-dependency-radar.test.ts
npx vitest run tests/architecture/saas-boundary-import-guards.test.ts
```

What this proves:

- runtime seed reads can start from `SOCIAL_DB.socialflow_seed_metadata`;
- `DRACO_DB.saas` is now a fallback path for runtime seed, not the first read path when the switch is ON and `SOCIAL_DB` has an active seed;
- Campamento Base observes SocialFlow through `src/lib/socialflow/contracts/campobase`, operator routes, and runtime health/readiness surfaces;
- Campamento Base must not import `apps/socialflow-runtime/src/**`, `src/lib/socialflow/repository`, or SocialFlow OAuth/token internals directly.

Rollback remains a config-only change:

```toml
SOCIALFLOW_RUNTIME_SEED_SOCIAL_DB_READ_SWITCH = "0"
SOCIALFLOW_EXPORT_READ_MODELS_SOCIAL_DB_READ_SWITCH = "0"
SOCIALFLOW_LINKEDIN_OAUTH_SOCIAL_DB_READ_SWITCH = "0"
SOCIALFLOW_LEGACY_READ_MODELS_SOCIAL_DB_READ_SWITCH = "0"
```

Do not activate exports/OAuth/legacy in this phase. The next recommended phase is export read-model preparation with `SOCIAL_DB`-first contract evidence, strict parity, and explicit fallback observability.

See `docs/architecture/socialflow-runtime-seed-switch-separation-audit.md` for the separation findings and residual dependencies.

## Exports Switch Preparation

S3.11O prepares the future activation of the exports read switch without activating it.

Required baseline:

```bash
pnpm tsx scripts/check-socialflow-nonprod-canary-config.ts
pnpm tsx scripts/smoke-socialflow-nonprod-runtime-seed-switch.ts
pnpm tsx scripts/check-socialflow-nonprod-ownership-parity.ts
```

Expected posture:

- `SOCIALFLOW_RUNTIME_SEED_SOCIAL_DB_READ_SWITCH = "1"`;
- `SOCIALFLOW_EXPORT_READ_MODELS_SOCIAL_DB_READ_SWITCH = "0"` (prepared for activation);
- OAuth and legacy read switches remain `"0"`;
- `SOCIALFLOW_NONPROD_CANARY_DEPLOYABLE = "false"`;
- guard reports `NON_DEPLOYABLE_REAL_NONPROD_CONFIG`;
- runtime seed smoke reports `RUNTIME_SEED_SWITCH_SMOKE_OK`;
- strict parity reports `PARITY_OK` without `--allow-empty-source`;
- smoke and parity report `remoteWrites: 0`;
- OAuth/tokens/credentials stay excluded.

Exports switch prep smoke:

```bash
pnpm tsx scripts/smoke-socialflow-nonprod-exports-switch-prep.ts
pnpm tsx scripts/smoke-socialflow-nonprod-exports-switch-prep.ts --json
```

What this smoke does:

- Re-runs the canary guard on both `wrangler` configs and requires `NON_DEPLOYABLE_REAL_NONPROD_CONFIG`;
- Requires runtime seed switch `"1"`, exports switch `"0"`, OAuth switch `"0"`, legacy switch `"0"`;
- Runs exports contract test suite (`tests/lib/socialflow-export-social-read-prep-contract.test.ts`);
- Runs exports service test suite (`apps/socialflow-runtime/src/lib/socialflow/exports-service.test.ts`);
- Runs strict ownership parity without `--allow-empty-source`;
- Asserts `remoteWrites: 0`, `deploy: false`, `oauthExcluded: true`;
- Emits `EXPORTS_SWITCH_PREP_OK` if all checks pass.

What this proves:

- Exports contract reads `SOCIAL_DB.socialflow_export_read_models` first when switch is ON.
- Core fallback is available and tested when SOCIAL_DB is missing or fails.
- ZIP/payload format is unchanged between SOCIAL_DB-first and core fallback paths.
- Strict parity is green for export rows.
- OAuth is excluded.
- Remote writes are zero.
- Deploy is blocked.

Rollback remains a config-only change:

```toml
SOCIALFLOW_EXPORT_READ_MODELS_SOCIAL_DB_READ_SWITCH = "0"
```

Do not activate exports in this phase. The next recommended phase is exports switch activation in nonprod only, with export source selection observability and fallback count monitoring.

See `docs/architecture/socialflow-exports-switch-prep-audit.md` for the exports preparation findings and gaps.

## Exports Switch Nonprod Activation

S3.12 activates the exports read switch in nonprod only.

Required baseline:

```bash
pnpm tsx scripts/check-socialflow-nonprod-canary-config.ts
pnpm tsx scripts/smoke-socialflow-nonprod-runtime-seed-switch.ts
pnpm tsx scripts/smoke-socialflow-nonprod-exports-switch-prep.ts
pnpm tsx scripts/check-socialflow-nonprod-ownership-parity.ts
```

Expected posture:

- `SOCIALFLOW_RUNTIME_SEED_SOCIAL_DB_READ_SWITCH = "1"`;
- `SOCIALFLOW_EXPORT_READ_MODELS_SOCIAL_DB_READ_SWITCH = "1"` (activated);
- OAuth and legacy read switches remain `"0"`;
- `SOCIALFLOW_NONPROD_CANARY_DEPLOYABLE = "false"`;
- guard reports `NON_DEPLOYABLE_REAL_NONPROD_CONFIG`;
- runtime seed smoke reports `RUNTIME_SEED_SWITCH_SMOKE_OK`;
- exports smoke reports `EXPORTS_SWITCH_SMOKE_OK`;
- strict parity reports `PARITY_OK` without `--allow-empty-source`;
- smoke and parity report `remoteWrites: 0`;
- OAuth/tokens/credentials stay excluded.

Exports switch smoke:

```bash
pnpm tsx scripts/smoke-socialflow-nonprod-exports-switch.ts
pnpm tsx scripts/smoke-socialflow-nonprod-exports-switch.ts --json
```

What this smoke does:

- Re-runs the canary guard on both `wrangler` configs and requires `NON_DEPLOYABLE_REAL_NONPROD_CONFIG`;
- Requires runtime seed switch `"1"`, exports switch `"1"`, OAuth switch `"0"`, legacy switch `"0"`;
- Runs exports contract test suite (`tests/lib/socialflow-export-social-read-prep-contract.test.ts`);
- Runs exports service test suite (`apps/socialflow-runtime/src/lib/socialflow/exports-service.test.ts`);
- Runs strict ownership parity without `--allow-empty-source`;
- Asserts `remoteWrites: 0`, `deploy: false`, `oauthExcluded: true`;
- Emits `EXPORTS_SWITCH_SMOKE_OK` if all checks pass.

What this proves:

- Exports read from `SOCIAL_DB.socialflow_export_read_models` first when switch is ON.
- Core fallback is available and tested when SOCIAL_DB is missing or fails.
- ZIP/payload format is unchanged between SOCIAL_DB-first and core fallback paths.
- Strict parity is green for export rows.
- OAuth is excluded.
- Remote writes are zero.
- Deploy is blocked.

Rollback remains a config-only change:

```toml
SOCIALFLOW_EXPORT_READ_MODELS_SOCIAL_DB_READ_SWITCH = "0"
```

Do not activate OAuth or legacy in this phase. The next recommended phase is monitoring exports SOCIAL_DB-first behavior, then legacy read models activation. OAuth should be the last switch.

## Guard Command

Run from repository root:

```bash
pnpm tsx scripts/check-socialflow-nonprod-canary-config.ts
```

To check a specific config:

```bash
pnpm tsx scripts/check-socialflow-nonprod-canary-config.ts --config=apps/socialflow-runtime/wrangler.toml
```

The guard fails if:

- any canary database name contains `prod`;
- any known productive D1 id is reused;
- `DRACO_DB`, `SAASES_DB`, `SOCIAL_DB`, or `SOCIALFLOW_AUTHS_DB` is missing;
- runtime seed read switch is not `"0"` or `"1"`;
- exports, OAuth, or legacy SOCIAL_DB read switches are ON;
- rollback state is missing;
- placeholder ids are marked deployable;
- real non-production ids are marked deployable without `SOCIALFLOW_NONPROD_CANARY_ALLOW_DEPLOY_WITH_REAL_D1 = "true"`.

The guard reports one of these states:

- `NON_DEPLOYABLE_PLACEHOLDER_CONFIG`: safe for local validation only; never deploy.
- `NON_DEPLOYABLE_REAL_NONPROD_CONFIG`: real non-production ids are present, but deployment is still blocked.
- `DEPLOYABLE_REAL_NONPROD_CONFIG`: real non-production ids plus an explicit future allow-deploy flag are present.

## Future Activation Order

Do not deploy in this phase. Do not use remote D1 in this phase. Do not activate exports, OAuth, or legacy switches in this phase.

Future nonprod activation should happen in this order:

1. Create isolated non-production D1 databases.
2. Replace placeholder ids with real non-production ids.
3. Run the nonprod canary config guard.
4. Confirm status is `NON_DEPLOYABLE_REAL_NONPROD_CONFIG`.
5. Apply migrations `0187`, `0188`, `0189`, and `0190` to nonprod only in a later remote-approved phase.
6. Run backfill in nonprod in a later remote-approved phase.
7. Run strict parity in nonprod in a later remote-approved phase.
8. Run smoke in nonprod with all switches OFF.
9. Activate exactly one switch, starting with runtime seed.
10. Run smoke for that switch.
11. Roll back runtime seed to switch OFF if smoke fails or if the activation window ends.

OAuth should be the last or penultimate switch because it touches connection state, token metadata, and encryption-sensitive data.

## Runtime Seed And Exports Readiness Before Legacy

**Phase:** S3.13
**Purpose:** Validate combined runtime seed + exports ON stability before activating legacy
**Prerequisites:** Runtime seed ON, exports ON, OAuth OFF, legacy OFF, parity green

This phase creates a monitoring/readiness layer to confirm that SocialFlow with runtime seed + exports ON is stable and ready for legacy switch activation.

### Required Baseline

Before running readiness smoke, confirm:

```toml
SOCIALFLOW_RUNTIME_SEED_SOCIAL_DB_READ_SWITCH = "1"              # ON
SOCIALFLOW_EXPORT_READ_MODELS_SOCIAL_DB_READ_SWITCH = "1"       # ON
SOCIALFLOW_LINKEDIN_OAUTH_SOCIAL_DB_READ_SWITCH = "0"           # OFF
SOCIALFLOW_LEGACY_READ_MODELS_SOCIAL_DB_READ_SWITCH = "0"       # OFF
SOCIALFLOW_NONPROD_CANARY_DEPLOYABLE = "false"                  # NOT DEPLOYABLE
SOCIALFLOW_CANARY_ROLLBACK_SWITCH_STATE = "all-switches-off"    # ROLLBACK READY
```

Databases:
- `DRACO_DB`: `drako_db_socialflow_canary`
- `SAASES_DB`: `saas_socialflows_registry_canary_db`
- `SOCIAL_DB`: `saas_socialflows_canary_db`
- `SOCIALFLOW_AUTHS_DB`: `saas_socialflow_auths_canary_db`

No database contains `prod` token.

### Expected Posture

- **Runtime seed:** Reads from `SOCIAL_DB.socialflow_seed_metadata` first, falls back to `DRACO_DB.saas` if missing/failed
- **Exports:** Reads from `SOCIAL_DB.socialflow_export_read_models` first, falls back to core-backed export if missing/failed
- **OAuth:** OFF, excluded from parity
- **Legacy:** OFF, not activated yet
- **Fallback:** Available but **not used** in healthy path
- **Parity:** Strict OK, no drift
- **Deploy:** Blocked
- **Remote writes:** 0

### Smoke Readiness

Run from repository root:

```bash
pnpm tsx scripts/smoke-socialflow-nonprod-runtime-and-exports-readiness.ts
```

JSON mode:

```bash
pnpm tsx scripts/smoke-socialflow-nonprod-runtime-and-exports-readiness.ts --json
```

### Expected JSON Output

```json
{
  "ok": true,
  "status": "SOCIALFLOW_RUNTIME_EXPORTS_READINESS_OK",
  "runtimeSeedSwitch": "1",
  "exportsSwitch": "1",
  "oauthSwitch": "0",
  "legacySwitch": "0",
  "deployable": false,
  "runtimeSeedSource": "SOCIAL_DB",
  "exportsSource": "SOCIAL_DB",
  "fallbacksAvailable": true,
  "fallbacksUsedInHealthyPath": false,
  "parityReport": {
    "status": "PARITY_OK",
    "runtimeSeedGroupMatched": 1,
    "exportsGroupMatched": 1,
    "missingInSocial": 0,
    "missingInCore": 0,
    "mismatched": 0
  },
  "remoteWrites": 0,
  "deploy": false,
  "oauthExcluded": true,
  "configuredDatabases": [
    "drako_db_socialflow_canary",
    "saas_socialflows_registry_canary_db",
    "saas_socialflows_canary_db",
    "saas_socialflow_auths_canary_db"
  ],
  "contractEvidence": {
    "runtimeSeedTestPath": "tests/lib/socialflow-runtime-seed-contract.test.ts",
    "runtimeSeedValidatesSocialFirstRead": true,
    "runtimeSeedValidatesCoreFallback": true,
    "runtimeSeedValidatesSocialDbFailureFallback": true,
    "exportsTestPath": "apps/socialflow-runtime/src/lib/socialflow/exports-service.test.ts",
    "exportsValidatesSocialDbFirstRead": true,
    "exportsValidatesCoreFallbackOnMissing": true,
    "exportsValidatesCoreFallbackOnError": true,
    "exportsValidatesZipPayloadIntact": true,
    "exportsSocialReadPrepTestPath": "tests/lib/socialflow-export-social-read-prep-contract.test.ts",
    "exportsSocialReadPrepValidatesSocialDbTable": true,
    "exportsSocialReadPrepValidatesFailClosed": true
  },
  "rollbackReady": true,
  "rollbackTarget": {
    "runtimeSeedToOff": true,
    "exportsToOff": true,
    "configPaths": [
      "apps/socialflow-runtime/wrangler.toml",
      "workers/socialflows-runtime-canary/wrangler.workers.toml"
    ]
  },
  "nextPhaseRecommendation": "PREPARE_LEGACY_SWITCH_NONPROD"
}
```

### What The Readiness Smoke Proves

1. **Runtime seed SOCIAL_DB-first:** Reads from `SOCIAL_DB.socialflow_seed_metadata`, contract tests pass
2. **Exports SOCIAL_DB-first:** Reads from `SOCIAL_DB.socialflow_export_read_models`, contract tests pass
3. **Core fallback available:** Both have core fallback if SOCIAL_DB missing/failed
4. **Fallback not used in healthy path:** Expected fallback count = 0 in stable state
5. **Parity strict OK:** Runtime seed + exports matched, no drift, no missing in SOCIAL_DB
6. **ZIP integrity preserved:** Export payload format intact
7. **OAuth excluded:** No OAuth tokens in parity checks
8. **Legacy OFF:** Not activated yet
9. **No remote writes:** `remoteWrites: 0`
10. **No deploy:** `deployable: false`
11. **Rollback ready:** Config-only rollback available

### Criteria For Legacy Activation

Before activating `SOCIALFLOW_LEGACY_READ_MODELS_SOCIAL_DB_READ_SWITCH = "1"`, confirm:

- [ ] Readiness smoke passes consistently (run daily for 3-7 days)
- [ ] Fallback count = 0 (no fallback warnings in logs)
- [ ] Parity strict OK (no drift detected)
- [ ] No missing rows in SOCIAL_DB
- [ ] No SOCIAL_DB read failures
- [ ] ZIP payload integrity validated
- [ ] Campamento Base boundary respected (no internal imports)
- [ ] OAuth still OFF
- [ ] Legacy still OFF
- [ ] No deployment
- [ ] No production changes

### Rollback If Readiness Fails

**Runtime seed rollback:**

```toml
SOCIALFLOW_RUNTIME_SEED_SOCIAL_DB_READ_SWITCH = "0"
```

**Exports rollback:**

```toml
SOCIALFLOW_EXPORT_READ_MODELS_SOCIAL_DB_READ_SWITCH = "0"
```

**Combined rollback:**

```toml
SOCIALFLOW_RUNTIME_SEED_SOCIAL_DB_READ_SWITCH = "0"
SOCIALFLOW_EXPORT_READ_MODELS_SOCIAL_DB_READ_SWITCH = "0"
```

Rollback is config-only. No deploy, no migration rollback, no remote D1 writes.

### Guard Usage With Readiness

The guard script `scripts/check-socialflow-nonprod-canary-config.ts` now allows:
- Runtime seed switch `"0"` or `"1"`
- Exports switch `"0"` or `"1"`
- OAuth switch must be `"0"`
- Legacy switch must be `"0"`

The parity script `scripts/check-socialflow-nonprod-ownership-parity.ts` now allows:
- Runtime seed switch `"0"` or `"1"`
- Exports switch `"0"` or `"1"`
- OAuth switch must be `"0"`
- Legacy switch must be `"0"`

### Next Phase After Readiness

**Phase:** S3.14 — Prepare Legacy Switch Nonprod

**Prerequisites:**
- ✅ Runtime seed + exports readiness confirmed
- ✅ Fallback count = 0
- ✅ Parity strict OK
- ✅ No drift for 3-7 days

**Scope:**
- Activate `SOCIALFLOW_LEGACY_READ_MODELS_SOCIAL_DB_READ_SWITCH = "1"`
- Create legacy switch smoke script
- Validate legacy SOCIAL_DB-first + core fallback
- Update guard scripts
- Update parity checks

**Still forbidden:**
- ❌ No OAuth activation (OAuth is last)
- ❌ No deploy
- ❌ No production

## Daily Readiness Monitoring Before Legacy

**Phase:** S3.13B
**Purpose:** Track daily readiness before legacy activation
**Minimum recommended:** 3-7 days
**Monitoring document:** `docs/architecture/socialflow-readiness-monitoring-before-legacy.md`

This phase requires **daily execution** of the readiness smoke to confirm stability before activating legacy switch.

### Daily Command

Run from repository root:

```bash
pnpm tsx scripts/smoke-socialflow-nonprod-runtime-and-exports-readiness.ts
```

JSON mode for detailed report:

```bash
pnpm tsx scripts/smoke-socialflow-nonprod-runtime-and-exports-readiness.ts --json
```

### Expected Output

**Normal mode:**
```
{
  "ok": true,
  "status": "SOCIALFLOW_RUNTIME_EXPORTS_READINESS_OK",
  "runtimeSeedSwitch": "1",
  "exportsSwitch": "1",
  "oauthSwitch": "0",
  "legacySwitch": "0",
  "deployable": false,
  "runtimeSeedSource": "SOCIAL_DB",
  "exportsSource": "SOCIAL_DB",
  "fallbacksAvailable": true,
  "fallbacksUsedInHealthyPath": false,
  "parityReport": {
    "status": "PARITY_OK",
    "runtimeSeedGroupMatched": 1,
    "exportsGroupMatched": 1,
    "missingInSocial": 0,
    "missingInCore": 0,
    "mismatched": 0
  },
  "remoteWrites": 0,
  "deploy": false,
  "oauthExcluded": true,
  "nextPhaseRecommendation": "PREPARE_LEGACY_SWITCH_NONPROD"
}
SOCIALFLOW_RUNTIME_EXPORTS_READINESS_SUCCESS
```

### Minimum Recommended Monitoring

Before activating legacy switch, monitor daily for **3-7 days** minimum:

| Metric | Required Value | Alert If |
|--------|----------------|----------|
| `fallbacksUsedInHealthyPath` | `false` | `true` → investigate |
| `parityReport.status` | `"PARITY_OK"` | any other → rollback |
| `parityReport.missingInSocial` | `0` | `> 0` → rollback |
| `parityReport.mismatched` | `0` | `> 0` → rollback |
| `remoteWrites` | `0` | `> 0` → investigate |
| `deployable` | `false` | `true` → blocked |
| `oauthSwitch` | `"0"` | `"1"` → rollback |
| `legacySwitch` | `"0"` | `"1"` → rollback |

### Criteria For Preparing Legacy

After minimum 3-7 days of monitoring, confirm:

- [x] Day 1 readiness passes
- [ ] Day 2 readiness passes
- [ ] Day 3 readiness passes
- [ ] Minimum 3 consecutive days stable
- [ ] Fallback count = 0 for all monitored days
- [ ] Parity strict OK for all monitored days
- [ ] No drift detected
- [ ] No SOCIAL_DB read failures
- [ ] ZIP integrity validated consistently
- [ ] remoteWrites = 0 for all monitored days
- [ ] deployable = false for all monitored days

Once criteria met, proceed to S3.14 (Prepare Legacy Switch Nonprod).

### Rollback Criteria

Rollback runtime seed + exports **immediately** if:

- ❌ Parity drift detected (`missingInSocial > 0`)
- ❌ Parity mismatch detected (`mismatched > 0`)
- ❌ Fallback used in healthy path (`fallbacksUsedInHealthyPath: true`)
- ❌ SOCIAL_DB read failures in logs
- ❌ ZIP payload corruption
- ❌ OAuth accidentally activated (`oauthSwitch: "1"`)
- ❌ Legacy accidentally activated (`legacySwitch: "1"`)

**Rollback commands:**

Runtime seed rollback:
```toml
SOCIALFLOW_RUNTIME_SEED_SOCIAL_DB_READ_SWITCH = "0"
```

Exports rollback:
```toml
SOCIALFLOW_EXPORT_READ_MODELS_SOCIAL_DB_READ_SWITCH = "0"
```

Combined rollback:
```toml
SOCIALFLOW_RUNTIME_SEED_SOCIAL_DB_READ_SWITCH = "0"
SOCIALFLOW_EXPORT_READ_MODELS_SOCIAL_DB_READ_SWITCH = "0"
```

Rollback is config-only. No deploy required.

### Recording Daily Results

Update monitoring document daily:

```bash
# Edit this file after each daily run
docs/architecture/socialflow-readiness-monitoring-before-legacy.md
```

Record:
- Date/time
- Day number
- All metric values
- Parity status
- Fallback count
- Any warnings or errors
- Recommendation

### OAuth Activation Timeline

OAuth is the **last** switch to activate:

1. ✅ Runtime seed ON (completed S3.11)
2. ✅ Exports ON (completed S3.12)
3. ⏳ Monitor runtime seed + exports (S3.13B, in progress)
4. ⏳ Legacy ON (S3.14, after monitoring complete)
5. ⏳ Monitor runtime seed + exports + legacy (S3.14B, after S3.14)
6. ⏳ OAuth ON (S3.15, after legacy stable)

**Total estimated timeline:** 6-14 days (3-7 days per monitoring phase)

---

## OAuth Switch Preparation And Final Cutover Map

### Current State (S3.15 Complete)

**Switches:**
```toml
SOCIALFLOW_RUNTIME_SEED_SOCIAL_DB_READ_SWITCH = "1"  # ✅ ON
SOCIALFLOW_EXPORT_READ_MODELS_SOCIAL_DB_READ_SWITCH = "1"  # ✅ ON
SOCIALFLOW_LEGACY_READ_MODELS_SOCIAL_DB_READ_SWITCH = "1"  # ✅ ON
SOCIALFLOW_LINKEDIN_OAUTH_SOCIAL_DB_READ_SWITCH = "0"  # ⏸️ OFF (prep complete)
SOCIALFLOW_NONPROD_CANARY_DEPLOYABLE = "false"  # ✅ NOT DEPLOYABLE
```

**Status:** 3/4 switches ON, OAuth prep complete but NOT activated

### OAuth Preparation Validation

**Smoke Script:**
```bash
pnpm tsx scripts/smoke-socialflow-nonprod-oauth-switch-prep.ts
pnpm tsx scripts/smoke-socialflow-nonprod-oauth-switch-prep.ts --json
```

**Expected Output:**
```json
{
  "ok": true,
  "status": "OAUTH_SWITCH_PREP_OK",
  "runtimeSeedSwitch": "1",
  "exportsSwitch": "1",
  "legacySwitch": "1",
  "oauthSwitch": "0",
  "deployable": false,
  "tokenSafe": true,
  "oauthExcluded": true,
  "rollbackReady": true
}
```

**What This Proves:**
- Runtime seed, exports, legacy are ON and stable
- OAuth is OFF but infrastructure ready
- Token safety validated (no exposure)
- AuthMeta safety validated (shape intact)
- Contract tests pass
- Parity ready
- Rollback available

### Final Separation Audit

**Audit Script:**
```bash
pnpm tsx scripts/audit-socialflow-final-separation-cutover.ts
pnpm tsx scripts/audit-socialflow-final-separation-cutover.ts --json
pnpm tsx scripts/audit-socialflow-final-separation-cutover.ts --markdown
```

**What This Reports:**
- Current switch states (3 ON, 1 OFF)
- Module status (READY, TRANSITIONAL, PENDING)
- Core-backed residues
- Import/coupling analysis
- Database usage (DRACO_DB vs SOCIAL_DB)
- Risk analysis
- Blockers before OAuth ON
- Blockers before deploy independent

### Criteria for OAuth Activation (S3.16)

**Prerequisites (All Met ✅):**
1. ✅ Runtime seed stable
2. ✅ Exports stable
3. ✅ Legacy stable
4. ✅ Parity OK
5. ✅ Token safety validated
6. ✅ AuthMeta safety validated
7. ✅ OAuth table ready
8. ✅ Contract tests pass
9. ✅ Rollback ready

**Activation:**
```toml
# Change in S3.16:
SOCIALFLOW_LINKEDIN_OAUTH_SOCIAL_DB_READ_SWITCH = "1"
```

**Then monitor:** 3-7 days stable before deploy preparation

### Criteria for NOT Activating OAuth (Current)

**Why OAuth OFF in S3.15:**
- Phased approach (last switch)
- Monitor runtime/exports/legacy first
- Validate all prerequisites
- Prepare infrastructure complete
- Documentation complete
- Tests complete
- Rollback confirmed

**Activation phase:** S3.16 (next)

### Rollback Procedures

**Config-Only Rollback (S3.15 State):**
```toml
# If any issues with runtime/exports/legacy:
SOCIALFLOW_RUNTIME_SEED_SOCIAL_DB_READ_SWITCH = "0"
SOCIALFLOW_EXPORT_READ_MODELS_SOCIAL_DB_READ_SWITCH = "0"
SOCIALFLOW_LEGACY_READ_MODELS_SOCIAL_DB_READ_SWITCH = "0"
```

**Post-S3.16 OAuth Rollback:**
```toml
# If OAuth causes issues:
SOCIALFLOW_LINKEDIN_OAUTH_SOCIAL_DB_READ_SWITCH = "0"
```

**Full Rollback (Nuclear):**
```toml
SOCIALFLOW_CANARY_ROLLBACK_SWITCH_STATE = "all-switches-off"
```

**Execution Time:** < 1 minute (config change only)
**Data Loss:** None (fallback to DRACO_DB)
**Deploy Required:** No

### Deploy Future (Post-S3.16 + Monitoring)

**Prerequisites:**
1. ⏸️ OAuth activated (S3.16)
2. ⏸️ All switches monitored 3-7 days stable
3. ⏸️ Parity strict OK
4. ⏸️ No token leakage
5. ⏸️ Fallback not needed in healthy path
6. ⏸️ DNS cutover prepared
7. ⏸️ Deploy configuration ready

**Then:**
```toml
SOCIALFLOW_NONPROD_CANARY_DEPLOYABLE = "true"
SOCIALFLOW_NONPROD_CANARY_ALLOW_DEPLOY_WITH_REAL_D1 = "true"
```

**Deploy Command:**
```bash
# ONLY after manual approval and checklist complete
wrangler deploy --config apps/socialflow-runtime/wrangler.toml
```

### Production (FUTURE - NOT NOW)

**Prerequisites:**
1. ⏸️ Nonprod deploy stable
2. ⏸️ Monitoring stable
3. ⏸️ Performance validated
4. ⏸️ No regressions
5. ⏸️ Manual approval

**Status:** NOT READY - Multiple phases pending

---

**Document Version:** S3.15 complete
**Last Updated:** 2026-05-27
**Next Phase:** S3.16 OAuth Switch Activation
