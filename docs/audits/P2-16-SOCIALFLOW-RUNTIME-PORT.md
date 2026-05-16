# P2-16 - SocialFlow Runtime Port Into the Inactive Canary

## Scope

This pass ports the real SocialFlow runtime into `apps/socialflow-runtime/*` without activating a new worker, without changing production traffic, and without replacing the active SocialFlow standalone runtime.

It keeps:

- `workers/socialflows/wrangler.workers.toml` unchanged
- the active monolith unchanged as the production source of truth
- the canary worker inactive and route-free

## Routes ported into the inactive runtime

### UI routes

The new app now contains a real SocialFlow app-router surface under `apps/socialflow-runtime/src/app/socialflow/*`:

- `/socialflow/auth`
- `/socialflow`
- `/socialflow/profile`
- `/socialflow/ai`
- `/socialflow/analysis`
- `/socialflow/plan`
- `/socialflow/sessions`
- `/socialflow/setup`
- `/socialflow/settings/account`
- `/socialflow/settings/billing`
- `/socialflow/settings/ownership`
- `/socialflow/settings/team`

Route status:

- `auth`, `workspace`, `profile` and `ai` are product-real runtime pages backed by the ported `/api/socialflow/*` routes.
- `settings/account`, `settings/team` and `settings/ownership` reuse the canonical SocialFlow modules through temporary bridges.
- `settings/billing`, `analysis`, `plan`, `sessions` and `setup` stay explicit boundary pages inside the isolated runtime instead of silently traversing control-plane surfaces.

### API routes

The new app now contains real SocialFlow API entrypoints under `apps/socialflow-runtime/src/app/api/socialflow/*`:

- `auths/logins`
- `auths/logouts`
- `auths/registrations`
- `campaigns`
- `exports/current`
- `posts`
- `profile`
- `ai/generate`
- `ai/regenerate`
- `linkedin/connect`
- `linkedin/callback`

Route status:

- `campaigns`, `exports/current`, `posts`, `profile`, `ai/generate` and `ai/regenerate` reuse the canonical route handlers through direct runtime re-exports.
- `linkedin/connect` and `linkedin/callback` were ported as runtime-specific wrappers so they can enforce the SocialFlow auth boundary without importing the monolith control-plane path.

## Middleware and auth boundary

The new app now owns its own `apps/socialflow-runtime/src/middleware.ts`.

What it does:

- resolves and normalizes the incoming host with `@shared-neutral/hosts`
- rejects `CAMPAMENTO_BASE` host mode with fail-closed `403`
- allows only public SocialFlow entrypoints to bypass session enforcement:
  - `/socialflow/auth`
  - `/api/socialflow/auths/*`
  - `/api/socialflow/linkedin/callback`
- requires a valid SocialFlow auth token for every other `/socialflow/*` and `/api/socialflow/*` route
- injects isolated runtime headers:
  - `x-socialflow-runtime-root`
  - `x-socialflow-runtime-host`
  - `x-socialflow-runtime-host-mode`
  - `x-drako-client-entry-mode`
  - `x-drako-tenant-id`
  - `x-tenant-id`

The auth token reader lives in `apps/socialflow-runtime/src/lib/runtime-session.ts` and deliberately reuses:

- `@/lib/auths/cookies`
- `@/lib/auths/tokens`

This keeps the session contract compatible while the runtime boundary moves out of the monolith.

## Temporary shared boundaries

`apps/socialflow-runtime/runtime-boundaries.json` now classifies the split boundary explicitly.

### SAFE_SHARED_PACKAGE

- `@shared-neutral/hosts`
- `@shared-neutral/marketing-locales`
- `@shared-cloudflare/opennext-cloudflare-config`
- `@shared-ui-neutral/app-providers`

### TEMP_SHARED

- `@/components/auth/*`
- `@/components/settings/socialflow-account-settings`
- `@/components/ui/*`
- `@/lib/auths/*`
- `@/lib/socialflow/*`
- `@/lib/export/wipeout-package`
- `@/lib/http/errors`
- `@/lib/db`
- `@/lib/cf`
- `@/lib/correlation`
- `@/lib/security/tenant-rate-limit`
- `@/lib/tenants/services`
- `@/modules/socialflow-app/*`

These are allowed only as transitional bridges while the runtime graph is being separated.

### FORBIDDEN_SHARED

The isolated runtime still must not import:

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

These boundaries are enforced by `tests/architecture/socialflow-runtime-split-scaffold.test.ts`.

## OpenNext build state

`pnpm socialflow-runtime:build` is no longer just a scaffold preflight.

It now performs:

1. scaffold preflight via `scripts/build-socialflow-runtime-scaffold.mjs`
2. real OpenNext build via `pnpm --dir apps/socialflow-runtime exec opennextjs-cloudflare build`
3. local artifact audit written to `build/socialflow-runtime-scaffold/runtime-port-audit.json`

The app-local wrangler file `apps/socialflow-runtime/wrangler.toml` exists only to support the separate OpenNext build. It does not activate traffic and does not replace the production worker configuration.

## Before/after runtime evidence

### Before porting into the new app

The audited monolith preview still reported:

- `crossProductLeaks=0`
- `suspiciousRoutes=1`
- `runtimeRiskScore=100`
- `scopedActivationReady=false`
- `tenantIsolationCounts={VERIFIED_TENANT_ISOLATED:5, PARTIALLY_ISOLATED:0, UNVERIFIED:1, UNSAFE:0}`
- `16 shared chunks carry cross-product or shared-infra references`
- `25 route client-reference manifests retain cross-product source references`

### After building the new runtime canary

The new app-local audit at `build/socialflow-runtime-scaffold/runtime-port-audit.json` reports:

- `routes.total=25`
- `routes.api=11`
- `routes.ui=12`
- `routes.forbiddenMatches=[]`
- `middleware.manifestKeys=["/"]`
- `buildGraph.filesScanned=1365`
- `buildGraph.contaminatedFileCount=0`
- `buildGraph.contaminatedFiles=[]`

Important note:

- this pass does **not** recalculate `runtimeRiskScore` for the monolith preview
- it proves instead that the newly split runtime can compile as its own OpenNext app without dragging forbidden control-plane tokens into its build graph

## State of the monolith

The monolith remains the active production runtime source.

Nothing in this pass:

- changes `src/app/socialflow/*` as the canonical active runtime
- changes `src/app/api/socialflow/*` as the canonical active API source
- changes active traffic routing
- changes production deploy wiring

The new app only mirrors and ports the runtime so it can be validated independently.

## State of the canary worker

`workers/socialflows-runtime-canary/*` remains intentionally inert:

- no `[[routes]]`
- no `custom_domain`
- `workers_dev = false`
- `src/workers.ts` returns `503 SOCIALFLOW_RUNTIME_CANARY_INACTIVE`

This means the canary exists as a future deployment target, but it still receives no traffic.

## Residual blockers

The split is still incomplete because the runtime keeps temporary bridges to:

- shared auth helpers
- shared SocialFlow business logic
- shared DB access helpers
- shared UI primitives
- shared settings modules

The next real split phase must reduce `TEMP_SHARED`, especially:

- `@/lib/db`
- `@/lib/auths/*`
- `@/lib/socialflow/*`
- `@/modules/socialflow-app/*`

## Honest status

- The new runtime is now compilable.
- The new runtime is independently buildable through OpenNext.
- The new runtime is protected from forbidden control-plane imports by test and build audit.
- The new runtime is **not** active.
- The new runtime is **not yet fully isolated**, because `TEMP_SHARED` remains substantial.
