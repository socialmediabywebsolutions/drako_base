# P2-31B - SocialFlow Production Parity Remediation Before P2-32

## Scope

Production parity remediation in code/tests/docs only (no cutover execution):

- no production cutover
- no production DNS changes
- no workers.dev enablement
- no wildcard global route changes
- no production deploy in this phase
- no secret/token value disclosure

Date: **2026-05-18**

---

## P2-31 critical blockers (input)

From P2-31 audit:

1. production secret parity incomplete
2. production runtime token handling still plaintext-oriented
3. missing authenticated safe LinkedIn validate endpoint in production path
4. profile/settings intelligence still demo-backed in production path
5. simplified publish flow could publish live without explicit confirmation

---

## Phase 1 - Secret parity audit (read-only)

### Secret parity matrix (names only, no values)

| Secret name | Needed by code | Present in canary | Present in prod | Action needed | Risk if missing |
| --- | --- | --- | --- | --- | --- |
| `LINKEDIN_CLIENT_ID` | LinkedIn OAuth connect/callback | yes | no (observed) | add in prod worker | OAuth connect/exchange fails |
| `LINKEDIN_CLIENT_SECRET` | LinkedIn OAuth token exchange | yes | no (observed) | add in prod worker | OAuth token exchange fails |
| `SOCIALFLOW_TOKEN_ENCRYPTION_SECRET` | encrypted token decrypt/encrypt runtime path | yes | no (observed) | add in prod worker | encrypted token operations fail-closed |
| `SOCIALFLOWS_AUTHS_SECRET` / auth secret mapping | session auth boundary | n/a (different naming) | yes | keep mapped and validated | login/session failures if wrong |

### Production secret commands required (no values)

Do not execute in this phase without explicit approval window:

- `pnpm exec wrangler secret put LINKEDIN_CLIENT_ID --config=workers/socialflows/wrangler.workers.toml`
- `pnpm exec wrangler secret put LINKEDIN_CLIENT_SECRET --config=workers/socialflows/wrangler.workers.toml`
- `pnpm exec wrangler secret put SOCIALFLOW_TOKEN_ENCRYPTION_SECRET --config=workers/socialflows/wrangler.workers.toml`

---

## Phase 2 - Runtime decrypt parity (implemented)

### Changes

- Added production token encryption utility:
  - `src/lib/socialflow/token-encryption.ts`
- Added env typing for encryption secret:
  - `src/lib/cf.ts`
- Updated production LinkedIn publishing path to decrypt internally and keep legacy plaintext compatibility:
  - `src/lib/socialflow/linkedin/publishing.ts`
- Updated production LinkedIn persistence to store encrypted tokens in `authMeta`:
  - `src/lib/socialflow/linkedin/repository.ts`

### Behavior now

- encrypted token -> decrypt required at runtime before provider call
- plaintext legacy token -> still supported for compatibility
- encrypted token + missing secret -> fail-closed (`TokenEncryptionError`)
- no token fields exposed by these changes

---

## Phase 3 - Safe LinkedIn validate endpoint parity (implemented)

### New production endpoint

- `POST /api/socialflow/linkedin/validate-connection`
- File:
  - `src/app/api/socialflow/linkedin/validate-connection/route.ts`

### Security contract

- requires authenticated SocialFlow session
- requires `saasId`
- resolves tenant+saas context from session
- uses primary `LINKEDIN` account
- requires `status=CONNECTED_REAL`
- validates provider connectivity with internal decrypt path
- updates safe metadata only:
  - `lastValidationAt`
  - `lastErrorCode`
  - `lastErrorMessage`
- response excludes token values and excludes full `auth_meta`

---

## Phase 4 - Profile demo-backed blocker

Status: **open**

Finding:

- `src/lib/socialflow/profile/repository.ts` remains demo-backed (`exportDemoTenantState` / `replaceDemoTenantState`).
- A safe production replacement needs a dedicated D1-backed model/migration and controlled rollout.

Decision in P2-31B:

- no destructive migration performed
- blocker remains explicitly open for next remediation phase

---

## Phase 5 - Publish confirmation safety (implemented)

### Updated route

- `src/app/api/socialflow/posts/route.ts`

### Guard behavior now

- simplified unscheduled publish path no longer auto-publishes by default
- live publish requires `confirmPublish: true`
- without explicit confirm -> dry-run/no-publish response (`PUBLISH_CONFIRMATION_REQUIRED`)
- with confirm -> pre-publish LinkedIn validation required
- if validation fails -> no publish
- scheduled flow remains supported

---

## Tests added/updated

- Added:
  - `tests/lib/socialflow-token-encryption.test.ts`
  - `tests/api/socialflow-linkedin-validate-connection-route.test.ts`
  - `tests/api/socialflow-posts-route.test.ts`
- Updated:
  - `tests/lib/linkedin-connection.test.ts` (token encryption mock + encrypted authMeta assertion)

Security test coverage includes:

- encrypted decrypt success
- legacy plaintext compatibility
- fail-closed missing secret for encrypted token path
- no token leakage in validate endpoint responses
- no live publish without explicit `confirmPublish`

---

## Mandatory validation executed

Executed in `/home/drako/workspace/drako_base` (WSL):

- `pnpm socialflow-runtime:build` -> pass
- `pnpm typecheck` -> pass
- `pnpm build` -> pass
- `pnpm test` -> pass
- `git diff --check` -> pass

---

## What did not change

- no production deploy/cutover
- no DNS changes
- no workers.dev activation
- no wildcard global route changes
- no token/secret values disclosed
- no real publish execution introduced by this phase

---

## Final dictamen

- secret-parity-plan-ready: **si**
- prod-decrypt-runtime-parity: **si**
- prod-linkedin-validate-endpoint-ready: **si**
- profile-demo-backed-blocker: **open**
- publish-confirmation-guard: **si**
- token-leakage: **no**
- canary-limited-traffic-ready: **si**
- p2-32-staff-only-production-shadow-smoke-allowed: **no** (blocked by open profile/data-path parity item + pending production secret provisioning execution)
- production-cutover-ready: **no**
