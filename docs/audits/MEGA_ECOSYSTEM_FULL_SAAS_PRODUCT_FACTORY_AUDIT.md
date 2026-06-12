# Mega Ecosystem Full SaaS Product Factory Audit

Fecha: 2026-06-12

Alcance: auditoria total del ecosistema Drako: SaaS/productos, Campamento Base, Factory/provisioning, rutas, APIs, DB/migrations, auth, tenancy, billing, observabilidad, CI/CD, contratos, guardrails y estado real de produccion.

Reglas aplicadas: no se implemento codigo, no se modifico codigo productivo, tests, guardrails, migrations, UI, rutas API, formatters ni commits. Este documento es el unico archivo creado para esta tarea.

## Resumen ejecutivo

El ecosistema Drako tiene producto real, infraestructura real y mucha cobertura, pero no esta production-ready como ecosistema multi-SaaS. SocialFlow es el SaaS mas avanzado y el mas cercano a monetizacion real. Mentoria tiene la mayor profundidad funcional como vertical educativo, pero necesita auditoria y endurecimiento propios antes de considerarse producto independiente estable. Clinic esta parcialmente neutralizado y puede servir como vertical operativa pequena, pero no como SaaS completo. Factory/provisioning tiene piezas reales de billing, jobs, domains, rollback y Cloudflare, pero todavia no debe usarse para crear mas SaaS sin cerrar fronteras. TaskOps es el bloqueo arquitectonico principal porque sigue en `campobase` y no existe `src/lib/taskops`.

La verdad corta: hay un producto ensenable primero (SocialFlow, con reservas), hay un producto prometedor pero todavia demasiado amplio y sensible (Mentoria), y hay una fabrica que parece poderosa pero todavia puede multiplicar deuda si se usa antes de cerrar TaskOps, auth/tenancy, billing y contratos de producto.

Estado global:

| Area | Madurez | Lectura |
| --- | --- | --- |
| Drako marca/casa central | AMARILLO | Marca y shell existen; producto vendible no esta claramente separado de control-plane/factory. |
| Campamento Base | AMARILLO | Control-plane real, pero aun concentra operator, provisioning y facades de producto. |
| SocialFlow | AMARILLO/VERDE | SaaS mas avanzado; tiene runtime, auth, APIs, Social DB, LinkedIn, tests y readiness, pero con drift de arquitectura. |
| Mentoria | AMARILLO/NARANJA | Mucha funcionalidad real y DB propia; requiere auditoria profunda de producto, auth, billing y runtime. |
| Clinic | AMARILLO | Vertical real parcial; neutralizado en control-plane, pero producto incompleto. |
| TaskOps | NARANJA | Motor transversal sin namespace neutral; bloquea guardrail `campobase`. |
| Factory/provisioning | NARANJA | Hay jobs, rollback, Stripe, domains y workers, pero no debe crear SaaS nuevos todavia. |
| Auth/tenancy | AMARILLO/NARANJA | Multiples sistemas y auths aislados; riesgo alto de inconsistencias por producto. |
| Billing/Stripe | AMARILLO | Stripe real, webhook canonico, Mentoria/SocialFlow/factory hooks; falta cierre comercial por producto. |
| DB/migrations | NARANJA | Muchas tablas reales, pero historicas, duplicadas y multi-tenant mezcladas. |
| Observabilidad/produccion | AMARILLO | Health, incidents, readiness checks, workers y reports existen; algunos checks fallan. |
| CI/CD | AMARILLO | Workflows canonicos y guards existen; hay drift entre tests SocialFlow y estado real. |

## Inventario total del repositorio

### Estructura principal

- `src/app`: superficies publicas, privadas, producto, owner/operator/admin y API routes.
- `src/app/api`: mas de 200 rutas API versionadas, agrupadas por producto y plataforma.
- `src/lib`: namespaces de producto, control-plane, runtime compartido, billing, auth, observabilidad, factory y legacy.
- `migrations`: 100+ migrations SQL con tablas core, producto, billing, auth, social, mentoria, clinic, factory y observabilidad.
- `workers`: workers Cloudflare separados o semi-separados: `socialflows`, `automations`, `saas-factory-worker`, `drako-ai-orchestrator-worker`, `autopilot-worker`, `alerts-agent`.
- `apps`: contiene runtime separado `apps/socialflow-runtime` y artefactos build; relevante para SocialFlow standalone/canary.
- `packages`, `connectors`: paquetes/conectores auxiliares.
- `docs/audits`, `docs/contracts`: 140+ documentos de auditoria/contratos, algunos vigentes y otros historicos.
- `.github/workflows`: deploy/build factory, multi-SaaS workers y cron runbook.

### SaaS/productos detectados

| Producto | Evidencia real | Clasificacion |
| --- | --- | --- |
| SocialFlow | `src/lib/socialflow`, `src/app/socialflow`, `src/app/api/socialflow`, `src/app/api/internal/socialflow`, Social DB/auths, worker `workers/socialflows` | SaaS real mas avanzado |
| Mentoria | `src/lib/mentoria`, `src/app/mentoria`, `src/app/api/mentoria`, Mentoria DB/auths, muchas migrations | SaaS real pero no suficientemente auditado |
| Clinic | `src/lib/clinic`, `src/app/clinic`, `src/app/api/clinic`, clinic tables | Vertical/SaaS parcial |
| Drako | `src/lib/drako`, `src/app/drakos`, `src/app/products`, marca/docs | Marca/casa central, no SaaS unico claro |
| Campamento Base | `src/lib/campamento-base`, `src/app/api/campamento-base`, owner/operator | Control-plane interno |
| Factory | `src/lib/factory`, `src/lib/saas-factory`, `src/app/api/factory`, `src/app/api/owner/saas-factory`, workers | Modulo/fabrica transversal |
| TaskOps | `src/lib/tasks`, legacy `src/lib/campobase/taskops-*`, tests cross-saas | Motor transversal, no SaaS vertical |
| Bases/Auths/Drakos Auths | `src/app/bases`, `src/lib/auths`, APIs auths | Plataforma/auth products, no producto SaaS maduro |
| Dev Architects, Projects, Economy, HR, Customers | namespaces/rutas/tables | Modulos/verticales parciales, no SaaS cerrados |

### Namespaces principales de `src/lib`

- Control-plane canonico: `campamento-base`.
- Legacy congelado: `campobase`.
- Productos: `socialflow`, `mentoria`, `clinic`, `drako`.
- Factory/provisioning: `factory`, `saas-factory`, `provisioning`, `cloudflare`, `domains`.
- Runtime compartido: `automation-core`, `integration-core`, `observability-core`, `saas-contract`, `tasks`, `whatsapp`, `billing`, `stripe`, `auth`, `auths`, `authz`, `tenants`, `db`.
- Superficies internas: `operator`, `owner`, `admin`, `supervisor`.
- Legacy/facades: `social` deprecado hacia `socialflow`, `campobase` adapters.

### Demo/mock/fallback

- `src/app/_saas_broken`: superficie rota/broken de factory create.
- `.demo`, `_temp`, `.tmp-*`, `reports`, outputs de drift/readiness.
- `src/lib/socialflow/ai/models/LocalStubProvider.ts` y `localModel.ts`: fallback/model stub.
- Rutas legacy bloqueadas: varias tests `*-legacy-production-block.test.ts` y endpoints `_blocked`.
- Migrations seed demo: `0014_demo_tenant_seed.sql`, `0057_seed_demo_basics.sql`, `0058_seed_demo_saas_project.sql`.
- `apps/socialflow-runtime/.open-next` y `workers/*/.wrangler/state`: artefactos/runtime local, no fuente limpia de producto.

### Tests y CI/CD

- Tests totales detectados: 461 archivos bajo `tests`.
- Architecture tests clave: `campobase-namespace-freeze`, `socialflow-*`, `mentoria-vertical-boundaries`, `saas-boundary-import-guards`, `control-plane-separation-audit`.
- Tests producto: SocialFlow tiene amplia suite de readiness, OAuth, production gates, route DNS, read models, runtime seed, private pilot; Mentoria tiene API/component/runtime tests; Factory tiene API/e2e/recovery/status tests; Clinic tiene service/wrapper/control-plane tests.
- Workflows: `drako-factory-deploy.yml`, `deploy-multi-saas-workers.yml`, `build-worker.yml`, `dks-cron-runbook.yaml`.

## Auditoria por SaaS/producto

### 1. Drako / marca central

Existe realmente como marca/casa central por docs, public pages y modulos:

- Rutas: `/`, `/about`, `/products`, `/products/socialflow`, `/drakos/auths/*`, `/vision`, `/system`, `/site`.
- Lib: `src/lib/drako/{onboarding,metrics,activation,content,memory,agent-core,insights}`.
- Auths: `src/lib/auths/drakos-auths.ts`, `src/app/api/drakos/auths/*`.
- DB: comparte `DRACO_DB`/`DRAKOS_AUTHS_DB` en configs.

Lectura:

- Drako funciona mas como marca paraguas y shell de ecosistema que como producto vendible unico.
- La home/landing y catalogo existen, pero la propuesta comercial vendible esta dispersa entre SocialFlow, Mentoria, Factory y Campamento Base.
- Riesgo: Drako se mezcla conceptualmente con control-plane, auths, factory y portfolio; debe clarificarse como marca y no como runtime.

Accion:

- Definir Drako como brand/corporate shell.
- Separar marketing publico de operator/control-plane.
- No vender "Drako" como SaaS si el producto monetizable real es SocialFlow o Mentoria.

### 2. Campamento Base

Responsabilidades reales:

- Control-plane/holding operativo.
- Orchestrator/snapshot/QA.
- Operator WhatsApp notifications.
- SocialFlow control-plane service.
- Social automation registry/history.
- Platform bootstrap loader.
- SaaS factory/provisioning plans.
- Stripe wizard/provisioning factories.
- Analytics/BI/templates/lifecycle/export.

Rutas:

- `/api/campamento-base/orchestrator`
- `/api/campamento-base/contracts`
- `/api/campamento-base/operator/whatsapp/*`
- `/api/campamento-base/provisioning/*`
- `/api/campamento-base/saas-factory/chat`
- `/api/campamento-base/supervisor/*`
- Owner/operator pages and APIs also act as Campamento Base surfaces.

Estado:

- Si actua como control-plane real: si.
- Que debe quedarse: governance, observability, contracts, provisioning orchestration, portfolio/operator views, policy.
- Que debe separarse: runtime interno de productos, product-specific business logic, SaaS-specific repositories.
- Riesgo: `campamento-base` es canonico, pero puede convertirse en monolito si cada producto agrega un `*-control-plane-service` con logica interna.

### 3. SocialFlow

Estado como SaaS independiente:

- Rutas privadas: `/socialflow/(workspace)`, settings, AI, setup, analysis, sessions, profile, plan.
- Auth: `/socialflow/auth`, `/api/socialflow/auths/*`, `src/lib/socialflow/auth/*`, `src/lib/auths/socialflow-auths.ts`.
- APIs: `/api/socialflow/*`, `/api/internal/socialflow/*`, `/api/cron/social*`.
- Runtime/product code: repository, scheduler, live publishing, LinkedIn OAuth/client/publishing, token encryption, private pilot, profile, export.
- Contracts: automation, observability, operator-actions, owner-dashboard, campobase, export-core-read, legacy-actions-core, repository-core-context, linkedin-oauth-runtime.
- Workers/runtime: `workers/socialflows`, `apps/socialflow-runtime`, production/canary audits and smoke tests.
- Persistence: `SOCIAL_DB`, `SOCIALFLOW_AUTHS_DB`, tables `saas_social_*`, `socialflow_*`, OAuth/read model/legacy tables.

Estado de funcionalidades:

- Composer/AI: existe `SocialFlowOrchestrator`, agents, content generation.
- Scheduler: `processScheduledPosts`, cron routes.
- LinkedIn: OAuth/connect/callback/validate/publishing exists.
- Analytics/CRM social: profile, channel knowledge, metrics/read models, observability snapshots.
- Automatizacion real: automation keys in Campamento Base and SocialFlow contracts; internal APIs exist.
- Monetizacion: billing settings page and workspace checkout route point to SocialFlow billing paths; production readiness has many tests, but not fully green.

Riesgos:

- Validacion SocialFlow architecture falla actualmente en 3 assertions:
  - runtime scaffold test espera `saas-socialflows-runtime-scaffold`, pero wrangler actual es `saas-socialflows-runtime-canary-nonprod`.
  - boundary test espera legacy campobase service importing SocialFlow contracts, pero ahora reexporta Campamento Base control-plane service.
  - export tenant isolation evidence espera SQL `WHERE tenant_id = ?` directamente en export service, pero el servicio delega a contract.
- Hay 24 hits allowlisted en SocialFlow DRACO dependency radar; no hay hits nuevos, pero la dependencia historica sigue.
- SocialFlow es el mas avanzado, pero el drift test/documentacion impide declarar production-ready sin una reconciliacion.

Lectura: SocialFlow es el primer candidato a monetizar, pero necesita un bloque de production-readiness y alineacion de architecture tests/docs antes de venta amplia.

### 4. Mentoria

Existe como SaaS independiente en superficie y dominio funcional:

- Rutas app: `/mentoria/app`, `/mentoria/app/workspace`, `/academic`, `/parents`, `/progress`, `/onboarding`, `/share/[shareCode]`.
- Auths: `/mentorias/auths/logins`, `/registrations`, APIs `src/app/api/mentorias/auths/*`, `src/lib/auths/mentorias-auths.ts`.
- APIs producto: academic, acquisition, analytics, billing, chat, exercises, family, focus, growth, health, hooks, onboarding, planner, profile, progress, session, sessions, upgrade, workspace.
- Lib: repository/service/session-engine/workspace-orchestrator/family-service/academic-service/trial-system/billing-cycle/parent-notifications/intervention/motivation/learning-loop/state/resilience.
- DB: muchas migrations `mentoria_*`, `students`, `guardians`, `families`, academic records/documents/extractions, trials, sessions, feedback, notifications, acquisition, material intakes, memory/state.
- Billing: `/api/mentoria/billing/checkout|confirm|portal`, `getMentoriaStripePriceId`, canonical subscription state.
- Tests: API, components, runtime, architecture boundary and production flow tests exist.

Estado real vs docs:

- Mentoria no es solo pantalla: tiene persistencia, rutas, auth, billing y logica educativa.
- Tambien es el producto con mas superficie sensible: menores/familia, padres/alumnos/tutores, imagenes/tareas, aprendizaje, progreso, privacidad.
- No se verifico suite completa; la auditoria puntual muestra existencia, no certificacion production-ready.

Riesgos:

- Demasiadas capacidades a la vez: agentes educativos, orquestador emocional, planner, habitos, control parental, subida de imagenes, examenes, profesores/colegio implican alta exigencia de privacidad y compliance.
- Multiples DB/bindings: `MENTORIA_DB`, `MENTORIAS_AUTHS_DB`, `DB` legacy/alias; riesgo de drift.
- Falta una auditoria dedicada de producto real vs docs, flujo E2E, permisos guardian/student, billing y data retention.

Lectura: Mentoria es probablemente el producto mas profundo, pero no el mas seguro para monetizar primero sin auditoria especifica.

### 5. Clinic

Estado:

- Rutas app: `/clinic`, `/clinic/dashboard`, `/leads`, `/agenda`, `/finance`, `/messages`.
- APIs: `/api/clinic/appointments`, `/leads`, `/metrics`, `/finance`, `/profile`, `/services`; `/api/site/clinic/leads`.
- Lib: repository/types/context/api-helpers/appointment-health/control-plane orchestration/service/platform-wrapper.
- DB: `clinic_profiles`, `clinic_services`, `clinic_leads`, `clinic_appointments`, `clinic_reviews`, `clinic_finance_entries`.
- Neutralizacion: `src/lib/clinic/service.ts` y `platform-wrapper.ts`; legacy `src/lib/campobase/clinic-platform.ts` reexporta wrapper neutral.
- Tests: clinic service, platform wrapper, control-plane context/orchestration/handler, appointment health.

Lectura:

- Puede funcionar como vertical parcial para leads/citas/finanzas.
- No esta al nivel de SaaS completo: falta product-market flow, auth propio robusto, billing dedicado, onboarding comercial y production smoke completo.

### 6. TaskOps

Estado:

- No existe `src/lib/taskops`.
- Existe `src/lib/tasks` como repositorio/tipos/API helpers.
- Runtime TaskOps legacy vive en `src/lib/campobase/taskops-platform.ts` y `taskops-platform-service.ts`.
- Contratos documentales: `campamento-base-taskops-orchestration-contract-v1.md`, y un `docs/contracts/taskops-neutral-runtime-parity-contract-v1.md` aparece como untracked en el workspace.
- Tests: `campobase-taskops-platform-service.test.ts`, `cross-saas-taskops-flow.test.ts`.

Por que bloquea:

- Guardrail `campobase` size `4` contiene exactamente TaskOps/cross-saas.
- Sin service/platform neutral, no se debe tocar bootstrap legacy.

Accion:

- Crear `src/lib/taskops/service.ts` y `src/lib/taskops/platform.ts`.
- Portar paridad runtime y signal handler `task.overdue`.
- Luego reducir guardrail por fases.

### 7. Factory / fabrica de SaaS / provisioning

Que existe:

- `src/lib/factory`: orchestrator, registry, control-plane, actions, status, recovery, incidents, trends, scheduler/worker, billing/contracts/templates.
- `src/lib/saas-factory/create-saas.ts`.
- `src/lib/campamento-base/saas-factory-orchestrator.ts`: provisioning real con DB, Stripe, Cloudflare/domain provider, JobRunner, runtime contract, bootstrap, rollback y events.
- APIs: `/api/factory/*`, `/api/factory/provisioning/*`, `/api/owner/saas-factory/*`, `/api/campamento-base/saas-factory/chat`.
- Workers: `workers/saas-factory-worker`, plus factory deploy workflow.
- Tests: API factory, owner factory, e2e factory create SaaS, runtime parity/equivalent.

Que crea realmente:

- Registros SaaS, domains, features/bootstrap, Stripe product/prices, runtime contract state, jobs.
- Tambien crea runtime definitions dinamicas en `saas-contract`.

No esta lista para fabrica real porque:

- Aun hay `src/app/_saas_broken`.
- `platform-bootstrap-loader` solo SocialFlow READY; Clinic/TaskOps SKIPPED.
- Si se crean nuevos SaaS antes de cerrar contrato estandar, se replicara acoplamiento a Campamento Base.
- Auth/tenancy/billing deben ser plantilla obligatoria, no opcionales.

Lectura: Factory tiene base real, pero debe congelarse para nuevos SaaS hasta cerrar TaskOps, SaaS product template, tenancy y production gates.

### 8. Otros modulos detectados

| Modulo | Estado | Riesgo |
| --- | --- | --- |
| Owner/Operator | Superficies reales con auth owner; muchas APIs duplicadas entre owner/operator | Mezcla de control-plane y UX operativa |
| Auth/Auths/Authz | NextAuth/session + auths aislados por contexto + authz SaaS | Multiplicidad de sistemas y fallback legacy |
| Billing/Stripe | Checkout, portal, webhook canonico, subscription state, entitlements, factory billing | Mezcla de workspace/product/client SaaS billing |
| Observability-core | Activities, incidents, health snapshots, reports, checks | Buen cimiento; falta cerrar smokes y failing checks |
| Automation-core | Registro/ejecucion/historial de automations | Base correcta; TaskOps depende de ella |
| Integration-core | Connections/providers LinkedIn/WhatsApp | Reusable, pero providers pueden conocer productos |
| WhatsApp | Identities/repository/inbound | Transversal; usado por Clinic/TaskOps/Mentoria |
| Tenants/Domains | Tenant services, domain provider, route checks | Critico para multi-SaaS; debe ser guardado por tests |
| Economy/HR/Customers/Projects | Modulos operativos con DB/rutas | Parciales; no vender como SaaS independientes todavia |

## Auditoria de rutas y producto real

| Ruta | Producto/modulo | Tipo | Estado | Dependencias | Riesgo | Accion |
| --- | --- | --- | --- | --- | --- | --- |
| `/`, `/about`, `/products` | Drako | publica | parcial/real | marketing/catalog | medio | Clarificar oferta comercial. |
| `/products/socialflow` | SocialFlow marketing | publica | parcial | product page | medio | Alinear con readiness real. |
| `/socialflow/auth` | SocialFlow | publica/auth | real | auths/socialflow | medio | Mantener isolation tests. |
| `/socialflow/(workspace)` | SocialFlow | privada | real | SocialFlow session/repository | medio | Corregir drift architecture. |
| `/mentoria/onboarding` | Mentoria | publica/privada | real parcial | Mentoria session | medio | Auditar E2E. |
| `/mentoria/app/*` | Mentoria | privada | real parcial | Mentoria APIs/DB | alto | Hardening privacidad/familia. |
| `/clinic/*` | Clinic | privada/product | parcial | Clinic API/repository | medio | Completar auth/billing/product. |
| `/campobase/*` | legacy control surface | privada | legacy controlado | Campamento Base adapters | medio | Mantener frozen/migrar a canonico. |
| `/operator/*` | Campamento Base/operator | privada | real | owner auth, operator APIs | medio | Evitar runtime product logic. |
| `/owner/*` | Campamento Base/owner | privada | real | owner APIs | medio | Unificar owner/operator duplication. |
| `/admin` | Admin | privada | parcial/desconocida | admin/session | medio | Auditar auth. |
| `/billing/*` | Billing | publica/privada | real parcial | Stripe/subscriptions | alto | Consolidar product billing. |
| `/bases/*`, `/drakos/auths/*`, `/mentorias/auths/*` | Auths | publica/auth | real parcial | auths SSOT | alto | Verificar aislamiento por contexto. |
| `/api/internal/socialflow/*` | SocialFlow internal | API interna | real | internal API auth/contracts | alto | Mantener service token/tenant isolation. |
| `/api/factory/*` | Factory | API privada | parcial/real | owner/tenant auth, billing, provisioning | alto | Congelar nuevos SaaS. |
| `/api/health/*` | Observabilidad | publica/interna | real | health/db/env | medio | Definir exposure policy. |

## Auditoria de APIs

| Grupo API | Estado | Riesgo | Accion |
| --- | --- | --- | --- |
| `/api/socialflow/*` | Producto real con auth/session, LinkedIn, posts, profile, exports | Medio-alto | Corregir failing architecture tests y tenant evidence. |
| `/api/internal/socialflow/*` | Internal API real | Alto | Confirmar service token, no exponer publicamente. |
| `/api/mentoria/*` | Producto real amplio | Alto | Auditoria dedicada de permisos, familia, imagenes, billing. |
| `/api/clinic/*` | Producto parcial real | Medio | Completar auth/billing/onboarding. |
| `/api/factory/*` | Factory real/parcial | Alto | Mantener auth fuerte y bloquear creacion no elegible. |
| `/api/owner/*` y `/api/operator/*` | Control-plane operativo real | Medio | Reducir duplicacion y evitar producto interno. |
| `/api/campamento-base/*` | Control-plane canonico | Medio | Mantener contratos, no runtime SaaS. |
| `/api/campobase/*` | Legacy bridge | Medio | Mantener adapters, no crecer. |
| `/api/billing/*`, `/api/stripe/*` | Billing real con Stripe | Alto | Consolidar metadata/attribution por producto. |
| `/api/auth/*`, `/*/auths/*` | Auth real multi-contexto | Alto | Tests por contextos y no fallback legacy. |
| `/api/health/*`, `/api/metrics`, `/api/alerts` | Observabilidad | Medio | Definir publico vs interno. |
| `/api/test-social-scheduler` | Test/demo | Alto si prod | Bloquear en produccion o mover a scripts. |

## Base de datos y migrations

Tablas reales por area:

- Core/tenancy: `tenants`, `tenant_users`, `tenant_profiles`, `tenant_domains`, `tenant_jobs`, `tenant_audit_logs`, `saas`, `saas_instances`, `saas_tenants`.
- SocialFlow/social: `saas_social_accounts`, `saas_social_campaigns`, `saas_social_posts`, `saas_social_metrics`, `socialflow_oauth_connections`, `socialflow_users`, `socialflow_credentials`, `socialflow_sessions`, `socialflow_export_read_models`, `socialflow_runtime_channel_*`, `socialflow_legacy_*`.
- Mentoria: `mentoria_sessions`, `student_profiles`, `students`, `guardians`, `families`, `student_guardians`, `family_memberships`, `mentoria_academic_*`, `mentoria_material_*`, `mentoria_student_*`, `mentoria_progress`, `mentoria_exercises`, `student_trials`, `mentoria_notification_*`, `mentoria_feedback_jobs`.
- Clinic: `clinic_profiles`, `clinic_services`, `clinic_leads`, `clinic_appointments`, `clinic_reviews`, `clinic_finance_entries`.
- Factory/provisioning: `provisioning`, `drako_factory_saas_registry`, `holding_saas_registry`, `saas_blueprints`, `saas_modules`, `saas_template_*`, `campamento_events`, `domain_events`, `projects`, `project_domains`, `project_entitlements`.
- Billing: `saas_pricing_plans`, `saas_subscriptions`, `saas_usage_quotas`, `billing_audit_logs`, `stripe_invoice_runs`, `saas_billing_audit`, `tenant_billing`, `checkouts`.
- Auth: `auth_accounts`, `auth_sessions`, `auth_verification_tokens`, context auth DB bindings for SocialFlow/Mentoria/Drakos/Bases.
- Observability: `drako_observability_activities`, `drako_observability_incidents`, `drako_observability_health_snapshots`, `alerts`, `metrics`, `rate_limit_audits`, `ai_breaker_logs`.
- Demo/seed: demo tenant/basic SaaS seeds.

DB config:

- `wrangler.workers.toml` binds `DRACO_DB`, `DRAKOS_AUTHS_DB`, `MENTORIAS_AUTHS_DB`, `SOCIALFLOW_AUTHS_DB`, `BASES_AUTHS_DB`, `DB`, `MENTORIA_DB`, `SOCIAL_DB`, queues and scheduler.
- `wrangler.jsonc` local config has `SOCIALFLOW_AUTHS_DB` remote true, which is a risk if used unintentionally in local/dev.
- Preview intentionally lacks `SOCIAL_DB` per comments, fail-closed.

Riesgos:

- Duplicated/renamed tables (`saas_instances`, `saas_subscriptions`, `mentoria_subjects`, `saas_customer_profiles`) indicate historical drift.
- Shared DB patterns require strict `tenant_id` enforcement.
- Product DB isolation is partial: auth DBs separated for some products, data DBs mixed/aliased in places.

## Auth, tenancy y permisos

Existe:

- `src/lib/auth/session.ts`: `requireOwnerAccess`, `requireTenantAccess`.
- NextAuth/session: `src/lib/auth`.
- Auths isolated contexts: `src/lib/auths/*` for Drakos, Bases, Mentorias, SocialFlow.
- Authz SaaS access: `src/lib/authz/saas-access.ts`.
- Product sessions: `src/lib/socialflow/auth/*`, `src/lib/mentoria/auth/request.ts`.

Estado por producto:

- SocialFlow: auth propia y context boundary; tests existen.
- Mentoria: auth propia via `requireCurrentMentoriaSession`; muchas APIs la usan.
- Factory: owner/tenant auth y authz en provisioning routes; legacy provisioning routes bloqueadas.
- Campamento Base/Owner/Operator: owner access extendido en muchas APIs.

Riesgos:

- Multiples sistemas auth pueden divergir.
- Algunos endpoints publicos/health/internal necesitan policy explicita.
- Operator agents route tiene TODO de service token auth para agentes autonomos.

Falta:

- Matriz de auth por ruta.
- Service-token para internal APIs/agents.
- Tests de tenant isolation por cada producto y ruta critica.

## Billing, Stripe y monetizacion

Existe:

- Stripe client/rest/server wrappers.
- Canonical webhook `/api/stripe/webhook` con signature verification, dedupe, attribution, subscription persistence, entitlements sync y factory activation.
- Checkout/portal routes para workspace/SocialFlow style billing.
- Mentoria billing checkout/confirm/portal con canonical subscription state.
- Factory billing/quota checks before create-saas.
- Plans/pricing modules and migrations for SaaS subscriptions/quotas.

Productos monetizables hoy:

- SocialFlow: mas cercano a monetizacion por readiness, billing settings y production checks, pero no verde por failing architecture tests.
- Mentoria: tiene billing real, pero no debe monetizarse ampliamente sin auditoria profunda de producto/privacidad.
- Clinic: no parece tener billing dedicado completo.
- Factory: debe monetizarse solo como capability interna/owner, no como self-serve publico aun.

Riesgos:

- Metadata de Stripe mezcla workspace, product, client SaaS y factory activation.
- Rutas legacy billing bloqueadas indican transicion correcta pero incompleta.
- Falta pricing comercial canonico por producto y E2E payment-to-access por SaaS.

## Observabilidad, produccion y CI/CD

Existe:

- Health endpoints: `/api/health`, `/api/health/db`, `/api/health/env`, `/api/health/ai`, `/api/health/release`, product health routes.
- Observability core: activities, incidents, health snapshots, summaries.
- Production checks: `check-production-readiness`, workers/hostnames drift, SocialFlow production readiness tests.
- Workers: socialflows, automations, saas-factory-worker, drako-ai-orchestrator-worker, autopilot-worker, alerts-agent.
- Cloudflare: D1, queues, service binding, R2 cache, AI binding.
- CI workflows: factory deploy, multi-SaaS workers deploy, build worker, cron runbook.

Estado real:

- `pnpm typecheck` pasa.
- Guardrail `campobase` pasa.
- SocialFlow architecture tests no pasan completos en esta validacion puntual. Eso bloquea production-ready.

Falta:

- Smoke real por producto en CI.
- Runtime deploy matrix limpia por SaaS.
- Documentar que artefactos `.open-next`/`.wrangler` no son fuente.
- Cerrar failing tests antes de cualquier "production-ready".

## Imports y acoplamiento

### `@/lib/campobase`

Guardrail actual: `4`.

Edges reales vivos:

- `src/lib/campobase/platform-bootstrap.ts::@/lib/campobase/taskops-platform`
- `src/lib/campobase/taskops-platform.ts::@/lib/campobase/taskops-platform-service`
- `tests/lib/campobase-taskops-platform-service.test.ts::@/lib/campobase/taskops-platform-service`
- `tests/lib/cross-saas-taskops-flow.test.ts::@/lib/campobase/taskops-platform`

Clasificacion: bloqueado por guardrail, permitido temporal, debe migrarse cuando exista TaskOps neutral.

### `@/lib/campamento-base`

Usos correctos:

- Rutas Campamento Base, owner/operator, provisioning, analytics, templates, control-plane services.

Usos peligrosos si crecen:

- Product runtime importing control-plane directly.
- Factory templates using Campamento Base helpers in product code.
- `_saas_broken` references.

### Cross-SaaS y legacy/demo

- SocialFlow tiene legacy facades `src/lib/social/*` y `src/lib/campobase/socialflow-*`.
- Clinic legacy adapter ahora reexporta neutral wrapper.
- TaskOps sigue legacy real.
- Factory hacia productos debe usar `saas-contract`, APIs internas o events, no imports directos.

## Estado de madurez por area

| Area | Estado | Razon |
| --- | --- | --- |
| Drako marca/casa central | AMARILLO | Marca y shell existen; oferta vendible dispersa. |
| Campamento Base | AMARILLO | Control-plane real con riesgo de monolito. |
| SocialFlow | AMARILLO/VERDE | Producto mas avanzado, pero architecture checks fallan. |
| Mentoria | AMARILLO/NARANJA | Muy funcional, sensible y no auditado completo. |
| Clinic | AMARILLO | Vertical parcial, neutralizado pero incompleto. |
| TaskOps | NARANJA | Sin namespace neutral. |
| Factory/fabrica SaaS | NARANJA | Real pero no segura para crear mas SaaS aun. |
| Auth | AMARILLO/NARANJA | Muchos contextos y riesgo de drift. |
| Billing | AMARILLO | Stripe real, monetizacion no cerrada por producto. |
| DB/tenancy | NARANJA | Muchas tablas y duplicados historicos. |
| Observabilidad | AMARILLO | Buena base, faltan smokes green. |
| CI/CD | AMARILLO | Workflows existen; drift SocialFlow. |
| Documentacion/contratos | AMARILLO | Abundante, necesita depuracion de vigencia. |
| Tests | AMARILLO | Mucha cobertura, no toda pasa en subset arquitectura. |
| UX/producto | AMARILLO | SocialFlow ensenable; Mentoria prometedora; Clinic parcial. |
| Separacion real SaaS | AMARILLO/NARANJA | SocialFlow/Clinic avanzan; Mentoria y Factory requieren frontera. |
| Conexion Campamento Base | AMARILLO | Contratos/API, pero riesgo de control-plane monolitico. |

## Verdad incomoda

Partes reales:

- SocialFlow tiene producto, auth, APIs, persistencia, LinkedIn, scheduler, billing surface, workers y readiness serio.
- Mentoria tiene producto profundo, DB, auth, billing, academic/family/session flows y mucha logica real.
- Factory/provisioning tiene jobs, domains, Stripe, rollback y tests.
- Campamento Base es un control-plane real.

Partes fachada/demo:

- Drako como "producto vendible" esta mas cerca de marca/shell que de SaaS cerrado.
- `src/app/_saas_broken` es literalmente broken/demo.
- Algunos workers/runtime artefactos son scaffold/canary/local, no produccion consolidada.
- Clinic es vertical parcial, no producto completo.
- Varios modulos operativos (Economy, HR, Customers, DevArchitects) son piezas, no SaaS vendibles.

Partes peligrosamente mezcladas:

- Factory + Campamento Base + billing + domains + SaaS bootstrap.
- TaskOps dentro de `campobase`.
- Auths multi-contexto con legacy compat flags.
- DB multi-tenant con tablas duplicadas/historicas.

Producto que se puede ensenar a un cliente:

- SocialFlow, en demo controlada o piloto privado, explicando limits y canary/readiness.

Producto que no se debe ensenar todavia:

- Factory self-serve.
- TaskOps como producto.
- Clinic como SaaS completo.
- Mentoria a escala publica sin auditoria de privacidad/menores y E2E.

Producto que se puede monetizar primero:

- SocialFlow, despues de cerrar failing architecture tests y billing/access smoke.

Que NO se debe seguir construyendo:

- Nuevos SaaS con Factory.
- Nuevos imports a `campobase`.
- Nuevas rutas producto que dependan directamente de Campamento Base runtime.
- Mas verticales antes de cerrar auth/tenancy/billing template.

## Plan maestro de reparacion

| Fase | Objetivo | Areas | Entregables | Tests | Riesgo | Criterio de terminado |
| --- | --- | --- | --- | --- | --- | --- |
| FASE 0 - Congelar | No crear mas SaaS ni ampliar legacy | Factory, Campamento Base, docs | Freeze decision, route/API inventory | guardrails | Bajo | No nuevos SaaS ni imports legacy. |
| FASE 1 - TaskOps neutral | Sacar TaskOps de `campobase` | `src/lib/taskops`, tests | service/platform neutral, signal parity | TaskOps neutral + guardrail | Medio | Guardrail baja `4 -> 0` por fases. |
| FASE 2 - SocialFlow monetizable | Cerrar SocialFlow production-readiness | SocialFlow runtime/API/billing | Fix drift docs/tests, billing smoke, tenant evidence | SocialFlow architecture/readiness | Medio | Architecture tests green y payment-to-access probado. |
| FASE 3 - Mentoria audit | Auditar producto educativo completo | Mentoria routes/lib/DB/auth | Auditoria dedicada y remediation plan | Mentoria API/component/auth/billing | Alto | Matriz permisos y E2E familiar green. |
| FASE 4 - Separar Factory | Evitar fabrica monolitica | Factory/provisioning/Campamento Base | Boundary contract, templates neutros | Factory e2e/parity | Alto | Crear SaaS solo por contrato estandar. |
| FASE 5 - Auth/Tenancy/Billing | Endurecer base multi-SaaS | auth/auths/authz/billing/DB | Route auth matrix, billing contract per SaaS | auth isolation, webhook, billing | Alto | No ruta critica sin auth/tenant proof. |
| FASE 6 - Produccion real | Observabilidad y deploys fiables | workers, CI, health | Smoke matrix, dashboards, rollback runbooks | production readiness | Medio | Checks green por producto. |
| FASE 7 - Nuevos SaaS | Reabrir creacion | Factory/templates | SaaS creation playbook | new SaaS template tests | Medio | Nuevo SaaS nace aislado y observable. |

## Siguiente bloque exacto recomendado

Mas urgente: TaskOps neutral.

Por que:

- Es el unico bloqueo directo del guardrail `campobase` actual.
- Mientras TaskOps viva en legacy, el ecosistema no puede decir que el namespace `campobase` esta cerrado.
- Factory y nuevos SaaS deben esperar porque podrian replicar la deuda.

Orden recomendado:

1. `TASKOPS_NEUTRAL_RUNTIME_PARITY_AND_GUARDRAIL_PREP`.
2. `SOCIALFLOW_PRODUCTION_READINESS_DRIFT_FIX_AUDIT_OR_IMPLEMENTATION`, para arreglar los 3 failing architecture assertions.
3. `MENTORIA_DEEP_PRODUCT_PRIVACY_BILLING_AUDIT`.
4. `FACTORY_PROVISIONING_BOUNDARY_HARDENING`.

No recomiendo empezar por Factory ni por nuevos SaaS. SocialFlow es comercialmente urgente, pero TaskOps es el cierre arquitectonico mas pequeno y desbloqueante.

## Validaciones ejecutadas

Ejecutadas desde WSL en `/home/drako/workspace/drako_base`:

- `pnpm typecheck`: PASS.
- `npx vitest run tests/architecture/campobase-namespace-freeze.test.ts tests/architecture/socialflow-vertical-boundaries.test.ts tests/architecture/socialflow-runtime-boundary.test.ts tests/architecture/socialflow-runtime-split-scaffold.test.ts tests/architecture/socialflow-draco-dependency-radar.test.ts tests/architecture/mentoria-vertical-boundaries.test.ts tests/lib/clinic-service.test.ts tests/lib/clinic-platform-wrapper.test.ts tests/lib/factory-orchestrator-runtime-parity.test.ts tests/lib/factory-orchestrator-runtime-equivalent.test.ts tests/lib/campobase-taskops-platform-service.test.ts tests/lib/cross-saas-taskops-flow.test.ts`: FAIL parcial.

Resultado del subset Vitest:

- 12 files ejecutados.
- 10 files passed.
- 2 files failed.
- 68 tests passed.
- 3 tests failed.

Fallos:

- `tests/architecture/socialflow-runtime-split-scaffold.test.ts`: espera scaffold inert `saas-socialflows-runtime-scaffold`, pero el wrangler actual indica `saas-socialflows-runtime-canary-nonprod` con D1 real canary y switches.
- `tests/architecture/socialflow-vertical-boundaries.test.ts`: espera que `campobase-socialflow-service` exponga contratos SocialFlow directly, pero ahora es adapter a `@/lib/campamento-base/socialflow-control-plane-service`.
- `tests/architecture/socialflow-vertical-boundaries.test.ts`: espera evidencia SQL `WHERE tenant_id = ?` en export service, pero el servicio delega a `createGlobalSocialFlowExportCoreReadContract`.

Lectura de validacion: no hay fallo de TypeScript ni del guardrail `campobase`; si hay drift en arquitectura SocialFlow que debe resolverse antes de production-ready.

## Resultado final

- Archivo creado: `docs/audits/MEGA_ECOSYSTEM_FULL_SAAS_PRODUCT_FACTORY_AUDIT.md`.
- Codigo productivo tocado: no.
- Tests modificados: no.
- Guardrail modificado: no.
- Estado real del ecosistema: avanzado pero no production-ready; producto real mezclado con deuda legacy, scaffolds y control-plane amplio.
- SaaS mas avanzado: SocialFlow.
- SaaS mas debil como producto completo: Clinic; TaskOps no cuenta como SaaS vertical.
- Producto mas profundo pero mas riesgoso: Mentoria.
- Bloqueo principal: TaskOps neutral + drift SocialFlow architecture.
- Siguiente bloque recomendado: TaskOps neutral primero; luego SocialFlow production-readiness drift fix.
- Riesgos principales: Campamento Base monolitico, Factory creando deuda, auth/tenancy inconsistente, DB historica duplicada, SocialFlow drift, Mentoria sin auditoria profunda.
- Se puede seguir creando SaaS nuevos: no.
