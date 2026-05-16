# P2-24B - SocialFlow Gated Canary Ingress and Controlled Smoke Traffic

## Scope

Create and validate a real, isolated canary ingress with controlled smoke traffic, without production cutover.

Constraints respected:

- no production cutover
- no monolith replacement
- no wildcard routes
- no workers.dev enablement
- no custom domains
- no production DNS destructive changes

## Ingress and gate implemented

### Active ingress

- dedicated canary hostname: `socialflow-canary.drako.systems`
- DNS record created as proxied originless AAAA (`100::`)
- worker target: `saas-socialflows-runtime-canary`
- ingress routes attached as exact paths only (no wildcard)

Active route patterns:

- `socialflow-canary.drako.systems/api/socialflow/runtime/health`
- `socialflow-canary.drako.systems/api/socialflow/runtime/readiness`
- `socialflow-canary.drako.systems/api/socialflow/auths/logins`
- `socialflow-canary.drako.systems/api/socialflow/auths/logouts`
- `socialflow-canary.drako.systems/api/socialflow/exports/current`
- `socialflow-canary.drako.systems/api/socialflow/ai/generate`
- `socialflow-canary.drako.systems/api/socialflow/posts`
- `socialflow-canary.drako.systems/api/socialflow/linkedin/connect`
- `socialflow-canary.drako.systems/api/socialflow/linkedin/callback`
- `socialflow-canary.drako.systems/api/socialflow/linkedin/callback/`
- `socialflow-canary.drako.systems/socialflow`
- `socialflow-canary.drako.systems/socialflow/auth`
- `socialflow-canary.drako.systems/socialflow/settings/account`

### Active gate

Fail-closed gate is enforced at middleware level for configured canary hostnames:

- required header: `x-socialflow-canary-gate`
- required secret: `SOCIALFLOW_CANARY_GATE_TOKEN`
- host allowlist variable: `SOCIALFLOW_CANARY_GATED_HOSTS=socialflow-canary.drako.systems`
- denied requests return `403 SOCIALFLOW_CANARY_GATE_DENIED`
- missing secret/config returns `503 SOCIALFLOW_CANARY_GATE_MISCONFIGURED`

Gate observability events:

- `SOCIALFLOW_RUNTIME_EVENT:middleware_canary_gate_denied`
- `SOCIALFLOW_RUNTIME_EVENT:middleware_canary_gate_misconfigured`

## Remote deployment and contract state

- deployable canary version active after this phase: `bf10c6ba-7a23-4e85-95d1-8b5dccf5d1d3`
- contract additions:
  - required var: `SOCIALFLOW_CANARY_GATED_HOSTS`
  - required secret: `SOCIALFLOW_CANARY_GATE_TOKEN`

Bindings/vars/secrets on active version include:

- D1: `DRACO_DB`, `SOCIAL_DB`, `SOCIALFLOW_AUTHS_DB`
- required runtime vars include canary gate host var
- required runtime secrets include canary gate token

## Timing evidence

Ingress attach timing:

- route attach API: `7707 ms`
- ingress propagation: `2520 ms`

Hot rollback timing with ingress attached:

- rollback to previous version (without gate secret): command `9452 ms`, propagation `1127 ms`
- rollback back to gate-ready version: command `8706 ms`, propagation `914 ms`

## Controlled smoke traffic (real)

### Denied without gate header

- `GET /api/socialflow/runtime/health` (no gate header) -> `403`
- body: `SOCIALFLOW_CANARY_GATE_DENIED`

### Allowed with gate header

- `GET /api/socialflow/runtime/health` -> `200`
- `GET /api/socialflow/runtime/readiness` -> `200`
- readiness blockers: `[]`
- runtime headers present:
  - `x-correlation-id`
  - `x-socialflow-runtime-target: saas-socialflows-runtime-canary`
  - `x-socialflow-runtime-state: inactive-deployable`
  - `x-socialflow-runtime-contract-version: p2-21`

### Auth/session and protected flow behavior

- `POST /api/socialflow/auths/logins` with invalid payload `{}` -> `400 INVALID_INPUT`
- `GET /api/socialflow/exports/current` without session -> `401 SESSION_REQUIRED`
- `GET /socialflow/settings/account` without session -> `307` redirect to `/socialflow/auth?...`
- `GET /api/socialflow/linkedin/connect` without session -> `401 SESSION_REQUIRED`
- `POST /api/socialflow/ai/generate` without session -> `401 SESSION_REQUIRED`
- `POST /api/socialflow/posts` without session -> `401 SESSION_REQUIRED`

### Cookie isolation checks

- `POST /api/socialflow/auths/logouts` -> `200`
- `Set-Cookie`: `__Host-socialflow_canary_session=...; Secure; HttpOnly; SameSite=lax`
- forged cookie tests on protected endpoint remained denied:
  - `cookie: __Host-socialflow_session=fake...` -> `401`
  - `cookie: __Host-socialflow_canary_session=fake...` -> `401`

## OAuth callback validation result

Validated:

- OAuth init boundary (`/api/socialflow/linkedin/connect`) is protected (`401` without session)
- canary runtime identity headers and gate behavior are correct

Not fully validated yet:

- full callback exchange with query parameters under exact-route-only ingress

Observed blocker:

- callback requests with query string (for example `?code=...&state=...`) returned `522` under the exact-path route approach.
- this is a real ingress limitation for callback traffic in a strict no-wildcard route setup.

## Observability live audit

Live `wrangler tail` captured events during smoke:

- `SOCIALFLOW_RUNTIME_EVENT:middleware_canary_gate_denied` for ungated request
- `SOCIALFLOW_RUNTIME_EVENT:auth_login_invalid_input` for gated invalid login

Both events included runtime metadata (`runtimeTarget`, `activationState`, `contractVersion`) and request correlation context.

## Hot rollback impact under attached ingress

Rollback was operationally safe and immediate, but behavior differs by version:

- rolling back to a version without `SOCIALFLOW_CANARY_GATE_TOKEN` produced fail-closed `503 SOCIALFLOW_CANARY_GATE_MISCONFIGURED`
- rolling forward restored `200` health quickly

Conclusion:

- rollback mechanics are safe
- rollback safety now depends on keeping gate secret parity across candidate rollback versions

## Remaining risks

- OAuth callback real-path validation is still incomplete under no-wildcard ingress policy
- attached ingress currently exposes only exact routes; any unlisted path still falls through and may fail at origin layer
- rollback target hygiene is required (avoid selecting versions lacking gate secret)

## Validation executed

- `pnpm socialflow-runtime:build`
- `pnpm typecheck`
- `pnpm build`
- `pnpm test`
- `git diff --check`

All passed.
