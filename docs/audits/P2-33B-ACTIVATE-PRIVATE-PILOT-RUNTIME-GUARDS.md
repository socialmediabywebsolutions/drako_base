# P2-33B - Activate SocialFlow Private Pilot Runtime Guards

## Scope

Production SocialFlow runtime guard activation on **2026-05-20**.

- Worker: `saas-socialflows-prod`
- Config: `workers/socialflows/wrangler.workers.toml`
- Hosts:
  - `socialflow.drako.systems`
  - `socialflows.drako.systems`

Out of scope (unchanged):

- DNS
- workers.dev
- wildcard global routes
- drakosystems
- Campamento Base
- Mentoria
- global cutover
- destructive data operations
- real publish

## Why this phase was required

P2-33 readiness had one residual risk: private pilot runtime vars were not yet active in production runtime config.

## FASE 1 - Config confirmation

Audited `workers/socialflows/wrangler.workers.toml` and confirmed pilot vars were missing before this phase.

## FASE 2 - Runtime vars activation

Added under `[vars]` in production config:

- `SOCIALFLOW_PRIVATE_PILOT_MODE = "true"`
- `SOCIALFLOW_PRIVATE_PILOT_TENANT_ALLOWLIST = "tenant_socialflow_canary_staff"`

Existing vars were preserved.

## FASE 3 - Controlled production deploy

Executed:

```bash
pnpm exec wrangler deploy --config=workers/socialflows/wrangler.workers.toml
```

Observed deploy evidence:

- `Uploaded saas-socialflows-prod`
- runtime bindings include:
  - `SOCIALFLOW_PRIVATE_PILOT_MODE ("true")`
  - `SOCIALFLOW_PRIVATE_PILOT_TENANT_ALLOWLIST ("tenant_socialflow_canary_staff")`
- current version id: `00dc5a53-8f7b-4b99-849e-7a3b23d002f3`
- no `saas-socialflows-runtime-canary`
- no `drakosystems`

Scope safety maintained:

- no DNS mutation
- no workers.dev activation
- no wildcard global route changes
- no cutover

## FASE 4 - Non-destructive post-deploy smoke

### Host and fail-closed checks

- `https://socialflow.drako.systems/` final HTTP: `200`
- `GET /api/socialflow/profile` without session: `401`
- `POST /api/socialflow/linkedin/validate-connection` without session: `401`
- `POST /api/socialflow/posts` without session: `401`

### Publish-without-confirm guard

With authenticated staff session:

- `POST /api/socialflow/posts` without `confirmPublish` -> `HTTP 200`
- `post.status = DRAFT`
- `livePublish.ok = false`
- `livePublish.code = PUBLISH_CONFIRMATION_REQUIRED`
- `livePublish.dryRun = true`

Interpretation:

- no live publish happened
- publish confirmation guard remains active

### Scheduler/autopublish block evidence in pilot mode

Runtime gate evidence:

- production deploy confirms `SOCIALFLOW_PRIVATE_PILOT_MODE=true`
- scheduler path contains explicit skip branch:
  - `status = SKIPPED`
  - `code = PRIVATE_PILOT_AUTOPUBLISH_BLOCKED`

Automated verification:

- `pnpm test tests/lib/social-scheduler.test.ts` -> pass
- includes case: `skips auto-publish when private pilot mode blocks scheduler publishing`

### Leakage audit

From inspected post-deploy responses:

- no `accessToken`
- no `idToken`
- no `auth_meta`

Result:

- `token-leakage: no`

## FASE 5 - Mandatory validation

Executed in `/home/drako/workspace/drako_base`:

- `pnpm socialflow-runtime:build` -> pass
- `pnpm typecheck` -> pass
- `pnpm build` -> pass
- `pnpm test` -> pass
- `git diff --check` -> pass

## What did not change

- no DNS changes
- no workers.dev activation
- no wildcard global changes
- no drakosystems changes
- no real publish
- no cutover

## Final dictamen

- `pilot-mode-vars-active: si`
- `allowlist-active: si`
- `production-deploy-executed: si`
- `publish-guard-active: si`
- `scheduler-autopublish-blocked: si`
- `token-leakage: no`
- `p2-34-one-tenant-private-pilot-execution-allowed: si`
- `production-cutover-ready: no`
