# SocialFlow Runtime Boundary Audit

## Scope

- Audit mode only.
- No runtime cuts, refactors, deploys, workflow edits or D1 writes were performed.
- Scanned paths:
  - `src/lib/socialflow`
  - `src/app/socialflow`
  - `src/app/api/socialflow`
  - `apps/socialflow-runtime`
  - `workers/socialflows`
  - `workers/socialflows-runtime-canary`

## Repo State

- Inherited dirty file outside this audit scope:
  - `apps/socialflow-runtime/runtime-boundaries.json`
  - Classification: `REVIEW_REQUIRED`
  - Reason: pre-existing diff adds `@/lib/factory/*` to the forbidden boundary inventory.

## Imports

- Direct forbidden imports into audited SocialFlow runtime/product paths were not found for:
  - `@/lib/campamento-base`
  - `lib/campamento-base`
  - `@/lib/campobase`
  - `@/lib/operator`
  - `@/lib/factory`
  - `@/lib/mentoria`
- Allowed control-plane contract surfaces remain:
  - `src/lib/socialflow/contracts/campobase.ts`
  - `src/lib/socialflow/contracts/owner-dashboard.ts`
  - `src/lib/socialflow/contracts/automation.ts`
  - `src/lib/socialflow/contracts/operator-actions.ts`
  - `src/lib/socialflow/contracts/observability.ts`
- Guard-only reference remains:
  - `apps/socialflow-runtime/runtime-boundaries.json`

## Bindings

- `SOCIAL_DB`
  - Classification: `SOCIALFLOW_OWNED_BINDING`
  - Role: primary SocialFlow storage for repository, scheduler, exports prep, runtime seed prep and LinkedIn prep paths.
- `DRACO_DB`
  - Classification: `BLOCKER_SHARED_DB`
  - Role: still reachable through runtime helpers and core-backed fallback adapters.
- `SAASES_DB`
  - Classification: `UNKNOWN_REVIEW`
  - Role: present in runtime/worker config, but no active usage was found in the audited runtime/source paths.

## Control-Plane References

- Campamento Base
  - `src/lib/socialflow/contracts/campobase.ts` is an allowed public adapter.
  - `src/lib/socialflow/contracts/linkedin-oauth-runtime.ts`, `src/lib/socialflow/contracts/repository-core-context.ts`, `src/lib/socialflow/contracts/export-core-read.ts` and `apps/socialflow-runtime/src/lib/socialflow/contracts/runtime-seed-contract.ts` still document Campamento Base as part of the target adapter story.
- Owner
  - `src/lib/socialflow/contracts/owner-dashboard.ts` is an allowed owner-facing read contract.
- Operator
  - `src/lib/socialflow/contracts/automation.ts`, `operator-actions.ts` and `observability.ts` are allowed public operator contracts.
- Factory
  - No active SocialFlow runtime/product import was detected in audited paths.
- Drako
  - `x-drako-*` headers still exist as compatibility/context wiring in middleware and auth routes.

## Blockers

1. `BLOCKER_SHARED_DB`: `DRACO_DB` is still bound in isolated runtime configs and validated by runtime DB helpers.
2. `BLOCKER_CROSS_RUNTIME`: `src/lib/socialflow/contracts/repository-core-context.ts` and `src/lib/socialflow/contracts/legacy-actions-core.ts` still carry core-backed context/fallback behavior.
3. `BLOCKER_CROSS_RUNTIME`: `apps/socialflow-runtime/src/lib/socialflow/contracts/runtime-seed-contract.ts` still falls back to core `saas`.
4. `BLOCKER_CROSS_RUNTIME`: `src/lib/socialflow/contracts/export-core-read.ts` still reads core export-related tables.
5. `BLOCKER_CROSS_RUNTIME`: `src/lib/socialflow/contracts/linkedin-oauth-runtime.ts` and `src/lib/socialflow/linkedin/repository.ts` still rely on integration-core/core projection behavior.

## Warnings

- `SAASES_DB` remains attached at config boundary and should be reviewed for removal if truly unused.
- `apps/socialflow-runtime/runtime-boundaries.json` was already dirty before this audit and should not be mixed into the audit commit by default.

## Recommendation For P1.8B

1. Finish removing core-backed fallbacks from runtime seed, legacy repository/actions, export generation and LinkedIn OAuth.
2. Treat `DRACO_DB` removal as the hard exit criterion for true runtime independence.
3. Re-evaluate whether `SAASES_DB` is required at all once the runtime is fully SocialFlow-owned.
4. Preserve the public control-plane contracts (`campobase`, `owner`, `operator`) while cutting shared DB/runtime dependencies behind them.
