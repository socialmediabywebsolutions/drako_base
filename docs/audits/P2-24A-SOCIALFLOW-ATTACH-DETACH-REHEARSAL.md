# P2-24A - SocialFlow Attach/Detach Rehearsal (No Traffic Impact)

## Scope

Operational rehearsal of temporary route attach/detach for the SocialFlow canary runtime, with versioned rollback validation, without production cutover.

Constraints respected:

- no custom domains enabled
- no workers.dev enablement
- no DNS changes
- no production worker replacement
- no persistent route attach
- no traffic cutover

## Real topology audited before rehearsal

- Zone worker routes before rehearsal: `1`
- Existing route before rehearsal: `mentoria.drako.systems -> saas-mentorias-prod`
- Canary routes before rehearsal: `0`
- Canary worker runtime identity used for rehearsal: `saas-socialflows-runtime-canary`
- Production remained on monolith worker path (unchanged)
- Baseline endpoint behavior before attach on `socialflows.drako.systems`:
  - `GET /api/socialflow/runtime/health`: `404`
  - `GET /api/socialflow/runtime/readiness`: `404`
  - `GET /api/socialflow/auths/logins`: `405`

## Attach rehearsal executed (real)

Temporary routes attached to `saas-socialflows-runtime-canary`:

- `socialflows.drako.systems/api/socialflow/runtime/health`
- `socialflows.drako.systems/api/socialflow/runtime/readiness`
- `socialflows.drako.systems/api/socialflow/auths/logins`

Timing:

- attach API timing: `2333 ms`
- attach propagation timing: `2143 ms`

Runtime verification during attach:

- `GET /api/socialflow/runtime/health`: `200`
- `GET /api/socialflow/runtime/readiness`: `200`
- `POST /api/socialflow/auths/logins` with `{}`: `400`
- Runtime headers observed:
  - `x-correlation-id`
  - `x-socialflow-runtime-target: saas-socialflows-runtime-canary`
  - `x-socialflow-runtime-state: inactive-deployable`
  - `x-socialflow-runtime-contract-version: p2-21`
- Health payload metadata includes canary-safe cookie namespace:
  - `__Host-socialflow_canary_session`
  - `socialflow_canary_session`

## Detach rehearsal executed (real)

Temporary routes were removed immediately after probes.

Timing:

- detach API timing: `1934 ms`
- detach propagation timing: `2827 ms`

Post-detach verification:

- zone routes after cleanup: `1`
- canary routes after cleanup: `0`
- remaining route: `mentoria.drako.systems`
- no residual SocialFlow canary route persisted

## Rollback rehearsal executed (real)

Versioned rollback was rehearsed on the canary worker (no routes attached):

1. rollback to previous version `0da379eb-8520-4624-a009-e7494a2fa3ef`
2. rollback back to readiness-approved version `9afd1cde-99b7-4a8f-be45-75a023553020`

Timing:

- rollback to previous: `9442 ms`
- rollback to current: `8964 ms`

Final deployment state after rehearsal:

- active deployment version: `9afd1cde-99b7-4a8f-be45-75a023553020`
- deployment id: `bd068d9a-cde5-4ada-aae5-18a129bdea57`

## Observability during rehearsal

Verified in live attached probes:

- correlation header present on all tested endpoints
- runtime target/state/version headers present
- auth invalid-input path emits controlled `400` with runtime metadata preserved

## Blast radius assessment

Real blast radius was narrow and temporary:

- only 3 exact path routes
- only on `socialflows.drako.systems`
- attach lifecycle lasted only the rehearsal window
- no wildcard route, no domain-level override, no DNS change

Residual risk in rehearsal window:

- any request to those exact 3 paths during the short attach interval was served by canary runtime

## Traffic gating strategy decision

Evaluated options:

- `OPTION_A` hostname separado
- `OPTION_B` tenant allowlist
- `OPTION_C` internal/staff-only routing
- `OPTION_D` percentage rollout

Recommended order:

1. `OPTION_A + OPTION_C` first (separate canary hostname + internal/staff gate)
2. optional `OPTION_B` tenant allowlist layered after hostname isolation
3. `OPTION_D` only after explicit ingress isolation, attach/detach drills, and OAuth/cookie verification on gated traffic

Why:

- strongest production isolation
- lowest blast radius for first real traffic
- clearer rollback semantics than shared-host percentage rollout

## What still must be done before real traffic

- define and provision isolated canary ingress policy (hostname + access gate)
- run attach/detach rehearsal on the final gated ingress shape
- validate OAuth callback behavior on gated hostname
- validate cookie behavior under real gated host/callback paths
- complete limited synthetic flow verification (login, readiness, publish dry path, export path) under gated ingress

## Validation executed

- `pnpm socialflow-runtime:build`
- `pnpm typecheck`
- `pnpm build`
- `pnpm test`
- `git diff --check`

All passed.
