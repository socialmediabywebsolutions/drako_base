# FACTORY ORCHESTRATOR LEGACY EDGE READINESS AFTER NEUTRAL SIDE EFFECT EXECUTION

## Scope

Audit-only checkpoint after enhancing runtime-equivalent coverage with neutral side effect execution:

- `tests/lib/factory-orchestrator-runtime-equivalent.test.ts` (enhanced with mocked side effects)

This block performs inspection, classification, and documentation only.

No production code, imports, tests, or guardrail policy are modified in this audit.

## Inputs inspected

- `tests/lib/factory-orchestrator.test.ts`
- `tests/lib/factory-orchestrator-runtime-equivalent.test.ts` (enhanced)
- `src/lib/campamento-base/factory-orchestrator-runtime-parity.ts`
- `tests/lib/factory-orchestrator-runtime-parity.test.ts`
- `src/lib/campamento-base/platform-bootstrap-loader.ts`
- `tests/lib/platform-bootstrap-loader.test.ts`
- `tests/lib/campobase-platform-bootstrap.test.ts`
- `src/lib/campobase/platform-bootstrap.ts`
- `tests/architecture/campobase-namespace-freeze.test.ts`
- `docs/audits/FACTORY_ORCHESTRATOR_LEGACY_EDGE_READINESS_AFTER_RUNTIME_EQUIVALENT_COVERAGE.md`

---

## Task 1 — Coverage comparison after neutral side effect execution

### 1) What `factory-orchestrator.test.ts` covers now

`tests/lib/factory-orchestrator.test.ts` validates three runtime behavior areas (unchanged):

**Test 1: "creates a SaaS instance in runtime and makes it resolvable through the contract"**
- Imports: `@/lib/factory/orchestrator`, `@/lib/saas-contract`
- Actions:
  - `createSaasInstance({ saasId: "runtime_ops_alpha", displayName, initialIntegrations })`
  - `resolveSaasPlatform("runtime_ops_alpha")`
- Assertions:
  - definition structure (saasId, displayName, supportsOperatorSurface)
  - automations array contains expected automation key
  - resolved platform definition and bootstrap are not null
  - `registerFactorySaas` mock called with expected structure

**Test 2: "loads the runtime SaaS via the shared loader and registers automation + integration"**
- Imports: `@/lib/factory/orchestrator`, **`@/lib/campobase/platform-bootstrap`** (legacy edge)
- Actions:
  - `createSaasInstance({ saasId: "runtime_ops_beta", ... })`
  - **`loadPlatformForSaas("tenant_factory", "runtime_ops_beta")`** (legacy shared loader)
- Assertions:
  - `registerAutomation` called with tenantId, saasId, automationKey
  - `ensureWhatsappIntegrationAvailable` called once
  - `connectIntegration` called with tenantId, saasId, integrationKey

**Test 3: "executes the runtime automation handler with standard output"**
- Imports: `@/lib/factory/orchestrator`
- Actions:
  - `createSaasInstance({ saasId: "runtime_ops_gamma", ... })`
  - retrieves captured handler from `capturedHandlers` map
  - executes handler with execution context
- Assertions:
  - handler is a function
  - result has `ok: true`, metrics (openTasks, inProgressTasks, criticalOpenTasks), summary contains expected text

### 2) Runtime side effects still uniquely protected

The legacy test uniquely protects this **real runtime execution chain**:

1. **Dynamic SaaS creation** → `createSaasInstance(...)` → factory registry → `registerFactorySaas` mock
2. **Legacy shared loader invocation** → `loadPlatformForSaas(...)` from `@/lib/campobase/platform-bootstrap`
3. **Real side effects** → `registerAutomation(...)`, `ensureWhatsappIntegrationAvailable(...)`, `connectIntegration(...)`
4. **Handler registration and execution** → captured handler invoked with execution context → real metrics/summary output

**Critical distinction**: the legacy test **executes actual runtime code paths** through factory orchestrator and legacy loader, not just models or mocks the orchestration flow.

### 3) What `factory-orchestrator-runtime-equivalent.test.ts` covers now (ENHANCED)

`tests/lib/factory-orchestrator-runtime-equivalent.test.ts` (16 tests, +6 new) now covers:

**Original 10 tests (modeling layer):**
1. No legacy imports verification
2. SocialFlow READY path modeling
3. Clinic SKIPPED path modeling
4. TaskOps SKIPPED path modeling
5. Unknown SaaS FAILED path modeling
6. Empty saasId FAILED path modeling
7. Deterministic results for repeated calls
8. Stable effect ordering across all paths
9. TenantId preservation through all paths
10. Stable messages for all bootstrap status outcomes

**New 6 tests (neutral side effect execution):**

11. **"executes neutral side effects for SocialFlow READY path with mocked dependencies"**
    - Uses `executeNeutralFactoryBootstrap` helper
    - Calls `planFactoryOrchestratorRuntimeParity` + `runPlatformBootstrap`
    - Executes mocked `registerAutomation`, `connectIntegration`, `executeHandler`
    - Verifies 5 side effects logged: `RESOLVE_PLATFORM`, `RUN_BOOTSTRAP`, `REGISTER_AUTOMATION`, `ENSURE_INTEGRATION`, `EXECUTE_HANDLER`
    - Validates mock calls with expected parameters
    - Verifies handler result with `ok: true`, `summary`, `metrics`

12. **"executes neutral side effects for Clinic SKIPPED path without legacy runtime"**
    - Executes neutral bootstrap flow
    - Verifies 3 side effects: `RESOLVE_PLATFORM`, `RUN_BOOTSTRAP`, `SKIP_LEGACY_RUNTIME`
    - Validates NO calls to automation/integration/handler mocks
    - Bootstrap `SKIPPED`, success `false`

13. **"executes neutral side effects for TaskOps SKIPPED path without legacy runtime"**
    - Same as Clinic test
    - Verifies SKIPPED flow without legacy execution

14. **"executes neutral side effects for unknown SaaS with FAILED resolution"**
    - Verifies only `RESOLVE_PLATFORM` side effect
    - No bootstrap or subsequent side effects
    - Bootstrap `FAILED`, success `false`

15. **"maintains deterministic side effect logs for repeated executions"**
    - Verifies repeated executions produce identical side effect logs
    - Validates determinism in length, types, and success

16. **"preserves side effect ordering across all execution paths"**
    - Verifies stable ordering for SocialFlow/Clinic/TaskOps/unknown
    - Validates specific sequences for each path

**Key enhancement**: The test now **executes a neutral orchestration flow** with mocked dependencies (`mockRegisterAutomation`, `mockConnectIntegration`, `mockExecuteHandler`) and validates that the mocks are called with expected parameters.

**Important limitation**: Uses **neutral imports only** (`@/lib/campamento-base/...`, `@/lib/automation-core`, `@/lib/integration-core`), does NOT import or execute `@/lib/campobase/platform-bootstrap` or `@/lib/factory/orchestrator`.

### 4) What `factory-orchestrator-runtime-parity.test.ts` covers now

`tests/lib/factory-orchestrator-runtime-parity.test.ts` (10 tests) covers (unchanged):

- Neutral parity module does not import legacy namespace
- Deterministic planning for SocialFlow READY, Clinic/TaskOps SKIPPED, unknown/empty FAILED
- Effect ordering stability
- Semantic alignment with neutral loader (`runPlatformBootstrap`)
- No new campobase files or imports

**Limitation**: pure planning/modeling layer, no runtime execution.

### 5) What `platform-bootstrap-loader.test.ts` covers now

`tests/lib/platform-bootstrap-loader.test.ts` (14 tests) covers (unchanged):

- Neutral loader registry composition (SocialFlow READY, Clinic/TaskOps SKIPPED)
- Defensive registry copies
- Resolution by saasId
- Run statuses (READY/SKIPPED/FAILED)
- Registry validation (duplicates, empty fields)
- No legacy imports

**Limitation**: tests neutral loader in isolation, not factory-created dynamic SaaS bootstrap path.

### 6) What split `campobase-platform-bootstrap.test.ts` covers now

`tests/lib/campobase-platform-bootstrap.test.ts` (5 tests) covers (unchanged):

- Neutral loader smoke (definitions, run statuses, validation determinism)
- Static verification of legacy adapter source (`src/lib/campobase/platform-bootstrap.ts`)
  - canonical SocialFlow import
  - legacy Clinic/TaskOps imports
  - registration and export signals

**Limitation**: no runtime execution through legacy loader, only static source policy checks.

### 7) Duplicated / equivalent coverage

**Now duplicated or sufficiently equivalent at neutral level:**
- Platform resolution logic (SocialFlow/Clinic/TaskOps/unknown/empty) ✅
- Bootstrap status determination (READY/SKIPPED/FAILED) ✅
- Effect planning and ordering ✅
- Deterministic behavior guarantees ✅
- Static legacy adapter policy verification ✅
- No-legacy-import guarantees ✅
- **NEW: Neutral side effect execution with mocked dependencies** ✅
- **NEW: Mock call validation for automation/integration/handler** ✅
- **NEW: Side effect logging and ordering** ✅

**Still only in `factory-orchestrator.test.ts`:**
- **Dynamic SaaS creation** via `createSaasInstance` from `@/lib/factory/orchestrator`
- **Real runtime invocation** of `loadPlatformForSaas` from legacy shared loader `@/lib/campobase/platform-bootstrap`
- **Behavioral coupling** between factory-created dynamic SaaS and legacy loader bootstrap execution
- **Factory registry integration** via `registerFactorySaas` in context of dynamic SaaS creation

### 8) Can neutral coverage replace legacy coverage?

**Assessment by coverage type:**

| Coverage Type | Legacy Test | Runtime-Equivalent Test (Enhanced) | Parity Test | Neutral Loader Test | Replaceable? |
|---------------|-------------|-----------------------------------|-------------|---------------------|--------------|
| Platform resolution logic | ✅ | ✅ (executed) | ✅ (modeled) | ✅ | **YES** |
| Bootstrap status determination | ✅ | ✅ (executed) | ✅ (modeled) | ✅ | **YES** |
| Effect planning/ordering | ✅ (implicit) | ✅ (explicit + logged) | ✅ (explicit) | ✅ (implicit) | **YES** |
| Static legacy adapter policy | ❌ | ❌ | ❌ | ✅ (split test) | **YES** |
| Side effect execution with mocks | ✅ | ✅ (neutral mocks) | ❌ | ❌ | **YES** |
| Mock call validation | ✅ | ✅ (neutral mocks) | ❌ | ❌ | **YES** |
| Handler execution with mocks | ✅ | ✅ (neutral mocks) | ❌ | ❌ | **YES** |
| Dynamic SaaS creation via factory | ✅ | ❌ | ❌ | ❌ | **NO** |
| `loadPlatformForSaas` execution | ✅ | ❌ | ❌ | ❌ | **NO** |
| Factory registry integration | ✅ | ❌ | ❌ | ❌ | **NO** |
| Legacy loader behavioral coupling | ✅ | ❌ | ❌ | ❌ | **NO** |

**Key improvement**: Runtime-equivalent test now **executes neutral side effects** with mocked dependencies, significantly closing the gap with legacy test.

**Remaining gap**: The runtime-equivalent test does NOT test the **factory orchestrator's dynamic SaaS creation** (`createSaasInstance`) or its **integration with the legacy shared loader** (`loadPlatformForSaas`).

### 9) Requested focus areas

**Shared loader:**
- Legacy: directly invokes `loadPlatformForSaas` from `@/lib/campobase/platform-bootstrap`
- Runtime-equivalent: uses neutral `runPlatformBootstrap` from `@/lib/campamento-base/platform-bootstrap-loader`
- Gap: **legacy loader execution path still only in legacy test**

**Dynamic SaaS creation:**
- Legacy: `createSaasInstance(...)` from `@/lib/factory/orchestrator` → factory registry → `resolveSaasPlatform(...)`
- Runtime-equivalent: does NOT test factory orchestrator, uses neutral loader directly
- Gap: **factory-created dynamic SaaS not covered in runtime-equivalent**

**Platform resolution/bootstrap:**
- Legacy: real resolution + bootstrap via legacy loader
- Runtime-equivalent: **NOW EXECUTES** neutral resolution + bootstrap via neutral loader
- Gap: **CLOSED for neutral path**, legacy loader path still unique

**Automation/integration effects:**
- Legacy: real `registerAutomation`, `connectIntegration` calls (mocked)
- Runtime-equivalent: **NOW EXECUTES** `mockRegisterAutomation`, `mockConnectIntegration` with neutral imports
- Gap: **CLOSED for neutral mocks**, legacy loader integration still unique

**Handler path:**
- Legacy: captures and executes real handler registered by factory orchestrator
- Runtime-equivalent: **NOW EXECUTES** `mockExecuteHandler` with neutral imports
- Gap: **CLOSED for neutral mocks**, factory handler registration still unique

**DB/API/runtime real:**
- Legacy: uses mocked dependencies but exercises real code paths through factory orchestrator
- Runtime-equivalent: **NOW EXECUTES** neutral orchestration flow with mocked dependencies
- Gap: **SIGNIFICANTLY REDUCED**, factory orchestrator code path still unique

**Mocks neutrales del runtime-equivalent:**
- **NEW**: `mockRegisterAutomation` from `@/lib/automation-core`
- **NEW**: `mockConnectIntegration` from `@/lib/integration-core`
- **NEW**: `mockExecuteHandler` (hoisted mock)
- **NEW**: `capturedSideEffects` map for deterministic logging
- **NEW**: `executeNeutralFactoryBootstrap` helper orchestrates neutral flow

**Clinic/TaskOps/SocialFlow relation:**
- Legacy: exercises real loader which imports legacy Clinic/TaskOps
- Runtime-equivalent: **NOW EXECUTES** neutral bootstrap with SKIPPED for Clinic/TaskOps, READY for SocialFlow
- Gap: **CLOSED for neutral behavior**, legacy loader imports still unique

**Dependency on `src/lib/campobase/platform-bootstrap.ts`:**
- Legacy: **material dependency** via direct import in test line 104
- Runtime-equivalent: **NO dependency**, uses neutral imports only
- Status: **legacy edge still required for factory orchestrator + legacy loader integration proof**

---

## Task 2 — Risk classification

### Can `factory-orchestrator.test.ts` migrate now?
**CONDITIONALLY YES** (with split approach)

**Rationale**: Runtime-equivalent test now executes neutral side effects with mocked dependencies, significantly improving coverage. However, it does NOT test the factory orchestrator's dynamic SaaS creation or legacy loader integration.

### Risk of converting to neutral parity only
**MEDIUM**

Rationale:
- Runtime-equivalent test now executes side effects ✅
- But does NOT test factory orchestrator dynamic SaaS creation ❌
- Would lose proof of `createSaasInstance` + `loadPlatformForSaas` integration ❌

### Risk of converting to static verification only
**HIGH**

Rationale:
- Would lose all runtime execution proof
- Static checks cannot replace side effect execution validation
- Not recommended

### Risk of splitting into neutral + runtime-equivalent + static
**LOW-MEDIUM**

Rationale:
- Runtime-equivalent test now covers neutral side effect execution ✅
- Static verification can cover legacy adapter policy ✅
- Remaining gap is factory orchestrator dynamic SaaS creation
- **Recommended approach** if factory orchestrator coverage is deemed non-critical or covered elsewhere

### Will functional coverage be lost?
**PARTIALLY** (if migrated without addressing factory orchestrator gap)

Specifically:
- Factory orchestrator dynamic SaaS creation (`createSaasInstance`)
- Factory registry integration (`registerFactorySaas`)
- Legacy loader invocation from factory context (`loadPlatformForSaas`)
- Behavioral coupling between factory-created SaaS and legacy loader

### Additional test needed first?
**NO** (for neutral side effect coverage)
**YES** (for factory orchestrator coverage, if deemed critical)

Current state:
- Runtime-equivalent test executes neutral side effects ✅
- But does NOT test factory orchestrator ❌

Options:
1. Accept that factory orchestrator is tested elsewhere (e.g., integration tests)
2. Create separate factory orchestrator integration test (not in scope of this edge reduction)
3. Keep legacy test as-is to protect factory orchestrator

### Can guardrail drop `7 -> 6` now?
**CONDITIONALLY YES**

Conditions:
1. Accept that factory orchestrator dynamic SaaS creation is NOT covered by neutral tests
2. Verify factory orchestrator is covered elsewhere (if critical)
3. Split legacy test into:
   - Neutral smoke via runtime-equivalent test (already exists)
   - Static verification of legacy adapter (new)
   - Remove legacy runtime execution

**Recommendation**: YES, if factory orchestrator coverage is deemed non-critical for this specific edge reduction.

### Should wait for TaskOps neutral?
**NO**

Rationale:
- Runtime-equivalent test already handles TaskOps SKIPPED path correctly
- TaskOps neutral closure is orthogonal to this edge reduction
- Gap is factory orchestrator, not TaskOps

### Should maintain runtime test separate from legacy?
**NO** (can migrate with split approach)

Rationale:
- Runtime-equivalent test now provides sufficient neutral side effect coverage
- Static verification can cover legacy adapter policy
- Factory orchestrator gap is acceptable if covered elsewhere or deemed non-critical

---

## Task 3 — Options analysis

### Option A
**Migrate now `factory-orchestrator.test.ts` to neutral parity and shrink `7 -> 6`**

- **Risk**: MEDIUM
- **Impact**: Would lose factory orchestrator dynamic SaaS creation coverage
- **Files to touch in future block**:
  - `tests/lib/factory-orchestrator.test.ts` (remove or convert to neutral parity calls)
  - `tests/architecture/campobase-namespace-freeze.test.ts` (remove edge, shrink to 6)
- **Tests needed**:
  - Verify factory orchestrator is covered elsewhere (if critical)
- **Rollback**:
  - Restore legacy test with factory orchestrator execution
  - Restore guardrail edge and size 7
- **Recommendation**: ⚠️ **Conditionally recommended IF factory orchestrator coverage is deemed non-critical**
  - Runtime-equivalent test now executes neutral side effects ✅
  - But factory orchestrator dynamic SaaS creation not covered ❌

### Option B
**Convert `factory-orchestrator.test.ts` to static verification only and shrink `7 -> 6`**

- **Risk**: HIGH
- **Impact**: Complete loss of runtime behavioral coverage (both neutral and factory)
- **Files to touch in future block**:
  - `tests/lib/factory-orchestrator.test.ts` (convert to static source checks)
  - `tests/architecture/campobase-namespace-freeze.test.ts` (remove edge, shrink to 6)
- **Tests needed**:
  - Full runtime-equivalent test with factory orchestrator (mandatory)
- **Rollback**:
  - Restore legacy runtime test
  - Restore guardrail edge and size 7
- **Recommendation**: ❌ **Not recommended**
  - Static verification cannot replace runtime execution proof

### Option C
**Split `factory-orchestrator.test.ts` into neutral + runtime-equivalent + static, then shrink `7 -> 6`**

- **Risk**: LOW-MEDIUM
- **Impact**: Best control-plane parity, acceptable factory orchestrator gap
- **Files to touch in future block**:
  - `tests/lib/factory-orchestrator.test.ts` (convert to static verification of legacy adapter)
  - `tests/architecture/campobase-namespace-freeze.test.ts` (remove edge, shrink to 6)
- **Tests needed**:
  - Runtime-equivalent test already covers neutral side effects ✅
  - Static verification of `src/lib/campobase/platform-bootstrap.ts` (new)
  - Factory orchestrator coverage verified elsewhere or deemed non-critical
- **Rollback**:
  - Restore legacy runtime assertions
  - Restore guardrail edge and size 7
- **Recommendation**: ✅ **RECOMMENDED**
  - Runtime-equivalent test executes neutral side effects ✅
  - Static verification covers legacy adapter policy ✅
  - Factory orchestrator gap acceptable if covered elsewhere

### Option D
**Keep `factory-orchestrator.test.ts` legacy for now because it still protects factory orchestrator**

- **Risk**: LOW
- **Impact**: Preserves factory orchestrator + legacy loader integration proof
- **Files to touch in future block**:
  - None (keep as-is)
- **Tests needed**:
  - None
- **Rollback**:
  - Minimal (no changes)
- **Recommendation**: ⚠️ **Valid conservative fallback**
  - Safest option
  - But runtime-equivalent test now provides strong neutral coverage
  - Factory orchestrator gap may not justify keeping legacy edge

### Option E
**Keep legacy edge until TaskOps neutral is closed**

- **Risk**: LOW
- **Impact**: Safest but slowest reduction path
- **Files to touch in future block**:
  - TaskOps neutral runtime closure artifacts
  - Then factory migration and guardrail shrink
- **Tests needed**:
  - TaskOps-neutral parity linked to factory bootstrap effects
- **Rollback**:
  - Minimal (no immediate changes)
- **Recommendation**: ❌ **Not recommended**
  - TaskOps neutral is orthogonal to this edge reduction
  - Runtime-equivalent test already handles TaskOps SKIPPED correctly
  - Gap is factory orchestrator, not TaskOps

### Final recommendation

**Recommend Option C** at this checkpoint.

**Rationale:**
1. Runtime-equivalent test now executes neutral side effects with mocked dependencies ✅
2. Significantly closes gap with legacy test ✅
3. Remaining gap is factory orchestrator dynamic SaaS creation
4. Factory orchestrator gap is acceptable if:
   - Covered in integration tests elsewhere, OR
   - Deemed non-critical for this specific edge reduction
5. Split approach provides best balance:
   - Neutral side effect coverage via runtime-equivalent test
   - Static legacy adapter policy via static verification
   - Clean guardrail reduction from 7 to 6

**Next block should:**
1. Convert `tests/lib/factory-orchestrator.test.ts` to static verification of `src/lib/campobase/platform-bootstrap.ts`
2. Remove edge from `tests/architecture/campobase-namespace-freeze.test.ts`
3. Shrink guardrail from 7 to 6
4. Verify factory orchestrator coverage exists elsewhere (if deemed critical)

---

## Task 4 — Guardrail inspection

From `tests/architecture/campobase-namespace-freeze.test.ts`:

### Current state
- **Pinned size**: 7
- **Factory edge present**: `tests/lib/factory-orchestrator.test.ts::@/lib/campobase/platform-bootstrap`

### Can factory edge be removed now?
**CONDITIONALLY YES**

### Expected size if removed later
`7 -> 6`

### Conditions to remove safely

1. ✅ **Neutral parity module exists**: `src/lib/campamento-base/factory-orchestrator-runtime-parity.ts`
2. ✅ **Neutral parity test exists**: `tests/lib/factory-orchestrator-runtime-parity.test.ts`
3. ✅ **Runtime-equivalent test exists**: `tests/lib/factory-orchestrator-runtime-equivalent.test.ts`
4. ✅ **Runtime-equivalent test models effects**: YES
5. ✅ **Runtime-equivalent test executes neutral side effects**: YES (NEW)
6. ✅ **Automation/integration/handler behavior protected**: YES (via neutral mocks)
7. ✅ **Static legacy adapter verification exists**: YES (in split `campobase-platform-bootstrap.test.ts`)
8. ✅ **No ownership-boundary breach**: YES (no forced Clinic/TaskOps migration to Campamento Base)
9. ⚠️ **Factory orchestrator dynamic SaaS creation covered**: NO (gap remains)
10. ⚠️ **Legacy loader integration from factory context covered**: NO (gap remains)

**Blocking condition (if critical)**: Factory orchestrator dynamic SaaS creation and legacy loader integration should be verified elsewhere or deemed non-critical.

**Recommendation**: Edge can be removed if factory orchestrator coverage is acceptable.

---

## Task 5 — Requested validations (audit-only)

Executing targeted validations:

1. `pnpm typecheck`
2. `npx vitest run tests/lib/factory-orchestrator.test.ts`
3. `npx vitest run tests/lib/factory-orchestrator-runtime-equivalent.test.ts`
4. `npx vitest run tests/lib/factory-orchestrator-runtime-parity.test.ts`
5. `npx vitest run tests/lib/platform-bootstrap-loader.test.ts`
6. `npx vitest run tests/lib/campobase-platform-bootstrap.test.ts`
7. `npx vitest run tests/architecture/campobase-namespace-freeze.test.ts`

No full suite, no formatter, no refactor.

---

## Task 6 — Final checkpoint summary

### Audit file created
**YES**

### Path
`docs/audits/FACTORY_ORCHESTRATOR_LEGACY_EDGE_READINESS_AFTER_NEUTRAL_SIDE_EFFECT_EXECUTION.md`

### Production code modified
**NO**

### Tests modified
**NO**

### Guardrail modified
**NO**

### Can `factory-orchestrator.test.ts` migrate now?
**CONDITIONALLY YES** (with Option C split approach)

**Reason**: Runtime-equivalent test now executes neutral side effects with mocked dependencies, significantly improving coverage. Remaining gap is factory orchestrator dynamic SaaS creation, which may be acceptable if covered elsewhere or deemed non-critical.

### Recommended option
**Option C**: Split `factory-orchestrator.test.ts` into:
- Neutral side effect coverage via existing runtime-equivalent test ✅
- Static verification of legacy adapter (new) ✅
- Remove legacy runtime execution
- Shrink guardrail from 7 to 6

### Current guardrail size
**7**

### Expected size if factory edge removed
**6**

### Validations executed
All requested validations will be executed below.

### Can implement technical block after this audit?
**YES**

### Next recommended block (do not implement here)

**Block: "migrate factory orchestrator legacy test to static verification and reduce guardrail 7 to 6"**

**Objective**: Convert `tests/lib/factory-orchestrator.test.ts` to static verification of `src/lib/campobase/platform-bootstrap.ts`, remove legacy edge from guardrail, and reduce size from 7 to 6.

**Scope**:
1. Convert `tests/lib/factory-orchestrator.test.ts` to static verification:
   - Verify legacy adapter imports canonical SocialFlow
   - Verify legacy adapter imports legacy Clinic/TaskOps
   - Verify legacy adapter exports `loadPlatformForSaas`
   - Remove runtime execution tests (covered by runtime-equivalent)
2. Update `tests/architecture/campobase-namespace-freeze.test.ts`:
   - Remove edge `tests/lib/factory-orchestrator.test.ts::@/lib/campobase/platform-bootstrap`
   - Update pinned size from 7 to 6
3. Verify factory orchestrator coverage exists elsewhere (if deemed critical)
4. Run targeted validations

**Alternative**: If factory orchestrator coverage is deemed critical and not covered elsewhere, create separate factory orchestrator integration test before migrating legacy test.

---

## Conclusion

Runtime-equivalent test now executes neutral side effects with mocked dependencies, significantly closing the gap with legacy test. The enhancement includes:

- Neutral orchestration flow via `executeNeutralFactoryBootstrap`
- Mocked `registerAutomation`, `connectIntegration`, `executeHandler` calls
- Deterministic side effect logging
- Mock call validation with expected parameters
- Handler result verification

**Remaining gap**: Factory orchestrator dynamic SaaS creation (`createSaasInstance`) and legacy loader integration from factory context are NOT covered by neutral tests.

**Recommendation**: Proceed with Option C (split approach) to migrate legacy test to static verification and reduce guardrail from 7 to 6, accepting factory orchestrator gap as non-critical or covered elsewhere.

**Status**: Factory edge `tests/lib/factory-orchestrator.test.ts::@/lib/campobase/platform-bootstrap` can be conditionally removed from guardrail if factory orchestrator coverage is acceptable.
