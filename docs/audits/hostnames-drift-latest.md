# Hostnames Drift Report

- Timestamp: `2026-03-28T15:24:50.009Z`
- Mode: `real`
- Source of truth: `docs/config/workers-hostnames-expected-state.json`
- Fixtures dir: `n/a`

## Summary

- Domains total: 11
- Routes total: 0
- Checks total: 25
- Checks pass: 23
- Checks fail: 1
- Checks N/A: 1
- Blockers: 0
- Warnings: 1

## Checks

| Check | Severity | Target Type | Target | Status | Expected | Actual |
| --- | --- | --- | --- | --- | --- | --- |
| unexpectedCriticalHostnameMissing | BLOCKER | hostname | drako.systems | PASS | "present" | "present" |
| hostnameMismatch | BLOCKER | hostname | drako.systems | PASS | "saas-drakos-prod" | "saas-drakos-prod" |
| unexpectedCriticalHostnameMissing | BLOCKER | hostname | base.drako.systems | PASS | "present" | "present" |
| hostnameMismatch | BLOCKER | hostname | base.drako.systems | PASS | "saas-bases-prod" | "saas-bases-prod" |
| unexpectedCriticalHostnameMissing | BLOCKER | hostname | bases.drako.systems | PASS | "present" | "present" |
| hostnameMismatch | BLOCKER | hostname | bases.drako.systems | PASS | "saas-bases-prod" | "saas-bases-prod" |
| unexpectedCriticalHostnameMissing | BLOCKER | hostname | mentoria.drako.systems | PASS | "present" | "present" |
| hostnameMismatch | BLOCKER | hostname | mentoria.drako.systems | PASS | "saas-mentorias-prod" | "saas-mentorias-prod" |
| unexpectedCriticalHostnameMissing | BLOCKER | hostname | mentorias.drako.systems | PASS | "present" | "present" |
| hostnameMismatch | BLOCKER | hostname | mentorias.drako.systems | PASS | "saas-mentorias-prod" | "saas-mentorias-prod" |
| unexpectedCriticalHostnameMissing | BLOCKER | hostname | drakos.drako.systems | PASS | "present" | "present" |
| hostnameMismatch | BLOCKER | hostname | drakos.drako.systems | PASS | "saas-drakos-prod" | "saas-drakos-prod" |
| blockedServiceHit | BLOCKER | domain | analytics.drako.systems | PASS | "service NOT IN [drako-base-3]" | "saas-analytics-prod" |
| blockedServiceHit | BLOCKER | domain | automations.drako.systems | PASS | "service NOT IN [drako-base-3]" | "saas-automations-prod" |
| blockedServiceHit | BLOCKER | domain | invoices.drako.systems | PASS | "service NOT IN [drako-base-3]" | "saas-invoices-prod" |
| blockedServiceHit | BLOCKER | domain | socialflows.drako.systems | PASS | "service NOT IN [drako-base-3]" | "saas-socialflows-prod" |
| blockedServiceHit | BLOCKER | domain | cryptos.drako.systems | PASS | "service NOT IN [drako-base-3]" | "saas-cryptos-prod" |
| blockedServiceHit | BLOCKER | domain | drako.systems | PASS | "service NOT IN [drako-base-3]" | "saas-drakos-prod" |
| blockedServiceHit | BLOCKER | domain | drakos.drako.systems | PASS | "service NOT IN [drako-base-3]" | "saas-drakos-prod" |
| blockedServiceHit | BLOCKER | domain | bases.drako.systems | PASS | "service NOT IN [drako-base-3]" | "saas-bases-prod" |
| blockedServiceHit | BLOCKER | domain | base.drako.systems | PASS | "service NOT IN [drako-base-3]" | "saas-bases-prod" |
| blockedServiceHit | BLOCKER | domain | mentorias.drako.systems | PASS | "service NOT IN [drako-base-3]" | "saas-mentorias-prod" |
| blockedServiceHit | BLOCKER | domain | mentoria.drako.systems | PASS | "service NOT IN [drako-base-3]" | "saas-mentorias-prod" |
| unexpectedCriticalRouteMissing | WARN | route | drako.systems/* | FAIL | "present" | "missing" |
| routeMismatch | BLOCKER | route | drako.systems/* | N/A | "saas-drakos-prod" | null |

## Drift Matrix

| Target | hostnameMissing | hostnameMismatch | routeMissing | routeMismatch | blockedService | blockedScript |
| --- | --- | --- | --- | --- | --- | --- |
| drako.systems | PASS | PASS | N/A | N/A | PASS | N/A |
| base.drako.systems | PASS | PASS | N/A | N/A | PASS | N/A |
| bases.drako.systems | PASS | PASS | N/A | N/A | PASS | N/A |
| mentoria.drako.systems | PASS | PASS | N/A | N/A | PASS | N/A |
| mentorias.drako.systems | PASS | PASS | N/A | N/A | PASS | N/A |
| drakos.drako.systems | PASS | PASS | N/A | N/A | PASS | N/A |
| analytics.drako.systems | N/A | N/A | N/A | N/A | PASS | N/A |
| automations.drako.systems | N/A | N/A | N/A | N/A | PASS | N/A |
| invoices.drako.systems | N/A | N/A | N/A | N/A | PASS | N/A |
| socialflows.drako.systems | N/A | N/A | N/A | N/A | PASS | N/A |
| cryptos.drako.systems | N/A | N/A | N/A | N/A | PASS | N/A |
| drako.systems/* | N/A | N/A | FAIL | N/A | N/A | N/A |

## Violations

- WARN unexpectedCriticalRouteMissing @ drako.systems/*: expected="present" actual="missing"
