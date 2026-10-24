# SocialFlow Runtime Seed Switch Separation Audit

Date: 2026-05-26

## Scope

This audit validates the non-production SocialFlow posture after enabling only:

```text
SOCIALFLOW_RUNTIME_SEED_SOCIAL_DB_READ_SWITCH = "1"
```

The audit does not activate exports, OAuth, or legacy read switches. It does not deploy, migrate, backfill, write remote D1 data, or touch OAuth/tokens/credentials.

## Current Technical Posture

Config evidence:

- `apps/socialflow-runtime/wrangler.toml` sets runtime seed read switch to `"1"` and keeps exports, OAuth, and legacy read switches at `"0"`.
- `workers/socialflows-runtime-canary/wrangler.workers.toml` mirrors the same switch posture for the worker canary.
- `SOCIALFLOW_NONPROD_CANARY_DEPLOYABLE = "false"` remains required by `scripts/check-socialflow-nonprod-canary-config.ts`.
- `SOCIALFLOW_CANARY_ROLLBACK_SWITCH_STATE = "all-switches-off"` remains the rollback marker.

Runtime seed evidence:

- `apps/socialflow-runtime/src/lib/socialflow/contracts/runtime-seed-contract.ts` reads `SOCIAL_DB.socialflow_seed_metadata` first when the runtime seed switch is enabled.
- The same contract keeps a DRACO/Core fallback through `DRACO_DB.saas` if `SOCIAL_DB` has no active seed or the read fails.
- `tests/lib/socialflow-runtime-seed-contract.test.ts` covers switch OFF core fallback, switch ON `SOCIAL_DB` first, Cloudflare-like env values, inactive/missing social seed fallback, and `SOCIAL_DB` read-error fallback.
- `scripts/smoke-socialflow-nonprod-runtime-seed-switch.ts` runs the runtime seed contract suite without remote D1 writes and reports `remoteWrites: 0`, `deploy: false`, and `oauthExcluded: true`.

Parity evidence:

- `scripts/check-socialflow-nonprod-ownership-parity.ts` remains strict for ownership read models and now treats runtime seed switch `"0"` or `"1"` as safe for parity.
- The same parity guard still rejects exports, OAuth, or legacy read switches when they are not `"0"`.
- Strict parity validates the already-backfilled read models without `--allow-empty-source`.

## SaaS Separation Assessment

SocialFlow is more separated after this switch because runtime identity/seed resolution can come from `SOCIAL_DB.socialflow_seed_metadata` instead of requiring `DRACO_DB.saas` as the first read path.

Reduced dependency:

- The runtime seed lookup no longer needs to start from core `DRACO_DB.saas` when `SOCIAL_DB` contains an active seed row.
- This directly reduces the runtime startup/profile identity dependency on the core-backed SaaS table.

Still core-backed:

- Export read models still depend on core-backed sources through `src/lib/socialflow/contracts/export-core-read.ts` and `apps/socialflow-runtime/src/lib/socialflow/exports-service.ts`.
- Legacy dossiers/progress/work logs/repository context still have allowlisted core dependencies in `src/lib/socialflow/contracts/legacy-actions-core.ts` and `src/lib/socialflow/contracts/repository-core-context.ts`.
- Runtime DB bindings still expose `DRACO_DB` through `apps/socialflow-runtime/src/lib/runtime-env.ts` and `apps/socialflow-runtime/src/lib/db/runtime-db.ts` for transitional fallback paths.
- LinkedIn OAuth remains outside this phase and has allowlisted transitional coupling in `src/lib/socialflow/contracts/linkedin-oauth-runtime.ts` and `src/lib/socialflow/linkedin/oauth.ts`.

## Campamento Base Observation Model

Campamento Base should observe SocialFlow through contracts, routes, and health/status surfaces, not through direct imports of runtime internals.

Existing contracts:

- `src/lib/campobase/socialflow-service.ts` imports `@/lib/socialflow/contracts/campobase`.
- `src/lib/socialflow/contracts/campobase.ts` re-exports the Campamento Base contract adapter over automation, observability, and operator action contracts.
- `src/app/api/campobase/socialflow/route.ts` is a legacy compatibility bridge to the operator route, not a new canonical internal entrypoint.
- `src/app/api/operator/socialflow/route.ts` calls `src/lib/campobase/socialflow-service.ts` and therefore stays behind the Campamento Base service boundary.
- `apps/socialflow-runtime/src/app/api/socialflow/runtime/health/route.ts` exposes runtime health metadata.
- `apps/socialflow-runtime/src/app/api/socialflow/runtime/readiness/route.ts` exposes readiness blockers and security posture.
- `apps/socialflow-runtime/src/app/api/socialflow/setup/status/route.ts` exposes authenticated setup status without creating an auth bypass.

What Campamento Base must not do:

- Import `apps/socialflow-runtime/src/**` runtime internals.
- Import `src/lib/socialflow/repository` directly.
- Import `src/lib/socialflow/linkedin/**` directly for OAuth/token state.
- Read or write SocialFlow OAuth tables, access tokens, refresh tokens, credentials, or `authMeta`.

## Boundary Findings

Classification summary:

- `CONTRACT_OK`: `src/lib/campobase/socialflow-service.ts` imports only `@/lib/socialflow/contracts/campobase` for SocialFlow product interaction.
- `CONTRACT_OK`: `src/lib/owner/control-dashboard.ts` and `src/lib/owner/types.ts` use `@/lib/socialflow/contracts/owner-dashboard`.
- `CONTRACT_OK`: operator route access goes through `src/lib/campobase/socialflow-service.ts`.
- `CONTRACT_OK`: runtime health/readiness routes expose status without requiring Campamento Base to import runtime logic.
- `ACCEPTABLE_TRANSITIONAL_DEPENDENCY`: `tests/architecture/socialflow-draco-dependency-radar.test.ts` tracks allowlisted DRACO/Core dependencies and requires a `TODO(SocialFlow DB separation)` note.
- `ACCEPTABLE_TRANSITIONAL_DEPENDENCY`: `apps/socialflow-runtime/src/lib/socialflow/contracts/runtime-seed-contract.ts` keeps a core fallback for rollback and error containment.
- `ACCEPTABLE_TRANSITIONAL_DEPENDENCY`: `src/lib/saas/repository.ts` imports `@/lib/socialflow/repository` for SaaS social account context; this is core/SaaS to SocialFlow coupling and should be replaced by a neutral contract before full product extraction.
- `ACCEPTABLE_TRANSITIONAL_DEPENDENCY`: `src/lib/integration-core/providers/linkedin.ts` imports `@/lib/socialflow/linkedin/core` for LinkedIn provider implementation; this is OAuth-adjacent and remains outside this runtime seed phase.
- `UNKNOWN_NEEDS_REVIEW`: local/demo auth fallback exists in `src/lib/socialflow/auth/server.ts` under `x-drako-client-entry-mode: local_demo`; it is blocked in production-like mode but should not be used as evidence for canary health.
- `BLOCKER`: none found in this audit.

Existing guard coverage:

- `tests/architecture/saas-boundary-import-guards.test.ts` blocks Campamento Base, operator APIs, shared runtime, and cross-product code from importing SocialFlow internals unless an explicit contract path is allowlisted.
- The same test specifically asserts that `src/lib/campobase/socialflow-service.ts` uses the Campamento Base contract adapter and does not import automation, observability, operator-actions, or repository internals directly.
- `tests/architecture/socialflow-draco-dependency-radar.test.ts` reports legacy allowlisted DRACO/Core dependencies and fails on new unallowlisted hits.

No additional boundary test was added because current coverage already checks the Campamento Base to SocialFlow contract boundary and the SocialFlow to DRACO/Core dependency radar.

## Gaps Before Exports Switch

Required before enabling `SOCIALFLOW_EXPORT_READ_MODELS_SOCIAL_DB_READ_SWITCH`:

- Add or confirm an export read contract that reads `SOCIAL_DB.socialflow_export_read_models` first.
- Keep strict parity green for export rows after any backfill refresh.
- Add smoke evidence that export reads stay read-only and do not fall back silently to incomplete core data.
- Emit or expose source selection in health/status so operators can see `SOCIAL_DB` versus fallback for export reads.
- Keep OAuth excluded until a separate token-safe OAuth phase.

## Contract Gaps

Recommended contracts before wider activation:

- A read-only runtime seed status contract that exposes whether the current seed came from `SOCIAL_DB`, core fallback, or no seed.
- A SocialFlow export status contract for Campamento Base that reports read-model freshness and parity state without importing export internals.
- A token-safe OAuth status contract that exposes connection health without tokens, credentials, or `authMeta`.
- A metric or event for each fallback path so fallback is observable and not a silent success.

## Risks And Residual Debt

- The runtime seed fallback is intentional rollback safety, but it is still a DRACO/Core dependency.
- Existing demo/local auth code should remain local-only and must not be used for canary evidence.
- The integration-core LinkedIn provider still reaches into SocialFlow LinkedIn primitives and should be isolated before OAuth switch activation.
- `src/lib/saas/repository.ts` still imports SocialFlow repository internals and should move behind a neutral social account contract for stronger product extraction.

## Recommended Next Phase

The next safe phase is export-read-model preparation, not OAuth or legacy activation:

1. Keep runtime seed switch ON in nonprod only.
2. Keep exports, OAuth, and legacy switches OFF.
3. Add export `SOCIAL_DB`-first contract and smoke coverage.
4. Re-run guard, runtime seed smoke, strict parity, radar, boundary guard, and typecheck.
5. Activate only `SOCIALFLOW_EXPORT_READ_MODELS_SOCIAL_DB_READ_SWITCH` in a later nonprod phase if the export contract, read models, and observability are green.
