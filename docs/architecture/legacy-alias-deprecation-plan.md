# Legacy Alias Deprecation Plan (P0.8)

## Executive Summary
`/api/owner` and `/api/campobase` remain active as compatibility aliases, but they are no longer canonical control-plane surfaces. The canonical targets are `/api/operator` (operator plane) and `/api/campamento-base` (control-plane namespace). This phase prepares a read-only sunset decision pack (classification, blockers, rollback and approval checklists) without removing any legacy route.

## Why `owner` and `campobase` Are Legacy
- They represent historical naming, not the final control-plane model.
- They increase coupling risk if new logic is added there.
- They blur product vs control-plane boundaries during SaaS separation.

## Canonical Surfaces
- Canonical operator API: `/api/operator/**`
- Canonical campamento-base API: `/api/campamento-base/**`
- Legacy compatibility API only: `/api/owner/**`, `/api/campobase/**`

## Sunset Phases
1. `P0.5-A`: inventory + freeze.
   - Keep existing alias routes as re-export/proxy bridges.
   - Block new canonical logic under `owner/campobase`.
2. `P0.6`: measure and migrate.
   - Measure legacy route traffic for `/api/owner/**` and `/api/campobase/**`.
   - Record only redacted metadata: alias, canonical target, method, environment, correlation id, source category, and sanitized query fields.
   - Never record request body, `Authorization`, `Cookie`, tokens, or secrets.
   - Migrate callers to `operator` or `factory` canonical targets.
3. `P0.7`: report + criteria.
   - Generate legacy usage report in `summary/json/markdown` formats.
   - Evaluate cut readiness with explicit criteria and blockers.
   - Keep `readyForCut=false` by default and `requiresHumanApproval=true`.
4. `P0.8` (current phase): decision pack.
   - Generate sunset decision pack per alias class (`KEEP_COMPAT`, `READY_FOR_OBSERVATION`, `READY_FOR_MIGRATION`, `READY_FOR_CUT_REQUIRES_APPROVAL`, `BLOCKED`).
   - Consolidate canonical targets, blockers, rollback checklist, and human-approval checklist.
   - Keep `readyForCut=false` by default in this phase.
5. `P0.9`: selective cut.
   - Remove only aliases with proven zero/near-zero traffic.
   - Require rollback path, monitoring evidence, observation window, and human approval.

## READY_FOR_CUT Criteria
- `totalHits=0` during approved observation window OR callers fully migrated.
- Canonical target exists.
- Rollback path exists and is documented.
- Monitoring is active.
- Observation window is complete.
- Human approval is recorded.
- No blockers remain.

## NOT_READY_FOR_CUT Criteria
- There are recent hits in the observation window.
- Relevant traffic source remains `unknown`.
- Canonical target is missing.
- Rollback path is missing.
- Monitoring is inactive.
- Observation window is incomplete.
- Human approval is missing.

## What Not to Cut Yet
- Existing owner/campobase routes that still serve compatibility traffic.
- Alias bridges to factory provisioning/status paths.
- Any route without migration evidence and fallback plan.
- Any route that still appears in P0.7 usage report as active.
- Any route classified as `KEEP_COMPAT`, `READY_FOR_OBSERVATION`, or `BLOCKED` in P0.8 decision pack.

## Tests Protecting Compatibility
- `tests/architecture/legacy-alias-boundaries.test.ts`
- `tests/architecture/legacy-compat-sunset.test.ts`
- `tests/architecture/control-plane-separation-audit.test.ts`
- `tests/architecture/saas-boundary-import-guards.test.ts`

## Exit Criteria to Remove Aliases Later
- Alias inventory remains stable for one cycle.
- Operator/factory canonical routes cover 100% expected use cases.
- Legacy usage telemetry has enough data and is below approved threshold.
- P0.7 usage report is generated and reviewed.
- P0.8 decision pack is generated and approved.
- Callers are migrated and validated.
- Rollback drill is prepared and approved.
- Human approval is recorded before any alias cut.
