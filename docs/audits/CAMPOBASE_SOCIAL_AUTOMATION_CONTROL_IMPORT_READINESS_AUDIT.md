# CAMPOBASE_SOCIAL_AUTOMATION_CONTROL_IMPORT_READINESS_AUDIT

## Scope

This audit evaluates only:

- `src/components/campobase/CampoBaseSocialAutomationControl.tsx`

And inspects these dependency candidates:

- `src/lib/campamento-base/socialflow-control-plane-service.ts`
- `src/lib/campobase/socialflow-service.ts`
- `src/lib/operator/socialflow-service.ts`

No production code, tests, routes, services, or runtime behavior were modified in this audit.

---

## 1) Component Import Inspection

### Current legacy import

`src/components/campobase/CampoBaseSocialAutomationControl.tsx` currently uses a **type-only** import:

```ts
import type {
  CampoBaseSocialAutomationBatchOutput,
  CampoBaseSocialAutomationOutput,
  CampoBaseSocialAutomationStatusOutput,
  CampoBaseSocialAutomationToggleOutput,
  CampoBaseSocialFlowObservability,
  CampoBaseSocialFlowOperatorAction,
  CampoBaseSocialFlowOperatorActionResult,
} from "@/lib/campobase/socialflow-service";
```

### What is used from that import

The component uses those symbols only for typing:

- local state typing (`status`, `observability`)
- API response typing (`ControlResponse` union)
- function argument typing (`runOperatorAction` action union)
- child prop typing (`OperatorPostList` post shape)

### Runtime behavior in component

Runtime behavior is API-driven via:

- `GET /api/operator/socialflow`
- `POST /api/operator/socialflow`

The component **does not call service functions directly** from imported modules; it only uses types.

---

## 2) Canonical Equivalence Check

### Legacy adapter target

`src/lib/campobase/socialflow-service.ts` is a frozen adapter:

```ts
export * from "@/lib/campamento-base/socialflow-control-plane-service";
```

### Operator bridge target

`src/lib/operator/socialflow-service.ts` is also a re-export bridge:

```ts
export * from "@/lib/campamento-base/socialflow-control-plane-service";
```

### Canonical source

`src/lib/campamento-base/socialflow-control-plane-service.ts` exports the same type symbols currently consumed by the component, including:

- `CampoBaseSocialAutomationBatchOutput`
- `CampoBaseSocialAutomationOutput`
- `CampoBaseSocialAutomationStatusOutput`
- `CampoBaseSocialAutomationToggleOutput`
- `CampoBaseSocialFlowObservability`
- `CampoBaseSocialFlowOperatorAction`
- `CampoBaseSocialFlowOperatorActionResult`

### 1:1 feasibility

Yes. Import migration can be 1:1 by path only, with no symbol renames.

---

## 3) Direct Canonical vs Operator Bridge

### Option target comparison

- Direct canonical import: `@/lib/campamento-base/socialflow-control-plane-service`
- Operator bridge import: `@/lib/operator/socialflow-service`

Both are currently equivalent in exported surface because both resolve to canonical service exports.

### Recommendation on target

Prefer **direct canonical** (`@/lib/campamento-base/socialflow-control-plane-service`) for this migration block because:

- it removes the legacy edge explicitly at the consumer
- it aligns directly with canonical namespace policy
- it avoids adding an extra bridge hop in dependency reasoning

Operator bridge remains technically valid, but is one level more indirect.

---

## 4) UI/Behavior Risk Assessment

- UI regression risk: **Low** (type-only import swap)
- Runtime behavior risk: **Low** (component runtime is fetch-based, unchanged endpoints)
- API contract risk: **Low** (route already uses canonical control-plane service)
- DX/type risk: **Low** (export surface matches)

Overall migration risk for this component import is **low**.

---

## 5) Related Tests Found

| Path | What it covers | Would need adjustment? | Risk |
|---|---|---|---|
| `tests/components/operator-socialflow-health-panel.test.tsx` | Operator SocialFlow page behavior (loads observability/actions) via `SocialAutomationControl` bridge -> `CampoBaseSocialAutomationControl` | Likely no, unless static import assertions are added later | Low |
| `tests/architecture/campobase-namespace-freeze.test.ts` | Legacy import allowlist guardrail; currently includes `CampoBaseSocialAutomationControl` legacy edge | **Yes** on migration (remove edge + update pinned size) | Low |
| `tests/api/campobase-socialflow-route.test.ts` | SocialFlow operator route behavior and canonical service usage assertions | No for component-only import migration | Low |
| `tests/api/operator-socialflow-legacy-bridge-contract.test.ts` | Legacy API bridge route contract and adapter constraints | No for component-only import migration | Low |
| `tests/lib/campamento-base-socialflow-control-plane-service.test.ts` | Canonical service contract and compatibility shape | No for component-only import migration | Low |
| `tests/lib/campobase-socialflow-service.test.ts` | Legacy adapter compatibility/exports for existing consumers | No for component-only import migration | Low |
| `tests/lib/operator-socialflow-service-canonical-dependency.test.ts` | Operator bridge points to canonical and not legacy | No for component-only import migration | Low |
| `tests/components/campobase-social-page.test.tsx` | Dashboard social page behavior (separate component/page path) | No direct dependency on `CampoBaseSocialAutomationControl` | Low |

Note: no test was found that directly imports `CampoBaseSocialAutomationControl` by name.

---

## 6) Option Analysis (A/B/C/D)

### Option A — Migrate component directly to canonical service

- Change: swap component type import to `@/lib/campamento-base/socialflow-control-plane-service`
- Risk: **Low**
- Files to touch:
  - `src/components/campobase/CampoBaseSocialAutomationControl.tsx`
  - `tests/architecture/campobase-namespace-freeze.test.ts` (allowlist shrink)
- Tests needed (targeted):
  - `tests/components/operator-socialflow-health-panel.test.tsx`
  - `tests/architecture/campobase-namespace-freeze.test.ts`
  - optional confidence: `tests/api/campobase-socialflow-route.test.ts`
- Validation:
  - `pnpm typecheck`
  - targeted vitest runs above
- Rollback:
  - revert single import path
  - restore allowlist entry and pinned size

### Option B — Migrate component to operator bridge

- Change: swap type import to `@/lib/operator/socialflow-service`
- Risk: **Low**
- Files to touch:
  - `src/components/campobase/CampoBaseSocialAutomationControl.tsx`
  - `tests/architecture/campobase-namespace-freeze.test.ts` (allowlist shrink)
- Tests needed:
  - same as Option A
- Validation:
  - same as Option A
- Rollback:
  - revert import and allowlist changes

### Option C — Add static test first, migrate after

- Change: add static source assertion test before import migration
- Risk: **Low-Medium** (extra maintenance/noise; can overconstrain migration sequencing)
- Files to touch:
  - new or existing test file(s)
  - later same files as Option A/B
- Tests needed:
  - static assertion test + Option A/B tests
- Validation:
  - typecheck + tests including new static assertion
- Rollback:
  - remove static test and revert migration changes

### Option D — Defer this component

- Change: none
- Risk: **Low immediate / Medium strategic** (legacy edge remains)
- Files to touch: none
- Tests needed: none
- Validation: none beyond baseline
- Rollback: N/A

### Final recommendation

**Recommend Option A** as the next safe technical block.

Rationale:

- direct canonical path aligns best with namespace policy
- import replacement is 1:1 and type-only
- expected blast radius is minimal
- rollback is trivial

---

## 7) Audit Validation Runs (as requested)

Executed only:

- `pnpm typecheck` ✅
- `npx vitest run tests/architecture/campobase-namespace-freeze.test.ts` ✅

No full suite, no formatter, no refactor runs were executed.
