# SocialFlow Production Routing Review Pack

## Resumen Ejecutivo
This pack reviews the production DNS and routing shape for SocialFlow without changing DNS, routes, deploy state, or Cloudflare configuration.

## Estado Actual
- `readyForExecution=false`.
- `executionAllowed=false`.
- `commandsArePlannedOnly=true`.
- `requiresHumanApproval=true`.
- `productionTouchAllowed=false`.
- Review is read-only and planned-only.

## Dominio y Host Esperados
- Production base URL must remain planned-only until human approval.
- Expected host must be validated from the planned-only fixture or approved manual metadata.
- Fixture mode must use a `.invalid` host.

## Paths Esperados
- Health path: `/api/socialflow/runtime/health`.
- Readiness path: `/api/socialflow/runtime/readiness`.
- Both paths are review-only checks and do not call DNS or Cloudflare APIs.

## Worker Esperado
- Worker target should remain `saas-socialflows-runtime-production`.
- `workers_dev` must stay `false` in the production template.
- The production worker entry remains the approved static asset entrypoint.

## DNS Records Checklist
- Confirm the expected host is present in the planned-only review data.
- Confirm no active DNS change is applied in this phase.
- Confirm the hostname is still review-only and not cut over.

## Cloudflare Routes Checklist
- Confirm route examples remain commented in `apps/socialflow-runtime/wrangler.production.toml`.
- Confirm no active `routes =` or `route =` line is introduced.
- Confirm the route target remains planned-only.

## What This Phase Does Not Touch
- No deploy.
- No DNS changes.
- No Cloudflare route changes.
- No production traffic cutover.
- No D1 writes.
- No workflow changes.

## Blockers
- Missing planned-only fixture.
- Real domain in fixture data.
- Missing production template.
- Active route lines in the production template.
- Token-like values in review input.

## Rollback Routing Checklist
- Keep the route manifest commented until human approval.
- Abort if any active route line appears in the template.
- Restore the last approved route mapping if route review fails after approval.
- Re-run the routing review script after any route-manifest change.

## Criteria To Move To P1.6
- Routing review script exists and passes in fixture mode.
- Routing review pack exists and is referenced by the approval pack.
- Production template remains planned-only.
- No active DNS or route change is present.
- Human approval remains required.

## Decision
No DNS changes, no deploy, no production touch. This pack is for review only.
