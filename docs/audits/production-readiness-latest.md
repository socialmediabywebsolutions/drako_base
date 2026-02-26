# Production Readiness Audit Report

- Timestamp: `2026-02-26T19:55:34.628Z`
- Mode: `real`
- Source of truth: `docs/config/production-audits-expected-state.json`
- Fixtures dir: `n/a`
- Production ready: `false`

## Summary

- Checks total: 77
- Checks pass: 69
- Checks fail: 5
- Checks N/A: 3
- Blockers: 4
- Warnings: 1

## Checks

| Check | Severity | Target | Status | Expected | Actual |
| --- | --- | --- | --- | --- | --- |
| criticalWorkerMissing | BLOCKER | drako-core-worker | PASS | "script exists" | "script exists" |
| criticalWorkerSubdomainMismatch | WARN | drako-core-worker | PASS | {"enabled":true,"previewsEnabled":true} | {"enabled":true,"previewsEnabled":true} |
| criticalWorkerSchedulesMismatch | WARN | drako-core-worker | PASS | 0 | 0 |
| criticalWorkerMissing | BLOCKER | drako-billing-worker | PASS | "script exists" | "script exists" |
| criticalWorkerSubdomainMismatch | WARN | drako-billing-worker | PASS | {"enabled":true,"previewsEnabled":true} | {"enabled":true,"previewsEnabled":true} |
| criticalWorkerSchedulesMismatch | WARN | drako-billing-worker | PASS | 0 | 0 |
| criticalWorkerMissing | BLOCKER | drako-observability-worker | PASS | "script exists" | "script exists" |
| criticalWorkerSubdomainMismatch | WARN | drako-observability-worker | PASS | {"enabled":true,"previewsEnabled":true} | {"enabled":true,"previewsEnabled":true} |
| criticalWorkerSchedulesMismatch | WARN | drako-observability-worker | PASS | 0 | 0 |
| criticalWorkerMissing | BLOCKER | drako-ai-orchestrator-worker | PASS | "script exists" | "script exists" |
| criticalWorkerSubdomainMismatch | WARN | drako-ai-orchestrator-worker | PASS | {"enabled":true,"previewsEnabled":true} | {"enabled":true,"previewsEnabled":true} |
| criticalWorkerSchedulesMismatch | WARN | drako-ai-orchestrator-worker | PASS | 0 | 0 |
| criticalWorkerMissing | BLOCKER | drako-base-3 | PASS | "archived script optional" | "script exists" |
| criticalWorkerArchivedMismatch | BLOCKER | drako-base-3 | PASS | {"domainsCount":0,"routesCount":0,"schedulesCount":0,"subdomain":{"enabled":false,"previewsEnabled":false}} | {"domainsCount":0,"routesCount":0,"schedulesCount":0,"subdomain":{"enabled":false,"previewsEnabled":false}} |
| criticalWorkerSubdomainMismatch | WARN | drako-base-3 | PASS | {"enabled":false,"previewsEnabled":false} | {"enabled":false,"previewsEnabled":false} |
| criticalWorkerSchedulesMismatch | WARN | drako-base-3 | PASS | 0 | 0 |
| criticalHostnameMissing | BLOCKER | drako.systems | PASS | "present" | "present" |
| criticalHostnameMismatch | BLOCKER | drako.systems | PASS | "saas-drakos-prod" | "saas-drakos-prod" |
| criticalHostnameMissing | BLOCKER | drakos.drako.systems | PASS | "present" | "present" |
| criticalHostnameMismatch | BLOCKER | drakos.drako.systems | PASS | "saas-drakos-prod" | "saas-drakos-prod" |
| criticalHostnameMissing | BLOCKER | base.drako.systems | PASS | "present" | "present" |
| criticalHostnameMismatch | BLOCKER | base.drako.systems | PASS | "saas-bases-prod" | "saas-bases-prod" |
| criticalHostnameMissing | BLOCKER | bases.drako.systems | PASS | "present" | "present" |
| criticalHostnameMismatch | BLOCKER | bases.drako.systems | PASS | "saas-bases-prod" | "saas-bases-prod" |
| criticalHostnameMissing | BLOCKER | mentoria.drako.systems | PASS | "present" | "present" |
| criticalHostnameMismatch | BLOCKER | mentoria.drako.systems | PASS | "saas-mentorias-prod" | "saas-mentorias-prod" |
| criticalHostnameMissing | BLOCKER | mentorias.drako.systems | PASS | "present" | "present" |
| criticalHostnameMismatch | BLOCKER | mentorias.drako.systems | PASS | "saas-mentorias-prod" | "saas-mentorias-prod" |
| criticalRouteMissing | WARN | drako.systems/* | FAIL | "present" | "missing" |
| criticalRouteMismatch | BLOCKER | drako.systems/* | N/A | "saas-drakos-prod" | null |
| blockedServiceHit | BLOCKER | analytics.drako.systems | PASS | "service NOT IN [drako-base-3]" | "saas-analytics-prod" |
| blockedServiceHit | BLOCKER | automations.drako.systems | PASS | "service NOT IN [drako-base-3]" | "saas-automations-prod" |
| blockedServiceHit | BLOCKER | invoices.drako.systems | PASS | "service NOT IN [drako-base-3]" | "saas-invoices-prod" |
| blockedServiceHit | BLOCKER | socialflows.drako.systems | PASS | "service NOT IN [drako-base-3]" | "saas-socialflows-prod" |
| blockedServiceHit | BLOCKER | cryptos.drako.systems | PASS | "service NOT IN [drako-base-3]" | "saas-cryptos-prod" |
| blockedServiceHit | BLOCKER | mentorias.drako.systems | PASS | "service NOT IN [drako-base-3]" | "saas-mentorias-prod" |
| blockedServiceHit | BLOCKER | mentoria.drako.systems | PASS | "service NOT IN [drako-base-3]" | "saas-mentorias-prod" |
| blockedServiceHit | BLOCKER | bases.drako.systems | PASS | "service NOT IN [drako-base-3]" | "saas-bases-prod" |
| blockedServiceHit | BLOCKER | base.drako.systems | PASS | "service NOT IN [drako-base-3]" | "saas-bases-prod" |
| blockedServiceHit | BLOCKER | drako.systems | PASS | "service NOT IN [drako-base-3]" | "saas-drakos-prod" |
| blockedServiceHit | BLOCKER | drakos.drako.systems | PASS | "service NOT IN [drako-base-3]" | "saas-drakos-prod" |
| criticalD1Missing | BLOCKER | drako_holding_db | PASS | "present" | "present" |
| criticalD1Missing | BLOCKER | drako_billing_db | PASS | "present" | "present" |
| criticalD1Missing | BLOCKER | drako_observability_db | PASS | "present" | "present" |
| criticalD1Missing | BLOCKER | drako_ai_orchestrator_db | PASS | "present" | "present" |
| criticalD1Missing | BLOCKER | drako_db_prod | PASS | "present" | "present" |
| criticalR2Missing | WARN | saas-drakos-prod-storage | PASS | "present" | "present" |
| criticalR2Missing | WARN | saas-bases-prod-storage | PASS | "present" | "present" |
| criticalR2Missing | WARN | saas-mentorias-prod-storage | PASS | "present" | "present" |
| criticalKvMissing | BLOCKER | DRKO_GLOBAL_CONFIG | PASS | "present" | "present" |
| criticalKvMissing | BLOCKER | saas_drakos_prod_cache | PASS | "present" | "present" |
| criticalQueueMissing | WARN | drako-global-events | PASS | "present" | "present" |
| criticalQueueMissing | WARN | drako-billing-queue | PASS | "present" | "present" |
| criticalTableMissing | BLOCKER | drako_holding_db.saases_registry | PASS | "present" | "present" |
| criticalColumnMissing | BLOCKER | drako_holding_db.saases_registry.saas_id | PASS | "present" | "present" |
| criticalColumnMissing | BLOCKER | drako_holding_db.saases_registry.saas_slug | PASS | "present" | "present" |
| criticalTableMissing | BLOCKER | drako_holding_db.agents_registry | PASS | "present" | "present" |
| criticalColumnMissing | BLOCKER | drako_holding_db.agents_registry.agent_id | PASS | "present" | "present" |
| criticalColumnMissing | BLOCKER | drako_holding_db.agents_registry.role_name | PASS | "present" | "present" |
| criticalTableMissing | BLOCKER | drako_holding_db.governance_events | PASS | "present" | "present" |
| criticalColumnMissing | BLOCKER | drako_holding_db.governance_events.event_id | PASS | "present" | "present" |
| criticalColumnMissing | BLOCKER | drako_holding_db.governance_events.event_type | PASS | "present" | "present" |
| criticalColumnMissing | BLOCKER | drako_holding_db.governance_events.schema_version | PASS | "present" | "present" |
| criticalTableMissing | BLOCKER | drako_holding_db.audit_logs | PASS | "present" | "present" |
| criticalColumnMissing | BLOCKER | drako_holding_db.audit_logs.action | PASS | "present" | "present" |
| criticalColumnMissing | BLOCKER | drako_holding_db.audit_logs.created_at | PASS | "present" | "present" |
| criticalTableMissing | BLOCKER | drako_holding_db.analyze_optimize_scale_runs | PASS | "present" | "present" |
| criticalColumnMissing | BLOCKER | drako_holding_db.analyze_optimize_scale_runs.run_id | PASS | "present" | "present" |
| criticalColumnMissing | BLOCKER | drako_holding_db.analyze_optimize_scale_runs.status_name | PASS | "present" | "present" |
| onboardingColumnsMismatch | BLOCKER | drako_holding_db.users.onboarding_completed | N/A | "present" | "table missing" |
| criticalTableMissing | BLOCKER | drako_db_prod.users | FAIL | "present" | "missing" |
| criticalTableMissing | BLOCKER | drako_db_prod.client_profiles | FAIL | "present" | "missing" |
| criticalTableMissing | BLOCKER | drako_db_prod.knowledge_bases | PASS | "present" | "present" |
| criticalColumnMissing | BLOCKER | drako_db_prod.knowledge_bases.id | PASS | "present" | "present" |
| criticalTableMissing | BLOCKER | drako_db_prod.jobs | FAIL | "present" | "missing" |
| criticalTableMissing | BLOCKER | drako_db_prod.documents | FAIL | "present" | "missing" |
| onboardingColumnsMismatch | BLOCKER | drako_db_prod.users.onboarding_completed | N/A | "present" | "table missing" |

## Violations

- WARN criticalRouteMissing @ drako.systems/*: expected="present" actual="missing"
- BLOCKER criticalTableMissing @ drako_db_prod.users: expected="present" actual="missing"
- BLOCKER criticalTableMissing @ drako_db_prod.client_profiles: expected="present" actual="missing"
- BLOCKER criticalTableMissing @ drako_db_prod.jobs: expected="present" actual="missing"
- BLOCKER criticalTableMissing @ drako_db_prod.documents: expected="present" actual="missing"
