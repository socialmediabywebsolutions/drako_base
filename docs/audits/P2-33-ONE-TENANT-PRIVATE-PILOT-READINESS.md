# P2-33 - SocialFlow One-Tenant Private Pilot Readiness

## Scope

Production SocialFlow private pilot readiness on **2026-05-20**.

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
- global cutover
- destructive D1 changes
- real publish without explicit human approval

## P2-32 inherited baseline

Inherited from P2-32 PASS:

- production runtime stable
- staff-only production shadow smoke pass
- LinkedIn validate-connection pass in production
- encrypted token decrypt path valid
- publish confirm guard active
- token leakage audit pass
- production cutover still **not ready** by policy

## FASE 1 - Pilot criteria definition

### Pilot tenant decision

- pilot model: **one tenant only**
- candidate tenant: `tenant_socialflow_canary_staff` (existing)
- tenant creation in this phase: **not executed** (would require explicit approval)

### Pilot user decision

- pilot staff user: `socialflow-canary-staff+p2-24f@drako.systems`
- role: `admin`
- tenant: `tenant_socialflow_canary_staff`

### Feature scope enabled for private pilot

- login/session
- profile API/UI over production runtime
- LinkedIn validate connection dry-run
- AI page/API surface
- post drafts
- live publish path only with explicit `confirmPublish=true` and authorized role

### Feature scope blocked for private pilot

- automatic publish by scheduler (blocked by pilot-mode gate)
- bulk publish rollout
- multi-tenant rollout
- unattended campaign automation without human review
- real publish without explicit human approval

## FASE 2 - Tenant readiness audit (read-only)

Remote read-only audit executed with explicit-field queries (`no SELECT *`).

### Auth contracts (`saas_socialflow_auths_prod_db`)

- user exists:
  - `id = sf_canary_staff_p2_24f`
  - `email = socialflow-canary-staff+p2-24f@drako.systems`
  - `role = admin`
  - `tenant_id = tenant_socialflow_canary_staff`
  - `status = active`
- credential metadata present:
  - `algo = PBKDF2-SHA256`
  - `iterations = 100000`
- session rows present for user (`socialflow_sessions`) with tenant-bound metadata (`tenant_id`, `created_at`, `expires_at`)

### Social contracts (`saas_socialflows_prod_db`)

- LinkedIn account row for pilot tenant/saas:
  - `tenant_id = tenant_socialflow_canary_staff`
  - `saas_id = p2-24i-saas`
  - `provider = LINKEDIN`
  - `status = CONNECTED_REAL`
  - `is_primary = 1`
  - `access_token_encrypted = 1`
  - `id_token_encrypted = 1`
  - `last_error_code = null`
- posts inventory:
  - `posts_count = 6` for tenant/saas `tenant_socialflow_canary_staff / p2-24i-saas`
- campaigns inventory:
  - no campaign rows found in this tenant/saas slice (acceptable for pilot readiness)
- profile persistence slice:
  - no `socialflow_profiles` row currently for `tenant_socialflow_canary_staff / socialflow`
  - endpoint behavior from P2-32 already proved secure empty-state path (no demo fallback in production source)

### One-tenant isolation evidence

- LinkedIn accounts grouped by `saas_id = p2-24i-saas` returned only:
  - `tenant_socialflow_canary_staff` (count 1)
- posts grouped by `saas_id = p2-24i-saas` returned only:
  - `tenant_socialflow_canary_staff` (count 6)

Interpretation:

- current pilot dataset is effectively one-tenant scoped on the target SocialFlow saas slice.

## FASE 3 - Safety gates audit

### Existing gates validated

1. session required for protected routes
2. publish requires explicit `confirmPublish=true`
3. publish requires LinkedIn account in `CONNECTED_REAL`
4. pre-publish `validateAccount` call exists
5. tenant context resolved from authenticated session and social context
6. safe payload behavior: no token/auth_meta leakage in tested responses

### Gaps found and hardened (non-destructive code hardening)

Implemented local hardening for pilot mode:

1. feature-flag policy helpers:
   - `SOCIALFLOW_PRIVATE_PILOT_MODE`
   - `SOCIALFLOW_PRIVATE_PILOT_TENANT_ALLOWLIST`
2. publish path hardening in `POST /api/socialflow/posts`:
   - block non-admin roles when `confirmPublish=true`
   - block non-allowlisted tenant when private pilot mode is enabled
   - block publish when `auth_meta.lastErrorCode` is non-null/non-empty
   - block publish when LinkedIn tokens are not encrypted format
3. scheduler hardening:
   - when private pilot mode is enabled, cron scheduler marks due posts as `SKIPPED` with `PRIVATE_PILOT_AUTOPUBLISH_BLOCKED` instead of publishing

Hardening files:

- `src/lib/socialflow/private-pilot.ts`
- `src/app/api/socialflow/posts/route.ts`
- `src/lib/socialflow/scheduler.ts`
- `src/lib/cf.ts` (env typing for pilot vars)

## FASE 4 - Private pilot operational checklist

1. Preflight:
   - confirm production host health
   - confirm protected routes fail-closed without session
2. Pilot identity:
   - confirm pilot user and tenant mapping
3. Pilot mode gates:
   - set `SOCIALFLOW_PRIVATE_PILOT_MODE=true`
   - set `SOCIALFLOW_PRIVATE_PILOT_TENANT_ALLOWLIST=tenant_socialflow_canary_staff`
   - deploy controlled prod worker update
4. LinkedIn readiness:
   - run authenticated `validate-connection` before any publish action
5. Profile readiness:
   - confirm profile empty-state or complete minimal profile
6. Content readiness:
   - create draft post first
   - validate `confirmPublish` guard behavior
7. Real publish policy:
   - only with explicit human approval per action
8. Freeze/Rollback plan:
   - if anomaly: disable pilot mode or remove allowlist tenant and stop publish attempts
   - keep traffic topology unchanged
9. Incident plan:
   - capture `x-drako-correlation-id`
   - freeze pilot operations immediately on security/runtime anomaly

## FASE 5 - Optional hardening decision

- optional hardening: **applied** (minimal/non-destructive)
- no destructive data operations
- no DNS/workers.dev/wildcard changes
- no cutover operations

## FASE 6 - Validation

Executed:

- `pnpm socialflow-runtime:build` -> pass
- `pnpm typecheck` -> pass
- `pnpm build` -> pass
- `pnpm test` -> pass
- `git diff --check` -> pass

Added tests:

- `tests/api/socialflow-posts-route.test.ts`
  - non-admin publish blocked
  - non-allowlisted tenant blocked in pilot mode
  - unresolved LinkedIn validation error blocks publish
  - unencrypted token state blocks publish
- `tests/lib/social-scheduler.test.ts`
  - autopublish skipped in pilot mode
- `tests/lib/socialflow-private-pilot.test.ts`
  - pilot flag + allowlist policy behavior

## Blockers / residual risks

1. Pilot mode env vars are not yet declared as active runtime config in production deployment for this phase.
2. Real publish remains policy-blocked until explicit human approval per execution step.
3. `socialflow_profiles` persisted row for the pilot tenant is still absent (acceptable for readiness; must be handled during pilot execution flow).

## What did not change

- no DNS changes
- no workers.dev activation
- no wildcard global routes
- no drakosystems changes
- no global cutover
- no multi-tenant opening
- no destructive D1 operations
- no real publish execution

## Final decision

- `one-tenant-private-pilot-ready: si`
- `tenant-isolation-ready: si`
- `publish-safety-ready: si`
- `linkedin-readiness-ready: si`
- `profile-readiness-ready: si`
- `rollback-plan-ready: si`
- `production-cutover-ready: no`
- `next phase: P2-34 one-tenant private pilot execution` (only if explicit operator approval is granted)
