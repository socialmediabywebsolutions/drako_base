# Workers Drift Report

- Timestamp: `2026-05-02T09:34:13.785Z`
- Mode: `real`
- Source of truth: `docs/config/workers-expected-state.json`
- Fixtures dir: `n/a`
- Auto remediation enabled: `false`
- Auto remediation attempted: `false`
- Auto remediation actions: `none`

## Workers Summary

| Worker | Status | Severity | subdomain | schedulesCount | domainsCount | routesCount | Result |
| --- | --- | --- | --- | ---: | ---: | ---: | --- |

## Drift Matrix

| Worker | subdomain.enabled | subdomain.previews_enabled | schedulesCount | domainsCount | routesCount |
| --- | --- | --- | --- | --- | --- |

## Violations

- global [BLOCKER] execution: expected="successful drift evaluation" actual="Missing required env: CLOUDFLARE_API_TOKEN"

## Totals

- workersTotal: 0
- workersWithFailures: 0
- checksTotal: 0
- checksFailed: 0
- blockersTotal: 1
- warningsTotal: 0
