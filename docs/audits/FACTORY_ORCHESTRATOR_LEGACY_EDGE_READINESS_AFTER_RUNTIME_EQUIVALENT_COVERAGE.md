# FACTORY ORCHESTRATOR LEGACY EDGE READINESS AFTER RUNTIME EQUIVALENT COVERAGE

## Scope

Audit-only checkpoint after adding runtime-equivalent coverage artifact:

- `tests/lib/factory-orchestrator-runtime-equivalent.test.ts`

This block performs inspection, classification, and documentation only.

No production code, imports, tests, or guardrail policy are modified in this audit.

## Inputs inspected

- `tests/lib/factory-orchestrator.test.ts`
- `tests/lib/factory-orchestrator-runtime-equivalent.test.ts`
- `src/lib/campamento-base/factory-orchestrator-runtime-parity.ts`
- `tests/lib/factory-orchestrator-runtime-parity.test.ts`
- `src/lib/campamento-base/platform-bootstrap-loader.ts`
- `tests/lib/platform-bootstrap-loader.test.ts`
- `tests/lib/campobase-platform-bootstrap.test.ts`
- `src/lib/campobase/platform-bootstrap.ts`
- `tests/architecture/campobase-namespace-freeze.test.ts`
- `docs/audits/FACTORY_ORCHESTRATOR_LEGACY_EDGE_READINESS_AFTER_NEUTRAL_RUNTIME_PARITY.md`

---

## Task 1 — Coverage comparison after runtime-equivalent test

### 1) What `factory-orchestrator.test.ts` covers now

`tests/lib/factory-orchestrator.test.ts` validates three runtime behavior areas:

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

1. **Dynamic SaaS creation** → `createSaasInstance(...)` → factory registry
2. **Legacy shared loader invocation** → `loadPlatformForSaas(...)` from `@/lib/campobase/platform-bootstrap`
3. **Real side effects** → `registerAutomation(...)`, `ensureWhatsappIntegrationAvailable(...)`, `connectIntegration(...)`
4. **Handler execution** → captured handler invoked with execution context → real metrics/summary output

Critical distinction: the legacy test **executes actual runtime code paths** with mocked dependencies, not just models or plans expected behavior.

### 3) What `factory-orchestrator-runtime-equivalent.test.ts` covers now

`tests/lib/factory-orchestrator-runtime-equivalent.test.ts` (10 tests) covers:

**Coverage areas:**
1. **No legacy imports**: verifies test and module do not import from `@/lib/campobase`
2. **SocialFlow READY path**: `platformResolved: true`, `bootstrapStatus: READY`, `success: true`, effects `[RESOLVE_PLATFORM, RUN_BOOTSTRAP, REGISTER_AUTOMATION, ENSURE_INTEGRATION]`, tenantId preserved, stable message
3. **Clinic SKIPPED path**: `platformResolved: true`, `bootstrapStatus: SKIPPED`, `success: false`, effects include `SKIP_LEGACY_RUNTIME`, message indicates neutral boundary
4. **TaskOps SKIPPED path**: same as Clinic
5. **Unknown SaaS FAILED path**: `platformResolved: false`, `bootstrapStatus: FAILED`, effects only `[RESOLVE_PLATFORM]`, stable message
6. **Empty saasId FAILED path**: same as unknown with specific empty message
7. **Determinism**: repeated calls return identical results
8. **Stable effect ordering**: all paths maintain consistent effect sequences
9. **TenantId preservation**: context maintained through all paths
10. **Stable messages**: all status outcomes have non-empty stable messages

**Key characteristic**: uses `planFactoryOrchestratorRuntimeParity(...)` which **models expected effects** but does **NOT execute real runtime side effects** like `registerAutomation`, `connectIntegration`, or handler invocation.

### 4) What `factory-orchestrator-runtime-parity.test.ts` covers now

`tests/lib/factory-orchestrator-runtime-parity.test.ts` (10 tests) covers:

- Neutral parity module does not import legacy namespace
- Deterministic planning for SocialFlow READY, Clinic/TaskOps SKIPPED, unknown/empty FAILED
- Effect ordering stability
- Semantic alignment with neutral loader (`runPlatformBootstrap`)
- No new campobase files or imports

**Limitation**: pure planning/modeling layer, no runtime execution.

### 5) What `platform-bootstrap-loader.test.ts` covers now

`tests/lib/platform-bootstrap-loader.test.ts` (14 tests) covers:

- Neutral loader registry composition (SocialFlow READY, Clinic/TaskOps SKIPPED)
- Defensive registry copies
- Resolution by saasId
- Run statuses (READY/SKIPPED/FAILED)
- Registry validation (duplicates, empty fields)
- No legacy imports

**Limitation**: tests neutral loader in isolation, not factory-created dynamic SaaS bootstrap path.

### 6) What split `campobase-platform-bootstrap.test.ts` covers now

`tests/lib/campobase-platform-bootstrap.test.ts` (5 tests) covers:

- Neutral loader smoke (definitions, run statuses, validation determinism)
- Static verification of legacy adapter source (`src/lib/campobase/platform-bootstrap.ts`)
  - canonical SocialFlow import
  - legacy Clinic/TaskOps imports
  - registration and export signals

**Limitation**: no runtime execution through legacy loader, only static source policy checks.

### 7) Duplicated / equivalent coverage

**Now duplicated or sufficiently equivalent at neutral level:**
- Platform resolution logic (SocialFlow/Clinic/TaskOps/unknown/empty)
- Bootstrap status determination (READY/SKIPPED/FAILED)
- Effect planning and ordering
- Deterministic behavior guarantees
- Static legacy adapter policy verification
- No-legacy-import guarantees

**Still only in `factory-orchestrator.test.ts`:**
- **Real runtime invocation** of `loadPlatformForSaas` from legacy shared loader
- **Real side-effect execution** of `registerAutomation`, `ensureWhatsappIntegrationAvailable`, `connectIntegration`
- **Real handler execution** with captured handler and runtime metrics/summary output
- **Behavioral coupling** between factory-created dynamic SaaS and executed bootstrap side effects

### 8) Can parity replace legacy coverage?

**Assessment by coverage type:**

| Coverage Type | Legacy Test | Runtime-Equivalent Test | Parity Test | Neutral Loader Test | Replaceable? |
|---------------|-------------|-------------------------|-------------|---------------------|--------------|
| Platform resolution logic | ✅ | ✅ (modeled) | ✅ (modeled) | ✅ | **YES** |
| Bootstrap status determination | ✅ | ✅ (modeled) | ✅ (modeled) | ✅ | **YES** |
| Effect planning/ordering | ✅ (implicit) | ✅ (explicit) | ✅ (explicit) | ✅ (implicit) | **YES** |
| Static legacy adapter policy | ❌ | ❌ | ❌ | ✅ (split test) | **YES** |
| Real `loadPlatformForSaas` execution | ✅ | ❌ | ❌ | ❌ | **NO** |
| Real `registerAutomation` side effect | ✅ | ❌ | ❌ | ❌ | **NO** |
| Real `connectIntegration` side effect | ✅ | ❌ | ❌ | ❌ | **NO** |
| Real handler execution | ✅ | ❌ | ❌ | ❌ | **NO** |
| Dynamic SaaS creation | ✅ | ❌ | ❌ | ❌ | **NO** |

**Conclusion**: Runtime-equivalent test improves coverage by explicitly modeling expected effects with deterministic assertions, but **does not replace** the legacy test's unique runtime execution proof.

### 9) Requested focus areas

**Shared loader:**
- Legacy: directly invokes `loadPlatformForSaas` from `@/lib/campobase/platform-bootstrap`
- Runtime-equivalent: models expected effects but does not invoke loader
- Gap: **real loader execution still only in legacy test**

**Dynamic SaaS creation:**
- Legacy: `createSaasInstance(...)` → factory registry → `resolveSaasPlatform(...)`
- Runtime-equivalent: models effects for known platforms (socialflow/clinic/taskops)
- Gap: **factory-created dynamic SaaS not covered in runtime-equivalent**

**Platform resolution/bootstrap:**
- Legacy: real resolution + bootstrap via legacy loader
- Runtime-equivalent: models resolution + bootstrap via neutral parity
- Gap: **runtime execution vs modeling**

**Automation/integration effects:**
- Legacy: real `registerAutomation`, `connectIntegration` calls
- Runtime-equivalent: models `REGISTER_AUTOMATION`, `ENSURE_INTEGRATION` effects
- Gap: **real side-effect execution vs effect planning**

**Handler path:**
- Legacy: captures and executes real handler
- Runtime-equivalent: does not test handler execution
- Gap: **handler execution path not covered**

**DB/API/runtime real:**
- Legacy: uses mocked dependencies but exercises real code paths
- Runtime-equivalent: pure planning, no code path execution
- Gap: **runtime code path coverage**

**Clinic/TaskOps/SocialFlow relation:**
- Legacy: exercises real loader which imports legacy Clinic/TaskOps
- Runtime-equivalent: models SKIPPED for Clinic/TaskOps, READY for SocialFlow
- Gap: **runtime behavior vs modeled behavior**

**Dependency on `src/lib/campobase/platform-bootstrap.ts`:**
- Legacy: **material dependency** via direct import in test line 104
- Runtime-equivalent: no dependency, uses neutral parity
- Status: **legacy edge still required for runtime proof**

---

## Task 2 — Risk classification

### Can `factory-orchestrator.test.ts` migrate now?
**NO**

### Risk of converting to neutral parity only
**MEDIUM-HIGH**

Rationale:
- Would lose real runtime execution proof
- Effect modeling is not equivalent to side-effect execution
- Handler path would be unprotected
- Dynamic SaaS bootstrap coupling would be unverified

### Risk of converting to static verification only
**HIGH**

Rationale:
- Complete loss of runtime behavioral coverage
- No proof of automation/integration side effects
- No handler execution validation
- Static checks cannot replace runtime assertions

### Risk of splitting into neutral + static
**MEDIUM**

Rationale:
- Better than pure conversion
- Preserves planning-level coverage
- Still loses runtime execution proof unless runtime-equivalent test is enhanced

### Will functional coverage be lost?
**YES**, if migrated without additional runtime-equivalent enhancements

Specifically:
- Real `loadPlatformForSaas` execution path
- Real automation/integration registration side effects
- Real handler execution with metrics/summary output
- Factory-created dynamic SaaS bootstrap coupling

### Additional test needed first?
**PARTIALLY ADDRESSED, BUT GAP REMAINS**

Current state:
- Runtime-equivalent test models expected effects ✅
- But does NOT execute real side effects ❌

Remaining need:
- Either enhance runtime-equivalent test to execute real side effects with mocks (similar to legacy test structure)
- Or keep legacy test as-is to protect runtime execution path

### Can guardrail drop `7 -> 6` now?
**NO**

Rationale:
- Legacy test still provides unique runtime execution coverage
- Runtime-equivalent test models but does not execute
- Gap in real side-effect proof remains

### Should wait for TaskOps neutral?
**NOT STRICTLY REQUIRED, BUT RELEVANT**

Rationale:
- TaskOps neutral closure would enable full neutral runtime path
- However, the gap is not TaskOps-specific
- The gap is: **modeling vs execution**
- Even with TaskOps neutral, would still need runtime-equivalent test to execute real side effects

### Should maintain runtime test separate from legacy?
**YES, RECOMMENDED**

Options:
1. Keep legacy test as-is (safest)
2. Create enhanced runtime-equivalent test that executes real side effects with neutral imports
3. Then migrate legacy test to split neutral + static

---

## Task 3 — Options analysis

### Option A
**Migrate now `factory-orchestrator.test.ts` to neutral parity and shrink `7 -> 6`**

- **Risk**: HIGH
- **Impact**: Loss of real runtime execution coverage for automation/integration/handler paths
- **Files to touch in future block**:
  - `tests/lib/factory-orchestrator.test.ts` (convert to neutral parity calls)
  - `tests/architecture/campobase-namespace-freeze.test.ts` (remove edge, shrink to 6)
- **Tests needed**:
  - Enhanced runtime-equivalent test that executes real side effects (mandatory before migration)
- **Rollback**:
  - Restore legacy test with runtime assertions
  - Restore guardrail edge and size 7
- **Recommendation**: ❌ **Not recommended**
  - Runtime-equivalent test models but does not execute
  - Would lose unique runtime coverage

### Option B
**Convert `factory-orchestrator.test.ts` to static verification only and shrink `7 -> 6`**

- **Risk**: VERY HIGH
- **Impact**: Complete loss of runtime behavioral coverage
- **Files to touch in future block**:
  - `tests/lib/factory-orchestrator.test.ts` (convert to static source checks)
  - `tests/architecture/campobase-namespace-freeze.test.ts` (remove edge, shrink to 6)
- **Tests needed**:
  - Full runtime-equivalent test with real side-effect execution (mandatory)
- **Rollback**:
  - Restore legacy runtime test
  - Restore guardrail edge and size 7
- **Recommendation**: ❌ **Not recommended**
  - Static verification cannot replace runtime execution proof

### Option C
**Split `factory-orchestrator.test.ts` into neutral smoke + runtime-equivalent smoke + static verification, then shrink `7 -> 6`**

- **Risk**: MEDIUM
- **Impact**: Better control-plane parity, but still loses runtime execution unless runtime-equivalent test is enhanced
- **Files to touch in future block**:
  - `tests/lib/factory-orchestrator.test.ts` (split into multiple test sections)
  - `tests/lib/factory-orchestrator-runtime-equivalent.test.ts` (potentially enhance)
  - `tests/architecture/campobase-namespace-freeze.test.ts` (remove edge, shrink to 6)
- **Tests needed**:
  - Enhance runtime-equivalent test to execute real side effects with neutral imports
  - Or create new integration test that proves side effects without legacy imports
- **Rollback**:
  - Restore legacy runtime assertions
  - Restore guardrail edge and size 7
- **Recommendation**: ⚠️ **Conditionally recommended IF runtime-equivalent test is enhanced first**
  - Split approach is sound
  - But requires runtime execution proof before removing legacy edge

### Option D
**Keep `factory-orchestrator.test.ts` legacy for now, enhance runtime-equivalent test first, then re-audit**

- **Risk**: LOW-MEDIUM
- **Impact**: Preserves strongest runtime guarantee while building equivalent coverage
- **Files to touch in future block**:
  - `tests/lib/factory-orchestrator-runtime-equivalent.test.ts` (enhance to execute real side effects)
  - Later: `tests/lib/factory-orchestrator.test.ts` (migrate after equivalent coverage proven)
  - Later: `tests/architecture/campobase-namespace-freeze.test.ts` (shrink after migration)
- **Tests needed**:
  - Enhanced runtime-equivalent test that:
    - Uses neutral imports only
    - Executes real side effects with mocks (similar to legacy test structure)
    - Proves automation/integration/handler paths
    - Validates factory-created dynamic SaaS bootstrap coupling
- **Rollback**:
  - Minimal (legacy edge retained during preparation)
  - Easy to abandon enhancement if issues arise
- **Recommendation**: ✅ **Recommended**
  - Safest path
  - Builds equivalent coverage before removing legacy
  - Allows validation of runtime-equivalent test before migration

### Option E
**Keep legacy edge until TaskOps neutral is closed**

- **Risk**: LOW
- **Impact**: Safest but slowest reduction path
- **Files to touch in future block**:
  - TaskOps neutral runtime closure artifacts
  - Then factory migration and guardrail shrink
- **Tests needed**:
  - TaskOps-neutral parity linked to factory bootstrap effects
  - Runtime-equivalent test enhancements
- **Rollback**:
  - Minimal (no immediate changes)
- **Recommendation**: ⚠️ **Valid conservative fallback**
  - Safest option
  - But not strictly required if runtime-equivalent test is enhanced
  - TaskOps neutral is orthogonal to the modeling-vs-execution gap

### Final recommendation

**Recommend Option D** at this checkpoint.

**Rationale:**
1. Runtime-equivalent test successfully models expected effects ✅
2. But does not execute real side effects ❌
3. Legacy test still uniquely protects runtime execution path
4. Gap is **modeling vs execution**, not missing neutral coverage
5. Should enhance runtime-equivalent test to execute real side effects with neutral imports
6. Then re-audit and migrate legacy test with confidence

**Next block should:**
1. Enhance `tests/lib/factory-orchestrator-runtime-equivalent.test.ts` to execute real side effects:
   - Mock automation/integration/handler dependencies (similar to legacy test)
   - Use neutral imports only (`@/lib/campamento-base/...`)
   - Execute real code paths (not just model effects)
   - Validate factory-created dynamic SaaS bootstrap coupling
2. Re-audit `7 -> 6` readiness after enhancement
3. Then migrate legacy test to split neutral + static

---

## Task 4 — Guardrail inspection

From `tests/architecture/campobase-namespace-freeze.test.ts`:

### Current state
- **Pinned size**: 7
- **Factory edge present**: `tests/lib/factory-orchestrator.test.ts::@/lib/campobase/platform-bootstrap`

### Can factory edge be removed now?
**NO**

### Expected size if removed later
`7 -> 6`

### Conditions to remove safely

1. ✅ **Neutral parity module exists**: `src/lib/campamento-base/factory-orchestrator-runtime-parity.ts`
2. ✅ **Neutral parity test exists**: `tests/lib/factory-orchestrator-runtime-parity.test.ts`
3. ✅ **Runtime-equivalent test exists**: `tests/lib/factory-orchestrator-runtime-equivalent.test.ts`
4. ⚠️ **Runtime-equivalent test models effects**: YES, but does not execute real side effects
5. ❌ **Runtime-equivalent test executes real side effects**: NO (current gap)
6. ❌ **Automation/integration/handler behavior protected after edge removal**: NO (would lose coverage)
7. ✅ **Static legacy adapter verification exists**: YES (in split `campobase-platform-bootstrap.test.ts`)
8. ✅ **No ownership-boundary breach**: YES (no forced Clinic/TaskOps migration to Campamento Base)

**Blocking condition**: Runtime-equivalent test must execute real side effects before edge can be safely removed.

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
`docs/audits/FACTORY_ORCHESTRATOR_LEGACY_EDGE_READINESS_AFTER_RUNTIME_EQUIVALENT_COVERAGE.md`

### Production code modified
**NO**

### Tests modified
**NO**

### Guardrail modified
**NO**

### Can `factory-orchestrator.test.ts` migrate now?
**NO**

**Reason**: Runtime-equivalent test models expected effects but does not execute real side effects. Legacy test still uniquely protects:
- Real `loadPlatformForSaas` execution
- Real `registerAutomation` / `connectIntegration` side effects
- Real handler execution with metrics/summary output
- Factory-created dynamic SaaS bootstrap coupling

### Recommended option
**Option D**: Keep legacy edge, enhance runtime-equivalent test to execute real side effects, then re-audit

### Current guardrail size
**7**

### Expected size if factory edge removed later
**6**

### Validations executed
All requested validations will be executed below.

### Can implement technical block after this audit?
**YES**

### Next recommended block (do not implement here)

**Block: "enhance factory orchestrator runtime equivalent test with real side effect execution"**

**Objective**: Enhance `tests/lib/factory-orchestrator-runtime-equivalent.test.ts` to execute real side effects (not just model them) using neutral imports only, to prepare for safe migration of `tests/lib/factory-orchestrator.test.ts` and guardrail reduction `7 -> 6`.

**Scope**:
1. Add mock infrastructure to runtime-equivalent test (similar to legacy test structure)
2. Add tests that execute real code paths:
   - Real platform bootstrap via neutral loader
   - Real automation registration (mocked dependencies)
   - Real integration connection (mocked dependencies)
   - Real handler execution (mocked dependencies)
3. Validate factory-created dynamic SaaS bootstrap coupling
4. Use only neutral imports (`@/lib/campamento-base/...`, `@/lib/factory/...`, `@/lib/saas-contract`, etc.)
5. Do NOT import from `@/lib/campobase`
6. After enhancement, re-audit `7 -> 6` readiness

**Alternative next block**: If enhancement is too complex, consider creating a separate integration test file that proves real side effects with neutral imports, then re-audit.

---

## Conclusion

Runtime-equivalent test successfully models expected effects and provides deterministic assertions for factory orchestrator behavior. However, it does **not execute real side effects**, which creates a gap in runtime execution coverage.

The legacy test remains the only proof of real runtime execution for:
- `loadPlatformForSaas` invocation
- Automation/integration registration side effects
- Handler execution with metrics/summary output

**Recommendation**: Enhance runtime-equivalent test to execute real side effects with neutral imports, then re-audit `7 -> 6` readiness.

**Status**: Factory edge `tests/lib/factory-orchestrator.test.ts::@/lib/campobase/platform-bootstrap` should remain in guardrail at size 7 until runtime execution gap is closed.
