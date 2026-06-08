# Clinic Legacy Static Conversion After Domain Health Extraction

## Scope

Audit-only checkpoint after extracting Clinic appointment health domain logic into:

- `src/lib/clinic/appointment-health.ts`

Goal:

- evaluate whether it is now safe to convert `tests/lib/campobase-clinic-platform-service.test.ts` to static adapter verification;
- evaluate whether `campobase-namespace-freeze` can be reduced from `11` to `10` by removing the Clinic legacy test edge;
- do not modify product code, imports, tests, guardrail, legacy Clinic, or other domains.

## Mandatory Canonical Rule Applied

- Clinic is an independent SaaS vertical.
- Clinic domain logic belongs in `src/lib/clinic/`.
- Campamento Base only orchestrates Clinic through a neutral boundary.
- `src/lib/capabilities/internal-api-clients/` contains the neutral client boundary.
- Campobase is frozen legacy.
- `src/lib/campobase/` remains temporary compatibility only.
- No new imports to `@/lib/campobase`.

## Files Inspected

- `src/lib/campobase/clinic-platform-service.ts`
- `tests/lib/campobase-clinic-platform-service.test.ts`
- `src/lib/clinic/appointment-health.ts`
- `tests/lib/clinic-appointment-health.test.ts`
- `src/lib/capabilities/internal-api-clients/clinic-control-plane.ts`
- `tests/lib/clinic-control-plane-internal-client.test.ts`
- `docs/audits/CLINIC_LEGACY_STATIC_CONVERSION_AFTER_NEUTRAL_COVERAGE_EXPANSION.md`
- `tests/architecture/campobase-namespace-freeze.test.ts`

## Task 1 - Coverage Comparison After Domain Extraction

### What `tests/lib/clinic-appointment-health.test.ts` now covers

- pure domain calculation of appointment health metrics from appointment data;
- core metrics parity scenario:
  - `upcomingAppointments: 3`
  - `unconfirmedAppointments: 2`
  - `overdueFollowups: 1`
- config defaults and invalid config fallback:
  - `lookaheadDays: 7`
  - `overdueFollowupHours: 24`
- summary string content parity;
- status exclusion logic for upcoming (`CANCELLED`, `NO_SHOW`, `DONE`);
- invalid or missing schedule handling;
- additional domain robustness not present in legacy runtime test:
  - `followUpAt` fallback;
  - dashed status normalization (`no-show` -> `NO_SHOW`).

### What `tests/lib/clinic-control-plane-internal-client.test.ts` now covers

- neutral client has no `@/lib/campobase` imports;
- neutral automation registration lifecycle and default config normalization (7/24);
- neutral integration state modeling (`PENDING`, `CONNECTED`, `MISSING`) and primary WhatsApp identity flag;
- neutral health snapshot representation;
- neutral result builder summary/output consistency;
- explicit failure path when real neutral backend is missing.

### What `tests/lib/campobase-clinic-platform-service.test.ts` still covers

- import and execution path of legacy runtime module `@/lib/campobase/clinic-platform-service`;
- registration-time side effects against `automation-core` mocks:
  - `getAutomation`
  - `registerAutomation`
  - `registerAutomationHandler`
- registration-time side effects against `integration-core` mocks:
  - `getIntegrationConnection`
  - `connectIntegration`
- WhatsApp provider bootstrap call (`ensureWhatsappIntegrationAvailable`);
- runtime handler capture and execution from `registerAutomationHandler`;
- runtime context resolution invocation (explicitly asserts `resolveAppointmentsContext` call);
- end-to-end handler output shape from mocked appointment repository data.

### Duplicated / sufficiently equivalent coverage now

- appointment-health metrics expectations are now strongly covered in pure domain tests;
- defaults `7/24` and summary/output format are covered outside legacy in domain + neutral tests;
- high-level automation/integration concepts are represented in neutral client tests.

### Coverage still only in legacy (or only weakly covered outside legacy)

- direct runtime coupling to `automation-core` and `integration-core` side effects;
- handler registration/execution path through `registerAutomationHandler`;
- legacy runtime invocation pattern tied to campobase module boundaries;
- concrete bootstrap orchestration in `registerClinicPlatform` (neutral currently models state, not runtime side effects);
- context resolution chain under legacy runtime (`resolveClinicContext`, appointments/whatsapp contexts) is not equivalently validated outside legacy;
- primary WhatsApp identity is modeled in neutral tests, but legacy test currently validates only the `PENDING` branch (no identity), not the `CONNECTED` credentials branch.

### Safety conclusion for immediate static conversion

- not yet fully safe to convert immediately with zero functional loss;
- domain extraction removed the biggest legacy-only logic (appointment-health calculation), but runtime orchestration side effects are still legacy-weighted.

## Task 2 - Risk Classification

- Risk of converting legacy test now: **medium**.
- Functional coverage loss if converted now: **yes** (runtime orchestration path and side effects).
- Coverage already sufficiently outside legacy:
  - domain metrics/defaults/summary;
  - neutral registration state and integration state modeling.
- Coverage still missing outside legacy:
  - runtime side effects parity (`automation-core` + `integration-core` orchestration behavior);
  - handler-registration runtime path parity;
  - legacy bootstrap/context orchestration parity.
- Need additional tests first: **yes, recommended** (targeting missing runtime-orchestration equivalence outside campobase import).
- Guardrail reduction `11 -> 10` now: **not recommended yet**.

## Task 3 - Options Evaluation

### Option A
Convert now `tests/lib/campobase-clinic-platform-service.test.ts` to static adapter verification and reduce guardrail `11 -> 10`.

- Risk: medium.
- Impact:
  - immediate allowlist reduction;
  - removes one legacy test import;
  - drops current runtime side-effect coverage.
- Future files to touch:
  - `tests/lib/campobase-clinic-platform-service.test.ts`
  - `tests/architecture/campobase-namespace-freeze.test.ts`
- Tests needed:
  - `pnpm typecheck`
  - `npx vitest run tests/lib/campobase-clinic-platform-service.test.ts`
  - `npx vitest run tests/lib/clinic-control-plane-internal-client.test.ts`
  - `npx vitest run tests/lib/clinic-appointment-health.test.ts`
  - `npx vitest run tests/architecture/campobase-namespace-freeze.test.ts`
- Rollback:
  - restore functional legacy test;
  - restore allowlist edge and pin size `11`.
- Recommendation: **not recommended now**.

### Option B
Create neutral/bootstrap-oriented tests for modeled automation + WhatsApp side effects first, without touching legacy yet.

- Risk: low/medium.
- Impact:
  - increases non-legacy confidence;
  - preserves current legacy safety net while closing remaining gaps;
  - does not reduce guardrail immediately.
- Future files to touch (example shape):
  - `tests/lib/clinic-control-plane-internal-client.test.ts` (or new neutral Clinic bootstrap-focused test)
  - possibly neutral boundary module(s) only if strictly necessary
  - no guardrail change in this step
- Tests needed:
  - focused new/expanded neutral tests
  - current Clinic domain test
  - current legacy Clinic test
  - namespace freeze test
  - typecheck
- Rollback:
  - revert added neutral coverage only; legacy remains intact.
- Recommendation: **good preparatory option**.

### Option C
Keep legacy functional test as-is for now and prioritize TaskOps neutral progress first.

- Risk: low (for Clinic immediate stability).
- Impact:
  - no immediate Clinic migration movement;
  - guardrail remains `11`;
  - shifts migration effort to TaskOps domain.
- Future files to touch:
  - TaskOps neutral contract/client/tests (separate block)
- Tests needed:
  - TaskOps-focused targeted tests + freeze + typecheck
- Rollback:
  - revert TaskOps block if needed.
- Recommendation: **valid sequencing alternative**, but does not advance Clinic edge reduction.

### Option D
Split strategy:

- keep static adapter verification for legacy test target;
- move missing functional coverage to domain/neutral tests first;
- reduce guardrail only when legacy import is removable.

- Risk: low/medium.
- Impact:
  - preserves behavior confidence while enabling a controlled shrink;
  - aligns with canonical ownership boundaries.
- Future files to touch (phased):
  - phase 1: non-legacy tests in Clinic domain/neutral boundaries
  - phase 2: `tests/lib/campobase-clinic-platform-service.test.ts` -> static adapter verification
  - phase 3: `tests/architecture/campobase-namespace-freeze.test.ts` edge removal and pin `10`
- Tests needed:
  - targeted Clinic domain + neutral + legacy transition tests
  - freeze test
  - typecheck
- Rollback:
  - phase-local rollback possible at each step;
  - straightforward restoration of edge/pin if needed.
- Recommendation: **recommended final path**.

## Task 4 - Guardrail Decision

File inspected: `tests/architecture/campobase-namespace-freeze.test.ts`

- Current pinned size: `11`.
- Current Clinic edge:
  - `tests/lib/campobase-clinic-platform-service.test.ts::@/lib/campobase/clinic-platform-service`
- Can it be removed now: **not recommended**.
- Expected pinned size if removed: `10`.
- Conditions to remove safely:
  - functional coverage currently held by legacy runtime test is replaced outside `@/lib/campobase`;
  - legacy Clinic test is converted to static adapter verification (or fully replaced);
  - edge removed from allowlist and pin updated to `10` in same controlled shrink step.

## Task 5 - Required Validations (Audit-Only)

Executed exactly as requested:

- `pnpm typecheck` -> pass
- `npx vitest run tests/lib/clinic-appointment-health.test.ts` -> pass
- `npx vitest run tests/lib/clinic-control-plane-internal-client.test.ts` -> pass
- `npx vitest run tests/lib/campobase-clinic-platform-service.test.ts` -> pass
- `npx vitest run tests/architecture/campobase-namespace-freeze.test.ts` -> pass

No full-suite run. No formatters. No refactors.

## Task 6 - Final Audit Decision

- Clinic can be reduced now (`11 -> 10`): **no**.
- Recommended option: **Option D** (with Option B-style preparatory coverage before conversion).
- Technical-readiness note:
  - domain extraction substantially improved readiness by externalizing metrics/defaults/summary logic;
  - remaining blocker is runtime orchestration parity currently concentrated in the legacy functional test.

## Suggested Next Block (Do Not Implement Here)

`clinic non-legacy orchestration parity coverage before static adapter conversion`

Intent:

- add targeted non-legacy coverage for remaining runtime-orchestration gaps;
- then convert legacy Clinic test to static adapter verification;
- then shrink guardrail `11 -> 10` in one controlled migration step.
