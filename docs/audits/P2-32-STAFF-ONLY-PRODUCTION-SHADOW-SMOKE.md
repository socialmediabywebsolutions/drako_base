# P2-32 - SocialFlow Staff-Only Production Shadow Smoke

## Scope

Staff-only production smoke for SocialFlow on **2026-05-20**.

- Worker: `saas-socialflows-prod`
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
- cutover
- real publish
- destructive D1 operations

## Prerequisite baseline

P2-31G was already PASS before this phase:

- production secret parity complete
- controlled production deploy executed
- non-destructive unauth smoke PASS
- token leakage audit PASS

## FASE 1 - Production preflight

Checks:

1. Host response
2. Unauthenticated fail-closed behavior
3. Leakage scan
4. workers.dev status confirmation path

Observed:

- `https://socialflow.drako.systems/` redirects (`308`) then final `200` at `/socialflow/auth`
- `https://socialflows.drako.systems/` redirects (`308`) then final `200` at `/socialflow/auth`
- `GET /api/socialflow/profile` without session -> `401`
- `POST /api/socialflow/linkedin/validate-connection` without session -> `401`
- `POST /api/socialflow/posts` without session -> `401`
- leakage scan on unauth responses: no `accessToken`, no `idToken`, no `auth_meta`

workers.dev evidence:

- production config keeps `workers_dev = false` in `workers/socialflows/wrangler.workers.toml`
- no workers.dev activation command executed in this phase

## FASE 2 - Staff auth production session

Staff user discovery (read-only on `SOCIALFLOW_AUTHS_DB`):

- user present: `socialflow-canary-staff+p2-24f@drako.systems`
- role: `admin`
- tenant: `tenant_socialflow_canary_staff`

Execution:

1. Temporary password hash rotated in `saas_socialflow_auths_prod_db` for the staff user (value never printed).
2. Temporary credential persisted only in local secure file:
   - `/home/drako/.drako-secrets/socialflow-prod-staff.env`
3. Login executed:
   - `POST /api/socialflow/auths/logins` -> `HTTP 200`

Safe response evidence:

- `ok = true`
- `role = admin`
- `tenantId = tenant_socialflow_canary_staff`
- no `accessToken` field
- no `idToken` field
- no `auth_meta` field

Temporary artifacts cleanup:

- cookie jar and temporary response files removed from `/tmp` after execution

## FASE 3 - Profile D1 smoke

With staff session:

- `GET /api/socialflow/profile` -> `HTTP 200`
- response contains profile object under tenant `tenant_socialflow_canary_staff` and `saasId = socialflow`
- no token leakage fields in payload

D1 verification:

- safe query on `socialflow_profiles` for tenant `tenant_socialflow_canary_staff` and `saas_id = socialflow` returned no persisted row in this smoke window

Interpretation:

- production profile endpoint serves secure empty-state behavior when no persisted row exists
- no demo-state repository was used in current production source path (`src/lib/socialflow/profile/repository.ts` resolves D1 context and table access)
- no profile upsert was executed in this phase

## FASE 4 - LinkedIn validate-connection production dry-run

With staff session:

- `POST /api/socialflow/linkedin/validate-connection` with `{"saasId":"p2-24i-saas"}` -> `HTTP 200`

Observed safe payload:

- `ok = true`
- `provider = LINKEDIN`
- `status = CONNECTED_REAL`
- `tokenEncrypted = true`
- `profileMatch = true`
- `validatedAt` present
- no `accessToken`
- no `idToken`
- no `auth_meta`

## FASE 5 - Publish safety smoke (no real publish)

With staff session, simplified contract path, no `confirmPublish=true`:

1. `POST /api/socialflow/posts` with `saasId + content` (no confirm flag) -> `HTTP 200`
2. `POST /api/socialflow/posts` with `confirmPublish=false` -> `HTTP 200`

Both responses:

- `post.status = DRAFT`
- `livePublish.ok = false`
- `livePublish.code = PUBLISH_CONFIRMATION_REQUIRED`
- `livePublish.dryRun = true`
- no `externalPostId`
- no tokens in payload

Result:

- publish confirmation guard is active
- no real publish executed

## FASE 6 - D1 safe verification

No `SELECT *` used. Explicit-field queries only.

1. `saas_social_accounts` (tenant `tenant_socialflow_canary_staff`, saas `p2-24i-saas`, provider `LINKEDIN`):

- `status = CONNECTED_REAL`
- `access_token_encrypted = 1`
- `id_token_encrypted = 1`
- `last_validation_at` updated during smoke
- `last_error_code = null`

2. `socialflow_profiles`:

- no persisted row found for tenant `tenant_socialflow_canary_staff` + `saas_id = socialflow` during this read-only/profile-get flow

## FASE 7 - Observability

Observed response headers include correlation information:

- `x-drako-correlation-id` present on production API responses
- Cloudflare request tracing present (`cf-ray`)

Payload/log safety in inspected responses:

- no `accessToken`
- no `idToken`
- no `auth_meta`

## FASE 8 - Mandatory validation

Executed in `/home/drako/workspace/drako_base`:

- `pnpm socialflow-runtime:build` -> pass
- `pnpm typecheck` -> pass
- `pnpm build` -> pass
- `pnpm test` -> pass
- `git diff --check` -> pass

## What did not change

- no DNS change
- no workers.dev activation
- no wildcard global route change
- no drakosystems changes
- no cutover
- no real publish
- no destructive D1 operation

## Final dictamen

- `staff-only-production-shadow-smoke: pass`
- `production-runtime-stable: si`
- `profile-d1-production-valid: si` (empty-state secure path observed; no demo fallback path in prod source)
- `linkedin-prod-validate-connection: si`
- `encrypted-token-prod-decrypt-valid: si`
- `publish-safety-guard-valid: si`
- `token-leakage: no`
- `production-cutover-ready: no`
- `next phase: P2-33 one-tenant private pilot readiness` (only because P2-32 passed)
