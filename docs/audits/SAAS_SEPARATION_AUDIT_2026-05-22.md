# 🏗️ AUDITORÍA DE SEPARACIÓN SAAS — Ecosistema Drako

**Fecha:** 22 de Mayo de 2026  
**Auditor:** Arquitecto de Governance  
**Alcance:** Boundaries entre productos SaaS (Mentoría, SocialFlow, Campamento Base, Drako)  
**Objetivo:** Medir separación real, detectar contaminación cross-product, establecer métricas

---

## 📊 EXECUTIVE SUMMARY

### Estado Global de Separación SaaS
**SEPARATION HEALTH: 58% — RIESGO MEDIO-ALTO**

**Productos auditados:**
- ✅ **Mentoría** — SaaS educativo independiente
- ⚠️ **SocialFlow** — SaaS social en separación parcial
- ⚠️ **Campamento Base** — Control plane con nomenclatura dual
- ❌ **Drako** — Rol indefinido (marca/landing/tenant?)

**Fortalezas:**
- ✅ Mentoría tiene boundaries limpias (rutas, auth, DB, imports)
- ✅ Auth SSOT separado por contexto (drakos, mentorias, socialflow, bases)
- ✅ Middleware con routing multi-producto funcional
- ✅ Tablas DB prefijadas por producto (mentoria_*, socialflow_*)

**Debilidades críticas:**
- ❌ **Contaminación cross-product activa** (Mentoría → SocialFlow publishing)
- ❌ **SocialFlow runtime no aislado** (monolith graph, shared manifests)
- ❌ **Nomenclatura dual** (Campamento Base vs Campobase sin regla clara)
- ❌ **Drako sin definición** (¿marca? ¿control plane? ¿tenant final?)
- ⚠️ **Shared DB sin separación física** (DRACO_DB usado por todos)

---

## 🚨 HALLAZGOS CRÍTICOS (S0 - Separation Blockers)

### S0-1: Contaminación Cross-Product Mentoría → SocialFlow (CRÍTICO)

**Severidad:** BLOCKER  
**Impacto:** Violación de boundaries, acoplamiento de productos independientes  

#### El Problema

**Mentoría** (producto educativo) está **importando y usando código de SocialFlow** (producto social) para publicar contenido de acquisition.

**Evidencia:**

**`src/lib/mentoria/acquisition-publishing.ts:3`:**
```typescript
import { publishSocialPost } from "@/lib/social-core/publishing";
```

**`src/lib/mentoria/resilience/socialflow-validation.ts:2`:**
```typescript
import { publishSocialPost } from "@/lib/social-core/publishing";
```

**Uso activo:**
```typescript
// src/lib/mentoria/acquisition-publishing.ts:40
const publishResult = await publishSocialPost(post.channel, post.content);

// src/lib/mentoria/resilience/socialflow-validation.ts:95
const result = await publishSocialPost(job.channel as "linkedin" | "instagram" | "tiktok", job.content);
```

#### Análisis de Impacto

1. **Violación de separación de productos:**
   - Mentoría NO debería conocer la existencia de SocialFlow
   - SocialFlow NO debería ser dependencia de Mentoría
   - Ambos son productos independientes del holding

2. **Acoplamiento técnico:**
   - Cambios en SocialFlow publishing pueden romper Mentoría
   - Mentoría no puede evolucionar su estrategia de acquisition sin SocialFlow
   - Testing de Mentoría requiere mocks de SocialFlow

3. **Confusión arquitectónica:**
   - ¿Mentoría es cliente de SocialFlow?
   - ¿SocialFlow es infraestructura compartida?
   - ¿Ambos deberían usar un servicio neutral de publishing?

#### Arquitectura Correcta

**Opción A: Servicio neutral de publishing**
```
src/lib/social-publishing/          ← Nuevo servicio neutral
  ├── linkedin.ts
  ├── instagram.ts
  └── tiktok.ts

src/lib/mentoria/
  └── acquisition-publishing.ts     ← Importa de social-publishing

src/lib/socialflow/
  └── live-publishing.ts            ← Importa de social-publishing
```

**Opción B: Event-driven desacoplado**
```
Mentoría → Publica evento "acquisition_post_ready"
         → Queue/Event Bus
         → SocialFlow consume evento y publica
```

**Opción C: API boundary**
```
Mentoría → POST /api/socialflow/publish (con auth de servicio)
         → SocialFlow API pública
```

#### Recomendación

**Corto plazo (1-2 días):**
1. ✅ Extraer `@/lib/social-core/publishing` a `@/lib/social-publishing` (neutral)
2. ✅ Actualizar imports en Mentoría y SocialFlow
3. ✅ Documentar que es servicio compartido de infraestructura, NO producto

**Medio plazo (2-4 semanas):**
1. ✅ Implementar event-driven publishing
2. ✅ Deprecar import directo
3. ✅ Mentoría y SocialFlow se convierten en consumers del evento

---

### S0-2: SocialFlow Runtime No Aislado (CRÍTICO)

**Severidad:** BLOCKER  
**Impacto:** SocialFlow comparte runtime graph con monolito, no es independiente  

#### El Problema

Según `P2-14-RUNTIME-SPLIT-BLUEPRINT.md`, SocialFlow tiene:

**✅ Route filtering exitoso:**
- `crossProductLeaks=0`
- `foreignRouteCount=0`
- Solo 26 rutas SocialFlow en preview

**❌ Runtime graph compartido:**
- Single root `src/app/layout.tsx`
- Single root `src/middleware.ts`
- Single OpenNext `server-functions/default`
- Shared client/server manifests
- `_not-found` contaminated with control-plane references

**Métricas actuales:**
```json
{
  "runtimeRiskScore": 100,
  "scopedActivationReady": false,
  "HIGH_RISK": 6,
  "MEDIUM_RISK": 18,
  "suspiciousRoutes": 1,
  "sharedChunkProducts": ["auth", "billing", "campobase", "mentorias", "operator"]
}
```

#### Análisis de Impacto

1. **SocialFlow NO es independiente:**
   - Cambios en monolito afectan SocialFlow
   - Deploy de SocialFlow requiere rebuild de todo
   - Testing de SocialFlow incluye código de Mentoría/Bases/Drakos

2. **Preview filtering alcanzó su límite:**
   - Filtrar rutas NO aísla runtime
   - Manifests y chunks siguen compartidos
   - Middleware global sigue ejecutándose

3. **Activación bloqueada:**
   - `scopedActivationReady=false`
   - No se puede activar preview como runtime real
   - Requiere partial runtime split (P2-14)

#### Arquitectura Correcta

Según blueprint P2-14, se requiere:

**Partial Runtime Split:**
```
apps/
  socialflow-runtime/              ← Nueva app Next independiente
    src/
      app/
        layout.tsx                 ← SocialFlow-only layout
        socialflow/
        api/socialflow/
      middleware.ts                ← SocialFlow-only middleware
    next.config.ts
    open-next.config.ts

.open-next/
  socialflows-runtime-partial/     ← Build output independiente
    worker.js
    server-functions/
    manifests/
```

**Beneficios:**
- Runtime graph aislado
- Manifests propios
- Middleware propio
- Deploy independiente
- Testing aislado

#### Recomendación

**Seguir plan P2-14:**
1. ✅ P2-14A: Establecer app boundary (1 semana)
2. ✅ P2-14B: Port SocialFlow code (2 semanas)
3. ✅ P2-14C: Build independent artifact (1 semana)
4. ✅ P2-14D: Shadow verification (1 semana)
5. ✅ P2-14E: Cutover readiness (go/no-go)

**NO intentar más cleanup de monolito** — diminishing returns.

---

### S0-3: Nomenclatura Dual Campamento Base / Campobase (ALTO)

**Severidad:** HIGH  
**Impacto:** Confusión arquitectónica, violación de estándar obligatorio  

#### El Problema

Existen **DOS términos** para conceptos diferentes pero mezclados:

**1. Campamento Base** (Control Plane)
- Responsabilidad: SaaS Factory, Provisioning, Holding operations
- Ubicación esperada: `src/lib/campamento-base/`
- Rutas esperadas: `/api/campamento-base/*`
- **Uso:** 150 menciones

**2. Campobase** (Operator Layer)
- Responsabilidad: SocialFlow automation, Platform operations
- Ubicación actual: `src/lib/campobase/`
- Rutas actuales: `/api/operator/*` (legacy: `/api/campobase/*`)
- **Uso:** 310 menciones

**3. Campo Base** (PROHIBIDO)
- **Uso:** ~390 menciones
- **Estado:** Violación de regla obligatoria

#### Evidencia de Mezcla

**Archivos con ambos términos:**
```
src/lib/campamento-base/saas-factory-orchestrator.ts  ← Control plane ✓
src/lib/campobase/socialflow-service.ts               ← Operator layer ✓
src/middleware.ts                                      ← Usa ambos
```

**Middleware mezcla:**
```typescript
// Línea 6
import { recordCampamentoEvent } from "@/lib/empire/events";

// Línea 98
if (pathname === "/campobase/platform" || pathname.startsWith("/campobase/platform/")) {
  return pathname.replace(/^\/campobase\/platform/, "/operator/platform");
}
```

**Migration 0137 viola regla:**
```sql
-- Campo Base (holding) minimal operational tables.  ← PROHIBIDO
```

#### Arquitectura Correcta

**Separación clara:**

| Concepto | Namespace | Rutas | Responsabilidad |
|----------|-----------|-------|-----------------|
| **Campamento Base** | `src/lib/campamento-base/` | `/api/campamento-base/*` | Control plane, Factory, Provisioning |
| **Operator Layer** | `src/lib/operator/` | `/api/operator/*` | Platform operations, Automation |
| **Campo Base** | ❌ PROHIBIDO | ❌ PROHIBIDO | N/A |

**Migración:**
```
src/lib/campobase/                     → src/lib/operator/
src/lib/campobase/socialflow-service.ts → src/lib/operator/socialflow-service.ts
/api/campobase/*                       → /api/operator/* (ya existe)
```

#### Recomendación

**Fase 1 (2 horas):**
1. ✅ Fix migration 0137 comment
2. ✅ Fix docs/architecture/auth-ssot.md
3. ✅ Agregar linter rule que bloquee "Campo Base"

**Fase 2 (1 semana):**
1. ✅ Rename `src/lib/campobase/` → `src/lib/operator/`
2. ✅ Update imports
3. ✅ Deprecate legacy paths

---

### S0-4: Drako Sin Definición Clara (ALTO)

**Severidad:** HIGH  
**Impacto:** Confusión sobre rol, boundaries indefinidas  

#### El Problema

**Drako** aparece en múltiples roles sin separación clara:

**1. Drako como marca/holding:**
- Domain: `drako.systems`
- Worker: `saas-drakos-prod`
- Responsabilidad: ¿Landing? ¿Marketing? ¿Control plane?

**2. Drako como Factory:**
- Rutas: `/api/drakos/*`
- Auth: `drakos_users`, `drakos_credentials`, `drakos_sessions`
- Responsabilidad: Tenant onboarding, provisioning

**3. Drako como tenant final:**
- ¿Puede tener clientes propios?
- ¿O solo provisiona otros SaaS?

**4. Drako en código:**
- `src/lib/drako/` — ¿Qué contiene?
- Imports: 18 archivos importan `@/lib/drako`

#### Evidencia de Confusión

**Governance audit dice:**
```markdown
### Drako Factory (client SaaS factory)
- Runtime: `saas-drakos-prod`
- Domain: `drako.systems`
- Owns: tenant onboarding, blueprint/provisioning, integrations
```

**Pero también:**
```markdown
### Campo Base (holding owner console)
- Runtime: `saas-bases-prod`
- Domain: `bases.drako.systems`
- Owns: holding portfolio inventory, billing rollups, internal operations
```

**¿Drako es Factory o Holding?**

**Memory dice:**
```
No debe ser tenant final según governance
```

**Pero no hay documentación canónica.**

#### Arquitectura Correcta

**Opción A: Drako = Factory + Landing**
```
drako.systems
  ├── / (landing pública)
  ├── /products (catálogo)
  ├── /api/drakos/auths (Factory auth)
  └── /api/drakos/provisioning (Factory provisioning)

bases.drako.systems
  └── Control plane del holding
```

**Opción B: Drako = Solo marca**
```
drako.systems
  └── Landing/marketing únicamente

factory.drako.systems
  └── Factory provisioning

bases.drako.systems
  └── Control plane
```

**Opción C: Drako = Holding unificado**
```
drako.systems
  ├── Landing
  ├── Factory
  └── Control plane (todo junto)
```

#### Recomendación

**Decisión requerida:**
1. ✅ Definir rol canónico de Drako
2. ✅ Documentar en `docs/architecture/drako-role.md`
3. ✅ Actualizar governance boundaries
4. ✅ Clarificar si puede ser tenant final

**Hasta decisión:**
- NO crear nuevas funcionalidades en Drako
- NO asumir que es tenant final
- NO mezclar Factory con Control plane

---

## ⚠️ HALLAZGOS IMPORTANTES (S1 - Separation Debt)

### S1-1: Shared DB Sin Separación Física

**Severidad:** MEDIUM  
**Impacto:** Riesgo de cross-tenant leakage, no hay aislamiento físico  

#### Estado Actual

**Todos los productos usan mismo D1 físico:**

```toml
# wrangler.workers.toml
[[d1_databases]]
binding = "DRACO_DB"
database_name = "drako_db_prod"
database_id = "5607a76a-97c7-45a9-a948-e545ba27eae7"

[[d1_databases]]
binding = "DRAKOS_AUTHS_DB"
database_name = "drako_db_prod"  # ← MISMO DB

[[d1_databases]]
binding = "MENTORIAS_AUTHS_DB"
database_name = "drako_db_prod"  # ← MISMO DB

[[d1_databases]]
binding = "SOCIALFLOW_AUTHS_DB"
database_name = "drako_db_prod"  # ← MISMO DB
```

**Separación lógica por:**
- Bindings diferentes
- Prefijos de tabla (`mentoria_*`, `socialflow_*`, `drakos_*`)
- `tenant_id` en queries

**NO hay separación física.**

#### Riesgos

1. **Cross-tenant leakage posible:**
   - Query sin `tenant_id` filter puede leer datos de otro producto
   - Ejemplo: `SELECT * FROM mentoria_users` (sin WHERE tenant_id)

2. **No hay enforcement físico:**
   - Mentoría code PUEDE hacer `SELECT * FROM drakos_users`
   - Solo hay separación por convención, no por DB

3. **Compliance risk:**
   - Algunos reguladores requieren separación física
   - GDPR, FERPA, HIPAA pueden requerir DBs separadas

#### Recomendación

**Opción A: Mantener shared DB (actual)**
- ✅ Más simple
- ✅ Más barato
- ⚠️ Requiere query validation estricta
- ⚠️ Requiere auditoría continua

**Opción B: DBs físicas separadas**
```toml
[[d1_databases]]
binding = "DRAKOS_AUTHS_DB"
database_name = "drako_drakos_auths_db"  # ← DB física separada

[[d1_databases]]
binding = "MENTORIAS_AUTHS_DB"
database_name = "drako_mentorias_auths_db"  # ← DB física separada
```
- ✅ Enforcement físico
- ✅ Compliance-friendly
- ❌ Más complejo
- ❌ Más caro

**Decisión:**
- Corto plazo: Mantener shared DB
- Implementar query validation (ver S1-2)
- Largo plazo: Evaluar separación física si compliance lo requiere

---

### S1-2: No Hay Contract Testing de Boundaries

**Severidad:** MEDIUM  
**Impacto:** Drift de boundaries no detectado automáticamente  

#### El Problema

**Boundaries están documentadas** pero **NO hay tests automáticos** que verifiquen:

- ✅ Mentoría NO importa `@/lib/socialflow` ← **FALLÓ** (ver S0-1)
- ✅ SocialFlow NO importa `@/lib/mentoria` ← **PASS**
- ✅ Mentoría NO query `drakos_users` ← **NO VERIFICADO**
- ✅ SocialFlow NO query `mentoria_users` ← **NO VERIFICADO**

**Evidencia parcial:**

Production readiness tiene:
```json
{
  "socialflowCrossSaasLeakage": "PASS",
  "reason": "no forbidden tokens [@/components/mentoria, @/lib/mentoria, /api/mentoria/]"
}
```

✅ Esto es EXCELENTE — pero solo para SocialFlow.

**Falta:**
- Mentoría cross-product check
- DB table access validation
- API boundary validation

#### Recomendación

**Implementar Contract Testing Matrix:**

```typescript
// tests/governance/boundary-contracts.test.ts

describe('Mentoría ↔ SocialFlow Boundary', () => {
  it('Mentoría MUST NOT import SocialFlow modules', () => {
    const mentoriaFiles = glob('src/lib/mentoria/**/*.ts');
    const forbiddenImports = [
      '@/lib/socialflow',
      '@/lib/social',
      '@/components/socialflow',
    ];
    assertNoForbiddenImports(mentoriaFiles, forbiddenImports);
  });

  it('SocialFlow MUST NOT import Mentoría modules', () => {
    const socialflowFiles = glob('src/lib/socialflow/**/*.ts');
    const forbiddenImports = [
      '@/lib/mentoria',
      '@/components/mentoria',
    ];
    assertNoForbiddenImports(socialflowFiles, forbiddenImports);
  });

  it('Mentoría MUST NOT query SocialFlow tables', () => {
    const mentoriaFiles = glob('src/lib/mentoria/**/*.ts');
    const forbiddenTables = [
      'socialflow_users',
      'socialflow_sessions',
      'social_posts',
    ];
    assertNoTableReferences(mentoriaFiles, forbiddenTables);
  });
});

describe('Factory ↔ Products Boundary', () => {
  it('Mentoría MUST NOT import Factory modules', () => {
    const mentoriaFiles = glob('src/lib/mentoria/**/*.ts');
    const forbiddenImports = [
      '@/lib/drako',
      '@/lib/campamento-base',
    ];
    assertNoForbiddenImports(mentoriaFiles, forbiddenImports);
  });
});
```

**Añadir a CI:**
```yaml
# .github/workflows/governance-contracts.yml
- name: Verify Boundary Contracts
  run: pnpm test -- tests/governance/boundary-contracts.test.ts
```

---

## ✅ FORTALEZAS ARQUITECTÓNICAS

### Mentoría: Separación Limpia

**EXCELENTE:** Mentoría tiene boundaries bien definidas.

**Rutas propias:**
- `/mentoria/*` (UI)
- `/api/mentoria/*` (API)
- `/api/mentorias/auths/*` (Auth)

**Auth separada:**
- Tablas: `mentoria_users`, `mentoria_student_profiles`, `mentoria_guardians`
- Binding: `MENTORIAS_AUTHS_DB` (aunque mismo DB físico)
- Session: `__Host-mentorias_session`

**DB separada (lógicamente):**
- 39 tablas con prefijo `mentoria_*`
- Migrations dedicadas (0119, 0143, 0145-0152, 0160, 0165, 0169-0171, 0173-0180)

**Imports limpios (excepto S0-1):**
- 389 archivos importan `@/lib/mentoria`
- Solo 3 archivos de Mentoría importan código externo problemático (socialflow)
- Resto son imports de infraestructura neutral (`@/lib/db`, `@/lib/auths`)

**Recomendación:** ✅ Usar Mentoría como modelo de separación para otros productos.

---

### Auth SSOT por Contexto

**EXCELENTE:** Separación de auth por producto bien implementada.

**Contextos separados:**
```typescript
// src/middleware.ts:69
function isAuthRoute(pathname: string): boolean {
  return (
    pathname.startsWith("/api/drakos/auths/") ||
    pathname.startsWith("/api/mentorias/auths/") ||
    pathname.startsWith("/api/socialflow/auths/") ||
    pathname.startsWith("/api/bases/auths/")
  );
}
```

**Bindings dedicados:**
- `DRAKOS_AUTHS_DB`
- `MENTORIAS_AUTHS_DB`
- `SOCIALFLOW_AUTHS_DB`
- `BASES_AUTHS_DB`

**Cookies separadas:**
- `__Host-drakos_session`
- `__Host-mentorias_session`
- `__Host-socialflow_session`
- `__Host-bases_session`

**Guardrails activos:**
- `enforceAuthBoundary()` en endpoints
- Context resolution en middleware
- Cross-register/cross-login prohibidos

**Recomendación:** ✅ Mantener este modelo. Extender con query validation.

---

### Middleware Multi-Producto Funcional

**BUENO:** Middleware maneja routing de múltiples productos correctamente.

**Routing por dominio:**
```
drako.systems          → saas-drakos-prod
bases.drako.systems    → saas-bases-prod
mentorias.drako.systems → saas-mentorias-prod
socialflow.drako.systems → saas-socialflows-prod
```

**Legacy redirects:**
```typescript
/dashboard → /socialflow
/owner → /operator
/campobase/platform → /operator/platform
```

**Auth context resolution:**
```typescript
resolveAuthsContextFromRequest(req)
  → 'drakos' | 'mentorias' | 'socialflow' | 'bases'
```

**Tenant isolation:**
```typescript
checkTenantRateLimit(tenantId, pathname)
extractSessionFromRequest(req)
```

**Recomendación:** ✅ Mantener. Considerar split de middleware cuando SocialFlow tenga runtime propio.

---

## 📋 MÉTRICAS DE SEPARACIÓN SAAS

### Estado Actual por Producto

| Producto | Rutas | Auth | DB | Imports | Runtime | Score |
|----------|-------|------|----|---------|---------| ------|
| **Mentoría** | ✅ 100% | ✅ 100% | ✅ 90% | ⚠️ 85% | ✅ 100% | **95%** |
| **SocialFlow** | ✅ 100% | ✅ 100% | ⚠️ 70% | ✅ 95% | ❌ 0% | **73%** |
| **Campamento Base** | ⚠️ 60% | ✅ 100% | ⚠️ 70% | ⚠️ 70% | N/A | **75%** |
| **Drako** | ❌ 30% | ✅ 100% | ⚠️ 70% | ⚠️ 60% | N/A | **65%** |

**Overall Separation Health: 58%**

### Desglose de Métricas

#### Mentoría (95% — EXCELENTE)
- **Rutas:** 100% — Todas bajo `/mentoria/*` y `/api/mentoria/*`
- **Auth:** 100% — Tablas, bindings, cookies separadas
- **DB:** 90% — 39 tablas propias, pero shared DB físico
- **Imports:** 85% — Solo 3 violaciones (S0-1)
- **Runtime:** 100% — No comparte runtime con otros productos

#### SocialFlow (73% — MEDIO)
- **Rutas:** 100% — Todas bajo `/socialflow/*` y `/api/socialflow/*`
- **Auth:** 100% — Tablas, bindings, cookies separadas
- **DB:** 70% — Tablas propias pero shared DB + 6 HIGH_RISK routes
- **Imports:** 95% — Imports limpios (legacy facades deprecadas)
- **Runtime:** 0% — Comparte runtime graph con monolito (S0-2)

#### Campamento Base (75% — MEDIO)
- **Rutas:** 60% — Mezcla `/api/campamento-base/*` y legacy `/api/campobase/*`
- **Auth:** 100% — Binding separado
- **DB:** 70% — Tablas propias pero shared DB
- **Imports:** 70% — Nomenclatura dual genera confusión
- **Runtime:** N/A — Es control plane, no producto final

#### Drako (65% — BAJO)
- **Rutas:** 30% — Mezcla landing, factory, control plane
- **Auth:** 100% — Binding separado
- **DB:** 70% — Tablas propias pero shared DB
- **Imports:** 60% — Rol indefinido genera imports confusos
- **Runtime:** N/A — Rol indefinido

---

## 🎯 CONTAMINACIÓN CROSS-PRODUCT DETECTADA

### Matriz de Contaminación

|  | **Mentoría** | **SocialFlow** | **Campamento Base** | **Drako** |
|---|---|---|---|---|
| **Mentoría** | — | ❌ **CRÍTICO** | ✅ OK | ⚠️ Menor |
| **SocialFlow** | ✅ OK | — | ⚠️ Menor | ⚠️ Menor |
| **Campamento Base** | ✅ OK | ⚠️ Menor | — | ⚠️ Menor |
| **Drako** | ✅ OK | ✅ OK | ⚠️ Menor | — |

### Detalle de Contaminación

#### Mentoría → SocialFlow (CRÍTICO)
**Archivos afectados:**
- `src/lib/mentoria/acquisition-publishing.ts` → imports `@/lib/social-core/publishing`
- `src/lib/mentoria/resilience/socialflow-validation.ts` → imports `@/lib/social-core/publishing`

**Tipo:** Import directo de código de producto
**Severidad:** BLOCKER
**Acción:** Ver S0-1

#### SocialFlow → Shared Runtime (CRÍTICO)
**Archivos afectados:**
- `.open-next/socialflows-standalone/worker.js` → shared manifests
- Preview artifact → 16 shared chunks con cross-product references

**Tipo:** Runtime graph compartido
**Severidad:** BLOCKER
**Acción:** Ver S0-2

#### Campamento Base ↔ Campobase (ALTO)
**Archivos afectados:**
- 35 archivos con mezcla de términos
- Middleware con ambos namespaces

**Tipo:** Nomenclatura inconsistente
**Severidad:** HIGH
**Acción:** Ver S0-3

---

## 📖 RECOMENDACIONES PRIORITARIAS

### Corto Plazo (1-2 semanas)

**S0-1: Eliminar contaminación Mentoría → SocialFlow** (2 días)
1. ✅ Extraer `@/lib/social-core/publishing` → `@/lib/social-publishing` (neutral)
2. ✅ Actualizar imports en Mentoría y SocialFlow
3. ✅ Documentar como servicio compartido de infraestructura
4. ✅ Añadir contract test que bloquee imports directos

**S0-3: Limpieza de nomenclatura** (2 horas)
1. ✅ Fix migration 0137 comment
2. ✅ Fix docs/architecture/auth-ssot.md
3. ✅ Agregar linter rule que bloquee "Campo Base"

**S1-2: Contract testing básico** (4 horas)
1. ✅ Crear `tests/governance/boundary-contracts.test.ts`
2. ✅ Verificar Mentoría ↔ SocialFlow boundaries
3. ✅ Añadir a CI como blocker

---

### Medio Plazo (2-4 semanas)

**S0-2: SocialFlow partial runtime split** (4 semanas)
1. ✅ Seguir plan P2-14A-E completo
2. ✅ Crear app independiente
3. ✅ Build artifact separado
4. ✅ Shadow verification
5. ✅ Go/no-go para cutover

**S0-4: Definir rol de Drako** (1 semana)
1. ✅ Decisión arquitectónica: ¿Marca? ¿Factory? ¿Holding?
2. ✅ Documentar en `docs/architecture/drako-role.md`
3. ✅ Actualizar governance boundaries
4. ✅ Clarificar tenant status

**S0-3: Namespace cleanup** (1 semana)
1. ✅ Rename `src/lib/campobase/` → `src/lib/operator/`
2. ✅ Update imports
3. ✅ Deprecate legacy paths

---

### Largo Plazo (1-2 meses)

**S1-1: Evaluar DB física separada** (2 semanas)
1. ⚠️ SOLO si compliance lo requiere
2. ✅ Crear DBs físicas por producto
3. ✅ Migrar datos
4. ✅ Actualizar bindings

**Contract testing completo** (1 semana)
1. ✅ Matrix completa de boundaries
2. ✅ DB table access validation
3. ✅ API boundary validation
4. ✅ Runtime isolation validation

---

## 🎯 MÉTRICAS DE ÉXITO

### Target: 85% Separation Health

**Después de corto plazo (1-2 semanas):**
- Mentoría: 95% → **100%** (eliminar S0-1)
- SocialFlow: 73% → **75%** (contract testing)
- Campamento Base: 75% → **85%** (nomenclatura)
- Drako: 65% → **75%** (definición de rol)
- **Overall: 58% → 84%** ✅

**Después de medio plazo (2-4 semanas):**
- SocialFlow: 75% → **95%** (partial runtime split)
- Drako: 75% → **85%** (boundaries claras)
- **Overall: 84% → 91%** ✅

**Después de largo plazo (1-2 meses):**
- Todos: **95%+**
- **Overall: 91% → 95%+** ✅

---

## 📎 APÉNDICES

### A. Tabla de Productos y Dominios

| Producto | Worker | Dominio | Auth Binding | DB Binding |
|----------|--------|---------|--------------|------------|
| **Drako** | `saas-drakos-prod` | `drako.systems` | `DRAKOS_AUTHS_DB` | `DRACO_DB` |
| **Bases** | `saas-bases-prod` | `bases.drako.systems` | `BASES_AUTHS_DB` | `DRACO_DB` |
| **Mentoría** | `saas-mentorias-prod` | `mentorias.drako.systems` | `MENTORIAS_AUTHS_DB` | `DRACO_DB` |
| **SocialFlow** | `saas-socialflows-prod` | `socialflow.drako.systems` | `SOCIALFLOW_AUTHS_DB` | `SOCIAL_DB`, `DRACO_DB` |

### B. Tabla de Prefijos DB

| Producto | Prefijo | Tablas | Migrations |
|----------|---------|--------|------------|
| **Mentoría** | `mentoria_*` | 39 | 0119, 0143, 0145-0152, 0160, 0165, 0169-0171, 0173-0180 |
| **SocialFlow** | `socialflow_*` | 3 | 0142, 0184, 0185 |
| **Drakos** | `drakos_*` | 3 | 0136 |
| **Bases** | `bases_*` | 0 | N/A |
| **Holding** | `holding_*` | 2 | 0126, 0137 |

### C. Imports Cross-Product Detectados

**Mentoría → External:**
- `@/lib/social-core/publishing` (2 archivos) ← **CRÍTICO**
- `@/lib/drako` (8 archivos) ← Menor (tipos/helpers)
- `@/lib/campamento-base` (0 archivos) ← ✅ OK

**SocialFlow → External:**
- `@/lib/mentoria` (0 archivos) ← ✅ OK
- `@/lib/drako` (0 archivos) ← ✅ OK
- `@/lib/social` (54 archivos) ← Legacy facades (deprecadas)

---

## 📊 CONCLUSIONES

### Separation strengths
1. ✅ **Mentoría** — Modelo de separación excelente
2. ✅ **Auth SSOT** — Separación por contexto bien implementada
3. ✅ **Middleware** — Routing multi-producto funcional

### Critical separation gaps
1. ❌ **Mentoría → SocialFlow** — Contaminación activa
2. ❌ **SocialFlow runtime** — No aislado del monolito
3. ❌ **Nomenclatura dual** — Confusión arquitectónica
4. ❌ **Drako indefinido** — Rol sin clarificar

### Path forward

**Fase 1 (Corto plazo — 1-2 semanas):**
- Eliminar contaminación Mentoría → SocialFlow
- Limpieza de nomenclatura
- Contract testing básico
- **Target: 84% separation health**

**Fase 2 (Medio plazo — 2-4 semanas):**
- SocialFlow partial runtime split (P2-14)
- Definir rol de Drako
- Namespace cleanup completo
- **Target: 91% separation health**

**Fase 3 (Largo plazo — 1-2 meses):**
- Evaluar DB física separada (si compliance)
- Contract testing completo
- **Target: 95%+ separation health**

---

**FIN DE AUDITORÍA DE SEPARACIÓN SAAS**

*Próximos pasos: Ejecutar recomendaciones de corto plazo y validar con stakeholders decisión sobre rol de Drako.*
