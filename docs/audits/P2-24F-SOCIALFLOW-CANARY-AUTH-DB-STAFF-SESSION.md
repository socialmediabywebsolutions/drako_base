# P2-24F - SocialFlow Canary Auth DB Schema and Staff Session Provisioning

## Scope

Prepare the remote `SOCIALFLOW_AUTHS_DB` binding used by the isolated SocialFlow canary runtime so a real staff session can be created before the next LinkedIn OAuth consent phase.

Constraints respected:

- no production cutover
- no production DNS changes
- no workers.dev activation
- no public-open traffic
- no production worker replacement
- no LinkedIn OAuth success claimed

## Auth schema audit

Runtime files audited:

- `apps/socialflow-runtime/src/lib/auth/repository.ts`
- `apps/socialflow-runtime/src/lib/auth/service.ts`
- `apps/socialflow-runtime/src/lib/auth/session.ts`
- `apps/socialflow-runtime/src/app/api/socialflow/auths/logins/route.ts`
- `apps/socialflow-runtime/src/app/api/socialflow/auths/logouts/route.ts`

Tables required by runtime:

- `socialflow_users`
- `socialflow_credentials`
- `socialflow_sessions`

Required query fields:

- `socialflow_users`: `id`, `email`, `name`, `role`, `tenant_id`, `status`, `created_at`, `updated_at`
- `socialflow_credentials`: `id`, `user_id`, `type`, `hash`, `salt`, `iterations`, `algo`, `created_at`, `updated_at`
- `socialflow_sessions`: `id`, `user_id`, `tenant_id`, `token_hash`, `issued_at`, `expires_at`, `status`, `created_at`, `updated_at`

Reusable migration found:

- `migrations/0142_socialflow_auths.sql`

The migration matches the runtime queries and includes non-destructive `CREATE TABLE IF NOT EXISTS` / `CREATE INDEX IF NOT EXISTS` statements.

## Remote migration applied

Target:

- D1 database: `saas_socialflow_auths_prod_db`
- binding role in canary runtime: `SOCIALFLOW_AUTHS_DB`

Migration command:

- `pnpm exec wrangler d1 execute saas_socialflow_auths_prod_db --remote --file migrations/0142_socialflow_auths.sql --json`

Result:

- success: `true`
- total queries executed: `7`
- tables after migration:
  - `_cf_KV`
  - `socialflow_credentials`
  - `socialflow_sessions`
  - `socialflow_users`

Behavioral improvement:

- before schema migration: login probe returned `500 SOCIALFLOW_RUNTIME_LOGIN_FAILED`
- after schema migration: invalid login probe returned `401 INVALID_CREDENTIALS`

## Staff user provisioning

Created controlled canary-only staff user:

- user id: `sf_canary_staff_p2_24f`
- email: `socialflow-canary-staff+p2-24f@drako.systems`
- role: `admin`
- tenant id: `tenant_socialflow_canary_staff`
- status: `active`

Credential handling:

- password generated randomly inside the validation script
- password was not printed
- password was not committed
- password was rotated during validation
- password is not considered operator-distributable from this report

Remote counts after provisioning:

- `socialflow_users`: `1`
- `socialflow_credentials`: `1`
- `socialflow_sessions`: `6`

## Runtime code hardening

Minimal canary runtime changes:

- `apps/socialflow-runtime/src/app/api/socialflow/linkedin/connect/route.ts`
  - replaced immutable `Response.redirect(...)` with mutable `new Response(..., { status: 307, headers: { location } })`
  - reason: runtime headers could not be added to immutable redirect responses after real session login
- `apps/socialflow-runtime/src/app/api/socialflow/auths/logins/route.ts`
  - added `SOCIALFLOW_RUNTIME_EVENT:auth_login_success`
- `apps/socialflow-runtime/src/app/api/socialflow/auths/logouts/route.ts`
  - added `SOCIALFLOW_RUNTIME_EVENT:auth_logout_requested`
- `apps/socialflow-runtime/src/lib/auth/session.ts`
  - added `SOCIALFLOW_RUNTIME_EVENT:session_resolved`

## Remote canary deployment

Active canary version after P2-24F:

- `f1999d42-dc5b-49b8-9c16-b46d13275452`

Active deployment id:

- `025eb152-26ef-4197-9ac1-bc616183628d`

Secrets present on active version:

- `LINKEDIN_CLIENT_ID`
- `LINKEDIN_CLIENT_SECRET`
- `SOCIALFLOW_AUTHS_SECRET`
- `SOCIALFLOW_CANARY_GATE_TOKEN`

Gate note:

- `SOCIALFLOW_CANARY_GATE_TOKEN` was rotated for the canary worker during this phase.
- the secret value is intentionally not included in this report.

## Remote validation

Readiness:

- `GET /api/socialflow/runtime/readiness`: `200`
- blockers: `[]`

Login:

- `POST /api/socialflow/auths/logins`: `200`
- response role: `admin`
- response tenant: `tenant_socialflow_canary_staff`
- cookie emitted: `__Host-socialflow_canary_session`

Protected route session resolution:

- `GET /api/socialflow/linkedin/connect?saasId=p2-24f-staff`: `307`
- redirect target prefix: `https://www.linkedin.com/oauth/v2/authorization`
- runtime headers present

Exports protected path:

- `GET /api/socialflow/exports/current`: `503 SOCIALFLOW_RUNTIME_DB_UNAVAILABLE`
- reason: `migrations-missing`
- interpretation: staff auth/session passed, then the request hit the next real blocker in `SOCIAL_DB` schema readiness

Logout:

- `POST /api/socialflow/auths/logouts`: `200`
- cookie cleared: `__Host-socialflow_canary_session`

## Observability validation

Live `wrangler tail` captured:

- `SOCIALFLOW_RUNTIME_EVENT:auth_login_success`
- `SOCIALFLOW_RUNTIME_EVENT:session_resolved`
- `SOCIALFLOW_RUNTIME_EVENT:auth_logout_requested`

Runtime headers remained present on validated responses:

- `x-socialflow-runtime-target`
- `x-socialflow-runtime-state`
- `x-socialflow-runtime-contract-version`
- `x-correlation-id`

## What was not executed

LinkedIn OAuth consent was not executed in P2-24F.

No success is claimed for:

- real LinkedIn human consent
- real LinkedIn authorization code
- real token exchange
- real profile fetch
- real LinkedIn account persistence

## Remaining risks

- `SOCIAL_DB` still reports missing runtime migrations for exports/current.
- the canary staff password is not operator-deliverable from this report; use a secure out-of-band reset/provisioning step before human OAuth.
- LinkedIn dashboard callback URL allowlist still needs direct verification.
- post-OAuth rollback drill still needs to be repeated after real persistence.
- historical rollback versions may not share the current canary gate secret value.

## Validation executed

- `pnpm socialflow-runtime:build`
- remote canary deploy to `saas-socialflows-runtime-canary`
- remote readiness probe
- remote staff login probe
- remote protected `linkedin/connect` probe
- remote logout probe
- live `wrangler tail` observability check

Final local validation is recorded in the phase closeout response.

Final local validation result:

- `pnpm socialflow-runtime:build`: passed
- `pnpm typecheck`: passed
- `pnpm build`: passed
- `pnpm test`: passed
- `git diff --check`: passed

## Honest status

- staff session ready: **yes**
- LinkedIn OAuth unblocked: **partially**
- OAuth end-to-end validated: **no**
- production cutover ready: **no**
- next correct phase: **securely hand off or rotate operator staff credentials, verify LinkedIn dashboard callback allowlist, then rerun real human LinkedIn consent and persistence validation**
