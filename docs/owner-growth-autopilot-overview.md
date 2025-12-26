# Owner Growth Autopilot

## What it is
Owner Growth Autopilot is a portfolio-level playbook that reviews every SaaS under an owner and surfaces deterministic actions around growth and risk. It does not execute changes; it only recommends next steps.

## Data sources
- **Owner Accounting Snapshot** (`/api/owner/accounting`) for margin and subscription signals.
- **Drako Vendor Snapshot** (`/api/owner/vendor/snapshot`) for vendor costs and margin by vertical.
- **Packs / verticals** from the catalog definitions.
- **Blueprint recommendations** already attached to each SaaS.

## API
- `GET /api/owner/autopilot`
  - Returns an ordered list of actions with severity, category, and target.

## UI
- **/owner**
  - “Owner Growth Autopilot — Daily Playbook” lists CRITICAL, WARNING, and INFO actions.
  - Actions link to `/saas/[id]` when SaaS-specific or `/owner/catalog` when the action suggests launching/migrating a pack.

## Vendor rules (Campamento Base)
- Margin by vertical after vendor costs:
  - < 30% -> CRITICAL (revisar precio o costes IA/INFRA)
  - 30-50% -> WARNING (ajuste gradual de plan o modulos)
  - > 70% -> INFO (upsell de Social Pack o Ads Management)
- AI share sobre gasto vendor > 35% -> WARNING (optimizar consumo IA).
- Marketing bajo vs revenue en verticales con margen alto -> sugerir upsell.

## Roadmap
- Materialize actions into tasks for execution.
- Attach playbooks from Knowledge based on category/target.
- Add portfolio-wide thresholds per owner.
