# CLINIC PLATFORM WRAPPER SERVICE IMPLEMENTATION READINESS BEFORE SHRINK 6 TO 4

## Scope

Audit-only checkpoint before implementing Clinic neutral wrapper/service and shrinking guardrail from `6` to `4`.

Goal:

- define exactly how to replace Clinic legacy dependencies in:
  - `src/lib/campobase/clinic-platform.ts`
  - `src/lib/campobase/platform-bootstrap.ts`
- preserve behavior;
- avoid touching TaskOps/SocialFlow;
- avoid touching runtime behavior in this block.

Rules applied:

- Clinic remains an independent SaaS vertical.
- Clinic domain logic belongs in `src/lib/clinic/`.
- Campamento Base remains control-plane only.
- Campobase remains frozen legacy compatibility.
- No new imports to `@/lib/campobase`.
- No TaskOps scope changes.

---

## Task 1 — Current Clinic Inventory

### 1) `src/lib/campobase/clinic-platform.ts` currently exports

- `CLINIC_PLATFORM_SAAS_ID = "clinic"`
- `clinicPlatformDefinition` (SaaS metadata, automation key, WhatsApp integration metadata, `matchesSaasId` logic)
- `clinicPlatformBootstrap` with `connect({ tenantId, saasId })` delegating to `bootstrapClinicPlatform`

Current legacy dependency:

- `@/lib/campobase/clinic-platform-service` (`CLINIC_DAILY_APPOINTMENT_HEALTH_KEY`, `registerClinicPlatform`)

### 2) `src/lib/campobase/clinic-platform-service.ts` currently exports

- `CLINIC_DAILY_APPOINTMENT_HEALTH_KEY = "clinic.daily_appointment_health"`
- `registerClinicPlatform(tenantId, saasId)`
- side effect at module load: `registerAutomationHandler(CLINIC_DAILY_APPOINTMENT_HEALTH_KEY, ...)`

Runtime behavior inside service:

- normalizes config (`lookaheadDays`, `overdueFollowupHours`) with defaults `7` and `24`;
- computes metrics (`upcomingAppointments`, `unconfirmedAppointments`, `overdueFollowups`) from appointments;
- ensures WhatsApp provider availability;
- conditionally registers automation if missing;
- conditionally creates WhatsApp integration if missing;
- integration status derives from primary identity (`CONNECTED` vs `PENDING`).

### 3) What `src/lib/campobase/platform-bootstrap.ts` uses from Clinic

In `ensureDefaultPlatformDefinitionsRegistered()`:

- dynamic import: `import("@/lib/campobase/clinic-platform")`
- registers:
  - `clinicModule.clinicPlatformDefinition`
  - `clinicModule.clinicPlatformBootstrap`

So bootstrap depends on Clinic symbols exported by the legacy Clinic platform module.

### 4) Legacy imports that exist today (Clinic scope)

- `src/lib/campobase/clinic-platform.ts::@/lib/campobase/clinic-platform-service`
- `src/lib/campobase/platform-bootstrap.ts::@/lib/campobase/clinic-platform`

### 5) Behavior that must be preserved

- `clinicPlatformDefinition` structure and `matchesSaasId` semantics.
- automation key stability: `clinic.daily_appointment_health`.
- bootstrap `connect` path semantics.
- appointment-health summary/metrics semantics.
- WhatsApp provider/integration flow and status semantics.
- idempotency behavior: do not re-register automation/integration when present.

### 6) Tests covering Clinic neutral behavior

- `tests/lib/clinic-appointment-health.test.ts`
- `tests/lib/clinic-control-plane-orchestration.test.ts`
- `tests/lib/clinic-control-plane-handler-registration.test.ts`
- `tests/lib/clinic-control-plane-context-resolution.test.ts`
- `tests/lib/clinic-control-plane-internal-client.test.ts`

### 7) Tests covering Clinic legacy/adapter behavior

- `tests/lib/campobase-clinic-platform-service.test.ts` (static adapter verification markers)
- `tests/lib/campobase-platform-bootstrap.test.ts` (static legacy adapter signals + neutral loader smoke)

---

## Task 2 — Mapping Legacy Symbols to Neutral Equivalents

| Legacy symbol / concern | Legacy location | Neutral equivalent today | Neutral module | Covered by test | Gap |
|---|---|---|---|---|---|
| `clinicPlatformDefinition` | `src/lib/campobase/clinic-platform.ts` | Partial equivalent fields available, but no neutral exported platform definition object | (missing wrapper) | No direct neutral wrapper test | Need `src/lib/clinic/platform-wrapper.ts` |
| `clinicPlatformBootstrap` | `src/lib/campobase/clinic-platform.ts` | Partial planning/context pieces exist, but no neutral exported bootstrap object | (missing wrapper) | No direct neutral wrapper test | Need `src/lib/clinic/platform-wrapper.ts` |
| `registerClinicPlatform` (runtime bootstrap service) | `src/lib/campobase/clinic-platform-service.ts` | Behavior components exist across neutral modules | `src/lib/clinic/control-plane-*`, `src/lib/capabilities/internal-api-clients/clinic-control-plane.ts` | Yes (module-level tests) | Need composed `src/lib/clinic/service.ts` |
| Appointment health calculation | `clinic-platform-service.ts` inline handler logic | Equivalent and extracted | `src/lib/clinic/appointment-health.ts` | Yes | No functional gap |
| Bootstrap/orchestration decision model | legacy service flow | Equivalent planning model | `src/lib/clinic/control-plane-orchestration.ts` | Yes | No planning gap |
| Handler registration planning | legacy handler + registration sequence | Equivalent planning model | `src/lib/clinic/control-plane-handler-registration.ts` | Yes | No planning gap |
| Context resolution + output shaping | mixed legacy service concerns | Equivalent helpers | `src/lib/clinic/control-plane-context-resolution.ts` | Yes | No helper gap |
| Neutral internal client boundary | not present in legacy | Exists | `src/lib/capabilities/internal-api-clients/clinic-control-plane.ts` | Yes | No boundary gap |
| WhatsApp provider/integration state modeling | in legacy runtime code | Equivalent state model | internal client + orchestration planners | Yes | Runtime composition gap only |
| Automation registration semantics | in legacy runtime code | Equivalent registration model | internal client + handler registration planner | Yes | Runtime composition gap only |
| Expected side effects ordering/signals | implicit in legacy runtime path | Explicit in planning modules | orchestration/handler-registration planners | Yes | Runtime composer missing |

### Key readiness conclusion

Neutral Clinic primitives already exist and are tested. Missing pieces are **composition artifacts**:

1. neutral platform wrapper (`clinicPlatformDefinition` + `clinicPlatformBootstrap` export);
2. neutral service composition (`registerClinicPlatform` implementation using neutral modules).

---

## Task 3 — Recommended Design Options

### Option A (full recommended path)

Create:

- `src/lib/clinic/platform-wrapper.ts`
- `src/lib/clinic/service.ts`

Then in next technical block:

- convert `src/lib/campobase/clinic-platform.ts` into temporary adapter toward `@/lib/clinic/platform-wrapper`;
- update `src/lib/campobase/platform-bootstrap.ts` to import Clinic from `@/lib/clinic/platform-wrapper`;
- shrink guardrail `6 -> 4` removing both Clinic edges.

**Risk**: Medium

**Impact**: High (removes both Clinic legacy edges, keeps TaskOps untouched)

**Files to create**:

- `src/lib/clinic/platform-wrapper.ts`
- `src/lib/clinic/service.ts`

**Files to modify**:

- `src/lib/campobase/clinic-platform.ts`
- `src/lib/campobase/platform-bootstrap.ts`
- `tests/architecture/campobase-namespace-freeze.test.ts`

**Tests needed in implementation block**:

- existing neutral Clinic tests (5 files listed above)
- `tests/lib/campobase-clinic-platform-service.test.ts`
- `tests/lib/campobase-platform-bootstrap.test.ts`
- `tests/architecture/campobase-namespace-freeze.test.ts`

**Rollback**:

- restore 3 modified files and guardrail size/import edges to current values.

**Recommendation**: **Recommended**.

---

### Option B (wrapper only, keep legacy service)

Create only `src/lib/clinic/platform-wrapper.ts`; keep legacy service in place.

**Risk**: Medium-High

**Impact**: Partial only; edge `clinic-platform -> clinic-platform-service` remains if wrapper still consumes legacy service.

**Files to create**:

- `src/lib/clinic/platform-wrapper.ts`

**Files to modify**:

- likely `src/lib/campobase/platform-bootstrap.ts` only

**Tests needed**:

- bootstrap + freeze + neutral clinic tests.

**Rollback**: simple.

**Recommendation**: **Not preferred**. Leaves coupling unresolved and may only enable `6 -> 5`.

---

### Option C (static adapter conversion without touching platform-bootstrap)

Convert `src/lib/campobase/clinic-platform.ts` strategy without changing bootstrap path.

**Risk**: High

**Impact**: Very limited. `platform-bootstrap -> campobase/clinic-platform` edge still blocks full Clinic removal.

**Files to create/modify**: mostly adapters/tests.

**Tests needed**: broad regression checks for bootstrap behavior.

**Rollback**: moderate.

**Recommendation**: **Not recommended**. Produces low value and fragmented migration.

---

### Option D (defer Clinic; do TaskOps contract first)

**Risk**: Low (for Clinic path), but no Clinic progress.

**Impact**: none on Clinic edges now.

**Files**: TaskOps docs/contracts only.

**Tests**: none/minimal.

**Rollback**: trivial.

**Recommendation**: valid only if priorities change; not aligned with current target (`6 -> 4` via Clinic).

---

### Final design recommendation

Use **Option A** in the next technical block.

Reason:

- aligns with canonical rule (Clinic logic in `src/lib/clinic`);
- removes both Clinic edges coherently;
- preserves behavior by composing already-tested neutral modules.

---

## Task 4 — Guardrail Analysis

Source: `tests/architecture/campobase-namespace-freeze.test.ts`

- **Current pinned size**: `6`
- **Current Clinic edges**:
  1. `src/lib/campobase/clinic-platform.ts::@/lib/campobase/clinic-platform-service`
  2. `src/lib/campobase/platform-bootstrap.ts::@/lib/campobase/clinic-platform`

### Can they be removed together?

- **Yes** (preferred), if Option A implementation is completed and behavior preserved.

### Can they be removed separately?

- **Technically yes**, but not recommended.
- If only one is removed, system remains partially coupled and migration intent is diluted.

### Pinned size projections

- remove only one Clinic edge: `6 -> 5`
- remove both Clinic edges: `6 -> 4`

### Conditions required for `6 -> 4`

1. neutral `clinicPlatformDefinition` and `clinicPlatformBootstrap` exported from new wrapper;
2. neutral `registerClinicPlatform` composition available in new service;
3. `src/lib/campobase/clinic-platform.ts` no longer imports `@/lib/campobase/clinic-platform-service`;
4. `src/lib/campobase/platform-bootstrap.ts` no longer imports `@/lib/campobase/clinic-platform`;
5. all targeted Clinic/bootstrap/freeze tests pass.

---

## Task 5 — Validations (audit-only)

Requested commands to execute:

1. `pnpm typecheck`
2. `npx vitest run tests/architecture/campobase-namespace-freeze.test.ts`
3. `npx vitest run tests/lib/clinic-appointment-health.test.ts`
4. `npx vitest run tests/lib/clinic-control-plane-orchestration.test.ts`
5. `npx vitest run tests/lib/clinic-control-plane-handler-registration.test.ts`
6. `npx vitest run tests/lib/clinic-control-plane-context-resolution.test.ts`
7. `npx vitest run tests/lib/clinic-control-plane-internal-client.test.ts`
8. `npx vitest run tests/lib/campobase-clinic-platform-service.test.ts`
9. `npx vitest run tests/lib/campobase-platform-bootstrap.test.ts`

---

## Task 6 — Final checkpoint summary

- file created: **YES**
- production code modified: **NO**
- tests modified: **NO**
- guardrail modified: **NO**
- recommended option: **Option A**
- can implement technical block after this audit: **YES**
- current guardrail size: `6`
- expected size removing one Clinic edge: `5`
- expected size removing both Clinic edges: `4`

---

## Implementation blueprint for next block (reference only)

1. Add `src/lib/clinic/platform-wrapper.ts` exporting neutral `clinicPlatformDefinition` + `clinicPlatformBootstrap`.
2. Add `src/lib/clinic/service.ts` composing:
   - `planClinicControlPlaneBootstrap`
   - `planClinicControlPlaneHandlerRegistration`
   - `resolveClinicControlPlaneHandlerOutput`
   - internal client calls (`registerClinicControlPlaneAutomation`, `ensureClinicControlPlaneIntegration`, etc.)
3. Update legacy adapter `src/lib/campobase/clinic-platform.ts` to delegate to neutral wrapper.
4. Update `src/lib/campobase/platform-bootstrap.ts` Clinic import to neutral wrapper.
5. Remove both Clinic edges in freeze allowlist; pin `6 -> 4`.
6. Run targeted validations.

Conclusion: Clinic wrapper/service implementation is **ready to design and implement** with manageable risk, while TaskOps remains out of scope and should remain untouched.
