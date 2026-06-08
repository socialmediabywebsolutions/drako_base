# PLATFORM BOOTSTRAP LEGACY TEST MIGRATION READINESS AFTER NEUTRAL PARITY

## Scope

Audit-only checkpoint after neutral parity expansion in:

- `src/lib/campamento-base/platform-bootstrap-loader.ts`
- `tests/lib/platform-bootstrap-loader.test.ts`

No production code, tests, imports, guardrail, runtime behavior, API routes, UI, or migrations were modified in this audit block.

## Inputs inspected

- `src/lib/campamento-base/platform-bootstrap-loader.ts`
- `tests/lib/platform-bootstrap-loader.test.ts`
- `tests/lib/platform-bootstrap-loader-contract.test.ts`
- `docs/contracts/campamento-base-platform-bootstrap-loader-contract-v1.md`
- `docs/audits/FACTORY_ORCHESTRATOR_PLATFORM_BOOTSTRAP_MIGRATION_READINESS_AFTER_NEUTRAL_LOADER.md`
- `tests/lib/campobase-platform-bootstrap.test.ts`
- `tests/lib/factory-orchestrator.test.ts`
- `src/lib/campobase/platform-bootstrap.ts`
- `tests/architecture/campobase-namespace-freeze.test.ts`

---

## Task 1 — Current coverage comparison

### 1) What expanded neutral loader now covers

`src/lib/campamento-base/platform-bootstrap-loader.ts` now provides deterministic, neutral-first structural parity coverage:

- explicit/exportable registry with definitions for:
  - SocialFlow (`READY`)
  - Clinic (`SKIPPED`)
  - TaskOps (`SKIPPED`)
- deterministic run statuses/messages:
  - SocialFlow => `READY`
  - Clinic => `SKIPPED`
  - TaskOps => `SKIPPED`
  - unknown/empty => `FAILED`
- deterministic validation over registry with custom input support:
  - duplicated `saasId`
  - empty `saasId`
  - empty `name`
- defensive-copy helper via `getPlatformBootstrapLoaderRegistry()`
- no imports from `@/lib/campobase`

### 2) What `platform-bootstrap-loader.test.ts` now covers

`tests/lib/platform-bootstrap-loader.test.ts` now validates:

- registry composition and status parity for SocialFlow/Clinic/TaskOps;
- defensive-copy behavior;
- resolution behavior (including Clinic/TaskOps pending definitions);
- deterministic `runPlatformBootstrap` outcomes/messages for ready/skipped/failed cases;
- deterministic validation outputs;
- duplicate and empty-field validation via custom registry input;
- policy guard assertions:
  - no import from `@/lib/campobase`
  - no new file path named `campobase` for this neutral block.

### 3) What `campobase-platform-bootstrap.test.ts` still covers

`tests/lib/campobase-platform-bootstrap.test.ts` still uniquely covers legacy runtime/adapter contract behavior:

- legacy file policy checks over `src/lib/campobase/platform-bootstrap.ts`:
  - SocialFlow canonical import
  - Clinic/TaskOps legacy dynamic imports still present
- runtime shared loader routing through legacy module for:
  - SocialFlow
  - Clinic
  - TaskOps
- explicit helper entrypoint execution through legacy module:
  - `registerSocialFlowPlatform`
  - `registerClinicPlatform`
  - `registerTaskOpsPlatform`

### 4) What `factory-orchestrator.test.ts` still covers

`tests/lib/factory-orchestrator.test.ts` still uniquely covers runtime side-effects through shared legacy loader path:

- runtime SaaS creation + shared loader call from `@/lib/campobase/platform-bootstrap`;
- automation/integration side-effects (`registerAutomation`, `connectIntegration`, integration availability);
- runtime automation handler execution output.

### 5) Duplicated/equivalent vs legacy-only coverage

Coverage now duplicated or sufficiently equivalent at neutral level:

- deterministic loader registry/list/resolve/run status classification;
- deterministic validation behavior (including invalid registry shapes);
- ownership-safe handling where Clinic/TaskOps are represented as pending-neutral (`SKIPPED`).

Coverage still legacy-only:

- runtime routing/execution through `@/lib/campobase/platform-bootstrap` for Clinic/TaskOps helper paths;
- explicit helper entrypoint runtime assertions in legacy module;
- runtime side-effect guarantees consumed by factory orchestrator shared-loader path.

Conclusion:

- neutral parity is materially improved;
- full functional replacement of both legacy tests is still not reached;
- one-edge reduction (`bootstrap` edge) is now conditionally feasible with a split migration pattern.

---

## Task 2 — Risk classification

### Can `campobase-platform-bootstrap.test.ts` migrate now?

- Decision: **YES, conditionally** (via split migration, not direct one-to-one replacement).
- Recommended migration shape:
  1. move neutral behavior assertions to `platform-bootstrap-loader` tests;
  2. preserve legacy adapter policy via static source verification (without runtime import to `@/lib/campobase/platform-bootstrap`).
- Risk level for converting bootstrap test to static/neutral split: **MEDIUM**.
- Coverage loss risk: **manageable** if split keeps static legacy policy checks and neutral parity checks together.
- Additional test needed before/inside migration: **YES** (static legacy adapter policy test coverage explicitly separated).

### Can `factory-orchestrator.test.ts` migrate now?

- Decision: **NO**.
- Risk level: **HIGH**.
- Coverage loss risk: **high**, because runtime side-effects on shared loader path are still uniquely protected there.
- Additional test needed first: **YES**, a proven neutral runtime-equivalent side-effect path.

### Guardrail reduction readiness

- Guardrail `8 -> 7`: **YES, conditionally**, if bootstrap edge migration is done with split static+neutral coverage in the same controlled block.
- Guardrail `8 -> 6`: **NO**, because factory edge should remain for now.

---

## Task 3 — Options analysis

## Option A
Migrate now `campobase-platform-bootstrap.test.ts` fully to neutral loader and reduce guardrail `8 -> 7`.

- Risk: **MEDIUM-HIGH**
- Impact: likely drops explicit legacy helper/import-policy coverage unless replaced elsewhere.
- Future files to touch:
  - `tests/lib/campobase-platform-bootstrap.test.ts`
  - `tests/lib/platform-bootstrap-loader.test.ts`
  - `tests/architecture/campobase-namespace-freeze.test.ts`
- Tests needed:
  - expanded neutral tests
  - replacement static legacy policy assertions
  - namespace freeze
- Rollback:
  - restore legacy runtime test + restore allowlist edge.
- Recommendation: **Not preferred** as a direct move.

## Option B
Convert `campobase-platform-bootstrap.test.ts` to static adapter verification only and reduce guardrail `8 -> 7`.

- Risk: **MEDIUM-HIGH**
- Impact: runtime routing checks are removed from this test path.
- Future files to touch:
  - `tests/lib/campobase-platform-bootstrap.test.ts` (or replacement static test file)
  - `tests/architecture/campobase-namespace-freeze.test.ts`
- Tests needed:
  - static adapter-policy test
  - keep neutral tests for behavior parity
  - namespace freeze
- Rollback:
  - reintroduce runtime legacy test import edge.
- Recommendation: **Not preferred alone**.

## Option C
Split `campobase-platform-bootstrap.test.ts` into:

- neutral behavior coverage (`platform-bootstrap-loader`), and
- static legacy adapter-policy verification,

then reduce guardrail `8 -> 7`.

- Risk: **MEDIUM**
- Impact: preserves policy confidence while removing one runtime legacy edge.
- Future files to touch:
  - `tests/lib/campobase-platform-bootstrap.test.ts` (or rename/split equivalent)
  - `tests/lib/platform-bootstrap-loader.test.ts`
  - `tests/architecture/campobase-namespace-freeze.test.ts`
- Tests needed:
  - neutral loader parity assertions (already strong, may need minor targeted additions)
  - static source assertions for legacy adapter file guarantees
  - namespace freeze
- Rollback:
  - restore prior legacy runtime test and add edge back to allowlist.
- Recommendation: **Recommended now** for one-edge shrink.

## Option D
Keep `campobase-platform-bootstrap.test.ts` legacy and advance TaskOps-neutral first.

- Risk: **LOW**
- Impact: safest runtime posture, no immediate guardrail shrink.
- Future files to touch:
  - TaskOps neutral boundary/contract/tests first
- Tests needed:
  - additional TaskOps neutral coverage
- Rollback:
  - minimal (no edge change).
- Recommendation: valid conservative fallback.

## Option E
Keep both legacy tests and add even more neutral coverage before touching guardrail.

- Risk: **LOW-MEDIUM**
- Impact: more confidence, slower reduction.
- Future files to touch:
  - `tests/lib/platform-bootstrap-loader.test.ts`
  - possibly `src/lib/campamento-base/platform-bootstrap-loader.ts` if parity gaps are identified
- Tests needed:
  - further neutral parity checks
- Rollback:
  - straightforward (test-only expansions).
- Recommendation: valid if team wants extra cushion before first edge removal.

### Final recommendation

Recommend **Option C** as first shrink step now:

- remove only bootstrap edge (`8 -> 7`) via split neutral+static strategy,
- keep factory legacy edge intact,
- re-audit before any `7 -> 6` decision.

---

## Task 4 — Guardrail inspection

From `tests/architecture/campobase-namespace-freeze.test.ts`:

- Current pinned size: **8**
- Bootstrap edge present:
  - `tests/lib/campobase-platform-bootstrap.test.ts::@/lib/campobase/platform-bootstrap`
- Factory edge present:
  - `tests/lib/factory-orchestrator.test.ts::@/lib/campobase/platform-bootstrap`

Can bootstrap edge be removed now?

- **Yes, conditionally** via Option C split migration (neutral + static adapter verification).

Can factory edge be removed now?

- **No** (runtime side-effect parity still legacy-protected there).

Expected sizes:

- remove bootstrap edge only => **7**
- remove factory edge only => **7**
- remove both => **6**

Conditions to remove bootstrap edge safely:

1. neutral coverage keeps deterministic parity expectations for SocialFlow/Clinic/TaskOps status model;
2. static adapter-policy checks preserve canonical-vs-legacy import guarantees and helper-contract expectations from legacy file;
3. no runtime or ownership boundary regressions are introduced.

Conditions to remove factory edge safely:

1. neutral path demonstrates equivalent runtime side-effects for factory-created SaaS bootstrapping;
2. automation/integration assertions remain protected by non-legacy equivalent coverage;
3. migration passes targeted regression tests reliably.

---

## Task 5 — Requested validations

Executed exactly and only:

1. `pnpm typecheck` ✅
2. `npx vitest run tests/lib/platform-bootstrap-loader.test.ts` ✅
3. `npx vitest run tests/lib/platform-bootstrap-loader-contract.test.ts` ✅
4. `npx vitest run tests/lib/campobase-platform-bootstrap.test.ts` ✅
5. `npx vitest run tests/lib/factory-orchestrator.test.ts` ✅
6. `npx vitest run tests/architecture/campobase-namespace-freeze.test.ts` ✅

No full suite, no formatter, no refactor.

---

## Task 6 — Final checkpoint summary

- Audit file created: **YES**
- Path: `docs/audits/PLATFORM_BOOTSTRAP_LEGACY_TEST_MIGRATION_READINESS_AFTER_NEUTRAL_PARITY.md`
- Production code modified: **NO**
- Tests modified: **NO**
- Guardrail modified: **NO**
- `campobase-platform-bootstrap.test.ts` reducible now: **YES (conditionally, Option C)**
- `factory-orchestrator.test.ts` reducible now: **NO**
- Recommended option: **Option C**
- Current guardrail size: **8**
- Expected size if bootstrap reduced: **7**
- Expected size if factory reduced: **7**
- Validation status: **all requested commands passed**
- Ready for next technical block: **YES**
- Next recommended block (do not implement here):
  - execute controlled Option C migration (split bootstrap legacy test into neutral + static adapter-policy verification) and update freeze allowlist from `8` to `7` in the same change.
