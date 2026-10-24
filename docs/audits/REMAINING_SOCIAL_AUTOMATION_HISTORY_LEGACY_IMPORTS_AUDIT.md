# Remaining Social Automation History Legacy Imports Audit

Date: 2026-06-07  
Scope: locate and classify remaining imports to `@/lib/campobase/social-automation-history` and propose migration sequencing without code migration.

## 1) Scope and search method

Search target:

- `@/lib/campobase/social-automation-history`

Searched in:

- `src/**/*.ts`
- `src/**/*.tsx`
- `tests/**/*.ts`
- `tests/**/*.tsx`

Queries used:

- exact string match for `@/lib/campobase/social-automation-history`
- import-pattern match for `from "@/lib/campobase/social-automation-history"`
- dynamic import-pattern match for `import("@/lib/campobase/social-automation-history")`

## 2) Remaining consumers inventory

### 2.1 Real import statements (current)

| Path | File type | Imported symbols | Migration target | Temporary legacy? | Risk |
|---|---|---|---|---|---|
| `tests/components/campobase-social-page.test.tsx` | test (component) | `type CampoBaseSocialAutomationRun` | Prefer `@/lib/operator/social-automation-history` (drop-in legacy alias) | No (migratable now) | low |
| `tests/lib/campobase-social-automation-history.test.ts` | test (lib contract) | `listCampoBaseSocialAutomationRuns`, `listCampoBaseSocialAutomationRunsForSaas`, `recordCampoBaseSocialAutomationRun`, `type CampoBaseSocialAutomationRunStatus` | Keep legacy import for adapter contract coverage | Yes (until adapter decommission plan) | low |

### 2.2 Runtime/component/script/docs status

- Runtime imports in `src/**`: **none**.
- Component runtime imports in `src/components/**`: **none**.
- Script imports in `scripts/**`: **none**.
- Docs references exist in audits/contracts, but these are non-runtime and non-import edges.

## 3) Canonical and facade equivalence check

Canonical module:

- `@/lib/campamento-base/social-automation-history`

Operator facade:

- `@/lib/operator/social-automation-history`

Compatibility notes:

- Canonical type `SocialAutomationHistoryRun` is richer and not a 1:1 legacy shape.
- Operator facade exports `CampoBaseSocialAutomationRun` compatibility alias, making it the safer 1:1 destination for tests still expecting legacy shape fields (`campaignId`, `postsCount`, `scheduledCount`, `finishedAt`, `error: string | null`).
- Legacy adapter test should continue targeting `@/lib/campobase/social-automation-history` while adapter compatibility is intentionally maintained.

## 4) Guardrail review (`campobase-namespace-freeze`)

File inspected:

- `tests/architecture/campobase-namespace-freeze.test.ts`

For `@/lib/campobase/social-automation-history`, allowlist currently includes:

1. `src/lib/operator/social-automation-history.ts::@/lib/campobase/social-automation-history`
2. `tests/components/campobase-social-page.test.tsx::@/lib/campobase/social-automation-history`
3. `tests/lib/campobase-social-automation-history.test.ts::@/lib/campobase/social-automation-history`

Observations:

- Edge (1) is stale in allowlist (operator facade is already canonical).
- Edges (2) and (3) are still real imports today.

Can shrink now?

- **Yes, technically possible**, but should be done in a dedicated migration/shrink block to keep intent explicit.
- Recommended shrink sequence:
  1. Migrate edge (2) to operator facade (or canonical if shape adaptation is accepted).
  2. Keep edge (3) while adapter contract testing remains required.
  3. Remove stale edge (1) plus adjust allowlist size pin.

## 5) Options assessment

### Option A — Migrate related tests/components to operator facade

- Risk: low
- Impact: reduces legacy import surface while preserving legacy-compatible type shape.
- Likely files: `tests/components/campobase-social-page.test.tsx` (+ guardrail shrink file).
- Tests to run: freeze test, affected component test, focused social automation history tests.
- Rollback: easy (single import revert).

### Option B — Migrate tests directly to canonical module

- Risk: medium
- Impact: stronger canonical alignment, but legacy-shaped fixtures may need adaptation to canonical run shape.
- Likely files: at least `tests/components/campobase-social-page.test.tsx` (and potentially fixture helpers/assertions).
- Tests to run: same as Option A plus broader typecheck scrutiny.
- Rollback: moderate (import + fixture shape reverts).

### Option C — Keep legacy tests against adapter for compatibility guarantees

- Risk: low
- Impact: preserves explicit regression coverage for legacy adapter contract.
- Likely files: none (no migration).
- Tests to run: keep `tests/lib/campobase-social-automation-history.test.ts` in validation set.
- Rollback: n/a (no change).

### Option D — Shrink only runtime edges, keep legacy tests

- Risk: low
- Impact: best incremental policy fit (remove non-test legacy edges first, keep compatibility tests).
- Likely files: guardrail allowlist + any stale runtime edge references.
- Tests to run: freeze + focused lib tests.
- Rollback: easy (restore allowlist entries).

## 6) Recommendation

Recommended strategy: **D + A (incremental)**

1. Keep `tests/lib/campobase-social-automation-history.test.ts` on legacy import for adapter compatibility coverage (Option C behavior for that file).
2. Migrate `tests/components/campobase-social-page.test.tsx` type import to `@/lib/operator/social-automation-history` (Option A).
3. In the same block, shrink guardrail by removing:
   - stale operator edge (`src/lib/operator/social-automation-history.ts::...`)
   - migrated component-test edge (`tests/components/campobase-social-page.test.tsx::...`) if migration is completed.
4. Keep only the dedicated adapter test edge for this module until adapter retirement is planned.

This yields immediate legacy-edge reduction with minimal risk and preserves adapter safety net coverage.
