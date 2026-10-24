# Knowledge Inventory v1

This inventory covers the `240` audited knowledge surfaces in the repo.

Readability rule used here:

- Single, high-signal files are listed directly.
- Repetitive dated evidence families are grouped into explicit file families, with the family size called out in `Notes`.
- Raw `.txt` command dumps, routing manifests, and machine-state config JSON are not part of this inventory because they are validation artifacts, not reusable knowledge documents.

| Domain | File | Type | Scope | Status | Notes |
| --- | --- | --- | --- | --- | --- |
| TEMPLATES / META | `README.md` | root readme | repo-wide | OUTDATED | Default Next.js/Vercel bootstrap text conflicts with current Cloudflare Workers/OpenNext posture. |
| TEMPLATES / META | `docs/knowledge/README.md` | index | holding | PARTIALLY OUTDATED | Useful index, but incomplete and stale; does not reflect current inventory or SocialFlow live knowledge. |
| TEMPLATES / META | `docs/knowledge/knowledge-registry.v1.md` | registry | holding | PARTIALLY OUTDATED | Registry drift: missing real files, includes external paths, no SocialFlow pack entries. |
| TEMPLATES / META | `docs/knowledge/status.md` | status snapshot | holding | OUTDATED | Snapshot no longer reflects real inventory, domain split, or gaps. |
| TEMPLATES / META | `docs/knowledge/update-log.md` | changelog | holding | OUTDATED | Stops at initial DKS activation and misses ecosystem growth. |
| TEMPLATES / META | `docs/knowledge/how-to-contribute.md` | contribution guide | holding | PARTIALLY OUTDATED | Path references and workflow assumptions drift from actual tree/registry. |
| TEMPLATES / META | `docs/knowledge/templates/adr.md` | template | holding | VALID | Reusable ADR template. |
| TEMPLATES / META | `docs/knowledge/templates/agent-kb.md` | template | holding | VALID | Reusable agent knowledge template. |
| TEMPLATES / META | `docs/knowledge/templates/capsule.md` | template | holding | VALID | Reusable tenant-safe capsule template. |
| TEMPLATES / META | `docs/knowledge/templates/registration-template.md` | template | holding | PARTIALLY OUTDATED | Rule requiring only `docs/knowledge/` relative paths conflicts with live registry behavior. |
| TEMPLATES / META | `docs/knowledge/templates/runbook.md` | template | holding | VALID | Reusable runbook template. |
| TEMPLATES / META | `docs/knowledge/templates/swarm-kb.md` | template | holding | VALID | Reusable swarm template. |
| TEMPLATES / META | `docs/knowledge/templates/test-run.md` | template/playbook | holding | PARTIALLY OUTDATED | Good skeleton, but old factory and connector assumptions. |
| TEMPLATES / META | `docs/knowledge/standards/dks-system-spec.md` | standard | holding | VALID | Still matches DKS governance intent. |
| TEMPLATES / META | `docs/knowledge/standards/naming-standards.md` | standard | holding | VALID | Still matches knowledge tree conventions. |
| TEMPLATES / META | `docs/knowledge/privacy-boundaries.v1.md` | standard | holding | VALID | Still aligned with tenant isolation and capsule rules. |
| TEMPLATES / META | `docs/knowledge-base-overview.md` | module overview | repo-wide | VALID | Matches live `src/lib/knowledge/repository.ts` at a high level. |
| TEMPLATES / META | `docs/base/10-knowledge-bases.md` | base knowledge spec | repo-wide | PARTIALLY OUTDATED | Valuable layering model, but "20 files as canonical SSOT" is no longer true. |
| TEMPLATES / META | `docs/prompts/staff-knowledge-system.v2.md` | meta prompt | holding | UNCLEAR | Prompt/meta-governance artifact; not directly validated against runtime behavior in this pass. |
| TEMPLATES / META | `docs/prompts/system-prompt-drakobase.v1.md` | system prompt | holding | UNCLEAR | Prompt artifact; scope/usefulness not directly contrasted to live product code here. |
| TEMPLATES / META | `docs/prompts/interview-prompt.v1.md` | prompt | factory | UNCLEAR | Potentially useful, but prompt contract was not revalidated end-to-end. |
| TEMPLATES / META | `docs/prompts/drako-group-web-structure.v1.md` | prompt | holding | UNCLEAR | Structural prompt artifact, not live-source-of-truth. |
| TEMPLATES / META | `apps/base/README.md` | boundary readme | app boundary | UNCLEAR | Boundary marker only; not a substantive knowledge artifact. |
| TEMPLATES / META | `apps/drako/auths/README.md` | boundary readme | app boundary | VALID | Correctly marks auth isolation boundary. |
| TEMPLATES / META | `apps/mentoria/auths/README.md` | boundary readme | app boundary | VALID | Correctly marks auth isolation boundary. |
| CORE / HOLDING | `docs/base/00-index.md` | SSOT pack index | holding/factory | OUTDATED | Claims a current 20-file SSOT and Pages-era invariants; no longer canonical. |
| CORE / HOLDING | `docs/base/01-drako-overview.md` | architecture overview | holding/factory | PARTIALLY OUTDATED | Core concepts still useful, but provisioning/runtime wording predates current factory split. |
| CORE / HOLDING | `docs/base/02-brand-system.md` | standard | holding | UNCLEAR | Not contrasted against current brand implementation in this pass. |
| CORE / HOLDING | `docs/base/03-domains-routing.md` | routing spec | holding/factory | PARTIALLY OUTDATED | Older domain/routing contract needs reconciliation with Workers custom-domain path. |
| CORE / HOLDING | `docs/base/04-billing-stripe.md` | billing standard | holding/factory | PARTIALLY OUTDATED | Some fail-closed rules still good; Pages-era wording and older deploy assumptions remain. |
| CORE / HOLDING | `docs/base/05-data-model.md` | data model | holding/factory | PARTIALLY OUTDATED | Needs refresh against canonical registry/factory tables and recent migrations. |
| CORE / HOLDING | `docs/base/06-security.md` | security spec | holding | UNCLEAR | Not fully re-verified here. |
| CORE / HOLDING | `docs/base/07-observability.md` | observability spec | holding | UNCLEAR | Needs fresh verification against current workers/monitoring shape. |
| CORE / HOLDING | `docs/base/08-onboarding.md` | onboarding spec | factory | PARTIALLY OUTDATED | Likely still directionally useful, but not current SSOT. |
| CORE / HOLDING | `docs/base/09-migration-pipeline.md` | migration spec | factory | PARTIALLY OUTDATED | Needs alignment with Workers/OpenNext and current provisioning job flow. |
| CORE / HOLDING | `docs/base/11-connectors.md` | connector overview | holding | PARTIALLY OUTDATED | High-level idea survives, but live connector/product reality changed. |
| CORE / HOLDING | `docs/base/12-provisioning.md` | provisioning spec | factory | PARTIALLY OUTDATED | Useful intent, but older table/activation story; not the current canonical contract. |
| CORE / HOLDING | `docs/base/13-runbooks.md` | release/runbook pack | holding/factory | OUTDATED | Pages-based GO/NO-GO guidance conflicts with Workers-only path. |
| CORE / HOLDING | `docs/base/14-windsurf-workflow.md` | workflow guide | holding | UNCLEAR | Tooling-specific workflow doc not revalidated here. |
| CORE / HOLDING | `docs/base/15-release-gates.md` | release gates | holding/factory | OUTDATED | Release gates still treat Pages as canonical. |
| CORE / HOLDING | `docs/base/*.schema.json` | schema family | holding/factory | PARTIALLY OUTDATED | Four schema files remain useful as structure references, but the pack that presents them as current SSOT is stale. |
| CORE / HOLDING | `docs/architecture/auth-ssot.md` | architecture | holding | VALID | Still aligned with auth source-of-truth separation at a high level. |
| CORE / HOLDING | `docs/architecture/subsidiary_protocol.md` | architecture | holding/factory | PARTIALLY OUTDATED | Boundary intent still matters, but needs refresh against current factory split. |
| CORE / HOLDING | `docs/architecture/monetization_execution.md` | architecture | holding/factory | PARTIALLY OUTDATED | Monetization narrative needs alignment with current holding vs tenant billing split. |
| CORE / HOLDING | `docs/architecture/enterprise_holding.md` | legacy architecture | holding | OUTDATED | Self-marked legacy; single-holding billing/registry story is not the current canonical factory model. |
| CORE / HOLDING | `docs/infra/infra-status.md` | infra status | infra | VALID | Current enough to remain useful as infra posture reference. |
| CORE / HOLDING | `docs/infra/infra-watchdog.md` | infra runbook | infra | VALID | Operational watchdog doc still useful. |
| CORE / HOLDING | `docs/infra/infra-audit-checklist.md` | audit checklist | infra | VALID | Matches governance role. |
| CORE / HOLDING | `docs/infra/bindings-registry.md` | registry | infra | VALID | Useful infra inventory. |
| CORE / HOLDING | `docs/infra/env-profiles.md` | infra profile doc | infra | VALID | Useful reference. |
| CORE / HOLDING | `docs/infra/ci-verifiers.md` | CI verifier doc | infra | VALID | Still relevant. |
| CORE / HOLDING | `docs/infra/dashboard-schema.md` | schema doc | infra | VALID | Still useful as dashboard reference. |
| CORE / HOLDING | `docs/infra/cron-runbook.md` | runbook | infra | VALID | Still useful. |
| CORE / HOLDING | `docs/infra/alerts-agent.md` | ops doc | infra | VALID | Still useful. |
| CORE / HOLDING | `docs/policies/workers-inventory.md` | policy/inventory | holding | VALID | Current governance/evidence style. |
| CORE / HOLDING | `docs/policies/workers-drift-detection.md` | policy | holding | VALID | Current governance/evidence style. |
| CORE / HOLDING | `docs/policies/hostnames-drift-detection.md` | policy | holding | VALID | Current governance/evidence style. |
| CORE / HOLDING | `docs/policies/production-readiness-audits.md` | policy | holding | VALID | Current governance/evidence style. |
| CORE / HOLDING | `docs/policies/decommissioned-workers.md` | policy | holding | VALID | Useful decommission register. |
| CORE / HOLDING | `docs/runbooks/workers-only.md` | runbook | holding/factory | VALID | Matches current Workers-first direction. |
| CORE / HOLDING | `docs/runbooks/cf-workers-opennext.md` | runbook | holding/factory | VALID | Matches current Workers/OpenNext direction. |
| CORE / HOLDING | `docs/deploy/workers-deployment-guide.md` | deployment guide | holding/factory | VALID | Consistent with Workers deployment approach. |
| CORE / HOLDING | `docs/runbooks/holding-factory-boundaries.md` | boundary runbook | holding/factory/campo-base | VALID | Best current textual statement of holding/factory/product boundaries. |
| CORE / HOLDING | `docs/runbooks/cloudflare-pages-d1-bindings.md` | legacy runbook | deploy/runtime | OUTDATED | Pages-first remediation conflicts with Workers-only direction. |
| CORE / HOLDING | `docs/cf-pages-d1.md` | legacy runbook | deploy/runtime | OUTDATED | Pages-first remediation conflicts with current deployment posture. |
| CORE / HOLDING | `docs/runbooks/production-internal-deploy.md` | runbook | holding/factory | PARTIALLY OUTDATED | Mixes valid deployment concerns with older domain/status assumptions. |
| CORE / HOLDING | `docs/deploy/README.md`, `docs/deploy/cloudflare-token-setup.md`, `docs/deploy/cloudflare-workers-setup.md`, `docs/cloudflare-deploy-order.md`, `docs/deployments-cloudflare.md`, `docs/deploy-ci.md`, `docs/cloudflare-service-bindings.md` | deploy family | holding/factory | PARTIALLY OUTDATED | Seven deployment docs; Workers direction is mostly right, but some content spans older paths and should be consolidated. |
| CORE / HOLDING | `docs/runbooks/d1-migrations-and-drift.md`, `docs/runbooks/fix-missing-d1-binding.md`, `docs/runbooks/events-retention.md`, `docs/runbooks/public-surface-hardening.md`, `docs/runbooks/waf-rate-limits.md`, `docs/runbooks/auth-isolation.md` | runbook family | holding | VALID | Six focused operational runbooks remain useful and map to live governance concerns. |
| CORE / HOLDING | `docs/runbooks/drako-core-worker.md`, `docs/runbooks/drako-billing-worker.md`, `docs/runbooks/drako-ai-orchestrator-worker.md`, `docs/runbooks/drako-observability-worker.md`, `docs/runbooks/drako-provisioner-worker.md`, `docs/runbooks/autopilot-worker.md` | worker runbook family | holding/factory | VALID | Six worker-focused runbooks aligned with current workerized system shape. |
| CORE / HOLDING | `docs/runbooks/workers-multi-saas.md`, `docs/runbooks/workers-multi-saas-plan.md`, `docs/runbooks/workers-multi-saas-files.md`, `docs/runbooks/workers-multi-saas-migrations-no-downtime.md` | migration/runbook family | holding/factory | VALID | Four worker migration docs remain useful as operational history and pattern source. |
| CORE / HOLDING | `docs/operations/14-day-audit-protocol.md`, `docs/operations/baseline-seal.md`, `docs/operations/monitoring-guide.md`, `docs/operations/release-discipline.md`, `docs/operations/security-seal-phase15.md` | operations family | holding | VALID | Five dated operations docs; good evidence/governance, not product SSOT. |
| CORE / HOLDING | `docs/changelogs/2026-02-25-holding-core-and-provisioner.md` | changelog | holding/factory | VALID | Historical change record. |
| CORE / HOLDING | `docs/release-notes/2026-01-06-d1-binding-debug.md` | release note | holding | VALID | Historical release note; evidence only. |
| CORE / HOLDING | `docs/audits/production-readiness-latest.md`, `docs/audits/production-readiness-latest.json`, `docs/audits/hostnames-drift-latest.md`, `docs/audits/hostnames-drift-latest.json`, `docs/audits/workers-drift-latest.md`, `docs/audits/workers-drift-latest.json`, `docs/audits/production-clean.md` | audit family | holding/factory | VALID | Seven current audit artifacts; operational evidence, not narrative SSOT. |
| CORE / HOLDING | `docs/audits/drako-base-3-audit.md`, `docs/audits/drako-base-3-traffic-report.md` | audit family | holding | VALID | Historical evidence of platform state; do not treat as evergreen SSOT. |
| CORE / HOLDING | `docs/reports/opennext-tree.md`, `docs/reports/pages-project-migration.md`, `docs/reports/pages-opennext-worker-fix.md`, `docs/reports/pages-verification.md`, `docs/reports/runtime_normalization_inventory.md`, `docs/reports/edge_runtime_removal_verification.md`, `docs/reports/main_branch_deployment_fix.md` | runtime migration report family | holding/factory | VALID | Seven history/evidence docs documenting the move toward current runtime posture. |
| DRAKO FACTORY | `docs/audits/drako-factory-p0-readiness.md` | audit | factory | VALID | Current, high-signal factory readiness evidence. |
| DRAKO FACTORY | `docs/audits/ecosystem-live-checklist.md` | checklist/audit | holding/factory/products | VALID | Best current ecosystem posture snapshot; useful but intentionally strict and date-bound. |
| DRAKO FACTORY | `docs/checklists/p0-drako-factory.md` | checklist | factory | VALID | Current P0 hardening closeout. |
| DRAKO FACTORY | `docs/checklists/p0-campo-base-holding.md` | checklist | campo-base | VALID | Useful as holding-side readiness checklist. |
| DRAKO FACTORY | `docs/blueprint-factory-overview.md` | overview | factory | PARTIALLY OUTDATED | Blueprint/module concepts still useful, but narrative predates current canonical provisioning contract. |
| DRAKO FACTORY | `docs/blueprints/agents-catalog.v1.md`, `docs/blueprints/agents-specs.v1.md`, `docs/blueprints/interviews.v1.md` | blueprint family | factory | UNCLEAR | Three blueprint docs; conceptually relevant but not revalidated against current factory code in this audit. |
| DRAKO FACTORY | `docs/upgrade/projects-factory-audit.md` | upgrade audit | factory | VALID | High-value transition audit documenting current canonical tables and migration constraints. |
| DRAKO FACTORY | `docs/upgrade/agents-packs-factory-audit.md`, `docs/upgrade/agents-catalog-audit.md` | upgrade audit family | factory | VALID | Useful as factory migration evidence/history. |
| DRAKO FACTORY | `docs/reports/p0-meta-audit-fix-2026-02-27.md`, `docs/reports/p0.5-structural-validation-2026-02-27.md`, `docs/reports/p1-auth-inventory.md` | hardening report family | factory | VALID | Three current hardening reports; evidence only, not canonical docs. |
| DRAKO FACTORY | `docs/reports/saas_factory_automated.md` | report | factory | PARTIALLY OUTDATED | Still references older `holding_saas_registry` framing; useful as historical narrative, not live SSOT. |
| DRAKO FACTORY | `docs/reports/phase14_1_prod_evidence.md`, `docs/reports/phase15_*`, `docs/reports/phase16_*`, `docs/reports/phase17_*`, `docs/reports/phase18_*`, `docs/reports/phase19_*`, `docs/reports/phase20_*`, `docs/reports/phase21_build_fix.md`, `docs/reports/phase22*`, `docs/reports/phase23_*` | phase report family | factory/holding | VALID | Twenty-one dated evidence and closeout docs; retain as history, do not feed generator directly. |
| DRAKO FACTORY | `docs/reports/holding_monetization_status.md`, `docs/reports/monetization_holding.md`, `docs/reports/optimization-report-day0.md` | strategy report family | holding/factory | PARTIALLY OUTDATED | Useful history, but not safe as current canonical monetization truth without revalidation. |
| DRAKO FACTORY | `reports/production-ready-domains.md` | report | holding/factory | VALID | Historical evidence artifact. |
| CAMPO BASE | `docs/campamento-base-overview.md` | overview | campo-base | PARTIALLY OUTDATED | High-level intent still useful, but some provisioning/future-state language predates current boundary model. |
| CAMPO BASE | `docs/estado-campamento-base.md` | status/overview | campo-base | PARTIALLY OUTDATED | Captures internal owner-console/product ideas, but mixes UI detail with broad claims and lacks current scope boundaries. |
| CAMPO BASE | `docs/owner-control-tower.md` | module overview | campo-base | VALID | Still aligns with owner aggregate snapshot concept. |
| CAMPO BASE | `docs/owner-portfolio-overview.md` | module overview | campo-base | VALID | Still aligns with owner visibility boundary. |
| CAMPO BASE | `docs/owner-growth-autopilot-overview.md` | module overview | campo-base | VALID | Good deterministic playbook summary. |
| CAMPO BASE | `docs/owner-accounting-overview.md`, `docs/drako-vendor-overview.md`, `docs/economy-overview.md` | owner/economy family | campo-base | PARTIALLY OUTDATED | Useful business concepts, but not fully re-verified in this pass; keep as Campo Base-only knowledge. |
| CAMPO BASE | `docs/autopilot-overview.md`, `docs/tasks-and-autopilot-execution.md`, `docs/action-queue-runbook.md`, `docs/ai-orchestrator-runbook.md`, `docs/overseer_ops.md` | ops family | campo-base/holding | PARTIALLY OUTDATED | Five owner/ops docs; useful concepts but need boundary cleanup and current-state verification. |
| CAMPO BASE | `docs/conversations-overview.md` | overview | campo-base | UNCLEAR | Not directly revalidated in this audit. |
| PRODUCT-SPECIFIC / SOCIALFLOW | `docs/social-engine-overview.md` | product overview | SocialFlow | OUTDATED | Still documents demo/manual-only behavior while live LinkedIn publish and analytics refresh now exist. |
| PRODUCT-SPECIFIC / SOCIALFLOW | `docs/runbooks/provider-activation.md` | runbook | cross-product / SocialFlow-adjacent | PARTIALLY OUTDATED | Activation guidance predates live LinkedIn-specific SocialFlow contract. |
| PRODUCT-SPECIFIC / SOCIALFLOW | `docs/knowledge/knowledge-audit-report.md` | audit report | SocialFlow | VALID | Useful scoped audit proving SocialFlow knowledge gaps. |
| PRODUCT-SPECIFIC / MENTORIA | `docs/knowledge/production-readiness.md` | readiness doc | MentorIA | OUTDATED | Claims launch-ready status and references non-existent code path. |
| PRODUCT-SPECIFIC / MENTORIA | `docs/knowledge/global-expansion.md` | rollout log | MentorIA | UNCLEAR | Product-specific history not revalidated. |
| PRODUCT-SPECIFIC / MENTORIA | `docs/knowledge/production/growth-loop-live.md` | product ops doc | MentorIA | UNCLEAR | Product-specific and not validated end-to-end in this pass. |
| PRODUCT-SPECIFIC / MENTORIA | `docs/knowledge/prompts/mentoria-prompts.v1.md`, `docs/knowledge/prompts/mentoria-global-prompts.v1.md`, `docs/knowledge/prompts/mentoria-cognitive-prompts.v1.md` | prompt family | MentorIA | UNCLEAR | Product-specific prompt family; not safe as generic generator truth. |
| PRODUCT-SPECIFIC / MENTORIA | `docs/knowledge/standards/mentoria-execution-control.v1.md`, `docs/knowledge/standards/mentoria-global-blueprint.v1.md`, `docs/knowledge/standards/mentoria-growth-intelligence.v1.md`, `docs/knowledge/standards/mentoria-growth-strategy.v1.md`, `docs/knowledge/standards/mentoria-organic-growth-engine.v1.md` | standard family | MentorIA | UNCLEAR | Five product-specific standards; keep scoped to MentorIA until revalidated. |
| PRODUCT-SPECIFIC / MENTORIA | `docs/knowledge/capsules/mentoria-escolar-001.json`, `docs/knowledge/capsules/mentoria-pricing-copy.md`, `docs/knowledge/capsules/mentoria-ui-spec.md` | capsule family | MentorIA | UNCLEAR | Product/tenant-specific artifacts, not generic DKS truth. |
| PRODUCT-SPECIFIC / MENTORIA | `docs/knowledge/capsules/demo-lucia-activation.log`, `docs/knowledge/capsules/demo-parent-activation.log`, `docs/knowledge/capsules/demo-prompt-evaluation.log`, `docs/knowledge/capsules/mentoria-triage-simulation.log` | demo log family | MentorIA / examples | VALID | Four historical sample logs; useful as examples only, not as current operating truth. |
| PRODUCT-SPECIFIC / MENTORIA | `docs/audits/mentorias-migration.md` | audit | MentorIA | VALID | Historical migration evidence. |
| PRODUCT-SPECIFIC / MENTORIA | `docs/checklists/p0-mentorias-vertical.md` | checklist | MentorIA | VALID | Vertical-specific readiness checklist. |
| PRODUCT-SPECIFIC / DRAKO | `docs/drako-systems-v1.md` | product spec | drako.systems | PARTIALLY OUTDATED | Product idea still relevant, but endpoint/data-flow details predate current factory posture. |
| PRODUCT-SPECIFIC / DRAKO | `docs/drako-base-admin-v1.md` | product/admin spec | drako | UNCLEAR | Not directly verified in this pass. |
| PRODUCT-SPECIFIC / DRAKO | `docs/production-audit.md`, `production-audit.md`, `docs/production-checklist.md` | audit/checklist family | repo-wide | PARTIALLY OUTDATED | Production language exists in multiple places with overlapping authority; needs consolidation. |
| PRODUCT-SPECIFIC / CATALOG | `docs/saas-catalog-overview.md` | overview | vertical catalog | PARTIALLY OUTDATED | Catalog/packs idea still matches `src/lib/packs/definitions.ts`, but pricing/flow language needs refresh. |
| PRODUCT-SPECIFIC / CATALOG | `docs/knowledge/packs/packs-overview.md` | pack overview | holding/factory | PARTIALLY OUTDATED | Pack subsystem is real, but doc does not reflect current vertical coverage or SocialFlow absence. |
| PRODUCT-SPECIFIC / CATALOG | `docs/knowledge/packs/packs.v1.md` | pack narrative | holding/factory | PARTIALLY OUTDATED | Useful history, but not current canonical pack model. |
| PRODUCT-SPECIFIC / CONNECTORS | `docs/knowledge/connectors/manifesto.md` | manifesto | holding | VALID | Connector governance remains useful. |
| PRODUCT-SPECIFIC / CONNECTORS | `docs/knowledge/connectors/overview.md` | overview | holding | OUTDATED | Contradicted by live SocialFlow LinkedIn path and by connector registry state. |
| PRODUCT-SPECIFIC / CONNECTORS | `docs/knowledge/connectors/connectors-registry.md` | registry | holding | PARTIALLY OUTDATED | Still useful as registry shell, but statuses and scope drift. |
| PRODUCT-SPECIFIC / CONNECTORS | `docs/knowledge/connectors/gmail-connector.md`, `docs/knowledge/connectors/whatsapp-connector.md` | connector spec family | holding | UNCLEAR | Product/integration specs not revalidated in this pass. |
| PRODUCT-SPECIFIC / CONNECTORS | `docs/knowledge/connectors/templates/connector-template.md` | template | holding | VALID | Reusable template. |
| PRODUCT-SPECIFIC / CONNECTORS | `docs/whatsapp-gateway-overview.md` | module overview | product/campo-base | PARTIALLY OUTDATED | Subsystem still exists, but overview should be revalidated before feeding generator. |
| PRODUCT-SPECIFIC / MODULES | `docs/client-portal-overview.md`, `docs/staff-portal-overview.md`, `docs/tax-engine-overview.md` | module overview family | mixed products | UNCLEAR | Three module overviews not directly revalidated here. |
| PRODUCT-SPECIFIC / MODULES | `docs/ai-gateway.md`, `docs/ai-router-v1.1.md` | AI architecture family | holding/products | UNCLEAR | Two AI architecture docs not directly contrasted in this pass. |
| PRODUCT-SPECIFIC / MODULES | `docs/hr-guardrails-enforcement.md` | module/policy doc | holding/products | UNCLEAR | Not directly revalidated here. |
| PRODUCT-SPECIFIC / EVENTS | `docs/knowledge/events/support-case-example.v1.md` | event sample | example/demo | UNCLEAR | Useful sample, but not validated against current runtime. |
| HISTORICAL EVIDENCE | `docs/audits/auth-isolation-audit.md`, `docs/reports/phase15_isolation_evidence.md` | audit family | holding/security | VALID | Security/isolation evidence family; history, not current SSOT. |
| HISTORICAL EVIDENCE | `docs/runbooks/ai-incidents.md`, `docs/runbooks/steel-v1.0.1-incidents.md`, `docs/incidents/unexpected-local-changes.md` | incident family | holding | VALID | Historical/operational incident docs; useful as evidence and runbook seeds. |

## Reading Guidance

Use this inventory with three filters:

1. Teach Drako now
   - Focus on `VALID` and carefully selected `PARTIALLY OUTDATED` artifacts in Core/Holding, Factory, and current audits/runbooks.

2. Keep but do not teach as generic truth
   - Product-specific `UNCLEAR` artifacts and all dated evidence reports.

3. Repair before reuse
   - Any `OUTDATED` or registry/index/status artifact that still sounds canonical.
