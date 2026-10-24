# P2-14 - SocialFlow Partial Runtime Split Blueprint

## Scope

This document defines the real target architecture for a partial runtime split of SocialFlow.

It does **not** activate the preview, does **not** change active workers, does **not** modify `workers/socialflows/wrangler.workers.toml`, and does **not** deploy anything.

The goal is to stop treating SocialFlow isolation as a filtered view of the monolith and instead define the smallest safe runtime boundary that can be built, audited, and deployed independently on Cloudflare/OpenNext.

## Executive Summary

- The current SocialFlow preview has already solved route filtering:
  - `crossProductLeaks=0`
  - `remainingCriticalLeaks=[]`
  - `foreignRouteCount=0`
- The remaining problem is no longer routing or tenant isolation.
- The remaining problem is **runtime topology**:
  - single root App Router graph
  - single global middleware
  - single OpenNext `server-functions/default`
  - shared client/server manifests
  - shared chunk graph
  - residual control-plane/bootstrap references
- Because of that, more preview filtering will keep producing diminishing returns.
- The recommended next step is **Option B: partial runtime split**, not another monolith-cleanup cycle.

## Evidence Snapshot

Current audited artifact:

- Active runtime: `workers/socialflows/wrangler.workers.toml` -> `.open-next/socialflows-standalone/worker.js`
- Preview runtime: `.open-next/socialflows-product-scoped-preview/worker.js`
- Preview state:
  - `artifactMode=product-scoped-preview`
  - `artifactState=inactive-preview`
  - `derivedFrom=socialflows-standalone`
- Current preview metrics:
  - `runtimeRiskScore=100`
  - `scopedActivationReady=false`
  - `crossProductLeaks=0`
  - `suspiciousRoutes=1`
  - `severityCounts={HIGH_RISK:6, MEDIUM_RISK:18, FRAMEWORK_METADATA:1, SAFE:1}`
  - `tenantIsolationCounts={VERIFIED_TENANT_ISOLATED:5, PARTIALLY_ISOLATED:0, UNVERIFIED:1, UNSAFE:0}`
- Current warnings:
  - `1 high-risk routes remain UNVERIFIED for tenant verification`
  - `16 shared chunks carry cross-product or shared-infra references`
  - `25 route client-reference manifests retain cross-product source references`
  - `middleware-manifest references missing server/src/middleware.js`

## 1. Runtime Map Actual

### 1.1 Build topology today

The current build is a single root Next/OpenNext application:

- Root app source: `src/app/*`
- Root middleware: `src/middleware.ts`
- Root Next config: `next.config.ts`
- Root OpenNext config: `open-next.config.ts`
- Build command: `npx opennextjs-cloudflare build`
- Canonical factory flow:
  - build root `.open-next`
  - emit dedicated wrappers for Drakos/Bases/Mentorias
  - emit SocialFlow standalone copy at `.open-next/socialflows-standalone`
  - emit SocialFlow filtered preview at `.open-next/socialflows-product-scoped-preview`

The artifact matrix generator confirms that SocialFlow is currently a copied runtime, not a separately built app:

- Source active artifact: `.open-next/worker.js`
- Active SocialFlow artifact: `.open-next/socialflows-standalone/worker.js`
- Preview source: `socialflows-standalone`

### 1.2 Worker/runtime topology today

The active SocialFlow worker is real and local:

- `workers/socialflows/wrangler.workers.toml`
  - `main = "../../.open-next/socialflows-standalone/worker.js"`
  - `directory = "../../.open-next/socialflows-standalone/assets"`

The generated worker itself proves the OpenNext runtime still resolves through a single default server-function bundle:

- imports `./middleware/handler.mjs`
- then imports `./server-functions/default/handler.mjs`

That means the runtime split already done for SocialFlow is still a **copy of a monolithic build output**, not a separately compiled SocialFlow app graph.

### 1.3 Route surface retained by the preview

The current filtered preview only keeps 26 routes:

- `_not-found`
- `api/socialflow/*`
- `socialflow/*`
- `products`
- `products/socialflow`
- framework metadata files such as `page.js`, `page_client-reference-manifest.js`, `favicon.ico`

This proves route filtering is already effective. The unresolved problem is what those retained routes still drag in through manifests and chunk graph.

## 2. Shared Graph Real

### 2.1 SHARED_BY_DESIGN

These are shared because they are legitimate platform dependencies, not contamination by themselves:

- Cloudflare account and deployment pipeline
- OpenNext Cloudflare wrapper model
- `globals.css`
- neutral locale/marketing helpers
- host-resolution and correlation primitives that can be reused across runtimes
- SocialFlow data-plane bindings already present in the dedicated worker:
  - `SAASES_DB`
  - `SOCIAL_DB`
  - `SOCIALFLOW_AUTHS_DB`
  - `SAASES_CACHE`
  - `SAASES_STORAGE`
  - `SAASES_EVENTS`

Important nuance:

- `SOCIALFLOW_AUTHS_DB` is already product-specific by binding.
- `DRACO_DB` and `@/lib/db` are **not** product-specific and remain a deliberate shared dependency for some SocialFlow routes.

### 2.2 SHARED_BY_FRAMEWORK

These are structural consequences of running SocialFlow inside the same App Router build:

- single root `src/app/layout.tsx`
- single root `src/middleware.ts`
- single `_not-found`
- single OpenNext middleware manifest with matcher `/:path*`
- single OpenNext `server-functions/default`
- client-reference manifests that still retain source references from the full app graph
- `app-build-manifest.json` listing routes well outside SocialFlow even after preview filtering

This is the strongest evidence that product-scoped preview has reached its technical limit inside the current build model.

### 2.3 SHARED_BY_CONTROL_PLANE

These are Drako architectural couplings still visible in the compiled graph:

- `src/components/layouts/shell-layout.tsx`
- `src/components/sidebar.tsx`
- `src/components/right-panel.tsx`
- `src/components/dev/HostSwitcher.tsx`
- control-plane layouts such as `src/app/(dashboard)/layout.tsx`
- operator/owner/campobase compatibility flows inside `src/middleware.ts`

P2-12 removed these from the root layout inheritance path, but manifests and chunk graph still retain them because the app still compiles as one runtime.

### 2.4 SHARED_BY_ACCIDENT

These are not fundamental requirements of SocialFlow, but the build still retains them:

- `products`
- `products/socialflow`
- `socialflow/auth`
- `_not-found`
- `src/app/nextauth-providers.tsx`
- `src/app/providers.tsx`
- `src/components/marketing/SiteHeader.tsx`

The runtime audit still attributes foreign product references to those surfaces even after root slimming.

## 3. Root Bootstrap and Boundary Findings

### 3.1 What no longer comes from the root

P2-12 did produce real source-level cleanup:

- `src/app/layout.tsx` is now minimal
- `initializeMentoriaWorkers()` moved to `src/app/mentoria/layout.tsx`
- `NextAuthProviders` moved under `src/app/site/SiteProviders.tsx`
- SocialFlow account settings no longer use `next-auth/react`
- control-plane shell is now routed through `ControlPlaneLayout`, not root

That work was valid and should be preserved.

### 3.2 Why the metrics barely moved

The artifact still reports:

- `_not-found` -> `ALLOWED_SHARED_RUNTIME`, `HIGH_RISK`
- `products` -> `SUSPICIOUS_SHARED_SURFACE`, `MEDIUM_RISK`
- `socialflow/auth` -> `ALLOWED_SOCIALFLOW`, `MEDIUM_RISK`

Those three remain contaminated because the build still compiles a single graph and a single middleware/runtime boundary.

### 3.3 Honest conclusion

Root slimming removed avoidable source coupling, but it did **not** solve runtime coupling because the remaining leaks are no longer source-rooted first; they are build-graph rooted.

## 4. Shared DB and Auth Reality

### 4.1 Auth boundary today

SocialFlow auth is already much cleaner than the rest of the monolith:

- `src/lib/socialflow/auth/server.ts`
- `src/lib/socialflow/auth/request.ts`
- `src/lib/socialflow/auth/tenant-isolation.ts`
- `src/lib/auths/repositories.ts`

Observed facts:

- SocialFlow session verification is fail-closed.
- Tenant propagation is verified against header, claims, and auth user record.
- SocialFlow auth resolves through `SOCIALFLOW_AUTHS_DB`.
- `next-auth/react` is no longer part of the SocialFlow account settings path.

What is still shared:

- auth cookie/token primitives live in shared code
- some routes still declare `@/lib/auths/cookies` as a medium-risk shared dependency

### 4.2 DB boundary today

SocialFlow still uses shared DB access in 5 verified routes plus `_not-found` contamination:

- `api/socialflow/exports/current`
- `socialflow/(workspace)/settings/account`
- `socialflow/(workspace)/settings/billing`
- `socialflow/(workspace)/settings/ownership`
- `socialflow/(workspace)/settings/team`
- `_not-found`

Important distinction:

- the business safety problem was reduced by tenant isolation verification
- the runtime isolation problem is still unsolved because `@/lib/db` remains part of the compiled shared runtime contract

This is acceptable for a **partial** split, but it means a partial split will not eliminate all shared data-plane risk by itself.

## 5. OpenNext and Cloudflare Constraints

### 5.1 What OpenNext allows

OpenNext/Cloudflare can support multiple independent runtimes if each runtime is built as its own app boundary with its own build output:

- its own `worker.js`
- its own `.build`
- its own `middleware`
- its own `server-functions/default`
- its own manifests
- its own uploaded artifact

Cloudflare workers also already fit Drako's deployment model because the repo already deploys multiple workers:

- root/global
- Drakos
- Bases
- Mentorias
- SocialFlow standalone

### 5.2 What OpenNext does not solve for us

OpenNext does **not** give true per-product runtime isolation from a single App Router build.

The current evidence is explicit:

- preview worker still imports one `server-functions/default/handler.mjs`
- preview middleware manifest is still global
- app build manifest still enumerates cross-product app routes
- client-reference manifests still retain cross-product source references

Therefore:

- preview filtering is good for **route pruning**
- preview filtering is not enough for **runtime graph isolation**

### 5.3 What multiple runtimes actually require

To get real isolation, Drako needs:

- multiple Next app roots, not just multiple filtered copies
- multiple OpenNext build invocations
- multiple worker artifacts
- per-runtime middleware
- shared code moved into neutral packages, not imported directly from the root app tree

### 5.4 What stays shared even after a partial split

Even with a successful partial split, these will still be shared:

- Cloudflare account
- deployment workflow family
- some secrets/vars
- selected D1 bindings
- possibly `DRACO_DB` for transitional shared DB access
- selected host-resolution and correlation helpers
- public marketing experience if intentionally left in the monolith

## 6. Exact Boundary of the Partial Split

## 6.1 Must move into the SocialFlow runtime

The new SocialFlow runtime should own these paths and responsibilities:

- workspace UI:
  - `src/app/socialflow/(workspace)/*`
- auth UI:
  - `src/app/socialflow/auth/page.tsx`
- canonical SocialFlow APIs:
  - `src/app/api/socialflow/*`
- SocialFlow domain libraries:
  - `src/lib/socialflow/*`
- SocialFlow feature modules:
  - `src/modules/socialflow-app/*`
- SocialFlow-specific auth/session boundary
- SocialFlow-specific middleware

Functional scope inside the new runtime:

- sessions
- campaigns
- exports
- settings
- profile
- AI generation/regeneration
- LinkedIn connect/callback
- posts
- auth login/registration/logout

### 6.2 Can remain shared temporarily

These can stay in the current monolith during the partial split:

- `src/app/products/page.tsx`
- `src/app/products/socialflow/page.tsx`
- `src/app/site/*`
- marketing copy and locale helpers
- neutral CSS
- neutral public shell

These are not part of the product runtime boundary and do not need to block the split.

### 6.3 Must stop being shared with SocialFlow runtime

The new SocialFlow runtime must not inherit these directly:

- root monolith `src/app/layout.tsx`
- root monolith `src/middleware.ts`
- `ShellLayout`
- `Sidebar`
- `RightPanel`
- `HostSwitcher`
- `NextAuthProviders`
- `initializeMentoriaWorkers()`
- monolith `server-functions/default`
- monolith client/server manifests
- hybrid auth client graph from public/control-plane surfaces

## 7. Recommended Target Architecture

### 7.1 Recommended directory model

The safest target is a second real Next app, not another filtered artifact:

```text
apps/
  socialflow-runtime/
    package.json
    next.config.ts
    open-next.config.ts
    tsconfig.json
    src/
      app/
        layout.tsx
        socialflow/
          auth/
          (workspace)/
        api/
          socialflow/
      middleware.ts
      lib/
      modules/
packages/
  shared/
  socialflow-domain/
workers/
  socialflows/
    wrangler.workers.toml              # stays untouched until cutover
  socialflows-runtime/
    wrangler.workers.toml              # future canary/non-active runtime
```

Important naming rule:

- do **not** reuse current `apps/socialflows` as if it were the runtime app
- current `apps/socialflows` is legacy/starter material, not the canonical runtime source

### 7.2 Recommended code ownership after the split

#### Remain in the monolith

- public marketing
- control-plane
- operator/owner/bases/mentoria/drakos experiences
- legacy redirects and compatibility surfaces

#### Move to SocialFlow runtime app

- SocialFlow auth
- SocialFlow workspace UI
- SocialFlow canonical APIs
- SocialFlow route-local middleware
- SocialFlow route-local layout graph

#### Extract to shared packages

- correlation helpers
- host normalization helpers
- selected auth primitives
- tenant-safe repository contracts
- DTOs and schemas reused by both runtimes

### 7.3 Runtime ownership after the split

#### SocialFlow runtime owns

- its own root layout
- its own `_not-found`
- its own middleware
- its own OpenNext manifests
- its own chunk graph
- its own worker bundle

#### Monolith keeps owning

- global/public site
- control-plane runtime
- drakos/bases/mentoria ecosystems
- the old preview path until formally retired

## 8. Worker and Binding Model

### 8.1 Future worker shape

The target partial split should eventually produce a new artifact such as:

- `.open-next/socialflows-runtime-partial/worker.js`
- `.open-next/socialflows-runtime-partial/assets`
- `.open-next/socialflows-runtime-partial/server-functions`
- `.open-next/socialflows-runtime-partial/.build`

And a future non-active worker config such as:

- `workers/socialflows-runtime/wrangler.workers.toml`

This should be built and validated before any cutover of the active SocialFlow worker.

### 8.2 Bindings that can remain shared initially

The partial split does **not** require a brand new data plane on day one.

It can keep using:

- `SAASES_DB`
- `SOCIAL_DB`
- `SOCIALFLOW_AUTHS_DB`
- `SAASES_CACHE`
- `SAASES_STORAGE`
- `SAASES_EVENTS`

It may also still need:

- `DRACO_DB` through a controlled shared runtime contract for the routes already audited as tenant-isolated

### 8.3 APIs that stay cross-runtime

During the partial split, these interactions will remain cross-runtime by design:

- public marketing linking into SocialFlow
- control-plane pages that manage SocialFlow externally
- shared observability/deploy pipelines

Those are acceptable as long as they are no longer part of the same **compiled runtime graph**.

## 9. Migration Phases

## P2-14A - Establish the app boundary without cutover

### Objective

Create the future SocialFlow app boundary and dependency map without touching active runtime.

### Scope

- define the new app root
- define import rules
- decide which shared modules become `packages/*`
- freeze which monolith routes remain out of scope

### Risk

- low to medium
- mostly build-system and path alias churn

### Rollback

- abandon the new app root
- keep current standalone runtime active

### Validation

- file graph audit
- import boundary audit
- no changes to active worker config

### Expected metrics

- no meaningful runtime metric change yet
- this phase is structural preparation only

## P2-14B - Port SocialFlow auth/workspace/api into the new app

### Objective

Move canonical SocialFlow runtime code into the new app boundary while preserving behavior.

### Scope

- `socialflow/auth`
- `socialflow/(workspace)`
- `api/socialflow/*`
- `src/lib/socialflow/*`
- `src/modules/socialflow-app/*`

### Risk

- medium
- auth/session mismatch
- path alias breakage
- missing shared package extraction

### Rollback

- stop building the new app
- keep serving current standalone artifact only

### Validation

- targeted SocialFlow tests
- auth/session regression tests
- tenant isolation tests
- no deploy

### Expected metrics

- new app artifact should have no control-plane shell references
- new app artifact should have no Mentoria bootstrap references
- `_not-found` should stop inheriting control-plane contamination

## P2-14C - Build independent OpenNext artifact and canary worker

### Objective

Produce a second real OpenNext runtime for SocialFlow without replacing the active worker.

### Scope

- independent `opennextjs-cloudflare build`
- separate `.open-next/socialflows-runtime-partial`
- separate worker config for canary/non-active validation
- separate artifact upload in CI

### Risk

- medium to high
- CI complexity
- duplicate install/build assumptions
- Cloudflare binding drift

### Rollback

- disable the new build job
- leave existing artifacts and deploy order intact

### Validation

- artifact existence
- worker integrity
- runtime audit on the new runtime
- smoke tests against non-production target only

### Expected metrics

- `crossProductLeaks=0`
- `suspiciousRoutes=0`
- `sharedChunkProducts=[]`
- no cross-product manifests in the new runtime

## P2-14D - Shadow verification and parity

### Objective

Prove the new SocialFlow runtime is functionally equivalent before cutover.

### Scope

- domain/auth flows
- workspace navigation
- settings
- exports
- AI routes
- LinkedIn flows
- rate limit and middleware parity

### Risk

- medium
- subtle middleware behavior differences
- cookie/path mismatches

### Rollback

- keep the new runtime dark
- keep current standalone runtime authoritative

### Validation

- smoke tests
- auth/session parity
- tenant isolation parity
- route inventory parity

### Expected metrics

- runtime graph contamination removed
- only intentional shared DB dependencies remain

## P2-14E - Cutover readiness

### Objective

Prepare the moment where `workers/socialflows/wrangler.workers.toml` can be switched to the new artifact in a later commit.

### Scope

- explicit go/no-go review
- compare active standalone vs new partial runtime
- define rollback artifact and deploy order

### Risk

- medium
- production parity gaps

### Rollback

- keep current standalone artifact active
- deploy nothing

### Validation

- canary runtime audit
- smoke coverage
- deploy dry run on non-production only

### Expected metrics

- enough confidence to decide activation in a separate commit

## 10. Honest Option Comparison

## Option A - Keep cleaning the monolith

### Complexity

- low to medium

### Risk

- low

### Time

- `2-5` engineering days

### Benefit

- low
- may remove a few residual references
- unlikely to eliminate the single-runtime graph problem

### Honest assessment

Good for small hygiene. Bad as the main path to isolation.

## Option B - Partial runtime split

### Complexity

- medium to high

### Risk

- medium

### Time

- `2-4` weeks for a senior engineer to produce the new runtime, canary it, and validate parity

### Benefit

- high
- removes the monolith runtime graph from SocialFlow
- keeps public site and control-plane stable
- preserves current data plane while isolating runtime plane

### Honest assessment

Best balance of value, safety, and migration cost.

## Option C - Full runtime split

### Complexity

- high

### Risk

- high

### Time

- `6-10+` weeks

### Benefit

- maximum isolation
- cleanest long-term architecture

### Honest assessment

Technically strongest, but too expensive as the next immediate move unless Drako also wants data-plane and public-site separation at the same time.

## 11. Success Metrics

## 11.1 Stage-1 success metrics for the partial split itself

These are the honest target metrics for a successful partial runtime split build:

- `crossProductLeaks=0`
- `suspiciousRoutes=0`
- `_not-found` no longer classified with cross-product manifest/chunk contamination
- `products` removed from the SocialFlow runtime entirely because marketing stays in the monolith
- `socialflow/auth` built only against SocialFlow-local graph
- `sharedChunkProducts=[]`
- manifest contamination from `auth,billing,campobase,clients,clinic,mentorias,operator,owner,parent` reduced to `[]`
- `HIGH_RISK <= 5`
  - the remaining expected high-risk routes are the already audited shared-DB routes
- `MEDIUM_RISK <= 2`
- `runtimeRiskScore <= 40`
- `runtimeIntegrity=true`
- `unresolvedDependencies=[]`

Important:

- `scopedActivationReady` may still remain `false` at this stage if the current policy still blocks on shared DB high-risk routes.
- That would not invalidate the split. It would mean the runtime plane is isolated but the shared data-plane contract still needs a later reduction pass.

## 11.2 Stage-2 activation metrics after later DB/runtime hardening

Only after the shared DB contract is reduced further should the activation target become:

- `HIGH_RISK <= 1`
- `runtimeRiskScore <= 10`
- `scopedActivationReady=true`

That is explicitly **not** promised by the partial split alone.

## 12. Final Architectural Dictamen

### Is partial split worth it?

Yes.

### What debt does it remove?

- single root runtime graph for SocialFlow
- shared manifests with control-plane/public surfaces
- dependency on monolith `_not-found`
- dependency on monolith middleware matcher
- dependency on monolith `server-functions/default`

### What debt does it not remove yet?

- shared DB access through `@/lib/db`
- some shared auth primitives
- Cloudflare/platform-level shared infra

### What stays shared after the split?

- Cloudflare account and deploy family
- selected bindings and secrets
- public marketing site
- control-plane product management surfaces
- selected host/auth/correlation packages

### What becomes truly isolated?

- SocialFlow bootstrap
- SocialFlow root layout
- SocialFlow middleware
- SocialFlow OpenNext build output
- SocialFlow manifests
- SocialFlow chunks
- SocialFlow worker artifact

### What still needs full split later if desired?

- fully independent data plane
- fully independent public/marketing site
- complete removal of shared DB high-risk routes

### Recommendation

Proceed with **Option B: partial runtime split**.

Do **not** spend another cycle on preview-only cleanup as the primary strategy.

## 13. Blueprint Readiness

This blueprint is ready to drive implementation planning for the next phase.

It is specific enough to support:

- app-boundary creation
- CI design
- artifact design
- worker design
- rollback planning
- metric-based go/no-go criteria

It is intentionally conservative:

- no activation claim
- no preview activation
- no worker cutover
- no metric manipulation
- no false promise that partial split alone solves shared DB risk
