# P10.6 DB Binding Safety Guardrails (No Data Migration)

Date: 2026-05-04  
Scope: configuration + guardrails only  
Change class: fail-closed hardening

## Goal

Reduce accidental DB exposure risk in legacy/preview paths without changing product runtime behavior or migrating data.

## Applied guardrails

1. `wrangler.workers.toml` (legacy `drako-base-3`) preview `SOCIAL_DB` changed to fail-closed:
   - `database_name = "saas_socialflows_preview_db"`
   - `database_id = "00000000-0000-0000-0000-000000000000"`
   - marker comment: `LEGACY_PREVIEW_SOCIAL_DB_FAIL_CLOSED`
2. `scripts/check-production-readiness.ts` now enforces the fail-closed marker/tokens through `legacyProductionGuardMissing`.
3. `docs/policies/production-readiness-audits.md` updated to include this guard type in policy coverage.

## Ownership status snapshot (from P10.5 evidence)

- SocialFlow:
  - dedicated `SOCIAL_DB` exists in SocialFlow worker runtime.
  - not fully independent yet because some auth/observability/economy paths still rely on shared holdings data surfaces.
- Mentoría:
  - primary runtime still uses `DRACO_DB`.
  - `MENTORIA_DB` exists conceptually but not as the canonical production binding.
  - `MENTORIAS_AUTHS_DB` remains logical separation over shared physical D1 in current setup.
- Campamento Base / Operator:
  - central control-plane ownership remains across shared infra surfaces.

## Explicit non-goals in this intervention

- No remote DB creation.
- No data migration.
- No product runtime logic changes.
- No route changes.
- No worker behavior changes outside legacy/preview safety config.
