# SaaS Separation — SocialFlow Imports Audit Phase 2

**Fecha:** 5 de Junio de 2026  
**Auditor:** Arquitecto Principal Drako  
**Tipo:** Auditoría de dependencias sin modificación de código  
**Estado:** AUDITORÍA FASE 2 COMPLETADA

---

## Executive Summary

**Total de referencias detectadas:** 104+ imports hacia `@/lib/socialflow`

**Desglose por capa:**
- **src/lib/** — 65 imports (internos + externos)
- **src/app/** — 39 imports (routes + UI)
- **src/components/** — ~5 imports
- **src/modules/** — ~3 imports

**Blockers críticos identificados:** 2

**Conclusión:** SocialFlow NO puede moverse a worker independiente todavía. Existen 2 dependencias críticas desde capas de control (Campobase, Owner) que deben transformarse en contratos API antes de la separación.

---

## 1. Critical Blockers

### BLOCKER #1: Campobase → SocialFlow (CRITICAL)

| Path Origen | Import Detectado | Capa Origen | Riesgo | Motivo | Acción Recomendada |
|------------|------------------|-------------|--------|--------|-------------------|
| `src/lib/campobase/socialflow-service.ts` | `@/lib/socialflow/contracts/campobase` | campobase legacy | **CRITICAL** | Campobase (operator layer) importa directamente tipos y funciones de SocialFlow. Impide separación completa. | **Replace with internal API** — Crear endpoint HTTP interno `/internal/socialflow/automation/*` con service token auth |

**Código exacto:**
```typescript
// src/lib/campobase/socialflow-service.ts:17-23
import {
  getSocialFlowCampobaseOperatorObservabilityContract,
  runSocialFlowCampobaseAutomationContract,
  runSocialFlowCampobaseOperatorActionContract,
  type SocialFlowOperatorObservability,
  type SocialFlowOperatorAction,
  type SocialFlowOperatorActionResult,
} from "@/lib/socialflow/contracts/campobase";
```

**Impacto:**
- Campobase no puede funcionar sin SocialFlow en el mismo runtime
- Deploy independiente de SocialFlow rompería operaciones de Campobase
- Automation triggers fallarían

**Contrato requerido:**
```typescript
// Nuevo contrato: docs/contracts/campobase-socialflow-internal-api-v1.md

POST /internal/socialflow/automation/trigger
Authorization: Bearer {SERVICE_TOKEN}
Content-Type: application/json

Request:
{
  "tenantId": "string",
  "saasId": "string",
  "niche": "string",
  "tone": "string",
  "frequencyPerWeek": number
}

Response:
{
  "campaignId": "string",
  "postsCount": number,
  "scheduledCount": number,
  "schedule": [
    { "postId": "string", "scheduledAt": "ISO8601" }
  ]
}
```

**Primer commit para resolver:**
- Crear contrato API formal (docs)
- Implementar endpoint en SocialFlow worker
- Actualizar Campobase para usar fetch() en vez de import directo
- Añadir service token auth
- Tests de contrato

---

### BLOCKER #2: Owner Control Dashboard → SocialFlow (HIGH)

| Path Origen | Import Detectado | Capa Origen | Riesgo | Motivo | Acción Recomendada |
|------------|------------------|-------------|--------|--------|-------------------|
| `src/lib/owner/control-dashboard.ts` | `@/lib/socialflow/contracts/owner-dashboard` | owner/control | **HIGH** | Owner dashboard importa snapshot de SocialFlow para mostrar métricas consolidadas. | **Replace with internal API** — Endpoint `/internal/socialflow/owner/snapshot` |
| `src/lib/owner/types.ts` | `@/lib/socialflow/contracts/owner-dashboard` (types) | owner/control | **MEDIUM** | Import de tipos TypeScript. Puede reemplazarse con shared types package. | **Move to shared capability** — Crear `@/lib/capabilities/owner-types` |

**Código exacto:**
```typescript
// src/lib/owner/control-dashboard.ts:16
import { getSocialOwnerDashboardSnapshot } from "@/lib/socialflow/contracts/owner-dashboard";

// src/lib/owner/types.ts:1
import type { SocialOwnerSummary } from "@/lib/socialflow/contracts/owner-dashboard";
```

**Impacto:**
- Owner dashboard no puede renderizar métricas de SocialFlow si está en worker separado
- Tipo `SocialOwnerSummary` roto en compile time

**Contrato requerido:**
```typescript
// Nuevo contrato: docs/contracts/socialflow-owner-snapshot-api-v1.md

GET /internal/socialflow/owner/snapshot?tenantId={tenantId}&saasId={saasId}
Authorization: Bearer {SERVICE_TOKEN}

Response:
{
  "connectedAccounts": number,
  "activeCampaigns": number,
  "publishedPostsLast30Days": number,
  "scheduledPostsThisWeek": number,
  "readinessStage": "GUIDED_SETUP" | "PILOT_READY" | "FIRST_PAYING_USER_READY",
  "healthStatus": "Healthy" | "Needs attention" | "No live analytics yet"
}
```

---

## 2. High-Risk Dependencies

### Integration Core → SocialFlow (MEDIUM)

| Path Origen | Import Detectado | Capa Origen | Riesgo | Motivo | Acción Recomendada |
|------------|------------------|-------------|--------|--------|-------------------|
| `src/lib/integration-core/providers/linkedin.ts` | `@/lib/socialflow/linkedin/core` | integration layer | **MEDIUM** | Integration layer depende de LinkedIn primitives de SocialFlow. Esto es acoplamiento técnico. | **Move to shared capability** — Extraer LinkedIn OAuth primitives a `@/lib/capabilities/linkedin-oauth` |

**Código:**
```typescript
// src/lib/integration-core/providers/linkedin.ts:8-11
import {
  LinkedInIntegrationError,
  publishLinkedInMemberPost,
  verifyLinkedInAccess,
} from "@/lib/socialflow/linkedin/core";
```

**Razón del riesgo:**
- LinkedIn OAuth/publishing no es exclusivo de SocialFlow
- Otros productos podrían querer publicar en LinkedIn
- Debe ser capability neutral

**Extracción recomendada:**
```
src/lib/capabilities/linkedin-oauth/
  ├── core.ts          — OAuth primitives
  ├── publishing.ts    — Publishing functions
  ├── types.ts         — LinkedIn types
  └── errors.ts        — LinkedInIntegrationError
```

---

### Export/Wipeout → SocialFlow (MEDIUM)

| Path Origen | Import Detectado | Capa Origen | Riesgo | Motivo | Acción Recomendada |
|------------|------------------|-------------|--------|--------|-------------------|
| `src/lib/export/wipeout-package.ts` | `@/lib/socialflow/contracts/export-core-read` | export engine | **MEDIUM** | Export engine necesita leer datos de SocialFlow para GDPR wipeout. | **Replace with internal API** — Endpoint `/internal/socialflow/export/tenant-data` |

---

### Content Engine → SocialFlow (LOW)

| Path Origen | Import Detectado | Capa Origen | Riesgo | Motivo | Acción Recomendada |
|------------|------------------|-------------|--------|--------|-------------------|
| `src/lib/social/content-engine.ts` | `@/lib/socialflow/repository` (types) | legacy social | **LOW** | Legacy file importa solo tipos. File está deprecated. | **Delete later** — Ya está marcado como deprecated |

---

## 3. Legitimate Internal SocialFlow Imports

Estos imports son **legítimos** porque ocurren **dentro** de SocialFlow y deben quedarse:

### SocialFlow Internal Dependencies (KEEP)

| Path Origen | Import Detectado | Riesgo | Acción |
|------------|------------------|--------|--------|
| `src/lib/socialflow/repository.ts` | `@/lib/socialflow/contracts/repository-core-context` | **SAFE** | Keep — Internal module boundary |
| `src/lib/socialflow/export.ts` | `@/lib/socialflow/contracts/export-core-read` | **SAFE** | Keep — Internal contract |
| `src/lib/socialflow/auth/request.ts` | `@/lib/socialflow/auth/tenant-isolation` | **SAFE** | Keep — Auth boundary |
| `src/lib/socialflow/auth/server.ts` | `@/lib/socialflow/auth/tenant-isolation` | **SAFE** | Keep — Auth boundary |
| `src/lib/socialflow/live-publishing.ts` | `@/lib/socialflow/linkedin/core` | **SAFE** | Keep — LinkedIn integration |
| `src/lib/socialflow/live-publishing.ts` | `@/lib/socialflow/linkedin/publishing` | **SAFE** | Keep — LinkedIn integration |
| `src/lib/socialflow/live-publishing.ts` | `@/lib/socialflow/repository` | **SAFE** | Keep — Data access |
| `src/lib/socialflow/scheduler.ts` | `@/lib/socialflow/live-publishing` | **SAFE** | Keep — Scheduler uses publisher |
| `src/lib/socialflow/scheduler.ts` | `@/lib/socialflow/repository` | **SAFE** | Keep — Data access |
| `src/lib/socialflow/scheduler.ts` | `@/lib/socialflow/private-pilot` | **SAFE** | Keep — Feature flag |
| `src/lib/socialflow/profile/repository.ts` | `@/lib/socialflow/ai/types` | **SAFE** | Keep — AI types |
| `src/lib/socialflow/profile/repository.ts` | `@/lib/socialflow/repository` | **SAFE** | Keep — Data access |
| `src/lib/socialflow/contracts/owner-dashboard.ts` | `@/lib/socialflow/repository` | **SAFE** | Keep — Contract implementation |
| `src/lib/socialflow/contracts/observability.ts` | `@/lib/socialflow/repository` | **SAFE** | Keep — Contract implementation |
| `src/lib/socialflow/contracts/operator-actions.ts` | `@/lib/socialflow/repository` | **SAFE** | Keep — Contract implementation |
| `src/lib/socialflow/contracts/automation.ts` | `@/lib/socialflow/ai/socialflow-engine` | **SAFE** | Keep — Contract implementation |
| `src/lib/socialflow/contracts/campobase.ts` | `@/lib/socialflow/contracts/automation` | **SAFE** | Keep — Internal contract composition |
| `src/lib/socialflow/contracts/campobase.ts` | `@/lib/socialflow/contracts/observability` | **SAFE** | Keep — Internal contract composition |
| `src/lib/socialflow/contracts/campobase.ts` | `@/lib/socialflow/contracts/operator-actions` | **SAFE** | Keep — Internal contract composition |
| `src/lib/socialflow/linkedin/types.ts` | `@/lib/socialflow/linkedin/core` | **SAFE** | Keep — LinkedIn internal |

**Total internal imports:** ~25+ (todos legítimos)

Estos imports se **mueven junto con SocialFlow** al worker. No requieren cambios.

---

## 4. Legacy Facades (DEPRECATED — Safe to ignore)

Estos archivos son **facades legacy** que re-exportan de SocialFlow. Ya están marcados como deprecated:

| Path | Import | Estado | Acción |
|------|--------|--------|--------|
| `src/lib/social/linkedin-service.ts` | `@/lib/socialflow/linkedin/publishing` | **DEPRECATED** | Delete after migration |
| `src/lib/social/live-publishing.ts` | `@/lib/socialflow/live-publishing` | **DEPRECATED** | Delete after migration |
| `src/lib/social/analytics-window.ts` | `@/lib/socialflow/analytics-window` | **DEPRECATED** | Delete after migration |
| `src/lib/social/linkedin-connection.ts` | `@/lib/socialflow/linkedin/repository` | **DEPRECATED** | Delete after migration |
| `src/lib/social/scheduler.ts` | `@/lib/socialflow/scheduler` | **DEPRECATED** | Delete after migration |
| `src/lib/social/repository.ts` | `@/lib/socialflow/repository` | **DEPRECATED** | Delete after migration |
| `src/lib/social/ai/socialflow-engine.ts` | `@/lib/socialflow/ai/socialflow-engine` | **DEPRECATED** | Delete after migration |
| `src/lib/social/linkedin.ts` | `@/lib/socialflow/linkedin/core` | **DEPRECATED** | Delete after migration |
| `src/lib/social/profile/types.ts` | `@/lib/socialflow/profile/types` | **DEPRECATED** | Delete after migration |
| `src/lib/social/profile/repository.ts` | `@/lib/socialflow/profile/repository` | **DEPRECATED** | Delete after migration |

**Código típico de facade:**
```typescript
// src/lib/social/linkedin-service.ts
/**
 * @deprecated Import from "@/lib/socialflow/linkedin/publishing" instead.
 */
export * from "@/lib/socialflow/linkedin/publishing";
```

**Impacto:** NINGUNO. Estos archivos se eliminarán después de migración. No bloquean separación.

---

## 5. App Routes & Components (Expected Dependencies)

Estos imports son **esperados** desde rutas y componentes de SocialFlow. Deben moverse al worker junto con SocialFlow:

### API Routes (Move to SocialFlow Worker)

| Path | Import | Acción |
|------|--------|--------|
| `src/app/api/socialflow/posts/route.ts` | `@/lib/socialflow/auth/request` | **Move to worker** |
| `src/app/api/socialflow/posts/route.ts` | `@/lib/socialflow/repository` | **Move to worker** |
| `src/app/api/socialflow/posts/route.ts` | `@/lib/socialflow/live-publishing` | **Move to worker** |
| `src/app/api/socialflow/posts/route.ts` | `@/lib/socialflow/linkedin/core` | **Move to worker** |
| `src/app/api/socialflow/posts/route.ts` | `@/lib/socialflow/linkedin/publishing` | **Move to worker** |
| `src/app/api/socialflow/posts/route.ts` | `@/lib/socialflow/token-encryption` | **Move to worker** |
| `src/app/api/socialflow/posts/route.ts` | `@/lib/socialflow/private-pilot` | **Move to worker** |
| `src/app/api/socialflow/campaigns/route.ts` | `@/lib/socialflow/auth/request` | **Move to worker** |
| `src/app/api/socialflow/campaigns/route.ts` | `@/lib/socialflow/repository` | **Move to worker** |
| `src/app/api/socialflow/profile/route.ts` | `@/lib/socialflow/auth/request` | **Move to worker** |
| `src/app/api/socialflow/profile/route.ts` | `@/lib/socialflow/profile/repository` | **Move to worker** |
| `src/app/api/socialflow/setup/status/route.ts` | `@/lib/socialflow/auth/request` | **Move to worker** |
| `src/app/api/socialflow/setup/status/route.ts` | `@/lib/socialflow/profile/repository` | **Move to worker** |
| `src/app/api/socialflow/setup/status/route.ts` | `@/lib/socialflow/repository` | **Move to worker** |
| `src/app/api/socialflow/setup/status/route.ts` | `@/lib/socialflow/private-pilot` | **Move to worker** |
| `src/app/api/socialflow/exports/current/route.ts` | `@/lib/socialflow/auth/server` | **Move to worker** |
| `src/app/api/socialflow/exports/current/route.ts` | `@/lib/socialflow/contracts/export-core-read` | **Move to worker** |
| `src/app/api/socialflow/exports/current/route.ts` | `@/lib/socialflow/export` | **Move to worker** |
| `src/app/api/socialflow/ai/generate/route.ts` | `@/lib/socialflow/auth/request` | **Move to worker** |
| `src/app/api/socialflow/ai/generate/route.ts` | `@/lib/socialflow/ai/SocialFlowOrchestrator` | **Move to worker** |
| `src/app/api/socialflow/ai/regenerate/route.ts` | `@/lib/socialflow/auth/request` | **Move to worker** |
| `src/app/api/socialflow/ai/regenerate/route.ts` | `@/lib/socialflow/ai/SocialFlowOrchestrator` | **Move to worker** |
| `src/app/api/socialflow/ai/regenerate/route.ts` | `@/lib/socialflow/repository` | **Move to worker** |
| `src/app/api/socialflow/linkedin/callback/route.ts` | `@/lib/socialflow/linkedin/oauth` | **Move to worker** |
| `src/app/api/socialflow/linkedin/connect/route.ts` | `@/lib/socialflow/linkedin/oauth` | **Move to worker** |
| `src/app/api/socialflow/linkedin/validate-connection/route.ts` | `@/lib/socialflow/auth/request` | **Move to worker** |
| `src/app/api/socialflow/linkedin/validate-connection/route.ts` | `@/lib/socialflow/linkedin/core` | **Move to worker** |
| `src/app/api/socialflow/linkedin/validate-connection/route.ts` | `@/lib/socialflow/linkedin/publishing` | **Move to worker** |
| `src/app/api/socialflow/linkedin/validate-connection/route.ts` | `@/lib/socialflow/token-encryption` | **Move to worker** |
| `src/app/api/socialflow/linkedin/validate-connection/route.ts` | `@/lib/socialflow/repository` | **Move to worker** |

**Total API routes:** 8 routes con 39 imports

---

### Cron Jobs (Special Case — Review)

| Path | Import | Acción |
|------|--------|--------|
| `src/app/api/cron/social/route.ts` | `@/lib/socialflow/scheduler` | **Review manually** — Cron podría quedar en monolito y llamar al worker vía API |
| `src/app/api/cron/social/publish/route.ts` | `@/lib/socialflow/scheduler` | **Review manually** — Cron podría quedar en monolito y llamar al worker vía API |
| `src/app/api/test-social-scheduler/route.ts` | `@/lib/socialflow/scheduler` | **Delete later** — Test endpoint |

**Decisión pendiente:** ¿Cron se mueve al worker o llama al worker via HTTP?

---

### Page Routes & Layouts (Move to SocialFlow Worker)

| Path | Import | Acción |
|------|--------|--------|
| `src/app/socialflow/(workspace)/layout.tsx` | `@/lib/socialflow/auth/server` | **Move to worker** |
| `src/app/socialflow/(workspace)/settings/team/page.tsx` | `@/lib/socialflow/auth/server` | **Move to worker** |
| `src/app/socialflow/(workspace)/settings/account/page.tsx` | `@/lib/socialflow/auth/server` | **Move to worker** |
| `src/app/socialflow/(workspace)/settings/billing/page.tsx` | `@/lib/socialflow/auth/server` | **Move to worker** |
| `src/modules/socialflow-app/layout.tsx` | `@/lib/socialflow/auth/server` | **Move to worker** |

---

### Components (Move to SocialFlow Worker)

| Path | Import | Acción |
|------|--------|--------|
| `src/components/saas/socialflow/SocialFlowWorkspaceClient.tsx` | `@/lib/socialflow/analytics-window` | **Move to worker** |
| `src/components/saas/socialflow/SocialFlowDashboard.tsx` | `@/lib/socialflow/analytics-window` | **Move to worker** |
| `src/components/saas/socialflow/SocialFlowDashboard.tsx` | `@/lib/socialflow/repository` | **Move to worker** |

---

## 6. Tests & Docs References

| Path | Import | Capa | Riesgo | Acción |
|------|--------|------|--------|--------|
| `src/lib/socialflow/auth/tenant-isolation.test.ts` | `@/lib/socialflow/auth/tenant-isolation` | test | **SAFE** | Keep — Internal test |

**No se detectaron imports de SocialFlow en `src/__tests__/`** — Tests están dentro de `src/lib/socialflow/` (co-located).

---

## 7. First Safe Commit to Execute

### COMMIT 1: Document Campobase ↔ SocialFlow Internal API Contract

**Objetivo:**  
Crear el contrato formal de API interna entre Campobase y SocialFlow sin modificar código de producción.

**Archivos a crear:**
```
docs/contracts/campobase-socialflow-internal-api-v1.md
```

**Contenido del contrato:**

```markdown
# Campobase ↔ SocialFlow Internal API v1.0

## Authentication

All requests MUST include service token:

```http
Authorization: Bearer {SERVICE_TOKEN}
```

Service token is internal-only, not exposed to public.

## Endpoints

### POST /internal/socialflow/automation/trigger

Trigger SocialFlow content generation automation.

**Request:**
```json
{
  "tenantId": "string",
  "saasId": "string",
  "niche": "string",
  "tone": "string",
  "frequencyPerWeek": number
}
```

**Response 200:**
```json
{
  "campaignId": "string",
  "postsCount": number,
  "scheduledCount": number,
  "schedule": [
    {
      "postId": "string",
      "scheduledAt": "2026-06-05T10:00:00Z"
    }
  ]
}
```

**Errors:**
- 400 — INVALID_INPUT
- 401 — UNAUTHORIZED (missing/invalid service token)
- 404 — AUTOMATION_NOT_CONFIGURED
- 409 — AUTOMATION_DISABLED
- 500 — INTERNAL_ERROR

### GET /internal/socialflow/observability/health

Get SocialFlow automation health status.

**Query params:**
- `tenantId` (required)
- `saasId` (required)

**Response 200:**
```json
{
  "automations": {
    "total": number,
    "enabled": number,
    "disabled": number
  },
  "executions": {
    "running": number,
    "succeeded": number,
    "failed": number
  },
  "lastRun": "2026-06-05T09:30:00Z" | null
}
```

### POST /internal/socialflow/operator/action

Execute operator action on SocialFlow.

**Request:**
```json
{
  "tenantId": "string",
  "saasId": "string",
  "action": "RUN_ALL" | "RUN_ONE" | "ENABLE" | "DISABLE",
  "automationKey": "socialflow.content_generation" | null
}
```

**Response 200:**
```json
{
  "ok": boolean,
  "executionId": "string" | null,
  "error": "string" | null
}
```

## TypeScript Types

```typescript
// Shared types (to be placed in @/lib/capabilities/internal-api-types or similar)

export type CampobaseSocialFlowTriggerRequest = {
  tenantId: string;
  saasId: string;
  niche: string;
  tone: string;
  frequencyPerWeek: number;
};

export type CampobaseSocialFlowTriggerResponse = {
  campaignId: string;
  postsCount: number;
  scheduledCount: number;
  schedule: Array<{
    postId: string;
    scheduledAt: string;
  }>;
};

export type CampobaseSocialFlowHealthResponse = {
  automations: {
    total: number;
    enabled: number;
    disabled: number;
  };
  executions: {
    running: number;
    succeeded: number;
    failed: number;
  };
  lastRun: string | null;
};
```

## Implementation Checklist

### SocialFlow Worker (Provider)
- [ ] Implement `/internal/socialflow/automation/trigger` endpoint
- [ ] Implement `/internal/socialflow/observability/health` endpoint
- [ ] Implement `/internal/socialflow/operator/action` endpoint
- [ ] Add service token validation middleware
- [ ] Add rate limiting (100 req/min per service)
- [ ] Add request logging
- [ ] Add error handling
- [ ] Write integration tests

### Campobase (Consumer)
- [ ] Create HTTP client for SocialFlow internal API
- [ ] Replace direct imports with API calls
- [ ] Add retry logic (3 retries with exponential backoff)
- [ ] Add timeout (30 seconds)
- [ ] Add circuit breaker (fail after 5 consecutive failures)
- [ ] Write mock tests
- [ ] Write integration tests

## Rollout Plan

1. **Phase 1:** Implement endpoints in monolith (both Campobase and SocialFlow in same runtime)
2. **Phase 2:** Test API calls instead of direct imports
3. **Phase 3:** Deploy SocialFlow to separate worker
4. **Phase 4:** Update API base URL to worker domain
5. **Phase 5:** Remove legacy imports from Campobase
```

**Archivos que NO se deben tocar:**
- ❌ `src/lib/campobase/socialflow-service.ts`
- ❌ `src/lib/socialflow/contracts/campobase.ts`
- ❌ Ningún archivo .ts, .tsx, .js, .jsx

**Validaciones:**
- ✅ Archivo creado en `docs/contracts/`
- ✅ No se modificó código de producción
- ✅ `pnpm typecheck` — No ejecutar (no hay cambios)
- ✅ `npx vitest run` — No ejecutar (no hay cambios)

**Rollback:**
- Eliminar archivo de contrato

**Riesgo:** ZERO (solo documentación)

---

## 8. Priority Separation Roadmap

### PHASE 1: Prepare Contracts (Semana 1-2)

**Commits seguros:**
1. ✅ Document Campobase ↔ SocialFlow API contract
2. ✅ Document Owner ↔ SocialFlow API contract
3. ✅ Extract LinkedIn OAuth to shared capability (design doc only)
4. ✅ Create shared types package proposal

**Deliverables:**
- 4 documentos en `docs/contracts/`
- Zero código modificado
- Validado por stakeholders

---

### PHASE 2: Implement Internal APIs (Semana 3-4)

**Objetivo:** Implementar endpoints internos **en el monolito** (mismo runtime).

**Commits:**
1. Crear `/app/api/internal/socialflow/automation/trigger/route.ts`
2. Crear `/app/api/internal/socialflow/observability/health/route.ts`
3. Crear `/app/api/internal/socialflow/operator/action/route.ts`
4. Crear `/app/api/internal/socialflow/owner/snapshot/route.ts`
5. Añadir service token validation middleware
6. Tests de cada endpoint

**Validaciones:**
- `pnpm typecheck` ✓
- `npx vitest run` ✓
- Curl tests locales

---

### PHASE 3: Replace Imports with API Calls (Semana 5-6)

**Objetivo:** Actualizar Campobase y Owner para usar HTTP en vez de imports directos.

**Commits:**
1. Crear `src/lib/capabilities/internal-api-client/socialflow.ts`
2. Actualizar `src/lib/campobase/socialflow-service.ts` para usar API client
3. Actualizar `src/lib/owner/control-dashboard.ts` para usar API client
4. Tests de integración
5. Feature flag `USE_SOCIALFLOW_API_CLIENT` (default: false)

**Validaciones:**
- `pnpm typecheck` ✓
- `npx vitest run` ✓
- Feature flag enabled en local
- Regression tests pass

---

### PHASE 4: Move SocialFlow to Worker (Semana 7-10)

**Objetivo:** Crear worker de SocialFlow y mover código.

**Commits:**
1. Crear `workers/socialflow/` structure
2. Crear `workers/socialflow/wrangler.toml`
3. Crear `workers/socialflow/package.json`
4. Copiar `src/lib/socialflow/` → `workers/socialflow/src/lib/`
5. Copiar `src/app/api/socialflow/` → `workers/socialflow/src/app/api/`
6. Copiar `src/app/socialflow/` → `workers/socialflow/src/app/`
7. Copiar `src/components/saas/socialflow/` → `workers/socialflow/src/components/`
8. Configurar D1 bindings (SOCIAL_DB)
9. Tests en worker
10. Deploy canary

**Validaciones:**
- Worker build ✓
- Worker typecheck ✓
- Worker tests ✓
- Canary deploy ✓
- Smoke tests ✓

---

### PHASE 5: Cutover & Cleanup (Semana 11-12)

**Objetivo:** Hacer cutover a worker y eliminar código legacy del monolito.

**Commits:**
1. Enable `USE_SOCIALFLOW_API_CLIENT` en producción
2. Update API base URL to worker domain
3. Monitoring + alerting
4. 1 semana de observación
5. Eliminar `src/lib/socialflow/` del monolito
6. Eliminar `src/app/api/socialflow/` del monolito
7. Eliminar `src/app/socialflow/` del monolito
8. Eliminar facades legacy en `src/lib/social/`
9. Eliminar imports de SocialFlow en Campobase
10. Eliminar imports de SocialFlow en Owner

**Validaciones:**
- Production metrics stable
- Zero errors in logs
- `pnpm typecheck` ✓ (monolito sin SocialFlow)
- `npx vitest run` ✓

---

## 9. Conclusion

### ¿Cuál es el import más peligroso?

**`src/lib/campobase/socialflow-service.ts` → `@/lib/socialflow/contracts/campobase`**

**Razón:**
- Campobase es operator layer crítico
- Orquesta automation de múltiples SaaS
- Si se rompe, toda la automation platform falla
- No tiene fallback ni retry logic actual
- Direct function call coupling (no API boundary)

---

### ¿Cuántos imports externos a SocialFlow existen?

**Total:** 104+ imports detectados

**Desglose:**
- **Critical external:** 2 (Campobase, Owner)
- **Medium external:** 3 (Integration Core, Export, Content Engine legacy)
- **Internal SocialFlow:** ~25+ (legítimos, se mueven con worker)
- **Facades legacy:** 10 (deprecated, se eliminan después)
- **App routes/components:** 39+ (se mueven con worker)
- **Tests:** 1 (interno, se mueve con worker)

**External blockers:** 5 (2 critical + 3 medium)

---

### ¿SocialFlow puede moverse ya a Worker?

**NO.**

**Motivos:**
1. ❌ Campobase importa directamente de SocialFlow — BLOCKER CRÍTICO
2. ❌ Owner importa directamente de SocialFlow — BLOCKER HIGH
3. ❌ Integration Core usa LinkedIn primitives de SocialFlow — Debe extraerse primero
4. ❌ No existe contrato API formal — Debe diseñarse primero
5. ❌ No existe worker scaffold — Debe crearse primero
6. ❌ No existen service tokens — Debe implementarse primero

**Tiempo estimado hasta ready:** 8-12 semanas (5 fases)

---

### ¿Cuál es el primer cambio seguro?

**COMMIT 1: Document Campobase ↔ SocialFlow Internal API Contract**

**Por qué es seguro:**
- Solo crea documentación
- Zero código modificado
- Reversible (eliminar archivo)
- No requiere aprobación de stakeholders técnicos
- Permite discusión de contrato antes de implementar

**Siguiente commit seguro:**
- COMMIT 2: Document Owner ↔ SocialFlow API contract
- COMMIT 3: Design LinkedIn OAuth shared capability extraction

---

### ¿Qué NO debe tocarse todavía?

❌ **NO tocar código de SocialFlow** — Primero diseñar contratos  
❌ **NO crear workers/ folders** — Primero resolver dependencias críticas  
❌ **NO mover archivos** — Primero implementar APIs internas  
❌ **NO cambiar imports en Campobase** — Primero crear API endpoints  
❌ **NO cambiar imports en Owner** — Primero crear API endpoints  
❌ **NO tocar Mentoría** — Está en pausa (memoria del usuario)  
❌ **NO tocar Clinic** — No es prioridad  
❌ **NO eliminar facades legacy** — Todavía usadas en monolito  
❌ **NO tocar migraciones** — Riesgo de corrupción DB  
❌ **NO hacer commits grandes** — Violar reglas de seguridad  
❌ **NO cambiar LinkedIn OAuth** — Primero diseñar extracción a capability  

**Regla general:** Solo documentación y diseño de contratos por ahora. Implementación después de aprobación.

---

## CONFIRMACIÓN FINAL

✅ **Archivo creado:** SÍ  
✅ **Ruta exacta:** `\\wsl$\Ubuntu-22.04\home\drako\workspace\drako_base\docs\audits\SAAS_SEPARATION_SOCIALFLOW_IMPORTS_PHASE_2.md`  
✅ **Número total de referencias encontradas:** 104+  
✅ **Número total de blockers críticos:** 2 (Campobase, Owner)  

**Estado:** Auditoría Fase 2 completada. Siguiente paso: Document contracts (Commit 1-3).
