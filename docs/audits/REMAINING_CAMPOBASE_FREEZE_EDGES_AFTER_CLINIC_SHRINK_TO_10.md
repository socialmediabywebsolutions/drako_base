# Remaining Campobase Freeze Edges After Clinic Shrink To 10

## Scope

Audit-only checkpoint after Clinic legacy service test migration and guardrail shrink to `10`.

Goal:

- inspect remaining `@/lib/campobase` freeze edges;
- classify risk and readiness per edge;
- propose the safest next shrink block;
- do not modify product code, imports, tests, or guardrail in this audit.

Canonical rule applied:

- Campamento Base is canonical as control-plane.
- Clinic is already out of the main legacy runtime test path.
- TaskOps is a transversal engine and must not be mixed into Campamento Base without a neutral contract.
- `src/lib/campamento-base/` is canonical only for neutral control-plane concerns.
- `src/lib/taskops/` is the target namespace for transversal TaskOps logic when applicable.
- Campobase remains frozen legacy compatibility.
- No new imports to `@/lib/campobase`.

---

## Task 1 - Guardrail Current State

Source inspected: `tests/architecture/campobase-namespace-freeze.test.ts`

- pinned size: `10`
- remaining allowed edges: `10`
- runtime externo edges: `0`
- legacy interno congelado edges: `4`
- test edges: `6`

### Allowed edges (current 10)

| # | Edge | Scope | Bucket |
|---|---|---|---|
| 1 | `src/lib/campobase/clinic-platform.ts::@/lib/campobase/clinic-platform-service` | legacy runtime internal | adapters legacy / Clinic |
| 2 | `src/lib/campobase/platform-bootstrap.ts::@/lib/campobase/clinic-platform` | legacy runtime internal | platform-bootstrap / Clinic |
| 3 | `src/lib/campobase/platform-bootstrap.ts::@/lib/campobase/taskops-platform` | legacy runtime internal | platform-bootstrap / TaskOps |
| 4 | `src/lib/campobase/taskops-platform.ts::@/lib/campobase/taskops-platform-service` | legacy runtime internal | adapters legacy / TaskOps |
| 5 | `tests/lib/campobase-platform-bootstrap.test.ts::@/lib/campobase/platform-bootstrap` | test | test de compatibilidad / platform-bootstrap |
| 6 | `tests/lib/campobase-taskops-platform-service.test.ts::@/lib/campobase/taskops-platform-service` | test | test legacy adapter / TaskOps |
| 7 | `tests/lib/cross-saas-taskops-flow.test.ts::@/lib/campobase/taskops-platform` | test | cross-saas-taskops-flow / TaskOps |
| 8 | `tests/lib/factory-orchestrator.test.ts::@/lib/campobase/platform-bootstrap` | test | factory-orchestrator |
| 9 | `tests/lib/saas-contract-definitions.test.ts::@/lib/campobase/clinic-platform` | test | saas-contract-definitions / Clinic |
| 10 | `tests/lib/saas-contract-definitions.test.ts::@/lib/campobase/taskops-platform` | test | saas-contract-definitions / TaskOps |

---

## Task 2 - Edge-by-edge Classification

| Path | Legacy import | Category | Risk | Canonical equivalent today | Recommended action |
|---|---|---|---|---|---|
| `src/lib/campobase/clinic-platform.ts` | `@/lib/campobase/clinic-platform-service` | legacy interno congelado | medium | No 1:1 canonical wrapper yet. Clinic neutral boundary exists at `src/lib/capabilities/internal-api-clients/clinic-control-plane.ts`, but legacy wrapper still depends on legacy service. | requires contract / do not touch yet |
| `src/lib/campobase/platform-bootstrap.ts` | `@/lib/campobase/clinic-platform` | platform-bootstrap (legacy interno congelado) | high | No canonical `clinic-platform` replacement in `campamento-base`; replacing now risks ownership mixing. | requires prior audit |
| `src/lib/campobase/platform-bootstrap.ts` | `@/lib/campobase/taskops-platform` | platform-bootstrap (legacy interno congelado) | high | No canonical `taskops-platform` replacement yet; TaskOps contract still draft and transversal. | requires prior audit |
| `src/lib/campobase/taskops-platform.ts` | `@/lib/campobase/taskops-platform-service` | TaskOps (legacy interno congelado) | high | No neutral TaskOps runtime client/module in production path yet; only contract doc exists. | requires contract |
| `tests/lib/campobase-platform-bootstrap.test.ts` | `@/lib/campobase/platform-bootstrap` | test de compatibilidad / platform-bootstrap | medium-high | No canonical loader module yet. Could be converted to static adapter verification later. | maintain as adapter test for now |
| `tests/lib/campobase-taskops-platform-service.test.ts` | `@/lib/campobase/taskops-platform-service` | test legacy adapter / TaskOps | medium-high | No non-legacy TaskOps functional parity suite yet. | requires prior audit |
| `tests/lib/cross-saas-taskops-flow.test.ts` | `@/lib/campobase/taskops-platform` | TaskOps / cross-saas flow | high | No canonical TaskOps signal-handler bridge replacement (`task.overdue`) in neutral namespace yet. | do not touch yet |
| `tests/lib/factory-orchestrator.test.ts` | `@/lib/campobase/platform-bootstrap` | factory/orchestrator | medium-high | Partial canonical route exists via `@/lib/saas-contract` runtime registration, but this test still validates shared loader behavior. | requires prior audit |
| `tests/lib/saas-contract-definitions.test.ts` | `@/lib/campobase/clinic-platform` | test de compatibilidad / Clinic | medium | No canonical Clinic platform wrapper; however assertions are mostly static definition-shape checks. | migrate now (static adapter verification) |
| `tests/lib/saas-contract-definitions.test.ts` | `@/lib/campobase/taskops-platform` | test de compatibilidad / TaskOps | medium-high | No canonical TaskOps wrapper; static-definition verification can still be isolated from runtime import. | migrate now (same block as previous edge) |

---

## Task 3 - Top 3 Safest Candidates

## 1) `tests/lib/saas-contract-definitions.test.ts` (remove 2 edges together)

- file to touch: `tests/lib/saas-contract-definitions.test.ts`
- imports to replace/remove:
  - `@/lib/campobase/clinic-platform`
  - `@/lib/campobase/taskops-platform`
- recommended equivalent:
  - static adapter verification over `src/lib/campobase/clinic-platform.ts` and `src/lib/campobase/taskops-platform.ts` source markers;
  - keep SocialFlow canonical import checks as-is (`@/lib/campamento-base/socialflow-platform`).
- tests needed:
  - `npx vitest run tests/lib/saas-contract-definitions.test.ts`
  - `npx vitest run tests/architecture/campobase-namespace-freeze.test.ts`
- validations:
  - `pnpm typecheck`
  - guardrail test above
- rollback:
  - restore original imports and guardrail pin/allowlist entry count
- safety rationale:
  - test-only scope;
  - no product runtime touch;
  - removes two edges in one controlled change.

## 2) `tests/lib/factory-orchestrator.test.ts` (candidate, but only with narrowed scope)

- file to touch: `tests/lib/factory-orchestrator.test.ts`
- import to replace/remove:
  - `@/lib/campobase/platform-bootstrap`
- recommended equivalent:
  - rely on `@/lib/saas-contract` resolution (`resolveSaasPlatform` + `bootstrap.connect`) for runtime-created SaaS instances,
  - keep loader-specific behavior in dedicated bootstrap compatibility tests if needed.
- tests needed:
  - `npx vitest run tests/lib/factory-orchestrator.test.ts`
  - `npx vitest run tests/architecture/campobase-namespace-freeze.test.ts`
- validations:
  - `pnpm typecheck`
  - optional confidence run: `npx vitest run tests/lib/campobase-platform-bootstrap.test.ts`
- rollback:
  - revert test-only changes and restore previous import
- why safe / why wait:
  - safer than runtime edits because test-only;
  - but should wait for a focused factory/orchestrator audit to avoid silently dropping loader guarantees.

## 3) `tests/lib/campobase-platform-bootstrap.test.ts` (candidate after dedicated bootstrap audit)

- file to touch: `tests/lib/campobase-platform-bootstrap.test.ts`
- import to replace/remove:
  - `@/lib/campobase/platform-bootstrap`
- recommended equivalent:
  - static legacy adapter verification of `src/lib/campobase/platform-bootstrap.ts` markers,
  - plus explicit canonical assertion that SocialFlow remains under `@/lib/campamento-base/socialflow-platform`.
- tests needed:
  - `npx vitest run tests/lib/campobase-platform-bootstrap.test.ts`
  - `npx vitest run tests/architecture/campobase-namespace-freeze.test.ts`
- validations:
  - `pnpm typecheck`
  - optional confidence runs:
    - `npx vitest run tests/lib/factory-orchestrator.test.ts`
    - `npx vitest run tests/lib/cross-saas-taskops-flow.test.ts`
- rollback:
  - restore previous runtime-style test and import edge
- why safe / why wait:
  - test-only and rollback-simple;
  - must wait until platform-bootstrap risk is reviewed because it bridges unresolved Clinic + TaskOps legacy paths.

---

## Task 4 - What Must Stay Frozen For Now

Do not touch yet:

- TaskOps edges tied to transversal signal behavior (`task.overdue`):
  - `src/lib/campobase/taskops-platform.ts::@/lib/campobase/taskops-platform-service`
  - `tests/lib/campobase-taskops-platform-service.test.ts::@/lib/campobase/taskops-platform-service`
  - `tests/lib/cross-saas-taskops-flow.test.ts::@/lib/campobase/taskops-platform`
- platform-bootstrap runtime edges still blocked by TaskOps/legacy and Clinic/legacy coupling:
  - `src/lib/campobase/platform-bootstrap.ts::@/lib/campobase/clinic-platform`
  - `src/lib/campobase/platform-bootstrap.ts::@/lib/campobase/taskops-platform`
- factory-orchestrator edge until dedicated audit preserves loader guarantees:
  - `tests/lib/factory-orchestrator.test.ts::@/lib/campobase/platform-bootstrap`
- `saas-contract-definitions` should remain frozen unless moved as a static adapter verification block (single controlled change with guardrail update).
- legacy adapter tests that still provide real runtime behavior coverage with no canonical parity yet should stay frozen.

---

## Task 5 - Audit Validations To Run

Required (audit-only):

- `pnpm typecheck`
- `npx vitest run tests/architecture/campobase-namespace-freeze.test.ts`

No full suite, no formatter, no refactor.

---

## Task 6 - Final Decision

- current pinned size: `10`
- remaining edges: `10`
- safest next reduction candidate: `tests/lib/saas-contract-definitions.test.ts` (can remove 2 edges in one test-only block)
- next two candidates (conditional):
  - `tests/lib/factory-orchestrator.test.ts`
  - `tests/lib/campobase-platform-bootstrap.test.ts`
- edges explicitly frozen for now: TaskOps runtime/flow edges + platform-bootstrap runtime edges + factory-orchestrator pending dedicated audit

Recommended next block (do not implement here):

`convert saas-contract-definitions legacy imports to static adapter verification and shrink campobase freeze from 10 to 8 in one controlled test-only block`
