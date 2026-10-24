# SOCIAL_AUTOMATION_HISTORY_CANONICALIZATION_READINESS_AUDIT

**Date:** 2026-06-07  
**Block:** `audit social automation history canonicalization readiness`  
**Scope:** inspeccion y documentacion (sin cambios productivos)

## 1) Edge inspection

Files inspected:
- `src/lib/operator/social-automation-history.ts`
- `src/lib/campobase/social-automation-history.ts`
- `tests/lib/campobase-social-automation-history.test.ts`
- `tests/components/campobase-social-page.test.tsx`
- `tests/architecture/campobase-namespace-freeze.test.ts`

### 1.1 Current edge in `src/lib/operator/social-automation-history.ts`

Current content:

```ts
export * from "@/lib/campobase/social-automation-history";
```

So the operator module is a bridge to legacy campobase.

### 1.2 What it currently exports from legacy

By re-exporting `@/lib/campobase/social-automation-history`, it exposes:
- types:
  - `CampoBaseSocialAutomationRunStatus`
  - `CampoBaseSocialAutomationRun`
  - `RecordCampoBaseSocialAutomationRunInput`
- functions:
  - `recordCampoBaseSocialAutomationRun`
  - `listCampoBaseSocialAutomationRuns`
  - `listCampoBaseSocialAutomationRunsForSaas`

### 1.3 Is there a canonical equivalent today?

**Short answer: no 1:1 equivalent for full legacy surface.**

What exists today in canonical namespace:
- `src/lib/campamento-base/socialflow-control-plane-service.ts` exports:
  - `CampoBaseSocialAutomationRun` (different shape, includes `automationKey`)
  - `listCampoBaseSocialAutomationRuns`
  - `listCampoBaseSocialAutomationRunsForSaas`
- It does **not** export `recordCampoBaseSocialAutomationRun`.

Conclusion:
- There is a **partial canonical read-side equivalent** (list functions + run type),
- but there is **no full write/read parity** with legacy history module.

### 1.4 What kind of logic is inside legacy module?

`src/lib/campobase/social-automation-history.ts` contains:
- D1 persistence logic (`getDb`, `CREATE TABLE`, indexes, insert/select)
- table-level storage in `campobase_social_automation_runs`
- mapping from DB rows to run DTOs

It does **not** contain:
- UI logic
- route/controller logic
- direct Clinic/TaskOps/Mentoria logic

Domain interpretation:
- historical storage for social automation runs,
- currently campobase-named and legacy-located,
- semantically operator/control-plane adjacent and socialflow-oriented.

### 1.5 Recommended ownership and namespace

Recommended ownership: **Campamento Base control-plane history contract**, with operator-facing consumption.

Recommended namespace target:
- canonical implementation in `src/lib/campamento-base/` (not `campobase`),
- optional operator facade in `src/lib/operator/` for UI/runtime imports,
- legacy `src/lib/campobase/social-automation-history.ts` retained temporarily as adapter during migration.

### 1.6 Migration risk

- API parity risk: **medium-high** (legacy has `record*`, canonical read API does not)
- Type compatibility risk: **medium** (`CampoBaseSocialAutomationRun` shape mismatch)
- Runtime risk: **medium** if changing source-of-truth (DB table vs automation-core execution history)
- Test risk: **medium** due contract and fixtures tied to legacy type/import paths

## 2) Consumer inventory and classification

Search terms used:
- `@/lib/operator/social-automation-history`
- `@/lib/campobase/social-automation-history`
- `social-automation-history`

### 2.1 Runtime / app consumers

1. `src/app/operator/social/page.tsx`
- Uses: `type CampoBaseSocialAutomationRun` from `@/lib/operator/social-automation-history`
- Nature: type-only import for response/history typing in UI page
- Risk: medium (shape drift can affect typing and table rendering assumptions)
- Migration readiness: can migrate after contract is stabilized

2. `src/lib/operator/social-automation-history.ts`
- Uses: re-export bridge to legacy `@/lib/campobase/social-automation-history`
- Nature: runtime edge under freeze allowlist
- Risk: medium
- Migration readiness: candidate for canonicalization block after contract decision

### 2.2 Test consumers

1. `tests/components/campobase-social-page.test.tsx`
- Uses: `type CampoBaseSocialAutomationRun` from `@/lib/campobase/social-automation-history`
- Risk: low-medium (fixture/type import updates needed)
- Migration readiness: can migrate with app/type contract update

2. `tests/lib/campobase-social-automation-history.test.ts`
- Uses: direct legacy module functions and status type
- Risk: medium (tests validate legacy persistence behavior explicitly)
- Migration readiness: should wait until migration strategy defines adapter vs replacement

3. `tests/architecture/campobase-namespace-freeze.test.ts`
- Uses: allowlist edge strings for:
  - `src/lib/operator/social-automation-history.ts::@/lib/campobase/social-automation-history`
  - test imports to legacy history module
- Risk: low (guardrail adjustment only after migration)
- Migration readiness: update only in same migration block that removes edge

### 2.3 Components

- No component directly imports `@/lib/operator/social-automation-history` besides app page layer (`src/app/operator/social/page.tsx`).
- `tests/components/campobase-social-page.test.tsx` uses legacy type path for fixtures.

### 2.4 Scripts

- No script consumer found for operator/campobase social-automation-history import paths.

### 2.5 Docs

Multiple audit docs reference the module as legacy edge/debt (informational only).
- Impact/risk: low
- Migration readiness: docs can be updated after technical migration lands

## 3) Option analysis (A/B/C/D/E)

### Option A - Create canonical module in `src/lib/campamento-base/social-automation-history.ts`
- Risk: medium
- Impact: aligns with canonical namespace policy; centralizes ownership
- Files implicated:
  - new canonical module
  - `src/lib/operator/social-automation-history.ts` (bridge update)
  - possible legacy adapter updates
  - tests touching legacy/canonical imports
  - namespace freeze allowlist
- Tests needed:
  - `pnpm typecheck`
  - `tests/architecture/campobase-namespace-freeze.test.ts`
  - targeted tests for social page + history module contracts
- Rollback: revert canonical module and bridge/import changes

### Option B - Implement directly in `src/lib/operator/social-automation-history.ts` and convert legacy to adapter
- Risk: medium
- Impact: keeps operator-facing contract stable but weakens canonical ownership in `campamento-base`
- Files implicated:
  - `src/lib/operator/social-automation-history.ts`
  - `src/lib/campobase/social-automation-history.ts` (adapter)
  - tests + freeze allowlist
- Tests needed: same as Option A
- Rollback: revert operator implementation + adapter conversion

### Option C - Move logic to `src/lib/socialflow/`
- Risk: medium-high
- Impact: could fit domain if strictly socialflow-specific, but current naming/contracts are operator/campobase-oriented
- Files implicated: socialflow module creation + bridge/consumer/test updates
- Tests needed: socialflow route/control-plane tests + freeze
- Rollback: revert relocation and import rewires

### Option D - Keep legacy frozen for now
- Risk: low immediate / medium strategic
- Impact: no migration risk now, but debt remains in external runtime edge
- Files implicated: none
- Tests needed: none beyond baseline
- Rollback: n/a

### Option E - Define neutral contract first, then move implementation
- Risk: medium-low (best control of compatibility)
- Impact: clarifies API parity before namespace move; reduces accidental behavior drift
- Files implicated:
  - contract definition (new neutral/canonical types and expected functions)
  - later implementation module in canonical namespace
  - operator/legacy adapters
  - tests + freeze allowlist
- Tests needed:
  - `pnpm typecheck`
  - `tests/architecture/campobase-namespace-freeze.test.ts`
  - focused contract tests for history read/write behavior and run shape
- Rollback: revert contract + adapters in one block

## 4) Final recommendation

Recommended sequence: **Option E -> Option A**.

Reasoning:
- There is no full 1:1 canonical equivalent yet.
- Existing canonical read API differs in run shape and lacks `record*` write API.
- Defining a neutral contract first minimizes breakage and allows explicit decision on source-of-truth (legacy table vs automation-core executions).

Readiness decision:
- **Ready for a technical block after this audit:** yes, but only as a controlled contract-first migration block (not a direct blind import swap).

## 5) Audit-only validations executed

Executed only:
- `pnpm typecheck`
- `npx vitest run tests/architecture/campobase-namespace-freeze.test.ts`

No full suite, no formatter, no refactor executed.
