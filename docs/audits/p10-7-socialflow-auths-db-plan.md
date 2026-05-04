# P10.7 SocialFlow Auths DB Separation Plan (No Data Migration)

Date: 2026-05-04  
Scope: planning only  
Change class: future physical DB ownership plan
-
## Goal

Define the safe path to make `SOCIALFLOW_AUTHS_DB` the physical auth database for SocialFlow without creating remote resources, migrating data, touching production, or changing runtime behavior in this intervention.

## Current Evidence

1. `SOCIALFLOW_AUTHS_DB` already exists as an optional binding in `src/lib/cf.ts`.
2. `src/lib/auths/repositories.ts` already checks `SOCIALFLOW_AUTHS_DB` first for the `socialflow` auth context.
3. If `SOCIALFLOW_AUTHS_DB` is missing, the same resolver currently falls back to `DRACO_DB`.
4. `migrations/0142_socialflow_auths.sql` defines the expected SocialFlow auth tables:
   - `socialflow_users`
   - `socialflow_credentials`
   - `socialflow_sessions`
5. No active wrangler binding for `SOCIALFLOW_AUTHS_DB` was found in the reviewed configuration files.
6. SocialFlow auth routes currently enter through:
   - `src/app/api/socialflow/auths/logins/route.ts`
   - `src/app/api/socialflow/auths/registrations/route.ts`
   - `src/app/api/socialflow/auths/logouts/route.ts`

## Target State

SocialFlow auth must have physical DB ownership:

- `SOCIALFLOW_AUTHS_DB` points to a dedicated D1 database for SocialFlow auth.
- SocialFlow auth reads and writes `socialflow_*` auth tables only through `SOCIALFLOW_AUTHS_DB`.
- Production SocialFlow auth does not depend on `DRACO_DB`.
- `DRACO_DB` remains only a historical source during a controlled migration window.
- After cutover, missing `SOCIALFLOW_AUTHS_DB` fails closed instead of falling back to `DRACO_DB`.

## Non-Goals

- No remote DB creation in P10.7.
- No data migration in P10.7.
- No production binding changes in P10.7.
- No runtime code changes in P10.7.
- No route changes in P10.7.
- No Mentoria changes.
- No worker/product runtime changes.

## Proposed Physical Resources

Future resource names should be explicit and must not reuse `DRACO_DB`, `SOCIAL_DB`, or any holding/auth DB ids.

- Production D1 name: `saas_socialflows_auths_prod_db`
- Preview D1 name: `saas_socialflows_auths_preview_db`
- Local D1 name: `saas_socialflows_auths_local_db`

Local development may temporarily collapse bindings only when explicitly documented, but local binding collapse must not be used as evidence of SaaS independence.

## Phased Plan

### Phase 0 - Inventory Freeze

Confirm the complete SocialFlow auth surface before changing bindings:

- Route owners: logins, registrations, logouts.
- Repository owner: `src/lib/auths/repositories.ts`.
- Table owner: `socialflow_users`, `socialflow_credentials`, `socialflow_sessions`.
- Migration owner: `migrations/0142_socialflow_auths.sql`.
- Config owners: root wrangler/OpenNext config and any SocialFlow worker config that can execute SocialFlow auth in the future.

Exit criteria:

- Every runtime that can serve SocialFlow auth is listed.
- No unreviewed SocialFlow auth write path remains.
- The current `DRACO_DB` fallback is explicitly documented as transitional debt.

### Phase 1 - Guardrails Before Resources

Before creating any D1 resource, add static readiness checks in a future guardrail task:

- Fail if production config lacks `SOCIALFLOW_AUTHS_DB` after the ownership phase is declared active.
- Fail if `SOCIALFLOW_AUTHS_DB` uses the same `database_id` or `database_name` as `DRACO_DB`.
- Fail if `SOCIALFLOW_AUTHS_DB` uses the same `database_id` or `database_name` as `SOCIAL_DB`.
- Fail if preview `SOCIALFLOW_AUTHS_DB` points to the production SocialFlow auth DB.
- Fail if a legacy/preview config binds SocialFlow auth to a production DB without an explicit fail-closed marker.

Exit criteria:

- Readiness policy can detect unsafe auth DB binding reuse before deployment.
- Preview cannot accidentally target production SocialFlow auth data.

### Phase 2 - Resource Creation Proposal

Create the remote D1 resources only in a future operational task with explicit approval and Cloudflare evidence:

- Create production `saas_socialflows_auths_prod_db`.
- Create preview `saas_socialflows_auths_preview_db`.
- Record Cloudflare account id, database names, and database ids in an audit document.
- Do not bind the new DBs to production traffic yet.

Exit criteria:

- Dedicated DB ids exist.
- DB ids are not equal to `DRACO_DB`, `SOCIAL_DB`, `MENTORIAS_AUTHS_DB`, or `BASES_AUTHS_DB`.
- No production route has been switched.

### Phase 3 - Schema Bootstrap

Apply only the SocialFlow auth schema to the new DBs:

- Run `migrations/0142_socialflow_auths.sql` against preview first.
- Run the same migration against production only after preview verification.
- Do not copy user, credential, or session rows in this phase.

Exit criteria:

- Required `socialflow_*` tables exist in the dedicated DBs.
- Table schema matches the current repository expectations.
- No product traffic depends on the new DBs yet.

### Phase 4 - Read-Only Verification

Use read-only checks before any migration:

- Count source rows in `DRACO_DB` for `socialflow_*` tables.
- Count target rows in `SOCIALFLOW_AUTHS_DB`; target should be empty before migration unless seeded intentionally.
- Verify indexes exist on credentials and sessions.
- Confirm there are no writes to the target DB during this phase.

Exit criteria:

- Source state is measurable.
- Target state is known.
- No accidental writes occurred.

### Phase 5 - Controlled Data Migration Window

Perform the actual migration only in a later migration task:

- Announce a SocialFlow auth maintenance window.
- Freeze or strictly control registrations and login/session writes during copy.
- Copy `socialflow_users`, `socialflow_credentials`, and `socialflow_sessions`.
- Verify row counts and integrity after copy.
- Keep `DRACO_DB` source tables intact for rollback.

Exit criteria:

- Counts match between source and target.
- Credential rows reference existing users.
- Session rows reference existing users.
- No destructive cleanup has been performed.

### Phase 6 - Runtime Cutover

Switch runtime only after the dedicated DB has verified data:

- Bind `SOCIALFLOW_AUTHS_DB` in the production runtime that serves SocialFlow auth.
- Enable fail-closed behavior for SocialFlow auth when `SOCIALFLOW_AUTHS_DB` is absent.
- Remove or disable the production `socialflow` fallback to `DRACO_DB`.
- Keep rollback instructions ready before deployment.

Exit criteria:

- SocialFlow auth uses the dedicated DB in production.
- Missing `SOCIALFLOW_AUTHS_DB` causes an unavailable/fail-closed response, not a silent fallback.
- Production readiness checks pass.

### Phase 7 - Post-Cutover Hardening

After a stable observation period:

- Add tests proving SocialFlow auth does not fall back to `DRACO_DB` in production mode.
- Add readiness coverage for all environments that can serve SocialFlow auth.
- Mark old `DRACO_DB` `socialflow_*` auth tables as historical/deprecated.
- Do not delete historical source tables until retention and rollback windows are closed.

Exit criteria:

- SocialFlow auth ownership can be audited without runtime inference.
- The old shared physical auth dependency is no longer required.

## Required Guardrails

- Config guardrail: `SOCIALFLOW_AUTHS_DB` must be present in production once the cutover phase starts.
- Identity guardrail: `SOCIALFLOW_AUTHS_DB` must not share physical DB identity with `DRACO_DB`, `SOCIAL_DB`, `MENTORIAS_AUTHS_DB`, or `BASES_AUTHS_DB`.
- Preview guardrail: preview must not point to production DB ids.
- Runtime guardrail: production SocialFlow auth must fail closed if the dedicated binding is missing.
- Migration guardrail: no destructive cleanup until rollback and retention windows are closed.
- Evidence guardrail: every phase must record the exact database names, ids, commands, and verification results.

## Rollback Strategy

Rollback must preserve the pre-cutover source:

- Keep `DRACO_DB` `socialflow_*` auth tables intact during cutover.
- Keep the old auth cookie/session behavior unchanged unless a future task explicitly changes it.
- If cutover fails, restore the previous binding/runtime behavior and stop writes to `SOCIALFLOW_AUTHS_DB`.
- Reconcile any writes made during a failed cutover before retrying.

## Acceptance Criteria For Future Completion

SocialFlow auth can be considered physically separated only when all of the following are true:

- `SOCIALFLOW_AUTHS_DB` is configured in the production runtime serving SocialFlow auth.
- `SOCIALFLOW_AUTHS_DB` points to a dedicated physical D1 database.
- The dedicated DB contains the expected `socialflow_*` auth schema.
- Existing SocialFlow auth data has been migrated and verified.
- Production SocialFlow auth no longer falls back to `DRACO_DB`.
- Readiness guardrails block missing, shared, or preview-to-production auth bindings.
- Audit evidence names the owning DB ids and confirms no shared physical dependency remains.

## Open Questions

- Is the long-term owner of SocialFlow auth the root Next/OpenNext runtime, the SocialFlow worker, or both?
- Should local development use a physically separate local D1 for SocialFlow auth, or keep a documented local-only collapse?
- Should active sessions be migrated, invalidated, or allowed to expire naturally during cutover?
- What maintenance window is acceptable for freezing SocialFlow registrations and session writes?

## Recommended Next Task

P10.8 should be a guardrails-only task:

- Add readiness checks for future `SOCIALFLOW_AUTHS_DB` binding identity.
- Add tests documenting current fallback behavior as transitional and desired future fail-closed behavior as pending.
- Do not create DBs.
- Do not migrate data.
- Do not switch production runtime.
