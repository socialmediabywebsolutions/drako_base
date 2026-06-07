# CAMPAMENTO BASE vs CAMPOBASE — Namespace Audit

Date: 2026-06-06  
Scope: Auditoría arquitectónica de duplicidad de namespaces antes de Phase C.2 (sin cambios de código productivo).

---

## Resumen ejecutivo

- Se confirma coexistencia activa de dos namespaces:
  - `src/lib/campamento-base/` (25 archivos)
  - `src/lib/campobase/` (10 archivos)
- Se observa mezcla funcional en runtime:
  - `campamento-base` consume `campobase` en `src/lib/campamento-base/orchestrator/snapshot-db.ts`.
- Blocker grande vigente para separación SocialFlow:
  - `src/lib/campobase/socialflow-service.ts` → `@/lib/socialflow/contracts/campobase`.
- Recomendación para canonicalización (según decisión de este audit):
  - Canónico: `src/lib/campamento-base/`
  - Legacy temporal: `src/lib/campobase/`

---

## 1) Inventario de namespaces

### 1.1 `src/lib/campamento-base/`

| Path | Propósito aparente | Imports principales | Exports principales | Capa real | Riesgo |
|---|---|---|---|---|---|
| `src/lib/campamento-base/agent-factory.ts` | Materializar agentes por blueprint/packs | `@/lib/agents/agent-templates`, `@/lib/db` | `getAgentTemplatesForSaasBlueprint`, `createAgentsForSaasFromPacks`, `materializeAgentsForSaas` | provisioning | high |
| `src/lib/campamento-base/ai-blueprint-v2/prompts.ts` | Re-export compat de prompts factory | `@/lib/factory/ai-blueprint/prompts` | `export *` | legacy | low |
| `src/lib/campamento-base/analytics/holding-metrics.ts` | Métricas holding + snapshots | `@/lib/db` | `calculateHoldingMetrics`, `saveHoldingSnapshot`, `getLatestHoldingMetrics`, `getHoldingMetricsHistory` | analytics | medium |
| `src/lib/campamento-base/bi/knowledge-base.ts` | Re-export compat BI | `@/lib/factory/bi/knowledge-base` | `export *` | legacy | low |
| `src/lib/campamento-base/contracts/service.ts` | Re-export compat contratos | `@/lib/factory/contracts/service` | `export *` | legacy | low |
| `src/lib/campamento-base/expansion-orchestrator.ts` | Orquestación expansión internacional (seed + conectores) | `./saas-factory-orchestrator`, `@/lib/db` | `orchestrateGlobalExpansion` | provisioning | high |
| `src/lib/campamento-base/export-engine/wipeout.ts` | Re-export motor export wipeout | `@/lib/export/wipeout-package` | `generateWipeoutPackage` | legacy | low |
| `src/lib/campamento-base/health-score/calculator.ts` | Cálculo health score SaaS | `@/lib/db` | `calculateHealthScore`, `saveHealthScore`, `getLatestHealthScore` | analytics | medium |
| `src/lib/campamento-base/lifecycle/manager.ts` | Archivado de instancia | `@/lib/db` | `archiveInstance` | lifecycle | medium |
| `src/lib/campamento-base/operator-whatsapp-notifications.ts` | Alertas/resumen operator por WhatsApp | `@/lib/factory/registry`, `@/lib/observability-core`, `@/lib/notifications/whatsapp-service` | `sendOperatorDailyWhatsappSummary`, `sendOperatorRealtimeWhatsappAlert`, `triggerOperatorRealtimeWhatsappAlertForMentoriaEvent` | control-plane | high |
| `src/lib/campamento-base/orchestrator/index.ts` | Facade orchestrator | `./snapshot`, `./qa` | `buildCampamentoBaseSnapshot`, `answerQuestion`, `ask` | control-plane | low |
| `src/lib/campamento-base/orchestrator/qa.ts` | Respuestas/intent sobre snapshot | `./types` | `answerQuestion` | control-plane | low |
| `src/lib/campamento-base/orchestrator/snapshot-db.ts` | Snapshot DB-direct sin HTTP | `@/lib/db`, `@/lib/owner/accounting`, `@/lib/campobase/socialflow-service` | `buildCampamentoBaseSnapshotFromDb` | control-plane | **critical** |
| `src/lib/campamento-base/orchestrator/snapshot.ts` | Snapshot vía HTTP operator APIs | fetch + `/api/operator/*` | `buildCampamentoBaseSnapshot` | control-plane | high |
| `src/lib/campamento-base/orchestrator/types.ts` | Tipos snapshot/orchestrator | local types | tipos `CampamentoBaseSnapshot`, `SaasRow`, `OrchestratorAnswer` | control-plane | low |
| `src/lib/campamento-base/provisioning/ai-factory.ts` | Perfil AI por blueprint | `@/lib/campamento-base/saas-factory-types` | `recommendAiProfileForBlueprint`, `materializeAiConfigForSaas` | provisioning | medium |
| `src/lib/campamento-base/provisioning/cloudflare-factory.ts` | Provisioning DNS/custom hostname CF | `@/lib/cf`, `fetch` Cloudflare API | `computeDomainsForSaas`, `provisionSaasInCloudflare`, `deleteCloudflareHostname` | provisioning | high |
| `src/lib/campamento-base/provisioning/stripe-factory.ts` | Provisioning/reconciliación Stripe | `stripe`, `@/lib/billing/stripe-mapping-repository`, `@/lib/empire/events` | `ensureStripeProductForSaas`, `archiveStripeProductAndPrices` | provisioning | high |
| `src/lib/campamento-base/saas-factory-bridge.ts` | Sugerir blueprint desde entrevista | `saas-factory-types`, `saas-factory-helpers` | `suggestSaasBlueprintFromInterview` | provisioning | medium |
| `src/lib/campamento-base/saas-factory-helpers.ts` | Re-export helpers de perfil | `@/lib/factory/blueprint-profile` | `normalizeCampamentoBaseProfileForBlueprint`, `withCampamentoBaseProfile` | legacy | low |
| `src/lib/campamento-base/saas-factory-orchestrator.ts` | Orquestador principal de creación/provisioning SaaS | `@/lib/db`, `@/lib/campamento-base/*`, provisioning modules, domain provider | `provisionSaaS`, alias `createSaasFromBlueprint` | provisioning | **critical** |
| `src/lib/campamento-base/saas-factory-types.ts` | Re-export tipos de blueprint | `@/lib/factory/contracts/blueprints` | `export type *` | legacy | low |
| `src/lib/campamento-base/saas-provisioning-plan.ts` | Defaults de provisioning y pricing prep | `saas-factory-types`, `@/lib/owner/pricing-engine` | `computeDefaultProvisioningForBlueprint`, `prepareStripePricingFromBlueprint` | provisioning | medium |
| `src/lib/campamento-base/stripe-wizard/flow.ts` | Wizard setup Stripe template-driven | `@/lib/db`, `@/lib/cf`, Stripe HTTP API | `getStripeSetupTemplates`, `setupStripeForSaas` | provisioning | high |
| `src/lib/campamento-base/templates/marketplace.ts` | Re-export compat templates | `@/lib/factory/templates/marketplace` | `export *` | legacy | low |

### 1.2 `src/lib/campobase/`

| Path | Propósito aparente | Imports principales | Exports principales | Capa real | Riesgo |
|---|---|---|---|---|---|
| `src/lib/campobase/clinic-platform-service.ts` | Bootstrap + automation clinic | `@/lib/automation-core`, `@/lib/integration-core`, `@/lib/appointments/repository` | `CLINIC_DAILY_APPOINTMENT_HEALTH_KEY`, `registerClinicPlatform` | legacy | medium |
| `src/lib/campobase/clinic-platform.ts` | Definición contrato SaaS Clinic | `@/lib/saas-contract`, `clinic-platform-service` | `clinicPlatformDefinition`, `clinicPlatformBootstrap` | registry | medium |
| `src/lib/campobase/platform-bootstrap.ts` | Registro dinámico de plataformas (socialflow/clinic/taskops) | `@/lib/saas-contract`, imports dinámicos campobase | `registerSocialFlowPlatform`, `registerClinicPlatform`, `registerTaskOpsPlatform`, `loadPlatformForSaas` | registry | high |
| `src/lib/campobase/platform-operator-service.ts` | Surface operator (automations/integrations/observability) | `@/lib/automation-core`, `@/lib/integration-core`, `@/lib/observability-core`, `platform-bootstrap` | `getPlatformOperatorSurface`, `refreshPlatformOperatorSurface`, acciones/operator helpers | control-plane | high |
| `src/lib/campobase/social-automation-history.ts` | Histórico runs social automation (tabla propia) | `@/lib/db` | `recordCampoBaseSocialAutomationRun`, `list*Runs*` | socialflow-integration | medium |
| `src/lib/campobase/social-automation-registry.ts` | Registro tenant/saas de social automation | `@/lib/db` | `upsert/get/list/set/removeCampoBaseSocialAutomationRegistry*` | socialflow-integration | medium |
| `src/lib/campobase/socialflow-platform.ts` | Definición plataforma SocialFlow | `@/lib/saas-contract`, `@/lib/integration-core/providers/linkedin`, dynamic import socialflow-service | `socialFlowPlatformDefinition`, `socialFlowPlatformBootstrap` | socialflow-integration | high |
| `src/lib/campobase/socialflow-service.ts` | Servicio operator SocialFlow + puente a contrato SocialFlow | `@/lib/automation-core`, `@/lib/socialflow/contracts/campobase` | gran superficie `register/run/get/list/toggle` + observability/action | socialflow-integration | **critical** |
| `src/lib/campobase/taskops-platform-service.ts` | Bootstrap + automation TaskOps | `@/lib/automation-core`, `@/lib/integration-core`, `@/lib/tasks/repository` | `TASKOPS_PENDING_TASK_AUDIT_KEY`, `registerTaskOpsPlatform` | legacy | medium |
| `src/lib/campobase/taskops-platform.ts` | Definición contrato SaaS TaskOps | `@/lib/saas-contract`, `taskops-platform-service` | `taskOpsPlatformDefinition`, `taskOpsPlatformBootstrap` | registry | medium |

---

## 2) Duplicidades funcionales detectadas

No hay duplicado 1:1 de archivo, pero sí superposición de responsabilidades entre namespaces.

| Campamento Base | Campobase | Responsabilidad superpuesta | Canónico recomendado | Deprecar temporal | Riesgo migración |
|---|---|---|---|---|---|
| `orchestrator/snapshot-db.ts` | `socialflow-service.ts` | Snapshot control-plane depende de estado operator social | `campamento-base` (consumiendo API interna, no import directo) | `campobase` como adapter temporal | high |
| `operator-whatsapp-notifications.ts` | `platform-operator-service.ts` | Operación/alertado operator cross-SaaS | `campamento-base` para políticas de control-plane | `campobase` para ejecución táctica temporal | medium |
| `saas-factory-orchestrator.ts` | `platform-bootstrap.ts` | Bootstrap/provisioning de capacidades por SaaS | `campamento-base` | `campobase` como registry adapter temporal | high |
| `analytics/holding-metrics.ts` | `social-automation-history.ts` + `social-automation-registry.ts` | Telemetría/métricas de operación en control-plane | `campamento-base` | `campobase` persistencia táctica | medium |
| `lifecycle/manager.ts` | `platform-operator-service.ts` | Gestión estado operativo/ciclo de vida | `campamento-base` | `campobase` acciones operativas acotadas | medium |

Conclusión: la duplicidad es **arquitectónica por responsabilidades**, no por copia de código.

---

## 3) Referencias/imports hacia ambos namespaces

### 3.1 Conteo global (import paths alias)

- `@/lib/campamento-base*`:
  - `src`: 40 matches / 32 archivos
  - `tests`: 19 matches / 10 archivos
  - `scripts`: 6 matches / 4 archivos
  - **Total imports en código/tests/scripts: 65**
  - `docs`: 10 menciones / 8 archivos
- `@/lib/campobase*`:
  - `src`: 14 matches / 12 archivos
  - `tests`: 34 matches / 22 archivos
  - `scripts`: 4 matches / 2 archivos
  - **Total imports en código/tests/scripts: 52**
  - `docs`: 13 menciones / 10 archivos

Búsqueda textual adicional:
- `src/lib/campamento-base` y `src/lib/campobase` aparecen principalmente en docs/runbooks/contracts (no como imports TS).

### 3.2 Clasificación por referencia (archivo origen)

> Nota: Se clasifica por archivo consumidor (no por cada línea repetida dentro del mismo archivo).

#### A) Referencias a `@/lib/campamento-base*`

| Path origen | Import detectado | Namespace usado | Capa origen | Riesgo | Acción recomendada |
|---|---|---|---|---|---|
| `src/app/api/core-agents/route.ts` | `@/lib/campamento-base` | campamento-base | api route | low | keep |
| `src/app/api/core-departments/route.ts` | `@/lib/campamento-base` | campamento-base | api route | low | keep |
| `src/app/api/diag/route.ts` | `@/lib/campamento-base` | campamento-base | api route | low | keep |
| `src/app/api/inbox/route.ts` | `@/lib/campamento-base` | campamento-base | api route | low | keep |
| `src/app/api/operator/saas/route.ts` | `@/lib/campamento-base` | campamento-base | api route | medium | keep |
| `src/app/api/orchestrator/route.ts` | `@/lib/campamento-base` | campamento-base | api route | medium | keep |
| `src/app/api/saas-agents/route.ts` | `@/lib/campamento-base` | campamento-base | api route | medium | keep |
| `src/app/api/analytics/holding/route.ts` | `@/lib/campamento-base/analytics/holding-metrics` | campamento-base | api route | medium | keep |
| `src/app/api/bi/onboarding/route.ts` | `@/lib/campamento-base/bi/knowledge-base` | campamento-base | api route | medium | keep |
| `src/app/api/templates/route.ts` | `@/lib/campamento-base/templates/marketplace` | campamento-base | api route | medium | migrate later |
| `src/app/api/templates/[slug]/route.ts` | `@/lib/campamento-base/templates/marketplace` | campamento-base | api route | medium | migrate later |
| `src/app/api/stripe/wizard/setup/route.ts` | `@/lib/campamento-base/stripe-wizard/flow` | campamento-base | api route | high | review manually |
| `src/app/api/campamento-base/orchestrator/route.ts` | `@/lib/campamento-base/orchestrator` | campamento-base | api route | medium | keep |
| `src/app/api/campamento-base/operator/whatsapp/daily-summary/route.ts` | `@/lib/campamento-base/operator-whatsapp-notifications` | campamento-base | api route | medium | keep |
| `src/app/api/campamento-base/operator/whatsapp/realtime-alert/route.ts` | `@/lib/campamento-base/operator-whatsapp-notifications` | campamento-base | api route | medium | keep |
| `src/app/api/operator/events/route.ts` | `@/lib/campamento-base/operator-whatsapp-notifications` | campamento-base | api route | high | review manually |
| `src/app/site/panel/page.tsx` | `@/lib/campamento-base/ai-blueprint-v2/prompts` | campamento-base | app route | medium | migrate later |
| `src/components/foundry/foundry-workplace.tsx` | `@/lib/campamento-base/*` | campamento-base | component | medium | keep |
| `src/components/marketplace/elite-marketplace.tsx` | `@/lib/campamento-base/templates/marketplace` | campamento-base | component | medium | migrate later |
| `src/components/onboarding/elite-interview.tsx` | `@/lib/campamento-base/*` | campamento-base | component | medium | keep |
| `src/app/_saas_broken/create/*.tsx|ts` | `@/lib/campamento-base/*` | campamento-base | app route | low | deprecate |
| `src/lib/campamento-base/*` (self imports) | `@/lib/campamento-base/*` | campamento-base | lib | low | keep |
| `src/lib/interviews/orchestrator.ts` | `@/lib/campamento-base/ai-blueprint-v2/prompts` | campamento-base | lib | medium | keep |
| `tests/*` (10 archivos) | varios `@/lib/campamento-base/*` | campamento-base | test | low | keep |
| `scripts/stripe-idempotence.ts` | `@/lib/campamento-base/provisioning/stripe-factory` | campamento-base | script | medium | keep |
| `scripts/verify-provisioning-states.ts` | `@/lib/campamento-base/saas-factory-orchestrator` | campamento-base | script | high | review manually |
| `scripts/lib/control-plane-separation-audit.ts` | token checks `@/lib/campamento-base/` | campamento-base | script | low | keep |
| `scripts/check-production-readiness.ts` | token check `@/lib/campamento-base` | campamento-base | script | low | keep |
| `docs/*` (8 archivos) | menciones `@/lib/campamento-base` | campamento-base | docs | low | keep |

#### B) Referencias a `@/lib/campobase*`

| Path origen | Import detectado | Namespace usado | Capa origen | Riesgo | Acción recomendada |
|---|---|---|---|---|---|
| `src/app/api/operator/socialflow/route.ts` | `@/lib/campobase/socialflow-service` | campobase | api route | **critical** | replace with internal API |
| `src/app/api/operator/platform/route.ts` | `@/lib/campobase/platform-operator-service` | campobase | api route | high | migrate later |
| `src/components/campobase/CampoBaseSocialAutomationControl.tsx` | `@/lib/campobase/socialflow-service` | campobase | component | high | replace with canonical import |
| `src/components/campobase/PlatformOperatorControlSurface.tsx` | `@/lib/campobase/platform-operator-service` | campobase | component | medium | migrate later |
| `src/lib/campamento-base/orchestrator/snapshot-db.ts` | `@/lib/campobase/socialflow-service` | campobase | lib | **critical** | replace with internal API |
| `src/lib/campobase/platform-bootstrap.ts` | dynamic imports `@/lib/campobase/*` | campobase | lib | high | migrate later |
| `src/lib/campobase/clinic-platform.ts` | `@/lib/campobase/clinic-platform-service` | campobase | lib | medium | migrate later |
| `src/lib/campobase/platform-operator-service.ts` | `@/lib/campobase/platform-bootstrap` | campobase | lib | high | migrate later |
| `src/lib/campobase/socialflow-platform.ts` | dynamic import `@/lib/campobase/socialflow-service` | campobase | lib | high | migrate later |
| `src/lib/campobase/taskops-platform.ts` | `@/lib/campobase/taskops-platform-service` | campobase | lib | medium | migrate later |
| `src/lib/operator/socialflow-service.ts` | re-export de `@/lib/campobase/socialflow-service` | campobase | lib | high | deprecate |
| `src/lib/operator/social-automation-history.ts` | re-export de `@/lib/campobase/social-automation-history` | campobase | lib | medium | deprecate |
| `tests/*` (22 archivos) | mocks/asserts/imports `@/lib/campobase/*` | campobase | test | medium | migrate later |
| `scripts/lib/control-plane-separation-audit.ts` | token checks `@/lib/campobase/` | campobase | script | low | keep |
| `scripts/check-production-readiness.ts` | token check `@/lib/campobase` | campobase | script | low | keep |
| `docs/*` (10 archivos) | menciones `@/lib/campobase` | campobase | docs | low | review manually |

---

## 4) Decisión de canonicalización

### Propuesta (alineada a decisión inicial)

- **Namespace canónico final:** `src/lib/campamento-base/`
- **Namespace legacy temporal:** `src/lib/campobase/`

### Reglas propuestas

1. **Nuevo código**
- Prohibido crear nuevos módulos en `src/lib/campobase/`.
- Todo nuevo módulo de control-plane en `src/lib/campamento-base/`.

2. **Imports existentes**
- Migración archivo por archivo (nunca big-bang).
- Mantener adapters/facades temporales para rollback y compatibilidad.
- Priorizar primero consumidores `lib` críticos, luego `api`, luego `components`, luego tests.

3. **Documentación**
- En docs técnicas, tratar `campobase` explícitamente como `legacy/compat`.
- Nuevos runbooks y contratos deben referenciar canónico `campamento-base`.

4. **Tests**
- Permitir referencias legacy solo en tests de compatibilidad/guardrails.
- Añadir guardrail de “no new imports” hacia `@/lib/campobase/*` fuera de lista permitida.

5. **Retiro legacy**
- No borrar `src/lib/campobase/` hasta migrar y validar todos los consumidores.

---

## 5) Impacto sobre SocialFlow Phase C

Archivo analizado: `src/lib/campobase/socialflow-service.ts`

### Por qué es el blocker grande actual

- Es un hub de alto alcance para operator actions/status/runs/toggles y se usa por API + UI + facades.
- Importa directamente contrato SocialFlow interno:
  - `@/lib/socialflow/contracts/campobase`
- Mantiene acople directo Campobase ↔ SocialFlow, bloqueando separación limpia a Worker.

### Qué importa actualmente desde SocialFlow

- `getSocialFlowCampobaseOperatorObservabilityContract`
- `runSocialFlowCampobaseAutomationContract`
- `runSocialFlowCampobaseOperatorActionContract`
- tipos `SocialFlowOperatorObservability`, `SocialFlowOperatorAction`, `SocialFlowOperatorActionResult`

### Consumidores principales (runtime)

- `src/app/api/operator/socialflow/route.ts`
- `src/components/campobase/CampoBaseSocialAutomationControl.tsx`
- `src/lib/campamento-base/orchestrator/snapshot-db.ts`
- `src/lib/campobase/socialflow-platform.ts` (dynamic import)
- `src/lib/operator/socialflow-service.ts` (facade re-export)

### ¿Moverlo a campamento-base o reemplazar por cliente interno?

- Menor riesgo: **reemplazar dependencia interna por cliente interno** manteniendo ubicación temporal de archivo durante C.2.
- Mover de carpeta + cambiar dependencia a la vez incrementa blast radius (naming + runtime behavior en un solo paso).

### ¿Conviene resolver naming antes de sustituir import a SocialFlow?

- Sí para reglas/guardrails/documentación.
- No para migración física completa: primero cortar acople de contrato (C.2), luego migración de namespace en pasos pequeños.

### Opción de menor riesgo

1. Congelar namespace (`campobase` = legacy) con guardrails.
2. Sustituir import de contrato SocialFlow por cliente interno (sin mover archivo todavía).
3. Validar runtime/tests.
4. Recién después evaluar traslado/facade canónica.

### Qué NO debe tocarse todavía

- No mover carpetas ni renombrar namespaces en bloque.
- No borrar `src/lib/campobase/`.
- No tocar runtime SocialFlow interno fuera del contrato de cliente interno acordado.
- No mezclar Phase C.2 con refactor de naming masivo en un único commit.

---

## 6) Plan por commits (propuesto, no implementado)

### Commit 1 — Reglas de namespace y freeze de ambigüedad

- Objetivo:
  - Documentar política canónica/legacy y frontera de uso.
- Archivos a tocar:
  - `docs/architecture-namespaces.md` (o nueva sección específica)
  - `docs/audits/CAMPAMENTO_BASE_VS_CAMPOBASE_NAMESPACE_AUDIT.md`
- NO tocar:
  - `src/lib/campobase/*`, `src/lib/campamento-base/*` código runtime.
- Tests necesarios:
  - ninguno obligatorio (doc-only)
- Validaciones:
  - opcional `pnpm typecheck`
- Riesgo:
  - low
- Rollback:
  - revert docs

### Commit 2 — Guardrail no-new-imports a campobase

- Objetivo:
  - Evitar nuevas dependencias a `@/lib/campobase/*` fuera de allowlist.
- Archivos a tocar:
  - `tests/architecture/legacy-alias-boundaries.test.ts` o nuevo test guardrail
  - (si aplica) `scripts/lib/control-plane-separation-audit.ts`
- NO tocar:
  - runtime productivo.
- Tests necesarios:
  - test guardrail + su ejecución puntual
- Validaciones:
  - `pnpm typecheck`
  - test guardrail puntual
- Riesgo:
  - low
- Rollback:
  - revert test/script guardrail

### Commit 3 — Facade canónica/adaptador temporal

- Objetivo:
  - Introducir entrada canónica estable en `campamento-base` que delegue temporalmente a legacy.
- Archivos a tocar:
  - nuevo facade en `src/lib/campamento-base/...` (adapter explícito)
  - tests de compatibilidad del facade
- NO tocar:
  - lógica interna de SocialFlow
  - mover archivos legacy
- Tests necesarios:
  - unit test facade + contrato de import
- Validaciones:
  - `pnpm typecheck`
  - vitest puntual facade
- Riesgo:
  - medium
- Rollback:
  - revert facade/test

### Commit 4 — Migrar primer archivo de bajo riesgo

- Objetivo:
  - Migrar un módulo de bajo acople (ej. historial/registry o façade operator simple) de manera incremental.
- Archivos a tocar:
  - un archivo seleccionado `campobase` + referencias directas mínimas
- NO tocar:
  - `src/lib/campobase/socialflow-service.ts`
- Tests necesarios:
  - tests del módulo migrado + smoke import boundaries
- Validaciones:
  - `pnpm typecheck`
  - vitest puntual del módulo
- Riesgo:
  - medium
- Rollback:
  - revert módulo + consumidores puntuales

### Commit 5 — Preparar `socialflow-service` para C.2 (sin romper Campobase)

- Objetivo:
  - Aislar puntos de llamada para swap a cliente interno (sin mover namespace aún).
- Archivos a tocar:
  - `src/lib/campobase/socialflow-service.ts` (solo costura de dependencia)
  - tests de `campobase-socialflow-service`
- NO tocar:
  - `src/lib/socialflow/*` runtime profundo
  - renombres de carpeta
- Tests necesarios:
  - `tests/lib/campobase-socialflow-service.test.ts`
  - `tests/api/campobase-socialflow-route.test.ts`
  - tests internos SocialFlow API ya existentes
- Validaciones:
  - `pnpm typecheck`
  - vitest puntual de socialflow route/service
- Riesgo:
  - high
- Rollback:
  - revert costura + tests ajustados

---

## 7) Validaciones

- Ejecutado por seguridad (audit-only):
  - `pnpm typecheck` → **OK**
- No se ejecutó suite completa.

---

## 8) Conclusión obligatoria

- Archivo creado: **sí**
- Ruta exacta: `docs/audits/CAMPAMENTO_BASE_VS_CAMPOBASE_NAMESPACE_AUDIT.md`
- Namespace canónico recomendado: **`src/lib/campamento-base/`**
- Namespace legacy recomendado: **`src/lib/campobase/`**
- Número de archivos en `src/lib/campamento-base/`: **25**
- Número de archivos en `src/lib/campobase/`: **10**
- Número de imports hacia `@/lib/campamento-base` (código/tests/scripts): **65**
- Número de imports hacia `@/lib/campobase` (código/tests/scripts): **52**
- Duplicidades detectadas: **sí** (superposición funcional en 5 áreas; no duplicado 1:1 de archivo)
- ¿Se puede continuar Phase C.2 ahora?: **no** (primero consolidar guardrails de namespace + estrategia de corte controlada para `socialflow-service`)
- Siguiente commit recomendado (sin implementarlo):
  - `chore(architecture): codify campamento-base canonical namespace rules and freeze new campobase imports`
