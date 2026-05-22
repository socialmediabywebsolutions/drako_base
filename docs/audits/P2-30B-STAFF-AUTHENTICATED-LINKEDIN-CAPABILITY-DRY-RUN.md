# P2-30B - Staff Authenticated LinkedIn Capability Dry-Run (Canary)

## Scope

Close the strict fail from P2-30 by validating a real staff-authenticated LinkedIn capability path in canary without publishing real content.

Scope limited to:

- worker: `saas-socialflows-runtime-canary`
- host: `socialflow-canary.drako.systems`
- tenant: `tenant_socialflow_canary_staff`
- saas id: `p2-24i-saas`

Out of scope (unchanged):

- `saas-socialflows-prod`
- production DNS/cutover
- workers.dev
- wildcard global routes
- drakosystems
- Campamento Base
- Mentoria

## Why P2-30 failed and what P2-30B fixes

P2-30 failed strictly because runtime execution of encrypted LinkedIn token usage under real authenticated staff session was not exercised.

P2-30B adds and validates a safe capability endpoint that:

- requires authenticated staff session
- uses the real persisted LinkedIn row
- decrypts token internally in runtime path
- performs a safe provider call (no publish)
- never returns token values

## Endpoint and ingress resolution

### 1) Endpoint implemented

New endpoint:

- `POST /api/socialflow/linkedin/validate-connection`

Implemented behavior:

- session required
- tenant restricted to `tenant_socialflow_canary_staff`
- saasId restricted to `p2-24i-saas`
- canary host/runtime restriction enforced
- LinkedIn account must exist and be `CONNECTED_REAL`
- internal validation path uses runtime LinkedIn validation logic (decrypt + provider validation)
- updates only safe metadata fields (`lastValidationAt`, `lastErrorCode`, safe error message)
- does not return `accessToken`, `idToken`, or full `auth_meta`

### 2) Ingress attach needed and executed

Initial runtime call returned `522` (route not attached to canary).

Route attached (canary only):

- `socialflow-canary.drako.systems/api/socialflow/linkedin/validate-connection*`
- script target: `saas-socialflows-runtime-canary`

Post-attach probe:

- `HEAD /api/socialflow/linkedin/validate-connection` with gate -> `401` (session boundary active, route resolved)

## Staff-authenticated real dry-run evidence

Execution sequence:

1. Temporary staff password rotated securely (not printed).
2. Staff login executed:
   - `POST /api/socialflow/auths/logins` -> `200`
3. Authenticated capability call executed:
   - `POST /api/socialflow/linkedin/validate-connection` -> `200`

Safe response evidence:

- `ok = true`
- `provider = LINKEDIN`
- `status = CONNECTED_REAL`
- `tokenEncrypted = true`
- `profileMatch = true`
- `validatedAt` present
- no `accessToken` field
- no `idToken` field
- no `auth_meta` field

Interpretation:

- runtime authenticated path executed successfully
- encrypted token runtime usage/decrypt path is validated in real call
- provider call executed on safe validation path
- no real publish performed

## D1 secure verification (post dry-run)

Safe query executed with explicit fields only (no `SELECT *`, no token dump).

Observed result:

- `tenant_id = tenant_socialflow_canary_staff`
- `saas_id = p2-24i-saas`
- `provider = LINKEDIN`
- `status = CONNECTED_REAL`
- `access_token_encrypted = 1`
- `id_token_encrypted = 1`
- `last_validation_at = 2026-05-18T08:34:02.114Z`
- `last_error_code = null`

Interpretation:

- connection remains real and active
- encrypted-at-rest contract still enforced
- validation metadata updated safely

## Health/readiness

With current canary gate token:

- `GET /api/socialflow/runtime/health` -> `200`
- `GET /api/socialflow/runtime/readiness` -> `200`

## Token leakage audit

Confirmed in this phase:

- no `SELECT *`
- no `auth_meta` dump
- no `accessToken` output
- no `idToken` output
- no gate token output in docs/repo
- no secrets printed in audit evidence

Result:

- token-leakage: **no**

## Mandatory validation executed

Executed in `/home/drako/workspace/drako_base`:

- `pnpm socialflow-runtime:build` -> pass
- `pnpm typecheck` -> pass
- `pnpm build` -> pass
- `pnpm test` -> pass
- `git diff --check` -> pass

## What did not change

- no production worker replacement
- no production DNS changes
- no workers.dev enablement
- no wildcard global route attach
- no production cutover
- no real LinkedIn publish action

## Final dictamen

- staff-authenticated-linkedin-dry-run: **pass**
- encrypted-token-runtime-decrypt-valid: **si**
- provider-call-real-safe: **si**
- no-real-publish: **si**
- token-leakage: **no**
- canary-limited-traffic-ready: **si**
- production-cutover-ready: **no**