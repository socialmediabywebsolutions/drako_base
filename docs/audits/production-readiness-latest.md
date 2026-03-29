# Production Readiness Audit Report

- Timestamp: `2026-03-29T15:27:42.247Z`
- Mode: `real`
- Source of truth: `docs/config/production-audits-expected-state.json`
- Fixtures dir: `n/a`
- Production ready: `false`

## Summary

- Checks total: 1
- Checks pass: 0
- Checks fail: 1
- Checks N/A: 0
- Blockers: 1
- Warnings: 0

## Checks

| Check | Severity | Target | Status | Expected | Actual |
| --- | --- | --- | --- | --- | --- |
| criticalWorkerMissing | BLOCKER | global | FAIL | "successful production readiness execution" | "Missing required env: CLOUDFLARE_API_TOKEN" |

## Violations

- BLOCKER criticalWorkerMissing @ global: expected="successful production readiness execution" actual="Missing required env: CLOUDFLARE_API_TOKEN"
