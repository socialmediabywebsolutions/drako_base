# P2-24C - SocialFlow OAuth Callback Gated Ingress Validation

## Scope

Resolve and validate real LinkedIn OAuth callback handling on the isolated SocialFlow canary ingress without production cutover.

Constraints respected:

- no production worker replacement
- no DNS cutover
- no workers.dev activation
- no wildcard global route
- no gate removal
- no public-open traffic

## Root cause (real)

Cloudflare route matching evaluates the full URL, including query string.  
Exact callback routes did not match callback URLs with query params (`?code=...&state=...`) and traffic fell through to originless AAAA, returning `522`.

Observed before fix:

- callback with query: `522`

## Options evaluated

1. Keep exact callback routes only: rejected, query callback remains broken.
2. Broad wildcard ingress (`/api/socialflow/*`): rejected, blast radius too wide.
3. Callback-only wildcard route (`/api/socialflow/linkedin/callback*`): selected.
4. Dedicated callback proxy worker: unnecessary complexity for this phase.
5. Internal rewrite only: insufficient without route query match.

## Chosen strategy

Use callback-only wildcard route + preserve fail-closed gate, with a secure callback exception:

- Route compatibility:
  - add `socialflow-canary.drako.systems/api/socialflow/linkedin/callback*`
- Gate preservation:
  - keep mandatory `x-socialflow-canary-gate` for normal canary traffic
  - allow header-less callback only when `state` carries valid short-lived HMAC signature
- State signature scope:
  - tenantId + saasId + redirectTo + iat signed with canary gate secret
- TTL:
  - 15 minutes

## Code changes

- `apps/socialflow-runtime/src/lib/socialflow/linkedin/canary-gate-state.ts` (new)
  - signed state encode/verify utilities
- `apps/socialflow-runtime/src/lib/socialflow/linkedin/client.ts`
  - LinkedIn `state` now signed when canary gate secret is present
- `apps/socialflow-runtime/src/lib/socialflow/linkedin/oauth.ts`
  - connect URL builder path updated for async signed state
- `apps/socialflow-runtime/src/lib/socialflow/linkedin-service.ts`
  - async propagation for connect builder
- `apps/socialflow-runtime/src/app/api/socialflow/linkedin/connect/route.ts`
  - await connect URL build
- `apps/socialflow-runtime/src/middleware.ts`
  - callback-aware gate enforcement with signed-state bypass
  - callback path matcher updated to include callback variants
  - new observability event for accepted callback state

## Remote ingress changes

Attached callback-compatible route:

- `socialflow-canary.drako.systems/api/socialflow/linkedin/callback*`

Existing exact callback routes remain attached:

- `.../callback`
- `.../callback/`

## Real validation evidence

### Callback routing

- After wildcard detach: callback with query returned `522`
- After wildcard reattach: same callback returned `308`

### Gate behavior

- callback with invalid/unparseable state and no gate header: `403 SOCIALFLOW_CANARY_GATE_DENIED`
- callback with valid signed state and no gate header: passed middleware and reached callback handler (`308` redirect)
- non-callback endpoint with invalid gate header: denied (`403`)

### OAuth callback flow

Validated:

- callback receives real query params (`code`, `state`)
- callback state validation executes
- token exchange path executes against LinkedIn token endpoint
- invalid/placeholder code returns normalized runtime error redirect:
  - `code=LINKEDIN_AUTHORIZATION_CODE_INVALID`

State validation proof:

- gated callback with malformed state returns redirect with:
  - `code=LINKEDIN_STATE_INVALID`

### Cookie continuity

- canary logout sets canary namespace cookie:
  - `__Host-socialflow_canary_session`
- callback redirect remains on canary host
- no production cookie namespace observed in callback path

### Observability

Captured live tail events:

- `SOCIALFLOW_RUNTIME_EVENT:middleware_canary_gate_denied`
- `SOCIALFLOW_RUNTIME_EVENT:middleware_canary_gate_callback_state_accepted`
- `SOCIALFLOW_RUNTIME_EVENT:linkedin_callback_failed`

Runtime metadata and correlation headers remained present.

### Rollback/operability

Real rollback drill executed (canary-only worker):

- rollback step 1 command time: `10997 ms`
- rollback step 2 command time: `8457 ms`
- final active canary version restored after drill

## Timings captured

- callback wildcard attach API: `2459 ms`
- callback wildcard detach API: `3851 ms`
- rollback step 1 command: `10997 ms`
- rollback step 2 command: `8457 ms`

## Blast radius

Added wildcard is callback-scoped only:

- host: `socialflow-canary.drako.systems`
- path prefix: `/api/socialflow/linkedin/callback*`
- no wildcard on broader API/runtime surface

Residual surface expansion is limited to callback prefix handling.

## Residual risks

- Full user-consented LinkedIn roundtrip success was not executed in this phase (test used invalid placeholder `code` for token exchange path validation).
- Callback wildcard can match callback prefix variants, mitigated by gate + signed-state checks.
- Rollback to versions with different canary secret values requires secret-parity hygiene.

## Status

- oauth-runtime-validated: **partial but real** (routing + state path + token exchange path validated; no successful LinkedIn consent cycle in this phase)
- traffic-ready: **no**
- production-safe: **yes**
- next-correct-phase: **staff-gated real LinkedIn consent callback test on canary ingress, then repeat rollback drill with final candidate versions**
