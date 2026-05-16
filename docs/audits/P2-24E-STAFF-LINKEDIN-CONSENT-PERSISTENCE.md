# P2-24E - SocialFlow Staff LinkedIn Consent and Persistence Verification

## Scope

Prepare and execute the operator-assisted LinkedIn consent validation for the isolated SocialFlow canary runtime.

Constraints respected:

- no production worker replacement
- no production DNS cutover
- no workers.dev activation
- no public-open traffic
- no gate removal
- no fake authorization code
- no mock LinkedIn token exchange

## Pre-audit state

Worker:

- `saas-socialflows-runtime-canary`

Gated host:

- `socialflow-canary.drako.systems`

Active canary version:

- `ce4e68a2-fb09-4795-a995-9ed4598892bf`

Active deployment:

- deployment id: `433743dd-fe6b-4fd6-8732-4a7579590f04`
- allocation: `100%` on the canary worker only

Required secrets present on the active canary version:

- `LINKEDIN_CLIENT_ID`
- `LINKEDIN_CLIENT_SECRET`
- `SOCIALFLOW_AUTHS_SECRET`
- `SOCIALFLOW_CANARY_GATE_TOKEN`

Runtime contract:

- runtime state: `inactive-deployable`
- contract version: `p2-21`
- cookie namespace: `__Host-socialflow_canary_session` / `socialflow_canary_session`
- auth fallback to generic `SESSION_SECRET`: disabled

## Active canary ingress

The canary ingress remains isolated to `socialflow-canary.drako.systems` and the exact/callback-scoped routes established in P2-24B/P2-24C/P2-24D.

OAuth-compatible routes already present:

- `socialflow-canary.drako.systems/api/socialflow/linkedin/connect*`
- `socialflow-canary.drako.systems/api/socialflow/linkedin/callback*`

The callback URL expected by the runtime remains:

- `https://socialflow-canary.drako.systems/api/socialflow/linkedin/callback`

## Staff-gated consent mechanism

The gate remains fail-closed:

- required header: `x-socialflow-canary-gate`
- required secret: `SOCIALFLOW_CANARY_GATE_TOKEN`
- host allowlist: `SOCIALFLOW_CANARY_GATED_HOSTS=socialflow-canary.drako.systems`

Normal canary traffic requires the gate header.

LinkedIn callback traffic may omit the gate header only when:

- path is `GET /api/socialflow/linkedin/callback*`
- OAuth payload contains `code` or `error`
- `state` carries a valid HMAC signature
- signed `state` is within the 15 minute TTL

## Operator flow prepared

The intended human-assisted flow is:

1. Confirm an existing staff SocialFlow account for the canary auth database.
2. Confirm the test `tenantId` and `saasId`.
3. Confirm the LinkedIn app dashboard allows exactly `https://socialflow-canary.drako.systems/api/socialflow/linkedin/callback`.
4. Open the canary host with the gate header applied through an approved internal browser/header tool.
5. Log in through `https://socialflow-canary.drako.systems/socialflow/auth`.
6. Open `https://socialflow-canary.drako.systems/api/socialflow/linkedin/connect?saasId=<test-saas-id>`.
7. Approve LinkedIn consent with a real LinkedIn account.
8. Return through the real LinkedIn callback to the canary host.
9. Capture the final redirect URL, correlation id, and timestamp without exposing secrets or tokens.
10. Verify persistence in `saas_social_accounts` for the expected `tenant_id`, `saas_id`, and provider `LINKEDIN`.

Fallback if browser header injection is not available:

- use a controlled CLI/browser handoff to create the signed connect URL with the gate header and staff session cookie, then open only the LinkedIn authorization URL in the browser.
- this validates callback and persistence, but does not fully prove browser cookie continuity.

## Real execution result

Real human LinkedIn consent was not executed in this phase.

Blocking reason:

- the remote `SOCIALFLOW_AUTHS_DB` binding does not currently contain the auth tables required by the canary runtime.

Remote schema evidence:

- `SOCIALFLOW_AUTHS_DB` tables observed: `_cf_KV`
- missing tables required by runtime code:
  - `socialflow_users`
  - `socialflow_credentials`
  - `socialflow_sessions`

Route evidence:

- `POST /api/socialflow/auths/logins` with syntactically valid non-existent credentials returned `500`
- response code: `SOCIALFLOW_RUNTIME_LOGIN_FAILED`
- runtime headers remained present:
  - `x-correlation-id`
  - `x-socialflow-runtime-target: saas-socialflows-runtime-canary`
  - `x-socialflow-runtime-state: inactive-deployable`
  - `x-socialflow-runtime-contract-version: p2-21`

Interpretation:

- the runtime can receive the login request through the gated canary ingress
- the auth path cannot establish a real staff session until the auth schema/data exists in the bound canary auth database
- proceeding to LinkedIn consent without a real staff session would be fake validation

## Persistence target audit

The LinkedIn persistence path is real and tenant-scoped in code:

- table: `saas_social_accounts`
- filter keys: `tenant_id`, `saas_id`, provider `LINKEDIN`
- status on successful real persistence: `CONNECTED_REAL`
- token validation occurs before persistence through LinkedIn access verification

Remote pre-consent persistence baseline:

- `saas_social_accounts` row count: `0`
- no LinkedIn connection was persisted by this phase

## What was not validated

No success is claimed for:

- real staff login
- real LinkedIn authorization code from human consent
- successful LinkedIn token exchange
- successful LinkedIn profile fetch
- `CONNECTED_REAL` account persistence
- browser cookie continuity through a real consent callback
- post-success rollback behavior with a newly persisted LinkedIn connection

## Validation executed

Local validation:

- `pnpm socialflow-runtime:build`: passed
- `pnpm typecheck`: passed
- `pnpm build`: passed
- `pnpm test`: passed
- `git diff --check`: passed

Remote preflight validation:

- active canary deployment status was read successfully
- required canary secrets were listed on the active version
- SocialFlow auth schema was checked read-only
- SocialFlow social account baseline was checked read-only
- gated login route was probed with non-existent credentials to verify the real auth-path blocker

## Rollback status

No post-success rollback drill was executed because no successful OAuth consent or persistence occurred.

Previously validated rollback remains applicable operationally:

- rollback to previous canary version works
- rollback restore to approved version works
- ingress remains isolated to the canary host

P2-24E still requires a post-success rollback drill after real persistence.

## Risks remaining

- canary auth database schema/data is not ready for staff login.
- LinkedIn app callback URL allowlist still needs direct dashboard verification.
- real LinkedIn token exchange and profile fetch remain unproven.
- persistence of a real LinkedIn account remains unproven.
- cookie continuity remains unproven for a browser-based staff consent flow.
- rollback target hygiene still matters because gate secret parity differs across historical versions.

## Honest status

- human LinkedIn consent completed: **no**
- OAuth end-to-end validated: **no**
- persistence validated: **no**
- ingress ready for operator-assisted consent after auth DB fix: **yes**
- limited traffic ready: **no**
- production cutover ready: **no**

## Next correct phase

Provision or migrate the required canary auth schema and a controlled staff test account, then rerun P2-24E with a human operator completing LinkedIn consent and a post-success rollback drill.
