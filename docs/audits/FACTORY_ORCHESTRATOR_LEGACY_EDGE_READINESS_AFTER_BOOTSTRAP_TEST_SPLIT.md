# FACTORY ORCHESTRATOR LEGACY EDGE READINESS AFTER BOOTSTRAP TEST SPLIT

## Scope

Audit-only checkpoint after `tests/lib/campobase-platform-bootstrap.test.ts` was migrated to split neutral + static verification and the freeze guardrail was reduced to `7`.

This block performs **inspection, classification, and documentation only**.

No runtime behavior, production code, test logic, imports, or guardrail policy is changed in this audit.

## Inputs inspected

- `tests/lib/factory-orchestrator.test.ts`
- `src/lib/campobase/platform-bootstrap.ts`
- `src/lib/campamento-base/platform-bootstrap-loader.ts`
- `tests/lib/platform-bootstrap-loader.test.ts`
- `tests/lib/campobase-platform-bootstrap.test.ts`
- `tests/architecture/campobase-namespace-freeze.test.ts`
- `docs/audits/PLATFORM_BOOTSTRAP_LEGACY_TEST_MIGRATION_READINESS_AFTER_NEUTRAL_PARITY.md`
- `docs/contracts/campamento-base-platform-bootstrap-loader-contract-v1.md`

---

## Task 1 — Coverage comparison after bootstrap split

### 1) What `factory-orchestrator.test.ts` covers now

`tests/lib/factory-orchestrator.test.ts` currently verifies three runtime behaviors:

1. **Dynamic SaaS creation and contract resolvability**
   - creates runtime SaaS (`createSaasInstance`)
   - validates registration into `saas-contract` (`resolveSaasPlatform` resolves created SaaS)
   - validates persistence side effect through `registerFactorySaas`

2. **Shared loader runtime bootstrap path**
   - imports and executes `loadPlatformForSaas` from `@/lib/campobase/platform-bootstrap`
   - verifies orchestration side effects after load:
     - `registerAutomation(...)`
     - `ensureWhatsappIntegrationAvailable(...)`
     - `connectIntegration(...)`

3. **Runtime automation execution path**
   - captures runtime handler registration (`registerAutomationHandler`)
   - executes generated handler
   - validates output metrics/summary

### 2) Runtime side effects still uniquely protected there

The second test in this file is still the only direct guard for:

- end-to-end invocation of shared legacy loader path for a runtime-created SaaS id (`runtime_ops_beta`);
- bootstrap-triggered side effects at automation and integration layers;
- integration between factory runtime SaaS creation and loader-driven bootstrap execution.

### 3) What is covered by `platform-bootstrap-loader.test.ts`

`tests/lib/platform-bootstrap-loader.test.ts` provides deterministic neutral coverage for:

- registry listing/resolution;
- status model (`READY`, `SKIPPED`, `FAILED`);
- deterministic validation and invalid-registry detection;
- neutral boundary rule (`no @/lib/campobase import`).

It **does not** cover:

- dynamic factory SaaS registration;
- runtime bootstrapping side effects (`registerAutomation`, `connectIntegration`, provider availability);
- handler execution path from factory-generated automation.

### 4) What is covered by split `campobase-platform-bootstrap.test.ts`

`tests/lib/campobase-platform-bootstrap.test.ts` now covers:

- neutral smoke expectations against `platform-bootstrap-loader`;
- static source-policy guarantees on `src/lib/campobase/platform-bootstrap.ts` (canonical SocialFlow, legacy Clinic/TaskOps signals, registration/export/saas-contract signals).

It **intentionally no longer** covers runtime legacy execution through `loadPlatformForSaas`.

### 5) Coverage that still exists only in `factory-orchestrator.test.ts`

Still unique to `factory-orchestrator.test.ts`:

- runtime-created SaaS -> shared loader `loadPlatformForSaas` execution chain;
- downstream bootstrap side effects on automation/integration services;
- behavior-level confirmation that shared loader can bootstrap non-static runtime SaaS created by factory orchestrator.

### 6) Replaceability by neutral loader or static test

- **Neutral loader replacement now:** **not equivalent yet**.
  - Current neutral loader returns deterministic statuses and does not execute runtime bootstrap side effects for Clinic/TaskOps and does not represent factory runtime dynamic bootstrap parity.
- **Static verification replacement:** **not equivalent**.
  - Static assertions cannot protect runtime side-effect guarantees currently covered by this test.

### 7) Requested focus areas

- Shared loader: currently legacy path still exercised only in `factory-orchestrator.test.ts`.
- Dynamic SaaS creation: covered in factory test; not covered by neutral loader tests.
- Platform resolution: covered at two layers, but runtime bridge from creation to bootstrap still factory-specific.
- SaaS bootstrap and automation/integration effects: uniquely runtime in factory test.
- Clinic/TaskOps/SocialFlow relation: neutral loader marks Clinic/TaskOps as `SKIPPED`; legacy runtime loader still registers canonical SocialFlow + legacy Clinic/TaskOps adapters.
- Real dependency on `src/lib/campobase/platform-bootstrap.ts`: direct and material in factory test (`loadPlatformForSaas`).

---

## Task 2 — Risk classification

- Can `factory-orchestrator.test.ts` migrate now: **NO**.
- Risk converting to loader neutral now: **HIGH**.
- Risk converting to static verification now: **HIGH**.
- Functional coverage loss if migrated now: **YES (relevant runtime behavior would be lost)**.
- Additional test needed before migration: **YES**.
  - Need neutral/runtime-equivalent test path proving factory-created SaaS bootstrap side effects (automation/integration + handler path) without relying on legacy loader import edge.
- Can guardrail drop from `7` to `6` now: **NO**.
- Should it wait for TaskOps neutral closure: **YES, or equivalent neutral runtime bridge for factory side effects**.

---

## Task 3 — Options analysis

### Option A
Migrate now `factory-orchestrator.test.ts` to neutral loader and shrink guardrail `7 -> 6`.

- Risk: **HIGH**
- Impact: likely removes current runtime side-effect guarantees.
- Future files to touch:
  - `tests/lib/factory-orchestrator.test.ts`
  - likely new/adjacent neutral runtime parity tests
  - `tests/architecture/campobase-namespace-freeze.test.ts`
- Tests needed:
  - parity tests for bootstrap side effects and runtime handler flow
- Rollback:
  - restore legacy import edge in factory test + restore allowlist entry
- Recommendation: **Not recommended now**.

### Option B
Convert `factory-orchestrator.test.ts` to static adapter verification and shrink guardrail `7 -> 6`.

- Risk: **HIGH**
- Impact: runtime orchestration guarantees become unprotected.
- Future files to touch:
  - `tests/lib/factory-orchestrator.test.ts` (major semantic downgrade)
  - `tests/architecture/campobase-namespace-freeze.test.ts`
- Tests needed:
  - replacement runtime parity tests elsewhere (mandatory)
- Rollback:
  - restore runtime-oriented factory test and allowlist edge
- Recommendation: **Not recommended**.

### Option C
Split factory test into neutral smoke + static legacy verification, then shrink `7 -> 6`.

- Risk: **MEDIUM-HIGH**
- Impact: better than pure static, but still risks losing runtime side-effect protection if no neutral runtime-equivalent test exists.
- Future files to touch:
  - `tests/lib/factory-orchestrator.test.ts`
  - additional neutral runtime parity test file(s)
  - `tests/architecture/campobase-namespace-freeze.test.ts`
- Tests needed:
  - explicit parity tests for automation/integration side effects and handler execution from runtime-created SaaS
- Rollback:
  - re-enable legacy factory edge and previous runtime assertions
- Recommendation: **Not recommended yet unless parity tests land first in same block**.

### Option D
Keep `factory-orchestrator.test.ts` legacy for now; first create neutral runtime side-effect parity coverage for factory/orchestrator.

- Risk: **LOW-MEDIUM**
- Impact: preserves runtime protection while preparing safe removal path.
- Future files to touch:
  - new/updated tests for neutral runtime side-effect parity
  - potentially neutral orchestration adapters/contracts (test-focused first)
  - later `tests/architecture/campobase-namespace-freeze.test.ts`
- Tests needed:
  - neutral equivalent for dynamic SaaS bootstrap side effects
  - handler execution parity assertions
- Rollback:
  - straightforward, because guardrail edge remains until parity proven
- Recommendation: **Recommended now**.

### Option E
Keep factory legacy edge until TaskOps neutral closure.

- Risk: **LOW**
- Impact: safest freeze posture; slower guardrail reduction.
- Future files to touch:
  - TaskOps neutral boundary/runtime parity work first
  - later factory migration and guardrail shrink
- Tests needed:
  - TaskOps neutral runtime parity + factory parity linkage
- Rollback:
  - minimal (no immediate edge changes)
- Recommendation: **Valid conservative fallback**.

### Final recommendation

Recommend **Option D** at this checkpoint:

- keep `tests/lib/factory-orchestrator.test.ts::@/lib/campobase/platform-bootstrap` edge for now,
- build explicit neutral runtime parity coverage for factory/orchestrator side effects,
- only then evaluate `7 -> 6` shrink.

---

## Task 4 — Guardrail inspection

From `tests/architecture/campobase-namespace-freeze.test.ts`:

- Current pinned size: **7**
- Factory edge present:
  - `tests/lib/factory-orchestrator.test.ts::@/lib/campobase/platform-bootstrap`

Can factory edge be removed now?

- **No**.

Expected size if removed:

- `7 -> 6`

Conditions to remove factory edge safely:

1. neutral path proves runtime-equivalent bootstrap side effects for factory-created SaaS;
2. automation registration, integration connection/availability, and handler execution remain protected by non-legacy tests;
3. migration block lands with targeted regression validations green;
4. no ownership-boundary regression (no forced migration of Clinic/TaskOps runtime into Campamento Base).

---

## Task 5 — Requested validations (audit-only)

Executed exactly:

1. `pnpm typecheck`
2. `npx vitest run tests/lib/factory-orchestrator.test.ts`
3. `npx vitest run tests/lib/platform-bootstrap-loader.test.ts`
4. `npx vitest run tests/lib/campobase-platform-bootstrap.test.ts`
5. `npx vitest run tests/architecture/campobase-namespace-freeze.test.ts`

(No full suite, no formatter, no refactor.)

---

## Task 6 — Final checkpoint summary

- Audit file created: **YES**
- Path: `docs/audits/FACTORY_ORCHESTRATOR_LEGACY_EDGE_READINESS_AFTER_BOOTSTRAP_TEST_SPLIT.md`
- Production code modified: **NO**
- Tests modified: **NO**
- Guardrail modified: **NO**
- `factory-orchestrator.test.ts` reducible now: **NO**
- Recommended option: **Option D**
- Current guardrail size: **7**
- Expected size if factory edge is removed later: **6**
- Ready for next technical block after this audit: **YES**
- Next recommended block (do not implement here):
  - add neutral runtime parity coverage for factory-created SaaS bootstrap side effects and handler path, then re-audit `7 -> 6` shrink readiness.
