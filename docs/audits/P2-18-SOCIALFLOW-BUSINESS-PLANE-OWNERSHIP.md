# P2-18 - SocialFlow Business Plane Ownership

## Scope

This pass moves real ownership of the SocialFlow business plane for:

- campaigns
- posts
- profile

from temporary adapters against the monolith into the inactive `apps/socialflow-runtime/*` app.

It does not activate the canary runtime, does not change production traffic, does not touch the active worker, and does not move AI or LinkedIn ownership yet.

## Initial state

At the start of P2-18 the isolated runtime still delegated core business/data execution through:

- `@/lib/socialflow/repository`
- `@/lib/socialflow/live-publishing`
- `@/lib/socialflow/profile/repository`
- `@/lib/socialflow/ai/*`
- `@/lib/socialflow/linkedin/*`

Contract state before the move:

- `SAFE_SHARED_PACKAGE=6`
- `TEMP_SHARED=5`
- `FORBIDDEN_SHARED=14`

Audit state before the move:

- `tempSharedHitsTotal=8`
- `crossRuntimeReferenceCount=10`
- `contaminatedFileCount=0`

## Ownership moved into the new runtime

### Repositories

The new runtime now owns:

- `apps/socialflow-runtime/src/lib/socialflow/campaigns-repository.ts`
- `apps/socialflow-runtime/src/lib/socialflow/posts-repository.ts`
- `apps/socialflow-runtime/src/lib/socialflow/profile-repository.ts`
- `apps/socialflow-runtime/src/lib/socialflow/runtime-repository-core.ts`

These repositories now execute real local reads and writes against `SOCIAL_DB` through the local DB boundary.

### DTOs and validators

The new runtime now owns:

- `apps/socialflow-runtime/src/lib/socialflow/contracts.ts`
- `apps/socialflow-runtime/src/lib/socialflow/validators.ts`

These files define local runtime DTOs, status/provider contracts, profile payload shape, and patch normalization.

### Services

The new runtime now owns:

- `apps/socialflow-runtime/src/lib/socialflow/campaigns-service.ts`
- `apps/socialflow-runtime/src/lib/socialflow/posts-service.ts`
- `apps/socialflow-runtime/src/lib/socialflow/profile-service.ts`
- `apps/socialflow-runtime/src/lib/socialflow/live-publishing-service.ts`

Important change:

- `campaigns-service` no longer calls the monolith repository.
- `posts-service` no longer calls the monolith repository.
- `profile-service` no longer calls the monolith demo/profile repository.
- live publishing state transitions are now handled in the local runtime; LinkedIn API execution remains shared intentionally.

## Local schemas and DB ownership

The local runtime now owns schema creation and DB access for:

- `saas_social_accounts`
- `saas_social_channels`
- `saas_social_campaigns`
- `saas_social_posts`
- `socialflow_runtime_channel_profiles`
- `socialflow_runtime_channel_competitors`
- `socialflow_runtime_channel_assets`

Profile persistence is no longer backed by the monolith demo state. It now persists inside the runtime-local `SOCIAL_DB` schema.

## What remains shared on purpose

This pass intentionally leaves only:

- `@/lib/socialflow/ai/*`
- `@/lib/socialflow/linkedin/*`

AI remains shared because the orchestrator still lives in the canonical SocialFlow AI layer.

LinkedIn remains shared because OAuth and provider publishing primitives are not moved in this phase.

## Before/after evidence

### Boundary contract

- `TEMP_SHARED: 5 -> 2`
- `SAFE_SHARED_PACKAGE: 6 -> 6`
- `FORBIDDEN_SHARED: 14 -> 14`

### Runtime source graph

Before:

- `tempSharedHitsTotal=8`
- `crossRuntimeReferenceCount=10`
- direct business-plane monolith adapters present for campaigns, posts and profile

After:

- `tempSharedHitsTotal=4`
- `crossRuntimeReferenceCount=6`
- remaining cross-runtime references:
  - `@/lib/auth/crypto`
  - `@/lib/cloudflare/runtime`
  - `@/lib/socialflow/ai/SocialFlowOrchestrator`
  - `@/lib/socialflow/linkedin/oauth`
  - `@/lib/socialflow/linkedin/publishing`
  - `@/lib/socialflow/linkedin/core`

### Build graph

Before:

- `contaminatedFileCount=0`

After:

- `contaminatedFileCount=0`
- `forbiddenHitsTotal=0`
- `routes.total=25`
- `routes.api=11`
- `routes.ui=12`

## What stopped depending on the monolith

The isolated runtime no longer imports or executes:

- `@/lib/socialflow/repository`
- `@/lib/socialflow/live-publishing`
- `@/lib/socialflow/profile/repository`

for campaigns, posts or profile paths.

This includes:

- `GET/POST/PATCH /api/socialflow/campaigns`
- `GET/POST/PATCH /api/socialflow/posts`
- `GET/POST /api/socialflow/profile`
- workspace pages that consume those routes

## Residual blockers

The runtime is now more independent, but still not fully runtime-self-owned because:

- AI orchestration still lives in `@/lib/socialflow/ai/*`
- LinkedIn OAuth/publishing still lives in `@/lib/socialflow/linkedin/*`
- the active production runtime is still the monolith
- the canary worker is still inactive

## Validation

Validated with:

- `pnpm socialflow-runtime:build`
- `pnpm typecheck`
- `pnpm build`
- `pnpm test`
- `git diff --check`

All commands passed without activating the canary runtime and without changing the active monolith runtime.
