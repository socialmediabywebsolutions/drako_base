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
- the config is marked deployable.

## Future Activation Order

Do not deploy in this phase. Do not use remote D1 in this phase. Do not activate switches in this phase.

Future nonprod activation should happen in this order:

1. Create isolated non-production D1 databases.
2. Replace placeholder ids with real non-production ids.
3. Run the nonprod canary config guard.
4. Apply migrations `0187`, `0188`, `0189`, and `0190` to nonprod only.
5. Run backfill in nonprod.
6. Run strict parity in nonprod.
7. Run smoke in nonprod with all switches OFF.
8. Activate exactly one switch.
9. Run smoke for that switch.
10. Roll back to switch OFF.

OAuth should be the last or penultimate switch because it touches connection state, token metadata, and encryption-sensitive data.
