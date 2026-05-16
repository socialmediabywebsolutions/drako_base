# P2-24G - SocialFlow Canary SOCIAL_DB Schema and Persistence Readiness

## Scope

Prepare and validate the remote SocialFlow canary `SOCIAL_DB` persistence surface without production cutover and without declaring LinkedIn OAuth end-to-end success.

Constraints respected:

- no production worker replacement
- no production DNS cutover
- no workers.dev activation
- no public-open traffic
- no broad wildcard routes
- no destructive database migration
- no LinkedIn OAuth success claim

## Runtime and database targets

Canary worker:

- `saas-socialflows-runtime-canary`

Canary host:

- `socialflow-canary.drako.systems`

Active canary version after P2-24G deploy:

- `ee6323ca-ab11-4b08-9e92-53f85e09ece8`

Remote `SOCIAL_DB` binding used by the canary runtime:

- binding: `SOCIAL_DB`
- database name: `saas_socialflows_prod_db`
- database id: `6aa6dbaf-9e35-4715-b154-cda8aee0bd54`

Risk note:

- the bound database is production-named. P2-24G did not touch production routing or workers, but the persistence target itself is not canary-named. This remains an operational risk before broader traffic.

## Schema audit

Audited runtime files:

- `apps/socialflow-runtime/src/lib/socialflow/runtime-repository-core.ts`
- `apps/socialflow-runtime/src/lib/socialflow/profile-repository.ts`
- `apps/socialflow-runtime/src/lib/socialflow/campaigns-repository.ts`
- `apps/socialflow-runtime/src/lib/socialflow/posts-repository.ts`
- `apps/socialflow-runtime/src/lib/socialflow/linkedin/repository.ts`
- `apps/socialflow-runtime/src/lib/socialflow/exports-service.ts`
- `apps/socialflow-runtime/src/lib/db/runtime-db.ts`
- `migrations/0026_social_core.sql`

Runtime-required `SOCIAL_DB` tables:

- `saas_social_accounts`
- `saas_social_channels`
- `saas_social_campaigns`
- `saas_social_posts`
- `socialflow_runtime_channel_profiles`
- `socialflow_runtime_channel_competitors`
- `socialflow_runtime_channel_assets`

Runtime-required compatibility column:

- `saas_social_posts.channel_id`

Runtime-required indexes:

- `idx_runtime_social_accounts_workspace`
- `idx_runtime_social_channels_workspace`
- `idx_runtime_social_campaigns_workspace`
- `idx_runtime_social_posts_workspace`
- `idx_socialflow_runtime_channel_competitors_workspace`
- `idx_socialflow_runtime_channel_assets_workspace`

Important finding:

- `/api/socialflow/exports/current` does not use `SOCIAL_DB`; it queries `DRACO_DB` through `exports-service.ts`. Its current failure is not a `SOCIAL_DB` blocker.

## Migrations applied

Applied remotely to `SOCIAL_DB`:

- `migrations/0026_social_core.sql`
- one-time compatibility patch: `ALTER TABLE saas_social_posts ADD COLUMN channel_id TEXT`
- `migrations/0184_socialflow_runtime_social_db.sql`

New migration created:

- `migrations/0184_socialflow_runtime_social_db.sql`

Migration behavior:

- creates missing runtime-local SocialFlow tables
- creates runtime workspace indexes
- does not delete data
- does not reset the database
- does not alter production routes or worker traffic

Rollback plan:

- no destructive rollback was executed
- rollback would be documentary/manual because tables are additive and may contain canary validation data
- do not drop tables automatically while OAuth/persistence validation data may be needed for audit

## Verified remote tables

Remote `SOCIAL_DB` tables after migration:

- `_cf_KV`
- `saas_social_accounts`
- `saas_social_campaigns`
- `saas_social_channels`
- `saas_social_metrics`
- `saas_social_posts`
- `socialflow_runtime_channel_assets`
- `socialflow_runtime_channel_competitors`
- `socialflow_runtime_channel_profiles`

Verified compatibility:

- `saas_social_posts.channel_id` exists

## Runtime hardening added

`resolveRuntimeSocialSaasSeed()` was hardened to make `DRACO_DB.saas` lookup best-effort.

Reason:

- profile persistence is `SOCIAL_DB`-owned
- missing or incompatible `DRACO_DB.saas` schema should not make profile persistence fail
- profile can safely fall back to the runtime-local default profile seed

Observed before hardening:

- `GET /api/socialflow/profile`: `500 Failed to load profile`
- `POST /api/socialflow/profile`: `500 Failed to update profile`

Observed after hardening and canary deploy:

- `GET /api/socialflow/profile`: `200`
- `POST /api/socialflow/profile`: `200`

## Limited canary ingress additions

P2-24G added only limited, gated canary routes:

- `socialflow-canary.drako.systems/api/socialflow/profile`
- `socialflow-canary.drako.systems/api/socialflow/campaigns`
- `socialflow-canary.drako.systems/api/socialflow/campaigns*`
- `socialflow-canary.drako.systems/api/socialflow/posts*`

Reason:

- exact route matching caused `522` for query-bearing `campaigns?saasId=...` and `posts?saasId=...`
- no broad `api/socialflow/*` wildcard was added
- gate enforcement remains fail-closed

Route attach timings:

- `profile`: `1932 ms`
- `campaigns`: `1844 ms`
- `campaigns*`: `1871 ms`
- `posts*`: `2123 ms`

## Persistence validation

Staff session used:

- email: `socialflow-canary-staff+p2-24f@drako.systems`
- tenant: `tenant_socialflow_canary_staff`
- test saas id: `p2-24g-saas`

Secrets and generated password values were not printed or committed.

Validated through real gated canary requests:

- login: `200`
- health with no gate header: `403 SOCIALFLOW_CANARY_GATE_DENIED`
- health with gate header: `200`
- readiness with gate header: `200`
- profile read: `200`
- profile update: `200`
- campaign create/update: `200`
- campaign list with query string: `200`
- post create/update: `200`
- post list with query string: `200`
- LinkedIn connect init with session: `307` to LinkedIn authorization URL
- logout: `200`

Remote `SOCIAL_DB` counts after validation:

- `saas_social_accounts`: `0`
- `saas_social_channels`: `2`
- `saas_social_campaigns`: `1`
- `saas_social_posts`: `2`
- `socialflow_runtime_channel_profiles`: `1`

Tenant-scoped rows observed:

- campaigns: `tenant_socialflow_canary_staff / p2-24g-saas`
- posts: `tenant_socialflow_canary_staff / p2-24g-saas`
- profiles: `tenant_socialflow_canary_staff / socialflow`

Pre-existing data observed:

- `saas_social_posts` contains one `demo-tenant / socialflow` row

Interpretation:

- runtime responses for the staff session returned only staff-tenant data
- the pre-existing `demo-tenant` row is a residual database hygiene risk, not evidence of a runtime cross-tenant read in this validation

## Exports validation

Result:

- `GET /api/socialflow/exports/current`: `503`
- error: `SOCIALFLOW_RUNTIME_DB_UNAVAILABLE`
- reason: `migrations-missing`

Interpretation:

- exports are not validated in P2-24G
- blocker is `DRACO_DB` export schema readiness, not `SOCIAL_DB`

## LinkedIn persistence path

Validated:

- `GET /api/socialflow/linkedin/connect?saasId=p2-24g-saas` reaches runtime
- staff session is accepted
- redirect URI is canary-scoped
- generated authorization URL uses `https://socialflow-canary.drako.systems/api/socialflow/linkedin/callback`
- signed state includes the staff tenant and `p2-24g-saas`

Not validated:

- real LinkedIn consent
- real authorization code
- successful token exchange
- profile fetch from LinkedIn
- `saas_social_accounts` persistence

Interpretation:

- `SOCIAL_DB` schema is ready for LinkedIn account persistence
- OAuth persistence remains blocked until a real consent/token exchange is performed

## Auth and DB integration

Validated:

- `SOCIALFLOW_AUTHS_DB` staff login still works after P2-24G
- canary session resolves to `tenant_socialflow_canary_staff`
- protected profile/campaign/post endpoints can write to `SOCIAL_DB`
- logout clears the canary session

Tenant header spoof probe:

- request sent with staff cookie and `x-tenant-id: tenant_other`
- runtime still returned staff-tenant profile data

Interpretation:

- middleware/session propagation canonicalized the request back to the authenticated staff tenant
- no cross-tenant data was returned in this probe

## Observability

Live `wrangler tail` captured:

- `SOCIALFLOW_RUNTIME_EVENT:middleware_canary_gate_denied`
- `SOCIALFLOW_RUNTIME_EVENT:auth_login_success`
- `SOCIALFLOW_RUNTIME_EVENT:session_resolved`
- `SOCIALFLOW_RUNTIME_EVENT:db_unavailable`

Observed statuses during tail window:

- ungated health: `403`
- gated health: `200`
- gated readiness: `200`
- login: `200`
- profile: `200`
- exports: `503`

Observability gap:

- dedicated profile/campaign/post persistence-success events are not yet emitted
- persistence was verified through HTTP responses plus remote D1 row state

## What did not change

- no production worker was replaced
- no production DNS cutover happened
- no workers.dev activation happened
- no public-open traffic was enabled
- no broad wildcard route was added
- no LinkedIn OAuth success was claimed
- no destructive database migration was executed
- active monolith production path was not modified

## Remaining risks

- `SOCIAL_DB` binding is production-named and contains pre-existing non-staff data
- exports remain blocked by `DRACO_DB` schema readiness
- LinkedIn persistence cannot be declared complete without real consent and a valid token exchange
- dedicated persistence-success runtime events are still missing
- route surface increased for profile/campaigns/posts, although only on gated canary host and with narrow path patterns

## Status

- `SOCIAL_DB` ready: **yes for profile/campaigns/posts and LinkedIn account table readiness**
- exports ready: **no**
- LinkedIn persistence unlocked: **schema-ready, but not end-to-end validated**
- OAuth end-to-end validated: **no**
- next correct phase: **resolve exports/DRACO_DB readiness or proceed to operator-assisted LinkedIn consent only after accepting that exports remains a separate blocker**
