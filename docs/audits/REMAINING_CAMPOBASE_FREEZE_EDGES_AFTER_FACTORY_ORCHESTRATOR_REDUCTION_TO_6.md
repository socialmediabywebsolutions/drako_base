# REMAINING CAMPOBASE FREEZE EDGES AFTER FACTORY ORCHESTRATOR REDUCTION TO 6

## Scope

Audit-only checkpoint after factory orchestrator legacy test migration and guardrail shrink to `6`.

Goal:

- inspect remaining `@/lib/campobase` freeze edges;
- classify risk and readiness per edge;
- propose the safest next shrink block;
- do not modify product code, imports, tests, or guardrail in this audit.

Canonical rule applied:

- Campamento Base is canonical as control-plane.
- SocialFlow already has canonical platform.
- Clinic is an independent SaaS vertical.
- TaskOps is a transversal engine/module.
- `src/lib/clinic/` is the target namespace for Clinic domain logic.
- `src/lib/taskops/` would be the target namespace for TaskOps transversal logic (currently does not exist).
- Campobase remains frozen legacy compatibility.
- No new imports to `@/lib/campobase`.
- No mixing Clinic/TaskOps logic into Campamento Base.

---

## Task 1 — Guardrail Current State

Source inspected: `tests/architecture/campobase-namespace-freeze.test.ts`

- **Pinned size**: `6`
- **Remaining allowed edges**: `6`
- **Runtime src edges**: `4`
- **Test-only edges**: `2`
- **No stale edges detected**

### Allowed edges (current 6)

| # | Edge | File Origin | Import Destination | Domain |
|---|---|---|---|---|
| 1 | `src/lib/campobase/clinic-platform.ts::@/lib/campobase/clinic-platform-service` | `src/lib/campobase/clinic-platform.ts` | `@/lib/campobase/clinic-platform-service` | Clinic |
| 2 | `src/lib/campobase/platform-bootstrap.ts::@/lib/campobase/clinic-platform` | `src/lib/campobase/platform-bootstrap.ts` | `@/lib/campobase/clinic-platform` | platform-bootstrap / Clinic |
| 3 | `src/lib/campobase/platform-bootstrap.ts::@/lib/campobase/taskops-platform` | `src/lib/campobase/platform-bootstrap.ts` | `@/lib/campobase/taskops-platform` | platform-bootstrap / TaskOps |
| 4 | `src/lib/campobase/taskops-platform.ts::@/lib/campobase/taskops-platform-service` | `src/lib/campobase/taskops-platform.ts` | `@/lib/campobase/taskops-platform-service` | TaskOps |
| 5 | `tests/lib/campobase-taskops-platform-service.test.ts::@/lib/campobase/taskops-platform-service` | `tests/lib/campobase-taskops-platform-service.test.ts` | `@/lib/campobase/taskops-platform-service` | TaskOps test |
| 6 | `tests/lib/cross-saas-taskops-flow.test.ts::@/lib/campobase/taskops-platform` | `tests/lib/cross-saas-taskops-flow.test.ts` | `@/lib/campobase/taskops-platform` | TaskOps cross-saas test |

---

## Task 2 — Edge-by-edge Classification

### Edge 1: `src/lib/campobase/clinic-platform.ts::@/lib/campobase/clinic-platform-service`

- **File origin**: `src/lib/campobase/clinic-platform.ts`
- **Import destination**: `@/lib/campobase/clinic-platform-service`
- **Category**: runtime src / adapter interno
- **Domain**: Clinic
- **Risk of reduction**: **HIGH**
- **Current coverage**: Clinic platform definition and bootstrap adapter
- **Neutral equivalent existing**: 
  - ✅ `src/lib/clinic/appointment-health.ts` (domain calculation)
  - ✅ `src/lib/clinic/control-plane-orchestration.ts` (bootstrap planning)
  - ✅ `src/lib/clinic/control-plane-handler-registration.ts` (handler registration)
  - ✅ `src/lib/clinic/control-plane-context-resolution.ts` (context resolution)
  - ✅ `src/lib/capabilities/internal-api-clients/clinic-control-plane.ts` (neutral client)
- **Neutral equivalent missing**: 
  - ❌ Neutral Clinic platform wrapper that replaces `src/lib/campobase/clinic-platform.ts`
  - ❌ Neutral Clinic service that replaces `src/lib/campobase/clinic-platform-service.ts`
- **Can reduce now**: **NO**
- **Action recommended**: **Requires neutral Clinic platform wrapper + service before reduction**

**Rationale**: This is an internal adapter edge where `clinic-platform.ts` imports `clinic-platform-service.ts` to bootstrap Clinic. While neutral coverage exists for domain logic, orchestration, and client boundaries, there is no neutral replacement for the platform wrapper and service layer. Reducing this edge would require creating neutral equivalents that do not import legacy.

### Edge 2: `src/lib/campobase/platform-bootstrap.ts::@/lib/campobase/clinic-platform`

- **File origin**: `src/lib/campobase/platform-bootstrap.ts`
- **Import destination**: `@/lib/campobase/clinic-platform`
- **Category**: runtime src / platform-bootstrap internal
- **Domain**: platform-bootstrap / Clinic
- **Risk of reduction**: **HIGH**
- **Current coverage**: Legacy shared loader imports Clinic platform for registration
- **Neutral equivalent existing**: 
  - ✅ `src/lib/campamento-base/platform-bootstrap-loader.ts` (neutral loader with SKIPPED for Clinic)
- **Neutral equivalent missing**: 
  - ❌ Neutral Clinic platform module in `@/lib/campamento-base` or `@/lib/clinic`
- **Can reduce now**: **NO**
- **Action recommended**: **Must remain until Clinic has neutral platform wrapper**

**Rationale**: This is a platform-bootstrap internal import. The legacy shared loader (`src/lib/campobase/platform-bootstrap.ts`) dynamically imports Clinic platform for registration. The neutral loader exists but marks Clinic as SKIPPED. Removing this edge would break the legacy loader's ability to bootstrap Clinic. This edge should remain frozen until Clinic has a neutral platform wrapper that can be imported instead.

### Edge 3: `src/lib/campobase/platform-bootstrap.ts::@/lib/campobase/taskops-platform`

- **File origin**: `src/lib/campobase/platform-bootstrap.ts`
- **Import destination**: `@/lib/campobase/taskops-platform`
- **Category**: runtime src / platform-bootstrap internal
- **Domain**: platform-bootstrap / TaskOps
- **Risk of reduction**: **HIGH**
- **Current coverage**: Legacy shared loader imports TaskOps platform for registration
- **Neutral equivalent existing**: 
  - ✅ `src/lib/campamento-base/platform-bootstrap-loader.ts` (neutral loader with SKIPPED for TaskOps)
- **Neutral equivalent missing**: 
  - ❌ Neutral TaskOps platform module
  - ❌ TaskOps transversal contract/namespace
- **Can reduce now**: **NO**
- **Action recommended**: **Must remain until TaskOps has neutral platform wrapper or contract**

**Rationale**: Same as Edge 2 but for TaskOps. The legacy shared loader dynamically imports TaskOps platform for registration. The neutral loader exists but marks TaskOps as SKIPPED. TaskOps is a transversal engine and should not be mixed into Campamento Base. A dedicated TaskOps contract/namespace is needed before this edge can be reduced.

### Edge 4: `src/lib/campobase/taskops-platform.ts::@/lib/campobase/taskops-platform-service`

- **File origin**: `src/lib/campobase/taskops-platform.ts`
- **Import destination**: `@/lib/campobase/taskops-platform-service`
- **Category**: runtime src / adapter interno
- **Domain**: TaskOps
- **Risk of reduction**: **HIGH**
- **Current coverage**: TaskOps platform definition, bootstrap adapter, and signal handlers
- **Neutral equivalent existing**: 
  - ❌ None
- **Neutral equivalent missing**: 
  - ❌ Neutral TaskOps platform wrapper
  - ❌ Neutral TaskOps service
  - ❌ TaskOps transversal contract
- **Can reduce now**: **NO**
- **Action recommended**: **Requires TaskOps neutral contract + platform wrapper + service before reduction**

**Rationale**: This is an internal adapter edge where `taskops-platform.ts` imports `taskops-platform-service.ts` to bootstrap TaskOps and register signal handlers (`task.overdue`). No neutral coverage exists for TaskOps. TaskOps is a transversal engine and requires a dedicated contract/namespace before this edge can be reduced.

### Edge 5: `tests/lib/campobase-taskops-platform-service.test.ts::@/lib/campobase/taskops-platform-service`

- **File origin**: `tests/lib/campobase-taskops-platform-service.test.ts`
- **Import destination**: `@/lib/campobase/taskops-platform-service`
- **Category**: test funcional
- **Domain**: TaskOps test
- **Risk of reduction**: **MEDIUM-HIGH**
- **Current coverage**: TaskOps service runtime execution test (automation registration, handler execution, metrics)
- **Neutral equivalent existing**: 
  - ❌ None
- **Neutral equivalent missing**: 
  - ❌ Neutral TaskOps service test
  - ❌ Static adapter verification test
- **Can reduce now**: **NO**
- **Action recommended**: **Convert to static adapter verification after neutral TaskOps coverage exists**

**Rationale**: This test executes runtime TaskOps service behavior (bootstrap, automation registration, handler execution with metrics). No neutral TaskOps coverage exists yet. This test should be converted to static adapter verification only after neutral TaskOps coverage is created, similar to how `factory-orchestrator.test.ts` was converted.

### Edge 6: `tests/lib/cross-saas-taskops-flow.test.ts::@/lib/campobase/taskops-platform`

- **File origin**: `tests/lib/cross-saas-taskops-flow.test.ts`
- **Import destination**: `@/lib/campobase/taskops-platform`
- **Category**: test funcional / cross-saas flow
- **Domain**: TaskOps cross-saas test
- **Risk of reduction**: **HIGH**
- **Current coverage**: Cross-SaaS signal routing (`task.overdue` → TaskOps automation trigger), observability integration, factory control plane
- **Neutral equivalent existing**: 
  - ❌ None
- **Neutral equivalent missing**: 
  - ❌ Neutral TaskOps signal handler bridge
  - ❌ Neutral cross-saas flow test
- **Can reduce now**: **NO**
- **Action recommended**: **Must remain until TaskOps neutral signal handler bridge exists**

**Rationale**: This test validates critical cross-SaaS behavior: emitting `task.overdue` signal from Clinic, routing it to TaskOps, triggering TaskOps automation, and exposing activity in the factory control plane. This is a unique integration test that protects TaskOps signal handler behavior (`signalHandlers: { "task.overdue": ... }`). No neutral equivalent exists for TaskOps signal handling. This edge must remain until TaskOps has a neutral signal handler bridge.

---

## Task 3 — Diagnosis by Domain

### Clinic

**Edges remaining related to Clinic**: 2

1. `src/lib/campobase/clinic-platform.ts::@/lib/campobase/clinic-platform-service` (runtime src)
2. `src/lib/campobase/platform-bootstrap.ts::@/lib/campobase/clinic-platform` (platform-bootstrap internal)

**Neutral coverage existing**:
- ✅ Domain calculation: `src/lib/clinic/appointment-health.ts`
- ✅ Bootstrap orchestration: `src/lib/clinic/control-plane-orchestration.ts`
- ✅ Handler registration: `src/lib/clinic/control-plane-handler-registration.ts`
- ✅ Context resolution: `src/lib/clinic/control-plane-context-resolution.ts`
- ✅ Neutral client: `src/lib/capabilities/internal-api-clients/clinic-control-plane.ts`

**Adapter/service blocking reduction**:
- ❌ `src/lib/campobase/clinic-platform.ts` (no neutral replacement)
- ❌ `src/lib/campobase/clinic-platform-service.ts` (no neutral replacement)

**Can reduce any Clinic edge now**: **NO**

**Reason**: While significant neutral coverage exists for Clinic domain logic, orchestration, and client boundaries, there is no neutral replacement for the platform wrapper (`clinic-platform.ts`) and service layer (`clinic-platform-service.ts`). The legacy adapter imports the legacy service, creating an internal dependency that cannot be broken without a neutral alternative.

**Recommended path**: Create neutral Clinic platform wrapper and service that use existing neutral modules, then migrate both Clinic edges together.

### TaskOps

**Edges remaining related to TaskOps**: 4

1. `src/lib/campobase/taskops-platform.ts::@/lib/campobase/taskops-platform-service` (runtime src)
2. `src/lib/campobase/platform-bootstrap.ts::@/lib/campobase/taskops-platform` (platform-bootstrap internal)
3. `tests/lib/campobase-taskops-platform-service.test.ts::@/lib/campobase/taskops-platform-service` (test)
4. `tests/lib/cross-saas-taskops-flow.test.ts::@/lib/campobase/taskops-platform` (cross-saas test)

**Neutral coverage existing**:
- ❌ None

**Runtime/cross-saas flow blocking reduction**:
- ❌ No neutral TaskOps platform wrapper
- ❌ No neutral TaskOps service
- ❌ No neutral TaskOps signal handler bridge
- ❌ No TaskOps transversal contract/namespace

**Can reduce any TaskOps edge now**: **NO**

**Reason**: TaskOps has zero neutral coverage. All 4 TaskOps edges are blocked by lack of neutral TaskOps infrastructure. TaskOps is a transversal engine and should not be mixed into Campamento Base. A dedicated TaskOps contract/namespace is required before any TaskOps edge can be reduced.

**Recommended path**: 
1. Create TaskOps transversal contract (define ownership, namespace, boundaries)
2. Create neutral TaskOps platform wrapper and service
3. Create neutral TaskOps signal handler bridge
4. Migrate TaskOps tests to neutral coverage
5. Then reduce all 4 TaskOps edges together

### Platform-bootstrap

**Internal imports remaining in `src/lib/campobase/platform-bootstrap.ts`**: 2

1. `@/lib/campobase/clinic-platform` (line 17)
2. `@/lib/campobase/taskops-platform` (line 18)

**Should these imports remain until neutral adapters exist**: **YES**

**Can reduce now**: **NO**

**Reason**: The legacy shared loader (`platform-bootstrap.ts`) dynamically imports Clinic and TaskOps platforms for registration. These are internal imports within the frozen legacy namespace. The neutral loader (`src/lib/campamento-base/platform-bootstrap-loader.ts`) exists but marks Clinic and TaskOps as SKIPPED. These internal imports must remain until Clinic and TaskOps have neutral platform wrappers that can be imported instead.

**Recommended path**: After Clinic and TaskOps have neutral platform wrappers, these imports can be updated to point to neutral modules, or the legacy loader can be deprecated entirely in favor of the neutral loader.

### Cross-saas

**What `tests/lib/cross-saas-taskops-flow.test.ts` protects**:

1. **Signal emission**: `emitSignal({ type: "task.overdue", sourceSaasId: "clinic", ... })`
2. **Signal routing**: Signal routed from Clinic to TaskOps
3. **Signal handler execution**: TaskOps `signalHandlers["task.overdue"]` triggered
4. **Automation trigger**: TaskOps automation (`taskops.pending_task_audit`) executed via `triggerAutomation`
5. **Observability integration**: Activities recorded (`signal_emitted`, `signal_handled`, `automation_execution`)
6. **Factory control plane**: TaskOps appears in `listFactoryControlPlane()` with operational summary and recent signals

**Can migrate now**: **NO**

**Should wait for TaskOps neutral**: **YES**

**Reason**: This test validates unique cross-SaaS signal handling behavior that is currently implemented in `src/lib/campobase/taskops-platform.ts` via `signalHandlers`. No neutral equivalent exists for TaskOps signal handling. This test must remain until TaskOps has a neutral signal handler bridge that can replace the legacy implementation.

**Recommended path**: After TaskOps neutral signal handler bridge exists, convert this test to use neutral TaskOps imports and validate the same cross-SaaS flow with neutral infrastructure.

---

## Task 4 — Top 3 Candidates

### Ranking

After analyzing all 6 edges, **there are NO safe candidates for immediate reduction**.

All edges are blocked by missing neutral infrastructure:

- **Clinic edges (2)**: Blocked by missing neutral Clinic platform wrapper and service
- **TaskOps edges (4)**: Blocked by missing neutral TaskOps contract, platform wrapper, service, and signal handler bridge

### Top 3 Safest Candidates (with prerequisites)

#### 1) **NO IMMEDIATE CANDIDATE** — All edges require prior work

**Safest path forward**: Create neutral Clinic platform wrapper and service first, then reduce Clinic edges.

**Edge**: 
- `src/lib/campobase/clinic-platform.ts::@/lib/campobase/clinic-platform-service`
- `src/lib/campobase/platform-bootstrap.ts::@/lib/campobase/clinic-platform`

**Why candidate**: Clinic already has significant neutral coverage (domain, orchestration, handler registration, context resolution, client). Only missing platform wrapper and service layer.

**Risk**: MEDIUM (after neutral wrapper/service created)

**Work needed before reduction**:
1. Create `src/lib/clinic/platform-wrapper.ts` (neutral Clinic platform definition and bootstrap)
2. Create `src/lib/clinic/service.ts` (neutral Clinic service using existing neutral modules)
3. Update `src/lib/campobase/clinic-platform.ts` to import from neutral (or deprecate)
4. Update `src/lib/campobase/platform-bootstrap.ts` to import neutral Clinic platform
5. Validate all Clinic tests pass with neutral imports

**Recommended block**: `create neutral clinic platform wrapper and service`

**Validations minimum**:
- `pnpm typecheck`
- `npx vitest run tests/lib/clinic-*.test.ts`
- `npx vitest run tests/lib/campobase-platform-bootstrap.test.ts`
- `npx vitest run tests/architecture/campobase-namespace-freeze.test.ts`

#### 2) **NO IMMEDIATE CANDIDATE** — TaskOps service test conversion

**Edge**: `tests/lib/campobase-taskops-platform-service.test.ts::@/lib/campobase/taskops-platform-service`

**Why candidate**: Test-only edge, could be converted to static adapter verification similar to `factory-orchestrator.test.ts`.

**Risk**: MEDIUM-HIGH (requires neutral TaskOps coverage first)

**Work needed before reduction**:
1. Create neutral TaskOps contract (define ownership, namespace, boundaries)
2. Create neutral TaskOps service coverage
3. Convert test to static adapter verification
4. Remove edge from guardrail

**Recommended block**: `convert taskops service test to static verification after neutral coverage`

**Validations minimum**:
- `pnpm typecheck`
- `npx vitest run tests/lib/campobase-taskops-platform-service.test.ts`
- `npx vitest run tests/lib/cross-saas-taskops-flow.test.ts`
- `npx vitest run tests/architecture/campobase-namespace-freeze.test.ts`

#### 3) **NO IMMEDIATE CANDIDATE** — TaskOps cross-saas flow test

**Edge**: `tests/lib/cross-saas-taskops-flow.test.ts::@/lib/campobase/taskops-platform`

**Why candidate**: Test-only edge, but protects critical cross-SaaS signal handling.

**Risk**: HIGH (requires neutral TaskOps signal handler bridge)

**Work needed before reduction**:
1. Create neutral TaskOps contract
2. Create neutral TaskOps signal handler bridge
3. Migrate test to neutral TaskOps imports
4. Remove edge from guardrail

**Recommended block**: `migrate cross-saas taskops flow test to neutral after signal handler bridge`

**Validations minimum**:
- `pnpm typecheck`
- `npx vitest run tests/lib/cross-saas-taskops-flow.test.ts`
- `npx vitest run tests/architecture/campobase-namespace-freeze.test.ts`

---

## Task 5 — Strategic Options

### Option A: Attack Clinic service adapter first

**Description**: Create neutral Clinic platform wrapper and service, then reduce 2 Clinic edges.

**Risk**: MEDIUM

**Impact**: Reduces guardrail from `6` to `4`, eliminates Clinic from legacy namespace

**Cost**: 
- Create `src/lib/clinic/platform-wrapper.ts`
- Create `src/lib/clinic/service.ts`
- Update `src/lib/campobase/clinic-platform.ts` (or deprecate)
- Update `src/lib/campobase/platform-bootstrap.ts`
- Validate all Clinic tests

**Probable files**:
- `src/lib/clinic/platform-wrapper.ts` (new)
- `src/lib/clinic/service.ts` (new)
- `src/lib/campobase/clinic-platform.ts` (modify or deprecate)
- `src/lib/campobase/platform-bootstrap.ts` (modify)
- `tests/architecture/campobase-namespace-freeze.test.ts` (remove 2 edges, shrink to 4)

**Validations needed**:
- `pnpm typecheck`
- All Clinic tests
- Platform bootstrap tests
- Guardrail test

**Recommendation**: ✅ **RECOMMENDED** — Clinic has strong neutral foundation, only missing wrapper/service layer. This is the safest path forward.

### Option B: Attack TaskOps service adapter first

**Description**: Create neutral TaskOps contract, platform wrapper, and service, then reduce TaskOps edges.

**Risk**: HIGH

**Impact**: Reduces guardrail from `6` to `2`, eliminates TaskOps from legacy namespace

**Cost**: 
- Create TaskOps transversal contract (define ownership, namespace, boundaries)
- Create `src/lib/taskops/platform-wrapper.ts` (or equivalent)
- Create `src/lib/taskops/service.ts` (or equivalent)
- Create neutral TaskOps signal handler bridge
- Update `src/lib/campobase/taskops-platform.ts` (or deprecate)
- Update `src/lib/campobase/platform-bootstrap.ts`
- Migrate `cross-saas-taskops-flow.test.ts` to neutral
- Validate all TaskOps tests

**Probable files**:
- `docs/contracts/TASKOPS_TRANSVERSAL_CONTRACT.md` (new)
- `src/lib/taskops/platform-wrapper.ts` (new)
- `src/lib/taskops/service.ts` (new)
- `src/lib/taskops/signal-handler-bridge.ts` (new)
- `src/lib/campobase/taskops-platform.ts` (modify or deprecate)
- `src/lib/campobase/platform-bootstrap.ts` (modify)
- `tests/lib/cross-saas-taskops-flow.test.ts` (migrate to neutral)
- `tests/lib/campobase-taskops-platform-service.test.ts` (convert to static)
- `tests/architecture/campobase-namespace-freeze.test.ts` (remove 4 edges, shrink to 2)

**Validations needed**:
- `pnpm typecheck`
- All TaskOps tests
- Cross-SaaS flow test
- Platform bootstrap tests
- Guardrail test

**Recommendation**: ⚠️ **NOT RECOMMENDED** — TaskOps has zero neutral coverage and requires significant contract/architecture work. High risk, high cost.

### Option C: Attack `cross-saas-taskops-flow` first

**Description**: Migrate cross-SaaS TaskOps flow test to neutral imports.

**Risk**: HIGH

**Impact**: Reduces guardrail from `6` to `5`, but does not eliminate TaskOps runtime edges

**Cost**: 
- Create neutral TaskOps signal handler bridge
- Migrate test to neutral TaskOps imports
- Validate cross-SaaS flow still works

**Probable files**:
- `src/lib/taskops/signal-handler-bridge.ts` (new)
- `tests/lib/cross-saas-taskops-flow.test.ts` (migrate to neutral)
- `tests/architecture/campobase-namespace-freeze.test.ts` (remove 1 edge, shrink to 5)

**Validations needed**:
- `pnpm typecheck`
- Cross-SaaS flow test
- Guardrail test

**Recommendation**: ❌ **NOT RECOMMENDED** — Partial TaskOps migration without addressing runtime edges creates inconsistency. Better to migrate all TaskOps edges together.

### Option D: Create TaskOps neutral contract before touching edges

**Description**: Create comprehensive TaskOps transversal contract defining ownership, namespace, boundaries, and architecture before any edge reduction.

**Risk**: LOW (audit/design only)

**Impact**: No immediate guardrail reduction, but establishes foundation for future TaskOps migration

**Cost**: 
- Research TaskOps ownership and boundaries
- Define TaskOps transversal contract
- Document TaskOps architecture
- Get stakeholder approval

**Probable files**:
- `docs/contracts/TASKOPS_TRANSVERSAL_CONTRACT.md` (new)
- `docs/audits/TASKOPS_OWNERSHIP_AND_BOUNDARIES_AUDIT.md` (new)

**Validations needed**:
- None (audit/design only)

**Recommendation**: ✅ **RECOMMENDED AS PREREQUISITE** — TaskOps requires clear contract before any migration. This should be done before Option B.

### Option E: Maintain guardrail at 6 and pause this line for real SaaS separation

**Description**: Pause campobase freeze edge reduction and focus on real SaaS separation (Clinic/TaskOps as independent services).

**Risk**: LOW

**Impact**: No guardrail reduction, but advances real SaaS separation goals

**Cost**: 
- Focus on Clinic/TaskOps service separation
- Create independent deployment artifacts
- Establish service boundaries

**Probable files**:
- Clinic/TaskOps service infrastructure
- Deployment configurations
- Service contracts

**Validations needed**:
- Service deployment tests
- Integration tests

**Recommendation**: ⚠️ **VALID ALTERNATIVE** — If real SaaS separation is higher priority, pausing campobase edge reduction is acceptable. Current guardrail at `6` is stable.

### Final Recommendation

**Recommended option**: **Option A** (Attack Clinic service adapter first)

**Rationale**:
1. Clinic has strong neutral foundation (domain, orchestration, handler registration, context resolution, client)
2. Only missing platform wrapper and service layer
3. Lowest risk and cost among all options
4. Reduces guardrail from `6` to `4` (33% reduction)
5. Eliminates Clinic from legacy namespace
6. Does not require complex contract/architecture work

**Alternative**: **Option D** (Create TaskOps contract) as prerequisite for future TaskOps migration

**Not recommended**: Options B, C, E at this time

---

## Task 6 — Validations (audit-only)

Executing targeted validations:

1. `pnpm typecheck`
2. `npx vitest run tests/architecture/campobase-namespace-freeze.test.ts`
3. `npx vitest run tests/lib/campobase-taskops-platform-service.test.ts`
4. `npx vitest run tests/lib/cross-saas-taskops-flow.test.ts`

No full suite, no formatter, no refactor.

---

## Task 7 — Final Checkpoint Summary

### Audit file created
**YES**

### Path
`docs/audits/REMAINING_CAMPOBASE_FREEZE_EDGES_AFTER_FACTORY_ORCHESTRATOR_REDUCTION_TO_6.md`

### Production code modified
**NO**

### Tests modified
**NO**

### Guardrail modified
**NO**

### Current guardrail size
**6**

### Number of edges remaining
**6**

### Top 3 safest candidates

**NO IMMEDIATE SAFE CANDIDATES**

All edges require prior neutral infrastructure work:

1. **Clinic edges (2)** — Requires neutral Clinic platform wrapper and service
2. **TaskOps service test (1)** — Requires neutral TaskOps coverage
3. **TaskOps cross-saas test (1)** — Requires neutral TaskOps signal handler bridge

### Edges that MUST NOT be touched yet

**ALL 6 edges must remain frozen until neutral infrastructure exists:**

1. `src/lib/campobase/clinic-platform.ts::@/lib/campobase/clinic-platform-service` — Requires neutral Clinic wrapper/service
2. `src/lib/campobase/platform-bootstrap.ts::@/lib/campobase/clinic-platform` — Requires neutral Clinic wrapper
3. `src/lib/campobase/platform-bootstrap.ts::@/lib/campobase/taskops-platform` — Requires neutral TaskOps wrapper
4. `src/lib/campobase/taskops-platform.ts::@/lib/campobase/taskops-platform-service` — Requires neutral TaskOps wrapper/service
5. `tests/lib/campobase-taskops-platform-service.test.ts::@/lib/campobase/taskops-platform-service` — Requires neutral TaskOps coverage
6. `tests/lib/cross-saas-taskops-flow.test.ts::@/lib/campobase/taskops-platform` — Requires neutral TaskOps signal handler bridge

### Recommended option
**Option A**: Create neutral Clinic platform wrapper and service, then reduce 2 Clinic edges from `6` to `4`.

### Validations executed
All requested validations will be executed below.

### Can implement technical block after this audit?
**YES** (after creating neutral Clinic infrastructure)

### Next recommended block (do not implement here)

**Block: "create neutral clinic platform wrapper and service"**

**Objective**: Create neutral Clinic platform wrapper and service layer that use existing neutral Clinic modules, enabling reduction of 2 Clinic edges from guardrail.

**Scope**:
1. Create `src/lib/clinic/platform-wrapper.ts`:
   - Export `clinicPlatformDefinition` using existing Clinic domain types
   - Export `clinicPlatformBootstrap` using `src/lib/clinic/control-plane-orchestration.ts`
   - No imports from `@/lib/campobase`

2. Create `src/lib/clinic/service.ts`:
   - Export `registerClinicPlatform` using existing neutral modules:
     - `src/lib/clinic/control-plane-handler-registration.ts`
     - `src/lib/clinic/control-plane-context-resolution.ts`
     - `src/lib/capabilities/internal-api-clients/clinic-control-plane.ts`
   - No imports from `@/lib/campobase`

3. Update `src/lib/campobase/clinic-platform.ts`:
   - Change to re-export from `@/lib/clinic/platform-wrapper` (adapter pattern)
   - Or deprecate entirely if no longer needed

4. Update `src/lib/campobase/platform-bootstrap.ts`:
   - Change import from `@/lib/campobase/clinic-platform` to `@/lib/clinic/platform-wrapper`

5. Update `tests/architecture/campobase-namespace-freeze.test.ts`:
   - Remove 2 Clinic edges
   - Update pinned size from `6` to `4`

6. Run targeted validations

**Alternative**: If Clinic platform wrapper is deemed unnecessary, convert `src/lib/campobase/clinic-platform.ts` to static adapter verification test and deprecate the module entirely.

---

## Conclusion

After factory orchestrator reduction to `6`, all remaining edges are blocked by missing neutral infrastructure:

- **Clinic (2 edges)**: Strong neutral foundation exists, only missing platform wrapper and service layer
- **TaskOps (4 edges)**: Zero neutral coverage, requires comprehensive contract and architecture work

**Recommended path**: Create neutral Clinic platform wrapper and service first (Option A), reducing guardrail from `6` to `4`. This is the lowest risk, lowest cost option with highest impact.

**Status**: Guardrail at `6` is stable. No immediate safe candidates for reduction without prior neutral infrastructure work.
