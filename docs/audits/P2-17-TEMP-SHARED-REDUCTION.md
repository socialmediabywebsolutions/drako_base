# P2-17 - SocialFlow Temp Shared Reduction

## Scope

This pass reduces the remaining `TEMP_SHARED` surface of the inactive `apps/socialflow-runtime/*` app without activating the canary runtime, without changing production traffic, and without replacing the active SocialFlow standalone runtime.

The goal is to move runtime ownership of the SocialFlow data/business plane into the split app where it is already safe to do so, while keeping the monolith alive and unchanged as the production source of truth.

## Temp shared classification

### SAFE_TO_KEEP_SHARED

These dependencies are neutral infra or packaging glue and can remain shared without leaking control-plane runtime behavior into SocialFlow:

- `@shared-neutral/hosts`
- `@shared-neutral/marketing-locales`
- `@shared-cloudflare/opennext-cloudflare-config`
- `@shared-ui-neutral/app-providers`
- `@/lib/auth/crypto`
- `@/lib/cloudflare/runtime`

### SHOULD_BE_OWNED_BY_SOCIALFLOW

These areas now have local ownership inside the new app runtime:

- `apps/socialflow-runtime/src/lib/db/runtime-db.ts`
- `apps/socialflow-runtime/src/lib/auth/*`
- `apps/socialflow-runtime/src/lib/socialflow/exports-service.ts`
- `apps/socialflow-runtime/src/app/api/socialflow/auths/*`
- `apps/socialflow-runtime/src/app/socialflow/auth/_components/socialflow-auth-form.tsx`
- `apps/socialflow-runtime/src/app/socialflow/(workspace)/settings/account/_components/account-settings-client.tsx`
- `apps/socialflow-runtime/src/app/socialflow/(workspace)/settings/{account,team,ownership}/page.tsx`

This pass removes direct runtime dependency on:

- `@/lib/auths/*`
- `@/lib/db`
- `@/lib/http/errors`
- `@/lib/cf`
- `@/lib/correlation`
- `@/lib/tenants/services`
- `@/modules/socialflow-app/*`
- `@/components/auth/*`
- `@/components/settings/socialflow-account-settings`
- `@/components/ui/*`
- `@/app/api/socialflow/*`

### NEEDS_ADAPTER

These runtime paths still depend on canonical monolith business logic through explicit adapters:

- `@/lib/socialflow/repository`
- `@/lib/socialflow/live-publishing`
- `@/lib/socialflow/profile/repository`
- `@/lib/socialflow/ai/*`
- `@/lib/socialflow/linkedin/*`

They remain temporary because the new runtime still delegates business logic to the canonical SocialFlow implementation for:

- campaigns
- posts
- profile persistence
- AI generation orchestration
- LinkedIn OAuth helpers

### NEEDS_DUPLICATION

Not executed in this pass.

Potential future candidates:

- selected repository functions that are runtime-critical and SocialFlow-specific
- minimal AI orchestration entrypoints
- LinkedIn callback glue if adapter removal becomes a blocker

### NEEDS_PACKAGE_EXTRACTION

Not executed in this pass.

Potential future candidates:

- SocialFlow-neutral HTTP/problem helpers
- correlation helpers that are safe outside the monolith
- DB guard helpers if they can be extracted without carrying global runtime state

### FORBIDDEN_LONG_TERM

These dependencies remain forbidden for the new runtime and did not re-enter in this pass:

- `@/components/layouts/control-plane-layout`
- `@/components/sidebar`
- `@/components/right-panel`
- `@/app/nextauth-providers`
- `@/lib/mentoria/*`
- `@/lib/operator/*`
- `@/lib/campobase/*`
- `@/lib/campamento-base/*`
- `@/lib/drako/*`
- `@/lib/owner/*`
- `@/lib/dashboard/*`
- `@/app/(dashboard)/*`
- `@/app/operator/*`
- `@/app/admin/*`

## Boundaries created in P2-17

### DB boundary

The new runtime now owns `apps/socialflow-runtime/src/lib/db/runtime-db.ts`.

This boundary provides:

- local access to `DRACO_DB`, `SOCIAL_DB` and `SOCIALFLOW_AUTHS_DB`
- local `queryAll`, `queryOne` and `run` helpers
- local database availability errors
- local response mapping for DB failures

This means the runtime no longer imports the monolith DB utility layer directly.

### Auth boundary

The new runtime now owns `apps/socialflow-runtime/src/lib/auth/*`.

This boundary provides:

- local cookie parsing and cookie writing
- local token signing and verification for SocialFlow sessions
- local request/session resolution
- local tenant isolation checks
- local auth DB repository access
- local register, login and logout services

This removes runtime dependence on the global hybrid auth graph and keeps SocialFlow auth fail-closed inside the split app.

### Business services

The new runtime now owns `apps/socialflow-runtime/src/lib/socialflow/*`.

Ownership level by service:

- `exports-service.ts`: local implementation with local DB boundary
- `campaigns-service.ts`: adapter to canonical SocialFlow repository
- `posts-service.ts`: adapter to canonical repository and live-publishing layer
- `profile-service.ts`: adapter to canonical profile repository
- `ai-service.ts`: adapter to canonical AI orchestrator and repository
- `linkedin-service.ts`: adapter to canonical LinkedIn OAuth helper

This means the runtime business plane is no longer spread across page reexports and root API reexports; the remaining coupling is concentrated behind explicit adapter services.

## Before/after evidence

### Before this pass

Observed direct runtime-source `TEMP_SHARED` hits in `apps/socialflow-runtime/src/*`:

- `@/lib/auths/*`: `2`
- `@/lib/socialflow/*`: `5`
- `@/modules/socialflow-app/*`: `3`
- `@/components/auth/*`: `1`

Total direct hits observed before: `11`

Additional runtime coupling before:

- root API reexports from `@/app/api/socialflow/*`
- shared account/settings bridges into `@/modules/socialflow-app/*`
- shared auth/session reader via `runtime-session.ts`

Boundary contract before:

- `SAFE_SHARED_PACKAGE=4`
- `TEMP_SHARED=13`
- `FORBIDDEN_SHARED=14`

### After this pass

The updated `runtime-boundaries.json` now reports:

- `SAFE_SHARED_PACKAGE=6`
- `TEMP_SHARED=5`
- `FORBIDDEN_SHARED=14`

The local audit at `build/socialflow-runtime-scaffold/runtime-port-audit.json` now reports:

- `sourceGraph.filesScanned=46`
- `sourceGraph.importsScanned=102`
- `sourceGraph.safeSharedHitsTotal=8`
- `sourceGraph.tempSharedHitsTotal=8`
- `sourceGraph.forbiddenHitsTotal=0`
- `sourceGraph.crossRuntimeReferenceCount=10`
- `buildGraph.contaminatedFileCount=0`

Remaining `TEMP_SHARED` hits by pattern:

- `@/lib/socialflow/repository`: `4`
- `@/lib/socialflow/live-publishing`: `1`
- `@/lib/socialflow/profile/repository`: `1`
- `@/lib/socialflow/ai/*`: `1`
- `@/lib/socialflow/linkedin/*`: `1`

Real reductions achieved:

- direct runtime dependency on `@/lib/auths/*` removed
- direct runtime dependency on `@/modules/socialflow-app/*` removed
- direct runtime dependency on `@/components/auth/*` removed
- direct runtime dependency on `@/components/ui/*` removed
- direct runtime dependency on `@/lib/db` removed
- hidden route reexports from `@/app/api/socialflow/*` removed

## What remains shared after P2-17

The runtime still shares selected SocialFlow business logic through adapters:

- canonical repositories
- canonical live publishing
- canonical profile persistence
- canonical AI orchestration
- canonical LinkedIn OAuth glue

This is the remaining blocker for strong business/data plane isolation.

## State of the monolith and canary

The monolith remains the active production runtime source.

Nothing in this pass:

- changes `workers/socialflows/wrangler.workers.toml`
- changes active traffic routing
- activates the new canary worker
- changes DNS
- performs a deploy or cutover

The canary worker remains inert and route-free.

## Residual blockers

The runtime is more isolated, but not fully isolated yet.

Real blockers that remain:

- repository ownership still lives in the monolith
- AI and LinkedIn business paths still cross the runtime boundary
- `DRACO_DB` remains shared as a data-plane dependency even though the runtime now owns its DB wrapper
- the new runtime still needs follow-up work to reduce `crossRuntimeReferenceCount`

## Next step

The next real step should move adapter-backed business services from `NEEDS_ADAPTER` toward local SocialFlow ownership, starting with:

1. campaign and posts repositories
2. profile persistence
3. AI orchestration entrypoints
4. LinkedIn runtime callback glue
