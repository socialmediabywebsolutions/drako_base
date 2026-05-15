# P2-15 - SocialFlow Runtime Split Scaffold

## Scope

This pass prepares the physical scaffold for the approved SocialFlow partial runtime split.

It does **not** activate a new runtime, does **not** change active workers, does **not** touch production traffic, and does **not** deploy anything.

## Created Structure

### New runtime app scaffold

- `apps/socialflow-runtime/package.json`
- `apps/socialflow-runtime/tsconfig.json`
- `apps/socialflow-runtime/next.config.ts`
- `apps/socialflow-runtime/open-next.config.ts`
- `apps/socialflow-runtime/runtime-boundaries.json`
- `apps/socialflow-runtime/src/app/layout.tsx`
- `apps/socialflow-runtime/src/app/page.tsx`
- `apps/socialflow-runtime/src/middleware.ts`

### Shared package scaffold

- `packages/shared-neutral/`
  - `src/hosts.ts`
  - `src/marketing-locales.ts`
- `packages/shared-cloudflare/`
  - `src/opennext-cloudflare-config.ts`
- `packages/shared-ui-neutral/`
  - `src/app-providers.tsx`

### Canary worker scaffold

- `workers/socialflows-runtime-canary/wrangler.workers.toml`
- `workers/socialflows-runtime-canary/src/workers.ts`

### Build scaffold

- `scripts/build-socialflow-runtime-scaffold.mjs`
- root script: `pnpm socialflow-runtime:build`

## Boundary Classes

### SAFE_SHARED_PACKAGE

These are safe to consume from the future SocialFlow runtime without dragging control-plane/runtime coupling:

- `@shared-neutral/hosts`
- `@shared-neutral/marketing-locales`
- `@shared-cloudflare/opennext-cloudflare-config`
- `@shared-ui-neutral/app-providers`

### TEMP_SHARED

These remain transitional until the real runtime port moves business logic into the new app:

- `@/lib/socialflow/*`
- `@/lib/auths/*`
- `@/lib/db`
- `@/lib/cf`
- `@/lib/correlation`
- `@/lib/security/tenant-rate-limit`
- `@/lib/tenants/services`

These are allowed only as temporary bridge dependencies during later migration phases. They are not the end state.

### FORBIDDEN_SHARED

The future SocialFlow runtime must not import:

- `@/components/layouts/control-plane-layout`
- `@/components/sidebar`
- `@/components/right-panel`
- `@/app/nextauth-providers`
- `@/lib/mentoria/*`
- `@/lib/operator/*`
- `@/lib/campobase/*`
- `@/lib/campamento-base/*`
- `@/lib/drako/*`
- `@/lib/owner/*`
- `@/lib/dashboard/*`
- `@/app/(dashboard)/*`
- `@/app/operator/*`
- `@/app/admin/*`

These are now enforced by `tests/architecture/socialflow-runtime-split-scaffold.test.ts`.

## Code Extraction Done Here

This pass intentionally stays additive and reversible:

- neutral host-mode helpers were extracted into `packages/shared-neutral/src/hosts.ts`
- neutral marketing locale helpers were extracted into `packages/shared-neutral/src/marketing-locales.ts`
- neutral OpenNext Cloudflare config template was extracted into `packages/shared-cloudflare/src/opennext-cloudflare-config.ts`
- neutral app-provider scaffold was extracted into `packages/shared-ui-neutral/src/app-providers.tsx`

The active monolith continues using its current source paths for runtime behavior.

Only one active monolith file was rewired:

- `src/app/providers.tsx` now re-exports the neutral provider scaffold

This was chosen because it is neutral, reversible, and does not alter traffic or runtime activation.

## Canary Runtime State

The canary worker is intentionally inert:

- no `[[routes]]`
- no `custom_domain`
- `workers_dev = false`
- `main = "src/workers.ts"`
- handler returns `503 SOCIALFLOW_RUNTIME_CANARY_INACTIVE`

That means the folder exists as a future deployment target, but there is still no live traffic path to it.

## OpenNext State

The new runtime app has:

- its own `next.config.ts`
- its own `open-next.config.ts`
- its own `src/middleware.ts`
- its own app root

But no current production build uses it.

The `pnpm socialflow-runtime:build` command is a scaffold preflight, not a production OpenNext build:

- validates required files
- validates boundary manifest
- validates canary worker remains route-free
- writes `build/socialflow-runtime-scaffold/manifest.json`
- typechecks `apps/socialflow-runtime/tsconfig.json`

That gives us a safe independent build entrypoint without touching the active SocialFlow standalone artifact.

## Risks

- root `tsconfig` and `vitest` now know about the new package aliases, so future drift there must stay aligned
- the new packages are intentionally small; they are not yet the canonical source for the full monolith
- `TEMP_SHARED` still includes `@/lib/db` and auth bridges, so runtime isolation is not functionally complete yet
- the future actual OpenNext split still needs a separate build invocation and artifact wiring

## What This Pass Explicitly Did Not Move

- control-plane shell
- `Sidebar`
- `RightPanel`
- `HostSwitcher`
- NextAuth client coupling
- Mentoria bootstrap
- operator/drako/campobase/dashboard internals
- active SocialFlow worker config
- active standalone artifact

## Next Real Phase

The next implementation phase should port actual SocialFlow runtime code into `apps/socialflow-runtime/`:

- `socialflow/auth`
- `socialflow/(workspace)`
- `api/socialflow/*`
- SocialFlow-local middleware behavior
- SocialFlow-local imports onto `SAFE_SHARED_PACKAGE` or explicit temporary bridges

Only after that should a separate OpenNext build artifact for the canary runtime be introduced.
