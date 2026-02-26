# Hostnames And Routes Drift Detection Policy

Date: 2026-02-26  
Owner scope: Holding (Campamento Base)

## Why This Is P0

Ownership drift on hostnames/routes can reassign live traffic to the wrong worker and bypass isolation boundaries. This gate blocks unsafe ownership changes before holding deploys.

## Drift Definitions

`BLOCKER`:

- critical hostname missing from Workers Domains API
- critical hostname mapped to unexpected worker service
- critical route mapped to unexpected worker script
- any blocked service/script mapping detected (for example `drako-base-3`)

`WARN`:

- critical route missing from Workers Routes API when domains are managed through custom domains only

## Data Sources

- Source of truth: `docs/config/workers-hostnames-expected-state.json`
- Cloudflare API:
  - `GET /accounts/{account_id}/workers/domains`
  - `GET /zones/{zone_id}/workers/routes`

## Outputs

- JSON report: `docs/audits/hostnames-drift-latest.json`
- Markdown report: `docs/audits/hostnames-drift-latest.md`
- Console blocker messages include:
  - `DRIFT DETECTED: hostname ownership mismatch`
  - `EXPECTED: ...`
  - `ACTUAL: ...`

## What This Gate Does Not Do

- no changes to Cloudflare routes/domains
- no auto-remediation for hostname/route ownership
- no changes to SaaS workers and no binding mutations

## Blocked Mapping Example

If `drako.systems` or any other critical hostname is assigned to `drako-base-3`, the gate fails with `BLOCKER` and exits with code `1`.
