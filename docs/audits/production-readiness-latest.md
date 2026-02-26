# Production Readiness Audit Report

- Timestamp: `2026-02-26T21:20:09.676Z`
- Mode: `real`
- Source of truth: `docs/config/production-audits-expected-state.json`
- Fixtures dir: `n/a`
- Production ready: `true`

## Summary

- Checks total: 136
- Checks pass: 132
- Checks fail: 1
- Checks N/A: 3
- Blockers: 0
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
| criticalTableMissing | BLOCKER | drako_holding_db.holding_saases | PASS | "present" | "present" |
| criticalColumnMissing | BLOCKER | drako_holding_db.holding_saases.id | PASS | "present" | "present" |
| criticalColumnMissing | BLOCKER | drako_holding_db.holding_saases.saas_slug | PASS | "present" | "present" |
| criticalColumnMissing | BLOCKER | drako_holding_db.holding_saases.worker_name | PASS | "present" | "present" |
| criticalColumnMissing | BLOCKER | drako_holding_db.holding_saases.domain | PASS | "present" | "present" |
| criticalColumnMissing | BLOCKER | drako_holding_db.holding_saases.status_name | PASS | "present" | "present" |
| criticalTableMissing | BLOCKER | drako_holding_db.holding_billing_rollups | PASS | "present" | "present" |
| criticalColumnMissing | BLOCKER | drako_holding_db.holding_billing_rollups.saas_slug | PASS | "present" | "present" |
| criticalColumnMissing | BLOCKER | drako_holding_db.holding_billing_rollups.mrr | PASS | "present" | "present" |
| criticalColumnMissing | BLOCKER | drako_holding_db.holding_billing_rollups.churn | PASS | "present" | "present" |
| criticalColumnMissing | BLOCKER | drako_holding_db.holding_billing_rollups.refunds | PASS | "present" | "present" |
| criticalTableMissing | BLOCKER | drako_holding_db.holding_ops_tickets | PASS | "present" | "present" |
| criticalColumnMissing | BLOCKER | drako_holding_db.holding_ops_tickets.id | PASS | "present" | "present" |
| criticalColumnMissing | BLOCKER | drako_holding_db.holding_ops_tickets.saas_slug | PASS | "present" | "present" |
| criticalColumnMissing | BLOCKER | drako_holding_db.holding_ops_tickets.severity | PASS | "present" | "present" |
| criticalColumnMissing | BLOCKER | drako_holding_db.holding_ops_tickets.status_name | PASS | "present" | "present" |
| criticalTableMissing | BLOCKER | drako_holding_db.holding_event_logs | PASS | "present" | "present" |
| criticalColumnMissing | BLOCKER | drako_holding_db.holding_event_logs.id | PASS | "present" | "present" |
| criticalColumnMissing | BLOCKER | drako_holding_db.holding_event_logs.source | PASS | "present" | "present" |
| criticalColumnMissing | BLOCKER | drako_holding_db.holding_event_logs.type | PASS | "present" | "present" |
| criticalColumnMissing | BLOCKER | drako_holding_db.holding_event_logs.payload_json | PASS | "present" | "present" |
| onboardingColumnsMismatch | BLOCKER | drako_holding_db.users.onboarding_completed | N/A | "present" | "table missing" |
| criticalTableMissing | BLOCKER | drako_db_prod.tenants | PASS | "present" | "present" |
| criticalColumnMissing | BLOCKER | drako_db_prod.tenants.id | PASS | "present" | "present" |
| criticalColumnMissing | BLOCKER | drako_db_prod.tenants.owner_user_id | PASS | "present" | "present" |
| criticalColumnMissing | BLOCKER | drako_db_prod.tenants.saas_slug | PASS | "present" | "present" |
| criticalColumnMissing | BLOCKER | drako_db_prod.tenants.status | PASS | "present" | "present" |
| criticalColumnMissing | BLOCKER | drako_db_prod.tenants.created_at | PASS | "present" | "present" |
| criticalTableMissing | BLOCKER | drako_db_prod.tenant_profiles | PASS | "present" | "present" |
| criticalColumnMissing | BLOCKER | drako_db_prod.tenant_profiles.tenant_id | PASS | "present" | "present" |
| criticalColumnMissing | BLOCKER | drako_db_prod.tenant_profiles.business_name | PASS | "present" | "present" |
| criticalColumnMissing | BLOCKER | drako_db_prod.tenant_profiles.industry | PASS | "present" | "present" |
| criticalColumnMissing | BLOCKER | drako_db_prod.tenant_profiles.locale | PASS | "present" | "present" |
| criticalColumnMissing | BLOCKER | drako_db_prod.tenant_profiles.timezone | PASS | "present" | "present" |
| criticalTableMissing | BLOCKER | drako_db_prod.tenant_domains | PASS | "present" | "present" |
| criticalColumnMissing | BLOCKER | drako_db_prod.tenant_domains.tenant_id | PASS | "present" | "present" |
| criticalColumnMissing | BLOCKER | drako_db_prod.tenant_domains.requested_domain | PASS | "present" | "present" |
| criticalColumnMissing | BLOCKER | drako_db_prod.tenant_domains.status_name | PASS | "present" | "present" |
| criticalColumnMissing | BLOCKER | drako_db_prod.tenant_domains.cf_zone_id | PASS | "present" | "present" |
| criticalColumnMissing | BLOCKER | drako_db_prod.tenant_domains.created_at | PASS | "present" | "present" |
| criticalTableMissing | BLOCKER | drako_db_prod.tenant_integrations | PASS | "present" | "present" |
| criticalColumnMissing | BLOCKER | drako_db_prod.tenant_integrations.tenant_id | PASS | "present" | "present" |
| criticalColumnMissing | BLOCKER | drako_db_prod.tenant_integrations.provider | PASS | "present" | "present" |
| criticalColumnMissing | BLOCKER | drako_db_prod.tenant_integrations.status_name | PASS | "present" | "present" |
| criticalColumnMissing | BLOCKER | drako_db_prod.tenant_integrations.metadata_json | PASS | "present" | "present" |
| criticalTableMissing | BLOCKER | drako_db_prod.tenant_stripe_connect | PASS | "present" | "present" |
| criticalColumnMissing | BLOCKER | drako_db_prod.tenant_stripe_connect.tenant_id | PASS | "present" | "present" |
| criticalColumnMissing | BLOCKER | drako_db_prod.tenant_stripe_connect.connect_account_id | PASS | "present" | "present" |
| criticalColumnMissing | BLOCKER | drako_db_prod.tenant_stripe_connect.onboarding_status | PASS | "present" | "present" |
| criticalColumnMissing | BLOCKER | drako_db_prod.tenant_stripe_connect.fees_config | PASS | "present" | "present" |
| criticalTableMissing | BLOCKER | drako_db_prod.tenant_knowledge_bases | PASS | "present" | "present" |
| criticalColumnMissing | BLOCKER | drako_db_prod.tenant_knowledge_bases.tenant_id | PASS | "present" | "present" |
| criticalColumnMissing | BLOCKER | drako_db_prod.tenant_knowledge_bases.kb_id | PASS | "present" | "present" |
| criticalColumnMissing | BLOCKER | drako_db_prod.tenant_knowledge_bases.status_name | PASS | "present" | "present" |
| criticalTableMissing | BLOCKER | drako_db_prod.tenant_jobs | PASS | "present" | "present" |
| criticalColumnMissing | BLOCKER | drako_db_prod.tenant_jobs.tenant_id | PASS | "present" | "present" |
| criticalColumnMissing | BLOCKER | drako_db_prod.tenant_jobs.type_name | PASS | "present" | "present" |
| criticalColumnMissing | BLOCKER | drako_db_prod.tenant_jobs.status_name | PASS | "present" | "present" |
| criticalColumnMissing | BLOCKER | drako_db_prod.tenant_jobs.payload_json | PASS | "present" | "present" |
| criticalColumnMissing | BLOCKER | drako_db_prod.tenant_jobs.created_at | PASS | "present" | "present" |
| criticalTableMissing | BLOCKER | drako_db_prod.tenant_audit_logs | PASS | "present" | "present" |
| criticalColumnMissing | BLOCKER | drako_db_prod.tenant_audit_logs.tenant_id | PASS | "present" | "present" |
| criticalColumnMissing | BLOCKER | drako_db_prod.tenant_audit_logs.action | PASS | "present" | "present" |
| criticalColumnMissing | BLOCKER | drako_db_prod.tenant_audit_logs.actor | PASS | "present" | "present" |
| criticalColumnMissing | BLOCKER | drako_db_prod.tenant_audit_logs.metadata_json | PASS | "present" | "present" |
| criticalColumnMissing | BLOCKER | drako_db_prod.tenant_audit_logs.created_at | PASS | "present" | "present" |
| onboardingColumnsMismatch | BLOCKER | drako_db_prod.users.onboarding_completed | N/A | "present" | "table missing" |

## Violations

- WARN criticalRouteMissing @ drako.systems/*: expected="present" actual="missing"
