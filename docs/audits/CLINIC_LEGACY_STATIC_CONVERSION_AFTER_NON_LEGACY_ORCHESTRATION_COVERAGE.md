# Clinic Legacy Static Conversion After Non-Legacy Orchestration Coverage

## Scope

Audit-only checkpoint after adding non-legacy Clinic coverage for:

- appointment health domain calculation (`src/lib/clinic/appointment-health.ts`);
- control-plane/bootstrap orchestration planning (`src/lib/clinic/control-plane-orchestration.ts`).

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

## Files Inspected

- `src/lib/campobase/clinic-platform-service.ts`
- `tests/lib/campobase-clinic-platform-service.test.ts`
- `src/lib/clinic/appointment-health.ts`
- `tests/lib/clinic-appointment-health.test.ts`
- `src/lib/clinic/control-plane-orchestration.ts`
- `tests/lib/clinic-control-plane-orchestration.test.ts`
- `src/lib/capabilities/internal-api-clients/clinic-control-plane.ts`
- `tests/lib/clinic-control-plane-internal-client.test.ts`
- `docs/audits/CLINIC_LEGACY_STATIC_CONVERSION_AFTER_DOMAIN_HEALTH_EXTRACTION.md`
- `tests/architecture/campobase-namespace-freeze.test.ts`

## Task 1 - Coverage Comparison (Current)

### `tests/lib/clinic-appointment-health.test.ts`

Current coverage:

- pure metrics calculation from appointment data;
- legacy-equivalent metrics baseline (`3/2/1`);
- defaults (`lookaheadDays: 7`, `overdueFollowupHours: 24`);
- summary/output text parity;
- status exclusion (`CANCELLED`, `NO_SHOW`, `DONE`);
- invalid/missing schedule handling.

Assessment:

- appointment health metrics, defaults, and summary/output are now strongly covered outside legacy.

### `tests/lib/clinic-control-plane-orchestration.test.ts`

Current coverage:

- pure bootstrap planning for:
  - automation registration decision;
  - WhatsApp provider readiness handling;
  - integration creation decision;
  - primary identity impact;
  - resulting states `PENDING`, `CONNECTED`, `MISSING`;
- identity validation (`tenantId`/`saasId` required);
- no campobase imports / no campobase filename rule.

Assessment:

- non-legacy orchestration decision logic is now explicitly modeled and tested.

### `tests/lib/clinic-control-plane-internal-client.test.ts`

Current coverage:

- neutral boundary has no legacy imports;
- automation registration semantics + default normalization (`7/24`);
- integration state modeling (`PENDING`, `CONNECTED`, `MISSING`) + `hasPrimaryWhatsappIdentity`;
- health snapshot and appointment-health result representation;
- explicit not-configured neutral backend error path.

Assessment:

- neutral contract/state representation is robust and aligned with ownership rules.

### `tests/lib/campobase-clinic-platform-service.test.ts` (legacy)

Still covers runtime behavior coupled to legacy module import:

- side effects against `automation-core` mocks:
  - `getAutomation`
  - `registerAutomation`
  - `registerAutomationHandler`
- side effects against `integration-core` mocks:
  - `getIntegrationConnection`
  - `connectIntegration`
- WhatsApp provider bootstrap call (`ensureWhatsappIntegrationAvailable`);
- handler registration/capture/execution path via `registerAutomationHandler`;
- runtime context resolution invocation (`resolveAppointmentsContext` asserted);
- integration bootstrap call path through legacy runtime function.

### Coverage now duplicated / sufficiently equivalent outside legacy

- appointment health metrics;
- config defaults (`7/24`);
- summary/output expectations for health audit;
- control-plane-level bootstrap decisions;
- WhatsApp state semantics (`PENDING/CONNECTED/MISSING`) and primary identity modeling.

### Coverage still only in legacy (or not equivalent outside legacy)

- runtime side effects wiring against `automation-core`/`integration-core`;
- registration/execution path of handler created through `registerAutomationHandler`;
- runtime context-resolution interaction path inside legacy runtime;
- concrete runtime bootstrap invocation sequence in `registerClinicPlatform`.

### Safety conclusion for static conversion now

- **Not fully safe yet** for zero-loss conversion.
- Coverage gap is now narrow but still meaningful: runtime orchestration side-effect path remains legacy-only.

## Task 2 - Risk Classification

- Risk to convert legacy test now: **medium**.
- Functional coverage loss if converted now: **yes (relevant)**.
- Coverage sufficiently outside legacy:
  - domain metrics/defaults/summary;
  - orchestration decision model;
  - neutral client registration/integration state contract.
- Coverage still missing outside legacy:
  - runtime side-effect parity with `automation-core` + `integration-core`;
  - handler-registration runtime path parity;
  - runtime context-resolution path parity.
- Additional test needed before conversion: **yes, recommended**.
- Guardrail reduction `11 -> 10` now: **not recommended yet**.

## Task 3 - Options

### Option A
Convert now `tests/lib/campobase-clinic-platform-service.test.ts` to static adapter verification and reduce guardrail `11 -> 10`.

- Risk: medium.
- Impact:
  - immediate edge shrink;
  - loses legacy runtime-side-effect regression coverage.
- Future files to touch:
  - `tests/lib/campobase-clinic-platform-service.test.ts`
  - `tests/architecture/campobase-namespace-freeze.test.ts`
- Tests needed:
  - `pnpm typecheck`
  - `npx vitest run tests/lib/campobase-clinic-platform-service.test.ts`
  - `npx vitest run tests/lib/clinic-appointment-health.test.ts`
  - `npx vitest run tests/lib/clinic-control-plane-orchestration.test.ts`
  - `npx vitest run tests/lib/clinic-control-plane-internal-client.test.ts`
  - `npx vitest run tests/architecture/campobase-namespace-freeze.test.ts`
- Rollback:
  - restore legacy functional test and guardrail edge/pin.
- Recommendation: not recommended now.

### Option B
Keep legacy functional test for one more block and add a non-legacy handler-registration parity test.

- Risk: low/medium.
- Impact:
  - closes the remaining runtime-orchestration parity gap before removing legacy edge;
  - preserves current safety net during transition.
- Future files to touch (example shape):
  - new non-legacy Clinic orchestration parity test file under `tests/lib/` (no campobase naming);
  - optionally a small pure helper in `src/lib/clinic/` if needed to model handler registration intent.
- Tests needed:
  - new parity test + existing Clinic domain/orchestration/neutral tests;
  - existing legacy Clinic test;
  - freeze test + typecheck.
- Rollback:
  - revert new non-legacy parity test/helper only; legacy and guardrail remain intact.
- Recommendation: **recommended next step**.

### Option C
Keep legacy functional test and move first to TaskOps neutral.

- Risk: low (Clinic immediate stability), medium (Clinic migration delay).
- Impact:
  - no Clinic guardrail progress now;
  - shifts effort to another domain.
- Future files to touch:
  - TaskOps neutral boundary/tests (separate block).
- Tests needed:
  - TaskOps focused set + freeze + typecheck.
- Rollback:
  - revert TaskOps block.
- Recommendation: valid sequencing alternative if Clinic is deprioritized.

### Option D
Split migration:

- convert legacy test only when non-legacy coverage is sufficient;
- keep/retire functional portions based on equivalence;
- reduce guardrail only after legacy import removal.

- Risk: low/medium.
- Impact:
  - controlled, phase-safe shrink;
  - preserves migration confidence.
- Future files to touch:
  - phase 1: non-legacy parity coverage additions in `src/lib/clinic/` + `tests/lib/`;
  - phase 2: `tests/lib/campobase-clinic-platform-service.test.ts` conversion;
  - phase 3: `tests/architecture/campobase-namespace-freeze.test.ts` edge removal and pin to `10`.
- Tests needed:
  - focused Clinic non-legacy + legacy transition + freeze + typecheck.
- Rollback:
  - phase-local rollback; simple edge/pin restoration if needed.
- Recommendation: **recommended migration strategy**.

## Task 4 - Guardrail

File inspected: `tests/architecture/campobase-namespace-freeze.test.ts`

- Pinned size actual: `11`.
- Current Clinic edge:
  - `tests/lib/campobase-clinic-platform-service.test.ts::@/lib/campobase/clinic-platform-service`
- Can this edge be removed now: **not recommended**.
- Expected pin if removed: `10`.
- Conditions to remove safely:
  - runtime side-effect/handler-registration parity covered outside `@/lib/campobase`;
  - legacy test converted to static adapter verification (or replaced) with no relevant functional gap;
  - edge removal + pin update done together in the same controlled shrink change.

## Task 5 - Required Validations (Audit-only)

Executed exactly as requested:

- `pnpm typecheck` -> pass
- `npx vitest run tests/lib/clinic-appointment-health.test.ts` -> pass
- `npx vitest run tests/lib/clinic-control-plane-orchestration.test.ts` -> pass
- `npx vitest run tests/lib/clinic-control-plane-internal-client.test.ts` -> pass
- `npx vitest run tests/lib/campobase-clinic-platform-service.test.ts` -> pass
- `npx vitest run tests/architecture/campobase-namespace-freeze.test.ts` -> pass

No full suite run, no formatter, no refactor.

## Task 6 - Final Decision

- Clinic reducible now (`11 -> 10`): **no**.
- Recommended option: **Option B next, within Option D phased strategy**.
- Readiness status:
  - substantially improved after domain + orchestration non-legacy coverage;
  - one relevant parity gap remains (runtime side-effect / handler registration path).

## Suggested Next Block (Do Not Implement Here)

`clinic non-legacy handler-registration parity coverage before clinic legacy static conversion`

Intent:

- add targeted non-legacy coverage for handler-registration/runtime-side-effect parity model;
- then convert legacy Clinic test to static adapter verification;
- then shrink guardrail from `11` to `10` in one controlled step.
