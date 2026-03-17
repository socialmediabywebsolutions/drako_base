# Full Knowledge Ecosystem Audit

## 1. Scope

This audit stopped all feature/runtime work and focused only on knowledge surfaces.

Audited surfaces:

- `docs/knowledge/**`
- `docs/base/**`
- `docs/runbooks/**`
- `docs/audits/**`
- `docs/architecture/**`
- `docs/infra/**`
- `docs/policies/**`
- `docs/prompts/**`
- `docs/operations/**`
- `docs/checklists/**`
- `docs/upgrade/**`
- `docs/blueprints/**`
- `docs/reports/**`
- product/holding overview docs under `docs/*.md`
- root documentary artifacts: `README.md`, `production-audit.md`
- auth-boundary READMEs in `apps/drako/auths/README.md`, `apps/mentoria/auths/README.md`, `apps/base/README.md`

Reality was contrasted against live repository artifacts, especially:

- SocialFlow runtime and tests:
  - `src/lib/social/types.ts`
  - `src/lib/social/analytics-window.ts`
  - `src/lib/social/linkedin.ts`
  - `src/lib/social/live-publishing.ts`
  - `src/lib/social/repository.ts`
  - `src/components/saas/socialflow/SocialFlowDashboard.tsx`
  - `src/components/saas/socialflow/SocialFlowWorkspaceClient.tsx`
  - `tests/lib/social-analytics-window.test.ts`
  - `tests/api/social-live-publishing.test.ts`
- Factory and registry/runtime contracts:
  - `src/lib/campamento-base/saas-factory-orchestrator.ts`
  - `src/lib/saas/canonical-registry.ts`
  - `src/lib/packs/definitions.ts`
  - `src/lib/knowledge/repository.ts`
  - `migrations/0136_drako_factory_tenants_foundations.sql`
  - `migrations/0137_holding_control_tower_foundations.sql`

Audit sizing rule:

- Total audited knowledge surfaces: `240`
- Excluded from this count: raw terminal dumps and transient evidence `.txt` outputs, routing manifests, and config-state JSON whose purpose is machine validation rather than human knowledge transfer.

## 2. Knowledge Surfaces Discovered

The repository contains multiple parallel knowledge systems, not one.

Primary documentary surfaces:

- `docs/knowledge/` as the intended DKS tree
- `docs/base/` as an older "20-file SSOT" pack
- `docs/runbooks/` as current operational playbooks
- `docs/audits/` and `docs/reports/` as dated evidence and closeout records
- `docs/architecture/` as architectural narratives
- `docs/infra/` and `docs/policies/` as runtime/governance references
- `docs/prompts/` and `docs/knowledge/prompts/` as agent-behavior knowledge
- module/product overviews under `docs/*.md`
- product boundary READMEs under `apps/**/README.md`

Product/domain separation detected in the tree:

- Drako / Drako Factory
- Campo Base / Campamento Base / holding owner console
- SocialFlow
- MentorIA / Mentoria / Mentorias
- generic multi-SaaS patterns and vertical catalog/packs

## 3. Domain Classification

### A. CORE / HOLDING

Knowledge about global governance, infra posture, multi-SaaS architecture, deployment model, observability, privacy, policies, and billing boundaries.

Main surfaces:

- `docs/knowledge/standards/*`
- `docs/architecture/*`
- `docs/infra/*`
- `docs/policies/*`
- large parts of `docs/runbooks/*`

### B. DRAKO FACTORY

Knowledge that should teach the generator how future SaaS products are created and activated.

Main surfaces:

- `docs/base/*`
- factory-related runbooks/checklists/audits
- `docs/blueprint-factory-overview.md`
- `docs/blueprints/*`
- `docs/upgrade/*`
- `docs/audits/drako-factory-p0-readiness.md`
- `docs/audits/ecosystem-live-checklist.md`

### C. CAMPO BASE

Knowledge about the holding owner console and internal operations.

Main surfaces:

- `docs/campamento-base-overview.md`
- `docs/estado-campamento-base.md`
- `docs/owner-*.md`
- `docs/economy-overview.md`
- `docs/drako-vendor-overview.md`
- `docs/autopilot-overview.md`
- `docs/tasks-and-autopilot-execution.md`

### D. PRODUCT-SPECIFIC

Knowledge tied to a specific vertical and not safe to teach as generic factory truth.

Main surfaces:

- SocialFlow docs and gaps
- MentorIA standards/prompts/capsules/readiness docs
- drako.systems product narratives
- catalog/pack-specific material

### E. TEMPLATES / META-KNOWLEDGE

Knowledge about how knowledge itself is written, registered, versioned, and reused.

Main surfaces:

- `docs/knowledge/templates/*`
- `docs/knowledge/knowledge-registry.v1.md`
- `docs/knowledge/README.md`
- `docs/knowledge/status.md`
- `docs/knowledge/update-log.md`
- `docs/base/10-knowledge-bases.md`

## 4. Audit Matrix by Domain

| Domain | Overall Status | Reality Contrasted Against | Main Findings | Recommended Action |
| --- | --- | --- | --- | --- |
| CORE / HOLDING | PARTIALLY OUTDATED | `src/lib/saas/canonical-registry.ts`, `src/lib/campamento-base/saas-factory-orchestrator.ts`, `migrations/0136`, `migrations/0137`, recent runbooks/audits | Current runtime is Workers/OpenNext and canonical factory tables, but several core docs still teach Pages-era or legacy holding assumptions. | Repair the canonical core narrative before teaching Drako Generator from it. |
| DRAKO FACTORY | PARTIALLY OUTDATED | `src/lib/campamento-base/saas-factory-orchestrator.ts`, `src/lib/packs/definitions.ts`, `src/lib/saas/canonical-registry.ts`, recent audits/checklists | Strong reusable patterns exist in code and recent audits, but the older `docs/base/*` pack still claims an obsolete SSOT and older infra story. | Promote current contracts into a new canonical factory pack; demote legacy pack to historical reference. |
| CAMPO BASE | PARTIALLY OUTDATED | owner/campamento modules in repo, holding migrations, owner overviews | The ownership boundary is clearer in recent runbooks and migrations than in older Campamento Base narratives. Some docs still mix internal owner console concerns with reusable SaaS guidance. | Separate Campo Base-only knowledge from reusable SaaS factory knowledge. |
| PRODUCT-SPECIFIC | MIXED | SocialFlow runtime/tests, MentorIA docs, pack defs | SocialFlow live behavior is real but undocumented in the knowledge base. MentorIA has many docs but most are product-scoped and not validated in this pass. | Create product packs per vertical; do not keep mixing them into holding-wide registry truth. |
| TEMPLATES / META-KNOWLEDGE | PARTIALLY OUTDATED | `docs/knowledge/*`, `src/lib/knowledge/repository.ts` | Useful governance/template artifacts exist, but registry hygiene is broken and DKS index/status/update surfaces are stale. | Repair registry/index/status first so the rest of the ecosystem can be normalized safely. |

## 5. Valid Knowledge

Knowledge that remains valid now, either as live governance or as historical evidence that is still accurate for the time it records:

- `docs/knowledge/standards/dks-system-spec.md`
- `docs/knowledge/standards/naming-standards.md`
- `docs/knowledge/privacy-boundaries.v1.md`
- `docs/knowledge/connectors/manifesto.md`
- `docs/knowledge/templates/adr.md`
- `docs/knowledge/templates/agent-kb.md`
- `docs/knowledge/templates/capsule.md`
- `docs/knowledge/templates/runbook.md`
- `docs/knowledge/templates/swarm-kb.md`
- `docs/knowledge/connectors/templates/connector-template.md`
- `docs/knowledge/infra/ci-workflows/cron-workflow.md`
- `docs/runbooks/workers-only.md`
- `docs/runbooks/cf-workers-opennext.md`
- `docs/runbooks/holding-factory-boundaries.md`
- `docs/deploy/workers-deployment-guide.md`
- `docs/audits/drako-factory-p0-readiness.md`
- `docs/audits/ecosystem-live-checklist.md`
- `docs/audits/production-readiness-latest.md`
- `docs/audits/workers-drift-latest.md`
- `docs/audits/hostnames-drift-latest.md`

Why these stay valid:

- They either encode governance/templates that still match the repo, or
- they are explicitly dated evidence artifacts whose value is historical proof rather than current SSOT narration.

## 6. Outdated Knowledge

The most dangerous outdated knowledge is knowledge that still sounds canonical.

Clear outdated artifacts:

- `README.md`
  - Still reads like default Next.js/Vercel bootstrap documentation.
- `docs/base/00-index.md`
  - Claims a 20-file SSOT and Cloudflare Pages + D1 as canonical.
- `docs/base/13-runbooks.md`
  - GO/NO-GO logic is Pages-based.
- `docs/base/15-release-gates.md`
  - Release gates are Pages-based.
- `docs/knowledge/connectors/overview.md`
  - Says there are no active connectors and everything is planning-only.
- `docs/knowledge/production-readiness.md`
  - Declares MentorIA launch-ready while referencing a non-existent path.
- `docs/knowledge/status.md`
  - Snapshot does not reflect current inventory or knowledge gaps.
- `docs/knowledge/update-log.md`
  - Stops at the initial DKS activation and misses later growth.
- `docs/social-engine-overview.md`
  - Still frames publishing as manual/demo only, while live LinkedIn publishing and analytics refresh now exist.
- `docs/runbooks/cloudflare-pages-d1-bindings.md`
- `docs/cf-pages-d1.md`
  - Both preserve a Pages-first recovery story that conflicts with Workers-only guidance.

## 7. Unclear / Non-verifiable Knowledge

These artifacts may still be useful, but this audit could not verify them against the live code path being contrasted:

- MentorIA prompts, standards, capsules, and growth docs under `docs/knowledge/prompts/`, `docs/knowledge/standards/`, and `docs/knowledge/capsules/`
- `docs/knowledge/production/growth-loop-live.md`
- `docs/knowledge/global-expansion.md`
- `docs/blueprints/*`
- many module overview docs under `docs/*.md` that describe subsystems not directly validated in this pass
- historical phase reports whose claims were not re-exercised end-to-end during this audit

Operational rule:

- "Unclear" does not mean wrong.
- "Unclear" means do not teach it to Drako Generator as present truth until it is re-verified or clearly scope-tagged as product-only/history-only.

## 8. Missing Knowledge

The biggest gap is not a missing feature. It is missing documentation for features that already exist.

### SocialFlow gaps

Missing or undocumented in canonical knowledge:

- SocialFlow system overview/architecture pack
- SocialFlow registry entry in DKS
- readiness stages implemented in `getSocialProductSummary`
- dashboard-only commercial overlay for `FIRST_PAYING_USER_READY`
- LinkedIn access validation via `verifyLinkedInAccess`
- live-only LinkedIn publishing contract
- live analytics refresh flow and TTL/freshness behavior
- analytics health summary fields:
  - `recentActivity`
  - `recentIncidents`
  - `resolvedRecently`
  - `resolvedRecentlyCount`
  - `lastResolvedAt`
  - `lastWorkspaceSyncAt`
  - `lastHealthyLiveSyncAt`
  - `healthySyncFreshnessStatus`
  - `healthySyncNeedsRefresh`
- retry/review flow:
  - manual review note
  - mark reviewed
  - clear review after successful live recovery
- contextual refresh CTA behavior in the workspace
- tests as contract references for the live operator loop

### Drako Factory gaps

- Canonical reusable pack that teaches:
  - shared runtime activation
  - bootstrap readiness contract
  - custom-domain verification contract
  - canonical registry tables and job states
  - holding/factory/product boundary model
- Explicit statement that older `docs/base/*` is not the current SSOT
- Reusable pattern docs for billing overlay, operator loop, and narrow-live-path rollout

### Campo Base gaps

- A clean internal-only Campo Base knowledge area separated from generic factory guidance
- Explicit rule for what holding knowledge should never leak into vertical SaaS packs

## 9. Contradictions Between Docs and Code

1. `docs/knowledge/connectors/overview.md` says active connectors do not exist, but SocialFlow has live LinkedIn validation/publish/analytics code in `src/lib/social/linkedin.ts` and `src/lib/social/live-publishing.ts`.

2. `docs/social-engine-overview.md` still says manual publish only and no external APIs, but SocialFlow now publishes live LinkedIn posts and refreshes real LinkedIn analytics in `src/lib/social/live-publishing.ts` and `src/lib/social/repository.ts`.

3. `docs/base/00-index.md`, `docs/base/13-runbooks.md`, and `docs/base/15-release-gates.md` teach Pages-era release and routing assumptions, while current factory/runtime docs and code point to Workers/OpenNext and `shared_open_next_runtime` in `src/lib/campamento-base/saas-factory-orchestrator.ts`.

4. `docs/architecture/enterprise_holding.md` presents a legacy single-Stripe/single-registry model and says so itself, while current holding/factory separation is represented in `docs/runbooks/holding-factory-boundaries.md`, `migrations/0136_drako_factory_tenants_foundations.sql`, and `migrations/0137_holding_control_tower_foundations.sql`.

5. `docs/knowledge/production-readiness.md` references `src/app/saas/[id]/student/page.tsx`, which is absent from the repository.

6. `docs/knowledge/templates/registration-template.md` requires registry paths to stay under `docs/knowledge/`, but `docs/knowledge/knowledge-registry.v1.md` already violates that rule with external infra paths.

7. `docs/knowledge/README.md`, `docs/knowledge/status.md`, and `docs/knowledge/update-log.md` present the DKS as current and coherent, but the actual registry is incomplete and does not include the live SocialFlow knowledge surface.

## 10. Reusable Patterns Drako Should Learn

These patterns already exist in the repo and are worth teaching now.

1. Readiness plus commercial overlay
   - Operational readiness can stay product-owned while paid-readiness is a separate dashboard overlay.
   - Example: `PILOT_READY` becomes `FIRST_PAYING_USER_READY` only when billing and live-signal conditions are met.

2. Narrow live path with explicit transparency
   - One provider/channel can be real while the rest stay explicit demo mode.
   - SocialFlow uses real LinkedIn live paths while other providers remain visibly simulated.

3. Operator health contract, not just raw metrics
   - Health should include freshness, incidents, recovery state, manual review state, and recommended actions.
   - SocialFlow analytics health is a strong reusable operator-loop pattern.

4. Canonical provisioning contract
   - Reusable factory truth should center on `saas`, `saas_instances`, `saas_domains`, `provisioning_jobs`, and `campamento_provisioning`, plus a shared runtime contract.

5. Hard boundary separation
   - Holding owner console, Drako tenant factory, product workspaces, and tenant-level operations must stay separate in docs, registry, and generator learning.

## 11. Risks If Left Unfixed

1. Drako Generator will learn obsolete Pages-era and legacy holding assumptions.
2. Product-specific docs from Campo Base or MentorIA will contaminate generic factory output.
3. Real live SocialFlow behavior will remain trapped in code/tests and will not become reusable factory knowledge.
4. Engineers and agents will continue operating with multiple competing "sources of truth".
5. Historical evidence docs will be mistaken for current operating guidance because the registry/index/status layer is stale.

## 12. Recommended Normalization Order

1. Registry repair
   - Rebuild the DKS registry from actual inventory and declare what belongs inside it.
2. Outdated core docs
   - Fix/remove docs that still sound canonical but teach the wrong runtime or wrong ownership model.
3. Drako reusable patterns
   - Promote live factory/runtime/readiness/operator-loop patterns from code into generator-safe docs.
4. Campo Base normalization
   - Separate internal owner-console knowledge from reusable SaaS factory knowledge.
5. Product-specific packs
   - Create clean packs for SocialFlow, MentorIA, and any other real vertical.
6. Archive/cleanup
   - Demote legacy docs and dated evidence so they stop behaving like canonical guidance.

## 13. Final Summary

The repo already contains strong reusable patterns for Drako, but they are not sitting in one clean knowledge system. The best current truth is split across:

- live code
- recent audits/checklists/runbooks
- a partially broken DKS registry
- an older `docs/base/*` pack that still sounds canonical

The main audit conclusion is structural:

- the ecosystem does have valid knowledge,
- but it is mixed with stale canonical-sounding docs,
- missing live product packs,
- and blurred boundaries between holding, factory, Campo Base, and product-specific knowledge.

Drako can learn from this repo now, but only after normalization starts with registry repair and outdated-core-doc repair. Until then, the generator should learn from current code plus recent audits/runbooks, not from the full documentary surface indiscriminately.
