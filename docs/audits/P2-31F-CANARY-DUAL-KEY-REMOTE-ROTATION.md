# P2-31F - Canary Dual-Key Token Rotation Remote Execution

## Scope

Remote controlled execution for SocialFlow **canary only**.

- Worker: `saas-socialflows-runtime-canary`
- Host: `socialflow-canary.drako.systems`
- Tenant: `tenant_socialflow_canary_staff`
- SaaS: `p2-24i-saas`
- Provider: `LINKEDIN`

Out of scope (unchanged):

- `saas-socialflows-prod`
- production cutover
- production DNS
- workers.dev
- wildcard global routes
- drakosystems
- Campamento Base
- Mentoria

Execution date: **2026-05-20**

## Why this was executed

P2-31E left dual-key support ready in code, but existing LinkedIn tokens were still not re-encrypted with NEXT.  
Original encryption key value is not recoverable from Cloudflare export paths, so controlled dual-key runtime rotation is required.

## FASE 1 - Prepare NEXT secret (local secure store)

Executed:

- Created local secure file: `~/.drako-secrets/socialflow-token-next.env`
- Stored:
  - `export SOCIALFLOW_TOKEN_ENCRYPTION_SECRET_NEXT="<redacted>"`

Security:

- value not printed
- file not committed
- value not added to docs/repo

Status:

- `next-secret-local-prepared: si`

## FASE 2 - Upload NEXT secret to canary only

Executed (canary scope):

```bash
pnpm exec wrangler secret put SOCIALFLOW_TOKEN_ENCRYPTION_SECRET_NEXT --name saas-socialflows-runtime-canary --config=wrangler.toml
```

Observed result:

- `Success! Uploaded secret SOCIALFLOW_TOKEN_ENCRYPTION_SECRET_NEXT`
- worker target confirmed: `saas-socialflows-runtime-canary`

Status:

- `next-secret-canary-set: si`

## FASE 3 - Canary deploy

Executed:

```bash
pnpm exec opennextjs-cloudflare deploy --config=apps/socialflow-runtime/wrangler.toml
```

Observed result:

- `Uploaded saas-socialflows-runtime-canary`
- version id: `75f45570-0e08-4f04-9dcf-c6d2d8c94888`
- no `saas-socialflows-prod` deployment observed
- no `drakosystems` target observed

Status:

- `canary-dual-key-deployed: si`

## FASE 4 - Canary rotation route check

Target route required:

- `socialflow-canary.drako.systems/api/socialflow/runtime/rotate-token-encryption-key*`

Initial probe returned `HTTP 522`.  
Route was then added manually in Cloudflare (canary only), confirmed by operator:

- route: `socialflow-canary.drako.systems/api/socialflow/runtime/rotate-token-encryption-key*`
- script: `saas-socialflows-runtime-canary`

Constraints kept:

- no wildcard global route
- no production route mutation

Status:

- `rotate-route-ready: si`

## FASE 5 - Execute rotation

Executed:

- `POST /api/socialflow/runtime/rotate-token-encryption-key`
- headers:
  - `x-socialflow-canary-gate`
- body:
  - `{"confirmRotate": true}`

Observed safe response:

- `HTTP 200`
- `success = true`
- `updated = false` (idempotent state)
- `provider = LINKEDIN`
- `status = CONNECTED_REAL`
- `tokenRotation.accessToken = already_rotated_with_next`
- `tokenRotation.idToken = already_rotated_with_next`
- no `accessToken` field
- no `idToken` field
- no `auth_meta` field

Interpretation:

- rotation endpoint executed successfully
- tokens were already rotated with NEXT (idempotent-safe result)

Status:

- `tokens-reencrypted-with-next-key: si`

## FASE 6 - D1 safe query (no SELECT *)

Executed safe query with explicit fields only on `SOCIAL_DB` for:

- `tenant_socialflow_canary_staff`
- `p2-24i-saas`
- `LINKEDIN`

Observed:

- `status = CONNECTED_REAL`
- `access_token_encrypted = 1`
- `id_token_encrypted = 1`
- `last_error_code = null`

Status:

- `d1-encrypted-flags-ok: si`

## FASE 7 - Authenticated validate-connection post-rotation

Execution sequence:

1. Temporary staff password rotated in canary auth DB (`SOCIALFLOW_AUTHS_DB`) for `socialflow-canary-staff+p2-24f@drako.systems` (value never printed).
2. Staff login API executed under canary gate:
   - `POST /api/socialflow/auths/logins` -> `HTTP 200`
3. Authenticated post-rotation validation:
   - `POST /api/socialflow/linkedin/validate-connection` -> `HTTP 200`

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

Status:

- `canary-validate-connection-after-rotation: si`

## Token leakage audit

Confirmed in this phase:

- no current secret value printed
- no next secret value printed
- no gate token printed
- no `accessToken` printed
- no `idToken` printed
- no `auth_meta` printed
- no `SELECT *` executed in P2-31F remote validation

Result:

- `token-leakage: no`

## What did not change

- no production secret put
- no production deploy
- no production D1 mutation
- no production DNS changes
- no workers.dev changes
- no wildcard global routes
- no real publish action

## FASE 8 decision (production secret)

FASE 5-7 completed successfully in canary.

Decision:

- NEXT key is a valid candidate for production parity preparation.
- `prod-secret-put-allowed-next: si` (prepare-only decision)
- no production secret put executed in this phase

## FASE 10 - Mandatory local validation

Executed in `/home/drako/workspace/drako_base`:

- `pnpm socialflow-runtime:build` -> pass
- `pnpm typecheck` -> pass
- `pnpm build` -> pass
- `pnpm test` -> pass
- `git diff --check` -> pass

## Final dictamen

- `next-secret-canary-set: si`
- `canary-dual-key-deployed: si`
- `tokens-reencrypted-with-next-key: si`
- `d1-encrypted-flags-ok: si`
- `canary-validate-connection-after-rotation: si`
- `token-leakage: no`
- `prod-secret-put-allowed-next: si` (decision only, no prod execution)
- `p2-32-allowed: no` (until production secret parity/deploy prerequisites are completed)
- `production-cutover-ready: no`
