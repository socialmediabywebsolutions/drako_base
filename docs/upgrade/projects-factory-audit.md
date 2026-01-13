# Projects Factory Audit — 2026-01-09

## Context & Scope
- Objective: map current "SaaS factory" implementation before morphing into "AI projects factory".
- Branch: `feat/projects-factory-v1`.
- Focus: repository inventory, runtime surfaces, data model for SaaS/projects/domains/agents/inbox, and readiness signals.

## Repository Structure (top-level)
```
.dev.vars/
.git/
.gitignore/
.next/
.npmrc/
.open-next/
.pages-output/
.vercel/
.wrangler/
README.md/
docs/
eslint.config.mjs/
migrations/
next-env.d.ts/
next.config.ts/
node_modules/
package-lock.json/
package.json/
postcss.config.mjs/
production-audit.md/
public/
reports/
scripts/
src/
tsconfig.json/
tsconfig.scripts.json/
tsconfig.tsbuildinfo/
windreport-deploy.md/
workers/
wrangler.toml/
```

## App Route Inventory (`src/app/**/page.tsx`)
```
/admin
/agentes
/agents
/alerts
/billing
/billing/cancel
/billing/success
/clients
/clients/[id]
/clinic
/clinic/agenda
/clinic/dashboard
/clinic/finance
/clinic/leads
/clinic/messages
/departamentos
/departments
/dev-architects
/grants
/inbox
/metrics
/owner
/owner/catalog
/owner/domains
/page (landing)
/preview
/public/[saasSlug]
/saas
/saas/[id]
/saas/create
/site
/site/clinic/[slug]
/site/onboarding
/site/onboarding/chat
/site/onboarding/company
/site/onboarding/review
/site/onboarding/saas
/site/panel
/site/saas/[slug]
/site/support
/staff/[employeeId]
```
(NB: `/page` is the root dashboard.)

## API Route Inventory (`src/app/api/**/route.ts`)
```
/agentes → N/A (Spanish alias served by page only)
/alerts
/blueprints/saas
/blueprints/saas/modules
/clients
/core-departments
/diag
/employees
/employees/[id]
/employees/[id]/partner
/employees/[id]/partner/summary
/employees/[id]/profitability
/employees/[id]/skills
/employees/compliance/summary
/employees/hr-settings
/employees/profitability
/features
/features/[key]
/features/sync-from-blueprint
/grants
/health
/inbox
/invoices
/knowledge-bases
/knowledge/documents
/knowledge/documents/[id]
/knowledge/documents/[id]/links
/knowledge/links
/knowledge/spaces
/metrics
/notifications
/onboarding/chat
/onboarding/session
/orchestrator
/owner/accounting
/owner/action-queue
/owner/actions
/owner/actions/[id]/dismiss
/owner/actions/[id]/execute
/owner/actions/[id]/snooze
/owner/actions/cleanup
/owner/autopilot
/owner/control-snapshot
/owner/db/health
/owner/domains
/owner/domains/verify
/owner/events
/owner/events/rollup
/owner/marketing
/owner/portfolio
/owner/saas-pricing/recommendations
/owner/tasks
/owner/tasks/materialize-from-growth-autopilot
/owner/tasks/summary
/owner/tax/summary
/owner/treasury/snapshot
/owner/vendor/expenses
/owner/vendor/expenses/[id]
/owner/vendor/snapshot
/owners
/packs
/packs/apply
/packs/current
/provision/commit
/provisioning
/reports/[id]/pdf
/reports/generate
/research/jobs
/saas
/saas-agents
/saas/[id]/domains
/saas/[id]/marketing
/saas/[id]/marketing/usage
/saas/[id]/tax/periods
/saas/[id]/tax/profile
/saas/domain
/saas/plans
/saas/public/[slug]
/saas/subscriptions
/site/clinic/leads
/social-accounts
/social/accounts
/social/analytics/campaigns
/social/analytics/posts
/social/analytics/summary
/social/campaigns
/social/content/ideas
/social/content/posts
/social/metrics
/social/overview
/social/posts
/social/posts/[id]
/stripe/checkout
/stripe/checkout-saas
/stripe/webhook
/tasks
/tasks/[id]
/tasks/autopilot-materialize
/tickets
/whatsapp/identities
/whatsapp/inbound
```

## D1 Schema & Migration Set
- Migrations directory contains 63 SQL files from `0001_init.sql` through `0060_factory_ready_core.sql` plus seeds (`0057`–`0059`).
- Ordered listing:
```
0001_init.sql
0002_provisioning.sql
0003_alerts_saas_id.sql
0004_saas_agents.sql
0005_core_departments.sql
0006_orchestrator_messages.sql
0007_core_campamento_base.sql
0008_inbox_messages.sql
0009_inbox_statuses.sql
0010_admin_backbone.sql
0011_billing_support_notes.sql
0012_multitenant_core.sql
0013_tenant_columns.sql
0014_demo_tenant_seed.sql
0015_devarchitect_tables.sql
0016_devarchitect_alerts_metrics.sql
0016_devarchitect_sessions_summary.sql
0016_drako_subscriptions.sql
0017_clinic_tables.sql
0017_devarchitect_tasks.sql
0017_saas_billing.sql
0017_saas_domains.sql
0018_clinic_plan.sql
0018_employees.sql
0019_employees_hr.sql
0020_clinic_pricing_inventory.sql
0020_economy_core.sql
0021_saas_customers.sql
0021_saas_customers_bookings.sql
0022_customers_partner_profiles.sql
0023_email_intake_core.sql
0024_saas_appointments.sql
0025_saas_appointments_customer_id.sql
0026_social_core.sql
0027_social_conversion_core.sql
0028_saas_domains_core.sql
0029_saas_blueprint_core.sql
0030_hr_guardrails_enforcement.sql
0031_saas_tasks_core.sql
0032_saas_knowledge_core.sql
0033_knowledge_documents_meta.sql
0034_saas_features_core.sql
0035_saas_plan_features_core.sql
0036_conversations_core.sql
0037_saas_branding_core.sql
0038_whatsapp_gateway_core.sql
0039_saas_tax_core.sql
0040_drako_vendor_core.sql
0041_drako_baseline_core.sql
0042_drako_treasury_core.sql
0043_saas_marketing_core.sql
0044_drako_action_queue_core.sql
0045_drako_empire_runtime_core.sql
0046_drako_empire_runtime_constraints.sql
0047_drako_domain_verification.sql
0048_drako_domain_status_normalization.sql
0049_drako_stripe_mapping.sql
0050_drako_stripe_webhook_events.sql
0051_drako_events_rollups.sql
0052_drako_action_queue_operable.sql
0053_drako_public_surface_security.sql
0054_drako_ai_governance.sql
0055_drako_migrations_state.sql
0057_seed_demo_basics.sql
0058_seed_demo_saas_project.sql
0059_seed_drako_systems_projects.sql
0060_factory_ready_core.sql
```
- Core tables relevant to this audit:
  - `saas` (`0001_init.sql` + later augmentations): status, slug, domain/subdomain, tenant scoping.
  - `saas_projects` (`0045_drako_empire_runtime_core.sql`): tenant-scoped slug/display records tied 1:1 with SaaS.
  - `saas_domains` (`0017_saas_domains.sql`, `0028_saas_domains_core.sql`, `0047`, `0048`): custom + canonical domains, verification metadata, retry counters.
  - `core_departments` & `core_agents` (`0007_core_campamento_base.sql`): canonical catalog used when cloning to SaaS.
  - `agents` (`0001_init.sql` with later upgrades): original catalog linked to legacy departments; still referenced in some analytics/testing paths.
  - `saas_agents` (redefined in `0007_core_campamento_base.sql`): links SaaS to core agents, tracks status/config, maintains compatibility with legacy `agents` table via `core_agent_id`.
  - `inbox_messages`/`inbox_statuses` (`0008`, `0009`): shared inbox used post-provisioning for multi-tenant communications.
  - `saas_blueprints`, `saas_modules`, `saas_interview_answers` (`0029`): blueprint source of truth for factory provisioning.
  - `campamento_base` ecosystem tables (marketing/tax/vendor) seeded from `0060_factory_ready_core.sql` and others for onboarding flows.
  - Latest `0060_factory_ready_core.sql` introduces department/agent/pack catalogues and onboarding artifacts; aligns with "factory" concept.

## Entity Map & Relationships
- **saas** (`0001_init.sql` + later updates):
  - Primary ID (TEXT), unique slug.
  - Fields: `name`, `domain`, `subdomain`, `status`, `public_domain`, `public_subdomain`, `domain_status`, timestamps.
  - Tenant ownership enforced in queries (`tenant_id`).
- **saas_projects** (`0045_drako_empire_runtime_core.sql`):
  - Mirrors SaaS slug/display; seeded/updated whenever SaaS is created.
  - Status column used to signal active/pending projects even before SaaS materialization.
- **saas_domains** (`0028`, `0047`, `0048`):
  - Attributes: verification status/reason, retry_count, verification_token, last_error, `is_primary` flag.
  - Pairs with `resolveHostToSaas` runtime gating.
- **core_departments / core_agents** (`0007`):
  - Source catalog; `core_agents` references `core_departments` and is cloned into `saas_agents` during provisioning.
- **saas_agents** (`0007` redefinition):
  - Primary key synthetic `id`, referencing `saas` and `core_agents`.
  - Fields: `estado`, `config`, `assigned_at`.
- **inbox_messages` & `inbox_statuses`** (`0008`, `0009`):
  - Multi-tenant shared messaging backlog, referencing `saas_id` for routing.
- Supporting tables for factory blueprint: `saas_blueprints`, `saas_modules`, `saas_interview_answers`, `provisioning`, `alerts`, marketing/tax/vendor contexts (multiple migrations) — all touched in orchestrator.

## Current SaaS Creation Flow
Sources: `src/app/api/saas/route.ts`, `src/lib/campamento-base/saas-factory-orchestrator.ts`.

1. **Access Control & Setup**
   - `POST /api/saas` requires tenant session (`requireTenantAccess`).
   - Ensures D1 binding (`ensureDatabase`) and Campamento Base baseline (`ensureCampamentoBase`).
2. **Blueprint Path**
   - When `blueprintDraft` provided, normalizes via `withCampamentoBaseProfile` then runs `createSaasFromBlueprint`.
   - Orchestrator steps:
     - Generates SaaS ID & correlation.
     - Inserts into `saas`, `saas_projects` (slug/display), seeds `saas_domains` (canonical + optional custom).
     - Registers provisioning state, alerts, marketing/tax/vendor defaults, and records campamento events.
     - Optionally triggers Cloudflare provisioning (`provisionSaasInCloudflare`), Stripe product setup, AI config if env toggles allow.
     - Clones department packs -> `saas_agents` via `createAgentsForSaasFromPacks` and marketing/tax contexts.
3. **Manual Path (legacy fallback)**
   - Without blueprint, `POST /api/saas` inserts SaaS row, `saas_projects`, primary domain, alert, provisioning record, and loops through `core_agents` to populate `saas_agents` (role `activo`).
4. **Cleanup Guarantees**
   - On failure, best-effort deletion of partial records (alerts, provisioning entries, domains, projects, SaaS, agent links).
5. **Outputs**
   - Returns `id` and provisioning statuses. Domain statuses default to pending until DNS verified by worker.

## Host Resolution & Middleware Behavior
- `resolveHostToSaas` (`src/lib/empire/host-resolver.ts`):
  - Normalizes host, queries `saas_domains` by lowercased domain.
  - Maps DB row via `mapDomainStatus` (`host-status-utils.ts`) -> statuses `ACTIVE`, `PENDING`, `PAUSED`, etc., carrying verification metadata.
  - Resolves SaaS slug via `saas_projects` fallback to `saas`.
  - Returns correlation ID, severity hint.
- `middleware.ts`:
  - Records `routing.resolve.domain.active|blocked` events when sample/hit.
  - For ACTIVE: injects headers `x-drako-tenant-id`, `x-drako-saas-id`, `x-drako-saas-slug`, `x-drako-correlation-id`, `x-drako-domain-status`; preserves host headers and sets tenant cookie.
  - For PENDING/PAUSED: responds with JSON error (403/409/423) and headers `x-drako-domain-status`, `x-drako-domain-reason`, `x-drako-correlation-id`.
  - Fallback renders HTML guidance for unknown hosts.

## Build & Health Checks
- `npm install`
  - Result: up to date. Reported 4 vulnerabilities (1 low, 2 moderate, 1 high). Requires manual follow-up or `npm audit`.
- `npm run build`
  - Success. Warnings: edge runtime pages disable static generation; standard Next.js notice.
- `npm run pages:build`
  - Success via `@cloudflare/next-on-pages` CLI 1.13.16.
  - Re-runs `npm run build` inside CLI; same warnings as above.
- `npm run production:go`
  - Pass. Remote health skipped (no `PROD_URL` in env). Confirms required worker files, runbook, env vars, middleware/resolver guards.
- No pnpm usage because repository ships `package-lock.json`; npm remains authoritative.

### Notable Build Output Excerpts
```
▲ WARNING: You should not upload the `.next` directory.
▲ WARN! Build not running on Vercel. System environment variables will not be available.
⚠ Using edge runtime on a page currently disables static generation for that page
```
(Edge warning already accounted for in deployment strategy.)

## Observations & Risks (Current State)
- Multiple seeds/migrations assume SaaS-first vocabulary (`departamentos`, `core_departments`). Rebranding to "projects" will require careful aliasing.
- `saas_projects` table already exists, enabling company-level pivot but naming still SaaS-centric.
- Factory orchestrator touches numerous downstream services (marketing, tax, vendor, provisioning). Migration must guard these to avoid breaking autopilot flows.
- Host resolver strictly tied to `saas_domains`; any rebrand must keep table or provide compatible view for middleware and worker.

---

## PROPOSAL: Projects Factory Migration v1

### 1. Minimal Change Set (Departments → Companies)
1. Introduce `companies` terminology in presentation layer (UI copies, metadata) while keeping existing routes active.
2. Create alias tables/views:
   - `CREATE VIEW companies AS SELECT * FROM saas_projects` (initial step) or new table that inherits data via triggers.
   - `CREATE VIEW company_departments AS SELECT * FROM core_departments` for read paths.
3. Extend APIs with dual vocabulary:
   - Add `/api/companies` wrapper hitting existing SaaS handlers.
   - Add optional query params (`?entity=company`) to `/api/saas` endpoints to maintain compatibility.
4. Update provisioning orchestrator to emit both SaaS + company events/alerts without altering persistence yet.

### 2. Compatibility Strategy
- Maintain legacy tables (`saas`, `saas_projects`, `saas_domains`, `saas_agents`) through phase 1.
- Add database views & triggers to reflect writes into parallel `companies_*` abstractions if/when new schema introduced.
- Preserve middleware contract by continuing to resolve against `saas_domains`; later introduce `company_domains` view mapped onto same data.
- Introduce feature flag (`projectsFactoryV1`) gating new UI labels and endpoints per tenant.

### 3. Endpoint & UI Prioritization
1. **Phase 1 (Read-only Adoption)**
   - UI: `/owner/catalog`, `/owner/domains`, `/saas`, `/saas/create`—add alternate copy + toggle to display "projects".
   - API: provide `/api/companies` read endpoints (backed by existing services) for new frontend usage.
2. **Phase 2 (Creation Flow)**
   - Update `/api/saas` POST to accept `{ type: "project" }` while writing to same tables.
   - Mirror responses in new `/api/companies` to minimize frontend switch cost.
3. **Phase 3 (Full Rename)**
   - Migrate UI routes (`/projects`, `/projects/create`) with 301 redirects from existing `/saas*`.
   - Update worker/runbook messaging once DNS + provisioning fully references projects.

### 4. Primary Risks & Mitigations
- **Risk:** Breaking middleware/host resolver if schema renamed prematurely.
  - *Mitigation:* keep `saas_domains` canonical; only layer synonyms via views until worker updated.
- **Risk:** Provisioning scripts or workers expecting `saas_*` tables.
  - *Mitigation:* integration tests on `production:go`, plus targeted smoke tests after introducing views/triggers.
- **Risk:** Multi-tenant headers/back-office automations rely on `x-drako-saas-*` headers.
  - *Mitigation:* add new headers (`x-drako-project-*`) while preserving originals; update downstream consumers gradually.
- **Risk:** Analytics/reports referencing `saas` naming.
  - *Mitigation:* annotate runbooks, update SQL dashboards after view introduction, run dual-write validation.

### 5. Verification Checklists
- **Schema Layer**
  - [ ] Views/triggers created and tested (`companies`, `company_domains`, etc.).
  - [ ] `production:go` passes with new synonyms.
  - [ ] Migration rollback scripts validated.
- **API Layer**
  - [ ] `/api/companies` parity with `/api/saas` (GET/POST/PATCH).
  - [ ] Headers include both SaaS + project identifiers.
  - [ ] Smoke tests for provisioning endpoints succeed (local + remote).
- **UI Layer**
  - [ ] Feature flag toggles copy between SaaS/Projects in owner dashboard.
  - [ ] Redirects in place before renaming routes.
  - [ ] QA walkthrough of onboarding + domain management under new labels.
- **Observability**
  - [ ] Campamento events emit both `routing.resolve.domain.*` and new `projects.*` taxonomy.
  - [ ] Alerts & provisioning logs show updated vocabulary without losing historic data.
- **Release Management**
  - [ ] Update runbooks & docs (Campamento Base, domains, provisioning) to reference project terminology.
  - [ ] Communicate migration stages to stakeholders; confirm no active HITO conflicts.

---

## Step 2: companies compat layer (2026-01-09)

### Database compatibility views
- Migration `0061_projects_factory_companies_compat.sql` adds read-only views instead of duplicating data.
  - `companies` view proxies `core_departments` (`id`, `slug`, `nombre→name`, `descripcion→description`, `created_at` fixed to `NULL` because source table has no timestamp).
  - `company_domains` view proxies `saas_domains`, exposing verification metadata and mapping `company_id = saas_id` as an explicit temporary bridge until projects have their own primary key.
- Both views are declared with `CREATE VIEW IF NOT EXISTS` so they are idempotent and safe for replays.

### Read-only API surface
- New endpoint `GET /api/companies` resolves tenant auth via `requireTenantAccess` and selects from the `companies` view ordering by `name`.
- Response shape: `{ ok: true, tenantId, companies: Array<{ id, slug, name, description, created_at }> }`.
- Error handling reuses existing helpers:
  - `UnauthorizedError` → 401/403 JSON.
  - `respondDatabaseError` → 503 when DRACO_DB binding/migrations missing.
  - Unexpected errors emit correlation IDs with `reason: "query_failed"`.

### Manual verification snippet
Simulated curl against local dev (tenant header omitted defaults to demo tenant):
```bash
curl -s http://localhost:3000/api/companies | jq
```
Example JSON payload (derived from seeded `core_departments` rows):
```json
{
  "ok": true,
  "tenantId": "demo-tenant",
  "companies": [
    {
      "id": "core_acc",
      "slug": "contabilidad",
      "name": "Contabilidad",
      "description": "Controla facturas, cobros y cashflow.",
      "created_at": null
    },
    {
      "id": "core_dev",
      "slug": "programacion",
      "name": "Programación / Desarrollo",
      "description": "Mantiene el código y coordina despliegues.",
      "created_at": null
    }
  ]
}
```
- `company_id = saas_id` remains a temporary alias noted in migration comments.

---

## Step 3: domains & inbox progressive migration (2026-01-09)

### Company domains endpoint
- New route `GET /api/company-domains` exposing the `company_domains` view with optional `company_id`/`saas_id` and `status` filters.
- Ordering keeps recently updated domains first while remaining SQLite-compatible by avoiding `NULLS LAST` syntax.
- Response payload mirrors compat structure: `{ ok: true, tenantId, domains: [...] }`.

### Inbox dual vocabulary
- `/api/inbox` now accepts `company_id` as an alias for `saas_id` in filters and POST payloads.
- Responses enrich each message with `company_id` calculated from the underlying `saas_id`, keeping department metadata untouched.
- Inserts continue to auto-detect `department_id` but record the provided `company_id` for forward compatibility.
- No UI changes yet; front-end still consumes departments while receiving the new alias in the JSON payload.

---

## Step 4: company domains drilldown & automated coverage (2026-01-09)

### Endpoint: `/api/companies/:id/domains`
- Added read-only handler mirroring legacy `/api/saas/:id/domains` semantics but sourced from the `company_domains` view.
- Accepts `company_id` path param (compat with `saas_id`) and returns `{ ok, tenantId, companyId, domains }` with the same ordering guarantees as the bulk endpoint.
- Reuses shared query helper `listCompanyDomains`, ensuring filters stay consistent across endpoints.

### Regression tests (Node scripts)
- New script `npm run test:companies` compiles scripts and exercises:
  1. `/api/companies` list helper (`listCompanies`) to verify SQL projection.
  2. `/api/company-domains` helper filtering behaviour.
  3. Inbox compatibility utilities (`buildInboxQuery`, `resolveInboxCompanyAlias`, `enrichInboxItemsWithCompany`).
- Test runner depends on shared `register-paths` shim to load App Router modules inside Node.
- Output stored in CI logs; no fixtures yet (tests operate on mock data via injected query functions).

---

## Step 5: company domains detail endpoint QA (2026-01-09)

### Endpoint: `/api/companies/:id/domains`
- Read-only handler using `company_domains` view; path `company_id` remains compat alias for `saas_id`.
- Returns `{ ok: true, tenantId, companyId, domains }` with shared ordering to keep deterministic outputs across endpoints.
- Validates path param presence, returning `400` with `company_id_required` when missing.

### Automated coverage
- `npm run test:companies` adds assertions for `listCompanyDomainsForCompany` helper bindings.
- Added `npm run test:company-domains` script targeting shared helper logic (tenant-only filters, ordering with status).
- Tests rely on the Node shim `register-paths` to access App Router/lib modules.

### Checklist
- [x] `/api/companies/:id/domains` returns expected payload for seeded compat data.
- [x] Company domain helpers centralized under `@/lib/company-domains/domains`.
- [x] `npm run test:companies` and `npm run test:company-domains` passing locally.
- [x] `npm run build`, `npm run pages:build`, `npm run production:go` executed post-change.
- [ ] UI untouched (pending future phases).

---

## Next Steps
1. Align stakeholders on phased rollout plan above.
2. Prepare migration scripts (views, triggers) in draft PR with feature flag scaffolding.
3. Schedule end-to-end dry run once synonyms in place, prior to renaming public surfaces.

## Step 6: Companies UI (read-only)
Rutas creadas: /companies, /companies/[id].
Endpoints usados: GET /api/companies, GET /api/companies/[id]/domains.
Nota: compat mode: company_id = saas_id (temporary).
Checklist: vista /companies visible en admin, detalle /companies/[id] muestra dominios, navegación incluye Companies junto a Departments, etiqueta compat mode presente en ambas vistas, builds locales ejecutados tras cambios de código.

## Step 7: Inbox UI compat con companies (2026-01-10)
Cambios: la bandeja /inbox ahora carga el catálogo de compañías desde /api/companies para soportar compat `company_id = saas_id` sin tocar departamentos. Se añadió select de filtrado por company, persistencia en querystring y etiqueta de compat en los filtros. Cada mensaje muestra “Company: <nombre>” usando el listado cargado y el detalle refleja la misma información. El contexto de orquestador se actualiza con company_id/company_name.
Endpoints usados: GET /api/companies, GET /api/inbox?company_id=.
Compat mode: company_id = saas_id (temporary).
Checklist: [x] filtro por company en UI, [x] listado Inbox muestra label de company, [x] department_id permanece intacto, [x] compat indicator visible, [x] npm run build, [x] npm run pages:build, [x] npm run production:go.

## Step 12-A – Project Domains (API + UI + tests) (2026-01-11)
- [x] UI `/owner/projects/[id]` muestra dominios con estados, feedback y formulario inline para alta y verificación.
- [x] API `/api/projects/[id]/domains` y `/verify` gestionan duplicados y actualizan estados mediante `verifyProjectDomain` wrapper.
- [x] Script `npm run test:project-domains` con cobertura para crear/listar/verificar dominios y enforcement de tenant.
- [x] Ajustes en `ProjectsDbMock` para reflejar nuevos campos (last_error, verification_token, updated_at) y slugs de compañía.
- [x] Gates ejecutados tras los cambios.

Comandos ejecutados (orden cronológico):
- npm run test:projects
- npm run test:project-domains
- npm run build
- npm run pages:build
- npm run production:go

## Step 12-B – Project Entitlements (API + repository + tests) (2026-01-12)
- [x] Repositorio `src/lib/projects/entitlements.ts` creado con normalizadores (`normalizeStringArray`, `normalizeLimits`, `normalizeMetadata`) y helpers `getProjectEntitlements`/`upsertProjectEntitlements` usando upsert D1.
- [x] `src/lib/projects/repository.ts` actualizado para delegar en el nuevo módulo y retornar `ProjectDetail.entitlements` normalizado.
- [x] API `/api/projects/[id]/entitlements` (GET/PUT) implementada con validaciones, normalización de payload y enforcement de tenant.
- [x] Mock `ProjectsDbMock` extendido para soportar columnas `limits_json` y `metadata_json` en pruebas.
- [x] Script dedicado `npm run test:project-entitlements` añadiendo cobertura para defaults, normalización, updates, validaciones y tenant mismatch; integrado en `npm run test:projects-factory`.
- [x] Página `/owner/projects/[id]` sincronizada para mostrar packs, features y metadatos normalizados.
- [x] `tsconfig.scripts.json` incluye las rutas nuevas para compilar los tests.

Comandos ejecutados (orden cronológico):
- npm run test:project-entitlements
- npm run test:projects
- npm run test:project-domains
- npm run build
- npm run pages:build
- npm run production:go
