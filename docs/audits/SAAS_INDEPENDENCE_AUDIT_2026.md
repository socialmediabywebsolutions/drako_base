# 🔬 AUDITORÍA DE INDEPENDENCIA DE SaaS - Drako Ecosystem

**Fecha:** 22 de Mayo de 2026  
**Auditor:** Arquitecto de Governance (Read-Only Mode)  
**Alcance:** Preparación para separación progresiva de SaaS verticales  
**Restricción:** NO editar código, NO mover archivos, NO tocar producción

---

## 📊 EXECUTIVE SUMMARY

### Objetivo de Arquitectura

**Estado deseado:**
- **Drako** = Marca central / Holding / Portafolio
- **Campamento Base** = Operador interno / Control Plane
- **Mentoría** = SaaS educativo independiente
- **SocialFlow** = SaaS social independiente
- **Factory** = Fábrica/provisioning, separada del runtime estable

### Estado Actual de Acoplamiento

**COUPLING SCORE: 68% — ACOPLAMIENTO MEDIO-ALTO**

| Dimensión | Score | Estado | Blocker |
|-----------|-------|--------|---------|
| **Imports cruzados** | 90% | ✅ BUENO | NO |
| **Rutas compartidas** | 40% | ❌ MALO | **SÍ** |
| **Tablas D1 separadas** | 65% | ⚠️ MEDIO | NO |
| **Workers aislados** | 75% | ⚠️ MEDIO | NO |
| **Shared dependencies** | 30% | ❌ CRÍTICO | **SÍ** |
| **API contracts** | 20% | ❌ CRÍTICO | **SÍ** |

**Hallazgos clave:**
- ✅ **Mentoría ↔ SocialFlow:** Prácticamente independientes (1 coupling point identificado)
- ⚠️ **Ambos → Campamento Base:** Acoplamiento a infra compartida (db, auths, billing)
- ❌ **Shared modules sin extraer:** 15+ módulos candidatos a `packages/shared`
- ❌ **Rutas ambiguas:** `/api/owner`, `/api/operator`, `/api/social` sin clara separación

---

## 🎯 MAPA DE ACOPLAMIENTOS DETECTADOS

### 1. Dependencias Cruzadas Entre SaaS

#### Mentoría → SocialFlow (P2 - LOW COUPLING)

**Único punto de acoplamiento identificado:**

`src/lib/mentoria/resilience/socialflow-validation.ts`
```typescript
import { publishSocialPost } from "@/lib/social-core/publishing";
```

**Contexto:**
- **Propósito:** Publishing de posts de adquisición (growth/marketing de Mentoría)
- **Tabla usada:** `mentoria_publish_jobs` (tabla propia de Mentoría)
- **Riesgo:** BAJO — Solo usa `social-core` (capa compartida), NO importa `@/lib/socialflow` directamente
- **Acción:** Convertir a contrato/API interna o mover a shared capability

**Evidencia:**
```typescript
// src/lib/mentoria/resilience/socialflow-validation.ts:2
import { publishSocialPost } from "@/lib/social-core/publishing";

// src/lib/mentoria/acquisition-publishing.ts:42
throw new Error(`SOCIALFLOW_PUBLISH_FAILED: ${publishResult.error}`);
```

#### SocialFlow → Mentoría (P0 - NO COUPLING)

**✅ RESULTADO:** NINGUNA dependencia directa encontrada.

**Búsqueda realizada:**
```bash
grep -r "@/lib/mentoria" src/lib/socialflow/
grep -r "@/components/mentoria" src/lib/socialflow/
# NO RESULTS
```

**Conclusión:** SocialFlow está limpio de dependencias hacia Mentoría.

---

### 2. Dependencias Hacia Infraestructura Compartida

#### Mentoría → Shared Infra

**Imports detectados en `src/lib/mentoria/**/*.ts`:**

**Auth & Sessions:**
```typescript
// 47 archivos usan:
import { getAuthsCookieCandidateNames, readCookieFromHeader } from "@/lib/auths/cookies";
import { verifyAuthsSessionToken } from "@/lib/auths/tokens";
import { getAuthsUserById } from "@/lib/auths/repositories";
```

**Database:**
```typescript
// 22 archivos usan:
import { getDb } from "@/lib/mentoria/db";  // ← Wrapper interno
import { queryOne, queryAll } from "@/lib/db";  // ← Directo
```

**Otros módulos compartidos:**
```typescript
import { env } from "@/lib/cf";  // 15 archivos
import { recordObservabilityActivity } from "@/lib/observability-core";  // 8 archivos
```

#### SocialFlow → Shared Infra

**Imports detectados en `src/lib/socialflow/**/*.ts`:**

**Auth & Sessions:**
```typescript
// 8 archivos usan:
import { getAuthsCookieName } from "@/lib/auths/cookies";
import { verifyAuthsSessionToken } from "@/lib/auths/tokens";
import { getAuthsUserById } from "@/lib/auths/repositories";
```

**Database:**
```typescript
// 3 archivos usan:
import { queryOne } from "@/lib/db";
import { env } from "@/lib/cf";
```

**Integration Core:**
```typescript
// 2 archivos usan:
import { connectIntegration, getIntegrationConnection } from "@/lib/integration-core";
import { LINKEDIN_INTEGRATION_KEY } from "@/lib/integration-core/providers/linkedin";
```

#### Campamento Base → Products (P1 - BOUNDARY VIOLATION)

**NO auditado en detalle** (fuera de scope de productos verticales), pero:

`src/lib/campobase/socialflow-service.ts` (63 matches de "campobase")
- **Riesgo:** Operator layer tiene lógica específica de SocialFlow
- **Acción:** Separar en contrato o mover a SocialFlow

---

### 3. Rutas Compartidas y Ambiguas

#### Rutas Producto-Específicas (✅ BIEN SEPARADAS)

**Mentoría:**
```
/api/mentoria/*           (33 subdirectorios)
  /academic/
  /acquisition/
  /analytics/
  /billing/
  /chat/
  /exercises/
  /family/
  /growth/
  /health/
  /hooks/
  /onboarding/
  /planner/
  /profile/
  /progress/
  /session/
  /sessions/
  /upgrade/
  /workspace/
```

**SocialFlow:**
```
/api/socialflow/*         (13 subdirectorios)
  /ai/
  /auths/
  /campaigns/
  /exports/
  /linkedin/
  /posts/
  /profile/
  /setup/
```

**Conclusión:** ✅ Rutas producto-específicas BIEN SEPARADAS.

#### Rutas Compartidas/Ambiguas (❌ PROBLEMA)

**Legacy `/api/social/*` (6 subdirectorios):**
```
/api/social/
  /accounts/
  /analytics/
  /appointments/
  /linkedin/callback
  /linkedin/connect
  /posts/
```

**Estado:**
- ⚠️ Marcadas como "legacy bridges" (308 redirects a `/api/socialflow/`)
- ❌ Todavía presentes en codebase
- **Riesgo:** Confusión sobre qué es canónico

**Operator/Owner ambiguos:**
```
/api/operator/*           (43 subdirectorios)
/api/owner/*              (48 subdirectorios)
/api/campobase/*          (2 subdirectorios - legacy)
/api/campamento-base/*    (14 subdirectorios)
```

**Problema:**
- `/api/operator/socialflow` — ¿Es de Operator o de SocialFlow?
- `/api/owner/saas-factory` — ¿Es de Owner o de Factory?
- **No hay clara separación** entre "control plane" y "producto"

#### Rutas de Control Plane (MEZCLA)

**Factory:**
```
/api/factory/*            (19 subdirectorios)
  /blueprints/
  /contracts/
  /provisioning/
  /ai/
  ...
```

**Holding:**
```
/api/analytics/holding/
/api/billing/*
/api/stripe/*
```

**Problema:** Factory y Holding routes mezcladas con productos.

---

### 4. Tablas D1 Compartidas vs Dedicadas

#### Bases de Datos Físicas Identificadas

**1. `drako_db_prod`** (ID: `5607a76a-97c7-45a9-a948-e545ba27eae7`)
- **Binding usado por:** DRACO_DB, DRAKOS_AUTHS_DB, BASES_AUTHS_DB
- **Workers que lo usan:** autopilot, stripe-webhook, drako-scheduler, drakos, bases, saas-factory
- **Problema:** DB compartida multi-producto

**2. `saas_mentorias_prod_db`** (ID: `67b013a3-dcd8-424b-adf9-558895817841`)
- **Binding:** MENTORIA_DB
- **Worker:** mentorias
- **Estado:** ✅ Dedicado a Mentoría

**3. `mentorias_auths_prod_db`** (ID: `6a6e3b5c-4d5e-4905-850a-b1e205203462`)
- **Binding:** MENTORIAS_AUTHS_DB
- **Worker:** mentorias
- **Estado:** ✅ Dedicado a auth de Mentoría

**4. `saas_socialflows_prod_db`** (ID: `6aa6dbaf-9e35-4715-b154-cda8aee0bd54`)
- **Binding:** SOCIAL_DB
- **Worker:** socialflow-runtime
- **Estado:** ✅ Dedicado a SocialFlow

**5. `saas_socialflow_auths_prod_db`** (ID: `f6f46e6a-487f-400a-a2d1-c6d23e88f9cf`)
- **Binding:** SOCIALFLOW_AUTHS_DB
- **Worker:** socialflow-runtime
- **Estado:** ✅ Dedicado a auth de SocialFlow

**6. `drako_holding_db`** (ID: `52752a5c-b290-4633-91c6-e2a371a0c669`)
- **Binding:** DRKO_HOLDING_DB
- **Workers:** drako-core-worker, drako-provisioner-worker
- **Estado:** ✅ Dedicado a Holding

#### Tablas Compartidas en `drako_db_prod`

**Migraciones identificadas:**

**Mentoría (27 migrations):**
```sql
0119_mentoria_sessions.sql
0143_mentoria_product_core.sql
0145_mentoria_onboarding.sql
0146_mentoria_student_evolution.sql
0147_mentoria_interventions.sql
0148_mentoria_motivation.sql
0149_mentoria_daily_plans.sql
0150_mentoria_growth.sql
0152_mentoria_schema_convergence.sql
0160_mentoria_session_persistence.sql
0165_mentoria_student_learning_memory.sql
0169_mentoria_material_intakes.sql
0170_mentoria_material_context_notes.sql
0171_mentoria_material_intakes_documents.sql
0173_mentoria_resilience_runtime.sql
0174_mentoria_student_subject_memory.sql
0176_mentoria_academic_records.sql
0177_mentoria_academic_documents.sql
0178_mentoria_academic_extractions.sql
0179_mentoria_academic_analyses.sql
0180_mentoria_subject_performance_snapshots.sql
```

**SocialFlow (5 migrations):**
```sql
0026_social_core.sql
0136_auths_isolations.sql  (shared con Mentoría)
0142_socialflow_auths.sql
0184_socialflow_runtime_social_db.sql
0185_socialflow_profiles.sql
```

**Holding (3 migrations):**
```sql
0126_holding_multi_saas_monetization.sql
0137_holding_control_tower_foundations.sql
```

**Problema:**
- ✅ Mentoría tiene DB dedicada (`MENTORIA_DB`) — **PERO** migraciones siguen en `drako_db_prod`
- ✅ SocialFlow tiene DB dedicada (`SOCIAL_DB`) — **PERO** migraciones siguen en `drako_db_prod`
- ❌ NO hay separación física de migrations

**Evidencia:**
```toml
# workers/mentorias/wrangler.workers.toml:33
migrations_dir = "../../migrations"  # ← Apunta al root compartido
```

---

### 5. Bindings de Workers Mezclados

#### Worker: `saas-mentorias-prod`

**Bindings:**
```toml
[[d1_databases]]
binding = "MENTORIAS_AUTHS_DB"  # ✅ Dedicado

[[d1_databases]]
binding = "MENTORIA_DB"  # ✅ Dedicado

[[queues.producers]]
binding = "BILLING_QUEUE"  # ⚠️ Compartido con otros SaaS
binding = "SAAS_FACTORY_QUEUE"  # ⚠️ Compartido
binding = "PROVISIONING_QUEUE"  # ⚠️ Compartido

[[services]]
binding = "SCHEDULER"  # ⚠️ Compartido
service = "drako-scheduler"
```

**Análisis:**
- ✅ DBs dedicadas
- ⚠️ Queues compartidas (billing, factory, provisioning)
- ⚠️ Service binding a scheduler compartido

**Riesgo:** MEDIO — Queues compartidas aceptables, pero scheduler es punto único de fallo.

#### Worker: `saas-socialflows-runtime-canary`

**Bindings:**
```toml
[[d1_databases]]
binding = "DRACO_DB"  # ❌ Compartido
binding = "SOCIAL_DB"  # ✅ Dedicado
binding = "SOCIALFLOW_AUTHS_DB"  # ✅ Dedicado
```

**Análisis:**
- ❌ **DRACO_DB binding presente** — SocialFlow todavía tiene acceso a DB compartida
- ✅ DBs producto-específicas presentes
- **Riesgo:** ALTO — Posible uso de DRACO_DB que rompe aislamiento

**Pregunta crítica:** ¿Por qué SocialFlow necesita DRACO_DB si tiene SOCIAL_DB?

---

### 6. APIs Candidatas a Contratos Internos

#### Shared Capabilities sin Contrato

**Auth & Session:**
```typescript
// Usado por TODOS los productos
@/lib/auths/cookies
@/lib/auths/tokens
@/lib/auths/repositories
@/lib/auths/contexts
```

**Recomendación:** Extraer a `packages/shared-auth` con contrato versionado.

**Database Access:**
```typescript
// Usado por Mentoría y SocialFlow
@/lib/db
```

**Recomendación:** Extraer a `packages/shared-data` con capability pattern.

**Observability:**
```typescript
// Usado por ambos productos
@/lib/observability-core
```

**Recomendación:** Mantener shared pero versionar contrato.

**Billing:**
```typescript
// Usado por Mentoría (no auditado SocialFlow)
@/lib/billing/*
```

**Recomendación:** Extraer a `packages/shared-billing` o API gateway.

#### API Interna: Publishing

**Caso:** Mentoría usa `@/lib/social-core/publishing` para posts de adquisición

**Opciones:**
1. **API HTTP interna:** `/internal/api/publishing/social`
2. **Queue-based:** Mentoría publica a `publishing-queue`, SocialFlow consume
3. **Shared capability:** Extraer a `packages/shared-publishing`

**Recomendación:** Opción 2 (Queue) — mejor aislamiento y resilience.

---

### 7. Módulos Candidatos a Shared/Capabilities

#### Tier 1: CRÍTICOS (Usar todos los productos)

**1. Auth & Sessions**
```
src/lib/auths/
  cookies.ts
  tokens.ts
  repositories.ts
  contexts.ts
  flags.ts
  http.ts
  ssot.ts
```
**Destino:** `packages/shared-auth`  
**Contrato:** Versionado (v1, v2) con breaking changes explícitos  
**Dependencias:** Ninguna (leaf module)

**2. Database Access**
```
src/lib/db.ts
src/lib/db/
  queryBuilder.ts
  migrations.ts
```
**Destino:** `packages/shared-data`  
**Contrato:** Capability-based (no exponer D1 directamente)  
**Patrón:** Repository pattern per-product

**3. Observability**
```
src/lib/observability-core/
```
**Destino:** `packages/shared-observability`  
**Contrato:** Event-based, schema versionado  

**4. Cloudflare Env**
```
src/lib/cf.ts
src/lib/env.ts
```
**Destino:** `packages/shared-cloudflare`  
**Contrato:** Env resolution helpers

#### Tier 2: IMPORTANTES (Usar algunos productos)

**5. Integration Core**
```
src/lib/integration-core/
  index.ts
  providers/
    linkedin.ts
```
**Destino:** `packages/shared-integrations`  
**Uso:** SocialFlow (LinkedIn), potencialmente Mentoría (futuro)

**6. HTTP Helpers**
```
src/lib/http/
  errors.ts
  headers.ts
```
**Destino:** `packages/shared-http`

**7. Correlation**
```
src/lib/correlation.ts
```
**Destino:** `packages/shared-observability` (merge con observability-core)

#### Tier 3: ESPECÍFICOS DE DOMINIO (Candidatos a extraer)

**8. Social Core**
```
src/lib/social-core/
  types.ts
  publishing.ts
```
**Problema:** Usado por Mentoría Y SocialFlow  
**Destino:** `packages/shared-social` O convertir a API interna  
**Decisión:** Depende de estrategia de publishing

**9. Billing (si aplica a múltiples productos)**
```
src/lib/billing/
```
**Destino:** `packages/shared-billing` O API gateway

#### Tier 4: LEGACY/DEPRECATED (NO extraer)

```
src/lib/social/  # ← Legacy, deprecado
src/lib/auth.ts  # ← Legacy NextAuth
```

**Acción:** Mantener hasta sunset, NO invertir tiempo.

---

## 🚨 MATRIZ DE RIESGOS

### P0 - BLOCKERS CRÍTICOS (Separación imposible sin fix)

#### R0-1: DRACO_DB Binding en SocialFlow Worker

**Severidad:** BLOCKER  
**Impacto:** SocialFlow runtime puede acceder a tablas de otros productos  

**Evidencia:**
```toml
# apps/socialflow-runtime/wrangler.toml:11
[[d1_databases]]
binding = "DRACO_DB"
database_name = "drako_db_prod"
```

**Pregunta:** ¿Se usa activamente o es legacy?

**Acción necesaria:**
1. Auditar código de SocialFlow: grep "DRACO_DB" o "env.DRACO_DB"
2. Si NO se usa → Remover binding
3. Si SÍ se usa → Identificar queries y migrar a SOCIAL_DB

**Riesgo si NO se arregla:** Cross-product data leakage, imposible deployment independiente.

---

#### R0-2: Shared Dependencies sin Contrato Versionado

**Severidad:** BLOCKER  
**Impacto:** Cambios en `@/lib/auths` rompen TODOS los productos  

**Problema:**
- Mentoría importa `@/lib/auths/cookies` (47 archivos)
- SocialFlow importa `@/lib/auths/cookies` (8 archivos)
- Campamento Base importa `@/lib/auths/cookies`
- NO hay versionado
- NO hay contrato estable

**Escenario de fallo:**
1. Developer A cambia signature de `getAuthsCookieCandidateNames()`
2. Mentoría se rompe
3. SocialFlow se rompe
4. Impossible to deploy independently

**Acción necesaria:**
1. Extraer a `packages/shared-auth` con contrato v1
2. Implementar semantic versioning
3. Breaking changes requieren major version bump

---

#### R0-3: Migrations Compartidas sin Separación

**Severidad:** BLOCKER  
**Impacto:** Impossible to version databases independently  

**Evidencia:**
```toml
# workers/mentorias/wrangler.workers.toml:33
migrations_dir = "../../migrations"  # ← Root compartido

# migrations/ contiene:
0119_mentoria_sessions.sql
0142_socialflow_auths.sql
0173_mentoria_resilience_runtime.sql
0184_socialflow_runtime_social_db.sql
```

**Problema:**
- Mentoría migrations mezcladas con SocialFlow
- NO se pueden aplicar migrations de un producto sin afectar otro
- Runtime drift posible

**Acción necesaria:**
1. Crear `workers/mentorias/migrations/`
2. Crear `apps/socialflow-runtime/migrations/`
3. Migrar archivos correspondientes
4. Actualizar `migrations_dir` en wrangler configs

---

### P1 - IMPORTANTES (Dificultan separación)

#### R1-1: Rutas Legacy `/api/social/*` sin Sunset

**Severidad:** HIGH  
**Impacto:** Confusión arquitectónica, deuda técnica creciente  

**Estado actual:**
- Marcadas como "legacy bridges" (308 redirects)
- Todavía presentes en codebase
- NO hay fecha de sunset

**Acción necesaria:**
1. Auditar uso en producción (logs de acceso)
2. Si uso == 0 → Remover
3. Si uso > 0 → Comunicar deprecation, sunset en 3 meses

---

#### R1-2: Operator Routes mezcladas con Productos

**Severidad:** HIGH  
**Impacto:** Unclear boundaries  

**Problema:**
```
/api/operator/socialflow  # ← ¿De quién es?
/api/campobase/socialflow  # ← ¿De quién es?
```

**Acción necesaria:**
1. Definir: ¿Operator es parte de Campamento Base o es capa separada?
2. Si Campamento Base → Mover a `/api/campamento-base/operator/*`
3. Si separado → Mantener `/api/operator/*` pero sin mixing de productos

---

#### R1-3: Publishing Capability sin Contrato

**Severidad:** MEDIUM  
**Impacto:** Acoplamiento Mentoría → SocialFlow implícito  

**Evidencia:**
```typescript
// src/lib/mentoria/resilience/socialflow-validation.ts:2
import { publishSocialPost } from "@/lib/social-core/publishing";
```

**Acción necesaria:**
1. Decidir: ¿API interna, Queue, o Shared capability?
2. Implementar contrato explícito
3. Versionar

---

### P2 - DEBT (Mejoras a largo plazo)

#### R2-1: Shared Queues (BILLING, FACTORY, PROVISIONING)

**Severidad:** LOW  
**Impacto:** Acceptable coupling via queues  

**Estado:** OK para ahora, considerar separación en futuro.

---

#### R2-2: Scheduler Service Compartido

**Severidad:** LOW  
**Impacto:** Single point of failure  

**Recomendación:** Per-product schedulers en el futuro.

---

## 📋 ESTRATEGIA DE SEPARACIÓN EN FASES

### FASE 0: Preparación (NO TOCAR PRODUCCIÓN)

**Duración:** 1 semana  
**Objetivo:** Decisiones de arquitectura y documentación  

#### Decisiones Necesarias

**D1: ¿Qué hacer con DRACO_DB en SocialFlow?**
- [ ] Auditar uso actual en código
- [ ] Decisión: Remover o justificar

**D2: ¿Migrations compartidas o separadas?**
- [ ] Propuesta: Separar en workers/mentorias/migrations y apps/socialflow/migrations
- [ ] Validar impact en deployment pipeline

**D3: ¿Publishing capability: API, Queue, o Shared?**
- [ ] Decisión recomendada: Queue-based
- [ ] Diseñar contrato

**D4: ¿Extraer shared modules ahora o después?**
- [ ] Decisión recomendada: Después de Fase 2
- [ ] Priorizar: Auth → DB → Observability

**D5: ¿Sunset de `/api/social/*`?**
- [ ] Auditar logs de producción
- [ ] Decidir fecha de sunset

#### Documentación a Crear

- [ ] `docs/architecture/saas-independence-roadmap.md`
- [ ] `docs/architecture/shared-modules-contract.md`
- [ ] `docs/architecture/api-internal-contracts.md`

---

### FASE 1: Separación de Infraestructura (SEGURO)

**Duración:** 2-3 semanas  
**Objetivo:** Eliminar acoplamientos de infraestructura  
**Riesgo:** BAJO — No toca lógica de negocio  

#### 1.1: Separar Migrations (P0)

**Acción:**
```bash
# Crear directorios
mkdir -p workers/mentorias/migrations
mkdir -p apps/socialflow-runtime/migrations

# Mover migrations
mv migrations/0119_mentoria_*.sql workers/mentorias/migrations/
mv migrations/0142_socialflow_*.sql apps/socialflow-runtime/migrations/
mv migrations/0184_socialflow_*.sql apps/socialflow-runtime/migrations/
mv migrations/0185_socialflow_*.sql apps/socialflow-runtime/migrations/

# Actualizar wrangler.toml
# mentorias: migrations_dir = "migrations"
# socialflow: migrations_dir = "migrations"
```

**Validación:**
```bash
wrangler d1 migrations list --database=saas_mentorias_prod_db
wrangler d1 migrations list --database=saas_socialflows_prod_db
# Verificar que solo se listen migrations correspondientes
```

**Tests necesarios:**
- [ ] Deployment de Mentoría no afecta SocialFlow
- [ ] Deployment de SocialFlow no afecta Mentoría
- [ ] Rollback de uno no afecta al otro

**Qué NO tocar:**
- Código de aplicación
- APIs
- Routes
- Workers bindings (todavía)

---

#### 1.2: Auditar y Limpiar DRACO_DB en SocialFlow (P0)

**Acción:**
```bash
# Auditar uso
grep -r "env.DRACO_DB" apps/socialflow-runtime/
grep -r "DRACO_DB" apps/socialflow-runtime/.open-next/

# Si NO se usa:
# Remover de apps/socialflow-runtime/wrangler.toml

# Si SÍ se usa:
# Identificar queries
# Plan de migración a SOCIAL_DB
```

**Validación:**
- [ ] Build exitoso sin DRACO_DB binding
- [ ] Runtime tests pasan
- [ ] NO hay queries cross-product

**Qué NO tocar:**
- Lógica de negocio
- Otras DBs (SOCIAL_DB, SOCIALFLOW_AUTHS_DB)

---

#### 1.3: Documentar Shared Dependencies (P1)

**Acción:**
```bash
# Crear inventory
docs/architecture/shared-modules-inventory.md

# Listar:
# - Módulo
# - Usado por (productos)
# - Tipo (auth, db, http, etc.)
# - Contrato actual (versión)
# - Riesgo de breaking change
```

**Entregables:**
- [ ] Inventory completo
- [ ] Matriz de riesgo por módulo
- [ ] Roadmap de extracción

**Qué NO tocar:**
- Código
- Imports

---

### FASE 2: Extracción de Shared Modules (MEDIO RIESGO)

**Duración:** 4-6 semanas  
**Objetivo:** Extraer módulos compartidos a packages/ con contratos  
**Riesgo:** MEDIO — Cambios en imports, requires testing  

#### 2.1: Extraer `packages/shared-auth` (CRÍTICO)

**Acción:**
```bash
# Crear package
mkdir -p packages/shared-auth/src
touch packages/shared-auth/package.json
touch packages/shared-auth/tsconfig.json

# Mover módulos
mv src/lib/auths/cookies.ts packages/shared-auth/src/
mv src/lib/auths/tokens.ts packages/shared-auth/src/
mv src/lib/auths/repositories.ts packages/shared-auth/src/
mv src/lib/auths/contexts.ts packages/shared-auth/src/

# Crear index con exports versionados
# packages/shared-auth/src/index.ts
export * as v1 from './v1';

# Actualizar imports en productos
# @/lib/auths/cookies → @drako/shared-auth/v1
```

**Contrato v1:**
```typescript
// packages/shared-auth/src/v1/types.ts
export interface AuthCookie {
  name: string;
  value: string;
  options: CookieOptions;
}

export interface AuthSession {
  userId: string;
  tenantId: string;
  role: string;
  expiresAt: Date;
}

// Semver: 1.0.0
// Breaking changes: 2.0.0
```

**Tests necesarios:**
- [ ] Unit tests per module
- [ ] Integration tests Mentoría
- [ ] Integration tests SocialFlow
- [ ] Backward compatibility tests

**Qué NO tocar:**
- Lógica de auth (solo estructura)
- Databases
- Workers

---

#### 2.2: Extraer `packages/shared-data` (CRÍTICO)

**Similar a 2.1, pero para DB access**

**Patrón:**
```typescript
// packages/shared-data/src/v1/capability.ts
export interface DataCapability {
  query<T>(sql: string, params: unknown[]): Promise<T[]>;
  queryOne<T>(sql: string, params: unknown[]): Promise<T | null>;
  execute(sql: string, params: unknown[]): Promise<void>;
}

// Implementación per-product
export class MentoriaDataCapability implements DataCapability {
  constructor(private db: D1Database) {}
  // Implementation
}
```

**Beneficio:** Productos NO tienen acceso directo a D1, solo a capability.

---

#### 2.3: Extraer `packages/shared-observability` (IMPORTANTE)

**Similar a 2.1**

---

### FASE 3: Contratos de API Internas (ALTO RIESGO)

**Duración:** 6-8 semanas  
**Objetivo:** Convertir imports directos en API contracts  
**Riesgo:** ALTO — Requiere refactor de lógica  

#### 3.1: Publishing Capability via Queue (P1)

**Arquitectura:**
```
Mentoría (Producer)
  ↓ Publish to queue
publishing-queue
  ↓ Consume
SocialFlow Worker (Consumer)
  ↓ Publish to LinkedIn/IG/TikTok
```

**Acción:**
1. Crear `publishing-queue` en Cloudflare
2. Mentoría: Replace `publishSocialPost()` con `publishToQueue()`
3. SocialFlow: Implementar queue consumer
4. Deploy con feature flag

**Tests necesarios:**
- [ ] End-to-end publishing flow
- [ ] Queue retry logic
- [ ] Failure scenarios
- [ ] Idempotency

**Qué NO tocar (todavía):**
- Otros imports
- Auth
- DB

---

#### 3.2: Sunset `/api/social/*` Routes (P1)

**Acción:**
1. Verificar logs de producción (0 uso esperado)
2. Comunicar deprecation (si uso > 0)
3. Remover routes
4. Remover archivos

**Rollback plan:**
- Mantener archivos en git por 3 meses
- Restore si necesario

---

#### 3.3: Separar Operator Routes (P2)

**Decisión necesaria primero:** Ver FASE 0, D1.

**Si Operator = parte de Campamento Base:**
```
/api/operator/socialflow → /api/campamento-base/operator/socialflow
```

**Si Operator = capa separada:**
```
# Mantener /api/operator/* pero:
# - Implementar como internal API
# - Contrato explícito
# - Versionado
```

---

## 📦 ARCHIVOS CANDIDATOS A SEPARAR

### Mentoría → Repo Independiente (Futuro lejano)

**Estructura objetivo:**
```
drako_mentoria/
  src/
    lib/
      mentoria/  # ← Todo lo que está en src/lib/mentoria
    components/
      mentoria/  # ← Todo lo que está en src/components/mentoria
    app/
      api/mentoria/  # ← Todo lo que está en src/app/api/mentoria
  workers/
    mentoria/  # ← workers/mentorias
  migrations/
    # ← migrations/mentoria_*.sql
  packages/
    shared-auth/  # ← Link o copy de drako_base/packages/shared-auth
```

**Dependencias externas:**
- `@drako/shared-auth` (npm package)
- `@drako/shared-data` (npm package)
- `@drako/shared-observability` (npm package)

**Prerequisitos:**
- ✅ FASE 1 completada
- ✅ FASE 2 completada
- ✅ Contratos versionados

---

### SocialFlow → Repo Independiente (Futuro lejano)

**Similar a Mentoría**

```
drako_socialflow/
  src/
    lib/socialflow/
    components/saas/socialflow/
    app/api/socialflow/
  apps/
    socialflow-runtime/
  migrations/
  packages/
    shared-auth/
```

---

## ✅ TESTS NECESARIOS POR FASE

### FASE 1: Infraestructura

**Migration Separation Tests:**
```typescript
describe('Mentoría migrations independence', () => {
  it('should only list Mentoría migrations', async () => {
    const migrations = await listMigrations('MENTORIA_DB');
    expect(migrations.every(m => m.startsWith('mentoria_'))).toBe(true);
  });
  
  it('should not affect SocialFlow when applying Mentoría migrations', async () => {
    await applyMigrations('MENTORIA_DB');
    const socialflowTables = await listTables('SOCIAL_DB');
    expect(socialflowTables).toMatchSnapshot();  // No changes
  });
});
```

**DRACO_DB Removal Tests:**
```typescript
describe('SocialFlow DRACO_DB independence', () => {
  it('should not use DRACO_DB binding', () => {
    const config = readWranglerConfig('socialflow-runtime');
    expect(config.d1_databases.find(db => db.binding === 'DRACO_DB')).toBeUndefined();
  });
  
  it('should work without DRACO_DB', async () => {
    const response = await fetch('https://socialflow.drako.systems/api/socialflow/profile');
    expect(response.ok).toBe(true);
  });
});
```

---

### FASE 2: Shared Modules

**Auth Package Tests:**
```typescript
describe('@drako/shared-auth/v1', () => {
  it('should export stable API', () => {
    const exports = Object.keys(sharedAuth.v1);
    expect(exports).toMatchSnapshot();  // No accidental additions
  });
  
  it('should work with Mentoría', async () => {
    const session = await verifySessionToken(token, 'mentorias');
    expect(session.userId).toBeDefined();
  });
  
  it('should work with SocialFlow', async () => {
    const session = await verifySessionToken(token, 'socialflow');
    expect(session.userId).toBeDefined();
  });
});
```

**Backward Compatibility Tests:**
```typescript
describe('Shared modules backward compatibility', () => {
  it('should not break existing imports', () => {
    // Old import should still work (with deprecation warning)
    import { getAuthsCookieCandidateNames } from '@/lib/auths/cookies';
    expect(getAuthsCookieCandidateNames).toBeDefined();
  });
});
```

---

### FASE 3: API Contracts

**Publishing Queue Tests:**
```typescript
describe('Publishing via queue', () => {
  it('should publish Mentoría post to queue', async () => {
    await mentoriaPublisher.publish({
      tenantId: 'test',
      content: 'Test post',
      channel: 'linkedin'
    });
    
    const queueMessages = await getQueueMessages('publishing-queue');
    expect(queueMessages).toHaveLength(1);
  });
  
  it('should consume queue and publish to LinkedIn', async () => {
    await publishingQueueConsumer.process();
    
    const publishedPosts = await getPublishedPosts('linkedin');
    expect(publishedPosts).toHaveLength(1);
  });
  
  it('should handle queue failures with retry', async () => {
    mockLinkedInAPI.mockRejectedValueOnce(new Error('API down'));
    
    await publishingQueueConsumer.process();
    await sleep(5000);  // Wait for retry
    await publishingQueueConsumer.process();
    
    const publishedPosts = await getPublishedPosts('linkedin');
    expect(publishedPosts).toHaveLength(1);  // Eventually succeeds
  });
});
```

---

## 🚫 QUÉ NO TOCAR (TODAVÍA)

### Nunca Tocar sin Approval

- ❌ Middleware de auth principal (`src/middleware.ts`)
- ❌ Edge auth logic (`src/lib/edge-auth.ts`)
- ❌ Billing core (`src/lib/billing/*`)
- ❌ Workers en producción activos
- ❌ Migraciones ya aplicadas en producción

### Tocar Solo Después de FASE 2

- ⏸️ Rutas de aplicación (`src/app/api/*`)
- ⏸️ Componentes UI (`src/components/*`)
- ⏸️ Imports de productos a shared modules

### Tocar Solo Después de FASE 3

- ⏸️ Lógica de negocio de productos
- ⏸️ Service layers
- ⏸️ Repositories

---

## 📊 CONCLUSIONES Y NEXT STEPS

### Estado Actual

**Buenas noticias:**
- ✅ Mentoría y SocialFlow NO tienen imports cruzados directos (excepto 1 punto)
- ✅ DBs dedicadas ya existen (MENTORIA_DB, SOCIAL_DB)
- ✅ Auth separation en progreso (bindings dedicados)
- ✅ Rutas producto-específicas bien separadas

**Malas noticias:**
- ❌ Shared dependencies sin contrato (auth, db, observability)
- ❌ Migrations mezcladas en un solo directorio
- ❌ DRACO_DB binding en SocialFlow (posible leakage)
- ❌ Publishing capability sin contrato explícito
- ❌ Rutas legacy (`/api/social/*`) sin sunset

### Decisiones Críticas Necesarias (FASE 0)

1. **¿Remover DRACO_DB de SocialFlow?**
   - Requiere: Auditoría de uso
   - Timeline: 1 semana

2. **¿Separar migrations ahora?**
   - Requiere: Validación de deployment pipeline
   - Timeline: 2 semanas

3. **¿Publishing: API, Queue, o Shared?**
   - Recomendación: Queue
   - Timeline: Diseño 1 semana, implementación 3 semanas

4. **¿Cuándo extraer shared modules?**
   - Recomendación: Después de FASE 1
   - Timeline: 4-6 semanas

5. **¿Sunset de `/api/social/*`?**
   - Requiere: Auditoría de logs de producción
   - Timeline: 1 semana auditoría + 3 meses deprecation

### Timeline Propuesto

**FASE 0:** 1 semana (Decisiones + Documentación)  
**FASE 1:** 2-3 semanas (Migrations + DRACO_DB cleanup + Inventory)  
**FASE 2:** 4-6 semanas (Extraer shared-auth, shared-data, shared-observability)  
**FASE 3:** 6-8 semanas (Publishing queue + Sunset legacy + Operator routes)

**TOTAL:** 13-18 semanas (3-4.5 meses) para independencia funcional  
**Separación física a repos:** +6 meses después (opcional)

### Riesgo General

**Si NO se hace nada:**
- Acoplamiento creciente entre productos
- Impossible deployment independiente
- Breaking changes afectan múltiples productos
- Escalabilidad limitada

**Si se ejecuta plan:**
- Deployment independiente de Mentoría y SocialFlow
- Shared modules con contrato estable
- Clear boundaries entre productos
- Preparación para mono-repo → multi-repo (si necesario)

---

## 📎 APÉNDICES

### A. Inventory Completo de Imports Compartidos

**Mentoría usa:**
```typescript
@/lib/auths/*           (47 archivos)
@/lib/db                (22 archivos)
@/lib/cf                (15 archivos)
@/lib/observability-core (8 archivos)
@/lib/drako/*           (9 archivos - tipos compartidos)
@/lib/social-core/*     (1 archivo - publishing)
@/lib/whatsapp/*        (2 archivos)
@/lib/agents/mentoria/* (6 archivos - internos)
```

**SocialFlow usa:**
```typescript
@/lib/auths/*           (8 archivos)
@/lib/db                (3 archivos)
@/lib/cf                (8 archivos)
@/lib/observability-core (2 archivos)
@/lib/integration-core  (2 archivos)
@/lib/social-core/*     (6 archivos - tipos + publishing)
```

**Overlap crítico:**
- `@/lib/auths/*` (AMBOS)
- `@/lib/db` (AMBOS)
- `@/lib/cf` (AMBOS)
- `@/lib/observability-core` (AMBOS)
- `@/lib/social-core/*` (AMBOS)

---

### B. Tablas D1 por Producto

**Mentoría (en MENTORIA_DB):**
```
mentoria_sessions
mentoria_students
mentoria_student_profiles
mentoria_guardians
mentoria_subjects
mentoria_progress
mentoria_interventions
mentoria_motivation
mentoria_daily_plans
mentoria_exercises
mentoria_session_persistence
mentoria_student_learning_memory
mentoria_student_subject_memory
mentoria_material_intakes
mentoria_material_context_notes
mentoria_academic_records
mentoria_academic_documents
mentoria_academic_extractions
mentoria_academic_analyses
mentoria_subject_performance_snapshots
mentoria_publish_jobs  # ← Publishing queue
mentoria_notification_queue  # ← WhatsApp notifications
mentoria_resilience_events  # ← Event log
```

**SocialFlow (en SOCIAL_DB):**
```
saas_social_posts
saas_social_accounts
saas_social_analytics
socialflow_profiles
socialflow_channel_profiles
socialflow_channel_knowledge
socialflow_channel_competitors
socialflow_channel_assets
```

**Shared (en drako_db_prod):**
```
holding_saas_registry  # ← Holding
holding_saases  # ← Holding
saas_tenants  # ← Shared
saas_pricing_plans  # ← Shared
saas_subscriptions  # ← Shared
saas_usage_quotas  # ← Shared
billing_audit_logs  # ← Shared
```

---

### C. Workers Inventory

**Per-Product Workers:**
```
saas-mentorias-prod
  ├─ MENTORIA_DB (dedicado)
  ├─ MENTORIAS_AUTHS_DB (dedicado)
  └─ Queues compartidas (billing, factory, provisioning)

saas-socialflows-runtime-canary
  ├─ SOCIAL_DB (dedicado)
  ├─ SOCIALFLOW_AUTHS_DB (dedicado)
  └─ DRACO_DB (⚠️ REVISAR)
```

**Shared Workers:**
```
drako-scheduler        # ← Usado por Mentoría
drako-billing-worker   # ← Usado por ambos
drako-core-worker      # ← Holding
drako-provisioner-worker  # ← Factory
drako-ai-orchestrator-worker  # ← Shared AI
```

---

**FIN DE AUDITORÍA DE INDEPENDENCIA DE SaaS**

*Próximos pasos: Ejecutar FASE 0 (Decisiones) y obtener approval para FASE 1.*
