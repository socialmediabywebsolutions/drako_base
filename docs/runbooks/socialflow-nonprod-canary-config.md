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
