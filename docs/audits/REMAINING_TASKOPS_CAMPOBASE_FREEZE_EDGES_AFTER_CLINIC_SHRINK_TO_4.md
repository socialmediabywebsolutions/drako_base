# REMAINING TASKOPS CAMPOBASE FREEZE EDGES AFTER CLINIC SHRINK TO 4

## Scope

Audit-only checkpoint after Clinic neutralization and guardrail shrink to `4`.

Goal:

- inspect and classify the 4 remaining `@/lib/campobase` edges;
- assess TaskOps/cross-saas readiness for future reduction;
- propose safest next blocks;
- do not modify product code, tests, imports, or guardrail in this audit.

Canonical rule applied:

- Campamento Base is canonical as control-plane.
- TaskOps is a transversal engine/module, not a standard vertical SaaS.
- TaskOps must not be moved into Clinic or SocialFlow.
- Campobase remains frozen legacy compatibility.
- `src/lib/campobase/` remains temporary adapter surface only.
- No new imports to `@/lib/campobase`.
- No Clinic/SocialFlow/UI/API/migrations changes.

---

## Task 1 — Exact Inventory

### Guardrail current state

Source: `tests/architecture/campobase-namespace-freeze.test.ts`

- pinned size: `4`
- remaining allowed edges: `4`

### Exact remaining edges

1. `src/lib/campobase/platform-bootstrap.ts::@/lib/campobase/taskops-platform`
2. `src/lib/campobase/taskops-platform.ts::@/lib/campobase/taskops-platform-service`
3. `tests/lib/campobase-taskops-platform-service.test.ts::@/lib/campobase/taskops-platform-service`
4. `tests/lib/cross-saas-taskops-flow.test.ts::@/lib/campobase/taskops-platform`

### Edge buckets

- runtime src edges: `2` (1, 2)
- test-only edges: `2` (3, 4)
- cross-saas edge: `1` (4)

### Symbol/function each edge keeps alive and behavior protected

- Edge 1 keeps TaskOps platform registration path in legacy `platform-bootstrap`.
  - protects dynamic import wiring for `taskOpsPlatformDefinition` + `taskOpsPlatformBootstrap`.
- Edge 2 keeps TaskOps platform wrapper coupled to legacy TaskOps service.
  - protects `taskOpsPlatformBootstrap.connect` behavior and `task.overdue` signal handler wiring.
- Edge 3 keeps runtime service-level behavior test over legacy TaskOps service.
  - protects automation registration, WhatsApp integration bootstrap, and pending-task audit metrics.
- Edge 4 keeps cross-saas execution-layer behavior test over legacy TaskOps platform.
  - protects `task.overdue` signal emission/routing/handling, automation trigger, observability trail, and control-plane exposure.

---

## Task 2 — TaskOps Diagnosis (Current)

### `src/lib/campobase/taskops-platform.ts` exports

- `TASKOPS_PLATFORM_SAAS_ID`
- `taskOpsPlatformDefinition`
- `taskOpsPlatformBootstrap`

Notable behavior:

- defines TaskOps metadata in `saas-contract`;
- bootstrap `connect` delegates to `registerTaskOpsPlatform` from legacy service;
- defines signal handler `task.overdue` that calls `triggerAutomation` with `taskops.pending_task_audit`.

### `src/lib/campobase/taskops-platform-service.ts` exports

- `TASKOPS_PENDING_TASK_AUDIT_KEY`
- `registerTaskOpsPlatform`

Notable behavior:

- registers automation handler on module load;
- computes pending/overdue/critical task metrics;
- ensures WhatsApp provider;
- conditionally registers automation + integration.

### What `src/lib/campobase/platform-bootstrap.ts` uses from TaskOps

In `ensureDefaultPlatformDefinitionsRegistered()`:

- dynamic import: `import("@/lib/campobase/taskops-platform")`
- registers:
  - `taskOpsModule.taskOpsPlatformDefinition`
  - `taskOpsModule.taskOpsPlatformBootstrap`

### What `tests/lib/campobase-taskops-platform-service.test.ts` covers

- runtime bootstrap behavior of legacy TaskOps service with mocks;
- automation registration and WhatsApp connection;
- execution of pending-task audit handler with deterministic metrics assertions.

### What `tests/lib/cross-saas-taskops-flow.test.ts` covers

- registers legacy TaskOps definition/bootstrap into `saas-contract`;
- emits `task.overdue` signal;
- verifies TaskOps signal handling triggers automation execution;
- verifies observability activities (`signal_emitted`, `signal_handled`, `automation_execution`);
- verifies control-plane listing includes healthy TaskOps and recent signal.

### Neutral TaskOps status

- `src/lib/taskops/` namespace exists today: **NO** (directory does not exist).
- Neutral TaskOps runtime module in `src/lib/campamento-base/`: **NO**.
  - only neutral loader status exists in `src/lib/campamento-base/platform-bootstrap-loader.ts` (`taskops` = `SKIPPED`).
- Neutral TaskOps contract exists: **YES** (draft)
  - `docs/contracts/campamento-base-taskops-orchestration-contract-v1.md`.
- Neutral TaskOps signal-handler bridge exists: **NO**.
- Runtime-equivalent non-legacy TaskOps coverage exists: **NO**.

---

## Task 3 — Edge-by-edge Classification

### Edge 1

- file origin: `src/lib/campobase/platform-bootstrap.ts`
- import destination: `@/lib/campobase/taskops-platform`
- category: runtime src / platform-bootstrap internal
- risk: **high**
- neutral equivalent existing:
  - partial only: `src/lib/campamento-base/platform-bootstrap-loader.ts` with `taskops` as `SKIPPED`
- neutral equivalent missing:
  - neutral TaskOps platform wrapper/bootstrap
- can reduce now: **no**
- mandatory prerequisite:
  - neutral TaskOps platform bootstrap boundary available for runtime registration
- recommended action:
  - keep frozen; migrate only after neutral TaskOps wrapper/bridge exists

### Edge 2

- file origin: `src/lib/campobase/taskops-platform.ts`
- import destination: `@/lib/campobase/taskops-platform-service`
- category: runtime src / adapter interno
- risk: **high**
- neutral equivalent existing: none
- neutral equivalent missing:
  - neutral TaskOps wrapper (`definition` + `bootstrap`)
  - neutral TaskOps service
  - neutral signal handler bridge for `task.overdue`
- can reduce now: **no**
- mandatory prerequisite:
  - neutral runtime-equivalent TaskOps layer (service + signal bridge)
- recommended action:
  - keep frozen; treat as core runtime blocker

### Edge 3

- file origin: `tests/lib/campobase-taskops-platform-service.test.ts`
- import destination: `@/lib/campobase/taskops-platform-service`
- category: test funcional
- risk: **medium-high**
- neutral equivalent existing: none
- neutral equivalent missing:
  - neutral TaskOps service test suite with equivalent runtime assertions
- can reduce now: **no**
- mandatory prerequisite:
  - runtime-equivalent neutral TaskOps coverage first
- recommended action:
  - keep as functional legacy test; do not convert to static adapter yet

### Edge 4

- file origin: `tests/lib/cross-saas-taskops-flow.test.ts`
- import destination: `@/lib/campobase/taskops-platform`
- category: test funcional / cross-saas flow
- risk: **high**
- neutral equivalent existing: none
- neutral equivalent missing:
  - neutral TaskOps signal-handler bridge
  - neutral cross-saas flow equivalent coverage
- can reduce now: **no**
- mandatory prerequisite:
  - proven neutral bridge preserving `task.overdue` execution semantics
- recommended action:
  - keep frozen; treat as last edge to move unless bridge is created first with parity tests

---

## Task 4 — Strategic Options

### Option A
Create neutral TaskOps contract before touching any edge.

- risk: low
- impact: medium (enables structured migration, no immediate shrink)
- cost: low-medium
- probable files:
  - `docs/contracts/campamento-base-taskops-orchestration-contract-v1.md` (update/ratify)
  - optional new audit/decision doc
- tests needed:
  - none mandatory for contract-only, plus freeze sanity if desired
- rollback:
  - trivial (doc revert)
- recommendation:
  - **recommended first** as governance prerequisite

### Option B
Create `src/lib/taskops/platform-wrapper.ts` and `src/lib/taskops/service.ts` directly.

- risk: high
- impact: high (could unlock runtime edges)
- cost: high
- probable files:
  - `src/lib/taskops/platform-wrapper.ts`
  - `src/lib/taskops/service.ts`
  - `src/lib/taskops/signal-handler-bridge.ts` (likely required)
  - legacy adapters + bootstrap wiring + freeze updates
- tests needed:
  - new TaskOps neutral runtime tests
  - cross-saas flow regression
  - bootstrap static/behavior checks
  - freeze
- rollback:
  - moderate/hard (multiple runtime touchpoints)
- recommendation:
  - not first step; only after contract + parity plan

### Option C
Convert first `tests/lib/campobase-taskops-platform-service.test.ts` to static verification.

- risk: high (coverage loss)
- impact: low (could reduce 1 test edge only)
- cost: low
- probable files:
  - `tests/lib/campobase-taskops-platform-service.test.ts`
  - freeze test
- tests needed:
  - replacement neutral runtime-equivalent test first
- rollback:
  - simple
- recommendation:
  - not recommended now

### Option D
Migrate first `tests/lib/cross-saas-taskops-flow.test.ts` to neutral bridge.

- risk: high
- impact: medium-high (cross-saas path is critical)
- cost: high
- probable files:
  - neutral TaskOps bridge + test rewiring
  - likely platform wrapper adjustments
- tests needed:
  - cross-saas parity test
  - service/runtime parity
  - freeze
- rollback:
  - moderate
- recommendation:
  - not first; only after bridge contract and runtime parity scaffolding

### Option E
Pause guardrail reduction and return to broader SaaS/product separation.

- risk: low immediate
- impact: none on freeze now
- cost: low immediate / medium strategic delay
- probable files:
  - none for freeze line
- tests needed:
  - none specific
- rollback:
  - n/a
- recommendation:
  - valid fallback, but not optimal if objective is continuing controlled shrink

### Strategic recommendation

- preferred path: **Option A first**, then incremental technical preparation toward Option B.

---

## Task 5 — Recommended Route

### First technical block recommended

`ratify taskops neutral orchestration contract and define runtime-parity plan`

### Should it be audit/contract before code?

- **yes**

### Should neutral TaskOps contract be created first?

- **yes** (already draft exists; promote/ratify and pin implementation scope)

### Should runtime-equivalent TaskOps be created first?

- **yes, before reducing any edge**
- specifically for service behavior and `task.overdue` bridge semantics

### Which edge could drop first (safest)

- after parity exists, safest first drop is usually test edge #3 (`campobase-taskops-platform-service.test.ts`) via replacement coverage
- however if cross-saas parity is ready first, edge #4 could move first
- today: **none can safely drop**

### Expected sizes by future reductions

- current: `4`
- remove one edge: `3`
- remove two edges: `2`
- remove three edges: `1`
- remove all TaskOps edges: `0`

### What should not be touched yet

- `src/lib/campobase/taskops-platform.ts`
- `src/lib/campobase/taskops-platform-service.ts`
- `src/lib/campobase/platform-bootstrap.ts` TaskOps path
- `tests/lib/cross-saas-taskops-flow.test.ts` (until neutral bridge parity exists)

---

## Task 6 — Guardrail Analysis

Source: `tests/architecture/campobase-namespace-freeze.test.ts`

- size pinned current: `4`
- TaskOps edges current: `4` (all remaining edges)

### Remove together or in stages?

- technically both possible
- recommended: staged, with runtime parity before each drop

### Size projections

- remove only one test edge: `4 -> 3`
- remove only one runtime edge: `4 -> 3`
- remove all TaskOps edges: `4 -> 0`

### Conditions to reduce below `4`

1. neutral TaskOps contract ratified and implementation scope fixed;
2. neutral runtime-equivalent TaskOps service coverage exists;
3. neutral signal-handler bridge for `task.overdue` exists and parity-tested;
4. bootstrap wiring has neutral TaskOps replacement for definition/bootstrap;
5. freeze tests remain strict (no allowlist growth).

---

## Task 7 — Validations (audit-only)

Executed:

1. `pnpm typecheck` → **PASS**
2. `npx vitest run tests/architecture/campobase-namespace-freeze.test.ts` → **PASS** (`2/2`)
3. `npx vitest run tests/lib/campobase-taskops-platform-service.test.ts` → **PASS** (`2/2`)
4. `npx vitest run tests/lib/cross-saas-taskops-flow.test.ts` → **PASS** (`1/1`)
5. `npx vitest run tests/lib/campobase-platform-bootstrap.test.ts` → **PASS** (`5/5`)

No full suite, no formatter, no refactor.

---

## Task 8 — Final Checkpoint Summary

- file created: **YES**
- path: `docs/audits/REMAINING_TASKOPS_CAMPOBASE_FREEZE_EDGES_AFTER_CLINIC_SHRINK_TO_4.md`
- production code modified: **NO**
- tests modified: **NO**
- guardrail modified: **NO**
- current guardrail size: `4`
- remaining edges: `4`
- recommended option: **Option A** (contract-first)
- first technical block recommended: `ratify taskops neutral orchestration contract and define runtime-parity plan`
- can implement technical block after this audit: **YES**
- validations executed: **ALL PASS**

Next recommended block (not implemented):

`design and add taskops neutral runtime-parity module + tests (without touching legacy runtime wiring yet)`
