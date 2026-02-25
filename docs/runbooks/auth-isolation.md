# Runbook: Auth Isolation Operations

## Objective
Operate subsidiaries (`drakos`, `mentorias`) with strict logical auth isolation while Campamento Base remains orchestration-only.

## Responsibility Matrix
1. Campamento Base (`base.drako.systems`)
- consumes aggregate telemetry only;
- does not expose final-user registration/login;
- does not reuse subsidiary session cookies/tokens.

2. Drakos (`drako.systems`)
- owns `drakos_*` identity tables and `drakos_session` cookie;
- exposes `/api/drakos/auths/*`.

3. Mentorias (`mentoria.drako.systems`)
- owns `mentorias_*` identity tables and `mentorias_session` cookie;
- exposes `/api/mentorias/auths/*`.

## Feature Flags
1. `ROUTINGS_SUBDOMAINS_ENABLED`
2. `AUTHS_ISOLATIONS_ENABLED`
3. `AUTHS_LEGACY_COMPATS_ENABLED`
4. `TELEMETRIES_HOLDING_ENABLED`

Recommended order:
1. Enable routing.
2. Enable isolated auth.
3. Keep legacy compat temporarily.
4. Disable legacy compat after verification.

## Domains and Cookies Checklist
1. Domains
- `drako.systems`
- `mentoria.drako.systems`
- `base.drako.systems`

2. Cookies
- drakos: `drakos_session` host-only
- mentorias: `mentorias_session` host-only
- no shared `Domain` attribute
- `HttpOnly=true`, `Secure=true`, `SameSite=Lax`, `Path=/`

3. Guard behavior
- reject cross-context token validation (issuer/audience mismatch)
- reject foreign SaaS cookie on current host

## Env and Binding Checklist
1. Required secrets
- `DRAKOS_AUTHS_SECRET`
- `MENTORIAS_AUTHS_SECRET`
- `BASES_AUTHS_SECRET` (if base session is used)
- `INTERNAL_API_SECRET` for telemetry ingestion

2. Shared D1 in Phase 1
- `DRACO_DB` remains shared for logical isolation
- ensure migration `0136_auths_isolations.sql` applied

## Adding a New SaaS Without Breaking Isolation
1. Create auth context and cookie name.
2. Add dedicated identity tables (`<saas>_users`, `<saas>_credentials`, `<saas>_sessions`).
3. Add dedicated endpoints `/api/<saas>/auths/*`.
4. Add host mapping and middleware guard.
5. Add cross-token rejection tests.
6. Emit only aggregate telemetry events to base.

## Verification Procedure
1. Run `pnpm test:auth-isolation`.
2. Run `pnpm build`.
3. Manual smoke:
- register in drakos and verify no mentorias session;
- login in drakos, access mentorias protected endpoint, expect 401/redirect;
- validate cookie names and host-only behavior in browser devtools.

## Incident Response (Session Cross-Acceptance)
1. Disable `AUTHS_LEGACY_COMPATS_ENABLED`.
2. Rotate affected auth secrets (`DRAKOS_AUTHS_SECRET` and `MENTORIAS_AUTHS_SECRET`).
3. Force logout by clearing isolated cookies.
4. Re-run isolation checks and restore rollout.
