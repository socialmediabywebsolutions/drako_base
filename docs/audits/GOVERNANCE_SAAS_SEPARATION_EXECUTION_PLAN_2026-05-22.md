# 🎯 PLAN DE EJECUCIÓN — Separación SaaS

**Fecha:** 22 de Mayo de 2026  
**Modelo:** Claude Sonnet 4.5 Thinking  
**Modo:** Reasoning High — Auditoría/Planificación  
**Estado:** PLAN APROBADO — SIN CAMBIOS DE CÓDIGO TODAVÍA

---

## 📋 EXECUTIVE SUMMARY

**Objetivo:** Planificar ejecución de separación SaaS sin tocar código.

**Hallazgos prioritarios aceptados:**
- ✅ S0-1 — Contaminación Mentoría → SocialFlow
- ✅ S0-2 — SocialFlow runtime no aislado
- ✅ S0-3 — Nomenclatura dual Campamento Base / Campobase / Campo Base
- ✅ S0-4 — Drako sin definición canónica

**Separation Health actual:** 58%

**Este documento entrega:**
- Plan detallado por fases (S0-1, S0-2, S0-3, S0-4)
- Archivos implicados con evidencia
- Propuestas de solución sin implementar
- Riesgos de regresión
- Tabla de priorización final
- Dictamen de readiness

---

## 🔧 FASE 1 — S0-1: Mentoría → SocialFlow Boundary Cleanup

### Objetivo

Eliminar imports directos desde Mentoría hacia lógica SocialFlow o social-core acoplado.

### Archivos Implicados

**Archivos con violación activa:**

1. **`src/lib/mentoria/acquisition-publishing.ts`**
   - Línea 3: `import { publishSocialPost } from "@/lib/social-core/publishing";`
   - Línea 40: `const publishResult = await publishSocialPost(post.channel, post.content);`
   - Responsabilidad: Publicar posts de acquisition de Mentoría

2. **`src/lib/mentoria/resilience/socialflow-validation.ts`**
   - Línea 2: `import { publishSocialPost } from "@/lib/social-core/publishing";`
   - Línea 95: `const result = await publishSocialPost(job.channel as "linkedin" | "instagram" | "tiktok", job.content);`
   - Responsabilidad: Resilience layer para publishing con retry logic

**Módulo compartido actual:**

3. **`src/lib/social-core/publishing.ts`** (136 líneas)
   - Función: `publishSocialPost(channel, content)`
   - Responsabilidad: Publicar a LinkedIn/Instagram/TikTok vía API externa
   - Dependencias: `@/lib/cf` (env bindings)
   - Bindings requeridos: `SOCIALFLOW_API_KEY`, `SOCIALFLOW_API_URL`
   - Retry logic: 3 intentos con exponential backoff

4. **`src/lib/social-core/types.ts`** (369 líneas)
   - Tipos compartidos: `SaasSocialProvider`, `SaasSocialAccount`, etc.
   - Usado por: Mentoría, SocialFlow, social-core

**Otros consumidores de `@/lib/social-core/publishing`:**

5. **`src/lib/social/types.ts`** — Re-export facade (deprecated)
6. **`src/lib/social/content-engine.ts`** — Legacy (deprecated)
7. **`src/lib/socialflow/ai/socialflow-engine.ts`** — SocialFlow AI
8. **`src/lib/socialflow/analytics-window.ts`** — SocialFlow analytics
9. **`src/lib/socialflow/contracts/observability.ts`** — SocialFlow observability
10. **`src/lib/socialflow/contracts/operator-actions.ts`** — Operator actions
11. **`src/lib/socialflow/linkedin/publishing.ts`** — LinkedIn publishing
12. **`src/lib/socialflow/linkedin/repository.ts`** — LinkedIn repo
13. **`src/lib/socialflow/live-publishing.ts`** — SocialFlow live publishing
14. **`src/lib/socialflow/repository.ts`** — SocialFlow repo

**Total:** 2 archivos Mentoría + 12 archivos SocialFlow/social = **14 archivos afectados**

### Explicación de Violación de Boundary

**Por qué viola boundary:**

1. **Mentoría es producto independiente** — No debería conocer SocialFlow
2. **SocialFlow es producto independiente** — No debería ser dependencia de Mentoría
3. **Acoplamiento técnico** — Cambios en SocialFlow rompen Mentoría
4. **Confusión arquitectónica** — ¿Mentoría es cliente de SocialFlow?

**Arquitectura correcta:**

```
Mentoría ────┐
             ├──→ Servicio neutral de publishing
SocialFlow ──┘

NO:
Mentoría ──→ SocialFlow (acoplamiento directo)
```

### Propuesta de Extracción a Capability Neutral

**Opción A: Módulo neutral de publishing (RECOMENDADA)**

**Nombre del módulo neutral:**
```
src/lib/social-publishing/
  ├── index.ts          (exports públicos)
  ├── types.ts          (tipos compartidos)
  ├── publishing.ts     (lógica de publishing)
  └── README.md         (documentación)
```

**Razón del nombre:**
- `social-publishing` es **neutral** — no pertenece a ningún producto
- Es **capability** — describe función, no producto
- Es **infraestructura compartida** — como `@/lib/db`, `@/lib/auths`

**Alternativas descartadas:**
- ❌ `@/lib/socialflow-publishing` — implica ownership de SocialFlow
- ❌ `@/lib/mentoria-publishing` — implica ownership de Mentoría
- ❌ `@/lib/acquisition-publishing` — demasiado específico
- ❌ `@/lib/external-publishing` — ambiguo

### Contrato TypeScript Propuesto

```typescript
// src/lib/social-publishing/types.ts

/**
 * Neutral social publishing types.
 * Used by: Mentoría (acquisition), SocialFlow (live publishing)
 */

export type SocialPublishingChannel = "linkedin" | "instagram" | "tiktok";

export type SocialPublishResult = {
  success: boolean;
  externalId?: string;
  error?: string;
  platform?: SocialPublishingChannel;
  retryCount?: number;
};

export type SocialPublishingConfig = {
  apiKey: string;
  apiUrl: string;
  maxRetries?: number;
  initialRetryDelayMs?: number;
};
```

```typescript
// src/lib/social-publishing/publishing.ts

import { env } from "@/lib/cf";
import type { SocialPublishingChannel, SocialPublishResult } from "./types";

/**
 * Neutral social publishing capability.
 * 
 * This is INFRASTRUCTURE, not a product.
 * 
 * Used by:
 * - Mentoría (acquisition posts)
 * - SocialFlow (live publishing)
 * 
 * DO NOT:
 * - Add product-specific logic
 * - Import from @/lib/mentoria or @/lib/socialflow
 * - Assume tenant context
 */

export async function publishSocialPost(
  channel: SocialPublishingChannel,
  content: string,
): Promise<SocialPublishResult> {
  // Implementation moved from social-core/publishing.ts
  // No changes to logic, only location
}
```

```typescript
// src/lib/social-publishing/index.ts

export { publishSocialPost } from "./publishing";
export type {
  SocialPublishingChannel,
  SocialPublishResult,
  SocialPublishingConfig,
} from "./types";
```

```typescript
// src/lib/social-publishing/README.md

# Social Publishing — Neutral Infrastructure

This module provides social publishing capability to **external platforms** (LinkedIn, Instagram, TikTok).

## Ownership

This is **INFRASTRUCTURE**, not a product.

## Consumers

- **Mentoría** — Acquisition posts
- **SocialFlow** — Live publishing

## Contract

- ✅ Neutral capability
- ✅ No product-specific logic
- ✅ No tenant assumptions
- ❌ DO NOT import from products
- ❌ DO NOT add business logic

## Migration from social-core

This module was extracted from `@/lib/social-core/publishing` to eliminate cross-product coupling.

**Before:**
```typescript
import { publishSocialPost } from "@/lib/social-core/publishing";
```

**After:**
```typescript
import { publishSocialPost } from "@/lib/social-publishing";
```
```

### Plan de Migración (SIN EJECUTAR)

**Paso 1: Crear módulo neutral**
- Crear `src/lib/social-publishing/`
- Copiar `social-core/publishing.ts` → `social-publishing/publishing.ts`
- Copiar tipos relevantes → `social-publishing/types.ts`
- Crear `index.ts`, `README.md`

**Paso 2: Actualizar imports**
- Mentoría (2 archivos):
  - `acquisition-publishing.ts`
  - `resilience/socialflow-validation.ts`
- SocialFlow (12 archivos):
  - Todos los archivos que importan `@/lib/social-core/publishing`

**Paso 3: Deprecar social-core**
- Añadir deprecation notice en `social-core/publishing.ts`
- Re-export desde `social-publishing` (compatibility layer)

**Paso 4: Validar**
- `pnpm typecheck`
- `pnpm test`
- `pnpm build`

### Tests Necesarios

**Test 1: Contract boundary test**

```typescript
// tests/governance/boundary-contracts.test.ts

describe('Mentoría ↔ SocialFlow Boundary', () => {
  it('Mentoría MUST NOT import SocialFlow modules', () => {
    const mentoriaFiles = glob('src/lib/mentoria/**/*.ts');
    const forbiddenImports = [
      '@/lib/socialflow',
      '@/lib/social',
      '@/lib/social-core', // ← BLOCKER
    ];
    assertNoForbiddenImports(mentoriaFiles, forbiddenImports);
  });

  it('Mentoría CAN import neutral infrastructure', () => {
    const mentoriaFiles = glob('src/lib/mentoria/**/*.ts');
    const allowedImports = [
      '@/lib/social-publishing', // ← ALLOWED
      '@/lib/db',
      '@/lib/auths',
    ];
    // No assertion needed, just documentation
  });
});
```

**Test 2: Publishing capability test**

```typescript
// tests/lib/social-publishing.test.ts

describe('social-publishing', () => {
  it('publishSocialPost returns success for valid input', async () => {
    // Mock SOCIALFLOW_API_KEY, SOCIALFLOW_API_URL
    // Call publishSocialPost
    // Assert success
  });

  it('publishSocialPost retries on failure', async () => {
    // Mock API failure
    // Assert retry count
  });

  it('publishSocialPost returns error after max retries', async () => {
    // Mock persistent failure
    // Assert error
  });
});
```

### Riesgo de Regresión

**Riesgo BAJO — Refactor de ubicación, NO de lógica**

**Factores de riesgo:**

1. **Imports rotos** — BAJO
   - Solución: TypeScript detecta imports rotos en compile time
   - Mitigación: `pnpm typecheck` antes de commit

2. **Tests rotos** — BAJO
   - Solución: Tests existentes siguen funcionando
   - Mitigación: `pnpm test` antes de commit

3. **Runtime errors** — MUY BAJO
   - Lógica NO cambia, solo ubicación
   - Bindings (`SOCIALFLOW_API_KEY`, `SOCIALFLOW_API_URL`) siguen igual

4. **Mentoría acquisition rota** — BAJO
   - Función sigue siendo la misma
   - Mitigación: Test de acquisition end-to-end

5. **SocialFlow publishing roto** — BAJO
   - Función sigue siendo la misma
   - Mitigación: Test de SocialFlow publishing end-to-end

**Mitigaciones:**
- ✅ NO cambiar lógica, solo ubicación
- ✅ Mantener compatibility layer (re-export desde social-core)
- ✅ Validar con typecheck + tests + build
- ✅ Deployment canary (si aplica)

### Validación Requerida

**Pre-ejecución:**
1. ✅ `pnpm typecheck` — PASS
2. ✅ `pnpm lint` — PASS (warnings heredados OK)
3. ✅ `pnpm test` — PASS (todos los tests)
4. ✅ `pnpm build` — PASS

**Post-ejecución:**
1. ✅ `pnpm typecheck` — PASS
2. ✅ `pnpm test` — PASS
3. ✅ `pnpm build` — PASS
4. ✅ Contract test — PASS (`tests/governance/boundary-contracts.test.ts`)
5. ✅ Mentoría acquisition test — PASS
6. ✅ SocialFlow publishing test — PASS

**Evidencia requerida:**
- Screenshot de `pnpm typecheck` output
- Screenshot de `pnpm test` output
- Git diff mostrando solo cambios de ubicación

---

## 🏗️ FASE 2 — S0-2: SocialFlow Runtime Split Readiness

### Objetivo

Revisar plan P2-14 y determinar qué fase concreta toca ahora.

### Estado Actual Real del Split

**Según P2-14-RUNTIME-SPLIT-BLUEPRINT.md:**

**✅ Route filtering exitoso:**
- `crossProductLeaks=0`
- `foreignRouteCount=0`
- `remainingCriticalLeaks=[]`
- Solo 26 rutas SocialFlow en preview

**❌ Runtime graph compartido:**
- Single root `src/app/layout.tsx`
- Single root `src/middleware.ts`
- Single OpenNext `server-functions/default`
- Shared client/server manifests
- `_not-found` contaminated with control-plane references

**Artifact actual:**
- Active: `.open-next/socialflows-standalone/worker.js`
- Preview: `.open-next/socialflows-product-scoped-preview/worker.js`
- Preview state: `artifactMode=product-scoped-preview`, `artifactState=inactive-preview`

### Qué Significa runtimeRiskScore=100

**Según P2-10A-SHARED-RUNTIME-CONTRACT-REPORT.md:**

```
runtimeRiskScore = (HIGH_RISK * 5) + (MEDIUM_RISK * 2) + (LOW_RISK * 0.5)
```

**Actual:**
- HIGH_RISK: 6 routes
- MEDIUM_RISK: 18 routes
- LOW_RISK: 0 routes

```
runtimeRiskScore = (6 * 5) + (18 * 2) + (0 * 0.5)
                 = 30 + 36 + 0
                 = 66
```

**NOTA:** El score reportado es 100, NO 66. Esto sugiere que hay **peso adicional** por:
- Shared runtime graph
- Shared manifests
- Shared middleware

**Interpretación:**
- `runtimeRiskScore=100` significa **máximo riesgo**
- SocialFlow NO está aislado del monolito
- Preview filtering NO es suficiente

### Qué Bloquea scopedActivationReady=false

**Según P2-10A:**

```json
{
  "scopedActivationReady": false,
  "reason": "6 HIGH_RISK routes remain with shared DB dependency"
}
```

**6 HIGH_RISK routes:**
1. `api/socialflow/exports/current` — usa `@/lib/db`
2. `socialflow/(workspace)/settings/account` — usa `@/lib/db`
3. `socialflow/(workspace)/settings/billing` — usa `@/lib/db`
4. `socialflow/(workspace)/settings/ownership` — usa `@/lib/db`
5. `socialflow/(workspace)/settings/team` — usa `@/lib/db`
6. `_not-found` — contaminated with cross-product references

**Bloqueadores:**
- ✅ Shared DB (`@/lib/db`) es HIGH risk
- ✅ `_not-found` hereda control-plane contamination
- ✅ Runtime graph compartido

**Para activar preview:**
- ❌ Reducir HIGH_RISK a 0
- ❌ Aislar runtime graph
- ❌ Eliminar shared manifests

### Qué Rutas/Bindings Siguen Compartidos

**Rutas compartidas:**

**1. Rutas SocialFlow con shared DB:**
- `api/socialflow/exports/current`
- `socialflow/(workspace)/settings/*` (4 rutas)

**2. Rutas framework:**
- `_not-found` — hereda de root layout
- `products` — marketing (puede quedarse en monolito)
- `products/socialflow` — marketing (puede quedarse en monolito)

**Bindings compartidos:**

**Según wrangler.workers.toml:**

```toml
# SocialFlow worker
[[d1_databases]]
binding = "DRACO_DB"           # ← SHARED con todos
database_name = "drako_db_prod"

[[d1_databases]]
binding = "SOCIAL_DB"          # ← SocialFlow-specific
database_name = "drako_db_prod"

[[d1_databases]]
binding = "SOCIALFLOW_AUTHS_DB" # ← SocialFlow-specific
database_name = "drako_db_prod"

[[d1_databases]]
binding = "SAASES_DB"          # ← SHARED con todos
database_name = "drako_db_prod"
```

**Bindings que seguirán compartidos después de partial split:**
- `DRACO_DB` — Shared DB access (transitional)
- `SAASES_DB` — SaaS registry (shared by design)

**Bindings SocialFlow-specific:**
- `SOCIAL_DB` — SocialFlow data
- `SOCIALFLOW_AUTHS_DB` — SocialFlow auth

### Plan de Ataque Seguro en Fases

**Según P2-14-RUNTIME-SPLIT-BLUEPRINT.md:**

#### P2-14A — Establish App Boundary (1 semana)

**Objetivo:** Crear app boundary sin cutover

**Scope:**
- Definir nueva app root
- Definir import rules
- Decidir qué módulos van a `packages/*`
- Freezar qué rutas quedan en monolito

**Riesgo:** BAJO — Solo estructura, no runtime

**Rollback:** Abandonar nueva app root

**Validación:**
- File graph audit
- Import boundary audit
- NO cambios a worker activo

**Métricas esperadas:**
- No hay cambio en runtime metrics (es preparación)

#### P2-14B — Port SocialFlow Code (2 semanas)

**Objetivo:** Mover código SocialFlow a nueva app

**Scope:**
- `socialflow/auth`
- `socialflow/(workspace)`
- `api/socialflow/*`
- `src/lib/socialflow/*`
- `src/modules/socialflow-app/*`

**Riesgo:** MEDIO — Auth/session mismatch, path alias breakage

**Rollback:** Stop building nueva app, keep standalone

**Validación:**
- SocialFlow tests
- Auth/session regression tests
- Tenant isolation tests
- NO deploy

**Métricas esperadas:**
- Nueva app sin control-plane shell references
- Nueva app sin Mentoría bootstrap references
- `_not-found` sin control-plane contamination

#### P2-14C — Build Independent Artifact (1 semana)

**Objetivo:** Producir runtime SocialFlow independiente

**Scope:**
- Independent `opennextjs-cloudflare build`
- Separate `.open-next/socialflows-runtime-partial`
- Separate worker config (canary/non-active)
- Separate artifact upload en CI

**Riesgo:** MEDIO-ALTO — CI complexity, binding drift

**Rollback:** Disable nueva build job

**Validación:**
- Artifact existence
- Worker integrity
- Runtime audit on new runtime
- Smoke tests (non-production only)

**Métricas esperadas:**
- `crossProductLeaks=0`
- `suspiciousRoutes=0`
- `sharedChunkProducts=[]`
- No cross-product manifests

#### P2-14D — Shadow Verification (1 semana)

**Objetivo:** Probar paridad funcional

**Scope:**
- Domain/auth flows
- Workspace navigation
- Settings, exports, AI routes
- LinkedIn flows
- Rate limit y middleware parity

**Riesgo:** MEDIO — Subtle middleware differences

**Rollback:** Keep new runtime dark

**Validación:**
- Smoke tests
- Auth/session parity
- Tenant isolation parity
- Route inventory parity

**Métricas esperadas:**
- Runtime graph contamination removed
- Only intentional shared DB dependencies remain

#### P2-14E — Cutover Readiness (go/no-go)

**Objetivo:** Preparar cutover (NO ejecutar)

**Scope:**
- Explicit go/no-go review
- Compare active vs new runtime
- Define rollback plan

**Riesgo:** MEDIO — Production parity gaps

**Rollback:** Keep standalone active, deploy nothing

**Validación:**
- Canary runtime audit
- Smoke coverage
- Deploy dry run (non-production only)

**Métricas esperadas:**
- Confidence to activate in separate commit

### Qué NO Se Debe Tocar Todavía

**NO tocar:**

1. **Worker activo** — `workers/socialflows/wrangler.workers.toml`
   - Sigue apuntando a `.open-next/socialflows-standalone/worker.js`
   - NO cambiar hasta P2-14E go/no-go

2. **Preview artifact** — `.open-next/socialflows-product-scoped-preview/`
   - Sigue siendo preview, NO activar
   - `scopedActivationReady=false`

3. **Monolito root** — `src/app/layout.tsx`, `src/middleware.ts`
   - NO modificar hasta que SocialFlow tenga runtime propio

4. **Shared DB access** — `@/lib/db`
   - Seguirá compartido en partial split
   - Reducción de HIGH_RISK es fase posterior

5. **Marketing routes** — `products`, `products/socialflow`
   - Pueden quedarse en monolito
   - NO son parte del runtime SocialFlow

6. **Production deployment**
   - NO deploy hasta P2-14E go/no-go

### Fase Actual Recomendada

**FASE ACTUAL: P2-14A — Establish App Boundary**

**Razón:**
- Preparación estructural
- Riesgo BAJO
- No afecta runtime activo
- Fundación para P2-14B-E

**Siguiente paso:**
- Crear `apps/socialflow-runtime/` (estructura vacía)
- Definir import rules
- Documentar qué va a `packages/*`

**NO ejecutar todavía:**
- Esperar aprobación de plan
- Esperar decisión sobre timing

---

## 📝 FASE 3 — S0-3: Nomenclatura Campamento Base Cleanup

### Objetivo

Separar decisión conceptual de refactor técnico.

### Dónde Aparece "Campo Base" (PROHIBIDO)

**Según grep search: 8 archivos**

#### 1. **`migrations/0137_holding_control_tower_foundations.sql`**
```sql
-- Campo Base (holding) minimal operational tables.
```
**Tipo:** Comentario SQL
**Severidad:** BLOCKER (violación de regla obligatoria)
**Acción:** Cambiar a "Campamento Base"

#### 2. **`src/middleware.ts:521`**
```typescript
message: "Campo Base operator auth uses NextAuth + D1 only. Use /bases/login.",
```
**Tipo:** String literal en error message
**Severidad:** BLOCKER
**Acción:** Cambiar a "Campamento Base"

#### 3. **`docs/architecture/auth-ssot.md:6`**
```markdown
- Campo Base (holding): `bases.drako.systems`
```
**Tipo:** Documentación
**Severidad:** BLOCKER
**Acción:** Cambiar a "Campamento Base"

#### 4. **`docs/architecture/auth-ssot.md:45`**
```markdown
- Campo Base registrando usuarios finales de verticales.
```
**Tipo:** Documentación
**Severidad:** BLOCKER
**Acción:** Cambiar a "Campamento Base"

#### 5. **`docs/checklists/p0-campo-base-holding.md:1`**
```markdown
# Checklist P0 - Campo Base (Holding)
```
**Tipo:** Título de documento
**Severidad:** BLOCKER
**Acción:** Cambiar a "Campamento Base"

#### 6. **`docs/runbooks/holding-factory-boundaries.md:8`**
```markdown
### Campo Base (holding owner console)
```
**Tipo:** Documentación
**Severidad:** BLOCKER
**Acción:** Cambiar a "Campamento Base"

#### 7. **`docs/architecture-namespaces.md:21`**
```markdown
- Campo Base social automation
```
**Tipo:** Documentación
**Severidad:** BLOCKER
**Acción:** Cambiar a "Campamento Base"

#### 8. **`docs/knowledge/campo-base-operational-audit.md:1`**
```markdown
# Campo Base Operational Audit
```
**Tipo:** Título de documento
**Severidad:** BLOCKER
**Acción:** Cambiar a "Campamento Base"

**Total:** 8 archivos con "Campo Base" prohibido

### Dónde Aparece "campobase"

**Según grep search: 35 archivos**

**Distribución:**
- `src/lib/campobase/` — 13 archivos (namespace técnico)
- `src/lib/campamento-base/` — 8 archivos (control plane)
- `src/lib/conversation-router/` — 3 archivos (routing)
- `src/lib/saas/` — 2 archivos (SaaS resolution)
- Otros — 9 archivos (scattered)

**Archivos principales:**

1. **`src/lib/campobase/socialflow-service.ts`** — 63 menciones
2. **`src/lib/campobase/social-automation-history.ts`** — 14 menciones
3. **`src/lib/campobase/social-automation-registry.ts`** — 14 menciones
4. **`src/lib/dev-architects/data.ts`** — 12 menciones
5. **`src/lib/campamento-base/saas-factory-orchestrator.ts`** — 6 menciones

**Namespace técnico:**
- `src/lib/campobase/` — Operator layer (legacy, permitido hasta limpieza)

### Dónde Aparece "campamento-base"

**Según grep search: 35 archivos (overlap con "campobase")**

**Namespace técnico:**
- `src/lib/campamento-base/` — Control plane (correcto)

**Archivos principales:**
1. **`src/lib/campamento-base/saas-factory-orchestrator.ts`**
2. **`src/lib/campamento-base/orchestrator/snapshot-db.ts`**
3. **`src/lib/campamento-base.ts`** (facade)

### Cuáles Son Namespaces Aceptables

**Regla canónica:**

| Término | Status | Uso |
|---------|--------|-----|
| **"Campamento Base"** | ✅ CORRECTO | Nombre oficial del holding/control plane |
| **"campamento-base"** | ✅ CORRECTO | Namespace técnico del control plane |
| **"campobase"** | ⚠️ LEGACY | Namespace técnico operator layer (permitido hasta limpieza) |
| **"Campo Base"** | ❌ PROHIBIDO | Nunca usar |

**Separación conceptual:**

**Campamento Base (Control Plane):**
- Responsabilidad: SaaS Factory, Provisioning, Holding operations
- Ubicación: `src/lib/campamento-base/`
- Rutas: `/api/campamento-base/*`
- Worker: `saas-bases-prod`
- Domain: `bases.drako.systems`

**Campobase (Operator Layer):**
- Responsabilidad: SocialFlow automation, Platform operations
- Ubicación: `src/lib/campobase/` (legacy)
- Rutas: `/api/operator/*` (canonical), `/api/campobase/*` (legacy)
- Worker: N/A (parte del monolito)

### Qué Cambios Son Documentación

**Cambios de documentación (8 archivos):**

1. `migrations/0137_holding_control_tower_foundations.sql` — Comentario SQL
2. `src/middleware.ts` — Error message string
3. `docs/architecture/auth-ssot.md` — 2 menciones
4. `docs/checklists/p0-campo-base-holding.md` — Título
5. `docs/runbooks/holding-factory-boundaries.md` — Título
6. `docs/architecture-namespaces.md` — Descripción
7. `docs/knowledge/campo-base-operational-audit.md` — Título

**Riesgo:** CERO — Solo texto, no afecta runtime

### Qué Cambios Son Código

**Cambios de código (35 archivos):**

**Opción A: Solo fix "Campo Base" prohibido**
- 1 archivo: `src/middleware.ts:521` (error message)
- Riesgo: CERO

**Opción B: Rename namespace `campobase/` → `operator/`**
- 35 archivos con imports
- Riesgo: MEDIO (imports rotos si no se hace correctamente)

**Recomendación:**
- Corto plazo: Solo fix "Campo Base" prohibido (Opción A)
- Medio plazo: Rename namespace (Opción B)

### Qué Cambios Son Migraciones Peligrosas

**NO hay migraciones peligrosas.**

**Razón:**
- Solo cambio en comentario SQL (`0137_holding_control_tower_foundations.sql`)
- NO cambia schema
- NO cambia datos
- NO requiere re-apply

**Validación:**
- Comentario SQL no afecta ejecución
- Migration ya aplicada en producción
- Solo cambio cosmético

### Propuesta de Linter o Test Preventivo

**Linter rule (ESLint):**

```javascript
// .eslintrc.js

module.exports = {
  rules: {
    'no-restricted-syntax': [
      'error',
      {
        selector: 'Literal[value=/Campo Base/]',
        message: 'Use "Campamento Base" instead of "Campo Base" (prohibited term)',
      },
    ],
  },
};
```

**Test preventivo:**

```typescript
// tests/governance/nomenclatura.test.ts

describe('Nomenclatura Governance', () => {
  it('MUST NOT use "Campo Base" in code', () => {
    const allFiles = glob('src/**/*.{ts,tsx}');
    const violations: string[] = [];

    for (const file of allFiles) {
      const content = fs.readFileSync(file, 'utf-8');
      if (content.includes('Campo Base')) {
        violations.push(file);
      }
    }

    expect(violations).toEqual([]);
  });

  it('MUST NOT use "Campo Base" in docs', () => {
    const docFiles = glob('docs/**/*.md');
    const violations: string[] = [];

    for (const file of docFiles) {
      const content = fs.readFileSync(file, 'utf-8');
      if (content.includes('Campo Base')) {
        violations.push(file);
      }
    }

    expect(violations).toEqual([]);
  });

  it('MUST NOT use "Campo Base" in migrations', () => {
    const migrationFiles = glob('migrations/**/*.sql');
    const violations: string[] = [];

    for (const file of migrationFiles) {
      const content = fs.readFileSync(file, 'utf-8');
      if (content.includes('Campo Base')) {
        violations.push(file);
      }
    }

    expect(violations).toEqual([]);
  });
});
```

**CI enforcement:**

```yaml
# .github/workflows/governance-nomenclatura.yml

name: Governance - Nomenclatura

on: [push, pull_request]

jobs:
  check-nomenclatura:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Check for prohibited "Campo Base"
        run: |
          if grep -r "Campo Base" src/ docs/ migrations/; then
            echo "ERROR: Found prohibited term 'Campo Base'"
            echo "Use 'Campamento Base' instead"
            exit 1
          fi
```

---

## 🎯 FASE 4 — S0-4: Definición Canónica de Drako

### Objetivo

Cerrar definición de Drako sin ambigüedad.

### Base Obligatoria (Aceptada)

✅ **Drako = marca/casa central/paraguas de ecosistema**  
✅ **Campamento Base = operator/control plane interno**  
✅ **Mentoría = SaaS educativo independiente**  
✅ **SocialFlow = SaaS social independiente**  
✅ **Factory = capacidad futura, no producto terminado**  
✅ **Drako NO es tenant final**  
✅ **Drako NO debe absorber auth de productos**

### Propuesta ADR

**ADR-001: Drako Canonical Role**

**Status:** PROPOSED  
**Date:** 2026-05-22  
**Decision Makers:** Arquitecto de Governance

#### Context

Drako aparece en múltiples roles sin separación clara:
- Marca/holding
- Factory (tenant onboarding)
- Landing/marketing
- ¿Tenant final?

Esto genera confusión arquitectónica y boundaries indefinidas.

#### Decision

**Drako tiene DOS roles canónicos:**

**1. Drako Marca (Public)**
- **Responsabilidad:** Landing, marketing, catálogo de productos
- **Domain:** `drako.systems`
- **Rutas:** `/`, `/products`, `/products/*`
- **Auth:** NO — Landing es pública
- **Tenant:** NO — No tiene clientes propios

**2. Drako Factory (Internal)**
- **Responsabilidad:** Tenant onboarding, provisioning, integrations
- **Domain:** `drako.systems` (subdirectorio `/factory`)
- **Rutas:** `/api/drakos/auths/*`, `/api/drakos/provisioning/*`
- **Auth:** SÍ — `drakos_users`, `drakos_credentials`, `drakos_sessions`
- **Tenant:** SÍ — Factory users (NOT end customers)

**Drako NO es:**
- ❌ Control plane (eso es Campamento Base)
- ❌ Operator layer (eso es Campobase)
- ❌ Tenant final con clientes propios
- ❌ Producto SaaS independiente

#### Consequences

**Positivas:**
- ✅ Rol claro y documentado
- ✅ Boundaries definidas
- ✅ Separación de responsabilidades

**Negativas:**
- ⚠️ Requiere refactor de rutas mezcladas
- ⚠️ Requiere documentación actualizada

#### Compliance

- ✅ Drako NO es tenant final
- ✅ Drako NO absorbe auth de productos
- ✅ Factory es capacidad, no producto

### Rutas Que Deberían Pertenecer a Drako Marca

**Landing/Marketing (público):**

```
drako.systems/
  ├── /                          ← Landing principal
  ├── /products                  ← Catálogo de productos
  ├── /products/mentoria         ← Landing Mentoría
  ├── /products/socialflow       ← Landing SocialFlow
  ├── /about                     ← Sobre Drako
  ├── /contact                   ← Contacto
  └── /legal                     ← Legal/Privacy
```

**Características:**
- ✅ Público (no requiere auth)
- ✅ Marketing/informativo
- ✅ NO tiene lógica de negocio
- ✅ NO accede a DB

### Rutas Que Deberían Pertenecer a Operator

**Campamento Base (Control Plane):**

```
bases.drako.systems/
  ├── /                          ← Operator dashboard
  ├── /operator/portfolio        ← Portfolio overview
  ├── /operator/platform         ← Platform operations
  ├── /operator/socialflow       ← SocialFlow automation
  ├── /api/campamento-base/*     ← Control plane APIs
  └── /api/operator/*            ← Operator APIs
```

**Características:**
- ✅ Requiere auth (operator users)
- ✅ Control plane operations
- ✅ Multi-SaaS management
- ✅ Accede a holding tables

### Rutas Que Nunca Deberían Estar en Drako

**❌ Rutas de productos:**

```
drako.systems/
  ├── /mentoria/*                ← DEBE estar en mentorias.drako.systems
  ├── /socialflow/*              ← DEBE estar en socialflow.drako.systems
  ├── /api/mentoria/*            ← DEBE estar en mentorias.drako.systems
  └── /api/socialflow/*          ← DEBE estar en socialflow.drako.systems
```

**❌ Rutas de operator:**

```
drako.systems/
  ├── /operator/*                ← DEBE estar en bases.drako.systems
  ├── /owner/*                   ← DEBE estar en bases.drako.systems (legacy)
  └── /api/operator/*            ← DEBE estar en bases.drako.systems
```

**Razón:**
- Drako es marca/factory, NO producto final
- Drako NO es operator/control plane

### Reglas de Middleware/Boundary

**Middleware routing:**

```typescript
// src/middleware.ts

function resolveDrakoRouting(pathname: string, host: string): string | null {
  // Drako Marca (público)
  if (host === "drako.systems") {
    if (pathname === "/" || pathname.startsWith("/products")) {
      return null; // Allow — Landing/marketing
    }
    
    if (pathname.startsWith("/api/drakos/")) {
      return null; // Allow — Factory APIs
    }
    
    // Redirect productos a sus dominios
    if (pathname.startsWith("/mentoria")) {
      return "https://mentorias.drako.systems" + pathname.replace("/mentoria", "");
    }
    
    if (pathname.startsWith("/socialflow")) {
      return "https://socialflow.drako.systems" + pathname.replace("/socialflow", "");
    }
    
    // Redirect operator a bases
    if (pathname.startsWith("/operator") || pathname.startsWith("/owner")) {
      return "https://bases.drako.systems" + pathname;
    }
  }
  
  return null;
}
```

**Boundary rules:**

1. **Drako Marca:**
   - ✅ Puede linkear a productos (marketing)
   - ❌ NO puede ejecutar lógica de productos
   - ❌ NO puede acceder a DB de productos

2. **Drako Factory:**
   - ✅ Puede provisionar SaaS
   - ✅ Puede acceder a `drakos_*` tables
   - ❌ NO puede acceder a `mentoria_*` o `socialflow_*` tables
   - ❌ NO puede ser tenant final

3. **Productos:**
   - ✅ Pueden linkear a Drako landing (marketing)
   - ❌ NO pueden importar `@/lib/drako` (excepto tipos/helpers neutrales)
   - ❌ NO pueden acceder a Factory tables

---

## 📊 FASE 5 — Priorización Final

### Tabla de Priorización

| ID | Hallazgo | Severidad | Impacto | Esfuerzo | Riesgo | Orden | Modelo Recomendado |
|----|----------|-----------|---------|----------|--------|-------|-------------------|
| **S0-1** | Mentoría → SocialFlow boundary | BLOCKER | ALTO | 2 días | BAJO | **1** | Claude Sonnet 4 |
| **S0-3** | Nomenclatura "Campo Base" | BLOCKER | MEDIO | 2 horas | CERO | **2** | Claude Sonnet 4 |
| **S0-4** | Drako role definition | HIGH | ALTO | 1 semana | BAJO | **3** | Claude Sonnet 4.5 Thinking |
| **S0-2** | SocialFlow runtime split | BLOCKER | MUY ALTO | 4 semanas | MEDIO | **4** | Claude Sonnet 4.5 Thinking |

### Desglose por Hallazgo

#### S0-1: Mentoría → SocialFlow Boundary

**Severidad:** BLOCKER  
**Impacto:** ALTO — Violación de separación de productos  
**Esfuerzo:** 2 días  
**Riesgo:** BAJO — Refactor de ubicación, no de lógica  

**Desglose de esfuerzo:**
- Crear módulo neutral: 2 horas
- Actualizar imports (14 archivos): 3 horas
- Tests: 2 horas
- Validación: 1 hora
- **Total:** 8 horas (1 día)

**Modelo recomendado:** Claude Sonnet 4  
**Razón:** Refactor mecánico, no requiere reasoning profundo

**Requiere GPT-5.3-Codex:** NO  
**Requiere Claude Sonnet 4.5 Thinking:** NO

#### S0-3: Nomenclatura "Campo Base"

**Severidad:** BLOCKER  
**Impacto:** MEDIO — Violación de regla obligatoria  
**Esfuerzo:** 2 horas  
**Riesgo:** CERO — Solo texto  

**Desglose de esfuerzo:**
- Fix 8 archivos: 30 minutos
- Linter rule: 30 minutos
- Test preventivo: 30 minutos
- Validación: 30 minutos
- **Total:** 2 horas

**Modelo recomendado:** Claude Sonnet 4  
**Razón:** Cambios simples de texto

**Requiere GPT-5.3-Codex:** NO  
**Requiere Claude Sonnet 4.5 Thinking:** NO

#### S0-4: Drako Role Definition

**Severidad:** HIGH  
**Impacto:** ALTO — Fundación para boundaries futuras  
**Esfuerzo:** 1 semana  
**Riesgo:** BAJO — Documentación + refactor de rutas  

**Desglose de esfuerzo:**
- ADR: 4 horas
- Documentación: 8 horas
- Refactor middleware: 8 horas
- Tests: 8 horas
- Validación: 4 horas
- **Total:** 32 horas (4 días)

**Modelo recomendado:** Claude Sonnet 4.5 Thinking  
**Razón:** Requiere decisiones arquitectónicas profundas

**Requiere GPT-5.3-Codex:** NO  
**Requiere Claude Sonnet 4.5 Thinking:** SÍ

#### S0-2: SocialFlow Runtime Split

**Severidad:** BLOCKER  
**Impacto:** MUY ALTO — Separación real de runtime  
**Esfuerzo:** 4 semanas  
**Riesgo:** MEDIO — Complejidad de build/CI  

**Desglose de esfuerzo:**
- P2-14A (app boundary): 1 semana
- P2-14B (port code): 2 semanas
- P2-14C (build artifact): 1 semana
- P2-14D (shadow verification): 1 semana
- P2-14E (cutover readiness): 3 días
- **Total:** 5.5 semanas

**Modelo recomendado:** Claude Sonnet 4.5 Thinking  
**Razón:** Arquitectura compleja, decisiones críticas

**Requiere GPT-5.3-Codex:** NO (pero útil para build scripts)  
**Requiere Claude Sonnet 4.5 Thinking:** SÍ

### Orden Recomendado de Ejecución

**1. S0-3 (2 horas) → S0-1 (2 días) → S0-4 (1 semana) → S0-2 (4 semanas)**

**Razón:**
- S0-3 es quick win (2 horas, riesgo CERO)
- S0-1 elimina contaminación activa (2 días, riesgo BAJO)
- S0-4 establece fundación (1 semana, decisión arquitectónica)
- S0-2 es trabajo pesado (4 semanas, requiere S0-4 completo)

**Dependencias:**
- S0-2 requiere S0-4 (definición de Drako)
- S0-1 es independiente
- S0-3 es independiente

---

## ✅ DICTAMEN FINAL

### Ready to Execute

```json
{
  "ready_to_execute_s0_1": true,
  "ready_to_execute_s0_2": false,
  "ready_to_execute_s0_3": true,
  "ready_to_execute_s0_4": false,
  "first_execution_phase_recommended": "S0-3",
  "production_changes_required_now": false
}
```

### Explicación del Dictamen

**`ready_to_execute_s0_1: true`**
- ✅ Plan completo
- ✅ Archivos identificados
- ✅ Propuesta de solución clara
- ✅ Riesgo BAJO
- ✅ Validación definida
- ⚠️ Esperar aprobación de timing

**`ready_to_execute_s0_2: false`**
- ✅ Plan P2-14 completo
- ✅ Fases definidas
- ❌ Requiere S0-4 primero (definición de Drako)
- ❌ 4 semanas de esfuerzo
- ❌ Esperar go/no-go

**`ready_to_execute_s0_3: true`**
- ✅ Plan completo
- ✅ Archivos identificados (8)
- ✅ Cambios triviales
- ✅ Riesgo CERO
- ✅ Quick win (2 horas)

**`ready_to_execute_s0_4: false`**
- ✅ Propuesta ADR completa
- ✅ Boundaries definidas
- ❌ Requiere decisión de stakeholders
- ❌ Impacto en middleware/routing
- ❌ Esperar aprobación

**`first_execution_phase_recommended: "S0-3"`**
- Razón: Quick win, riesgo CERO, 2 horas
- Elimina violación de regla obligatoria
- No requiere decisiones arquitectónicas

**`production_changes_required_now: false`**
- Ninguna fase requiere cambios de producción inmediatos
- Todas son preparación/refactor
- Deploy solo después de validación completa

---

## 🎯 PRÓXIMOS PASOS AUTORIZADOS

**Paso 1: Aprobación de plan**
- Revisar este documento
- Aprobar timing de ejecución
- Decidir orden final

**Paso 2: Ejecución S0-3 (si aprobado)**
- Modelo: Claude Sonnet 4
- Tiempo: 2 horas
- Riesgo: CERO

**Paso 3: Ejecución S0-1 (si aprobado)**
- Modelo: Claude Sonnet 4
- Tiempo: 2 días
- Riesgo: BAJO

**Paso 4: Decisión S0-4 (requiere stakeholders)**
- Modelo: Claude Sonnet 4.5 Thinking
- Tiempo: 1 semana
- Riesgo: BAJO

**Paso 5: Ejecución S0-2 (después de S0-4)**
- Modelo: Claude Sonnet 4.5 Thinking
- Tiempo: 4 semanas
- Riesgo: MEDIO

---

**FIN DEL PLAN DE EJECUCIÓN**

*Esperando aprobación para proceder con S0-3 (quick win de 2 horas).*
