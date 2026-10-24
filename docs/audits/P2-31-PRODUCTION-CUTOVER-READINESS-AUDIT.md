# P2-31 - SocialFlow Production Cutover Readiness Audit

## Scope

Read-only production cutover readiness audit for SocialFlow as of **2026-05-18**.

This phase is audit/documentation only:

- no production cutover
- no production worker deployment
- no DNS changes
- no workers.dev activation
- no wildcard global route changes
- no drakosystems changes

## Executive summary

- canary-limited-traffic-ready: **si**
- production-cutover-ready: **no**
- primary reason: **canary security/runtime hardening is not yet parity-aligned with current production SocialFlow runtime**

Critical blockers found:

1. Production worker secret inventory does not show LinkedIn OAuth secrets nor token encryption secret.
2. Production SocialFlow code path still uses plaintext token model (no decrypt path), while canary now stores encrypted tokens.
3. Production lacks authenticated safe LinkedIn validation dry-run endpoint (`/api/socialflow/linkedin/validate-connection`).
4. Production profile/settings intelligence path still depends on demo-state repository behavior.

## Phase 1 - Consolidated status (P2-27 to P2-30B)

### P2-27

- real human LinkedIn OAuth consent: **si**
- real token exchange: **si**
- real persistence in `saas_social_accounts`: **si**

### P2-28

- token storage hardening (canary): **si**
- encrypted-at-rest verified:
  - `access_token_encrypted = 1`
  - `id_token_encrypted = 1`
- safe debug output validated

### P2-29

- canary gate token rotated: **si**
- old token rejected: **si**
- new token accepted: **si**

### P2-30

- initial staff limited traffic drill: **fail estricto**
- reason: no authenticated runtime dry-run proving real decrypt + provider validation path

### P2-30B

- authenticated dry-run capability implemented and validated in canary
- `POST /api/socialflow/linkedin/validate-connection` under staff session: **200**
- safe response confirmed (no token fields)
- runtime decrypt + safe provider call validated

Consolidated interpretation:

- P2-30 initial fail is remediated by P2-30B.
- Current final canary state: **limited-traffic-ready = si (canary/staff controlled)**.
- Production cutover remains pending P2-31 audit outcome.

## Phase 2 - Canary vs production inventory differences

### Worker identity and artifacts

- Canary worker: `saas-socialflows-runtime-canary`
  - main: `apps/socialflow-runtime/.open-next/worker.js`
  - artifact model: canary runtime contract (`p2-21`)
- Production worker: `saas-socialflows-prod`
  - main: `../../.open-next/socialflows-standalone/worker.js`
  - artifact model: standalone runtime copy (`open-next-socialflows-standalone-build`)

### Exposure model (routes/domains)

Observed Cloudflare inventory:

- Canary uses attached zone routes (`socialflow-canary.drako.systems/...`) including:
  - `/api/socialflow/runtime/health`
  - `/api/socialflow/runtime/readiness`
  - `/api/socialflow/runtime/reharden*`
  - `/api/socialflow/linkedin/validate-connection*`
- Production uses worker custom domains (no zone route list for script):
  - `socialflow.drako.systems`
  - `socialflows.drako.systems`

### workers.dev

- canary: disabled
- production: disabled
- subdomain status check:
  - `saas-socialflows-runtime-canary`: `enabled=false`, `previews_enabled=false`
  - `saas-socialflows-prod`: `enabled=false`, `previews_enabled=false`

### D1 bindings

Canary (`apps/socialflow-runtime/wrangler.toml`):

- `DRACO_DB`
- `SOCIAL_DB`
- `SOCIALFLOW_AUTHS_DB`

Production (`workers/socialflows/wrangler.workers.toml`):

- `SAASES_DB` (same DB as social)
- `SOCIAL_DB`
- `SOCIALFLOW_AUTHS_DB`

### Secrets inventory (names only)

Canary worker secrets observed:

- `SOCIALFLOW_AUTHS_SECRET`
- `LINKEDIN_CLIENT_ID`
- `LINKEDIN_CLIENT_SECRET`
- `SOCIALFLOW_CANARY_GATE_TOKEN`
- `SOCIALFLOW_TOKEN_ENCRYPTION_SECRET`

Production worker secrets observed:

- `SOCIALFLOWS_AUTHS_SECRET`

### Runtime vars

Canary runtime vars include canary-specific controls:

- `SOCIALFLOW_RUNTIME_TARGET=canary`
- `SOCIALFLOW_RUNTIME_STATE=inactive-deployable`
- `SOCIALFLOW_RUNTIME_COOKIE_NAMESPACE=socialflow_canary`
- `SOCIALFLOW_CANARY_GATED_HOSTS=socialflow-canary.drako.systems`

Production vars are product/general vars:

- `SAASES_SLUG=socialflows`
- `SAASES_DOMAIN=socialflows.drako.systems,socialflow.drako.systems`
- `WORKERS_ONLY_MODE=true`

### Middleware public/gated behavior

Canary middleware (`apps/socialflow-runtime/src/middleware.ts`):

- explicit canary gate enforcement
- callback signed-state bypass logic
- canary runtime observability headers

Production middleware (`src/middleware.ts`):

- no canary gate model
- host-based product routing + auth/session and tenant checks
- no runtime `reharden` or `validate-connection` routes in `src/app/api/socialflow`

### LinkedIn callback/canonical URLs

- Canary callback URL: `https://socialflow-canary.drako.systems/api/socialflow/linkedin/callback`
- Production canonical callback path in code: `/api/socialflow/linkedin/callback`
- Production custom domains resolving SocialFlow hostnames:
  - `socialflow.drako.systems`
  - `socialflows.drako.systems`

## Phase 3 - Production risk audit

### Critical blockers

1. **Secret parity gap**
   - Production secret list does not show LinkedIn client secrets nor token encryption secret.
   - Risk: OAuth connect/exchange and encrypted token operations may fail in production path.

2. **Token encryption runtime mismatch**
   - Canary runtime path decrypts via `apps/socialflow-runtime/src/lib/socialflow/linkedin/publishing.ts` + `token-encryption.ts`.
   - Production path (`src/lib/socialflow/linkedin/publishing.ts`) expects plaintext `authMeta.accessToken` and does not decrypt.
   - Risk: production provider calls against encrypted rows can fail; canary security posture is not parity-aligned.

3. **No production safe validation endpoint**
   - Canary has authenticated dry-run endpoint.
   - Production `src/app/api/socialflow/linkedin` contains only `connect` and `callback`.
   - Risk: no safe pre-publish runtime validation primitive for encrypted credentials.

4. **Profile intelligence still demo-backed**
   - `src/lib/socialflow/profile/repository.ts` persists/reads via demo-state helpers.
   - Risk: product behavior is not fully production-data-native for profile knowledge path.

### High/medium risks

5. **Publish confirmation control gap**
   - `src/app/api/socialflow/posts/route.ts` simplified POST path can trigger live publish when unscheduled.
   - Risk: insufficient explicit publish-confirmation guard for high-safety production posture.

6. **Observability parity gap**
   - Canary exposes dedicated runtime health/readiness contract endpoints.
   - Production `src/app/api/socialflow/runtime/*` routes are absent.
   - Risk: weaker parity for operational contract checks before cutover.

7. **Standalone runtime-copy residual risk**
   - Artifact matrix still marks SocialFlow production as standalone runtime copy (`partial-split` state).
   - Risk: additional verification needed before full production confidence.

### Passed safety checks

- no workers.dev enabled for socialflow canary/prod workers
- no wildcard global route requirement identified for socialflow prod host attachment
- legacy `/api/social/linkedin/publish` route is fail-closed (`410`)
- no production `/api/socialflow/runtime/reharden`
- no production `/api/socialflow/linkedin/validate-connection` exposure without auth

## Phase 4 - Minimum product readiness audit (production surface, code-level)

### Functional checklist

1. Login/register flow
- status: **si (implemented)**
- evidence: `src/app/api/socialflow/auths/logins`, `registrations`, `logouts`

2. Workspace UI
- status: **si (implemented)**
- evidence: `src/app/socialflow/(workspace)/page.tsx`

3. Settings/account
- status: **si (implemented)**
- evidence: `src/app/socialflow/(workspace)/settings/account/page.tsx`

4. LinkedIn connect/callback
- status: **parcial (code present, secret parity blocker)**
- evidence: `src/app/api/socialflow/linkedin/connect`, `callback`

5. Profile UI/API
- status: **parcial (demo-backed repository risk)**
- evidence: `src/app/api/socialflow/profile/route.ts` + `src/lib/socialflow/profile/repository.ts`

6. AI page + API
- status: **si (implemented)**
- evidence: `src/app/socialflow/(workspace)/ai/page.tsx`, `src/app/api/socialflow/ai/generate/route.ts`

7. Campaigns/posts APIs
- status: **si (implemented, session-enforced)**
- evidence: `src/app/api/socialflow/campaigns/route.ts`, `src/app/api/socialflow/posts/route.ts`

8. Safe dry-run capability
- status: **no (missing in production)**
- evidence: no `src/app/api/socialflow/linkedin/validate-connection`

9. No real publish without explicit human confirmation
- status: **no (control gap)**
- evidence: simplified `POST /api/socialflow/posts` can trigger live publish when unscheduled

10. UX non-broken baseline
- status: **parcial**
- note: this phase is read-only audit; no production live smoke executed here by design

## Phase 5 - Proposed cutover plan (do not execute in P2-31)

### Stage 1 - P2-32 staff-only production shadow smoke

Entry criteria:

- resolve critical blockers 1-4 from this audit
- production secrets parity complete
- production encrypted-token runtime path validated in code/tests

Expected commands (examples):

- `pnpm socialflow-runtime:build`
- `pnpm typecheck`
- `pnpm build`
- `pnpm test`
- `git diff --check`
- controlled smoke curls against `socialflow.drako.systems` with staff session

Validations:

- login/session boundary
- LinkedIn connect redirect correctness
- dry-run validation endpoint returns safe payload (no token fields)
- no token leakage in API responses/logs

Rollback:

- stop smoke window immediately
- keep production traffic unchanged
- revert feature flag/endpoint exposure if introduced

Blockers:

- any token leak
- missing LinkedIn secret/runtime env
- decrypt path failure

What NOT to touch:

- no DNS cutover changes
- no wildcard global routes
- no workers.dev enablement

### Stage 2 - One real tenant private pilot

Entry criteria:

- Stage 1 pass
- explicit operator approval
- audit-safe observability enabled

Expected commands:

- staff-scoped smoke scripts
- safe D1 verification queries (explicit fields only)

Validations:

- tenant isolation
- profile + campaigns + posts end-to-end
- LinkedIn validation before any publish action

Rollback:

- freeze pilot tenant access
- disable publish paths for pilot if needed

Blockers:

- cross-tenant mismatch
- auth/session instability

What NOT to touch:

- no broad traffic opening
- no global route topology changes

### Stage 3 - Limited production traffic

Entry criteria:

- pilot stable
- no leakage incidents
- rollback drill rehearsed

Expected commands:

- controlled monitoring/tail commands
- regression suite

Validations:

- controlled traffic envelopes
- error budgets and correlation traceability

Rollback:

- immediate traffic freeze
- rollback to previously verified worker version

Blockers:

- error rate spike
- LinkedIn integration instability

What NOT to touch:

- no cross-product runtime coupling changes during rollout

### Stage 4 - Rollback drill (production-safe)

Entry criteria:

- limited traffic stable

Expected commands:

- version rollback rehearsal commands (without irreversible infra mutation)

Validations:

- RTO/RPO targets
- auth/session continuity after rollback

Rollback:

- execute planned rollback path if verification fails

Blockers:

- recovery path not deterministic

What NOT to touch:

- no permanent infra topology changes

### Stage 5 - Final cutover decision

Entry criteria:

- stages 1-4 pass
- blocker list closed

Decision rule:

- if any critical blocker remains open -> no cutover
- only advance with explicit final sign-off

## Rollback strategy (audit recommendation)

1. Application rollback:
- keep known-good production worker version ID available
- execute controlled rollback if runtime errors/security regressions appear

2. Feature rollback:
- disable high-risk publish paths first
- preserve auth/session and read-only product paths

3. Data safety rollback:
- never run destructive D1 operations during incident response
- use safe verification queries only

4. Communication:
- declare incident state + freeze rollout
- maintain correlation-id based incident timeline

## Decision matrix

| Control area | Status | Evidence | Cutover impact |
| --- | --- | --- | --- |
| Canary limited traffic readiness | PASS | P2-30B dry-run + runtime decrypt validated | Ready baseline |
| Production LinkedIn secret parity | FAIL | prod secret list lacks LinkedIn/token encryption names | BLOCKER |
| Production encrypted token runtime support | FAIL | prod publishing path uses plaintext token model | BLOCKER |
| Production safe validation endpoint | FAIL | no `/api/socialflow/linkedin/validate-connection` in prod src routes | BLOCKER |
| Production profile persistence model | PARTIAL/FAIL | profile repository demo-backed | BLOCKER |
| workers.dev disabled | PASS | subdomain status false for canary/prod | OK |
| Global wildcard requirement | PASS | not required for current prod custom-domain model | OK |
| Debug endpoints exposure in prod | PASS | no `runtime/reharden` or runtime debug routes in prod src | OK |

## Final dictamen

- canary-limited-traffic-ready: **si**
- production-cutover-ready: **no**
- blockers:
  1. production secret parity for LinkedIn + token encryption
  2. production decrypt/runtime token handling parity with encrypted storage model
  3. missing production safe authenticated LinkedIn validation endpoint
  4. demo-backed profile repository in production surface
  5. explicit publish confirmation safety gap in simplified post API flow
- recommended next phase: **P2-32 staff-only production shadow smoke**, **only after closing critical blockers above**