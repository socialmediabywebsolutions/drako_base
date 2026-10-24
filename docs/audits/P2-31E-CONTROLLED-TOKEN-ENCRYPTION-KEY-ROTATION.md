# P2-31E - Controlled Token Encryption Key Rotation Strategy (SocialFlow)

## Scope

Design and local implementation of a controlled SocialFlow token-encryption key rotation mechanism, without remote mutation.

This phase did **not** execute:

- production `secret put`
- production deploy
- DNS changes
- workers.dev changes
- cutover
- remote token rotation over D1

## Root cause

- Current LinkedIn tokens in `SOCIAL_DB` are encrypted.
- The original key material (`SOCIALFLOW_TOKEN_ENCRYPTION_SECRET`) is not recoverable from Cloudflare (expected behavior).
- Local secure sources did not contain recoverable key value.
- Setting a new production encryption secret blindly would break decrypt for existing encrypted tokens.

## Audit findings (code-level)

Audited:

- `apps/socialflow-runtime/src/lib/socialflow/token-encryption.ts`
- `src/lib/socialflow/token-encryption.ts`
- LinkedIn publishing/repository paths in canary and production
- `reharden` and `validate-connection` flows

Conclusion:

- Both canary and production runtime paths depend on `decryptToken(...)` to operate real LinkedIn credentials.
- Encryption key continuity is mandatory for existing encrypted rows.

## Implemented strategy: dual-key controlled rotation

### Added temporary dual-key capability

- Primary key (existing): `SOCIALFLOW_TOKEN_ENCRYPTION_SECRET`
- Next key (new): `SOCIALFLOW_TOKEN_ENCRYPTION_SECRET_NEXT`

Implemented behavior:

- `encryptToken(...)` keeps using **primary** key.
- `decryptToken(...)` tries primary and can fallback to NEXT (controlled compatibility).
- `reencryptTokenWithNext(...)` decrypts with current key only and re-encrypts with NEXT.
- `isNextEncryptionAvailable()` added for safe gating.

### Canary-only rotation endpoint (temporary utility)

Added:

- `POST /api/socialflow/runtime/rotate-token-encryption-key`

Security controls:

- canary runtime target required
- canary host required
- gate token required (`x-socialflow-canary-gate`)
- hardcoded scope:
  - tenant: `tenant_socialflow_canary_staff`
  - saas: `p2-24i-saas`
  - provider: `LINKEDIN`
- explicit confirmation required: `confirmRotate=true`
- fails closed if NEXT secret missing
- no `SELECT *`
- no token output
- no `auth_meta` output

Rotation behavior:

- decrypt old key material path
- re-encrypt with NEXT key
- preserve encrypted-at-rest model
- idempotent when token already rotated with NEXT

## Files changed

- `apps/socialflow-runtime/src/lib/socialflow/token-encryption.ts`
- `src/lib/socialflow/token-encryption.ts`
- `apps/socialflow-runtime/src/lib/runtime-env.ts`
- `src/lib/cf.ts`
- `apps/socialflow-runtime/runtime-deploy-contract.json`
- `apps/socialflow-runtime/src/middleware.ts`
- `apps/socialflow-runtime/src/app/api/socialflow/runtime/rotate-token-encryption-key/route.ts`
- `apps/socialflow-runtime/src/app/api/socialflow/runtime/rotate-token-encryption-key/route.test.ts`
- `apps/socialflow-runtime/src/lib/socialflow/token-encryption.test.ts`
- `tests/lib/socialflow-token-encryption.test.ts`

## Validation executed

Executed locally in `/home/drako/workspace/drako_base`:

- `pnpm socialflow-runtime:build` -> pass
- `pnpm typecheck` -> pass
- `pnpm build` -> pass
- `pnpm test` -> pass
- `git diff --check` -> pass

## What did not change

- no production secret mutations
- no production deploy
- no remote D1 mutation for this phase
- no DNS/workers.dev/cutover changes
- no token value disclosure
- no `auth_meta` disclosure

## Next approved remote sequence (separate phase)

1. Put `SOCIALFLOW_TOKEN_ENCRYPTION_SECRET_NEXT` in canary.
2. Execute canary rotation endpoint with gate and explicit confirm.
3. Validate:
   - safe D1 encrypted flags remain `1`
   - `status=CONNECTED_REAL`
   - `POST /api/socialflow/linkedin/validate-connection` returns `200`
4. Promote rotated key:
   - set primary secret to new key in canary
   - verify canary decrypt path still passes
5. Only then prepare production secret parity with the validated key material.

## Final dictamen

- original-encryption-secret-recoverable: **no**
- controlled-rotation-plan-ready: **si**
- dual-key-rotation-viable: **si**
- tokens-reencrypted-with-new-key: **no** (not executed remotely in this phase)
- canary-dry-run-after-rotation: **no** (pending remote execution)
- prod-secret-put-allowed-next: **no** (blocked until canary rotation execution + validation)
- p2-32-allowed: **no** (rotation execution/validation pending)

