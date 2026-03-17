# Knowledge Audit Report

## 1. Scope

This audit covered the full `docs/knowledge/` tree and contrasted it with the current SocialFlow implementation in:

- `src/lib/social/types.ts`
- `src/lib/social/analytics-window.ts`
- `src/lib/social/linkedin.ts`
- `src/lib/social/live-publishing.ts`
- `src/lib/social/repository.ts`
- `src/components/saas/socialflow/SocialFlowDashboard.tsx`
- `src/components/saas/socialflow/SocialFlowWorkspaceClient.tsx`
- `tests/lib/social-analytics-window.test.ts`
- `tests/api/social-live-publishing.test.ts`
- `tests/e2e/socialflow-factory-pilot.e2e.test.ts`

The contrast focused on the current SocialFlow knowledge surface for:

- readiness system
- `FIRST_PAYING_USER_READY`
- LinkedIn live publishing
- analytics health summary
- recent sync activity
- recent incidents
- retry/review workflow
- manual review notes
- `resolvedRecently` window
- `lastHealthyLiveSyncAt`
- `healthySyncFreshnessStatus`
- `healthySyncNeedsRefresh`
- contextual refresh CTA
- validation pipeline

No product code, runtime code, endpoints, components, or existing tests were modified during this phase.

## 2. Inventory

Documents found under `docs/knowledge/`:

- `docs/knowledge/README.md`
- `docs/knowledge/capsules/mentoria-escolar-001.json`
- `docs/knowledge/capsules/mentoria-pricing-copy.md`
- `docs/knowledge/capsules/mentoria-ui-spec.md`
- `docs/knowledge/connectors/connectors-registry.md`
- `docs/knowledge/connectors/gmail-connector.md`
- `docs/knowledge/connectors/manifesto.md`
- `docs/knowledge/connectors/overview.md`
- `docs/knowledge/connectors/templates/connector-template.md`
- `docs/knowledge/connectors/whatsapp-connector.md`
- `docs/knowledge/events/support-case-example.v1.md`
- `docs/knowledge/global-expansion.md`
- `docs/knowledge/how-to-contribute.md`
- `docs/knowledge/infra/ci-workflows/cron-workflow.md`
- `docs/knowledge/knowledge-registry.v1.md`
- `docs/knowledge/packs/packs-overview.md`
- `docs/knowledge/packs/packs.v1.md`
- `docs/knowledge/privacy-boundaries.v1.md`
- `docs/knowledge/production-readiness.md`
- `docs/knowledge/production/growth-loop-live.md`
- `docs/knowledge/prompts/factory-agents.v1.md`
- `docs/knowledge/prompts/mentoria-cognitive-prompts.v1.md`
- `docs/knowledge/prompts/mentoria-global-prompts.v1.md`
- `docs/knowledge/prompts/mentoria-prompts.v1.md`
- `docs/knowledge/standards/dks-system-spec.md`
- `docs/knowledge/standards/mentoria-execution-control.v1.md`
- `docs/knowledge/standards/mentoria-global-blueprint.v1.md`
- `docs/knowledge/standards/mentoria-growth-intelligence.v1.md`
- `docs/knowledge/standards/mentoria-growth-strategy.v1.md`
- `docs/knowledge/standards/mentoria-organic-growth-engine.v1.md`
- `docs/knowledge/standards/naming-standards.md`
- `docs/knowledge/standards/saas-factory-master-plan.md`
- `docs/knowledge/status.md`
- `docs/knowledge/templates/adr.md`
- `docs/knowledge/templates/agent-kb.md`
- `docs/knowledge/templates/capsule.md`
- `docs/knowledge/templates/registration-template.md`
- `docs/knowledge/templates/runbook.md`
- `docs/knowledge/templates/swarm-kb.md`
- `docs/knowledge/templates/test-run.md`
- `docs/knowledge/update-log.md`

Inventory observations:

- Total documents audited: `41`
- No document in `docs/knowledge/` currently documents the live SocialFlow system directly.
- `knowledge-registry.v1.md` omits `14` files that physically exist under `docs/knowledge/`.
- `knowledge-registry.v1.md` also lists `10` external `../infra/...` or sibling paths, which conflicts with the template rule that registry paths should stay relative to `docs/knowledge/`.

## 3. Document Status Matrix

| File | Status | Reason | Action Needed |
| --- | --- | --- | --- |
| `docs/knowledge/README.md` | PARTIALLY OUTDATED | Useful as an index, but it is incomplete, has duplicated numbering, and does not reflect the current inventory or any SocialFlow knowledge. | Refresh index structure and add SocialFlow-specific entry points. |
| `docs/knowledge/capsules/mentoria-escolar-001.json` | UNCLEAR | Tenant capsule is outside the audited SocialFlow code paths, so it could not be validated against the inspected implementation. | Keep scoped to MentorIA or move to a product-specific knowledge area. |
| `docs/knowledge/capsules/mentoria-pricing-copy.md` | UNCLEAR | Marketing copy is unrelated to SocialFlow implementation and not verifiable from the audited code. | Keep scoped to MentorIA or move out of the core knowledge registry. |
| `docs/knowledge/capsules/mentoria-ui-spec.md` | UNCLEAR | UI spec is for MentorIA and does not map to the SocialFlow surface audited here. | Keep scoped to MentorIA or move to product design docs. |
| `docs/knowledge/connectors/connectors-registry.md` | PARTIALLY OUTDATED | The registry is useful, but its statuses conflict with `connectors/overview.md` and it does not cover SocialFlow LinkedIn live behavior. | Reconcile connector status values and add explicit SocialFlow/LinkedIn connector coverage. |
| `docs/knowledge/connectors/gmail-connector.md` | UNCLEAR | Connector spec is outside SocialFlow scope and was not validated against the current audited SocialFlow paths. | Keep if still owned by connector work; otherwise relocate or scope-tag it. |
| `docs/knowledge/connectors/manifesto.md` | VALID | High-level connector principles still align with the repository’s privacy, OAuth, and integration posture. | Keep as governance-level connector guidance. |
| `docs/knowledge/connectors/overview.md` | OUTDATED | It states there are no active connectors and all examples are planning-only, which conflicts with the registry and existing connector artifacts. | Rewrite or archive this overview. |
| `docs/knowledge/connectors/templates/connector-template.md` | VALID | Template remains structurally usable and does not conflict with current code. | Keep as-is. |
| `docs/knowledge/connectors/whatsapp-connector.md` | UNCLEAR | Connector spec is not part of the SocialFlow implementation audited here. | Keep if still maintained; otherwise move or retag. |
| `docs/knowledge/events/support-case-example.v1.md` | UNCLEAR | Example event is not SocialFlow-specific and was not validated against current SocialFlow runtime behavior. | Keep as a sample or move under examples/demo knowledge. |
| `docs/knowledge/global-expansion.md` | UNCLEAR | MentorIA global rollout log is outside the SocialFlow system audited here. | Keep product-scoped or relocate to MentorIA operations docs. |
| `docs/knowledge/how-to-contribute.md` | PARTIALLY OUTDATED | Contribution flow is still useful, but it references missing `adr/` and `walkthrough.md` locations and does not describe current registry drift. | Fix paths and add registry hygiene rules. |
| `docs/knowledge/infra/ci-workflows/cron-workflow.md` | VALID | The workflow file and referenced automation assets largely exist; the optional purge script is explicitly optional. | Keep as-is. |
| `docs/knowledge/knowledge-registry.v1.md` | PARTIALLY OUTDATED | Central registry exists, but it omits many real files, includes out-of-scope external paths, and has no SocialFlow-specific entries. | Rebuild registry from actual inventory and add SocialFlow artifacts. |
| `docs/knowledge/packs/packs-overview.md` | PARTIALLY OUTDATED | Pack overview still matches a real pack subsystem, but it does not reflect SocialFlow as a documented pack/knowledge surface. | Update with current pack coverage and SocialFlow-specific mapping if intended. |
| `docs/knowledge/packs/packs.v1.md` | PARTIALLY OUTDATED | Pricing tier concepts still exist in code, but this pack narrative is not registered, not tied to the audited SocialFlow system, and diverges from the actual vertical-pack model. | Clarify whether this is canonical pricing guidance or archive it. |
| `docs/knowledge/privacy-boundaries.v1.md` | VALID | Privacy and isolation rules still match the repo’s multi-tenant and knowledge-boundary model. | Keep as-is. |
| `docs/knowledge/production-readiness.md` | OUTDATED | It declares MentorIA launch-ready and references `src/app/saas/[id]/student/page.tsx`, which does not exist in the current repo. | Archive or replace with a verified product readiness report. |
| `docs/knowledge/production/growth-loop-live.md` | UNCLEAR | Some referenced growth code exists, but this artifact is outside SocialFlow scope and was not fully validated end-to-end here. | Keep product-scoped and validate separately. |
| `docs/knowledge/prompts/factory-agents.v1.md` | UNCLEAR | Prompt catalog is not directly auditable against SocialFlow implementation behavior in this pass. | Keep prompt-scoped or split by active product area. |
| `docs/knowledge/prompts/mentoria-cognitive-prompts.v1.md` | UNCLEAR | MentorIA prompt artifact is outside SocialFlow scope. | Keep product-scoped or relocate. |
| `docs/knowledge/prompts/mentoria-global-prompts.v1.md` | UNCLEAR | MentorIA prompt artifact is outside SocialFlow scope. | Keep product-scoped or relocate. |
| `docs/knowledge/prompts/mentoria-prompts.v1.md` | UNCLEAR | MentorIA prompt artifact is outside SocialFlow scope. | Keep product-scoped or relocate. |
| `docs/knowledge/standards/dks-system-spec.md` | VALID | Core DKS layering and governance model still matches the knowledge base layout and usage intent. | Keep as-is. |
| `docs/knowledge/standards/mentoria-execution-control.v1.md` | UNCLEAR | MentorIA operating standard is outside SocialFlow scope and was not validated in this audit. | Keep product-scoped or relocate. |
| `docs/knowledge/standards/mentoria-global-blueprint.v1.md` | UNCLEAR | MentorIA blueprint is outside the SocialFlow implementation audited here. | Keep product-scoped or relocate. |
| `docs/knowledge/standards/mentoria-growth-intelligence.v1.md` | UNCLEAR | Growth standard is outside SocialFlow scope. | Keep product-scoped or validate separately. |
| `docs/knowledge/standards/mentoria-growth-strategy.v1.md` | UNCLEAR | Strategy document is not part of the SocialFlow knowledge surface audited here. | Keep product-scoped or validate separately. |
| `docs/knowledge/standards/mentoria-organic-growth-engine.v1.md` | UNCLEAR | Growth-engine standard is outside SocialFlow scope. | Keep product-scoped or validate separately. |
| `docs/knowledge/standards/naming-standards.md` | VALID | Naming guidance still matches the current knowledge tree conventions. | Keep as-is. |
| `docs/knowledge/standards/saas-factory-master-plan.md` | PARTIALLY OUTDATED | Broad factory concepts still matter, but it treats Cloudflare Pages as canonical while the current SocialFlow factory path is validated around `shared_open_next_runtime` and Workers-oriented behavior. | Update runtime/provisioning assumptions and add SocialFlow-specific factory notes. |
| `docs/knowledge/status.md` | OUTDATED | Snapshot is stale, incomplete, and no longer reflects the actual inventory or the current SocialFlow knowledge gap. | Replace with a new audited status snapshot. |
| `docs/knowledge/templates/adr.md` | VALID | Generic ADR template remains usable. | Keep as-is. |
| `docs/knowledge/templates/agent-kb.md` | VALID | Template remains structurally usable and does not conflict with current code. | Keep as-is. |
| `docs/knowledge/templates/capsule.md` | VALID | Capsule template remains valid for tenant-safe examples. | Keep as-is. |
| `docs/knowledge/templates/registration-template.md` | PARTIALLY OUTDATED | The template is useful, but its path rule says registry entries must stay under `docs/knowledge/`, while the real registry already violates that convention. | Update the rule or fix the registry to match it. |
| `docs/knowledge/templates/runbook.md` | VALID | Generic runbook template remains usable. | Keep as-is. |
| `docs/knowledge/templates/swarm-kb.md` | VALID | Template remains structurally usable and does not conflict with current code. | Keep as-is. |
| `docs/knowledge/templates/test-run.md` | PARTIALLY OUTDATED | Useful as a factory playbook skeleton, but it assumes older infra/connectors flows and does not represent current SocialFlow readiness or live LinkedIn flow. | Refresh or replace with a verified activation runbook. |
| `docs/knowledge/update-log.md` | OUTDATED | It only records the initial January activation and misses the real growth of the knowledge tree and SocialFlow system changes. | Resume updates or replace with an accurate changelog policy. |

## 4. Valid Knowledge

The following knowledge remains valid at the governance/template level:

- `docs/knowledge/standards/dks-system-spec.md`
- `docs/knowledge/standards/naming-standards.md`
- `docs/knowledge/privacy-boundaries.v1.md`
- `docs/knowledge/connectors/manifesto.md`
- `docs/knowledge/infra/ci-workflows/cron-workflow.md`
- `docs/knowledge/templates/adr.md`
- `docs/knowledge/templates/agent-kb.md`
- `docs/knowledge/templates/capsule.md`
- `docs/knowledge/templates/runbook.md`
- `docs/knowledge/templates/swarm-kb.md`
- `docs/knowledge/connectors/templates/connector-template.md`

These documents are still useful because they define meta-structure, governance, or reusable templates rather than unstable product behavior.

## 5. Outdated or Partial Knowledge

The main documentation quality problems are structural rather than implementation-side:

- `docs/knowledge/knowledge-registry.v1.md` is not a faithful registry of the current tree.
- `docs/knowledge/README.md`, `docs/knowledge/status.md`, and `docs/knowledge/update-log.md` no longer describe the actual state of the knowledge base.
- `docs/knowledge/how-to-contribute.md` and `docs/knowledge/templates/registration-template.md` define contribution rules that the current registry already violates.
- `docs/knowledge/standards/saas-factory-master-plan.md` and `docs/knowledge/templates/test-run.md` still describe an older factory/infrastructure story and do not capture the current SocialFlow path.
- `docs/knowledge/connectors/overview.md` is directly contradicted by the rest of the connector knowledge.
- `docs/knowledge/production-readiness.md` is directly contradicted by the current repository layout.

Most importantly, there is no document that accurately captures the real SocialFlow operator loop now implemented in code.

## 6. Knowledge Gaps

Important real system knowledge that is currently missing from `docs/knowledge/`:

- A SocialFlow system overview or architecture pack.
- A SocialFlow registry entry or dedicated pack under `docs/knowledge/packs/`.
- The readiness model implemented in `getSocialProductSummary`, including `GUIDED_SETUP`, `EARLY_USER_READY`, and `PILOT_READY`.
- The dashboard-only promotion rule for `FIRST_PAYING_USER_READY`, which is currently derived in `SocialFlowDashboard.tsx` from billing readiness, live LinkedIn connection, and live-published output.
- The LinkedIn live connection and validation pipeline:
  - `verifyLinkedInAccess`
  - account status transitions (`CONNECTED_REAL`, `PENDING_REAL`, `INVALID_CREDENTIALS`, `NEEDS_RECONNECTION`)
  - LinkedIn-only live publishing constraints
- The live publishing behavior:
  - live publishing is currently LinkedIn-only
  - scheduled/live queue handling
  - failure metadata and reconnection expectations
- The analytics health summary contract in `summarizeLinkedInLiveAnalyticsHealth`.
- The meaning and lifecycle of:
  - `recentActivity`
  - `recentIncidents`
  - `resolvedRecently`
  - `resolvedRecentlyCount`
  - `lastResolvedAt`
  - `lastWorkspaceSyncAt`
  - `lastHealthyLiveSyncAt`
  - `healthySyncFreshnessStatus`
  - `healthySyncNeedsRefresh`
- The actual time windows driving the system:
  - `RESOLVED_RECENTLY_WINDOW_MS = 24h`
  - `HEALTHY_LIVE_SYNC_FRESH_WINDOW_MS = 24h`
  - refresh TTL behavior for post analytics
- The retry/review workflow:
  - retry analytics refresh
  - mark incident as reviewed
  - manual review notes
  - clearing review state after successful live recovery
- The contextual refresh CTA behavior in the SocialFlow workspace:
  - refresh button prominence changes when `healthySyncNeedsRefresh` is true
  - operator guidance around aging healthy sync
- The transparency model shown in SocialFlow summary output.
- The fact that tests already encode parts of the SocialFlow contract, but no knowledge artifact points to them.

## 7. Recommended Next Actions

- Update existing packs:
  - create a SocialFlow knowledge pack or architecture pack
  - document readiness stages and the billing overlay that creates `FIRST_PAYING_USER_READY`
  - document LinkedIn live connection, publishing, analytics health, and operator review flows
- Archive obsolete docs:
  - archive or rewrite `docs/knowledge/connectors/overview.md`
  - archive or replace `docs/knowledge/production-readiness.md`
  - replace stale `docs/knowledge/status.md` and `docs/knowledge/update-log.md`
- Create new packs:
  - `socialflow-system-overview`
  - `socialflow-readiness-model`
  - `socialflow-linkedin-live-publishing`
  - `socialflow-live-analytics-health`
  - `socialflow-operator-runbook`
- Improve registry:
  - rebuild `knowledge-registry.v1.md` from the actual `docs/knowledge/` inventory
  - decide whether non-knowledge external infra docs should remain in this registry
  - add ownership/scope conventions for product-specific knowledge such as MentorIA vs SocialFlow
  - register every currently missing artifact before adding new ones

## 8. Audit Summary

- total documents audited: `41`
- VALID: `11`
- PARTIALLY OUTDATED: `9`
- OUTDATED: `4`
- UNCLEAR: `17`

