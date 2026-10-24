# P2-21 — SocialFlow Deploy-Readiness Hardening

## Scope

Deploy-readiness hardening for the inactive SocialFlow runtime split target.

Constraints respected:

- no route activation
- no `workers_dev`
- no custom domains
- no production worker changes
- no deploy
- no traffic

## What changed

### Worker identity

- scaffold worker identity moved to `saas-socialflows-runtime-scaffold`
- deployable app runtime identity kept as `saas-socialflows-runtime-canary`
- scaffold and deployable targets are now unambiguous and independently auditable

### Binding contract

- added explicit contract file at `apps/socialflow-runtime/runtime-deploy-contract.json`
- deployable wrangler now declares:
  - `DRACO_DB`
  - `SOCIAL_DB`
  - `SOCIALFLOW_AUTHS_DB`
  - `.open-next/assets`
  - runtime identity vars
- build audit now verifies binding coverage and worker identity drift

### Env isolation

- runtime env resolution is now allowlist-based
- broad `process.env` inheritance was removed from runtime business code
- OpenNext `next-env.mjs` is sanitized after build against a contract allowlist

### Auth and cookie hardening

- cookie namespace moved to `__Host-socialflow_canary_session`
- generic `SESSION_SECRET` fallback removed
- registration now fails closed when no explicit `tenantId` and no `DEFAULT_TENANT_ID` is configured

### Observability minimum

- public readiness endpoint: `/api/socialflow/runtime/readiness`
- public health endpoint: `/api/socialflow/runtime/health`
- runtime response headers:
  - `x-correlation-id`
  - `x-socialflow-runtime-target`
  - `x-socialflow-runtime-state`
  - `x-socialflow-runtime-contract-version`
- middleware/auth/DB/OAuth/publishing failures now emit structured runtime events

### Rollback readiness

- rollback model is now explicit: route attach/detach against a distinct deployable worker target
- build audit emits `deploy-readiness-audit.json` with worker identity and blocker status

## Before / after

- `TEMP_SHARED`: `0 -> 0`
- `crossRuntimeReferenceCount`: `2 -> 2`
- `contaminatedFileCount`: `0 -> 0`
- env surface in `.open-next/cloudflare/next-env.mjs`: `29 -> 2`
- binding coverage: `0/8 -> 8/8`
- deploy blockers: `8 -> 0`
- rollback blockers: `3 -> 0`

## Current audit outputs

- `build/socialflow-runtime-scaffold/runtime-port-audit.json`
- `build/socialflow-runtime-scaffold/deploy-readiness-audit.json`

Current results:

- `deployBlockers = []`
- `rollbackBlockers = []`
- `processEnvReferenceCount = 1`
- remaining `process.env` usage is isolated to `src/lib/runtime-env.ts` as an allowlisted local build/dev fallback
- env surface kept after sanitization:
  - `APP_URL`
  - `NEXTAUTH_URL`

## Honest status

The deployable runtime target is now much harder to misdeploy:

- unique worker identity
- explicit binding contract
- explicit cookie/auth contract
- explicit readiness endpoints
- explicit build-time env sanitization

What is still intentionally not done:

- no routes attached
- no custom domains
- no remote deploy verification
- no live rollback rehearsal

## Validation

- `pnpm socialflow-runtime:build`
- `pnpm typecheck`
- `pnpm build`
- `pnpm test`
- `git diff --check`
