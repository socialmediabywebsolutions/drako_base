# 🏗️ PLAN ESTRATÉGICO — Separación SaaS Independientes

**Fecha:** 5 de Junio de 2026  
**Autor:** Cascade AI + Usuario  
**Estado:** PLAN ESTRATÉGICO — PENDIENTE APROBACIÓN  
**Objetivo:** Convertir monolito actual en arquitectura multi-SaaS independiente con Campamento Base como control plane

---

## 📊 EXECUTIVE SUMMARY

### Situación Actual

**Arquitectura Monolítica Contaminada:**
```
┌─────────────────────────────────────────────────┐
│        drako_base (Monolito Next.js)            │
├─────────────────────────────────────────────────┤
│  • SocialFlow (src/lib/socialflow)              │
│  • Mentoría (src/lib/mentoria)                  │
│  • Clinic (src/lib/clinic)                      │
│  • Campamento Base (src/lib/campamento-base)    │
│  • Shared runtime contaminado                   │
│  • DB única (D1) sin aislamiento completo       │
│  • Rutas mezcladas en /app                      │
│  • Workers compartidos                          │
└─────────────────────────────────────────────────┘
```

**Problemas Críticos Identificados:**
- ❌ Acoplamiento cross-product (Mentoría → SocialFlow)
- ❌ Runtime compartido con contaminación de tipos
- ❌ Sin boundaries claros entre productos
- ❌ Despliegues no independientes
- ❌ Escalado no granular por producto
- ❌ Riesgo de regresiones cross-product

### Arquitectura Target

**Multi-SaaS Independiente con Control Plane:**
```
                    ┌──────────────────────────┐
                    │   Campamento Base        │
                    │   (Control Plane)        │
                    │                          │
                    │  • SaaS Factory          │
                    │  • Provisioning          │
                    │  • Auth Central          │
                    │  • Billing Central       │
                    │  • Departments/Agents    │
                    │  • Observability         │
                    │  • Registry              │
                    └────────────┬─────────────┘
                                 │
                                 │ API Contract
                                 │
        ┌────────────────────────┼────────────────────────┐
        │                        │                        │
┌───────▼───────┐       ┌───────▼───────┐       ┌───────▼───────┐
│  SocialFlow   │       │   Mentoría    │       │    Clinic     │
│   Runtime     │       │   Runtime     │       │   Runtime     │
│               │       │               │       │               │
│ • Worker      │       │ • Worker      │       │ • Worker      │
│ • DB Tenant   │       │ • DB Tenant   │       │ • DB Tenant   │
│ • Routes      │       │ • Routes      │       │ • Routes      │
│ • Domain      │       │ • Domain      │       │ • Domain      │
└───────────────┘       └───────────────┘       └───────────────┘
```

**Beneficios Esperados:**
- ✅ Despliegue independiente por producto
- ✅ Escalado granular (ej: más workers solo para Mentoría)
- ✅ Aislamiento de errores (bug en SocialFlow no afecta Mentoría)
- ✅ Equipos autónomos por producto
- ✅ Ciclos de desarrollo más rápidos
- ✅ Costos optimizables por producto
- ✅ Seguridad reforzada (tenant isolation real)

---

## 🎯 PRODUCTOS IDENTIFICADOS

### 1. **Campamento Base** (Control Plane)
- **Responsabilidad:** Factory, provisioning, registry central
- **Estado actual:** Parcialmente separado (`src/lib/campamento-base/`)
- **Complejidad:** ALTA — Es el corazón del sistema
- **Prioridad:** P0 — Debe estar estable antes de separar otros

### 2. **SocialFlow** (Producto SaaS)
- **Responsabilidad:** LinkedIn publishing, automation, analytics
- **Estado actual:** Runtime parcialmente aislado, work-in-progress P2
- **Complejidad:** ALTA — Ya tiene trabajo de separación avanzado
- **Prioridad:** P1 — Candidato piloto para extracción completa

### 3. **Mentoría** (Producto SaaS)
- **Responsabilidad:** Tutoría estudiantil, WhatsApp, workspace
- **Estado actual:** Acoplado a SocialFlow, usa shared publishing
- **Complejidad:** MEDIA — Menos dependencias externas
- **Prioridad:** P2 — Segunda extracción tras SocialFlow

### 4. **Clinic** (Producto SaaS)
- **Responsabilidad:** Gestión clínica (legacy)
- **Estado actual:** Módulo aislado (`src/lib/clinic/`)
- **Complejidad:** BAJA — Poco acoplamiento
- **Prioridad:** P3 — Extracción después de validar patrón

### 5. **Drako.Systems** (Producto público/marketing)
- **Responsabilidad:** Landing, marketing, site público
- **Estado actual:** Mezclado en `/app/page.tsx`
- **Complejidad:** BAJA — Principalmente frontend
- **Prioridad:** P4 — Último en extraer

---

## 📐 ARQUITECTURA DE SEPARACIÓN

### Capas de la Arquitectura

```
┌─────────────────────────────────────────────────────────────┐
│                    CAPA 1: CONTROL PLANE                    │
│                    (Campamento Base)                        │
├─────────────────────────────────────────────────────────────┤
│  • SaaS Factory & Provisioning                              │
│  • Auth/AuthZ Central (SSO, tenants, permisos)              │
│  • Billing & Subscriptions (Stripe central)                 │
│  • Departments & Agents (IA organizacional)                 │
│  • Observability & Monitoring                               │
│  • SaaS Registry (catálogo de productos)                    │
│  • Shared Capabilities (neutral, no product-specific)       │
└─────────────────────────────────────────────────────────────┘
                              ▲
                              │
                              │ REST API / GraphQL
                              │ (Contracts estrictos)
                              │
┌─────────────────────────────────────────────────────────────┐
│                  CAPA 2: BUSINESS PLANE                     │
│                  (Productos SaaS independientes)            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │ SocialFlow   │  │  Mentoría    │  │   Clinic     │     │
│  ├──────────────┤  ├──────────────┤  ├──────────────┤     │
│  │ • UI/UX      │  │ • UI/UX      │  │ • UI/UX      │     │
│  │ • API Routes │  │ • API Routes │  │ • API Routes │     │
│  │ • Domain     │  │ • Domain     │  │ • Domain     │     │
│  │   Logic      │  │   Logic      │  │   Logic      │     │
│  │ • DB Schema  │  │ • DB Schema  │  │ • DB Schema  │     │
│  │   (tenant)   │  │   (tenant)   │  │   (tenant)   │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
                              ▲
                              │
                              │ Public API / Webhooks
                              │
┌─────────────────────────────────────────────────────────────┐
│                  CAPA 3: INTEGRATION PLANE                  │
│                  (Conectores externos)                      │
├─────────────────────────────────────────────────────────────┤
│  • LinkedIn API                                             │
│  • WhatsApp API (Twilio, MessageBird)                       │
│  • Stripe Webhooks                                          │
│  • Email Providers                                          │
│  • AI APIs (OpenAI, Anthropic)                              │
└─────────────────────────────────────────────────────────────┘
```

### Contracts Entre Capas

#### 1. **Control Plane → Business Plane**
```typescript
// API que Campamento Base expone a cada SaaS

interface CampamentoBaseContract {
  // Auth & Identity
  auth: {
    validateSession(token: string): Promise<Session>;
    getTenantContext(userId: string): Promise<TenantContext>;
    checkPermission(userId: string, resource: string, action: string): Promise<boolean>;
  };

  // Billing
  billing: {
    getSubscription(tenantId: string): Promise<Subscription>;
    recordUsage(tenantId: string, metric: string, value: number): Promise<void>;
    createCheckoutSession(tenantId: string, priceId: string): Promise<CheckoutSession>;
  };

  // Registry
  registry: {
    getSaasMetadata(saasId: string): Promise<SaasMetadata>;
    reportHealth(saasId: string, health: HealthStatus): Promise<void>;
  };

  // Observability
  observability: {
    logEvent(event: ProductEvent): Promise<void>;
    trackMetric(metric: ProductMetric): Promise<void>;
  };
}
```

#### 2. **Business Plane → Control Plane**
```typescript
// API que cada SaaS expone a Campamento Base

interface ProductContract {
  // Health & Status
  health: {
    getStatus(): Promise<HealthStatus>;
    getDependencies(): Promise<Dependency[]>;
  };

  // Provisioning
  provisioning: {
    initialize(tenantId: string, config: ProvisioningConfig): Promise<void>;
    teardown(tenantId: string): Promise<void>;
  };

  // Entitlements
  entitlements: {
    getAvailableFeatures(): Promise<Feature[]>;
    checkFeatureAccess(tenantId: string, feature: string): Promise<boolean>;
  };
}
```

---

## 🗺️ ROADMAP DE EJECUCIÓN

### FASE 0: Preparación y Estabilización (2-3 semanas)

**Objetivo:** Establecer foundations antes de extraer

#### P0-1: Estabilizar Campamento Base
- [ ] Auditar `src/lib/campamento-base/` completo
- [ ] Definir API contracts canónicos
- [ ] Documentar interfaces públicas
- [ ] Crear tests de contrato
- [ ] Versionar API (v1.0.0)

#### P0-2: Establecer Shared Capabilities Neutral
- [ ] Extraer `@/lib/social-core/publishing` → `@/lib/social-publishing/`
- [ ] Definir shared capabilities permitidas:
  - `@/lib/db` (acceso D1)
  - `@/lib/auths` (primitivas auth)
  - `@/lib/http` (helpers HTTP)
  - `@/lib/social-publishing` (publishing neutral)
- [ ] Prohibir capabilities product-specific en shared

#### P0-3: DB Tenant Isolation Hardening
- [ ] Auditar TODAS las queries con `tenant_id` filter
- [ ] Crear guards de tenant isolation
- [ ] Tests de cross-tenant leakage
- [ ] RLS (Row Level Security) si D1 lo soporta

#### P0-4: Nomenclatura Global Cleanup
- [ ] Resolver "Campamento Base" vs "Campobase" vs "Campo Base"
- [ ] Definir "Drako" canónicamente
- [ ] Actualizar toda documentación

**Deliverables:**
- ✅ Campamento Base API Contract v1.0 documentado
- ✅ Shared capabilities list oficial
- ✅ Tenant isolation tests passing
- ✅ Nomenclatura consistente

---

### FASE 1: Piloto — Extracción SocialFlow (4-6 semanas)

**Objetivo:** Primera extracción completa como patrón replicable

#### P1-1: Runtime Isolation Completo
- [ ] Finalizar P2-10 a P2-22 (trabajo ya iniciado)
- [ ] Eliminar TODA contaminación de otros productos
- [ ] Runtime risk score → 0
- [ ] Audit passing al 100%

#### P1-2: Crear Worker Independiente
- [ ] Nuevo worker: `socialflow-worker`
- [ ] Config independiente: `wrangler-socialflow.toml`
- [ ] Build artifacts separados
- [ ] Deploy pipeline independiente

#### P1-3: DB Schema Isolation
- [ ] Migrar tablas SocialFlow a namespace: `socialflow_*`
- [ ] Crear views con tenant_id hardcoded
- [ ] Foreign keys solo dentro de namespace
- [ ] Migrations independientes

#### P1-4: Domain & Routing
- [ ] Domain propio: `socialflow.drako.systems`
- [ ] Workers Custom Domain setup
- [ ] Routing independiente
- [ ] CORS y security headers

#### P1-5: API Contract con Campamento Base
- [ ] Implementar `CampamentoBaseContract` client
- [ ] Implementar `ProductContract` server
- [ ] Auth delegado a Campamento Base
- [ ] Billing events → Campamento Base

#### P1-6: Cutover & Validation
- [ ] Deploy canary a production
- [ ] Traffic split 10% → 50% → 100%
- [ ] Rollback plan documentado
- [ ] Monitoring y alerts

**Deliverables:**
- ✅ SocialFlow 100% independiente
- ✅ Zero shared runtime con otros productos
- ✅ Patrón de extracción documentado
- ✅ Runbook de cutover validado

---

### FASE 2: Extracción Mentoría (3-4 semanas)

**Objetivo:** Replicar patrón de SocialFlow para segundo producto

#### P2-1: Cleanup de Dependencias
- [ ] Eliminar import de `@/lib/social-core/publishing`
- [ ] Usar `@/lib/social-publishing` neutral
- [ ] Eliminar cualquier import de `socialflow/`
- [ ] Eliminar shared types no neutrales

#### P2-2: Runtime Isolation
- [ ] Aplicar patrón de P1-1
- [ ] Build artifacts: `mentoria-runtime`
- [ ] Guards y tests
- [ ] Audit passing

#### P2-3: Worker Independiente
- [ ] Worker: `mentoria-worker`
- [ ] Config: `wrangler-mentoria.toml`
- [ ] Pipeline CI/CD independiente

#### P2-4: DB Schema Isolation
- [ ] Namespace: `mentoria_*` (ya existe parcialmente)
- [ ] Completar aislamiento
- [ ] Migrations: `migrations/mentoria/`

#### P2-5: Domain & Routing
- [ ] Domain: `mentoria.drako.systems`
- [ ] WhatsApp webhook routing independiente
- [ ] Workspace UI en dominio propio

#### P2-6: API Contract
- [ ] Auth via Campamento Base
- [ ] Billing via Campamento Base
- [ ] Student profiles sync

#### P2-7: Cutover
- [ ] Deploy y validación
- [ ] Migration de datos si necesario
- [ ] Monitoring

**Deliverables:**
- ✅ Mentoría 100% independiente
- ✅ Patrón validado en 2 productos
- ✅ Template de extracción reutilizable

---

### FASE 3: Extracción Clinic (2-3 semanas)

**Objetivo:** Tercer producto, patrón maduro

#### P3-1 a P3-7: Aplicar Patrón
- [ ] Repetir FASE 2 para Clinic
- [ ] Worker: `clinic-worker`
- [ ] Domain: `clinic.drako.systems`
- [ ] Namespace: `clinic_*`

**Deliverables:**
- ✅ Clinic 100% independiente
- ✅ 3 productos separados operando

---

### FASE 4: Extracción Drako.Systems (1-2 semanas)

**Objetivo:** Landing público y marketing

#### P4-1: Extracción Frontend
- [ ] Worker estático: `drako-systems-worker`
- [ ] Assets CDN
- [ ] Domain: `drako.systems` (root)

#### P4-2: CMS & Content
- [ ] CMS neutral (ej: Contentful, Sanity)
- [ ] Blog independiente
- [ ] SEO & Analytics

**Deliverables:**
- ✅ Drako.Systems independiente
- ✅ Todos productos separados

---

### FASE 5: Decommission Monolito (2-3 semanas)

**Objetivo:** Eliminar monolito original

#### P5-1: Validation
- [ ] Confirmar 100% tráfico en workers independientes
- [ ] Zero tráfico en monolito
- [ ] Backups completos

#### P5-2: Archive
- [ ] Tag final: `monolith-archive-v1.0.0`
- [ ] Documentar historia
- [ ] Mover a repo legacy

#### P5-3: Cleanup
- [ ] Eliminar workers obsoletos
- [ ] Cleanup DNS
- [ ] Cleanup billing

**Deliverables:**
- ✅ Monolito archivado
- ✅ Solo workers independientes en producción

---

## 🧩 COMPONENTES COMPARTIDOS PERMITIDOS

### Shared Capabilities (Neutral Infrastructure)

**Permitidos:**
- ✅ `@/lib/db` — Acceso a D1 (con tenant guards)
- ✅ `@/lib/auths` — Primitivas auth (sin lógica de negocio)
- ✅ `@/lib/http` — HTTP helpers (errors, headers)
- ✅ `@/lib/social-publishing` — Publishing neutral (nuevo)
- ✅ `@/lib/logger` — Logging primitives
- ✅ `@/lib/env` — Env resolution
- ✅ `@/lib/correlation` — Tracing

**Prohibidos:**
- ❌ `@/lib/socialflow/*` — Product-specific
- ❌ `@/lib/mentoria/*` — Product-specific
- ❌ `@/lib/clinic/*` — Product-specific
- ❌ `@/lib/social/*` — Legacy, ambiguous
- ❌ `@/lib/social-core/*` — Siendo migrado

### Control Plane (Campamento Base)

**Servicios que SIEMPRE viven en Campamento Base:**
- ✅ SaaS Factory & Provisioning
- ✅ Auth Central (SSO, tenants)
- ✅ Billing Central (Stripe)
- ✅ Departments & Agents
- ✅ Observability & Monitoring
- ✅ Registry & Discovery

**Nunca extraer:**
- Campamento Base debe permanecer centralizado
- Es el único punto de coordinación

---

## 🔐 TENANT ISOLATION STRATEGY

### DB Tenant Isolation

**Nivel 1: Soft Isolation (Actual)**
```sql
-- Cada tabla tiene tenant_id
SELECT * FROM mentoria_sessions WHERE tenant_id = ?;
```

**Problemas:**
- ❌ Query sin `tenant_id` filtra cross-tenant
- ❌ Requires discipline en cada query
- ❌ Riesgo de error humano

**Nivel 2: Row-Level Security (Target)**
```sql
-- Policies automáticas en D1 (si disponible)
CREATE POLICY tenant_isolation ON mentoria_sessions
  USING (tenant_id = current_setting('app.current_tenant'));
```

**Beneficios:**
- ✅ Imposible olvidar filtro
- ✅ DB enforced
- ✅ Audit trail automático

**Nivel 3: DB per Tenant (Opcional, futuro)**
```
mentoria_tenant_123.db
mentoria_tenant_456.db
```

**Beneficios:**
- ✅ Aislamiento físico total
- ✅ Backup/restore granular
- ✅ GDPR compliance (delete tenant = delete DB)

**Tradeoffs:**
- ❌ Complejidad operacional
- ❌ Queries cross-tenant imposibles
- ❌ Migrations más complejas

### Runtime Isolation

**Workers Independientes:**
```
socialflow-worker  → D1 + tenant_id filter
mentoria-worker    → D1 + tenant_id filter
clinic-worker      → D1 + tenant_id filter
```

**Benefits:**
- ✅ Bug en SocialFlow no crash Mentoría
- ✅ Escalado independiente
- ✅ Deploy independiente

---

## 📊 MÉTRICAS DE ÉXITO

### Separation Health Score

**Fórmula:**
```
Separation Health = (
  (Products 100% Independent / Total Products) * 40% +
  (Shared Dependencies Clean / Total Shared) * 30% +
  (Zero Cross-Product Imports / Total Imports) * 20% +
  (Deploy Independence) * 10%
) * 100
```

**Target Milestones:**
- Fase 0: 60% (cleanup inicial)
- Fase 1: 75% (SocialFlow independiente)
- Fase 2: 85% (+ Mentoría)
- Fase 3: 92% (+ Clinic)
- Fase 4: 98% (+ Drako.Systems)
- Fase 5: 100% (monolito archivado)

### KPIs por Fase

#### Technical KPIs
- **Build Time Independiente:** <5 min per product
- **Deploy Time:** <10 min per product
- **Zero Cross-Product Imports:** 100%
- **Test Coverage:** >80% per product
- **Tenant Isolation Tests:** 100% passing

#### Business KPIs
- **Deploy Frequency:** Daily per product
- **Mean Time to Recovery:** <1 hour
- **Incident Blast Radius:** Single product only
- **Team Autonomy:** Each product has dedicated team

---

## ⚠️ RIESGOS Y MITIGACIONES

### Riesgo 1: Regresiones Durante Extracción
**Impacto:** ALTO  
**Probabilidad:** MEDIA

**Mitigación:**
- Feature flags para cada cambio
- Deploy canary progresivo (10% → 50% → 100%)
- Automated regression tests
- Rollback plan documentado

### Riesgo 2: DB Migrations Complejas
**Impacto:** ALTO  
**Probabilidad:** MEDIA

**Mitigación:**
- Migrations no destructivas
- Blue-green deployment
- Data validation scripts
- Backups antes de cada migration

### Riesgo 3: Auth/AuthZ Centralizado Failure
**Impacto:** CRÍTICO  
**Probabilidad:** BAJA

**Mitigación:**
- Campamento Base HA (High Availability)
- Fallback local auth cache
- Circuit breaker patterns
- Multi-region deployment

### Riesgo 4: Pérdida de Expertise Durante Separación
**Impacto:** MEDIO  
**Probabilidad:** MEDIA

**Mitigación:**
- Documentación exhaustiva
- Pair programming durante extracción
- Knowledge transfer sessions
- Runbooks operacionales

### Riesgo 5: Costos Operacionales Aumentan
**Impacto:** MEDIO  
**Probabilidad:** ALTA

**Mitigación:**
- Workers share D1 (multi-tenant)
- Shared observability stack
- Auto-scaling por producto
- Cost monitoring alerts

---

## 📝 DECISIONES ARQUITECTÓNICAS

### ADR-001: Shared DB con Tenant Isolation vs DB per Tenant
**Decisión:** Shared DB con tenant_id isolation  
**Razón:** Balance entre isolation y operational simplicity  
**Tradeoff:** Requiere discipline en queries, pero evita complejidad de multi-DB

### ADR-002: Workers Independientes vs Multi-Tenancy en Worker Único
**Decisión:** Workers independientes por producto  
**Razón:** Deploy independence, blast radius control  
**Tradeoff:** Más workers = más complexity, pero mejor autonomía

### ADR-003: Campamento Base como Monolito Central vs Microservicios
**Decisión:** Campamento Base como monolito controlado  
**Razón:** Control plane debe ser estable, no necesita escalar como productos  
**Tradeoff:** Single point of coordination, pero simplifica governance

### ADR-004: Shared Capabilities Neutral vs Duplicación
**Decisión:** Shared capabilities neutral (ej: social-publishing)  
**Razón:** Evitar duplicación innecesaria de lógica común  
**Tradeoff:** Requiere mantener contracts estables

### ADR-005: API Contracts HTTP/REST vs GraphQL
**Decisión:** HTTP/REST con OpenAPI contracts  
**Razón:** Simplicidad, mejor support en Cloudflare Workers  
**Tradeoff:** Menos flexible que GraphQL, pero más simple

---

## 🚀 SIGUIENTE PASO INMEDIATO

### Para Empezar YA (Quick Wins)

#### 1. Crear Estructura de Carpetas
```bash
# Preparar estructura para workers independientes
mkdir -p workers/socialflow
mkdir -p workers/mentoria
mkdir -p workers/clinic
mkdir -p workers/drako-systems
mkdir -p workers/campamento-base

# Preparar configs
touch workers/socialflow/wrangler.toml
touch workers/mentoria/wrangler.toml
# ... etc
```

#### 2. Extraer Social Publishing Neutral
```bash
# Mover a neutral namespace
mkdir -p src/lib/social-publishing
# Copiar src/lib/social-core/publishing.ts
# Actualizar imports en Mentoría y SocialFlow
```

#### 3. Documentar Campamento Base API Contract
```typescript
// docs/contracts/campamento-base-v1.0.md
// Especificar TODAS las APIs que expone
```

#### 4. Crear Tests de Tenant Isolation
```typescript
// tests/tenant-isolation/*.test.ts
// Validar que queries SIEMPRE filtran por tenant_id
```

---

## 📚 REFERENCIAS

### Documentos Relacionados
- `docs/audits/GOVERNANCE_SAAS_SEPARATION_EXECUTION_PLAN_2026-05-22.md` — Plan anterior S0-1 a S0-4
- `docs/audits/P2-10A-SHARED-RUNTIME-CONTRACT-REPORT.md` — Shared runtime contract SocialFlow
- `docs/audits/AUDIT_TECHNICAL_COMPLETE_2026.md` — Audit completo P0-P1
- `SYSTEM-RETRIEVED-MEMORY[98da6657]` — Nomenclatura Campamento Base

### Arquitecturas de Referencia
- **Netflix:** Multi-tenant microservices
- **Shopify:** Multi-tenant monolith → products
- **Stripe:** API-first product separation

---

## ✅ CHECKLIST DE APROBACIÓN

Antes de empezar ejecución:

- [ ] **Stakeholder buy-in:** Product, Engineering, Operations
- [ ] **Timeline aprobado:** ~14-18 semanas total
- [ ] **Budget confirmado:** Workers cost, engineering time
- [ ] **Team allocation:** Dedicated teams per product post-separation
- [ ] **Rollback plan:** Documentado y validado
- [ ] **Monitoring:** Dashboards preparados por producto
- [ ] **Communication plan:** Status updates semanales

---

## 📞 CONTACTO Y OWNERSHIP

**Plan Owner:** [Tu Nombre]  
**Technical Lead:** [Engineering Lead]  
**Product Sponsor:** [Product Lead]  

**Revisiones:**
- Weekly: Progress review
- Bi-weekly: Stakeholder update
- End of Phase: Go/No-Go decision

---

**Estado Final:** PLAN COMPLETO — PENDIENTE APROBACIÓN PARA INICIO FASE 0
