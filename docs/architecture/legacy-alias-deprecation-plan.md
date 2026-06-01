# Legacy Alias Deprecation Plan (P0.5-A)

## Executive Summary
`/api/owner` and `/api/campobase` remain active as compatibility aliases, but they are no longer canonical control-plane surfaces. The canonical targets are `/api/operator` (operator plane) and `/api/campamento-base` (control-plane namespace). This phase inventories aliases, freezes growth, and adds guardrails without breaking current traffic.

## Why `owner` and `campobase` Are Legacy
- They represent historical naming, not the final control-plane model.
- They increase coupling risk if new logic is added there.
- They blur product vs control-plane boundaries during SaaS separation.

## Canonical Surfaces
- Canonical operator API: `/api/operator/**`
- Canonical campamento-base API: `/api/campamento-base/**`
- Legacy compatibility API only: `/api/owner/**`, `/api/campobase/**`

## Sunset Phases
1. `P0.5-A` (this phase): inventory + freeze.
   - Keep existing alias routes as re-export/proxy bridges.
   - Block new canonical logic under `owner/campobase`.
2. `P0.6`: measure and migrate.
   - Measure legacy route traffic and caller origin.
   - Migrate callers to `operator` or `factory` canonical targets.
3. `P0.7`: selective cut.
   - Remove only aliases with proven zero/near-zero traffic.
   - Require rollback path and human approval.

## What Not to Cut Yet
- Existing owner/campobase routes that still serve compatibility traffic.
- Alias bridges to factory provisioning/status paths.
- Any route without migration evidence and fallback plan.

## Tests Protecting Compatibility
- `tests/architecture/legacy-alias-boundaries.test.ts`
- `tests/architecture/legacy-compat-sunset.test.ts`
- `tests/architecture/control-plane-separation-audit.test.ts`
- `tests/architecture/saas-boundary-import-guards.test.ts`

## Exit Criteria to Remove Aliases Later
- Alias inventory remains stable for one cycle.
- Operator/factory canonical routes cover 100% expected use cases.
- Legacy usage is measured and below approved threshold.
- Cut list is approved with rollback procedure.
