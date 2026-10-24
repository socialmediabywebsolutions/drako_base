# Campamento Base Platform Bootstrap Loader Contract v1

## 1. Purpose

This contract defines a neutral platform bootstrap loader boundary that prepares a safe future exit from the legacy loader import `@/lib/campobase/platform-bootstrap`.

The contract-first goal is to preserve runtime guarantees currently covered by legacy tests while moving loader orchestration responsibilities into a canonical neutral boundary before any guardrail shrink.

This document does not implement runtime changes. It only defines expected ownership, behavior, API, and migration phases.

## 2. Ownership

Canonical ownership for this contract:

- Campamento Base: canonical neutral control-plane orchestration boundary.
- SocialFlow: canonical platform already available at `src/lib/campamento-base/socialflow-platform.ts`.
- Clinic: independent vertical SaaS domain; not owned by Campamento Base runtime domain logic.
- TaskOps: transversal engine/module; not owned by Campamento Base runtime domain logic.
- Campobase: frozen temporary legacy compatibility layer under `src/lib/campobase/`.

Implication:

- Campamento Base may orchestrate platform bootstrap as a neutral loader boundary.
- Campamento Base must not absorb Clinic or TaskOps domain/runtime behavior without explicit neutral contracts/adapters.

## 3. Current legacy behavior

Current behavior in `src/lib/campobase/platform-bootstrap.ts`:

- lazily registers default platform definitions/bootstraps once;
- loads SocialFlow from canonical namespace:
  - `@/lib/campamento-base/socialflow-platform`;
- still loads Clinic and TaskOps adapters from legacy namespace:
  - `@/lib/campobase/clinic-platform`
  - `@/lib/campobase/taskops-platform`;
- registers definition/bootstrap pairs into `@/lib/saas-contract` registry;
- exposes loader entrypoints:
  - `loadPlatformForSaas(tenantId, saasId)`
  - `registerSocialFlowPlatform(tenantId, saasId)`
  - `registerClinicPlatform(tenantId, saasId)`
  - `registerTaskOpsPlatform(tenantId, saasId)`.

Runtime guarantees currently used by `tests/lib/factory-orchestrator.test.ts`:

- runtime-created SaaS entries can be resolved and bootstrapped through a shared loader path;
- loader path triggers runtime automation/integration bootstrap effects.

Runtime and policy guarantees currently used by `tests/lib/campobase-platform-bootstrap.test.ts`:

- SocialFlow import is canonical;
- Clinic/TaskOps imports remain legacy in platform-bootstrap;
- shared loader routes bootstrap execution by `saasId`;
- explicit per-platform bootstrap helper entrypoints are still available.

## 4. Neutral loader boundary

Proposed neutral boundary target:

- preferred: `src/lib/campamento-base/platform-bootstrap-loader.ts`
- alternative (if capabilities packaging is preferred):
  - `src/lib/capabilities/internal-api-clients/platform-bootstrap-loader.ts`

Boundary intent:

- expose neutral loader orchestration APIs;
- consume platform definitions/bootstraps through neutral registry contracts;
- avoid direct legacy runtime imports in the neutral loader, except explicit adapter registration seams;
- return deterministic results for loader operations (resolved, skipped, not found, invalid registry).

Boundary responsibilities:

- list available platform bootstrap definitions;
- resolve one platform bootstrap definition by `saasId`;
- execute platform bootstrap in a deterministic way;
- validate registry consistency before runtime operations.

Boundary exclusions:

- no Clinic domain logic;
- no TaskOps domain logic;
- no migration of legacy adapter runtime internals.

## 5. Proposed API

The following API is proposed and intentionally not implemented in this block.

```ts
export type PlatformBootstrapLoaderDefinition = {
  platformKey: string;
  saasId: string;
  source: "canonical" | "adapter";
  owner: "campamento-base" | "clinic" | "taskops" | "other";
  matchesSaasId?: (saasId: string) => boolean;
  connect: (input: { tenantId: string; saasId: string }) => Promise<void>;
};

export type PlatformBootstrapLoaderResult = {
  status: "bootstrapped" | "skipped" | "not-found" | "invalid-registry";
  resolvedPlatformKey: string | null;
  resolvedSaasId: string | null;
};

export type PlatformBootstrapLoaderRegistry = {
  definitions: PlatformBootstrapLoaderDefinition[];
};

export function listPlatformBootstrapDefinitions(
  registry?: PlatformBootstrapLoaderRegistry,
): PlatformBootstrapLoaderDefinition[];

export function resolvePlatformBootstrapDefinition(
  saasId: string,
  registry?: PlatformBootstrapLoaderRegistry,
): PlatformBootstrapLoaderDefinition | null;

export async function runPlatformBootstrap(input: {
  tenantId: string;
  saasId: string;
  registry?: PlatformBootstrapLoaderRegistry;
}): Promise<PlatformBootstrapLoaderResult>;

export function validatePlatformBootstrapRegistry(
  registry?: PlatformBootstrapLoaderRegistry,
): { ok: true } | { ok: false; reason: string };
```

API expectations:

- deterministic outputs for equal inputs and equal registry state;
- explicit status results instead of silent runtime ambiguity;
- no direct mandatory dependency on `@/lib/campobase/*` in neutral loader implementation.

## 6. Migration strategy

Phased strategy:

A. Create neutral loader module with deterministic contract API.

B. Cover canonical SocialFlow first in neutral loader tests.

C. Introduce temporary explicit adapters for Clinic/TaskOps only if needed, preserving ownership boundaries and avoiding direct domain migration.

D. Migrate `tests/lib/factory-orchestrator.test.ts` to consume neutral loader contract path while preserving runtime guarantees.

E. Migrate `tests/lib/campobase-platform-bootstrap.test.ts` into:

- static adapter-policy assertions, and
- neutral runtime loader contract assertions.

F. After parity is proven, shrink guardrail from `8` to `7`, then `7` to `6` if both edges become removable.

## 7. Non-goals

This block explicitly does not:

- modify legacy `src/lib/campobase/platform-bootstrap.ts`;
- modify TaskOps runtime behavior;
- modify factory orchestrator runtime;
- modify guardrail allowlist/pinned size;
- move Clinic or TaskOps domain logic into Campamento Base;
- create any new import to `@/lib/campobase`.

## 8. First implementation block proposal

Proposed next technical block (not implemented here):

`create neutral platform bootstrap loader module and tests`

Suggested scope for that block:

- add neutral module skeleton and deterministic API;
- add focused tests for registry validation, resolution, and execution result statuses;
- cover SocialFlow canonical path first;
- keep legacy platform-bootstrap unchanged during first neutral implementation pass.
