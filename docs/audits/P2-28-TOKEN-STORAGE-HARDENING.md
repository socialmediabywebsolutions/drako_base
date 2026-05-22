# P2-28 - SocialFlow Token Storage Hardening (Canary)

## Scope

Complete canary-only token storage rehardening for the existing real LinkedIn account row, verify encryption-at-rest status, and confirm safe operational output without token leakage.

Constraints respected:

- no production worker replacement
- no production DNS change
- no workers.dev enablement
- no wildcard global routing
- no production cutover
- no token or secret disclosure

## Real execution evidence

### 1) Rehardening endpoint execution

Request:

- `POST /api/socialflow/runtime/reharden`

Observed result:

- `HTTP/2 200`
- `success = true`
- `updated = true`
- `accessTokenStatus = encrypted`
- `idTokenStatus = encrypted`

Interpretation:

- Existing plaintext/legacy token fields were successfully re-hardened in-place.
- Endpoint behaved as intended in canary runtime.

### 2) Safe D1 verification query result

Scoped verification target:

- `tenant_id = tenant_socialflow_canary_staff`
- `saas_id = p2-24i-saas`
- `provider = LINKEDIN`

Observed result:

- `status = CONNECTED_REAL`
- `access_token_encrypted = 1`
- `id_token_encrypted = 1`
- `access_token_present = 1`
- `id_token_present = 1`
- `success = true`

Interpretation:

- Existing real LinkedIn row remains present and now stores both tokens encrypted.
- Persistence integrity is preserved after rehardening.

### 3) Runtime health/readiness

Observed:

- health with gate: `HTTP/2 200`
- readiness with gate: `HTTP/2 200`

Interpretation:

- Canary runtime remained healthy and ready after rehardening.

## Safe debug output confirmation

Confirmed during execution:

- no `SELECT *` usage
- no `auth_meta` dump
- no `accessToken` printed
- no `idToken` printed
- no encryption secret printed

Result:

- safe debug output: **si**
- api-token-leakage: **no**
- logs-token-leakage: **no**

## Mandatory validation executed

Executed in workspace (`/home/drako/workspace/drako_base`) via WSL:

- `pnpm socialflow-runtime:build` -> pass
- `pnpm typecheck` -> pass
- `pnpm build` -> pass
- `pnpm test` -> pass
- `git diff --check` -> pass

Note:

- Direct `pnpm` from PowerShell on `\\wsl$...` failed due to UNC working-directory behavior; all required commands were re-run successfully via `wsl.exe` in the Linux path above.

## What did not change

- no production worker updated
- no production DNS changes
- no workers.dev enabled
- no wildcard global route changes
- no production cutover
- no token values disclosed

## Final dictamen (official close)

- token-encryption-secret-present: **si**
- canary-deploy-hardened: **si**
- existing-linkedin-row-rehardened: **si**
- access-token-encrypted: **si**
- id-token-encrypted: **si**
- safe-debug-output: **si**
- api-token-leakage: **no**
- logs-token-leakage: **no**
- health: **200**
- readiness: **200**
- limited-traffic-ready: **si** (all mandatory validation checks passed)
- production-cutover-ready: **no**
