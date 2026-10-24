# P2-29 - Canary Gate Rotation and Limited Traffic Readiness (SocialFlow)

## Scope

Rotate the canary gate token after exposure risk, invalidate old gate access, validate new gate access, and confirm canary readiness for limited staff-controlled traffic without changing production surfaces.

Scope limited to:

- worker: `saas-socialflows-runtime-canary`
- host: `socialflow-canary.drako.systems`

Out of scope (unchanged):

- `saas-socialflows-prod`
- production DNS/cutover
- workers.dev
- wildcard global routes
- drakosystems
- Campamento Base
- Mentoria

## Rotation reason

The previous `SOCIALFLOW_CANARY_GATE_TOKEN` was considered exposed during manual assistance, so token rotation was required before any real limited-traffic canary exercise.

## Execution evidence

### 1) Secret rotation (canary only)

Command used:

- `pnpm exec wrangler secret put SOCIALFLOW_CANARY_GATE_TOKEN --config=apps/socialflow-runtime/wrangler.toml`

Observed target:

- Worker in secret put output: `saas-socialflows-runtime-canary`

Not observed:

- `drakosystems`
- `saas-socialflows-prod`

### 2) Canary deploy after rotation

Command used:

- `pnpm exec opennextjs-cloudflare deploy --config=apps/socialflow-runtime/wrangler.toml`

Observed:

- `Uploaded saas-socialflows-runtime-canary`

Not observed:

- `drakosystems`
- `saas-socialflows-prod`

### 3) Local secret file updated (outside repo)

Updated locally only:

- `~/.drako-secrets/socialflow-canary.env`

Policy respected:

- no token committed
- no token written into repo docs

### 4) Old token invalidation

Validated against:

- `/api/socialflow/runtime/health`
- `/api/socialflow/runtime/readiness`

Result with old token:

- health: `403`
- readiness: `403`

### 5) New token validation

Validated against:

- `/api/socialflow/runtime/health`
- `/api/socialflow/runtime/readiness`

Result with new token:

- health: `200`
- readiness: `200`

### 6) D1 safe LinkedIn row verification

Safe query shape used:

- no `SELECT *`
- no `auth_meta` dump
- no token value output

Result:

- `tenant_id = tenant_socialflow_canary_staff`
- `saas_id = p2-24i-saas`
- `provider = LINKEDIN`
- `status = CONNECTED_REAL`
- `access_token_encrypted = 1`
- `id_token_encrypted = 1`
- `access_token_present = 1`
- `id_token_present = 1`
- `success = true`

Interpretation:

- existing real LinkedIn connection remains valid
- token-at-rest encryption remains enforced

### 7) Canary UI minimal smoke

Validated paths:

- `/socialflow`
- `/socialflow/settings/account`
- `/socialflow/profile`
- `/socialflow/ai`

Observed:

- final HTTP status: `200` on redirected auth surface
- no `522`
- no redirect loop
- no token leakage patterns in response bodies

Note:

- this smoke used gate-authenticated access and verified runtime stability/redirect integrity.

## Safe output confirmation

Confirmed in this phase:

- no `SELECT *`
- no `auth_meta` printed
- no `accessToken` printed
- no `idToken` printed
- no encryption secret printed
- no gate token included in repository files or audit docs

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
- no wildcard/global route changes
- no production cutover
- no non-canary product runtime mutation

## Final dictamen

- canary-gate-token-rotated: **si**
- old-gate-token-rejected: **si**
- new-gate-token-accepted: **si**
- health: **200**
- readiness: **200**
- linkedin-row-connected-real: **si**
- access-token-encrypted: **si**
- id-token-encrypted: **si**
- limited-traffic-ready: **si, canary/staff controlled**
- production-cutover-ready: **no**
