# Campamento Base Social Automation History Contract v1

## 1. Purpose

Este contrato existe para:
- sustituir gradualmente `src/lib/campobase/social-automation-history.ts`;
- definir el módulo canónico futuro en `src/lib/campamento-base/`;
- mantener compatibilidad con `src/lib/operator/social-automation-history.ts`;
- evitar una migración 1:1 sin contrato estable y explícito.

Alcance de este bloque:
- documentación contractual únicamente;
- sin implementación técnica;
- sin cambios de imports, runtime o tests.

## 2. Ownership

Ownership definido:
- Campamento Base es dueño del historial de automatización social como **control-plane history**.
- SocialFlow puede producir eventos/resultados de ejecución, pero el historial operacional canónico lo conserva Campamento Base.
- `src/lib/operator/` puede consumir y exponer este historial como facade para UI/operator.
- `src/lib/campobase/` queda como adapter legacy temporal durante migración controlada.

Regla canónica obligatoria:
- Campamento Base es canónico.
- `src/lib/campamento-base/` es el namespace canónico para historial/control-plane.
- `src/lib/operator/` puede ser facade de consumo.
- Campobase es legacy congelado.
- `src/lib/campobase/` solo se mantiene como compatibilidad temporal.
- No se debe crear ningún archivo nuevo con nombre `campobase`.
- No se debe crear ningún import nuevo hacia `@/lib/campobase`.

## 3. Current legacy state

Estado actual documentado:
- `src/lib/campobase/social-automation-history.ts`
  - implementación legacy real (persistencia y consultas de historial).
- `src/lib/operator/social-automation-history.ts`
  - facade/bridge que actualmente reexporta desde legacy.

Consumidores detectados:
- `src/app/operator/social/page.tsx`
- `tests/components/campobase-social-page.test.tsx`
- `tests/lib/campobase-social-automation-history.test.ts`
- `tests/architecture/campobase-namespace-freeze.test.ts`

Equivalencia parcial vs paridad completa:
- Existe equivalencia parcial en `src/lib/campamento-base/socialflow-control-plane-service.ts` para lecturas de historial.
- No existe paridad completa 1:1 con legacy (en especial para capacidades de registro tipo `recordCampoBaseSocialAutomationRun` y compatibilidad total de contrato).

## 4. Canonical API surface

El futuro módulo canónico (propuesto para `src/lib/campamento-base/social-automation-history.ts`) debe exponer, como mínimo, esta superficie:

### 4.1 Read APIs
- `listSocialAutomationRuns(input?: ListSocialAutomationRunsInput): Promise<SocialAutomationHistoryRun[]>`
- `listSocialAutomationRunsForSaas(input: ListSocialAutomationRunsForSaasInput): Promise<SocialAutomationHistoryRun[]>`
- `getSocialAutomationHistorySummary(input?: GetSocialAutomationHistorySummaryInput): Promise<SocialAutomationHistorySummary>`

### 4.2 Write APIs
- `recordSocialAutomationRun(input: RecordSocialAutomationRunInput): Promise<SocialAutomationHistoryRun>`
- `recordSocialAutomationFailure(input: RecordSocialAutomationFailureInput): Promise<SocialAutomationHistoryRun>`

### 4.3 Contract capabilities required
- listar historial por SaaS;
- listar historial global;
- registrar ejecución de automatización;
- registrar error/estado fallido;
- obtener resumen agregado;
- normalizar shape de run para consumo UI/operator;
- soporte para idempotencia con `requestId`;
- timestamps explícitos (`startedAt`, `completedAt`, `createdAt`);
- status y error model estables;
- no dependencias nuevas a `@/lib/campobase`.

### 4.4 Proposed supporting types
- `SocialAutomationHistoryRun`
- `SocialAutomationRunStatus`
- `SocialAutomationRunResult`
- `SocialAutomationRunError`
- `SocialAutomationHistorySummary`
- `RecordSocialAutomationRunInput`
- `RecordSocialAutomationFailureInput`
- `ListSocialAutomationRunsInput`
- `ListSocialAutomationRunsForSaasInput`
- `GetSocialAutomationHistorySummaryInput`

## 5. Data shape

Shape estable propuesto para `SocialAutomationHistoryRun`:

```ts
type SocialAutomationHistoryRun = {
  id: string;
  saasId: string;
  automationKey: string;
  status: "QUEUED" | "RUNNING" | "SUCCESS" | "FAILED" | "CANCELED";
  startedAt: string;
  completedAt: string | null;
  durationMs: number | null;
  result: {
    campaignId?: string | null;
    postsCount?: number;
    scheduledCount?: number;
    metadata?: Record<string, unknown>;
  } | null;
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
    retryable?: boolean;
  } | null;
  triggeredBy: {
    actorType: "SYSTEM" | "OPERATOR" | "SCHEDULE" | "API";
    actorId?: string | null;
  };
  requestId: string | null;
  createdAt: string;
};
```

Compatibilidad con tipos legacy actuales:
- el contrato debe permitir mapear sin ruptura los campos legacy (`tenantId`, `campaignId`, `postsCount`, `scheduledCount`, `error`, `startedAt`, `finishedAt/createdAt` según origen);
- durante migración, adapters pueden completar/defaultear campos no presentes para mantener compatibilidad gradual;
- UI/operator no debe romperse por cambios de shape mientras exista adapter.

## 6. Error and status model

### 6.1 Allowed statuses
- `QUEUED`
- `RUNNING`
- `SUCCESS`
- `FAILED`
- `CANCELED`

Notas de compatibilidad:
- legacy actual usa principalmente `SUCCESS`/`FAILED`;
- el contrato v1 permite estados extendidos para evolución sin romper consumidores;
- adapters legacy pueden reducir temporalmente a `SUCCESS`/`FAILED` donde aplique.

### 6.2 Expected error categories
- `SOCIAL_AUTOMATION_VALIDATION_ERROR`
- `SOCIAL_AUTOMATION_NOT_FOUND`
- `SOCIAL_AUTOMATION_CONFLICT`
- `SOCIAL_AUTOMATION_TIMEOUT`
- `SOCIAL_AUTOMATION_STORAGE_ERROR`
- `SOCIAL_AUTOMATION_UNKNOWN_ERROR`

### 6.3 Legacy error mapping
Mapeo orientativo de legacy a contrato:
- `null`/sin error -> `error: null`
- mensaje libre legacy -> `error.code = SOCIAL_AUTOMATION_UNKNOWN_ERROR`, `error.message = <mensaje legacy>`
- errores de validación conocidos -> `SOCIAL_AUTOMATION_VALIDATION_ERROR`
- errores de persistencia -> `SOCIAL_AUTOMATION_STORAGE_ERROR`

### 6.4 No UI/operator breakage rule
- mantener nombre y semántica de campos críticos consumidos por operator/UI durante transición;
- agregar campos nuevos en modo compatible (opt-in/defaults);
- preservar compatibilidad vía facade `src/lib/operator/` y adapter temporal legacy.

## 7. Migration strategy

### Phase A — Contract only
- solo este documento contractual;
- sin cambios de código.

### Phase B — Create canonical module
- crear `src/lib/campamento-base/social-automation-history.ts`;
- implementar la API canónica definida por este contrato.

### Phase C — Convert operator facade
- actualizar `src/lib/operator/social-automation-history.ts` para reexportar desde canónico.

### Phase D — Convert legacy adapter
- convertir `src/lib/campobase/social-automation-history.ts` en adapter temporal al canónico;
- mantener compatibilidad de transición sin nuevas dependencias legacy.

### Phase E — Update tests and shrink allowlist
- actualizar tests dependientes de imports/contracts legacy;
- reducir allowlist en `tests/architecture/campobase-namespace-freeze.test.ts`.

## 8. Non-goals

Este bloque no incluye:
- tocar UI;
- tocar rutas;
- tocar SocialFlow runtime;
- eliminar legacy todavía;
- cambiar `platform-bootstrap`;
- tocar Clinic runtime;
- tocar TaskOps runtime;
- tocar Mentoria;
- tocar migrations;
- refactor general.

## 9. First safe implementation block proposal

### 9.1 Objective
Implementar el primer bloque técnico mínimo y seguro para materializar este contrato sin romper runtime: crear módulo canónico de historial y preparar bridges/adapters sin eliminar legacy.

### 9.2 Files to create
- `src/lib/campamento-base/social-automation-history.ts`

### 9.3 Files to modify
- `src/lib/operator/social-automation-history.ts` (reexport al canónico)
- `src/lib/campobase/social-automation-history.ts` (adapter temporal al canónico)
- `tests/lib/campobase-social-automation-history.test.ts` (si aplica, ajustar a contrato/adaptador)
- `tests/architecture/campobase-namespace-freeze.test.ts` (shrink allowlist cuando corresponda)

### 9.4 Files that must NOT be touched in that block
- componentes UI (`src/components/**`)
- rutas API (`src/app/api/**`)
- runtime SocialFlow/Clinic/TaskOps/Mentoria
- `platform-bootstrap`
- migrations

### 9.5 Required tests
- `pnpm typecheck`
- `npx vitest run tests/architecture/campobase-namespace-freeze.test.ts`
- tests unitarios focalizados del contrato de historial (canónico + adapter)

### 9.6 Validations
- no nuevos imports a `@/lib/campobase`;
- `src/lib/campamento-base/` como fuente canónica;
- facade operator funcional;
- adapter legacy temporal funcional;
- guardrail freeze actualizado solo al final del bloque.

### 9.7 Rollback
- revertir creación del módulo canónico y cambios de facade/adapter;
- restaurar estado previo de tests/allowlist;
- mantener bridge legacy original si cualquier validación falla.

### 9.8 Why this is the safest next step
- separa diseño contractual de implementación;
- reduce riesgo de migración 1:1 ciega;
- preserva compatibilidad para UI/operator;
- controla deuda legacy mediante adapter temporal y shrink progresivo del freeze allowlist.
