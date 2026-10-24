# P2-31C - SocialFlow Profile D1 Persistence (Replace Demo-Backed Repository)

## Scope

Close the open P2-31B blocker for SocialFlow profile/settings intelligence by replacing demo-backed runtime behavior with real D1 persistence in production code path.

Date: **2026-05-18**

This phase did **not** execute cutover:

- no production deploy/cutover
- no production DNS changes
- no workers.dev activation
- no wildcard global route changes

## Root cause (from P2-31B)

`src/lib/socialflow/profile/repository.ts` depended on demo-state (`@/lib/admin/demo-data`) and generated synthetic profile data in runtime.  
That prevented production parity and blocked P2-32.

## Audit summary

Validated dependencies:

- `src/app/api/socialflow/profile/route.ts` consumed only profile repository functions.
- `src/app/socialflow/(workspace)/profile/page.tsx` consumes `/api/socialflow/profile` and expects:
  - `profile`
  - `competitors[]`
  - `assets[]`
- Settings account page does not require demo-state profile store.

## Implemented remediation

### 1) Real D1 repository (no demo fallback)

Replaced demo-backed implementation with D1-backed persistence:

- `src/lib/socialflow/profile/repository.ts`

Now:

- reads/writes profile state from D1 table `socialflow_profiles`
- enforces tenant+saas scoped access paths
- uses explicit column queries (no `SELECT *`)
- returns controlled empty-state when row is missing
- does not auto-seed fake demo profile

### 2) API hardening + compatibility

Updated endpoint:

- `src/app/api/socialflow/profile/route.ts`

Behavior:

- requires SocialFlow session
- supports `saasId` query/body (`default: socialflow`)
- returns `403` on tenant mismatch (`tenantId` query/body mismatch)
- validates profile/competitor payload shape
- supports `PATCH` (delegates to POST flow)
- returns empty-state safely when no profile row exists

### 3) D1 migration (idempotent, not applied remotely in this phase)

New migration:

- `migrations/0185_socialflow_profiles.sql`

Table contract:

- `socialflow_profiles`
  - `id TEXT PRIMARY KEY`
  - `tenant_id TEXT NOT NULL`
  - `saas_id TEXT NOT NULL`
  - `display_name TEXT`
  - `brand_name TEXT`
  - `business_type TEXT`
  - `website_url TEXT`
  - `description TEXT`
  - `tone TEXT`
  - `audience TEXT`
  - `goals_json TEXT`
  - `metadata_json TEXT`
  - `created_at TEXT NOT NULL`
  - `updated_at TEXT NOT NULL`
  - `UNIQUE(tenant_id, saas_id)`
- index:
  - `idx_socialflow_profiles_tenant_saas (tenant_id, saas_id)`

## Tests added/updated

Added:

- `tests/api/socialflow-profile-route.test.ts`
- `tests/lib/socialflow-profile-repository.test.ts`

Coverage includes:

- profile GET without session -> `401`
- profile GET tenant mismatch -> `403`
- profile GET without row -> `200` + safe empty-state
- profile GET with `saasId` passes scoped read
- profile POST/PATCH upsert paths
- repository D1 upsert/read path
- guard: no demo import in production profile repository
- guard: no `SELECT *` in repository

## Validation executed

Executed in `/home/drako/workspace/drako_base`:

- `pnpm socialflow-runtime:build` -> pass
- `pnpm typecheck` -> pass
- `pnpm build` -> pass
- `pnpm test` -> pass
- `git diff --check` -> pass

## What did not change

- no production deploy or runtime mutation
- no DNS changes
- no workers.dev changes
- no wildcard/global route changes
- no secret/token disclosure
- no destructive D1 operations

## Migration note (important)

`0185_socialflow_profiles.sql` was created only in codebase.  
It was **not** applied to production in this phase.

Remote apply must be a separate approved phase (for example P2-31D).

## Final dictamen

- profile-demo-backed-blocker: **closed**
- real-d1-profile-persistence: **si**
- tenant-isolation: **si**
- no-demo-runtime-fallback: **si**
- profile-api-safe: **si**
- profile-ui-compatible: **si**
- p2-32-staff-only-production-shadow-smoke-allowed: **no** (pending approved remote secret/migration execution phase)
- production-cutover-ready: **no**
