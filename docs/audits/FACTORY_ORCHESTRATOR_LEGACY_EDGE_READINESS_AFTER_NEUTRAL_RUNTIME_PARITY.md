# FACTORY ORCHESTRATOR LEGACY EDGE READINESS AFTER NEUTRAL RUNTIME PARITY

## Scope

Audit-only checkpoint after adding neutral runtime parity artifacts:

- `src/lib/campamento-base/factory-orchestrator-runtime-parity.ts`
- `tests/lib/factory-orchestrator-runtime-parity.test.ts`

This block performs inspection, classification, and documentation only.

No production code, imports, tests, or guardrail policy are modified in this audit.

## Inputs inspected

- `tests/lib/factory-orchestrator.test.ts`
- `src/lib/campobase/platform-bootstrap.ts`
- `src/lib/campamento-base/platform-bootstrap-loader.ts`
- `tests/lib/platform-bootstrap-loader.test.ts`
- `src/lib/campamento-base/factory-orchestrator-runtime-parity.ts`
- `tests/lib/factory-orchestrator-runtime-parity.test.ts`
- `tests/lib/campobase-platform-bootstrap.test.ts`
- `tests/architecture/campobase-namespace-freeze.test.ts`
- `docs/audits/FACTORY_ORCHESTRATOR_LEGACY_EDGE_READINESS_AFTER_BOOTSTRAP_TEST_SPLIT.md`

---

## Task 1 — Coverage comparison after neutral runtime parity

### 1) What `factory-orchestrator.test.ts` covers now

`tests/lib/factory-orchestrator.test.ts` still validates runtime behavior in three areas:

1. Dynamic SaaS creation and contract registration/resolution:
   - `createSaasInstance(...)`
   - `resolveSaasPlatform(...)`
   - persistence signal through `registerFactorySaas(...)`

2. Shared loader runtime bootstrap path through legacy import:
   - imports `loadPlatformForSaas` from `@/lib/campobase/platform-bootstrap`
   - verifies real side effects:
     - `registerAutomation(...)`
     - `ensureWhatsappIntegrationAvailable(...)`
     - `connectIntegration(...)`

3. Runtime automation handler path:
   - captures registered handler and executes it
   - asserts runtime output metrics and summary

### 2) Runtime side effects still uniquely protected there

The test still uniquely protects this live chain:

- runtime-created SaaS id -> `loadPlatformForSaas(...)` via legacy shared loader -> real automation/integration bootstrap side effects.

### 3) What `factory-orchestrator-runtime-parity.test.ts` covers now

`tests/lib/factory-orchestrator-runtime-parity.test.ts` now covers neutral deterministic planning parity:

- no import from frozen legacy namespace;
- ordered effect model (`RESOLVE_PLATFORM`, `RUN_BOOTSTRAP`, `REGISTER_AUTOMATION`, `ENSURE_INTEGRATION`, `SKIP_LEGACY_RUNTIME`);
- SocialFlow `READY`, Clinic/TaskOps `SKIPPED`, unknown/empty `FAILED`;
- deterministic result and stable ordering;
- semantic alignment of status/message with neutral loader output.

Important limitation:

- it models expected effects but does **not** execute runtime side effects in automation/integration layers.

### 4) What `platform-bootstrap-loader.test.ts` covers now

`tests/lib/platform-bootstrap-loader.test.ts` covers neutral loader behavior:

- deterministic list/resolve/run/validate behavior;
- SocialFlow `READY`, Clinic/TaskOps `SKIPPED`, unknown/empty `FAILED`;
- neutral boundary rule (no legacy imports in neutral loader).

Limitation:

- does not validate factory-created runtime SaaS bootstrap side effects.

### 5) What split `campobase-platform-bootstrap.test.ts` covers now

`tests/lib/campobase-platform-bootstrap.test.ts` (split neutral + static) covers:

- neutral smoke for statuses and validation;
- static policy checks for legacy adapter source (`src/lib/campobase/platform-bootstrap.ts`).

Limitation:

- no runtime execution through legacy loader.

### 6) Duplicated / equivalent vs legacy-only coverage

Coverage now duplicated or sufficiently equivalent at neutral level:

- status-driven decision model for SocialFlow/Clinic/TaskOps/unknown/empty;
- deterministic planning intent for effects and sequencing;
- static legacy adapter policy guarantees.

Coverage still only in `factory-orchestrator.test.ts`:

- runtime invocation of `loadPlatformForSaas` from legacy shared loader;
- assertion of real side effects in automation/integration services after dynamic SaaS creation;
- behavior-level coupling between runtime-created SaaS and executed bootstrap side effects.

### 7) Replaceability assessment

- Replace with neutral parity only: **not fully equivalent yet**.
- Replace with static-only verification: **not equivalent**.
- Replace with split neutral+static: improves posture, but still misses direct runtime side-effect execution proof unless another non-legacy runtime-equivalent test is introduced.

### 8) Requested focus areas

- Shared loader: still directly exercised at runtime only in legacy factory test.
- Dynamic SaaS creation: covered in factory legacy test; parity module models but does not execute full runtime bridge.
- Platform resolution/bootstrap: modeled neutrally; runtime side effects remain legacy-proven.
- Automation/integration effects: real execution remains legacy-protected.
- Handler path: still validated in factory legacy test; not replaced by parity planner.
- Clinic/TaskOps/SocialFlow relation: neutral model correctly marks SocialFlow ready and Clinic/TaskOps skipped; does not migrate their runtime internals.
- Dependency on `src/lib/campobase/platform-bootstrap.ts`: still material due explicit runtime import in factory legacy test.

---

## Task 2 — Risk classification

- Can `factory-orchestrator.test.ts` migrate now: **NO**.
- Risk converting directly to neutral parity module: **MEDIUM-HIGH**.
- Risk converting to static verification: **HIGH**.
- Risk splitting into neutral + static and removing legacy edge now: **MEDIUM-HIGH**.
- Functional coverage loss if migrated now: **YES**, on real runtime side-effect execution path.
- Additional test needed first: **YES**.
  - Need non-legacy runtime-equivalent test proving real side effects for dynamic SaaS bootstrap path (not just planned effects).
- Can guardrail drop `7 -> 6` now: **NO**.
- Should wait for TaskOps neutral closure: **YES, or equivalent neutral runtime bridge that closes side-effect parity first**.

---

## Task 3 — Options analysis

### Option A
Migrate now `factory-orchestrator.test.ts` to `factory-orchestrator-runtime-parity` and shrink `7 -> 6`.

- Risk: **MEDIUM-HIGH**
- Impact: likely removes direct runtime proof of automation/integration side effects.
- Future files to touch:
  - `tests/lib/factory-orchestrator.test.ts`
  - `tests/lib/factory-orchestrator-runtime-parity.test.ts` (expand)
  - `tests/architecture/campobase-namespace-freeze.test.ts`
- Tests needed:
  - non-legacy runtime-equivalent side-effect execution test
- Rollback:
  - restore legacy loader assertion and guardrail edge.
- Recommendation: **Not recommended now**.

### Option B
Convert `factory-orchestrator.test.ts` to static legacy adapter verification and shrink `7 -> 6`.

- Risk: **HIGH**
- Impact: runtime behavioral coverage would be lost.
- Future files to touch:
  - `tests/lib/factory-orchestrator.test.ts`
  - `tests/architecture/campobase-namespace-freeze.test.ts`
- Tests needed:
  - equivalent runtime side-effect coverage elsewhere (mandatory)
- Rollback:
  - restore runtime assertions and edge.
- Recommendation: **Not recommended**.

### Option C
Split `factory-orchestrator.test.ts` into:

- smoke neutral via `factory-orchestrator-runtime-parity`
- smoke neutral via `platform-bootstrap-loader`
- static legacy usage verification

then shrink `7 -> 6`.

- Risk: **MEDIUM-HIGH**
- Impact: better control-plane parity but still insufficient if no real side-effect execution replacement lands.
- Future files to touch:
  - `tests/lib/factory-orchestrator.test.ts`
  - `tests/lib/factory-orchestrator-runtime-parity.test.ts`
  - possibly a new neutral runtime-equivalent integration test
  - `tests/architecture/campobase-namespace-freeze.test.ts`
- Tests needed:
  - real side-effect parity for dynamic SaaS bootstrap (automation/integration/handler coupling)
- Rollback:
  - restore legacy factory loader assertions and edge.
- Recommendation: **Not recommended yet unless runtime-equivalent parity test is included in same block**.

### Option D
Keep `factory-orchestrator.test.ts` legacy for now because it still protects non-equivalent runtime side effects.

- Risk: **LOW-MEDIUM**
- Impact: preserves strongest runtime guarantee while parity layer matures.
- Future files to touch:
  - add neutral runtime-equivalent execution test(s)
  - later migrate factory legacy edge and shrink guardrail
- Tests needed:
  - runtime-equivalent non-legacy side-effect test
- Rollback:
  - minimal (edge retained during preparation).
- Recommendation: **Recommended now**.

### Option E
Keep legacy edge until TaskOps neutral is closed.

- Risk: **LOW**
- Impact: safest, but slower reduction path.
- Future files to touch:
  - TaskOps neutral runtime closure + integration parity tests
  - then factory migration and guardrail shrink
- Tests needed:
  - TaskOps-neutral parity linked to factory bootstrap effects
- Rollback:
  - minimal (no immediate shrink).
- Recommendation: valid conservative fallback.

### Final recommendation

Recommend **Option D** at this checkpoint.

Rationale:

- neutral parity now improves planning-level confidence,
- but legacy factory test still uniquely protects real runtime side-effect execution,
- guardrail should not shrink to `6` until that behavioral gap is closed with non-legacy runtime-equivalent tests.

---

## Task 4 — Guardrail inspection

From `tests/architecture/campobase-namespace-freeze.test.ts`:

- Current pinned size: **7**
- Factory edge present:
  - `tests/lib/factory-orchestrator.test.ts::@/lib/campobase/platform-bootstrap`

Can factory edge be removed now?

- **No**.

Expected size if removed later:

- `7 -> 6`

Conditions to remove safely:

1. non-legacy runtime-equivalent test proves side effects after dynamic SaaS bootstrap;
2. automation/integration/handler behavior remains protected after edge removal;
3. all targeted regressions pass in migration block;
4. no ownership-boundary breach (no forced runtime migration of Clinic/TaskOps internals into Campamento Base).

---

## Task 5 — Requested validations (audit-only)

Executed exactly:

1. `pnpm typecheck` ✅
2. `npx vitest run tests/lib/factory-orchestrator.test.ts` ✅
3. `npx vitest run tests/lib/factory-orchestrator-runtime-parity.test.ts` ✅
4. `npx vitest run tests/lib/platform-bootstrap-loader.test.ts` ✅
5. `npx vitest run tests/lib/campobase-platform-bootstrap.test.ts` ✅
6. `npx vitest run tests/architecture/campobase-namespace-freeze.test.ts` ✅

No full suite, no formatter, no refactor.

---

## Task 6 — Final checkpoint summary

- Audit file created: **YES**
- Path: `docs/audits/FACTORY_ORCHESTRATOR_LEGACY_EDGE_READINESS_AFTER_NEUTRAL_RUNTIME_PARITY.md`
- Production code modified: **NO**
- Tests modified: **NO**
- Guardrail modified: **NO**
- `factory-orchestrator.test.ts` reducible now: **NO**
- Recommended option: **Option D**
- Current guardrail size: **7**
- Expected size if factory edge is removed later: **6**
- Can implement next technical block after this audit: **YES**
- Next recommended block (do not implement here):
  - add one non-legacy runtime-equivalent integration test for dynamic SaaS bootstrap side effects, then re-audit `7 -> 6` readiness.
