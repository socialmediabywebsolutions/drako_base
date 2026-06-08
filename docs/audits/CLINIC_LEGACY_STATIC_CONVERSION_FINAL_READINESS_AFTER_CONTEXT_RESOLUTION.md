# Clinic Legacy Static Conversion Final Readiness After Context Resolution

## Scope

Audit-only final readiness checkpoint after adding non-legacy Clinic coverage for:

- appointment health domain calculation (`src/lib/clinic/appointment-health.ts`);
- control-plane/bootstrap orchestration planning (`src/lib/clinic/control-plane-orchestration.ts`);
- handler-registration parity and expected runtime-effects modeling (`src/lib/clinic/control-plane-handler-registration.ts`);
- context-resolution and handler-output wiring modeling (`src/lib/clinic/control-plane-context-resolution.ts`).

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
- `src/lib/clinic/control-plane-context-resolution.ts`
- `tests/lib/clinic-control-plane-context-resolution.test.ts`
- `src/lib/capabilities/internal-api-clients/clinic-control-plane.ts`
- `tests/lib/clinic-control-plane-internal-client.test.ts`
- `tests/architecture/campobase-namespace-freeze.test.ts`

## Task 1 - Full Current Coverage Comparison

### `tests/lib/clinic-appointment-health.test.ts`

Current coverage:

- appointment health metrics from appointment data;
- baseline legacy-equivalent metrics (`3/2/1`);
- config defaults (`lookaheadDays: 7`, `overdueFollowupHours: 24`);
- summary parity;
- status normalization/filtering (`CANCELLED`, `NO_SHOW`, `DONE`);
- invalid/missing schedule handling;
- fallback schedule (`followUpAt`) handling.

### `tests/lib/clinic-control-plane-orchestration.test.ts`

Current coverage:

- pure bootstrap planning:
  - automation registration decision;
  - WhatsApp provider readiness path;
  - integration bootstrap decision;
  - primary identity influence;
  - states `PENDING`, `CONNECTED`, `MISSING`;
- identity validation (`tenantId`/`saasId` required);
- anti-legacy import and anti-`campobase` filename checks.

### `tests/lib/clinic-control-plane-handler-registration.test.ts`

Current coverage:

- expected runtime-effect planning parity for:
  - `REGISTER_AUTOMATION`;
  - `REGISTER_AUTOMATION_HANDLER`;
  - `ENSURE_WHATSAPP_PROVIDER`;
  - `CREATE_WHATSAPP_INTEGRATION`;
- automation/handler presence permutations;
- provider unavailable path (`MISSING`);
- identity validation and safe defaults;
- anti-legacy import and anti-`campobase` filename checks.

### `tests/lib/clinic-control-plane-context-resolution.test.ts`

Current coverage:

- context identity resolution (`tenantId`/`saasId`);
- handler output wiring from context + appointments + config;
- legacy-equivalent metrics and summary/output projection;
- default normalization reflected into output (`7/24`);
- identity validation;
- anti-legacy import and anti-`campobase` filename checks.

### `tests/lib/clinic-control-plane-internal-client.test.ts`

Current coverage:

- neutral boundary without legacy imports;
- automation registration and default normalization (`7/24`);
- integration semantics with `PENDING`, `CONNECTED`, `MISSING` and primary identity;
- health snapshot and appointment-health result representation;
- explicit neutral-backend-not-configured error path.

### `tests/lib/campobase-clinic-platform-service.test.ts` (legacy)

Still covers runtime behavior coupled to legacy module import:

- side effects against `automation-core` (`getAutomation`, `registerAutomation`, `registerAutomationHandler`);
- side effects against `integration-core` (`getIntegrationConnection`, `connectIntegration`);
- provider bootstrap call (`ensureWhatsappIntegrationAvailable`);
- runtime capture/execution path of the registered handler;
- runtime context-resolution call (`resolveAppointmentsContext`);
- handler execution over appointment repository payload and resulting metrics.

### Coverage now duplicated / sufficiently equivalent outside legacy

- appointment-health metrics, defaults, and summary/output;
- calculation behavior from appointment datasets;
- bootstrap/orchestration decisions;
- handler-registration intent and expected runtime effects;
- WhatsApp provider/integration semantics and primary-identity impact;
- context-resolution and handler output wiring model.

### Coverage still only in legacy

- direct runtime side-effect invocation against `automation-core`/`integration-core` adapters;
- module-load runtime registration assertion via `registerAutomationHandler` call site.

Assessment of remaining legacy-only area:

- remaining legacy-only coverage is adapter wiring verification, not core Clinic domain behavior;
- domain/orchestration/wiring semantics are now covered outside legacy with focused tests.

### Safety conclusion for static conversion now

- **Yes, now sufficiently safe** to convert legacy Clinic service test to static adapter verification in a controlled change.
- Residual risk is limited to direct runtime adapter call wiring, which is acceptable under frozen-legacy strategy and now has strong parity modeling around expected behavior.

## Task 2 - Final Risk Classification

- Risk to convert the legacy test now: **low/medium**.
- Functional coverage loss if converted now: **no material loss** in Clinic functional behavior coverage.
- Coverage sufficiently outside legacy:
  - domain appointment-health computation and defaults;
  - summary/output semantics;
  - orchestration/bootstrap decisions;
  - expected handler-registration/runtime effects;
  - context-resolution and handler-output wiring;
  - neutral client contract/state semantics.
- Coverage still missing outside legacy:
  - only direct runtime adapter invocation assertions (`automation-core`/`integration-core` call wiring).
- Additional test needed before conversion: **no (not required)**.
- Guardrail reduction `11 -> 10`: **yes, now eligible**.

## Task 3 - Options

### Option A

Convert now `tests/lib/campobase-clinic-platform-service.test.ts` to static adapter verification and reduce guardrail `11 -> 10`.

- Risk: low/medium.
- Impact:
  - removes final Clinic test edge from frozen legacy namespace;
  - keeps functional Clinic behavior covered by non-legacy tests.
- Future files to touch:
  - `tests/lib/campobase-clinic-platform-service.test.ts`
  - `tests/architecture/campobase-namespace-freeze.test.ts`
- Tests needed:
  - `pnpm typecheck`
  - `npx vitest run tests/lib/clinic-appointment-health.test.ts`
  - `npx vitest run tests/lib/clinic-control-plane-orchestration.test.ts`
  - `npx vitest run tests/lib/clinic-control-plane-handler-registration.test.ts`
  - `npx vitest run tests/lib/clinic-control-plane-context-resolution.test.ts`
  - `npx vitest run tests/lib/clinic-control-plane-internal-client.test.ts`
  - `npx vitest run tests/lib/campobase-clinic-platform-service.test.ts`
  - `npx vitest run tests/architecture/campobase-namespace-freeze.test.ts`
- Rollback:
  - restore prior legacy functional assertions and restore Clinic edge/pin.
- Recommendation: **recommended now**.

### Option B

Keep legacy functional test for one more block.

- Risk: low.
- Impact:
  - maximum conservatism;
  - delays guardrail shrink without a newly identified critical gap.
- Future files to touch:
  - none immediately.
- Tests needed:
  - current focused Clinic set + freeze + typecheck.
- Rollback:
  - no-op (already current state).
- Recommendation: valid but no longer preferred.

### Option C

Create one additional non-legacy test if any concrete gap remains.

- Risk: low.
- Impact:
  - only justified if a new specific behavioral gap is identified;
  - current evidence does not show a required missing functional gap.
- Future files to touch:
  - possible extra test under `tests/lib/` (only if concrete missing case is identified).
- Tests needed:
  - targeted new test + current focused Clinic set + freeze + typecheck.
- Rollback:
  - revert optional extra test.
- Recommendation: optional, not required before conversion.

### Option D

Convert legacy to static test and rely on non-legacy domain/orchestration/handler-registration/context-resolution/neutral-client coverage.

- Risk: low/medium.
- Impact:
  - aligns with canonical architecture and migration objective;
  - retires legacy functional dependence in tests while preserving behavior coverage.
- Future files to touch:
  - `tests/lib/campobase-clinic-platform-service.test.ts`
  - `tests/architecture/campobase-namespace-freeze.test.ts`
- Tests needed:
  - same focused Clinic list + freeze + typecheck.
- Rollback:
  - restore previous legacy functional test + allowlist edge/pin.
- Recommendation: **recommended execution model** (implemented as Option A action).

### Final recommendation

- **Proceed with Option A now, executed under Option D migration strategy**.

## Task 4 - Guardrail

File inspected: `tests/architecture/campobase-namespace-freeze.test.ts`

- Pinned size actual: `11`.
- Current Clinic edge:
  - `tests/lib/campobase-clinic-platform-service.test.ts::@/lib/campobase/clinic-platform-service`
- Can this edge be removed now: **yes**.
- Expected pin if removed: `10`.
- Conditions to remove safely:
  - legacy Clinic test converted to static adapter verification in same change;
  - allowlist edge removed and pin updated in same change;
  - focused Clinic + freeze validations remain green.

## Task 5 - Required Validations (Audit-only)

Executed exactly as requested:

- `pnpm typecheck` -> pass
- `npx vitest run tests/lib/clinic-appointment-health.test.ts` -> pass
- `npx vitest run tests/lib/clinic-control-plane-orchestration.test.ts` -> pass
- `npx vitest run tests/lib/clinic-control-plane-handler-registration.test.ts` -> pass
- `npx vitest run tests/lib/clinic-control-plane-context-resolution.test.ts` -> pass
- `npx vitest run tests/lib/clinic-control-plane-internal-client.test.ts` -> pass
- `npx vitest run tests/lib/campobase-clinic-platform-service.test.ts` -> pass
- `npx vitest run tests/architecture/campobase-namespace-freeze.test.ts` -> pass

No full suite run, no formatter, no refactor.

## Task 6 - Final Decision

- Clinic reducible now (`11 -> 10`): **yes**.
- Recommended option: **Option A now (under Option D strategy)**.
- Readiness status: **final-ready for legacy static conversion + Clinic guardrail shrink**.

## Suggested Next Block (Do Not Implement Here)

`convert clinic legacy service test to static adapter verification and shrink campobase namespace freeze from 11 to 10`

Intent:

- convert `tests/lib/campobase-clinic-platform-service.test.ts` from legacy functional runtime assertions to static adapter verification;
- remove Clinic edge from freeze allowlist and pin from `11` to `10` in the same controlled change;
- validate focused Clinic + freeze suite and typecheck.
