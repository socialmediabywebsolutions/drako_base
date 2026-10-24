# ADR - SocialFlow Canonical Domain

Date: 2026-05-04  
Status: Accepted  
Decision owner: Drako platform architecture  
Scope: decision record only; no Cloudflare, worker, workflow, route or runtime change

## Decision

`socialflow.drako.systems` will be the canonical product domain for SocialFlow.

`socialflows.drako.systems` will remain a compatibility/legacy domain, with a controlled redirect or bridge in a future implementation phase.

This ADR does not create the domain, attach it to a worker, change routing, change middleware, update workflows, or implement redirects.

## Context

- P10.11 found that the current confirmed SocialFlow domain in local worker config is `socialflows.drako.systems`.
- P10.11 found no local config or evidence confirming `socialflow.drako.systems`.
- SocialFlow product routes are singular: `/socialflow/*` and `/api/socialflow/*`.
- SocialFlow canonical code namespace is singular: `src/lib/socialflow/*`.
- The configured worker is `saas-socialflows-prod`.
- The current plural domain comes from legacy/starter/deploy naming.
- For independent SaaS sale, the public product domain should match the product brand and route language.

## Non-Goals

- No Cloudflare domain is created.
- No worker configuration is changed.
- No workflow is changed.
- No routing is changed.
- No redirect is implemented.
- No middleware is modified.
- No SocialFlow runtime internals are modified.
- No Mentoria code, config or documentation is modified by this decision.
- No data is migrated.

## Consequences

- A future phase must prepare the Cloudflare custom domain for `socialflow.drako.systems`.
- A future phase must point `socialflow.drako.systems` to `saas-socialflows-prod`.
- A future phase must add smoke tests for `socialflow.drako.systems`.
- A future phase must keep `socialflows.drako.systems` as compatibility/legacy, not as the primary product domain.
- Production readiness must eventually check ownership of the singular canonical domain.
- LinkedIn OAuth callback/domain configuration must be audited before switching any production callback URL.

## Acceptance Criteria For Future Implementation

- `socialflow.drako.systems` points to the correct worker: `saas-socialflows-prod`.
- `/socialflow` responds on `socialflow.drako.systems`.
- `/api/socialflow/*` responds on `socialflow.drako.systems`.
- SocialFlow auth routes respond under canonical host assumptions.
- LinkedIn OAuth callback uses the canonical domain if the integration requires absolute callback URLs.
- `socialflows.drako.systems` does not remain the primary product domain.
- `socialflows.drako.systems` remains compatible through an explicit redirect or bridge.
- Smoke tests pass for canonical and compatibility behavior.
- Readiness/hostname ownership checks include `socialflow.drako.systems` once the domain exists.
- No existing SocialFlow customers, sessions or OAuth flows break during the transition.

## Deferred Implementation Plan

1. Add `socialflow.drako.systems` to Cloudflare as a custom domain for `saas-socialflows-prod`.
2. Add readiness/hostname expected-state coverage for `socialflow.drako.systems`.
3. Add smoke tests for `/socialflow`, `/api/socialflow/profile` or an equivalent safe health endpoint, auth entrypoints, and OAuth callback assumptions.
4. Decide whether `socialflows.drako.systems` redirects permanently, redirects temporarily, or bridges for a retention window.
5. Update workflows only after domain ownership and smoke strategy are agreed.
6. Update public docs and sales material only after implementation passes.

## Evidence

- `workers/socialflows/wrangler.workers.toml` configures `pattern = "socialflows.drako.systems"`.
- `workers/socialflows/src/workers.ts` sets `domainName: "socialflows.drako.systems"`.
- P10.11 audit records no local evidence for `socialflow.drako.systems`.
- P10.11 audit records SocialFlow canonical routes as `/socialflow/*` and `/api/socialflow/*`.
- `docs/knowledge-pack/10_matriz_global_de_rutas_y_entrypoints.md` records SocialFlow canonical runtime under `src/app/socialflow/*`, `src/app/api/socialflow/*`, `src/lib/socialflow/*` and `src/lib/social-core/*`.
