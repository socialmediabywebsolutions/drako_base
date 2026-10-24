# Knowledge Normalization Roadmap v1

## Goal

Normalize the ecosystem in the right order without touching runtime behavior first.

## Phase 1 - Registry Repair

Priority: `P0`

Scope:

- rebuild `docs/knowledge/knowledge-registry.v1.md` from the real inventory
- define which surfaces belong in DKS and which stay as evidence/history only
- mark cross-boundary artifacts as `holding`, `factory`, `campo-base`, or product-specific
- stop using stale `README.md`, `status.md`, and `update-log.md` as current truth until repaired

Why first:

- Without registry repair, every later normalization step keeps multiple competing truths alive.

## Phase 2 - Outdated Core Docs

Priority: `P0`

Scope:

- replace or clearly demote:
  - `README.md`
  - `docs/base/00-index.md`
  - `docs/base/13-runbooks.md`
  - `docs/base/15-release-gates.md`
  - `docs/knowledge/connectors/overview.md`
  - `docs/knowledge/production-readiness.md`
  - `docs/social-engine-overview.md`
  - Pages-first runbooks that conflict with Workers-only guidance

Why second:

- These docs are currently the most likely to teach the wrong architecture to agents and humans.

## Phase 3 - Drako Reusable Patterns

Priority: `P0`

Scope:

- document the current canonical factory/runtime contract
- extract reusable patterns from code and recent audits:
  - shared runtime activation
  - bootstrap readiness
  - custom-domain verification
  - readiness plus billing overlay
  - narrow live path with explicit transparency
  - operator health and review loops

Deliverables to create later:

- new factory pack
- runtime contract doc
- reusable readiness pattern doc
- reusable operator-loop pattern doc

## Phase 4 - Campo Base Normalization

Priority: `P1`

Scope:

- separate holding owner-console knowledge from reusable SaaS factory knowledge
- keep Campo Base internal metrics, treasury, vendor, and owner workflows from contaminating vertical product packs
- align Campo Base docs to the current holding/factory boundary model

Why after factory patterns:

- first define what is reusable, then isolate what is intentionally not reusable.

## Phase 5 - Product-Specific Packs

Priority: `P1`

Scope:

- create clean product packs for:
  - SocialFlow
  - MentorIA
  - any other real vertical that still matters
- ensure each pack points to live code contracts and key tests
- remove product-specific artifacts from pretending to be holding-wide truth

Immediate candidate order:

1. SocialFlow
2. MentorIA
3. catalog/other verticals

## Phase 6 - Archive / Cleanup

Priority: `P2`

Scope:

- archive or demote legacy docs and historical reports that should not remain discoverable as canonical guidance
- keep dated evidence, but label it as history/evidence
- reduce duplicate production/readiness narratives

Archive targets:

- obsolete Pages-first docs
- superseded SSOT claims in `docs/base/*`
- stale product readiness/status snapshots

## Priority Map

| Priority | Focus | Outcome |
| --- | --- | --- |
| P0 | Registry repair + outdated core docs + reusable Drako patterns | Stop teaching the wrong architecture and expose the right reusable contracts. |
| P1 | Campo Base split + product packs | Clean domain boundaries and give each product a safe knowledge home. |
| P2 | Archive/cleanup | Reduce noise and prevent stale history from looking canonical. |

## Recommended Execution Order

1. Phase 1 - Registry Repair
2. Phase 2 - Outdated Core Docs
3. Phase 3 - Drako Reusable Patterns
4. Phase 4 - Campo Base Normalization
5. Phase 5 - Product-Specific Packs
6. Phase 6 - Archive / Cleanup

## Exit Condition

Normalization is complete when:

- one registry maps the real living knowledge surface
- core/factory/campo-base/product boundaries are explicit
- Drako Generator can learn from reusable patterns without ingesting stale or product-only noise
- historical evidence remains available, but no longer impersonates current canonical truth
