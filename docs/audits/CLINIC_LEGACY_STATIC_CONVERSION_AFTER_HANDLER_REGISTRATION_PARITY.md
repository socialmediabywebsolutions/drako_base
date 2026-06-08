# Clinic Legacy Static Conversion After Handler Registration Parity

## Scope

Audit-only checkpoint after adding non-legacy Clinic coverage for:

- appointment health domain calculation (`src/lib/clinic/appointment-health.ts`);
- control-plane/bootstrap orchestration planning (`src/lib/clinic/control-plane-orchestration.ts`);
- handler-registration parity and expected runtime effects modeling (`src/lib/clinic/control-plane-handler-registration.ts`).

Goal:

- assess whether `tests/lib/campobase-clinic-platform-service.test.ts` can now be converted to static adapter verification;
- assess whether `campobase-namespace-freeze` can now be reduced from `11` to `10`;
- do not modify product code, tests, imports, guardrail, or legacy runtime.

## Mandatory Canonical Rule Applied

- Clinic is an independent SaaS vertical.
- Clinic domain logic stays in `src/lib/clinic/`.
- Campamento Base orchestrates Clinic through neutral boundaries.
- `src/lib/capabilities/internal-api-clients/` is the neutral client boundary.
- Campobase remains frozen legacy compatibility.
- No new imports to `@/lib/campobase`.
- No new `campobase`-named files were created except this audit document of existing legacy state.

## Files Inspected

- `src/lib/campobase/clinic-platform-service.ts`
- `tests/lib/campobase-clinic-platform-service.test.ts`
- `src/lib/clinic/appointment-health.ts`
- `tests/lib/clinic-appointment-health.test.ts`
- `src/lib/clinic/control-plane-orchestration.ts`
- `tests/lib/clinic-control-plane-orchestration.test.ts`
- `src/lib/clinic/control-plane-handler-registration.ts`
- `tests/lib/clinic-control-plane-handler-registration.test.ts`
- `src/lib/capabilities/internal-api-clients/clinic-control-plane.ts`
- `tests/lib/clinic-control-plane-internal-client.test.ts`
- `tests/architecture/campobase-namespace-freeze.test.ts`

## Task 1 - Coverage Comparison (Current)

### `tests/lib/clinic-appointment-health.test.ts`

Current coverage:

- pure appointment-health metrics from appointment data;
- legacy-equivalent baseline metrics (`3/2/1`);
- config defaults (`lookaheadDays: 7`, `overdueFollowupHours: 24`);
- summary text parity;
- status filtering parity (`CANCELLED`, `NO_SHOW`, `DONE`);
- invalid/missing schedule handling;
- fallback schedule field (`followUpAt`) and status normalization.

Assessment:

- appointment health metrics/defaults/summary are strongly covered outside legacy.

### `tests/lib/clinic-control-plane-orchestration.test.ts`

Current coverage:

- pure bootstrap planning for:
  - automation registration decision;
  - WhatsApp provider readiness decision path;
  - WhatsApp integration creation decision;
  - primary WhatsApp identity impact;
  - integration states `PENDING`, `CONNECTED`, `MISSING`;
- identity validation (`tenantId`/`saasId` required);
- no frozen campobase imports and no `campobase` filename rule.

Assessment:

- non-legacy orchestration decisions are explicitly modeled and tested.

### `tests/lib/clinic-control-plane-handler-registration.test.ts`

Current coverage:

- pure handler-registration intent and expected effects modeling for:
  - `REGISTER_AUTOMATION_HANDLER`;
  - `ENSURE_WHATSAPP_PROVIDER`;
  - `REGISTER_AUTOMATION`;
  - `CREATE_WHATSAPP_INTEGRATION`;
- safe defaults when optional flags are omitted;
- identity validation (`tenantId`/`saasId` required);
- integration states `PENDING`, `CONNECTED`, `MISSING` in parity model;
- no frozen campobase imports and no `campobase` filename rule.

Assessment:

- expected runtime effects are now modeled outside legacy with deterministic parity plans.

### `tests/lib/clinic-control-plane-internal-client.test.ts`

Current coverage:

- neutral boundary has no legacy imports;
- automation registration semantics and default normalization (`7/24`);
- integration-state semantics (`PENDING`, `CONNECTED`, `MISSING`) and `hasPrimaryWhatsappIdentity`;
- health snapshot and appointment-health result representation;
- explicit neutral-backend-not-configured error path.

Assessment:

- neutral contract/state representation remains robust and aligned with ownership boundaries.

### `tests/lib/campobase-clinic-platform-service.test.ts` (legacy)

Still covers runtime behavior coupled to legacy module import:

- side effects against `automation-core` mocks:
  - `getAutomation`
  - `registerAutomation`
  - `registerAutomationHandler`
- side effects against `integration-core` mocks:
  - `getIntegrationConnection`
  - `connectIntegration`
- provider bootstrap call `ensureWhatsappIntegrationAvailable`;
- runtime handler capture/registration/execution path via `registerAutomationHandler`;
- runtime context resolution invocation (`resolveAppointmentsContext` asserted);
- runtime appointment fetch path (`listAppointmentsForSaas` mocked and consumed by the registered handler).

### Coverage now duplicated / sufficiently equivalent outside legacy

- appointment health metrics and text output behavior;
- config defaults (`7/24`);
- Clinic bootstrap decisions;
- expected handler-registration/automation/integration effects (modeled parity);
- WhatsApp semantics for provider and integration states (`PENDING`/`CONNECTED`/`MISSING`), including primary identity influence.

### Coverage still only in legacy (or not fully equivalent outside legacy)

- direct runtime wiring to `automation-core` and `integration-core` side-effect calls;
- runtime module-load registration of automation handler through `registerAutomationHandler`;
- runtime context-resolution interaction path inside the executed handler (`resolveAppointmentsContext`);
- concrete runtime invocation sequence in `registerClinicPlatform`.

### Safety conclusion for static conversion now

- **Not fully safe yet** for strict zero-loss functional parity.
- Readiness improved materially, but one meaningful residual gap remains: real runtime adapter wiring and context-resolution path are still legacy-only.

## Task 2 - Risk Classification

- Risk to convert legacy test now: **medium**.
- Functional coverage loss if converted now: **yes (moderate but relevant)**.
- Coverage sufficiently outside legacy:
  - domain health metrics/defaults/summary;
  - orchestration/bootstrap decisions;
  - handler-registration and expected runtime-effects model;
  - neutral integration/automation state contract.
- Coverage still missing outside legacy:
  - real side-effect wiring validation against `automation-core`/`integration-core`;
  - runtime handler registration path validation at module runtime boundary;
  - context-resolution runtime parity (`resolveAppointmentsContext`) outside legacy.
- Additional test needed before conversion: **recommended yes** (context-resolution/wiring model or equivalent neutral adapter parity test).
- Guardrail reduction `11 -> 10` now: **not recommended yet**.

## Task 3 - Options

### Option A

Convert now `tests/lib/campobase-clinic-platform-service.test.ts` to static adapter verification and reduce guardrail `11 -> 10`.

- Risk: medium.
- Impact:
  - immediate guardrail shrink;
  - drops remaining legacy-only runtime wiring regression coverage.
- Future files to touch:
  - `tests/lib/campobase-clinic-platform-service.test.ts`
  - `tests/architecture/campobase-namespace-freeze.test.ts`
- Tests needed:
  - `pnpm typecheck`
  - `npx vitest run tests/lib/clinic-appointment-health.test.ts`
  - `npx vitest run tests/lib/clinic-control-plane-orchestration.test.ts`
  - `npx vitest run tests/lib/clinic-control-plane-handler-registration.test.ts`
  - `npx vitest run tests/lib/clinic-control-plane-internal-client.test.ts`
  - `npx vitest run tests/lib/campobase-clinic-platform-service.test.ts`
  - `npx vitest run tests/architecture/campobase-namespace-freeze.test.ts`
- Rollback:
  - restore legacy functional assertions and restore freeze edge/pin.
- Recommendation: not recommended now.

### Option B

Keep legacy functional test for one more block because runtime side effects still do not have full equivalent coverage.

- Risk: low/medium.
- Impact:
  - preserves strongest regression safety while finishing parity;
  - delays guardrail shrink by one more controlled block.
- Future files to touch:
  - add focused non-legacy parity test(s) under `tests/lib/` for runtime-context/wiring model;
  - optionally a small pure helper under `src/lib/clinic/` if needed.
- Tests needed:
  - all current Clinic focused tests;
  - existing legacy Clinic test;
  - freeze test + typecheck.
- Rollback:
  - revert only added non-legacy parity test/helper; keep legacy and freeze unchanged.
- Recommendation: **recommended immediate next step**.

### Option C

Create first an additional non-legacy context-resolution modeled test, without touching legacy.

- Risk: low.
- Impact:
  - directly targets the last known gap before static conversion;
  - creates clearer evidence for safe conversion decision.
- Future files to touch:
  - new test under `tests/lib/`;
  - optional pure planner/model helper under `src/lib/clinic/` if needed.
- Tests needed:
  - targeted new test + current Clinic focused set + freeze + typecheck.
- Rollback:
  - revert new context-resolution parity artifact(s) only.
- Recommendation: **strong companion to Option B**.

### Option D

Convert legacy to static adapter verification and rely on domain/orchestration/handler-registration/neutral-client coverage for functionality.

- Risk: medium.
- Impact:
  - architecture-cleaner test topology;
  - still leaves a blind spot on actual runtime wiring unless additional parity is added first.
- Future files to touch:
  - `tests/lib/campobase-clinic-platform-service.test.ts`
  - `tests/architecture/campobase-namespace-freeze.test.ts`
  - possibly an extra non-legacy parity file if conversion reveals gaps.
- Tests needed:
  - full focused Clinic set + freeze + typecheck.
- Rollback:
  - restore legacy functional assertions and re-add Clinic edge in freeze allowlist.
- Recommendation: viable only after Option B/C gap closure evidence.

### Final option recommendation

- Recommended path: **Option B now, with Option C-style targeted context-resolution parity coverage, then Option D conversion and guardrail shrink**.

## Task 4 - Guardrail

File inspected: `tests/architecture/campobase-namespace-freeze.test.ts`

- Pinned size actual: `11`.
- Current Clinic edge:
  - `tests/lib/campobase-clinic-platform-service.test.ts::@/lib/campobase/clinic-platform-service`
- Can this edge be removed now: **not recommended yet**.
- Expected pin if removed: `10`.
- Conditions to remove safely:
  - non-legacy parity covers remaining runtime wiring/context-resolution behavior sufficiently;
  - legacy Clinic test has been converted to static adapter verification (or replaced) without relevant functional blind spots;
  - edge removal and allowlist pin update happen together in one controlled shrink commit.

## Task 5 - Required Validations (Audit-only)

Executed exactly as requested:

- `pnpm typecheck` -> pass
- `npx vitest run tests/lib/clinic-appointment-health.test.ts` -> pass
- `npx vitest run tests/lib/clinic-control-plane-orchestration.test.ts` -> pass
- `npx vitest run tests/lib/clinic-control-plane-handler-registration.test.ts` -> pass
- `npx vitest run tests/lib/clinic-control-plane-internal-client.test.ts` -> pass
- `npx vitest run tests/lib/campobase-clinic-platform-service.test.ts` -> pass
- `npx vitest run tests/architecture/campobase-namespace-freeze.test.ts` -> pass

No full suite run, no formatter, no refactor.

## Task 6 - Final Decision

- Clinic reducible now (`11 -> 10`): **no**.
- Recommended option: **Option B now, with Option C-style gap closure, then Option D conversion/shrink**.
- Readiness status:
  - high progress with non-legacy domain + orchestration + handler-registration parity;
  - one relevant residual runtime-wiring/context-resolution gap remains legacy-only.

## Suggested Next Block (Do Not Implement Here)

`clinic non-legacy context-resolution and runtime-wiring parity coverage before clinic legacy static conversion and freeze shrink`

Intent:

- add one targeted non-legacy parity test/model for remaining runtime context-resolution and side-effect wiring expectations;
- re-audit conversion safety;
- then convert legacy Clinic test to static adapter verification and shrink guardrail from `11` to `10` in one controlled step.
