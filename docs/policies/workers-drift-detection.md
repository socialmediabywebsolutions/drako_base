# Workers Drift Detection

Scope: Holding-level Workers guardrails.

## Checks

Source of truth:

- `docs/config/workers-expected-state.json`

Runtime checks:

- `subdomain.enabled`
- `subdomain.previews_enabled`
- `schedulesCount`
- `domainsCount`
- `routesCount`

## Drift Definition

A worker is in drift when any `actual` value differs from `expected` from the source-of-truth JSON.

## Severity Rules

- `ARCHIVED` workers:
  - Always treated as `BLOCKER` on violation.
  - Drift forces non-zero exit (`exit 1`).
- `ACTIVE` workers:
  - `WARN` by default.
  - Can be set to `BLOCKER` in config to enforce hard stop.

## Auto-Remediation Scope

Auto-remediation is disabled by default and enabled with:

- `AUTO_REMEDIATE_ARCHIVED=true`

When enabled, it only acts on `ARCHIVED` workers and only on:

- disable subdomain (`enabled=false`)
- clear schedules (`[]`)

It does not modify:

- routes
- custom domains
- bindings
- SaaS workers

## Reports

Each run writes:

- `docs/audits/workers-drift-latest.json`
- `docs/audits/workers-drift-latest.md`

Reports include:

- timestamp
- worker summaries
- drift matrix (PASS/FAIL/N/A)
- violations with expected vs actual

## Real Example

If `drako-base-3` is manually resurrected with `subdomain.enabled=true`:

1. `check-workers-drift.ts` detects `BLOCKER` drift.
2. It prints:
   - `DRIFT DETECTED: drako-base-3 resurrected`
3. If `AUTO_REMEDIATE_ARCHIVED=true`, it attempts:
   - subdomain disable
   - schedules cleanup
4. It re-checks once and fails if drift remains.
