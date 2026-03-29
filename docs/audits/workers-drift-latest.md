# Workers Drift Report

- Timestamp: `2026-03-28T15:24:56.663Z`
- Mode: `real`
- Source of truth: `docs/config/workers-expected-state.json`
- Fixtures dir: `n/a`
- Auto remediation enabled: `false`
- Auto remediation attempted: `false`
- Auto remediation actions: `none`

## Workers Summary

| Worker | Status | Severity | subdomain | schedulesCount | domainsCount | routesCount | Result |
| --- | --- | --- | --- | ---: | ---: | ---: | --- |
| drako-base-3 | ARCHIVED | BLOCKER | enabled=false, previews=false | 0 | 0 | 0 | PASS |
| drako-core-worker | ACTIVE | WARN | enabled=true, previews=true | 0 | 0 | 0 | PASS |
| drako-billing-worker | ACTIVE | WARN | enabled=true, previews=true | 0 | 0 | 0 | PASS |
| drako-observability-worker | ACTIVE | WARN | enabled=true, previews=true | 0 | 0 | 0 | PASS |
| drako-ai-orchestrator-worker | ACTIVE | WARN | enabled=true, previews=true | 0 | 0 | 0 | PASS |

## Drift Matrix

| Worker | subdomain.enabled | subdomain.previews_enabled | schedulesCount | domainsCount | routesCount |
| --- | --- | --- | --- | --- | --- |
| drako-base-3 | PASS | PASS | PASS | PASS | PASS |
| drako-core-worker | N/A | N/A | PASS | PASS | PASS |
| drako-billing-worker | N/A | N/A | PASS | PASS | PASS |
| drako-observability-worker | N/A | N/A | PASS | PASS | PASS |
| drako-ai-orchestrator-worker | N/A | N/A | PASS | PASS | PASS |

## Violations

- None

## Totals

- workersTotal: 5
- workersWithFailures: 0
- checksTotal: 17
- checksFailed: 0
- blockersTotal: 0
- warningsTotal: 0
