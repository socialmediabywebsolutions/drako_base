# P2-30 - SocialFlow Staff-Controlled Limited Traffic Drill (Canary)

## Scope

Execute a limited-traffic drill only on canary/staff scope:

- worker: `saas-socialflows-runtime-canary`
- host: `socialflow-canary.drako.systems`
- tenant: `tenant_socialflow_canary_staff`
- saas id: `p2-24i-saas`

Out of scope (unchanged):

- `saas-socialflows-prod`
- production DNS / cutover
- workers.dev
- wildcard global routes
- drakosystems
- Campamento Base
- Mentoria

## Phase 1 - Canary preflight

Validated with current canary gate token:

- `GET /api/socialflow/runtime/health` -> `200`
- `GET /api/socialflow/runtime/readiness` -> `200`

UI gate-protected smoke (no 522, no loop):

- `/socialflow` -> `200` (redirected auth surface)
- `/socialflow/settings/account` -> `200` (redirected auth surface)
- `/socialflow/profile` -> `200` (redirected auth surface)
- `/socialflow/ai` -> `200` (redirected auth surface)

Safe row check (no `SELECT *`, no token value output):

- `tenant_id = tenant_socialflow_canary_staff`
- `saas_id = p2-24i-saas`
- `provider = LINKEDIN`
- `status = CONNECTED_REAL`
- `access_token_encrypted = 1`
- `id_token_encrypted = 1`
- `access_token_present = 1`
- `id_token_present = 1`
- `success = true`

## Phase 2 - Staff journey minimum

Executed as safe HTTP smoke (no secret output), using gate and auth boundaries:

1. Login/session probe: `POST /api/socialflow/auths/logins` with invalid payload -> `400` (expected input guard)
2. Workspace open: `/socialflow` -> `200` (redirect to `/socialflow/auth?...`)
3. Settings/account open: `/socialflow/settings/account` -> `200` (redirect to auth)
4. LinkedIn connected confirmation: validated via safe D1 row (`CONNECTED_REAL`, encrypted flags = `1`)
5. Profile open: `/socialflow/profile` -> `200` (redirect to auth)
6. AI open: `/socialflow/ai` -> `200` (redirect to auth)
7. Campaign/post safe probe: `GET /api/socialflow/campaigns?saasId=p2-24i-saas` and `GET /api/socialflow/posts?saasId=p2-24i-saas` -> `401` (session required, fail-closed)
8. Response leakage scan across probes: no `accessToken`, no `idToken`, no `auth_meta`, no gate token string

## Phase 3 - LinkedIn capability validation

Findings:

- No dedicated canary endpoint for LinkedIn dry-run / connection refresh / account validation was exposed without a live publish path.
- Live publish path exists but requires authenticated session and would publish real content when using simplified POST flow, which is out of bounds without explicit human confirmation.

What was validated safely:

- persisted LinkedIn row remains `CONNECTED_REAL`
- encrypted token persistence remains intact (`access_token_encrypted=1`, `id_token_encrypted=1`)
- runtime code path confirms publish flow decrypts internally before provider call:
  - `apps/socialflow-runtime/src/lib/socialflow/linkedin/publishing.ts` uses `decryptToken(...)`
- test suite includes encryption/decryption and live publishing flow tests, all passing in this run

What was not validated live in this drill:

- real runtime execution of decrypt + provider call under authenticated canary staff session

## Phase 4 - Observability and safe output

Observed:

- health/readiness responses include:
  - `x-correlation-id`
  - `x-socialflow-runtime-target=saas-socialflows-runtime-canary`
  - `x-socialflow-runtime-state=inactive-deployable`
  - `x-socialflow-runtime-contract-version=p2-21`

Security output checks:

- no `auth_meta` dump
- no `accessToken` output
- no `idToken` output
- no gate token output
- no secrets persisted in repo docs/files

## Phase 5 - Regression validation

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
- no wildcard/global route changes
- no production cutover

## Final dictamen

- staff-limited-traffic-drill: **fail** (incomplete for live staff-session LinkedIn capability execution)
- canary-runtime-stable: **si**
- linkedin-connected-real: **si**
- encrypted-token-usage-valid: **no** (live runtime decrypt usage not exercised in this drill)
- token-leakage: **no**
- production-cutover-ready: **no**
- next phase: **not yet**; complete a staff-authenticated canary LinkedIn capability check (dry-run preferred) before `P2-31`
