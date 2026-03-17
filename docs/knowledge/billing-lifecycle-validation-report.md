# Billing Lifecycle Validation Report

## Scope validated
- Stripe webhook handler: `src/app/api/webhooks/stripe/route.ts`
- Integration tests: `tests/stripe-webhook-route.test.ts`
- Commands executed: `pnpm install --frozen-lockfile --reporter=append-only`, `pnpm exec vitest run tests/stripe-webhook-route.test.ts`

## Events/flows validated (via Vitest)
- `invoice.paid` → resumes to active
- `invoice.payment_failed` → past_due + auto-pause check
- `customer.subscription.updated` (active/trialing) → resume
- `customer.subscription.updated` (past_due) → past_due + auto-pause check
- `customer.subscription.updated` (canceled/unpaid) → archive
- `customer.subscription.deleted` → archive
- Event without mapping → processed, no lifecycle
- Duplicate event → deduped, no lifecycle
- Invalid signature → 400

## Files touched in this phase
- `tests/stripe-webhook-route.test.ts` (mock hoisting fix)
- `docs/knowledge/billing-lifecycle-validation-report.md` (this report)

## Installation result
- Success: `pnpm install --frozen-lockfile --reporter=append-only` after removing `node_modules` (took ~1m06s).

## Vitest result
- Success: `pnpm exec vitest run tests/stripe-webhook-route.test.ts` → 1 file, 9 tests passed.

## Fix applied
- Adjusted test mocks to avoid hoist ReferenceError using `vi.hoisted` and `vi.importActual` for `StripeWebhookAuthError` in `tests/stripe-webhook-route.test.ts`.

## Traceability surfaces (current state)
- `stripe_webhook_events`: **OK** — insert/mark processed/mark failed performed in `dispatchStripeEvent` via `stripe-webhook-repository`.
- `billing_audit_logs`: **MISSING** — webhook handler does not write to billing audit log table.
- Lifecycle/economic events: **PARTIAL** — lifecycle transitions (`transitionToPastDue`, `resumeToActive`, `archiveSaaS`, `autoPauseIfPastDueExceeded`) execute inside lifecycle module, which records state transitions, but webhook request context is not persisted beyond `stripe_webhook_events`.

## Remaining risks
- No billing audit log entry tied to webhook processing; only `stripe_webhook_events` is persisted.
- Errors during lifecycle handlers would be marked failed in `stripe_webhook_events` but lack billing audit correlation.

## Recommended next minimal step
- Add a lightweight billing audit log write when a Stripe event is processed (or fails) capturing `stripe_event_id`, `tenant_id`, `saas_slug`, `billing_status`, and outcome (`processed`/`failed`), reusing existing `billing_audit_logs` helper if available; keep within current webhook handler without altering runtime or product surfaces.
