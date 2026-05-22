# P2-34 - SocialFlow One-Tenant Private Pilot Execution

## Scope

One-tenant private pilot controlled execution on production SocialFlow (**2026-05-20**).

- Worker: `saas-socialflows-prod`
- Hosts:
  - `socialflow.drako.systems`
  - `socialflows.drako.systems`
- Pilot tenant: `tenant_socialflow_canary_staff`
- Pilot staff/admin user: `socialflow-canary-staff+p2-24f@drako.systems`

Out of scope (unchanged):

- DNS
- workers.dev
- wildcard global routes
- drakosystems
- Campamento Base
- Mentoria
- global cutover
- destructive D1 operations
- real publish without explicit separate approval

## Inherited baseline

P2-33B was already PASS before execution:

- pilot-mode runtime vars active
- tenant allowlist active
- publish guard active
- scheduler autopublish blocked in pilot mode
- token leakage audit pass
- production cutover still **not ready** by policy

## FASE 1 - Preflight pass

Validated:

- `socialflow.drako.systems` final HTTP: `200`
- `socialflows.drako.systems` final HTTP: `200`
- unauth fail-closed:
  - `GET /api/socialflow/profile` -> `401`
  - `POST /api/socialflow/linkedin/validate-connection` -> `401`
  - `POST /api/socialflow/posts` -> `401`
- runtime pilot vars active in prod config:
  - `SOCIALFLOW_PRIVATE_PILOT_MODE=true`
  - `SOCIALFLOW_PRIVATE_PILOT_TENANT_ALLOWLIST=tenant_socialflow_canary_staff`

## FASE 2 - Staff/admin tenant-bound session pass

Production login executed under pilot staff user:

- `POST /api/socialflow/auths/logins` -> `HTTP 200`
- `ok=true`
- `role=admin`
- `tenantId=tenant_socialflow_canary_staff`

Safety:

- no cookie dump
- no secrets printed
- temporary runtime artifacts cleaned

## FASE 3 - Profile pilot execution pass

Approved minimal profile write executed:

- `POST /api/socialflow/profile` -> `HTTP 200`
- body:
  - `saasId=socialflow`
  - `profile.brandName=SocialFlow Private Pilot`
  - `profile.displayName=SocialFlow Pilot Tenant`

Read-back:

- `GET /api/socialflow/profile` with session -> `HTTP 200`
- tenant scope remains `tenant_socialflow_canary_staff`
- no demo fallback path used for this pilot row (D1 persisted row verified)

## FASE 4 - LinkedIn validation pass

With authenticated staff session:

- `POST /api/socialflow/linkedin/validate-connection` with `saasId=p2-24i-saas` -> `HTTP 200`

Observed safe result:

- `ok=true`
- `provider=LINKEDIN`
- `status=CONNECTED_REAL`
- `tokenEncrypted=true`
- `profileMatch=true`
- `validatedAt` present

No leakage fields in inspected responses:

- no `accessToken`
- no `idToken`
- no `auth_meta`

## FASE 5 - Draft post pass (no publish)

Approved draft-only request executed:

- `POST /api/socialflow/posts` with:
  - `saasId=p2-24i-saas`
  - private test content
  - `confirmPublish` omitted

Observed:

- `HTTP 200`
- created `post.id = e0a9fb3e-d667-4e2d-a420-b7a6a051cf37`
- `post.status = DRAFT`
- `livePublish.ok = false`
- `livePublish.code = PUBLISH_CONFIRMATION_REQUIRED`
- `livePublish.dryRun = true`
- no `externalPostId`

Interpretation:

- no real publish executed
- no LinkedIn publish path triggered

## FASE 6 - Real publish not executed

`confirmPublish=true` was **not** executed in this phase.

Policy remains:

- real publish requires explicit separate human approval workflow (next phase P2-35).

## FASE 7 - Scheduler safety pass

Autopublish block in pilot mode remains validated:

- `pnpm test tests/lib/social-scheduler.test.ts` -> pass
- includes guard case:
  - `skips auto-publish when private pilot mode blocks scheduler publishing`
  - scheduler returns skip semantics under pilot mode

No cron real publish run was executed in this phase.

## FASE 8 - D1 safe verification (explicit fields only)

No `SELECT *` was used.

1. `socialflow_profiles`:
- `tenant_id=tenant_socialflow_canary_staff`
- `saas_id=socialflow`
- `brand_name=SocialFlow Private Pilot`
- `display_name=null`
- `updated_at=2026-05-20T19:29:53.999Z`

2. `saas_social_posts` (latest pilot draft):
- `id=e0a9fb3e-d667-4e2d-a420-b7a6a051cf37`
- `tenant_id=tenant_socialflow_canary_staff`
- `saas_id=p2-24i-saas`
- `status=DRAFT`
- `created_at=2026-05-20T19:31:31.542Z`
- `updated_at=2026-05-20T19:31:31.542Z`

3. `saas_social_accounts` (LinkedIn encrypted flags):
- `tenant_id=tenant_socialflow_canary_staff`
- `saas_id=p2-24i-saas`
- `provider=LINKEDIN`
- `status=CONNECTED_REAL`
- `access_token_encrypted=1`
- `id_token_encrypted=1`
- `last_validation_at=2026-05-20T19:52:50.767Z`
- `last_error_code=null`

## FASE 9 - Observability and leakage audit

Observed:

- `x-drako-correlation-id` present in authenticated production responses
- responses inspected in this phase contain:
  - no `accessToken`
  - no `idToken`
  - no `auth_meta`

Result:

- `token-leakage: no`

## Rollback / freeze plan

If anomaly appears during pilot continuation:

1. Freeze pilot publish actions immediately (keep `confirmPublish=true` blocked operationally).
2. Keep tenant in read-only safe flow while triaging issue.
3. Preserve current DNS/topology unchanged.
4. Capture correlation IDs for incident timeline.
5. If needed, disable pilot execution window and revert to prior verified operational posture without enabling broad traffic.

## FASE 10 - Mandatory validation

Executed in `/home/drako/workspace/drako_base`:

- `pnpm socialflow-runtime:build` -> pass
- `pnpm typecheck` -> pass
- `pnpm build` -> pass
- `pnpm test` -> pass
- `git diff --check` -> pass

## What did not change

- no DNS change
- no workers.dev activation
- no wildcard global route changes
- no drakosystems changes
- no global cutover
- no real publish execution
- no destructive D1 operations

## Final dictamen

- `one-tenant-private-pilot-executed: pass`
- `tenant-session-valid: si`
- `profile-pilot-valid: si`
- `linkedin-validation-valid: si`
- `draft-post-valid: si`
- `real-publish-executed: no`
- `scheduler-autopublish-blocked: si`
- `token-leakage: no`
- `private-pilot-can-continue: si`
- `production-cutover-ready: no`
- `next phase: P2-35 controlled real publish approval workflow`
