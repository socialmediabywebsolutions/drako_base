# Factory Orchestrator and Platform Bootstrap Legacy Edge Readiness Audit

## Scope

Audit-only checkpoint after freeze shrink to `8`.

Objective:

- assess readiness of:
  - `tests/lib/factory-orchestrator.test.ts::@/lib/campobase/platform-bootstrap`
  - `tests/lib/campobase-platform-bootstrap.test.ts::@/lib/campobase/platform-bootstrap`
- decide whether each edge can move to static verification now or must stay functional;
- keep canonical boundary intact:
  - Campamento Base = canonical control-plane;
  - Campobase = frozen legacy compatibility;
  - no runtime relocation without neutral contract.

Non-goals:

- no product/runtime changes;
- no test rewrites;
- no guardrail edits;
- no import changes.

---

## Task 1 - Current State

### Guardrail snapshot

Source: `tests/architecture/campobase-namespace-freeze.test.ts`

- pinned size: `8`
- relevant edges present:
  - `tests/lib/factory-orchestrator.test.ts::@/lib/campobase/platform-bootstrap`
  - `tests/lib/campobase-platform-bootstrap.test.ts::@/lib/campobase/platform-bootstrap`

### Relevant current allowlist (`8`)

1. `src/lib/campobase/clinic-platform.ts::@/lib/campobase/clinic-platform-service`
2. `src/lib/campobase/platform-bootstrap.ts::@/lib/campobase/clinic-platform`
3. `src/lib/campobase/platform-bootstrap.ts::@/lib/campobase/taskops-platform`
4. `src/lib/campobase/taskops-platform.ts::@/lib/campobase/taskops-platform-service`
5. `tests/lib/campobase-platform-bootstrap.test.ts::@/lib/campobase/platform-bootstrap`
6. `tests/lib/campobase-taskops-platform-service.test.ts::@/lib/campobase/taskops-platform-service`
7. `tests/lib/cross-saas-taskops-flow.test.ts::@/lib/campobase/taskops-platform`
8. `tests/lib/factory-orchestrator.test.ts::@/lib/campobase/platform-bootstrap`

### What each target test imports from `@/lib/campobase`

#### `tests/lib/factory-orchestrator.test.ts`

- imports `@/lib/campobase/platform-bootstrap` (runtime dynamic import in test body)
- also imports `@/lib/factory/orchestrator` and `@/lib/saas-contract`
- uses runtime mocks for automation/integration/repositories/factory registry

Behavior covered:

- dynamic SaaS runtime creation via `createSaasInstance`
- shared loader invocation via `loadPlatformForSaas`
- bootstrap effects (automation registration + WhatsApp integration connection)
- runtime automation handler execution and result shape

Coverage nature:

- **functional/runtime behavior**, not only static shape.

#### `tests/lib/campobase-platform-bootstrap.test.ts`

- imports `@/lib/campobase/platform-bootstrap`
- mocks `@/lib/campamento-base/socialflow-platform` (canonical)
- mocks legacy adapters:
  - `@/lib/campobase/clinic-platform`
  - `@/lib/campobase/taskops-platform`
- additionally reads `src/lib/campobase/platform-bootstrap.ts` as source text

Behavior covered:

- structural import policy assertion:
  - SocialFlow loaded from canonical namespace
  - exactly two dynamic legacy imports remain (Clinic/TaskOps)
- runtime loader behavior:
  - `loadPlatformForSaas` routes to resolved bootstrap connect
  - per-SaaS explicit helpers remain callable

Coverage nature:

- **hybrid**: static source-marker checks + functional runtime behavior of loader contract.

---

## Task 2 - Analysis: `factory-orchestrator.test.ts`

Question: can this test be static today without losing meaningful guarantees?

### What this edge currently protects

1. Shared loader integration path (`createSaasInstance` -> registry -> `loadPlatformForSaas`).
2. Runtime bootstrap execution path for dynamically created SaaS.
3. Contract between factory runtime definitions and loader resolution (`resolveSaasPlatform`).
4. End-to-end side effect chain (automation + integration).

### Does it need real `platform-bootstrap` execution?

- For the second test case, **yes**: it verifies the bridge between runtime-created registry entries and loader execution path (`loadPlatformForSaas`).
- Replacing this with pure static assertions would drop the runtime proof that created bootstraps are actually invoked through the shared loader API.

### Can it become static now?

- **Not safely now** if we want equivalent behavior coverage.
- A static-only rewrite would likely validate source markers/imports but not runtime resolution + connect invocation semantics.

### Preconditions for safe future reduction

- introduce a neutral/canonical loader contract test that validates runtime `resolve/connect` semantics without importing `@/lib/campobase/platform-bootstrap`, or
- split current test: keep functional loader-path assertion in neutral layer, move legacy adapter shape checks to static test.

### Risk if edge is removed now

- medium-high regression risk:
  - could miss loader/runtime coupling regressions;
  - could preserve green static tests while runtime loader path breaks.

---

## Task 3 - Analysis: `campobase-platform-bootstrap.test.ts`

Question: can this test be converted to static today?

### What this edge currently protects

1. Runtime calls into `loadPlatformForSaas` for SocialFlow/Clinic/TaskOps with module mocks.
2. Runtime availability of explicit helpers:
   - `registerSocialFlowPlatform`
   - `registerClinicPlatform`
   - `registerTaskOpsPlatform`
3. Policy-level static checks in source text (canonical SocialFlow import, legacy dynamic imports count = 2).

### Functional necessity today

- It still verifies runtime behavior of legacy loader entrypoints.
- It depends on unresolved legacy adapters for Clinic and TaskOps in `platform-bootstrap`.

### Can it be fully static now?

- **Partially**, but not fully without losing functional coverage of loader entrypoints.
- A split is feasible in future:
  - static adapter test for source policy/markers;
  - neutral/canonical runtime loader contract test for execution semantics.

### Should it remain functional until TaskOps decision?

- **Yes**. Given `platform-bootstrap` still bridges unresolved legacy Clinic + TaskOps adapters, keeping one functional guard is prudent.

### Risk if edge is removed now

- medium-high:
  - reduced confidence over loader routing/connect behavior;
  - especially sensitive while TaskOps runtime path is still legacy.

---

## Task 4 - Option Classification

### Option A

Convert `factory-orchestrator.test.ts` to static verification and shrink `8` -> `7`.

- risk: medium-high
- impact: removes one freeze edge quickly, but drops runtime loader-path verification unless replaced
- future files to touch:
  - `tests/lib/factory-orchestrator.test.ts`
  - `tests/architecture/campobase-namespace-freeze.test.ts`
- tests needed:
  - `npx vitest run tests/lib/factory-orchestrator.test.ts`
  - `npx vitest run tests/lib/campobase-platform-bootstrap.test.ts`
  - `npx vitest run tests/architecture/campobase-namespace-freeze.test.ts`
  - `pnpm typecheck`
- rollback: restore runtime import assertion + restore allowlist edge (size back to `8`)
- audit verdict: **not recommended now**

### Option B

Keep `factory-orchestrator.test.ts` functional; create neutral/canonical factory loader test first.

- risk: low-medium
- impact: preserves runtime confidence while preparing cleaner future reduction
- future files to touch:
  - new/updated neutral loader test (outside legacy namespace)
  - later `tests/lib/factory-orchestrator.test.ts`
  - later freeze test
- tests needed:
  - targeted new neutral loader tests
  - existing factory/bootstrap/freeze tests
  - `pnpm typecheck`
- rollback: minimal (test-only, can revert new neutral test block)
- audit verdict: **recommended path for factory edge**

### Option C

Convert `campobase-platform-bootstrap.test.ts` to static verification and shrink `8` -> `7`.

- risk: medium-high
- impact: preserves static import policy checks but reduces runtime loader entrypoint coverage
- future files to touch:
  - `tests/lib/campobase-platform-bootstrap.test.ts`
  - `tests/architecture/campobase-namespace-freeze.test.ts`
- tests needed:
  - `npx vitest run tests/lib/campobase-platform-bootstrap.test.ts`
  - `npx vitest run tests/lib/factory-orchestrator.test.ts`
  - `npx vitest run tests/architecture/campobase-namespace-freeze.test.ts`
  - `pnpm typecheck`
- rollback: restore functional runtime cases + restore allowlist edge
- audit verdict: **not recommended now**

### Option D

Keep both edges for now; advance TaskOps neutral path first.

- risk: low
- impact: no immediate shrink, highest runtime safety while legacy TaskOps remains unresolved
- future files to touch:
  - TaskOps neutral contract/audit docs and tests first
  - then loader/factory tests
- tests needed:
  - TaskOps focused tests + freeze + typecheck
- rollback: straightforward (mostly documentation/test planning)
- audit verdict: **strongly recommended as immediate decision**

### Option E

Create neutral `platform-bootstrap` audit/contract first, then decide test conversions.

- risk: low
- impact: clarifies ownership and migration sequence; avoids premature test staticization
- future files to touch:
  - docs contract/audit artifacts
  - later test files and freeze
- tests needed:
  - no extra runtime changes initially; keep current targeted suite
- rollback: trivial (doc-only)
- audit verdict: **recommended in combination with Option D**

### Recommended final option set

- immediate: **Option D + Option E**
- defer Option A/C until neutral runtime coverage exists.

---

## Task 5 - Guardrail Decision

Source: `tests/architecture/campobase-namespace-freeze.test.ts`

- size pinned actual: `8`
- factory edge present:
  - `tests/lib/factory-orchestrator.test.ts::@/lib/campobase/platform-bootstrap`
- bootstrap edge present:
  - `tests/lib/campobase-platform-bootstrap.test.ts::@/lib/campobase/platform-bootstrap`

Can any be removed **now**?

- factory edge removable now: **no** (runtime loader-path coverage would be reduced)
- bootstrap edge removable now: **no** (runtime loader entrypoint coverage still needed while TaskOps/Clinic stay legacy)

If one edge were removed in a future block:

- expected pinned size: `7`

If both edges were removed in a future block:

- expected pinned size: `6`

Conditions to remove each edge:

- factory edge condition:
  - neutral/canonical test proves runtime loader resolution + bootstrap connect path for factory-created SaaS, independent from legacy bootstrap import.
- bootstrap edge condition:
  - split coverage exists:
    - static adapter policy assertions retained;
    - neutral runtime loader contract test covers actual execution semantics.

---

## Task 6 - Audit Validations Executed

Executed exactly as requested:

1. `pnpm typecheck` -> pass
2. `npx vitest run tests/lib/factory-orchestrator.test.ts` -> pass (`3/3`)
3. `npx vitest run tests/lib/campobase-platform-bootstrap.test.ts` -> pass (`5/5`)
4. `npx vitest run tests/architecture/campobase-namespace-freeze.test.ts` -> pass (`2/2`)

No full suite, no formatter, no refactor.

---

## Task 7 - Final Audit Decision

- current guardrail size: `8`
- `factory-orchestrator` edge reducible now: **no**
- `campobase-platform-bootstrap` edge reducible now: **no**
- recommended next block (do not implement here):
  - produce/approve neutral runtime loader contract audit and corresponding canonical tests first,
  - then re-audit one-edge shrink (`8` -> `7`) with preserved runtime guarantees.
