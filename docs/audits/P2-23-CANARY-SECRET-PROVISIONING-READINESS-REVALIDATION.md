# P2-23 - SocialFlow Canary Secret Provisioning and Readiness Revalidation

## Scope

Provision required remote secrets for SocialFlow canary and revalidate remote runtime readiness without activating traffic.

Constraints respected:

- no routes activated
- no custom domains
- no workers_dev activation
- no DNS changes
- no production worker replacement
- no traffic cutover

## Secret contract audit

Audited files:

- `apps/socialflow-runtime/runtime-deploy-contract.json`
- `apps/socialflow-runtime/wrangler.toml`
- `apps/socialflow-runtime/src/lib/runtime-env.ts`
- `apps/socialflow-runtime/src/lib/auth/tokens.ts`
- `apps/socialflow-runtime/src/lib/socialflow/linkedin/core.ts`
- `apps/socialflow-runtime/src/lib/runtime-readiness.ts`

Confirmed:

- required secrets: `SOCIALFLOW_AUTHS_SECRET`, `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET`
- optional secrets: none
- auth fallback to generic `SESSION_SECRET`: disabled
- readiness fails closed when required secrets are missing
- runtime cookie contract remains canary-scoped

## Remote provisioning (controlled)

Provisioning method:

- `wrangler versions secret put` (version-aware secret workflow)
- then `wrangler versions deploy <latest-secret-version>@100%`

Reason:

- direct `wrangler secret put` was blocked because latest uploaded version was not the currently deployed version
- `versions secret put` is required by Cloudflare versioned deployment flow

Provisioned secret keys:

- `SOCIALFLOW_AUTHS_SECRET`
- `LINKEDIN_CLIENT_ID`
- `LINKEDIN_CLIENT_SECRET`

Security notes:

- values were piped via stdin and never printed in logs/reports
- `SOCIALFLOW_AUTHS_SECRET` was generated as a canary-dedicated secret when absent locally

## Remote state after provisioning

Remote deployment status:

- active canary version: `9afd1cde-99b7-4a8f-be45-75a023553020`
- deployment id: `31ab6950-6211-4431-acd2-a3c3de3e15bb`
- strategy: `percentage`
- allocation: `100%` on the canary worker only

Secret visibility on active canary version:

- `LINKEDIN_CLIENT_ID`
- `LINKEDIN_CLIENT_SECRET`
- `SOCIALFLOW_AUTHS_SECRET`

No route activation occurred; worker remains without public route targets.

## Remote health/readiness revalidation

Verification tunnel used (no public route attach):

- `wrangler dev --remote --port 8787`

Endpoints probed:

- `GET /api/socialflow/runtime/health`
- `GET /api/socialflow/runtime/readiness`
- `POST /api/socialflow/auths/logins` with invalid payload to validate auth-path observability

Results:

- health: `200 OK`
- readiness: `200 OK`
- readiness blockers: `[]`

Runtime headers observed:

- `x-correlation-id`
- `x-socialflow-runtime-target: saas-socialflows-runtime-canary`
- `x-socialflow-runtime-state: inactive-deployable`
- `x-socialflow-runtime-contract-version: p2-21`

Auth failure probe:

- login invalid input returns `400`
- runtime observability emitted `SOCIALFLOW_RUNTIME_EVENT:auth_login_invalid_input` with correlation id and runtime metadata

## Fail-closed and operational assessment

Still fail-closed:

- missing required secret would immediately degrade readiness to non-OK
- auth secret fallback remains disabled
- runtime remains route-less, so no accidental public traffic

Operationally improved:

- remote secret blockers for readiness are now resolved
- runtime can be observed remotely with correlation + state headers
- rollback remains viable through versioned deploy/rollback workflow

## Remaining risks

- canary is still intentionally not traffic-ready due to zero-route posture
- attach/detach rehearsal has not been executed yet in this phase
- LinkedIn credential correctness for real OAuth traffic is not proven by readiness alone

## Validation executed

- `pnpm socialflow-runtime:build`
- `pnpm typecheck`
- `pnpm build`
- `pnpm test`
- `git diff --check`

All passed in this phase.

## Honest status

- readiness-ready: **yes**
- traffic-ready: **no**
- canary-activable: **no** (by policy and no-route posture)
- next correct phase: **no-impact attach/detach rehearsal and gated traffic plan design without production cutover**
