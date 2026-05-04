# Production Readiness Audits Policy

Date: 2026-02-26  
Owner scope: Holding (Campamento Base)

## Definition

`productionReady=true` only when all `BLOCKER` checks pass in the Production Readiness Audit gate.

## Checks Covered

- critical workers state and archived worker fencing
- critical hostname ownership (`hostname -> worker service`)
- critical route ownership (`pattern -> worker script`)
- blocked mappings (`drako-base-3` must never be ingress target)
- critical datastores presence:
  - D1 databases
  - R2 buckets
  - KV namespaces
  - queues
  - durable object classes (if declared)
- critical D1 tables and critical columns
- onboarding consistency (`users.onboarding_completed`)
- legacy fail-closed guards for decommissioned configs (including `wrangler.workers.toml` preview `SOCIAL_DB`)
- SocialFlow auth future binding guardrails (`SOCIALFLOW_AUTHS_DB`):
  - no shared identity reuse with `DRACO_DB` / `SOCIAL_DB` / auth holding bindings
  - naming policy for dedicated auth ownership
  - preview vs production collision detection

## Severity Rules

- `BLOCKER`: fails readiness, script exits with code `1`
- `WARN`: reported in audits, does not fail readiness by itself

## Read-Only Contract

This gate is strictly read-only:

- reads Cloudflare APIs
- executes read-only D1 queries
- writes only local audit reports

It does not mutate domains, routes, bindings, workers, or any production resources.

## Reports

- JSON: `docs/audits/production-readiness-latest.json`
- Markdown: `docs/audits/production-readiness-latest.md`

Each report includes:

- timestamp
- execution mode (`real` or `fixtures`)
- productionReady verdict
- checks matrix and violations
- evidence snapshots for workers, hostnames/routes, datastores, and D1 schemas
