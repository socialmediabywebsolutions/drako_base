# Production Readiness Audit Report

- Timestamp: `2026-05-15T19:27:41.136Z`
- Mode: `fixtures`
- Source of truth: `docs/config/production-audits-expected-state.json`
- Fixtures dir: `tests/fixtures/production-audits/pass`
- Production ready: `true`

## Summary

- Checks total: 186
- Checks pass: 182
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
| criticalRouteMissing | WARN | drako.systems/* | PASS | "present" | "present" |
| criticalRouteMismatch | BLOCKER | drako.systems/* | PASS | "saas-drakos-prod" | "saas-drakos-prod" |
| blockedServiceHit | BLOCKER | drako.systems | PASS | "service NOT IN [drako-base-3]" | "saas-drakos-prod" |
| blockedServiceHit | BLOCKER | drakos.drako.systems | PASS | "service NOT IN [drako-base-3]" | "saas-drakos-prod" |
| blockedServiceHit | BLOCKER | base.drako.systems | PASS | "service NOT IN [drako-base-3]" | "saas-bases-prod" |
| blockedServiceHit | BLOCKER | bases.drako.systems | PASS | "service NOT IN [drako-base-3]" | "saas-bases-prod" |
| blockedServiceHit | BLOCKER | mentoria.drako.systems | PASS | "service NOT IN [drako-base-3]" | "saas-mentorias-prod" |
| blockedServiceHit | BLOCKER | mentorias.drako.systems | PASS | "service NOT IN [drako-base-3]" | "saas-mentorias-prod" |
| blockedServiceHit | BLOCKER | socialflow.drako.systems | PASS | "service NOT IN [drako-base-3]" | "saas-socialflows-prod" |
| blockedServiceHit | BLOCKER | socialflows.drako.systems | PASS | "service NOT IN [drako-base-3]" | "saas-socialflows-prod" |
| blockedScriptHit | BLOCKER | drako.systems/* | PASS | "script NOT IN [drako-base-3]" | "saas-drakos-prod" |
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
| legacyProductionGuardMissing | BLOCKER | legacy:create-saas-route | PASS | ["LEGACY_SAAS_CREATE_BLOCKED","/api/owner/saas-factory/create-saas","status: 410"] | "all_tokens_present" |
| legacyProductionGuardMissing | BLOCKER | legacy:provision-commit-route | PASS | ["LEGACY_PROVISION_COMMIT_BLOCKED","/api/owner/saas-factory/create-saas","status: 410"] | "all_tokens_present" |
| legacyProductionGuardMissing | BLOCKER | legacy:saas-domain-route | PASS | ["LEGACY_SAAS_DOMAIN_ROUTE_BLOCKED","/api/domains/request","status: 410"] | "all_tokens_present" |
| legacyProductionGuardMissing | BLOCKER | legacy:saas-factory-queue-consumer | PASS | ["LEGACY_SAAS_FACTORY_QUEUE_BLOCKED","legacy.saas_factory_queue.blocked","message.ack"] | "all_tokens_present" |
| legacyProductionGuardMissing | BLOCKER | legacy:drako-base-3-preview-social-db-fail-closed | PASS | ["LEGACY_PREVIEW_SOCIAL_DB_FAIL_CLOSED","drako-base-3 preview stays unbound for SocialFlow data","Do not add SOCIAL_DB"] | "all_tokens_present" |
| legacyAuthDbFallbackFlagEnabled | BLOCKER | auth-db-fallback:legacy-flag | PASS | "ALLOW_LEGACY_AUTH_DB_FALLBACK disabled in production configs" | "not_enabled" |
| deployablePlaceholderDatabaseIdPresent | BLOCKER | deployable-configs:no-placeholder-d1-ids | PASS | "deployable wrangler configs avoid placeholder database ids [00000000-0000-0000-0000-000000000000]" | "no_placeholder_ids_detected" |
| socialflowAuthsBindingSharedIdentity | BLOCKER | socialflow:auths-binding-dedicated:shared_identity | PASS | "no identity overlap with [DRACO_DB, SAASES_DB, SOCIAL_DB, DRAKOS_AUTHS_DB, MENTORIAS_AUTHS_DB, BASES_AUTHS_DB, MENTORIA_DB]" | "no_overlap_detected" |
| socialflowAuthsBindingNamingViolation | BLOCKER | socialflow:auths-binding-dedicated:naming | PASS | "database_name includes socialflow + auth (except local collapsed dev)" | "naming_valid" |
| socialflowAuthsBindingPreviewProdCollision | BLOCKER | socialflow:auths-binding-dedicated:preview_prod_collision | PASS | "preview and production use distinct physical identities" | "distinct" |
| mentoriaAuthsBindingSharedIdentity | BLOCKER | mentoria:auths-binding-dedicated:shared_identity | PASS | "no identity overlap with [DRACO_DB, MENTORIA_DB, SOCIAL_DB, DRAKOS_AUTHS_DB, BASES_AUTHS_DB, SOCIALFLOW_AUTHS_DB]" | "no_overlap_detected" |
| mentoriaAuthsBindingNamingViolation | BLOCKER | mentoria:auths-binding-dedicated:naming | PASS | "database_name includes mentoria + auth (except local collapsed dev)" | "naming_valid" |
| mentoriaAuthsBindingPreviewProdCollision | BLOCKER | mentoria:auths-binding-dedicated:preview_prod_collision | PASS | "preview and production use distinct physical identities" | "distinct" |
| socialflowCanonicalHostnameMissing | BLOCKER | socialflow:canonical-domain-expected-state:canonical_hostname | PASS | "socialflow.drako.systems present" | "present" |
| socialflowCanonicalHostnameWrongWorker | BLOCKER | socialflow:canonical-domain-expected-state:canonical_worker | PASS | "socialflow.drako.systems -> saas-socialflows-prod" | "saas-socialflows-prod" |
| socialflowPluralPrimaryWarning | WARN | socialflow:canonical-domain-expected-state:plural_compatibility | PASS | "socialflows.drako.systems remains compatibility host, not primary" | "socialflows.drako.systems -> saas-socialflows-prod" |
| socialflowCanonicalSmokeMissing | BLOCKER | socialflow:canonical-domain-expected-state:canonical_smoke | PASS | {"files":["scripts/smoke/socialflow-canonical-domain-smoke.mjs","docs/runbooks/socialflow-canonical-domain-smoke.md"],"mustInclude":["socialflow.drako.systems","/socialflow","/socialflow/auth","/api/socialflow/profile","/api/social/posts","/api/social/linkedin/publish","/api/socialflow/linkedin/connect","socialflows.drako.systems"]} | "evidence_present" |
| mentoriaBindingMissingTransitionalDebt | BLOCKER | mentoria:db-binding-dedicated:missing_binding | PASS | "MENTORIA_DB configured" | "binding_present" |
| mentoriaBindingSharedIdentity | BLOCKER | mentoria:db-binding-dedicated:shared_identity | PASS | "no identity overlap with [DRACO_DB, SOCIAL_DB, DRAKOS_AUTHS_DB, MENTORIAS_AUTHS_DB, BASES_AUTHS_DB, SOCIALFLOW_AUTHS_DB]" | "no_overlap_detected" |
| mentoriaBindingPreviewProdCollision | BLOCKER | mentoria:db-binding-dedicated:preview_prod_collision | N/A | "preview must be isolated from production identities and be fail-closed or preview-marked" | "preview_not_configured" |
| mentoriaDbFallbackTransitionalDebt | BLOCKER | mentoria:db-binding-dedicated:fallback_transitional_debt | PASS | "env?.DRACO_DB removed" | "fallback_removed" |
| mentoriaGlobalDbImportLeakage | BLOCKER | mentoria:db-binding-dedicated:global_db_import_leakage | PASS | "Mentoria product code does not import global DB helpers" | "no_forbidden_imports" |
| mentoriaWorkerBindingLeakage | BLOCKER | mentoria:db-binding-dedicated:worker_binding_leakage | PASS | "Mentoria worker binds only MENTORIA_DB + MENTORIAS_AUTHS_DB for D1" | "no_forbidden_bindings" |
| socialflowCrossSaasLeakage | BLOCKER | socialflow:no-cross-saas-leakage | PASS | "no forbidden tokens [@/components/mentoria, @/lib/mentoria, /api/mentoria/, @/lib/campobase, @/lib/campamento-base, @/lib/auth/campamento-core, @/components/operator, @/components/owner, /api/operator/, /api/owner/, /api/campobase/, /api/campamento-base/]" | "no_forbidden_tokens" |
| operatorFinalUserApiLeakage | BLOCKER | operator:no-final-user-product-api-leakage | PASS | "no forbidden tokens [/api/mentoria/, /api/socialflow/, @/components/mentoria, @/components/saas/socialflow]" | "no_forbidden_tokens" |
| legacyCompatRouteDrift | BLOCKER | legacy-compat:owner-campobase-control-plane-only | PASS | "owner/campobase compat routes stay pinned to control-plane bridges" | "control_plane_compat" |
| legacyCompatInventoryDrift | BLOCKER | legacy-compat:inventory-locked | PASS | {"apiCompatPaths":["src/app/api/campobase/platform/route.ts","src/app/api/campobase/socialflow/route.ts","src/app/api/owner/accounting/route.ts","src/app/api/owner/action-queue/route.ts","src/app/api/owner/actions/[id]/decision/route.ts","src/app/api/owner/actions/[id]/dismiss/route.ts","src/app/api/owner/actions/[id]/execute/route.ts","src/app/api/owner/actions/[id]/snooze/route.ts","src/app/api/owner/actions/cleanup/route.ts","src/app/api/owner/actions/route.ts","src/app/api/owner/agents/route.ts","src/app/api/owner/autopilot/route.ts","src/app/api/owner/control-snapshot/route.ts","src/app/api/owner/db/health/route.ts","src/app/api/owner/domains/health/route.ts","src/app/api/owner/domains/route.ts","src/app/api/owner/domains/verify/route.ts","src/app/api/owner/events/rollup/route.ts","src/app/api/owner/events/route.ts","src/app/api/owner/factory/actions/route.ts","src/app/api/owner/factory/auto-recovery/route.ts","src/app/api/owner/factory/incidents/route.ts","src/app/api/owner/factory/recovery/retry-domain-verify/route.ts","src/app/api/owner/factory/recovery/retry-job/route.ts","src/app/api/owner/factory/status/route.ts","src/app/api/owner/factory/trends/route.ts","src/app/api/owner/governance/alerts/route.ts","src/app/api/owner/governance/route.ts","src/app/api/owner/marketing/route.ts","src/app/api/owner/observability/failures/route.ts","src/app/api/owner/observability/health/route.ts","src/app/api/owner/orchestrator/route.ts","src/app/api/owner/portfolio/route.ts","src/app/api/owner/profile/route.ts","src/app/api/owner/revenue/route.ts","src/app/api/owner/saas-factory/create-saas/route.ts","src/app/api/owner/saas-factory/jobs/[jobId]/route.ts","src/app/api/owner/saas-pricing/recommendations/route.ts","src/app/api/owner/support/tech/[id]/update/route.ts","src/app/api/owner/support/tech/route.ts","src/app/api/owner/support/tickets/[id]/reply/route.ts","src/app/api/owner/support/tickets/route.ts","src/app/api/owner/tasks/materialize-from-growth-autopilot/route.ts","src/app/api/owner/tasks/route.ts","src/app/api/owner/tasks/summary/route.ts","src/app/api/owner/tax/summary/route.ts","src/app/api/owner/treasury/snapshot/route.ts","src/app/api/owner/vendor/expenses/[id]/route.ts","src/app/api/owner/vendor/expenses/route.ts","src/app/api/owner/vendor/snapshot/route.ts"],"compatSurfacePaths":["src/app/campobase/platform/page.tsx","src/app/campobase/socialflow/page.tsx","src/app/owner/OwnerMarketingSection.tsx","src/app/owner/OwnerPricingSection.tsx","src/app/owner/OwnerTasksBoard.tsx","src/app/owner/OwnerVendorSection.tsx","src/app/owner/catalog/page.tsx","src/app/owner/components/CampamentoCenterPanel.tsx","src/app/owner/components/CampamentoLeftPanel.tsx","src/app/owner/components/CampamentoProfile.tsx","src/app/owner/components/CampamentoRightPanel.tsx","src/app/owner/components/LegacyFiscalForm.tsx","src/app/owner/domains/page.tsx","src/app/owner/page.tsx","src/app/owner/projects/[id]/page.tsx","src/app/owner/projects/create/page.tsx","src/app/owner/projects/page.tsx"]} | {"apiCompatPaths":["src/app/api/campobase/platform/route.ts","src/app/api/campobase/socialflow/route.ts","src/app/api/owner/accounting/route.ts","src/app/api/owner/action-queue/route.ts","src/app/api/owner/actions/[id]/decision/route.ts","src/app/api/owner/actions/[id]/dismiss/route.ts","src/app/api/owner/actions/[id]/execute/route.ts","src/app/api/owner/actions/[id]/snooze/route.ts","src/app/api/owner/actions/cleanup/route.ts","src/app/api/owner/actions/route.ts","src/app/api/owner/agents/route.ts","src/app/api/owner/autopilot/route.ts","src/app/api/owner/control-snapshot/route.ts","src/app/api/owner/db/health/route.ts","src/app/api/owner/domains/health/route.ts","src/app/api/owner/domains/route.ts","src/app/api/owner/domains/verify/route.ts","src/app/api/owner/events/rollup/route.ts","src/app/api/owner/events/route.ts","src/app/api/owner/factory/actions/route.ts","src/app/api/owner/factory/auto-recovery/route.ts","src/app/api/owner/factory/incidents/route.ts","src/app/api/owner/factory/recovery/retry-domain-verify/route.ts","src/app/api/owner/factory/recovery/retry-job/route.ts","src/app/api/owner/factory/status/route.ts","src/app/api/owner/factory/trends/route.ts","src/app/api/owner/governance/alerts/route.ts","src/app/api/owner/governance/route.ts","src/app/api/owner/marketing/route.ts","src/app/api/owner/observability/failures/route.ts","src/app/api/owner/observability/health/route.ts","src/app/api/owner/orchestrator/route.ts","src/app/api/owner/portfolio/route.ts","src/app/api/owner/profile/route.ts","src/app/api/owner/revenue/route.ts","src/app/api/owner/saas-factory/create-saas/route.ts","src/app/api/owner/saas-factory/jobs/[jobId]/route.ts","src/app/api/owner/saas-pricing/recommendations/route.ts","src/app/api/owner/support/tech/[id]/update/route.ts","src/app/api/owner/support/tech/route.ts","src/app/api/owner/support/tickets/[id]/reply/route.ts","src/app/api/owner/support/tickets/route.ts","src/app/api/owner/tasks/materialize-from-growth-autopilot/route.ts","src/app/api/owner/tasks/route.ts","src/app/api/owner/tasks/summary/route.ts","src/app/api/owner/tax/summary/route.ts","src/app/api/owner/treasury/snapshot/route.ts","src/app/api/owner/vendor/expenses/[id]/route.ts","src/app/api/owner/vendor/expenses/route.ts","src/app/api/owner/vendor/snapshot/route.ts"],"compatSurfacePaths":["src/app/campobase/platform/page.tsx","src/app/campobase/socialflow/page.tsx","src/app/owner/OwnerMarketingSection.tsx","src/app/owner/OwnerPricingSection.tsx","src/app/owner/OwnerTasksBoard.tsx","src/app/owner/OwnerVendorSection.tsx","src/app/owner/catalog/page.tsx","src/app/owner/components/CampamentoCenterPanel.tsx","src/app/owner/components/CampamentoLeftPanel.tsx","src/app/owner/components/CampamentoProfile.tsx","src/app/owner/components/CampamentoRightPanel.tsx","src/app/owner/components/LegacyFiscalForm.tsx","src/app/owner/domains/page.tsx","src/app/owner/page.tsx","src/app/owner/projects/[id]/page.tsx","src/app/owner/projects/create/page.tsx","src/app/owner/projects/page.tsx"]} |
| legacyCompatTelemetryGuardMissing | BLOCKER | legacy-compat:telemetry-and-sunset-markers | PASS | "all runtime guard rules satisfied" | "runtime_guard_ok" |
| artifactMatrixSkeletonDrift | BLOCKER | artifact-matrix:socialflow-standalone-global-still-active | PASS | {"state":"partial-split","deployMode":"global-open-next-plus-drakos-bases-mentorias-dedicated-and-socialflows-standalone","activeArtifactName":"open-next-build","products":["drakos","bases","mentorias","socialflows"]} | "artifact_matrix_skeleton_ok" |
| artifactSplitPrematureActivation | BLOCKER | artifact-matrix:no-premature-worker-switch | PASS | "only approved products use dedicated wrapper artifacts while the global deploy artifact remains open-next-build" | "artifact_split_inactive" |
| globalDeployDrift | BLOCKER | deploy-lane:global-worker-archived | PASS | "all runtime guard rules satisfied" | "runtime_guard_ok" |
| drakosPreparedArtifactGuardDrift | BLOCKER | drakos:dedicated-artifact-activated | PASS | "all runtime guard rules satisfied" | "runtime_guard_ok" |
| basesPreparedArtifactGuardDrift | BLOCKER | bases:dedicated-artifact-activated | PASS | "all runtime guard rules satisfied" | "runtime_guard_ok" |
| socialflowRuntimeGuardDrift | BLOCKER | socialflow:runtime-real-worker-only | PASS | "all runtime guard rules satisfied" | "runtime_guard_ok" |
| socialflowAssetsUploadRetryGuardDrift | BLOCKER | socialflow:deploy-assets-upload-session-retry | PASS | "all runtime guard rules satisfied" | "runtime_guard_ok" |
| socialflowStandaloneRuntimeActive | BLOCKER | socialflow:standalone-runtime-active | PASS | "all runtime guard rules satisfied" | "runtime_guard_ok" |
| socialflowStandaloneScopeAuditMissing | BLOCKER | socialflow:standalone-scope-audit | PASS | "SocialFlow standalone manifest and scope-audit.json include complete scope audit metadata" | {"scopeMode":"standalone-runtime-copy","foreignRouteCount":180,"scopedReady":false} |
| socialflowStandaloneForeignRouteLeak | WARN | socialflow:standalone-scope-audit | FAIL | "0 foreign routes before product-scoped activation" | {"scopeMode":"standalone-runtime-copy","foreignRouteCount":180,"foreignRouteHits":["api/bases","api/campamento-base","api/campobase","api/mentoria","api/mentorias","api/operator","api/owner","bases","campobase","mentoria","mentorias","operator","owner","site/panel"],"foreignRouteExamples":["api/bases/auths/logins","api/bases/auths/logouts","api/bases/auths/registrations","api/bases/telemetries/events","api/campamento-base/contracts","api/campamento-base/operator/whatsapp/daily-summary","api/campamento-base/operator/whatsapp/realtime-alert","api/campamento-base/orchestrator","api/campamento-base/provisioning/ai","api/campamento-base/provisioning/branding"]} |
| socialflowStandaloneFakeScopedClaim | BLOCKER | socialflow:standalone-scope-audit | PASS | "product-scoped claim only when no foreign routes remain" | {"scopeMode":"standalone-runtime-copy","foreignRouteCount":180,"scopedReady":false} |
| socialflowStandaloneScopeAuditDrift | BLOCKER | socialflow:standalone-scope-audit | PASS | "builder and CI keep generating and verifying SocialFlow scope audit metadata" | "scope_audit_guard_ok" |
| socialflowProductScopedPreviewMissing | BLOCKER | socialflow:product-scoped-preview | PASS | "SocialFlow product-scoped preview manifest, scope audit and filter report exist with complete metadata" | {"removedCount":451,"remainingCount":26,"runtimeIntegrity":true} |
| socialflowProductScopedPreviewFake | BLOCKER | socialflow:product-scoped-preview | PASS | "preview is inactive, derived from socialflows-standalone and contains real filtered/remaining routes" | {"artifactMode":"product-scoped-preview","artifactState":"inactive-preview","removedCount":451,"remainingCount":26} |
| socialflowProductScopedPreviewIntegrityFailure | BLOCKER | socialflow:product-scoped-preview | PASS | "runtimeIntegrity=true and no unresolved dependencies" | {"runtimeIntegrity":true,"unresolvedDependencies":[]} |
| socialflowProductScopedPreviewDrift | BLOCKER | socialflow:product-scoped-preview | PASS | "matrix, builder and CI keep the inactive product-scoped preview lane wired" | "product_scoped_preview_guard_ok" |
| socialflowProductScopedRuntimeAuditMissing | BLOCKER | socialflow:product-scoped-preview | PASS | "runtime-audit.json exists with complete route classification and risk metadata" | {"totalRoutes":26,"runtimeRiskScore":100,"scopedActivationReady":false} |
| socialflowProductScopedCrossProductLeak | WARN | socialflow:product-scoped-preview | PASS | "0 real cross-product leaks before product-scoped activation" | {"crossProductLeaks":0,"examples":[]} |
| socialflowProductScopedRuntimeAuditDrift | BLOCKER | socialflow:product-scoped-preview | PASS | "runtime audit matches manifest, filter-report and CI/builder wiring" | "runtime_audit_guard_ok" |
| socialflowProductScopedUnsafeActivationClaim | BLOCKER | socialflow:product-scoped-preview | PASS | "scopedActivationReady=true only when no cross-product leaks are present" | {"scopedActivationReady":false,"crossProductLeaks":0} |
| mentoriaRuntimeGuardDrift | BLOCKER | mentoria:runtime-real-wrapper-only | PASS | "all runtime guard rules satisfied" | "runtime_guard_ok" |
| socialflowCanonicalSmokeGuardDrift | BLOCKER | socialflow:canonical-smoke-strict | PASS | "strict canonical smoke with 410 legacy routes and no canonical 405 acceptance" | "strict_smoke_ok" |
| mentoriaStrictSmokeGuardDrift | BLOCKER | mentoria:local-smoke-strict | PASS | "all runtime guard rules satisfied" | "runtime_guard_ok" |
| mentoriaAuthsOperationalDrift | BLOCKER | mentoria:auth-operational-drift | PASS | "all runtime guard rules satisfied" | "runtime_guard_ok" |

## Violations

- WARN socialflowStandaloneForeignRouteLeak @ socialflow:standalone-scope-audit: expected="0 foreign routes before product-scoped activation" actual={"scopeMode":"standalone-runtime-copy","foreignRouteCount":180,"foreignRouteHits":["api/bases","api/campamento-base","api/campobase","api/mentoria","api/mentorias","api/operator","api/owner","bases","campobase","mentoria","mentorias","operator","owner","site/panel"],"foreignRouteExamples":["api/bases/auths/logins","api/bases/auths/logouts","api/bases/auths/registrations","api/bases/telemetries/events","api/campamento-base/contracts","api/campamento-base/operator/whatsapp/daily-summary","api/campamento-base/operator/whatsapp/realtime-alert","api/campamento-base/orchestrator","api/campamento-base/provisioning/ai","api/campamento-base/provisioning/branding"]}
