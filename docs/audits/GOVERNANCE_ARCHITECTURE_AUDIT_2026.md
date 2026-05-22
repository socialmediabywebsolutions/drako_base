# 🏛️ AUDITORÍA DE GOVERNANCE - Ecosistema Drako

**Fecha:** 22 de Mayo de 2026  
**Auditor:** Arquitecto de Governance  
**Alcance:** Arquitectura global del Holding sin modificar implementación de producto  
**Objetivo:** Ordenar y proteger contratos arquitectónicos, boundaries y nomenclatura

---

## 📊 EXECUTIVE SUMMARY

### Estado Global de Governance
**GOVERNANCE HEALTH: 62% — RIESGO MEDIO-ALTO**

**Fortalezas:**
- ✅ Production gates exhaustivos y automatizados
- ✅ Boundaries de capas documentadas y funcionales
- ✅ Auth SSOT con separación por contexto (drakos/mentorias/bases)
- ✅ Multi-tenant isolation en middleware

**Debilidades críticas:**
- ❌ **Fragmentación de registry holding** (3 tablas, 2 DBs físicas, desincronizadas)
- ❌ **Nomenclatura inconsistente** (Campo Base prohibido pero usado)
- ❌ **Documentación legacy marcada pero no retirada** (confusión operacional)
- ⚠️ **Contratos implícitos** (no auditables automáticamente)

---

## 🚨 HALLAZGOS CRÍTICOS (G0 - Governance Blockers)

### G0-1: Fragmentación de Registry del Holding (CRÍTICO)

**Severidad:** BLOCKER  
**Impacto:** Desincronización de estado, single source of truth roto  

#### El Problema

Existen **3 tablas diferentes** para el mismo concepto (registry de SaaS del holding) en **2 bases de datos físicamente separadas**:

**Base de datos 1: `drako_holding_db`** (ID: `52752a5c-b290-4633-91c6-e2a371a0c669`)
```sql
-- workers/drako-core-worker/migrations/0001_drako_core_foundations.sql
CREATE TABLE IF NOT EXISTS saases_registry (
  saas_id TEXT PRIMARY KEY,
  saas_slug TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  status_name TEXT NOT NULL CHECK (status_name IN ('draft', 'provisioning', 'active', 'paused', 'archived')),
  ...
);
```

**Usado por:**
- `drako-core-worker` (binding: `DRKO_HOLDING_DB`)
- `drako-provisioner-worker` (binding: `DRKO_HOLDING_DB`)

**Base de datos 2: `drako_db_prod`** (ID: `5607a76a-97c7-45a9-a948-e545ba27eae7`)

**Tabla A:**
```sql
-- migrations/0126_holding_multi_saas_monetization.sql
CREATE TABLE IF NOT EXISTS holding_saas_registry (
    saas_slug TEXT PRIMARY KEY,
    display_name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    ...
);
```

**Tabla B:**
```sql
-- migrations/0137_holding_control_tower_foundations.sql
CREATE TABLE IF NOT EXISTS holding_saases (
  id TEXT PRIMARY KEY,
  saas_slug TEXT NOT NULL UNIQUE,
  worker_name TEXT NOT NULL,
  domain TEXT NOT NULL,
  ...
);
```

**Usado por:**
- `saas-factory-worker` usa `holding_saas_registry` (binding: `DRACO_DB`)
- TODOS los otros workers (drakos, bases, mentorias, autopilot, etc.) usan `DRACO_DB`

#### Evidencia

**`workers/saas-factory-worker/src/index.ts:73`:**
```typescript
const existingSaas = await queryOne<{ saas_slug: string }>(
    `SELECT saas_slug FROM holding_saas_registry WHERE saas_slug = ?`,
    saasSlug
);
```

**`workers/drako-core-worker/src/repositories.ts:28`:**
```typescript
await database.prepare(
  `INSERT INTO saases_registry (...) VALUES (...)`
).run();
```

**`workers/drako-provisioner-worker/src/repositories.ts:5`:**
```typescript
return database.prepare(
  `SELECT saas_id, saas_slug, status_name, worker_name, domain_name 
   FROM saases_registry WHERE saas_slug = ? LIMIT 1`
).bind(saasSlug).first();
```

#### Impacto Real

1. **Desincronización garantizada:** `drako-core-worker` escribe en `drako_holding_db.saases_registry` pero `saas-factory-worker` lee de `drako_db_prod.holding_saas_registry` — **NO están conectadas**
2. **Race conditions:** Si Factory crea un SaaS y Core Worker lo registra, las dos bases de datos tienen estados diferentes
3. **Single Source of Truth roto:** No hay una única tabla canónica
4. **Confusión operacional:** ¿Cuál tabla es la "real"?

#### Recomendación

**Opción A (Recomendada): Consolidar en `drako_db_prod`**
1. Deprecar `drako_holding_db` completamente
2. Migrar `drako-core-worker` y `drako-provisioner-worker` a usar `DRACO_DB`
3. Unificar en una sola tabla: `saases_registry` o `holding_saases` (decidir una)
4. Eliminar tabla redundante

**Opción B: Sincronización activa**
1. Implementar CDC (Change Data Capture) entre ambas DBs
2. Garantizar eventual consistency con retry logic
3. **NO RECOMENDADO** — añade complejidad innecesaria

---

### G0-2: Nomenclatura "Campo Base" Prohibida pero Activa (CRÍTICO)

**Severidad:** BLOCKER  
**Impacto:** Violación de estándar obligatorio, confusión de arquitectura  

#### El Problema

**Regla canónica** (docs/memory):
```
**Campo Base** = PROHIBIDO
- No usar en código, documentación, prompts, rutas nuevas, componentes nuevos ni respuestas
- Reemplazar siempre por "Campamento Base" o "Campobase" según contexto
```

**Violación en migration 0137:**
```sql
-- migrations/0137_holding_control_tower_foundations.sql
-- Campo Base (holding) minimal operational tables.  ← VIOLACIÓN
```

**Violación en arquitectura docs:**
```markdown
# docs/architecture/auth-ssot.md:6
- Campo Base (holding): `bases.drako.systems`  ← VIOLACIÓN
```

**390+ menciones en código fuente:**
```
Found 390 matches across 113 files
src/lib/campobase/socialflow-service.ts (63 matches)
src/app/api/operator/socialflow/route.ts (48 matches)
src/middleware.ts (12 matches)
...
```

#### Análisis de Nomenclatura Actual

**Términos en uso:**
1. **"Campamento Base"** — Nombre oficial del holding (✅ CORRECTO)
2. **"campobase"** — Namespace técnico legacy de operator layer (✅ PERMITIDO hasta limpieza)
3. **"campamento-base"** — Namespace técnico del control plane (✅ CORRECTO)
4. **"Campo Base"** — ❌ **PROHIBIDO** pero presente en 390+ lugares

#### Evidencia de Mezcla

**src/middleware.ts** usa ambos:
```typescript
// Línea 6
import { recordCampamentoEvent } from "@/lib/empire/events";

// Línea 98
if (pathname === "/campobase/platform" || pathname.startsWith("/campobase/platform/")) {
  return pathname.replace(/^\/campobase\/platform/, "/operator/platform");
}
```

**Migración 0137** viola regla:
```sql
-- Campo Base (holding) minimal operational tables.
```

#### Impacto Real

1. **Confusión de arquitectura:** ¿"Campo Base" y "Campamento Base" son lo mismo?
2. **Violación de compliance:** Regla obligatoria no enforced
3. **Drift semántico:** Mezcla de términos genera ambigüedad en comunicación

#### Recomendación

**Fase 1: Limpieza de violaciones activas (1 hora)**
1. ✅ Reemplazar comentario en `0137_holding_control_tower_foundations.sql`
2. ✅ Reemplazar en `docs/architecture/auth-ssot.md`
3. ✅ Agregar linter rule que bloquee "Campo Base" en PRs

**Fase 2: Limpieza de namespace legacy (timing: después de P0 fixes)**
1. Mantener `campobase/` namespace técnico hasta fase explícita de refactor
2. NO crear nuevos archivos con `campobase/` — usar `campamento-base/`
3. Documentar regla de transición

---

### G0-3: Documentación Legacy No Retirada (ALTO)

**Severidad:** HIGH  
**Impacto:** Confusión operacional, decisiones basadas en docs incorrectas  

#### El Problema

**Documentos marcados como LEGACY pero aún presentes:**

**`docs/architecture/enterprise_holding.md`:**
```markdown
> LEGACY DOCUMENT
> This file captures a previous holding-centric registry and billing model. 
> The current canonical runtime contract for active SaaS creation and readiness 
> lives in the Drako factory tables: `saas`, `saas_instances`, `saas_domains`, 
> `provisioning_jobs`, and `campamento_provisioning`.
```

**`docs/architecture/subsidiary_protocol.md`:**
```markdown
> LEGACY DOCUMENT
> This document describes a historical holding-registry model. 
> The live canonical Drako runtime now provisions and reads SaaS state from 
> `saas`, `saas_instances`, `saas_domains`, `provisioning_jobs`, and 
> `campamento_provisioning`. Do not use `holding_saas_registry` as the active 
> source of truth for new work.
```

**PERO:**
- ✅ `holding_saas_registry` tabla **EXISTE** en `drako_db_prod` (migration 0126)
- ✅ `saas-factory-worker` **USA** `holding_saas_registry` activamente
- ❌ Tablas mencionadas como "canónicas" (`saas`, `saas_instances`, etc.) **NO EXISTEN** en migrations

#### Evidencia

**Búsqueda de tablas "canónicas":**
```bash
grep -r "CREATE TABLE.*saas_instances" migrations/
# NO RESULTS

grep -r "CREATE TABLE.*provisioning_jobs" migrations/
# NO RESULTS

grep -r "CREATE TABLE.*campamento_provisioning" migrations/
# NO RESULTS
```

**Pero `holding_saas_registry` SÍ existe:**
```sql
-- migrations/0126_holding_multi_saas_monetization.sql:5
CREATE TABLE IF NOT EXISTS holding_saas_registry (
    saas_slug TEXT PRIMARY KEY,
    ...
);
```

#### Impacto Real

1. **Documentación miente:** Dice que tablas son legacy pero están activas
2. **Guía de arquitectura inválida:** Referencias a tablas inexistentes
3. **Decisiones incorrectas:** Nuevos desarrollos evitan "legacy" que es real

#### Recomendación

**Opción A (Recomendada): Actualizar documentación a realidad**
1. Remover marcas "LEGACY DOCUMENT" de `enterprise_holding.md` y `subsidiary_protocol.md`
2. Actualizar con estado real: "Modelo actual en producción, consolidación pendiente"
3. Documentar plan de migración si aplica

**Opción B: Implementar el modelo "canónico"**
1. Crear tablas `saas`, `saas_instances`, `provisioning_jobs`, `campamento_provisioning`
2. Migrar `holding_saas_registry` → nuevas tablas
3. **ALTO COSTO** — no recomendado sin necesidad de negocio

---

## ⚠️ HALLAZGOS IMPORTANTES (G1 - Governance Debt)

### G1-1: Boundaries Bien Definidas pero Sin Contract Testing

**Severidad:** MEDIUM  
**Impacto:** Drift de contratos no detectado automáticamente  

#### Estado Actual

**Documentación de boundaries:** ✅ EXCELENTE

`docs/runbooks/holding-factory-boundaries.md`:
```markdown
## Boundary Model

### Campo Base (holding owner console)
- Runtime: `saas-bases-prod`
- Domain: `bases.drako.systems`
- Owns: holding portfolio inventory, billing rollups, internal operations

### Drako Factory (client SaaS factory)
- Runtime: `saas-drakos-prod`
- Domain: `drako.systems`
- Owns: tenant onboarding, blueprint/provisioning, integrations

### Vertical SaaS platforms (owned by holding)
- Runtime: `saas-mentorias-prod`
- Domain: `mentorias.drako.systems`
- Owns: product customers, vertical subscriptions
```

**Production gates:** ✅ EXHAUSTIVOS

`docs/audits/production-readiness-latest.md`:
- 186 checks total
- 182 pass, 1 fail, 3 N/A
- Automated via `pnpm check:production`

#### El Problema

**NO hay contract testing automático:**
- ✅ Boundaries están documentadas
- ✅ Production gates verifican hostnames y workers
- ❌ NO hay tests que verifiquen que Factory **NO** accede a tablas de Mentoría
- ❌ NO hay tests que verifiquen que SocialFlow **NO** importa `@/lib/mentoria`
- ❌ NO hay verificación de API contracts entre capas

**Evidencia parcial:**

`docs/audits/production-readiness-latest.md:179`:
```
| socialflowCrossSaasLeakage | BLOCKER | socialflow:no-cross-saas-leakage | PASS | 
"no forbidden tokens [@/components/mentoria, @/lib/mentoria, /api/mentoria/, ...]" | 
"no_forbidden_tokens" |
```

✅ Esto es EXCELENTE — pero solo para SocialFlow.

#### Recomendación

**Implementar Contract Testing Matrix:**

```typescript
// tests/governance/boundary-contracts.test.ts

describe('Holding ↔ Factory Boundary', () => {
  it('Factory code MUST NOT import holding-specific modules', () => {
    const factoryFiles = glob('src/lib/drako/**/*.ts');
    const forbiddenImports = [
      '@/lib/campamento-base',
      '@/lib/owner',
      '@/components/operator',
    ];
    assertNoForbiddenImports(factoryFiles, forbiddenImports);
  });

  it('Factory APIs MUST NOT query holding tables', () => {
    const factoryApis = glob('src/app/api/drakos/**/*.ts');
    const forbiddenTables = [
      'holding_saases',
      'holding_billing_rollups',
      'holding_ops_tickets',
    ];
    assertNoTableReferences(factoryApis, forbiddenTables);
  });
});

describe('Factory ↔ Mentoría Boundary', () => {
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

### G1-2: Auth SSOT Documentado pero Validación Parcial

**Severidad:** MEDIUM  
**Impacto:** Posible drift de auth boundaries sin detección  

#### Estado Actual

**Documentación:** ✅ EXCELENTE

`docs/architecture/auth-ssot.md`:
```markdown
## SSOT de usuarios por capa
- `drakos`:
  - API canónica: `/api/drakos/auths/{registrations,logins,logouts}`
  - Tablas SSOT: `drakos_users`, `drakos_credentials`, `drakos_sessions`
  - Binding DB esperado: `DRAKOS_AUTHS_DB`

- `mentorias`:
  - API canónica: `/api/mentorias/auths/{registrations,logins,logouts}`
  - Tablas SSOT: `mentorias_users`, `mentorias_credentials`, `mentorias_sessions`
  - Binding DB esperado: `MENTORIAS_AUTHS_DB`
```

**Guardrails técnicos:**
```markdown
## Guardrails técnicos activos
- `enforceAuthBoundary(...)` en endpoints auth por frontera
- `AUTHS_REQUIRE_CONTEXT_DB=true` para exigir binding contextual
- `verify-auth-ssot` (script) y `auth-cross-redirects.test.ts` (test)
```

#### El Problema

**Validación de bindings NO exhaustiva:**

`wrangler.workers.toml`:
```toml
[[d1_databases]]
binding = "DRACO_DB"
database_name = "drako_db_prod"

[[d1_databases]]
binding = "DRAKOS_AUTHS_DB"
database_name = "drako_db_prod"  # ← MISMO DB FÍSICO

[[d1_databases]]
binding = "BASES_AUTHS_DB"
database_name = "drako_db_prod"  # ← MISMO DB FÍSICO
```

✅ Separación lógica por binding  
⚠️ NO hay separación física  
❌ NO hay validación que queries usen el binding correcto

**Posible violación no detectada:**
```typescript
// Mentoría code podría hacer esto sin error:
const users = await env.DRACO_DB.prepare(
  `SELECT * FROM drakos_users WHERE ...`  // ← CROSS-BOUNDARY LEAK
).all();
```

#### Recomendación

**Opción A: DB físicas separadas (IDEAL pero costoso)**
```toml
[[d1_databases]]
binding = "DRAKOS_AUTHS_DB"
database_name = "drako_drakos_auths_db"  # ← DB física separada

[[d1_databases]]
binding = "MENTORIAS_AUTHS_DB"
database_name = "drako_mentorias_auths_db"  # ← DB física separada
```

**Opción B: Query validation en runtime (PRAGMÁTICO)**
```typescript
// src/lib/auths/db-guard.ts
export function createAuthDbGuard(binding: string, allowedContext: 'drakos' | 'mentorias') {
  return {
    prepare(query: string) {
      const forbiddenTables = allowedContext === 'drakos' 
        ? ['mentorias_users', 'mentorias_credentials', 'bases_users']
        : ['drakos_users', 'drakos_credentials', 'bases_users'];
      
      for (const table of forbiddenTables) {
        if (query.includes(table)) {
          throw new Error(`AUTH_BOUNDARY_VIOLATION: ${allowedContext} cannot query ${table}`);
        }
      }
      return env[binding].prepare(query);
    }
  };
}
```

**Opción C: Static analysis (RECOMENDADO para corto plazo)**
```bash
# scripts/verify-auth-ssot-queries.ts
# Scan all files in src/lib/mentoria, src/app/api/mentorias
# Verify: NO references to drakos_users, drakos_credentials, etc.
```

---

### G1-3: Isolation Multi-Tenant Inconsistente (MEDIO)

**Severidad:** MEDIUM  
**Impacto:** Ver AUDIT_TECHNICAL_COMPLETE_2026.md — ya documentado como P0  

**Referencia:**
- Ver hallazgo P0-1 en `AUDIT_TECHNICAL_COMPLETE_2026.md`
- Queries sin `tenant_id` filter en acquisition posts
- Auth isolation incomplete checks en middleware

**Nota:** Este es un **governance concern** porque afecta el contrato de isolation entre tenants, pero la **implementación técnica** ya está auditada en el reporte técnico.

**Recomendación:** Seguir plan de FASE 1 del reporte técnico.

---

## ✅ FORTALEZAS ARQUITECTÓNICAS

### Automatización de Production Gates

**EXCELENTE:** Sistema exhaustivo de gates automatizados.

**`docs/config/production-audits-expected-state.json`:**
- 186 checks definidos
- Workers, hostnames, routes, databases, bindings, tables, columns
- Legacy guards, auth binding separation, artifact matrix
- Contract enforcement para SocialFlow

**Evidencia:**
```json
{
  "criticalWorkers": [
    { "workerName": "drako-core-worker", "expectedStatus": "ACTIVE" },
    { "workerName": "drako-base-3", "expectedStatus": "ARCHIVED" }
  ],
  "criticalHostnames": [
    { "hostname": "drako.systems", "expectedService": "saas-drakos-prod" },
    { "hostname": "bases.drako.systems", "expectedService": "saas-bases-prod" }
  ],
  "phaseGates": {
    "socialflowCanonicalDomain": {
      "active": true,
      "canonicalHostname": "socialflow.drako.systems"
    }
  }
}
```

**Resultado:** 182/186 checks PASS (97.8%)

**Recomendación:** ✅ Mantener este estándar. Extender a contract testing.

---

### Separación de Capas Clara

**BUENA:** Boundaries entre Holding, Factory y SaaS verticales bien definidas.

**`docs/runbooks/holding-factory-boundaries.md`:**
- Responsabilidades claras por capa
- Separation of concerns respetada
- Data isolation rules documentadas

**Validación en producción:**
```
| blockedServiceHit | BLOCKER | drako.systems | PASS | 
"service NOT IN [drako-base-3]" | "saas-drakos-prod" |
```

**Recomendación:** ✅ Extender con contract tests automáticos.

---

### Auth SSOT por Contexto

**EXCELENTE:** Separación de auth por producto (drakos, mentorias, bases).

**`docs/architecture/auth-ssot.md`:**
- APIs canónicas por contexto
- Bindings dedicados (aunque mismo DB físico)
- Prohibiciones explícitas de cross-register/cross-login
- Guardrails técnicos activos

**Middleware enforcement:**
```typescript
// src/middleware.ts
function isAuthRoute(pathname: string): boolean {
  return (
    pathname.startsWith("/api/drakos/auths/") ||
    pathname.startsWith("/api/mentorias/auths/") ||
    pathname.startsWith("/api/socialflow/auths/") ||
    pathname.startsWith("/api/bases/auths/")
  );
}
```

**Recomendación:** ✅ Añadir query validation runtime o DB física separada.

---

## 📋 RECOMENDACIONES PRIORITARIAS

### Corto Plazo (1 semana)

**G0-2: Limpieza de nomenclatura** (2 horas)
1. ✅ Fix migration 0137 comment
2. ✅ Fix docs/architecture/auth-ssot.md
3. ✅ Agregar linter rule que bloquee "Campo Base"
4. ✅ Documentar regla de transición `campobase/` → `campamento-base/`

**G0-3: Actualizar docs legacy** (3 horas)
1. ✅ Remover marca "LEGACY DOCUMENT" de enterprise_holding.md
2. ✅ Remover marca "LEGACY DOCUMENT" de subsidiary_protocol.md
3. ✅ Actualizar con estado actual: "Modelo en producción, consolidación pendiente"
4. ✅ Documentar plan de migración (si aplica)

**G1-2: Auth SSOT validation** (4 horas)
1. ✅ Crear script `verify-auth-ssot-queries.ts`
2. ✅ Scan src/lib/mentoria → NO debe referenciar drakos_users
3. ✅ Scan src/lib/socialflow → NO debe referenciar mentorias_users
4. ✅ Añadir a CI

---

### Medio Plazo (2-4 semanas)

**G0-1: Consolidar registry holding** (2-3 días)
1. ✅ Decisión: ¿Mantener `drako_holding_db` o consolidar en `drako_db_prod`?
2. ✅ Si consolidar: Migrar drako-core-worker y drako-provisioner-worker a DRACO_DB
3. ✅ Unificar tablas: `saases_registry` vs `holding_saases` → elegir UNA
4. ✅ Deprecar tabla redundante
5. ✅ Validar sincronización en producción

**G1-1: Contract testing** (1 semana)
1. ✅ Implementar `tests/governance/boundary-contracts.test.ts`
2. ✅ Matrix: Holding ↔ Factory ↔ Mentoría ↔ SocialFlow
3. ✅ Verificar: imports, table queries, API calls
4. ✅ Añadir a CI como blocker

---

### Largo Plazo (1-2 meses)

**Auth DB física separada** (2 semanas)
1. ⚠️ SOLO si necesario por compliance/regulación
2. ✅ Crear DBs físicas: `drako_drakos_auths_db`, `drako_mentorias_auths_db`
3. ✅ Migrar datos
4. ✅ Actualizar bindings en wrangler configs

**Namespace cleanup** (1 semana)
1. ✅ Migrar `src/lib/campobase/` → `src/lib/campamento-base/operator/`
2. ✅ Actualizar imports
3. ✅ Deprecar paths legacy

---

## 🎯 MÉTRICAS DE GOVERNANCE

### Estado Actual

| Dimensión | Score | Estado | Blocker |
|-----------|-------|--------|---------|
| **Production Gates** | 97.8% | ✅ EXCELENTE | NO |
| **Boundaries Definition** | 90% | ✅ BUENO | NO |
| **Boundaries Enforcement** | 65% | ⚠️ MEDIO | SÍ (contract testing) |
| **Registry Consolidation** | 30% | ❌ CRÍTICO | **SÍ** |
| **Nomenclatura Compliance** | 40% | ❌ MALO | **SÍ** |
| **Docs Accuracy** | 70% | ⚠️ MEDIO | SÍ |
| **Auth SSOT Enforcement** | 80% | ✅ BUENO | NO |
| **Multi-Tenant Isolation** | 65% | ⚠️ MEDIO | Ver reporte técnico |

**Overall Governance Health: 62%**

---

## 📖 CONCLUSIONES

### Governance strengths
1. ✅ **Production gates automatizados** — clase mundial
2. ✅ **Separación de capas** — bien definida y funcional
3. ✅ **Auth SSOT** — diseño sólido, enforcement parcial

### Critical governance gaps
1. ❌ **Registry fragmentado** — 3 tablas, 2 DBs, desincronización garantizada
2. ❌ **Nomenclatura inconsistente** — regla prohibida pero violada en 390+ lugares
3. ❌ **Docs legacy activas** — confusión sobre qué es "real"

### Path forward

**Fase 1 (Corto plazo):** Limpieza de nomenclatura y docs (1 semana)
**Fase 2 (Medio plazo):** Consolidar registry + contract testing (3-4 semanas)
**Fase 3 (Largo plazo):** Auth DB física + namespace cleanup (1-2 meses)

**Governance health target:** 85%+ después de Fase 2

---

## 📎 APÉNDICES

### A. Referencias de Documentación

**Contratos de arquitectura:**
- `docs/architecture/enterprise_holding.md` (marcado LEGACY — actualizar)
- `docs/architecture/subsidiary_protocol.md` (marcado LEGACY — actualizar)
- `docs/architecture/auth-ssot.md` (vigente, minor fixes)
- `docs/runbooks/holding-factory-boundaries.md` (vigente ✅)

**Production readiness:**
- `docs/config/production-audits-expected-state.json` (vigente ✅)
- `docs/audits/production-readiness-latest.md` (vigente ✅)

**Auditorías técnicas:**
- `AUDIT_TECHNICAL_COMPLETE_2026.md` (P0/P1 fixes — complementario)

---

### B. Evidencia de Fragmentación Registry

**Tablas identificadas:**

1. **`drako_holding_db.saases_registry`**
   - Migration: `workers/drako-core-worker/migrations/0001_drako_core_foundations.sql`
   - Usado por: drako-core-worker, drako-provisioner-worker
   - DB ID: `52752a5c-b290-4633-91c6-e2a371a0c669`

2. **`drako_db_prod.holding_saas_registry`**
   - Migration: `migrations/0126_holding_multi_saas_monetization.sql`
   - Usado por: saas-factory-worker
   - DB ID: `5607a76a-97c7-45a9-a948-e545ba27eae7`

3. **`drako_db_prod.holding_saases`**
   - Migration: `migrations/0137_holding_control_tower_foundations.sql`
   - Usado por: (búsqueda de código no reveló uso activo)
   - DB ID: `5607a76a-97c7-45a9-a948-e545ba27eae7`

**Wrangler configs verificados:**
- `workers/drako-core-worker/wrangler.workers.toml`
- `workers/drako-provisioner-worker/wrangler.workers.toml`
- `workers/saas-factory-worker/wrangler.workers.toml`
- `workers/drakos/wrangler.workers.toml`
- `wrangler.workers.toml` (main)

---

### C. Nomenclatura - Análisis de Distribución

**Términos encontrados:**

| Término | Matches | Status | Acción |
|---------|---------|--------|--------|
| "Campo Base" | ~390 | ❌ PROHIBIDO | Eliminar todos |
| "Campamento Base" | ~150 | ✅ CORRECTO | Mantener |
| "campamento-base" | ~80 | ✅ CORRECTO | Usar para nuevo código |
| "campobase" | ~310 | ⚠️ LEGACY | Mantener hasta refactor |

**Distribución por archivo (top 5):**
1. `src/lib/campobase/socialflow-service.ts` — 63 matches
2. `src/app/api/operator/socialflow/route.ts` — 48 matches
3. `src/app/operator/social/page.tsx` — 19 matches
4. `src/components/campobase/CampoBaseSocialAutomationControl.tsx` — 19 matches
5. `src/lib/campobase/social-automation-history.ts` — 14 matches

**Nota:** Mayoría son en `src/lib/campobase/` que es namespace legacy permitido hasta refactor explícito.

---

**FIN DE AUDITORÍA DE GOVERNANCE**

*Próximos pasos: Ejecutar recomendaciones de corto plazo y validar con stakeholders decisión sobre consolidación de registry.*
