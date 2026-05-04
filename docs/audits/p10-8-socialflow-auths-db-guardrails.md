# P10.8 Future Guardrails For SOCIALFLOW_AUTHS_DB (No Data Migration)

Date: 2026-05-04  
Scope: readiness + tests + policy only  
Change class: fail-closed pre-cutover hardening

## Goal

Add preventive guardrails so a future `SOCIALFLOW_AUTHS_DB` cutover cannot silently reuse shared physical DB identities or collide preview with production.

## Applied Changes

1. `scripts/check-production-readiness.ts`
   - Added new readiness checks:
     - `socialflowAuthsBindingSharedIdentity`
     - `socialflowAuthsBindingNamingViolation`
     - `socialflowAuthsBindingPreviewProdCollision`
   - Guard behavior:
     - If `SOCIALFLOW_AUTHS_DB` is not configured yet, checks stay `N/A` (non-blocking now).
     - If configured, checks fail on:
       - identity reuse with `DRACO_DB`, `SOCIAL_DB`, `MENTORIAS_AUTHS_DB`, or `BASES_AUTHS_DB`
       - dedicated auth naming policy violations
       - preview/prod physical identity collision
2. `tests/production-readiness.test.ts`
   - Added dedicated guardrail scenarios for:
     - PASS when binding is dedicated and preview/prod are isolated
     - FAIL on shared identity reuse
     - FAIL on preview/prod collision
3. Added fixtures under `tests/fixtures/production-audits/socialflow-auths-guards/`
   - `pass.wrangler.toml`
   - `fail-shared-identity.wrangler.toml`
   - `fail-preview-prod-collision.wrangler.toml`
4. `docs/policies/production-readiness-audits.md`
   - Policy coverage now explicitly includes future `SOCIALFLOW_AUTHS_DB` binding guardrails.

## Non-Goals Confirmed

- No remote DB creation
- No data migration
- No production mutations
- No runtime behavior changes for SocialFlow auth routes
- No Mentoría changes

## Result

The readiness gate is now prepared for the physical auth split: once `SOCIALFLOW_AUTHS_DB` appears in config, unsafe coupling patterns are automatically blocked.
