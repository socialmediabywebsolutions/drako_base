# P2-20 — SocialFlow Canary Readiness Audit

## Scope

Read-only readiness audit of the inactive SocialFlow canary runtime created in `apps/socialflow-runtime/` and `workers/socialflows-runtime-canary/`.

Constraints respected:

- no runtime activation
- no route changes
- no DNS changes
- no deploy
- no traffic cutover
- no active worker changes

## Current runtime state

- runtime root: `apps/socialflow-runtime`
- canary worker root: `workers/socialflows-runtime-canary`
- activation state: `inactive-scaffold`
- canary worker response: `503 SOCIALFLOW_RUNTIME_CANARY_INACTIVE`
- source graph:
  - `TEMP_SHARED = 0`
  - `crossRuntimeReferenceCount = 2`
  - `forbiddenHitsTotal = 0`
  - `contaminatedFileCount = 0`

Safe shared references that remain:

- `@shared-neutral/hosts`
- `@shared-neutral/marketing-locales`
- `@shared-ui-neutral/app-providers`
- `@shared-cloudflare/opennext-cloudflare-config`
- `@/lib/auth/crypto`
- `@/lib/cloudflare/runtime`

## Runtime graph findings

What is already isolated:

- SocialFlow app router routes are local to the runtime.
- Middleware is local to the runtime.
- Auth/session flow is local to the runtime.
- DB boundary is local to the runtime.
- Campaigns, posts, profile, exports, AI and LinkedIn provider logic are locally owned.
- Build graph contamination is `0`.

What is still coupled:

- `apps/socialflow-runtime/wrangler.toml` and `workers/socialflows-runtime-canary/wrangler.workers.toml` use the same worker name: `saas-socialflows-runtime-canary`.
- `apps/socialflow-runtime/wrangler.toml` does not declare the D1 bindings or secrets required by runtime code.
- runtime env resolution falls back to global `process.env`, so build and local execution can inherit unrelated monolith configuration.
- the generated OpenNext artifact includes a broad `next-env.mjs` environment bundle with unrelated platform and application secrets/config.

## Risk classification

### SAFE

- route ownership under `/socialflow/*` and `/api/socialflow/*`
- `forbiddenHitsTotal = 0`
- `contaminatedFileCount = 0`
- canary worker scaffold remains route-less and returns `503`

### SAFE_SHARED

- `@/lib/auth/crypto`
- `@/lib/cloudflare/runtime`
- `@shared-neutral/*`
- `@shared-ui-neutral/*`
- `@shared-cloudflare/*`

### SHADOW_COUPLING

- fallback to `process.env` in `src/lib/runtime-env.ts`
- host-mode logic blocks `CAMPAMENTO_BASE`, but does not yet prove a strict SocialFlow-only host allowlist for future attached routes
- cookie namespace is canonical and would collide if canary shares the same host as production

### DEPLOY_BLOCKER

- duplicate worker name between scaffold worker and deployable OpenNext worker
- missing D1 bindings in `apps/socialflow-runtime/wrangler.toml`
- missing runtime secrets and vars contract in the app runtime wrangler
- no dedicated deploy target separation between inactive scaffold and real canary artifact
- generated `.open-next/cloudflare/next-env.mjs` still captures unrelated environment surface

### ROLLBACK_RISK

- worker-name collision can make rollback ambiguous if the wrong artifact is deployed
- no explicit rollback artifact/versioning contract yet for canary versus scaffold
- no route-level rollback rehearsal because the worker has no attached routes yet

### TRAFFIC_RISK

- no validated host allowlist for production-like SocialFlow domains at the canary runtime boundary
- cookie collision risk if production and canary ever share host/domain
- secret fallback from `SOCIALFLOW_AUTHS_SECRET` to generic `SESSION_SECRET`
- `DEFAULT_TENANT_ID` fallback can create implicit tenant assignment on registration paths

### OBSERVABILITY_GAP

- no readiness healthcheck route dedicated to canary verification
- no canary-specific request correlation or log namespace contract documented
- no minimal metrics checklist for auth, middleware rejects, OAuth callback, publish flow, export flow and DB failures

### STATEFUL_RISK

- runtime code expects DB bindings, session secret and LinkedIn credentials that are not yet declared in the canary wrangler
- auth cookies and session storage would be stateful from first request and need explicit namespace discipline before traffic

### INFRA_COUPLING

- OpenNext artifact still carries a wide environment surface from build time
- runtime env access is still mediated through a shared Cloudflare context helper

## Activation simulation

If the deployable runtime worker were activated without further changes:

- worker deploy would be unsafe because the name collides with the inactive scaffold worker
- the first DB-backed request would fail closed due to missing `DRACO_DB`, `SOCIAL_DB` or `SOCIALFLOW_AUTHS_DB` bindings
- auth could drift if only `SESSION_SECRET` is present and `SOCIALFLOW_AUTHS_SECRET` is absent
- cookie collision would be likely on a shared host because the runtime uses `__Host-socialflow_session`
- LinkedIn connect/callback would fail if client credentials are not explicitly provisioned for the canary runtime
- rollback would not be cleanly rehearsable because there is no separate routed target to detach

## Production safety checks

Verified safe right now:

- no production route overlap is configured
- no custom domains are configured for the canary worker
- `workers_dev = false`
- active production worker config remains untouched
- build artifact does not overwrite `.open-next/socialflows-standalone/`

Not yet proven safe for later activation:

- dedicated cookie namespace for canary traffic
- dedicated env namespace trimmed to SocialFlow-only runtime needs
- explicit binding parity between active runtime and canary runtime
- explicit rollback playbook for route attach/detach

## What is still required before safe canary activation

1. Give the deployable app runtime worker its own unique worker name.
2. Declare the required D1 bindings and secrets in `apps/socialflow-runtime/wrangler.toml`.
3. Remove or harden `process.env` fallback so the runtime cannot inherit unrelated monolith env by accident.
4. Minimize or explicitly review the environment surface emitted into `.open-next/cloudflare/next-env.mjs`.
5. Define a strict SocialFlow-only route/host allowlist at middleware and deploy layers.
6. Split canary cookie namespace or canary host/domain so auth state cannot collide with production.
7. Define a minimal observability contract before first routed request.
8. Rehearse rollback as a route attach/detach procedure with explicit worker target separation.

## Before / after

No runtime code or traffic changes were made in P2-20.

- `TEMP_SHARED`: `0 -> 0`
- `crossRuntimeReferenceCount`: `2 -> 2`
- `contaminatedFileCount`: `0 -> 0`
- canary activation state: `inactive-scaffold -> inactive-scaffold`

## Validation executed

- `pnpm socialflow-runtime:build`
- `pnpm typecheck`
- `pnpm build`
- `pnpm test`
- `git diff --check`

All passed during this audit turn.

## Honest verdict

The canary runtime is structurally close to independent, but it is not deploy-ready.

Main blockers are not business logic anymore; they are deployment identity, binding parity, env isolation, cookie/auth collision risk and missing operational guardrails.

Current status:

- canary activable: no
- production-safe to leave inactive: yes
- next correct phase: deploy-readiness hardening without traffic activation
