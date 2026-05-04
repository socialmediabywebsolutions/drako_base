# SocialFlow Canonical Domain Smoke (Prepared, Manual, Safe)

Date: 2026-05-04  
Scope: preparation only (no deployment, no Cloudflare mutation)

## Purpose

Prepare a reproducible manual smoke for the future canonical host:

- canonical: `socialflow.drako.systems`
- compatibility: `socialflows.drako.systems`

This smoke is safe by default:

- it is `no-op` unless explicitly enabled;
- it performs read-only `GET` checks;
- it does not call publish or destructive endpoints;
- it does not require secrets.

## Script

- `scripts/smoke/socialflow-canonical-domain-smoke.mjs`

## Safety Contract

Default mode:

- command exits `0`;
- prints the planned checks;
- does not run network calls.

Execution mode:

- requires `SOCIALFLOW_CANONICAL_SMOKE_ENABLED=1`;
- requires explicit `SOCIALFLOW_CANONICAL_HOST`;
- fails closed if host is missing.

## Manual Commands

No-op plan (default, safe):

```bash
node scripts/smoke/socialflow-canonical-domain-smoke.mjs
```

Manual execution (future phase only):

```bash
SOCIALFLOW_CANONICAL_SMOKE_ENABLED=1 \
SOCIALFLOW_CANONICAL_HOST=socialflow.drako.systems \
SOCIALFLOW_COMPAT_HOST=socialflows.drako.systems \
node scripts/smoke/socialflow-canonical-domain-smoke.mjs
```

## Checks Covered

1. `GET https://socialflow.drako.systems/`
2. `GET https://socialflow.drako.systems/socialflow`
3. `GET https://socialflow.drako.systems/socialflow/auth`
4. `GET https://socialflow.drako.systems/api/socialflow/profile`
5. `GET https://socialflow.drako.systems/api/social/posts` expects `410`
6. `GET https://socialflow.drako.systems/api/social/linkedin/publish` expects `410`
7. `GET https://socialflow.drako.systems/api/socialflow/linkedin/connect?...` expects OAuth redirect behavior
8. `GET https://socialflow.drako.systems/operator/socialflow` must not be public without auth
9. `GET https://socialflows.drako.systems/socialflow` kept as compatibility evidence

## Notes

- This runbook prepares smoke evidence for readiness phase activation later.
- It does not activate `phaseGates.socialflowCanonicalDomain.active`.
- It does not modify Cloudflare, workers, middleware, routes, OAuth code, or production runtime.
