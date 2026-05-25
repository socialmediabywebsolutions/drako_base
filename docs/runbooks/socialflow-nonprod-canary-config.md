# SocialFlow Nonprod Canary Config

This runbook prepares a non-production SocialFlow canary target only. It does not deploy, does not use remote D1, and does not enable any switch by default.

## Current State

- `apps/socialflow-runtime/wrangler.toml` is the OpenNext runtime canary config for local/nonprod preparation.
- `workers/socialflows-runtime-canary/wrangler.workers.toml` mirrors the nonprod canary safety posture for the worker scaffold.
- Both configs must remain non-deployable while they use placeholder D1 ids.
- Production SocialFlow remains in `workers/socialflows/wrangler.workers.toml`.

## Required Nonprod D1 Bindings

The canary config must use isolated non-production databases:

- `DRACO_DB`: `drako_db_socialflow_canary_nonprod`
- `SAASES_DB`: `saas_socialflows_canary_nonprod_db`
- `SOCIAL_DB`: `saas_socialflows_canary_nonprod_db`
- `SOCIALFLOW_AUTHS_DB`: `saas_socialflow_auths_canary_nonprod_db`

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

Keep all switches OFF:

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

## Required Switch Defaults

All switches must stay OFF by default:

```toml
SOCIALFLOW_RUNTIME_SEED_SOCIAL_DB_READ_SWITCH = "0"
SOCIALFLOW_EXPORT_READ_MODELS_SOCIAL_DB_READ_SWITCH = "0"
SOCIALFLOW_LINKEDIN_OAUTH_SOCIAL_DB_READ_SWITCH = "0"
SOCIALFLOW_LEGACY_READ_MODELS_SOCIAL_DB_READ_SWITCH = "0"
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
- any SocialFlow SOCIAL_DB read switch is ON by default;
- rollback state is missing;
- placeholder ids are marked deployable;
- real non-production ids are marked deployable without `SOCIALFLOW_NONPROD_CANARY_ALLOW_DEPLOY_WITH_REAL_D1 = "true"`.

The guard reports one of these states:

- `NON_DEPLOYABLE_PLACEHOLDER_CONFIG`: safe for local validation only; never deploy.
- `NON_DEPLOYABLE_REAL_NONPROD_CONFIG`: real non-production ids are present, but deployment is still blocked.
- `DEPLOYABLE_REAL_NONPROD_CONFIG`: real non-production ids plus an explicit future allow-deploy flag are present.

## Future Activation Order

Do not deploy in this phase. Do not use remote D1 in this phase. Do not activate switches in this phase.

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
11. Roll back to switch OFF.

OAuth should be the last or penultimate switch because it touches connection state, token metadata, and encryption-sensitive data.
