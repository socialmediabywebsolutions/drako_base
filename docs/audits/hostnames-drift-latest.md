# Hostnames Drift Report

- Timestamp: `2026-05-18T08:29:09.427Z`
- Mode: `real`
- Source of truth: `docs/config/workers-hostnames-expected-state.json`
- Fixtures dir: `n/a`

## Summary

- Domains total: 0
- Routes total: 0
- Checks total: 1
- Checks pass: 0
- Checks fail: 1
- Checks N/A: 0
- Blockers: 1
- Warnings: 0

## Checks

| Check | Severity | Target Type | Target | Status | Expected | Actual |
| --- | --- | --- | --- | --- | --- | --- |
| hostnameMismatch | BLOCKER | hostname | global | FAIL | "successful hostnames drift execution" | "Missing required env: CLOUDFLARE_API_TOKEN" |

## Drift Matrix

| Target | hostnameMissing | hostnameMismatch | routeMissing | routeMismatch | blockedService | blockedScript |
| --- | --- | --- | --- | --- | --- | --- |
| global | N/A | FAIL | N/A | N/A | N/A | N/A |

## Violations

- BLOCKER hostnameMismatch @ global: expected="successful hostnames drift execution" actual="Missing required env: CLOUDFLARE_API_TOKEN"
