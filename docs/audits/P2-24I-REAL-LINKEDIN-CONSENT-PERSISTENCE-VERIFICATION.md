# P2-24I - SocialFlow Real LinkedIn Consent and Persistence Verification

## Scope

Attempt the first real end-to-end LinkedIn OAuth validation on the isolated SocialFlow canary runtime, including staff login, connect initiation, callback readiness, cookie isolation and persistence verification.

Constraints respected:

- no production worker replacement
- no production DNS change
- no workers.dev activation
- no public-open traffic
- no gate removal
- no global wildcard route
- no cutover
- no fake OAuth success claim

## Current canary state

Worker:

- `saas-socialflows-runtime-canary`

Gated host:

- `socialflow-canary.drako.systems`

Runtime state:

- `inactive-deployable`

Readiness:

- `200`
- blockers: `[]`

Health:

- `200`

Cookie namespace:

- `__Host-socialflow_canary_session`
- `socialflow_canary_session`

## Staff login preflight

Staff account used:

- email: `socialflow-canary-staff+p2-24f@drako.systems`
- tenant: `tenant_socialflow_canary_staff`
- saas id for this phase: `p2-24i-saas`

Security notes:

- password was generated transiently
- password was not printed
- gate token was not printed
- signed OAuth state was redacted in the audit output

Real preflight results:

- login: `200`
- emitted cookie: `__Host-socialflow_canary_session`
- health with gate: `200`
- readiness with gate: `200`
- production cookie probe on canary protected endpoint: `401`

## LinkedIn connect preflight

Request:

- `GET /api/socialflow/linkedin/connect?saasId=p2-24i-saas`

Result:

- status: `307`
- destination host: `https://www.linkedin.com/oauth/v2/authorization`
- redirect URI: `https://socialflow-canary.drako.systems/api/socialflow/linkedin/callback`
- state: signed and redacted

Interpretation:

- canary session is accepted
- connect route is operational
- callback URL is canary-scoped
- state generation is active

## Human consent status

Real human LinkedIn consent was not completed in this phase.

Blocking reason:

- no operator-controlled browser session completed LinkedIn approval and returned a valid authorization code during this turn

No success is claimed for:

- human consent
- valid authorization code
- successful token exchange
- LinkedIn profile fetch
- `saas_social_accounts` persistence

## Callback status

No real LinkedIn callback with a valid authorization code occurred.

Previously validated callback mechanics remain in force:

- callback wildcard is limited to `/api/socialflow/linkedin/callback*`
- callback without gate requires valid signed state
- invalid state is rejected
- callback reaches canary runtime instead of `522`

P2-24I did not add a new real consent callback.

## Persistence status

Remote `SOCIAL_DB` query before/after preflight:

- table: `saas_social_accounts`
- tenant: `tenant_socialflow_canary_staff`
- saas id: `p2-24i-saas`
- provider: `LINKEDIN`
- rows: `0`

Interpretation:

- no LinkedIn account row was created because no valid token/profile was obtained
- persistence path remains schema-ready but not end-to-end validated

## Cookie and tenant isolation

Validated:

- canary login emits `__Host-socialflow_canary_session`
- production cookie name `__Host-socialflow_session` is not accepted for canary protected access
- readiness reports canary cookie contract

Not validated in P2-24I:

- cookie continuity across a real LinkedIn browser redirect
- callback session continuity after human consent

## Rollback

Rollback post-success was not executed.

Reason:

- there was no successful OAuth persistence event to roll back after

Previously validated rollback remains available, but P2-24I did not perform a new rollback mutation.

## Observability

Observed through preflight responses:

- runtime headers are active on health/readiness/connect paths
- readiness metadata confirms `saas-socialflows-runtime-canary`, `inactive-deployable`, contract `p2-21`

Not observed in P2-24I:

- `linkedin_callback_success`
- token exchange success
- profile fetch success
- LinkedIn persistence success

## What did not change

- no production worker was touched
- no production DNS was changed
- no public traffic was opened
- no workers.dev was enabled
- no global wildcard route was added
- no gate was removed
- no OAuth success was fabricated
- no LinkedIn account row was seeded manually

## Remaining risks

- LinkedIn app callback allowlist still needs real dashboard/operator verification
- real consent requires a human LinkedIn session
- token exchange success is not proven
- profile fetch success is not proven
- `saas_social_accounts` live persistence is not proven
- rollback after successful OAuth persistence is still pending

## Status

- oauth-end-to-end-validated: **no**
- linkedin-persistence-validated: **no**
- ingress-ready-for-real-consent: **yes**
- limited-traffic-ready: **no**
- production-cutover-ready: **no**
- next correct phase: **operator-assisted browser consent with the canary staff session, then persistence row verification and rollback drill**
