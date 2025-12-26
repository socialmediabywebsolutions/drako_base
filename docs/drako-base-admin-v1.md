# DRĀKO BASE Admin v1 Snapshot

## D1 Tables
- **owners** (`0001`, `0010`): single-tenant owner profile (contact + fiscal data).
- **saas** (`0001`): catalog of managed SaaS products (name, slug, domain, status, timestamps).
- **provisioning** (`0002`): timeline of provisioning steps per SaaS with status/notes.
- **alerts** + index (`0001`, `0003`): operational alerts optionally tied to a SaaS.
- **metrics** (`0001`): token/cost/ROI rollups per scope.
- **departments / agents** (`0001`, `0005`): legacy catalogs enriched with descriptions + `is_core`.
- **core_departments / core_agents** (`0007`): canonical Campamento Base departments & agents used for SaaS inheritance.
- **saas_agents** (`0004`, `0007` recreated): assignment of core agents to each SaaS with status/config.
- **grants / agent_runs** (`0001`): subsidies backlog + AI run logging.
- **inbox_messages** (`0008`, `0009`): omni-channel inbox with status/department routing.
- **owners / clients / client_saas** (`0010`): admin backbone for linking clients to SaaS.
- **invoices** (`0010`, `0011` adds notes/currency defaults): billing ledger per client+SaaS.
- **tickets** (`0010`, `0011` adds description field): support cases per client+SaaS.
- **social_accounts** (`0010`): connected social networks per SaaS.
- **orchestrator_messages** (`0006`): persistent threads for chat history/context metadata.

## REST Endpoints (Edge runtime)
- `GET/POST/PATCH /api/owners`: CRUD owner profile.
- `GET/POST /api/clients`: list/create clients for the owner.
- `POST /api/client-saas`: link an existing SaaS to a client (`client_saas`).
- `GET/POST/PATCH /api/invoices`: filter by `client_id`/`saas_id`, create ledger entries, update status/notes.
- `GET/POST/PATCH /api/tickets`: filter by SaaS or client, create tickets, update status/closed_at.
- `GET/POST/PATCH /api/social-accounts`: manage connected social profiles per SaaS.
- `GET/PATCH /api/saas`: list SaaS, edit domain/subdomain/status; POST handled elsewhere for creator flow.
- `GET/POST/PATCH /api/provisioning`: timeline CRUD per SaaS step.
- `POST /api/orchestrator`: persists convo history, detects SaaS slug, optionally runs provisioning playbook, builds deterministic reply. `GET` retrieves thread messages.

## UI Pages Ready in v1
- `/owner`: owner profile editor (billing/contact fields, save via `/api/owners`).
- `/clients`: list + create clients, link SaaS via `/api/client-saas`.
- `/clients/[id]`: editable client data plus Facturas/Tickets blocks (list/create/update through `/api/invoices` + `/api/tickets`).
- `/saas`: SaaS directory (name, slug, domain/subdomain, status chips).
- `/saas/[id]`: operational cockpit – client assignment, domains/status editor, provisioning timeline, alerts, metrics, social accounts, agents, right-panel context.
- `right-panel` (chat orchestrator): persistent glass panel that adapts to focus (SaaS/inbox) using orchestrator context.

## Orchestrator Context (Today)
- Scope-aware (`saas` vs `inbox`).
- SaaS context: id, name, slug, domain/subdomain, status, linked client summary, social accounts, provisioning steps, alert feed, assigned agents (dept + agent names). Replies mention department/agent voice, provisioning tasks, alerts, and agent actions.
- Inbox context: message metadata (channel, status, dept, subject/preview, linked SaaS). Replies reference department voice, channel, and concrete actions inside `/inbox`.

## Out of Scope for Admin v1
1. **SaaS-level Facturas/Tickets UI**: blocks were reverted; only client-level billing/support remains.
2. **Billing/Support summary inside orchestrator replies for SaaS scope**: context not yet enriched with invoice/ticket aggregates.
3. **External integrations**: no live payment gateways, email/SMS sending, or accounting exports.
4. **Automation playbooks beyond provisioning**: future phases will add billing automations and richer support workflows.

This document freezes the DRĀKO BASE Admin v1 baseline before starting the drako.systems SaaS creator phase.
