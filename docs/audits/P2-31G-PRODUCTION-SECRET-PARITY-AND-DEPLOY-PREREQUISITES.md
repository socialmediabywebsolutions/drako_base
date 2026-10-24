# P2-31G - SocialFlow Production Secret Parity and Deploy Prerequisites

## Scope

Production SocialFlow prerequisites only.

- Worker: `saas-socialflows-prod`
- Config: `workers/socialflows/wrangler.workers.toml`
- D1 binding: `SOCIAL_DB` -> `saas_socialflows_prod_db`

Out of scope:

- DNS changes
- workers.dev activation
- wildcard global routes
- drakosystems
- Campamento Base
- Mentoria
- production cutover
- real publish

Execution date: **2026-05-20**

## P2-31F prerequisite

P2-31F is validated PASS in canary and accepted as prerequisite baseline for P2-31G.

## FASE 1 - Final read-only inventory

### 1) Target worker confirmation

From `workers/socialflows/wrangler.workers.toml`:

- `name = "saas-socialflows-prod"`
- `workers_dev = false`
- custom domains:
  - `socialflows.drako.systems`
  - `socialflow.drako.systems`

### 2) Current production secrets by name

Latest `wrangler secret list` on production config reports:

- `LINKEDIN_CLIENT_ID`
- `LINKEDIN_CLIENT_SECRET`
- `SOCIALFLOWS_AUTHS_SECRET`
- `SOCIALFLOW_TOKEN_ENCRYPTION_SECRET`

Parity interpretation:

- LinkedIn production secrets are present.
- Token encryption production secret is present.
- Operator confirms `SOCIALFLOW_TOKEN_ENCRYPTION_SECRET` was loaded with the NEXT value validated in P2-31F.

### 3) Remote D1 schema verification

Verified on production `SOCIAL_DB`:

- table `socialflow_profiles` exists
- `PRAGMA table_info('socialflow_profiles')` returned expected columns
- `PRAGMA index_list('socialflow_profiles')` includes:
  - `idx_socialflow_profiles_tenant_saas`
  - `sqlite_autoindex_socialflow_profiles_2`
  - `sqlite_autoindex_socialflow_profiles_1`

### 4) Production code-level prerequisite checks

Confirmed in current source:

- token encryption runtime:
  - `src/lib/socialflow/token-encryption.ts`
- production validate route:
  - `src/app/api/socialflow/linkedin/validate-connection/route.ts`
- publish confirmation guard (`confirmPublish`):
  - `src/app/api/socialflow/posts/route.ts`
- profile D1 repository:
  - `src/lib/socialflow/profile/repository.ts`

### 5) Deploy necessity assessment

`saas-socialflows-prod` latest observed deployment is from **2026-05-17**.  
Current prerequisite parity code landed after that timeline in this workspace, so production deploy is required to activate latest runtime parity behavior.

Provisional decision:

- `production-deploy-required: si`

## FASE 2/3 - Production secret parity execution status

Executed status:

- `LINKEDIN_CLIENT_ID` secret put: done
- `LINKEDIN_CLIENT_SECRET` secret put: done
- `SOCIALFLOW_TOKEN_ENCRYPTION_SECRET` secret put: done
- post-put secret list revalidation: done

Security constraints maintained:

- no secret values printed
- no secret values committed
- no DNS changes
- no workers.dev changes
- no cutover

## Pending execution gates

Before any remote mutation:

1. Controlled production deploy approval (required to activate latest runtime parity code).
2. Non-destructive production smoke.

## FASE 4 - Controlled production deploy

Approved command executed:

```bash
pnpm exec wrangler deploy --config=workers/socialflows/wrangler.workers.toml
```

Observed evidence:

- `Uploaded saas-socialflows-prod`
- `Current Version ID` present
- no `saas-socialflows-runtime-canary` in deploy output
- no `drakosystems` in deploy output

Safety scope maintained:

- no DNS mutation commands executed
- no workers.dev activation
- no wildcard global changes
- no cutover action

Status:

- `production-deploy-executed: si`

## FASE 5 - Non-destructive production smoke (no session)

Checks executed:

1. `socialflow.drako.systems` response check
2. `GET /api/socialflow/profile`
3. `POST /api/socialflow/linkedin/validate-connection`
4. `POST /api/socialflow/posts` without `confirmPublish`
5. leakage checks in response payloads

Observed:

- root host final HTTP: `200`
- `GET /api/socialflow/profile` -> `401` (fail-closed)
- `POST /api/socialflow/linkedin/validate-connection` -> `401` (fail-closed)
- `POST /api/socialflow/posts` without session -> `401` (fail-closed; no publish path reached)
- no `accessToken` in responses
- no `idToken` in responses
- no `auth_meta` in responses

Status:

- `non-destructive-prod-smoke: si`
- `token-leakage: no`

## Current status snapshot

- `production-secret-parity-ready: si`
- `linkedin-prod-secrets-present: si`
- `token-encryption-prod-secret-present: si`
- `prod-uses-next-key-material: si` (operator-confirmed mapping to P2-31F NEXT material)
- `production-schema-verified: si`
- `production-deploy-required: si`
- `production-deploy-executed: si`
- `non-destructive-prod-smoke: si`
- `token-leakage: no`
- `p2-32-staff-only-production-shadow-smoke-allowed: si`
- `production-cutover-ready: no`
