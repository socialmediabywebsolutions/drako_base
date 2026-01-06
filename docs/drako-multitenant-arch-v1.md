# DRĀKO Multitenant Architecture v1

## Overview
DRĀKO BASE evolves from a single-owner control tower into a true multi-tenant platform. Every business entity (clients, SaaS products, inbox messages, alerts, billing, automations, etc.) will be isolated by a `tenant_id` (a.k.a. `project_id`) referencing the primary tenant record. Cloudflare Pages + Functions remain the delivery surface, but the authoritative state is expanded with new D1 tables plus KV/R2/Vectorize handles for automations, orchestration history, and document intelligence. This document defines the schema, relationships, worker services, Cloudflare bindings, and migration steps required to activate the “Drako completo” footprint without breaking the current build.

## Entities & Tables
Below tables are expressed in English, pluralized, and assume Snowball-style timestamps (`created_at`, `updated_at`). Types follow D1 (SQLite) primitives.

### tenants
- `id` TEXT PK (UUID).
- `slug` TEXT UNIQUE (lowercase handle used across routes and bindings).
- `name` TEXT NOT NULL.
- `owner_id` TEXT NULLABLE (references existing `owners.id`; legacy owners map 1:1).
- `plan` TEXT NOT NULL DEFAULT `"base"` (`base`, `growth`, `enterprise`).
- `status` TEXT NOT NULL DEFAULT `"active"` (`active`, `paused`, `suspended`).
- `region` TEXT (operational region / data residency hint).
- `metadata` TEXT JSON for feature flags.
- `created_at` / `updated_at` TEXT.

### tenant_users
- `id` TEXT PK.
- `tenant_id` TEXT NOT NULL (FK → `tenants.id`).
- `user_email` TEXT NOT NULL.
- `role` TEXT NOT NULL (`owner`, `admin`, `operator`, `viewer`).
- `status` TEXT NOT NULL DEFAULT `"active"`.
- `invited_at`, `accepted_at`, `created_at`, `updated_at` TEXT.

### tenant_departments
- `id` TEXT PK.
- `tenant_id` TEXT NOT NULL.
- `department_id` TEXT NOT NULL (FK logical → `departments.id`).
- `status` TEXT NOT NULL DEFAULT `"inactive"` (`inactive`, `configured`, `active`).
- `config` TEXT JSON (channels, SLAs, agents assigned).
- `activated_by` TEXT (tenant_user id or email).
- `activated_at`, `created_at`, `updated_at` TEXT.

### tenant_agents
- `id` TEXT PK.
- `tenant_id` TEXT NOT NULL.
- `department_id` TEXT NOT NULL.
- `agent_id` TEXT NULL (references catalog `agents.id` or core clone).
- `provider` TEXT NOT NULL (DeepSeek, Fireworks, Gemini per OLIMPO rule).
- `model` TEXT NOT NULL.
- `temperature` REAL DEFAULT 0.2.
- `status` TEXT NOT NULL DEFAULT `"active"`.
- `config` TEXT JSON (prompt, tools, vector indexes allowed).
- `metrics_scope` TEXT (links to `metrics.scope`).
- `created_at`, `updated_at` TEXT.

### tenant_projects (alias `projects` if preferred)
- `id` TEXT PK.
- `tenant_id` TEXT NOT NULL.
- `saas_id` TEXT NULL (existing SaaS row).
- `name`, `slug`, `type` TEXT.
- `status` TEXT (`draft`, `provisioning`, `live`, `sunset`).
- `launch_date` TEXT.
- `primary_domain`, `secondary_domain` TEXT.
- `client_id` TEXT NULL (existing `clients.id`).
- `created_at`, `updated_at` TEXT.

### automations
- `id` TEXT PK.
- `tenant_id` TEXT NOT NULL.
- `name`, `slug` TEXT.
- `type` TEXT (`inbox_sync`, `social_posting`, `billing_close`, `agent_training`, etc.).
- `schedule` TEXT (cron string) or `trigger` TEXT (`event:ticket.created`).
- `status` TEXT (`draft`, `enabled`, `paused`).
- `config` TEXT JSON (input sources, throttling, credentials reference keys in KV/R2).
- `last_run_at`, `next_run_at`, `created_at`, `updated_at` TEXT.

### automation_runs
- `id` TEXT PK.
- `automation_id` TEXT NOT NULL.
- `tenant_id` TEXT NOT NULL.
- `status` TEXT (`queued`, `running`, `success`, `error`).
- `logs` TEXT (JSON array or newline log).
- `duration_ms` INTEGER.
- `metrics_id` INTEGER NULL (FK to `metrics.id` for cost tracking).
- `created_at`, `updated_at` TEXT.

### pipelines
- `id` TEXT PK.
- `tenant_id` TEXT NOT NULL.
- `project_id` TEXT NULL (FK → `tenant_projects.id`).
- `name`, `category` (`provisioning`, `support`, `marketing`, `billing`).
- `status` TEXT.
- `definition` TEXT JSON (ordered stages + automations/workflows).
- `created_at`, `updated_at`.

### pipeline_runs
- `id` TEXT PK.
- `pipeline_id` TEXT NOT NULL.
- `tenant_id` TEXT NOT NULL.
- `status` TEXT (`pending`, `in_progress`, `completed`, `failed`).
- `current_step` TEXT.
- `payload` TEXT JSON (input context, SaaS id, ticket id).
- `metrics_id` INTEGER NULL.
- `created_at`, `updated_at`.

### workflows
- `id` TEXT PK.
- `tenant_id` TEXT NOT NULL.
- `department_id` TEXT NULL.
- `trigger` TEXT (`manual`, `automation`, `pipeline_step`).
- `definition` TEXT JSON (tasks to execute, approvals required).
- `status` TEXT (`draft`, `active`, `deprecated`).
- `created_at`, `updated_at`.

### workflow_tasks
- `id` TEXT PK.
- `workflow_id` TEXT NOT NULL.
- `tenant_id` TEXT NOT NULL.
- `sequence` INTEGER.
- `type` TEXT (`agent_call`, `http_request`, `delay`, `queue_enqueue`).
- `config` TEXT JSON.
- `status` TEXT.
- `created_at`, `updated_at`.

### knowledge_bases
- `id` TEXT PK.
- `tenant_id` TEXT NOT NULL.
- `name`, `slug` TEXT.
- `source_type` TEXT (`manual`, `email`, `r2_file`, `web_capture`).
- `status` TEXT (`indexing`, `ready`, `error`).
- `vector_index` TEXT (name of Vectorize index).
- `r2_bucket` TEXT (optional dedicated bucket/prefix).
- `created_at`, `updated_at`.

### knowledge_documents
- `id` TEXT PK.
- `knowledge_base_id` TEXT NOT NULL.
- `tenant_id` TEXT NOT NULL.
- `title` TEXT.
- `mime_type` TEXT.
- `source_url` TEXT.
- `checksum` TEXT.
- `status` TEXT.
- `metadata` TEXT JSON.
- `created_at`, `updated_at`.

### knowledge_vectors
- `id` TEXT PK.
- `knowledge_base_id` TEXT NOT NULL.
- `tenant_id` TEXT NOT NULL.
- `vector_id` TEXT (Vectorize reference).
- `chunk` TEXT.
- `metadata` TEXT JSON (document id, tokens, embeddings model).
- `created_at` TEXT.

### accounting_accounts
- `id` TEXT PK.
- `tenant_id` TEXT NOT NULL.
- `type` TEXT (`receivable`, `payable`, `cash`, `tax`).
- `name` TEXT.
- `currency` TEXT.
- `balance_cents` INTEGER DEFAULT 0.
- `created_at`, `updated_at`.

### accounting_entries
- `id` TEXT PK.
- `tenant_id` TEXT NOT NULL.
- `account_id` TEXT NOT NULL.
- `saas_id` TEXT NULL.
- `client_id` TEXT NULL.
- `reference` TEXT (invoice, ticket, automation run).
- `amount_cents` INTEGER (positive income, negative expense).
- `currency` TEXT.
- `category` TEXT (`subscription`, `tax`, `expense`, `ai_tokens`).
- `notes` TEXT.
- `occurred_at`, `created_at` TEXT.

### subscriptions
- `id` TEXT PK.
- `tenant_id` TEXT NOT NULL.
- `client_id` TEXT NOT NULL.
- `saas_id` TEXT NOT NULL.
- `plan_name` TEXT.
- `billing_period` TEXT (`monthly`, `annual`).
- `status` TEXT (`trial`, `active`, `past_due`, `canceled`).
- `amount_cents` INTEGER.
- `currency` TEXT.
- `renews_at`, `created_at`, `updated_at`.

### agent_logs & agent_metrics (OLIMPO rule compliance)
- `agent_logs` (new) ties `tenant_id`, `agent_id`, `run_id`, `context`, `result`, `created_at`.
- `agent_metrics` (new) aggregates per tenant/agent/day with `prompt_tokens`, `completion_tokens`, `cost_cents`, `success_rate`.

### audit_events
- `id` TEXT PK.
- `tenant_id` TEXT NOT NULL.
- `actor` TEXT (user email or service name).
- `action` TEXT (`tenant.updated`, `pipeline.run.started`).
- `metadata` TEXT JSON.
- `created_at` TEXT.

## Relations & Tenant Isolation
- `tenant_id` becomes mandatory on every business table: `clients`, `client_saas`, `saas`, `provisioning`, `alerts`, `metrics`, `inbox_messages`, `invoices`, `tickets`, `social_accounts`, `grants`, `agent_runs`, `orchestrator_messages`, etc.
- Legacy `owners` map to `tenants` (1 owner → 1 tenant). New flows: a tenant may have multiple owners/admins via `tenant_users`.
- `saas` rows link to `tenant_projects` (`saas.tenant_id` + `tenant_projects.saas_id`).
- Department activation uses `tenant_departments`; department-specific automations or workflows reference its id.
- `orchestrator_messages` gain `tenant_id`, `scope_id` (saas/inbox/automation) to segregate transcripts.
- `metrics.scope` becomes structured: `tenant:{tenant_id}:agent:{agent_id}` and `tenant:{tenant_id}:pipeline:{pipeline_id}` to simplify isolation.
- All APIs must require `tenant_id` (header, token, or derived from session) before touching D1. Worker services enforce this guard.

## Internal Services (Workers Layer)
Services run inside the `_worker.js` router (Edge-compatible). Each service operates with the env bindings and exposes async methods consumed by API routes.

### TenantsService
Responsibilities:
- Create/update tenants, attach plans, enforce quotas.
- Manage tenant-level feature toggles and activation state.
- CRUD for `tenant_users` (invitations, role changes).
Operations: `createTenant`, `updateTenantPlan`, `suspendTenant`, `inviteUser`, `acceptInvite`, `listTenantUsers`.
Tables: `tenants`, `tenant_users`, `tenant_departments`, `audit_events`.

### DepartmentsService
- Activate/deactivate departments per tenant.
- Manage `tenant_departments` and `tenant_agents` lifecycles.
- Sync catalog (`departments`, `agents`, `core_agents`).
Ops: `activateDepartment`, `configureDepartment`, `cloneCoreAgents`, `listTenantAgents`.

### PipelinesService
- CRUD pipelines per tenant/project.
- Kick off pipeline runs, append stage statuses, capture metrics.
Ops: `createPipeline`, `startPipelineRun`, `advancePipelineStep`, `abortPipelineRun`.
Tables: `pipelines`, `pipeline_runs`, `tenant_projects`, `metrics`, `audit_events`.

### AutomationsService
- Register automations, compute next run, enqueue Worker cron/queue jobs.
- Persist run logs and expose history for the admin UI.
Ops: `createAutomation`, `scheduleNextRun`, `enqueueAutomation`, `recordAutomationRun`, `listAutomationRuns`.
Tables: `automations`, `automation_runs`, `agent_logs`, `metrics`.
Bindings: `Queues` (dispatch), `KV` (last run state), `Cron Trigger`.

### KnowledgeBasesService
- Manage knowledge base metadata, ingest files into R2, push embeddings into Vectorize.
- Serve semantic search contexts for Orchestrator/Agents.
Ops: `createKnowledgeBase`, `appendDocument`, `indexDocument`, `searchVectors`, `purgeKnowledgeBase`.
Tables: `knowledge_bases`, `knowledge_documents`, `knowledge_vectors`.
Bindings: `R2`, `Vectorize`.

### AccountingService
- Post accounting entries, keep running balances, reconcile with subscriptions/invoices.
- Provide tenant-level reporting for the dashboard.
Ops: `recordEntry`, `reconcileInvoice`, `listEntriesByTenant`, `closePeriod`.
Tables: `accounting_accounts`, `accounting_entries`, `invoices`, `subscriptions`.

### OrchestratorService
- Wraps orchestrator logic so API route only handles HTTP.
- Enforces tenant isolation, fetches context (SaaS, inbox, automations) via other services.
- Logs runs into `agent_logs`/`agent_metrics` and coordinates provisioning playbooks.
Ops: `appendMessage`, `buildReply`, `runPlaybook`, `fetchThread`.
Tables: `orchestrator_messages`, `agent_logs`, `automation_runs`, `pipelines`.
Bindings: `KV` (short-lived session state), `Queues` (background playbooks).

### InboxService (extension)
- Already partially present via API route; extend to include tenant scoping, omnichannel connectors, scheduled sync automation hooks.
Ops: `ingestMessage`, `assignDepartment`, `syncChannel`, `summarizeThread`.
Tables: `inbox_messages`, `tenant_departments`, `tenant_agents`.

### MetricsService
- Uniform access to `metrics`, `agent_metrics`, `automation_runs` stats.
- Provides aggregated dashboards per tenant/project.
Ops: `recordMetric`, `rollupTenantDay`, `getAgentKPIs`.

## Cloudflare Bindings & Runtimes
Future `wrangler.toml` additions (names reserved):
- `D1 DRACO_DB` (existing) – primary relational store.
- `KV DRACO_CACHE` – cache for tenant configs, throttling, session tokens.
- `KV DRACO_AUTOMATIONS` (optional) – dedupe automation triggers.
- `R2 DRACO_FILES` – store knowledge documents, invoices, attachments.
- `Vectorize DRACO_VECTORIZE` – embeddings per tenant knowledge base (namespaced indexes like `draco-{tenantSlug}`).
- `Queues DRACO_AUTOMATION_QUEUE` – automation + pipeline execution tasks.
- `Queues DRACO_AGENT_QUEUE` – heavy agent/offline inference jobs.
- `Cron Triggers` – tie to AutomationsService schedules.
- OpenNext `_worker.js` router already available; services will be imported there.

## Migration Strategy (from current single-owner state)
1. **Bootstrap tenants:** create a migration that copies the existing single owner into `tenants` (`tenant_id = owner.id`). All existing records get `tenant_id` referencing this seed.
2. **Add tenant columns:** alter each business table to include `tenant_id` DEFAULT `<legacy-owner-id>` (temporary) + indexes on (`tenant_id`, `<business_key>`).
3. **Backfill data:** update rows with the derived tenant id. For future multi-tenant tests, seed at least two tenants with sample data via new migrations.
4. **Introduce tenant guardrails in APIs:** update every API handler to require `tenant_id` (header/token) before query. Non-compliant requests return 401/403.
5. **Refactor orchestrator/provisioning libs:** ensure `ensureCampamentoBase` / provisioning helpers accept `tenant_id`.
6. **Deploy new tables:** create migrations for entities listed above, grouped by domain (tenants/core, automation/pipelines, knowledge, accounting, observability).
7. **Progressive rollout:** keep old columns until UI/services consume new schema, then deprecate legacy shortcuts.

## Next Steps (Fases 0.2, 0.3, …)
1. **Fase 0.2 – Migrations & Seeds**
   - Implement D1 migrations for `tenants`, `tenant_users`, `tenant_departments`, `tenant_agents`, automations/pipelines/knowledge/accounting tables.
   - Seed sample tenants (`drako_base`, `demo_agency`) with departments + agents.
   - Provide migration scripts to backfill existing data.
2. **Fase 0.3 – Worker Services Skeleton**
   - Create service modules in `src/lib/services/` implementing interfaces defined above.
   - Add type definitions (`src/types/multitenant.ts`).
   - Wire services into selected API routes (read-only) while keeping old flow functional.
3. **Fase 0.4 – Admin UI Extensions**
   - Build Master Dashboard, Department activation UI, Automation lists connected to new services.
   - Add tenant switcher and guard existing pages behind tenant context.
4. **Fase 0.5 – Automations & Knowledge Integration**
   - Implement Cloudflare Queue consumers + Cron triggers.
   - Connect KnowledgeBasesService to Vectorize/R2; expose ingestion UI.
5. **Fase 0.6 – Accounting & Metrics Unification**
   - Link accounting entries with subscriptions/invoices; show KPIs per tenant.
   - Feed agent/automation metrics into dashboards and orchestrator replies.
