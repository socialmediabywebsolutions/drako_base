# P2-24D - SocialFlow Real LinkedIn Consent Staff-Gated Validation

## Scope

Validate the SocialFlow canary LinkedIn OAuth consent path on the isolated gated ingress without production cutover.

Constraints respected:

- no production worker replacement
- no production DNS cutover
- no workers.dev activation
- no global wildcard route
- no gate removal
- no public-open traffic

## Pre-audit state

Worker:

- `saas-socialflows-runtime-canary`

Gated host:

- `socialflow-canary.drako.systems`

Active canary version after rollback restore:

- `ce4e68a2-fb09-4795-a995-9ed4598892bf`

Runtime state:

- `SOCIALFLOW_RUNTIME_STATE=inactive-deployable`
- `SOCIALFLOW_RUNTIME_CONTRACT_VERSION=p2-21`

Secrets present on active version:

- `SOCIALFLOW_AUTHS_SECRET`
- `LINKEDIN_CLIENT_ID`
- `LINKEDIN_CLIENT_SECRET`
- `SOCIALFLOW_CANARY_GATE_TOKEN`

Health/readiness:

- health: `200`
- readiness: `200`
- readiness blockers: `[]`

Cookie namespace:

- `__Host-socialflow_canary_session`
- `socialflow_canary_session`

## Active routes

Canary routes attached to `saas-socialflows-runtime-canary`:

- `socialflow-canary.drako.systems/api/socialflow/ai/generate`
- `socialflow-canary.drako.systems/api/socialflow/auths/logins`
- `socialflow-canary.drako.systems/api/socialflow/auths/logouts`
- `socialflow-canary.drako.systems/api/socialflow/exports/current`
- `socialflow-canary.drako.systems/api/socialflow/linkedin/callback`
- `socialflow-canary.drako.systems/api/socialflow/linkedin/callback*`
- `socialflow-canary.drako.systems/api/socialflow/linkedin/callback/`
- `socialflow-canary.drako.systems/api/socialflow/linkedin/connect`
- `socialflow-canary.drako.systems/api/socialflow/linkedin/connect*`
- `socialflow-canary.drako.systems/api/socialflow/posts`
- `socialflow-canary.drako.systems/api/socialflow/runtime/health`
- `socialflow-canary.drako.systems/api/socialflow/runtime/readiness`
- `socialflow-canary.drako.systems/socialflow`
- `socialflow-canary.drako.systems/socialflow/auth`
- `socialflow-canary.drako.systems/socialflow/settings/account`

P2-24D added:

- `socialflow-canary.drako.systems/api/socialflow/linkedin/connect*`

Reason:

- Cloudflare route matching also affected `connect?saasId=...`; before this route, `connect?saasId=smoke` returned `522`.
- After attach, the same path reached the canary runtime and correctly returned `401 SESSION_REQUIRED` without a SocialFlow session.

## Staff-gated mechanism

The active gate remains:

- required header: `x-socialflow-canary-gate`
- required secret: `SOCIALFLOW_CANARY_GATE_TOKEN`
- host allowlist: `SOCIALFLOW_CANARY_GATED_HOSTS=socialflow-canary.drako.systems`

Normal canary traffic requires the gate header.

LinkedIn callback traffic can omit the header only when:

- path is `GET /api/socialflow/linkedin/callback*`
- OAuth payload contains `code` or `error`
- `state` carries a valid HMAC signature
- signed `state` is within the 15 minute TTL

This is a signed temporary callback access mechanism, not a general public bypass.

## Real consent status

Real human LinkedIn consent was not completed in this phase.

Blocking reasons:

- no staff SocialFlow session credentials were available to the agent
- no authorized LinkedIn human consent step was available to complete inside this turn
- LinkedIn app dashboard callback URL allowlist could not be inspected directly from the available local/Cloudflare tooling

No success was claimed for:

- successful LinkedIn authorization code from human consent
- successful token exchange for a valid LinkedIn code
- successful profile fetch from LinkedIn
- successful persistence of a newly connected LinkedIn account

## Callback URL audit

Runtime-generated callback URL expected by code:

- `https://socialflow-canary.drako.systems/api/socialflow/linkedin/callback`

This is derived from request origin + `SOCIALFLOW_LINKEDIN_CALLBACK_PATH`.

Not directly verified:

- LinkedIn app dashboard registered callback URL list

## Real remote validations executed

### Connect route query compatibility

Before P2-24D connect wildcard:

- `GET /api/socialflow/linkedin/connect?saasId=smoke` with gate header: `522`

After P2-24D connect wildcard:

- `GET /api/socialflow/linkedin/connect?saasId=smoke` with gate header: `401 SESSION_REQUIRED`

Interpretation:

- ingress now reaches the runtime for query-bearing connect requests
- auth still fails closed without a SocialFlow session

### Callback state security

Invalid/unparseable state:

- `GET /api/socialflow/linkedin/callback?code=fake-code&state=fake`
- result: `403 SOCIALFLOW_CANARY_GATE_DENIED`
- reason: `missing_gate_header:state_missing_or_unparseable`

Expired signed state:

- result: `403 SOCIALFLOW_CANARY_GATE_DENIED`
- reason: `missing_gate_header:state_signature_expired`

Valid signed state with placeholder code:

- result: `308`
- redirect error: `LINKEDIN_AUTHORIZATION_CODE_INVALID`

Interpretation:

- signed callback bypass works only for valid state
- token exchange path still executes and fails normally on invalid code

### Gate bypass validation

Non-callback request without gate:

- `GET /api/socialflow/runtime/health`
- result: `403 SOCIALFLOW_CANARY_GATE_DENIED`
- reason: `missing_gate_header:not_callback_request`

### Cookie isolation validation

Production cookie on protected canary endpoint:

- `__Host-socialflow_session=fake`
- result: `401 SESSION_REQUIRED`

Forged canary cookie on protected endpoint:

- `__Host-socialflow_canary_session=fake`
- result: `401 SESSION_REQUIRED`

## Observability captured

Live `wrangler tail` captured:

- `SOCIALFLOW_RUNTIME_EVENT:middleware_canary_gate_denied`
- `SOCIALFLOW_RUNTIME_EVENT:middleware_canary_gate_callback_state_accepted`
- `SOCIALFLOW_RUNTIME_EVENT:linkedin_callback_failed`
- `SOCIALFLOW_RUNTIME_EVENT:middleware_session_required`

Runtime headers observed on health/readiness/callback:

- `x-correlation-id`
- `x-socialflow-runtime-target: saas-socialflows-runtime-canary`
- `x-socialflow-runtime-state: inactive-deployable`
- `x-socialflow-runtime-contract-version: p2-21`

## Rollback drill

Rollback was executed with gated ingress still attached.

Step 1:

- rollback to previous canary version: `3c8b6d13-7fc1-490d-80fa-b684b79a0080`
- command timing: `12788 ms`
- health with previous gate value: `200`
- health with current gate value against previous version: `403`

Step 2:

- rollback restore to approved version: `ce4e68a2-fb09-4795-a995-9ed4598892bf`
- command timing: `9866 ms`
- health with current gate after restore: `200`

Interpretation:

- rollback mechanics remain safe
- secret parity remains operationally important

## Timings

- connect wildcard route attach: `1836 ms`
- rollback to previous version: `12788 ms`
- rollback restore approved version: `9866 ms`

## What failed

The real LinkedIn human consent flow did not complete.

The runtime is technically ready to receive the real consent callback, but P2-24D did not produce:

- real LinkedIn authorization code from human approval
- real successful token exchange
- real profile fetch
- real LinkedIn account persistence

## Blast radius

Current canary ingress remains isolated to:

- host: `socialflow-canary.drako.systems`
- exact smoke/API paths
- callback-only wildcard
- connect-only wildcard

No production host, production worker, production DNS, workers.dev, or global wildcard route was changed.

## Residual risks

- LinkedIn dashboard callback URL allowlist still needs direct verification.
- A real staff SocialFlow account/session must be used for consent.
- A real LinkedIn user must complete the consent step.
- Successful persistence still needs validation with a valid token/profile response.
- Rollback target hygiene must account for gate secret versions.

## Status

- oauth-runtime-validated: **no, not end-to-end**
- ingress-ready-for-real-consent: **yes**
- limited-traffic-ready: **no**
- production-safe: **yes**
- next-correct-phase: **operator-assisted staff LinkedIn consent using the canary host, followed by persistence verification and rollback drill**
