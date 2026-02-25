# Auth Isolation Audit (Drakos vs Mentorias)

## Scope
This audit covers logical auth isolation for:
- endpoint surfaces (`register`, `login`, `logout`);
- middleware and guard behavior;
- cookies and sessions;
- shared user schemas and environment bindings;
- host routing (`subpaths` vs `subdomains`).

## File Map (Coupling Points)
1. Shared auth endpoints:
- `src/app/api/auth/register/route.ts`
- `src/app/api/auth/login/route.ts`
- `src/app/api/auth/[...nextauth]/route.ts`

2. Shared auth libraries:
- `src/lib/auth.ts` (next-auth + `auth_users`)
- `src/lib/auth/session.ts` (`drako.session`)
- `src/lib/edge-auth.ts` (`next-auth.session-token`)

3. Public mentoria signup coupled to shared register:
- `src/app/site/mentoria/signup/page.tsx` (previously `/api/auth/register`)

4. Runtime guards and host routing:
- `src/middleware.ts`
- `src/lib/hosts.ts`

5. Shared user schema:
- `migrations/0104_create_auth_v2.sql` (`auth_users`, `auth_credentials`)

6. Shared env and bindings:
- `wrangler.workers.toml` (`DRACO_DB`, `NEXTAUTH_SECRET`, `SESSION_SECRET`)

## Current Auth Flow (Before Isolation)
```mermaid
flowchart TD
  A[Drakos UI] --> B[/api/auth/register]
  C[Mentorias UI] --> B
  B --> D[(auth_users + auth_credentials)]
  A --> E[next-auth cookies]
  C --> E
  E --> F[middleware + API guards]
```

## Root Cause of Shared Registration
1. Mentorias signup was calling the same registration endpoint as drakos.
2. Shared identity tables (`auth_users`, `auth_credentials`) were used as a single source for multiple products.
3. Session cookie/token acceptance was globally scoped on same host and legacy paths.
4. Routing was product-mixed on same app host with subpath-based mentoria pages.

## Risks
1. Data isolation risk: accidental cross-product account reuse.
2. Legal/compliance risk: product boundary ambiguity for consent/access lifecycle.
3. Session fixation/cross-acceptance risk between subsidiaries.
4. Operational risk: Campamento Base receiving user-facing auth traffic.

## Implemented Remediation (Phase 1)
1. New isolated auth APIs:
- `/api/drakos/auths/*`
- `/api/mentorias/auths/*`

2. New isolated tables (same D1, logical split):
- `drakos_users`, `drakos_credentials`, `drakos_sessions`
- `mentorias_users`, `mentorias_credentials`, `mentorias_sessions`

3. Host-only cookies:
- `drakos_session` for drakos
- `mentorias_session` for mentorias

4. Token boundary:
- distinct issuer/audience/context per SaaS;
- cross-token rejection in extractor/guards.

5. Routing:
- strong subdomain routing for `mentoria.drako.systems`;
- legacy subpath compatibility redirect.

6. Campamento Base:
- no final-customer auth endpoints;
- internal aggregate telemetry ingestion only.

## Change Checklist
- [x] Add auth isolation libraries (`src/lib/auths/*`)
- [x] Add isolated auth endpoints for drakos and mentorias
- [x] Add host-only isolated cookies
- [x] Add context-aware token verifier with cross-rejection
- [x] Add migration for isolated identity tables
- [x] Update mentoria signup to isolated endpoint
- [x] Add legacy auth compatibility behind feature flags
- [x] Add internal telemetry endpoint (`/api/bases/telemetries/events`)
- [x] Add automated auth isolation checks (`scripts/test-auth-isolation.ts`)
- [x] Add operational runbook for auth isolation

## Remaining for Phase 2
- Physical D1 separation per SaaS (distinct bindings/databases).
- Removal of legacy auth endpoints and next-auth compat path.
- Dedicated base admin auth boundary if required by control-plane policy.
