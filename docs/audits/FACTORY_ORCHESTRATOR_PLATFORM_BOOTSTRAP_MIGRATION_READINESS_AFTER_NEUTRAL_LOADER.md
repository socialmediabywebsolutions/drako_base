# FACTORY ORCHESTRATOR / PLATFORM BOOTSTRAP MIGRATION READINESS AFTER NEUTRAL LOADER

## Scope

Audit-only checkpoint after creating neutral loader module:

- `src/lib/campamento-base/platform-bootstrap-loader.ts`
- `tests/lib/platform-bootstrap-loader.test.ts`

No production code, tests, imports, guardrail, or runtime behavior were modified in this audit block.

## Inputs inspected

- `src/lib/campamento-base/platform-bootstrap-loader.ts`
- `tests/lib/platform-bootstrap-loader.test.ts`
- `docs/contracts/campamento-base-platform-bootstrap-loader-contract-v1.md`
- `tests/lib/platform-bootstrap-loader-contract.test.ts`
- `tests/lib/factory-orchestrator.test.ts`
- `tests/lib/campobase-platform-bootstrap.test.ts`
- `src/lib/campobase/platform-bootstrap.ts`
- `tests/architecture/campobase-namespace-freeze.test.ts`

---

## Task 1 — Current coverage comparison

### 1) What neutral loader covers now

`src/lib/campamento-base/platform-bootstrap-loader.ts` currently provides:

- deterministic list/resolve/run/validate API;
- canonical SocialFlow definition only;
- no imports from `@/lib/campobase`;
- explicit result statuses: `READY`, `SKIPPED`, `FAILED`;
- explicit skip policy for Clinic/TaskOps in this first pass.

Important limitation: current `runPlatformBootstrap(saasId)` does not execute real platform `connect` runtime bootstraps and does not receive `tenantId`.

### 2) What `platform-bootstrap-loader.test.ts` covers now

`tests/lib/platform-bootstrap-loader.test.ts` validates:

- SocialFlow-only registry shape;
- resolve behavior (exact + matched `saasId`);
- `READY` / `SKIPPED` / `FAILED` statuses;
- deterministic registry validation output;
- absence of `@/lib/campobase/*` import in neutral loader file.

It does not validate runtime side-effects equivalent to legacy shared loader execution.

### 3) What `factory-orchestrator.test.ts` still covers

`tests/lib/factory-orchestrator.test.ts` still uniquely covers runtime behavior through legacy shared loader import:

- imports `loadPlatformForSaas` from `@/lib/campobase/platform-bootstrap`;
- creates runtime SaaS instance and then bootstraps it through shared loader path;
- asserts runtime side-effects happen (`registerAutomation`, integration availability/connect);
- validates orchestration handler execution output.

This runtime coverage is not yet equivalent in the neutral loader tests.

### 4) What `campobase-platform-bootstrap.test.ts` still covers

`tests/lib/campobase-platform-bootstrap.test.ts` still uniquely covers legacy loader contract/policy:

- canonical SocialFlow dynamic import in legacy loader source;
- legacy Clinic/TaskOps dynamic imports are still present and routed;
- `loadPlatformForSaas` runtime routing for SocialFlow, Clinic, TaskOps;
- explicit helper entrypoints remain available:
  - `registerSocialFlowPlatform`
  - `registerClinicPlatform`
  - `registerTaskOpsPlatform`

This mixed policy + runtime legacy coverage is not yet fully equivalent in neutral loader coverage.

### 5) Coverage overlap vs unique legacy coverage

Overlap / near-equivalence:

- both neutral and legacy-adjacent tests now cover deterministic loader resolution status for canonical SocialFlow availability at a high level.

Still legacy-only (no equivalent neutral runtime parity yet):

- runtime bootstrap side-effects from shared loader path used by Factory orchestrator;
- Clinic/TaskOps routing behavior through shared loader;
- explicit per-platform helper entrypoints in legacy loader.

Conclusion of Task 1:

- duplication is partial only;
- functional parity is not complete;
- both legacy tests still protect behaviors that neutral tests do not yet replace.

---

## Task 2 — Risk classification

### Can `factory-orchestrator.test.ts` migrate now?

- Decision: **NO** (not safely, as full replacement).
- Reason: neutral loader currently does not execute runtime bootstrap `connect` side-effects used by this test path.
- Risk if migrated now: **HIGH**.
- Functional coverage loss risk: **YES** (automation/integration bootstrap side-effects).
- Additional test needed first: **YES** (neutral runtime parity test that proves equivalent side-effects path without legacy import).

### Can `campobase-platform-bootstrap.test.ts` migrate now?

- Decision: **NO** (not safely, as full replacement).
- Reason: test currently asserts legacy-specific Clinic/TaskOps routing + explicit helper entrypoints still exposed by legacy module.
- Risk if migrated now: **MEDIUM-HIGH**.
- Functional coverage loss risk: **YES** for legacy routing/entrypoint parity unless split into additional dedicated tests.
- Additional test needed first: **YES** (neutral parity tests + explicit static legacy adapter-policy assertions if/while legacy remains).

### Guardrail reduction readiness

- Can guardrail drop `8 -> 7` now? **NO** (not recommended yet).
- Can guardrail drop `8 -> 6` now? **NO**.

---

## Task 3 — Options analysis

## Option A
Migrate now `tests/lib/factory-orchestrator.test.ts` to neutral loader and drop guardrail `8 -> 7`.

- Risk: **HIGH**
- Impact: potential loss of runtime side-effect verification.
- Future files to touch:
  - `tests/lib/factory-orchestrator.test.ts`
  - `tests/architecture/campobase-namespace-freeze.test.ts`
  - possibly `src/lib/campamento-base/platform-bootstrap-loader.ts` (if parity gaps appear)
- Tests needed:
  - factory orchestrator test
  - neutral loader tests
  - namespace freeze
  - targeted runtime side-effect parity coverage
- Rollback: restore legacy import in factory test + restore allowlist edge.
- Recommendation: **Not recommended now**.

## Option B
Convert `tests/lib/factory-orchestrator.test.ts` to static legacy adapter verification and drop guardrail `8 -> 7`.

- Risk: **HIGH**
- Impact: runtime behavior assertions replaced by static checks; likely meaningful coverage loss.
- Future files to touch:
  - `tests/lib/factory-orchestrator.test.ts`
  - `tests/architecture/campobase-namespace-freeze.test.ts`
  - possibly add new dedicated runtime parity test file
- Tests needed:
  - new runtime parity test for side-effects
  - existing factory test replacement checks
  - namespace freeze
- Rollback: recover previous runtime factory test and allowlist edge.
- Recommendation: **Not recommended now**.

## Option C
Migrate now `tests/lib/campobase-platform-bootstrap.test.ts` to neutral/static and drop guardrail `8 -> 7`.

- Risk: **MEDIUM-HIGH**
- Impact: possible loss of legacy loader routing/helper-entrypoint coverage for Clinic/TaskOps.
- Future files to touch:
  - `tests/lib/campobase-platform-bootstrap.test.ts`
  - `tests/lib/platform-bootstrap-loader.test.ts`
  - `tests/architecture/campobase-namespace-freeze.test.ts`
  - possibly add static legacy adapter-policy test file
- Tests needed:
  - neutral loader coverage expansion (Clinic/TaskOps adapter seam readiness)
  - static legacy policy assertions for helper/import contract
  - namespace freeze
- Rollback: restore legacy runtime test coverage and allowlist edge.
- Recommendation: **Not recommended now** as single-step migration.

## Option D
Keep both legacy functional tests now and advance TaskOps-neutral path first.

- Risk: **LOW**
- Impact: preserves current runtime safety; slower guardrail shrink.
- Future files to touch (next block):
  - neutral TaskOps contract/adapter boundary docs/tests first
  - later migration of legacy tests
- Tests needed:
  - dedicated neutral TaskOps boundary tests
  - keep existing legacy tests unchanged meanwhile
- Rollback: minimal (no immediate legacy test migration).
- Recommendation: **Good safety baseline**.

## Option E
Add more neutral loader coverage first, then re-audit migration of legacy tests.

- Risk: **LOW-MEDIUM**
- Impact: reduces migration uncertainty; avoids premature guardrail shrink.
- Future files to touch:
  - `tests/lib/platform-bootstrap-loader.test.ts` (expand parity intent)
  - possibly `src/lib/campamento-base/platform-bootstrap-loader.ts` only if API parity gaps must be closed
  - later: legacy test files and namespace freeze
- Tests needed:
  - neutral parity cases for runtime intent equivalence (without touching legacy runtime yet)
  - guardrail remains unchanged in this step
- Rollback: straightforward (test-only neutral expansion can be reverted independently).
- Recommendation: **Recommended now**.

### Final option recommendation

Recommend **Option E first**, while operationally following **Option D safety posture** (keep both legacy functional tests unchanged until neutral parity is demonstrably sufficient).

---

## Task 4 — Guardrail inspection

From `tests/architecture/campobase-namespace-freeze.test.ts`:

- Current pinned allowlist size: **8**.
- Factory edge present:
  - `tests/lib/factory-orchestrator.test.ts::@/lib/campobase/platform-bootstrap`
- Bootstrap edge present:
  - `tests/lib/campobase-platform-bootstrap.test.ts::@/lib/campobase/platform-bootstrap`

Can any of those be removed now?

- **No**, not safely at this checkpoint.

Size math:

- If only factory edge removed: expected size **7**.
- If only bootstrap edge removed: expected size **7**.
- If both removed: expected size **6**.

Conditions to remove each edge safely:

- Factory edge:
  1. neutral path demonstrates equivalent runtime bootstrap side-effects for factory-created SaaS flow;
  2. no functional regression in automation/integration assertions;
  3. migration test replacement passes and is stable.

- Bootstrap test edge:
  1. neutral loader coverage reaches parity for required routing behavior in scope;
  2. legacy-specific contract expectations are preserved via dedicated static adapter-policy checks (if still required);
  3. Clinic/TaskOps ownership boundaries remain respected (no domain migration into Campamento Base runtime).

---

## Task 5 — Requested validations

Executed exactly the requested commands:

1. `pnpm typecheck` ✅
2. `npx vitest run tests/lib/platform-bootstrap-loader.test.ts` ✅
3. `npx vitest run tests/lib/platform-bootstrap-loader-contract.test.ts` ✅
4. `npx vitest run tests/lib/factory-orchestrator.test.ts` ✅
5. `npx vitest run tests/lib/campobase-platform-bootstrap.test.ts` ✅
6. `npx vitest run tests/architecture/campobase-namespace-freeze.test.ts` ✅

No full suite executed.
No formatter executed.

---

## Task 6 — Final checkpoint summary

- Audit file created: **YES**
- Path: `docs/audits/FACTORY_ORCHESTRATOR_PLATFORM_BOOTSTRAP_MIGRATION_READINESS_AFTER_NEUTRAL_LOADER.md`
- Production code modified: **NO**
- Tests modified: **NO**
- Guardrail modified: **NO**
- `factory-orchestrator` edge reducible now: **NO**
- `campobase-platform-bootstrap` edge reducible now: **NO**
- Recommended option: **Option E first** (with Option D safety posture)
- Current guardrail size: **8**
- Expected size if only factory edge removed: **7**
- Expected size if only bootstrap edge removed: **7**
- Expected size if both removed: **6**
- Validations executed: **YES, all passed**
- Ready for next technical block after this audit: **YES**
- Next recommended block (do not implement here):
  - **expand neutral loader parity coverage first, then re-audit legacy test migration and guardrail shrink**.
