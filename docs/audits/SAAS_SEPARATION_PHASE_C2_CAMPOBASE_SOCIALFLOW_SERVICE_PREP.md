# SAAS Separation — Phase C.2 Prep (Campobase SocialFlow Service)

Fecha: 2026-06-06
Alcance: auditoría reducida de `src/lib/campobase/socialflow-service.ts` para preparar Phase C.2.

---

## Bloque 1 — Archivo blocker

Archivo inspeccionado: `src/lib/campobase/socialflow-service.ts`

### Imports actuales

- Desde `@/lib/automation-core`:
  - `AutomationCoreError`
  - `registerAutomation`, `registerAutomationHandler`
  - `triggerAutomation`
  - `enableAutomation`, `disableAutomation`, `getAutomation`
  - `listAutomations`, `listAutomationExecutions`, `getAutomationExecutionSummary`
  - Tipos `AutomationExecution`, `AutomationExecutionResult`, `AutomationRegistration`
- Desde `@/lib/socialflow/contracts/campobase`:
  - `runSocialFlowCampobaseAutomationContract`
  - `getSocialFlowCampobaseOperatorObservabilityContract`
  - `runSocialFlowCampobaseOperatorActionContract`
  - Tipos `SocialFlowOperatorObservability`, `SocialFlowOperatorAction`, `SocialFlowOperatorActionResult`

### Exports actuales (resumen)

- Constantes:
  - `SOCIALFLOW_CONTENT_GENERATION_KEY`
  - `SOCIALFLOW_HEALTH_CHECK_KEY`
  - `SOCIALFLOW_AUTOMATION_KEY`
- Tipos de entrada/salida y estado para automatización, batch, runs, observabilidad y operator actions.
- Funciones públicas principales:
  - Registro/config: `registerCampoBaseSocialAutomation`, `registerCampoBaseSocialHealthCheck`
  - Ejecución: `runCampoBaseSocialAutomation`, `runCampoBaseSocialAutomationForRegisteredSaas`, `runCampoBaseSocialHealthCheckForRegisteredSaas`, `runCampoBaseSocialAutomationForAllRegisteredSaas`, `runCampoBaseSocialAutomationForSelectedSaas`
  - Estado/consultas: `getCampoBaseSocialAutomationStatus`, `getCampoBaseSocialAutomationStatusForSaas`, `listCampoBaseSocialAutomationRuns`, `listCampoBaseSocialAutomationRunsForSaas`, `getCampoBaseSocialAutomationRunSummary`
  - Observabilidad/operación: `getCampoBaseSocialFlowObservability`, `runCampoBaseSocialFlowOperatorAction`
  - Toggle: `enableCampoBaseSocialAutomationForSaas`, `disableCampoBaseSocialAutomationForSaas`, `setCampoBaseSocialAutomationState`

### Funciones principales (comportamiento)

- Registra dos handlers en load-time con `registerAutomationHandler`:
  - `socialflow.content_generation` (usa contrato legacy de automation).
  - `socialflow.health_check` (health local simplificado).
- Orquesta registro/trigger/listado con `automation-core`.
- Expone observabilidad/operator actions vía contrato legacy (`@/lib/socialflow/contracts/campobase`).
- Adapta errores de dominio (`NOT_CONFIGURED`, `DISABLED`, etc.).

### Qué importa desde `@/lib/socialflow/contracts/campobase`

- `runSocialFlowCampobaseAutomationContract`
- `getSocialFlowCampobaseOperatorObservabilityContract`
- `runSocialFlowCampobaseOperatorActionContract`
- Tipos re-exportados para observabilidad y operator actions.

### Responsabilidad aparente

- Fachada de integración Campobase ↔ SocialFlow + bridge al `automation-core`.
- Punto central consumido por route de operador, componentes UI y utilidades internas.

### Riesgo general

- **Alto**:
  - Bloquea separación completa por dependencia directa a `@/lib/socialflow/contracts/campobase`.
  - Acoplamiento runtime + side-effects al importar módulo (registro de handlers).
  - Superficie pública amplia (muchos consumidores y tests), cualquier cambio sin adapter puede romper flujo operator.

---

## Bloque 2 — Consumidores directos de `@/lib/campobase/socialflow-service`

> Nota: se listan consumidores reales (imports/re-export/dynamic import). Se excluyen menciones textuales en asserts/allowlists.

| Path | Import usado | Función/uso detectado | Capa | Riesgo |
|---|---|---|---|---|
| `src/app/api/operator/socialflow/route.ts` | named import | Usa registro, run, toggle, history, observabilidad y operator actions | api route | Alto |
| `src/components/campobase/CampoBaseSocialAutomationControl.tsx` | type-only import | Usa tipos de `status/result/observability/operatorAction` | component | Bajo |
| `src/lib/campamento-base/orchestrator/snapshot-db.ts` | named import | `getCampoBaseSocialAutomationStatus` | lib | Medio |
| `src/lib/campobase/socialflow-platform.ts` | dynamic import | `await import("@/lib/campobase/socialflow-service")` para bootstrap/side-effects | lib | Medio-Alto |
| `src/lib/operator/socialflow-service.ts` | re-export | `export * from ...` (puente legacy) | lib | Medio |
| `tests/api/campobase-socialflow-route.test.ts` | `vi.mock(...)` | Mockea `getCampoBaseSocialAutomationStatus`, `getCampoBaseSocialFlowObservability`, `runCampoBaseSocialFlowOperatorAction` | test | Bajo |
| `tests/components/campobase-social-page.test.tsx` | type-only import | Tipo `CampoBaseSocialAutomationStatusOutput` | test | Bajo |
| `tests/components/operator-socialflow-health-panel.test.tsx` | type-only import | Tipos `CampoBaseSocialAutomationStatusOutput`, `CampoBaseSocialFlowObservability` | test | Bajo |
| `tests/lib/campobase-socialflow-service.test.ts` | named import | Cubre registro, run, toggle, status, history | test | Medio |

---

## Bloque 3 — Mapeo legacy vs endpoints internos

Endpoints internos disponibles:

- `GET /api/internal/socialflow/health`
- `GET /api/internal/socialflow/owner/snapshot`
- `GET /api/internal/socialflow/observability/snapshot`
- `POST /api/internal/socialflow/events`
- `POST /api/internal/socialflow/automation/trigger`
- `POST /api/internal/socialflow/operator/actions`

### Matriz de mapeo

| Función legacy (socialflow-service) | Endpoint equivalente | ¿Cubre necesidad? | ¿Adapter? | ¿Cliente interno nuevo? | ¿Ampliar tipos? |
|---|---|---|---|---|---|
| `runCampoBaseSocialAutomation` | `POST /internal/socialflow/automation/trigger` | Parcial (endpoint actual encola y usa `automationType`; no devuelve `campaignId/posts/schedule`) | Sí | Sí | Sí (request/response) |
| Handler `socialflow.content_generation` (registro en load-time) | `POST /internal/socialflow/automation/trigger` | Parcial | Sí | Sí | Sí |
| `getCampoBaseSocialFlowObservability` | `GET /internal/socialflow/observability/snapshot` | Parcial (snapshot neutral y shape distinto al observability operator legacy) | Sí | Sí | Sí (shape observability) |
| `runCampoBaseSocialFlowOperatorAction` | `POST /internal/socialflow/operator/actions` | Parcial (acciones internas no coinciden con `recover_stale_publishing`/`retry_failed_posts`) | Sí | Sí | Sí (action enum + resultado) |
| `runCampoBaseSocialHealthCheckForRegisteredSaas` | `GET /internal/socialflow/health` | Parcial/baja (health endpoint es servicio global, no health de workspace registrado) | Sí | Opcional | Sí (si se desea paridad funcional) |
| `getCampoBaseSocialAutomationStatus` / history / toggle / register | No equivalente directo en lista interna actual | No | N/A | Sí (si se migra totalmente a internal API) | Sí |
| Emisión de eventos (no existe función dedicada hoy) | `POST /internal/socialflow/events` | Potencial (telemetría) | Sí | Sí | Menor |

### Lectura arquitectónica

- Los endpoints internos están en estado contrato estable inicial (varios responden neutral/queued), por lo que hoy dan **cobertura parcial** para reemplazo 1:1.
- Para C.2 segura, la migración debe entrar por **adapter** (compat layer) y no por sustitución brusca de tipos/salidas.

---

## Bloque 4 — Estrategia Phase C.2 (opciones)

### Opción A
Mantener `src/lib/campobase/socialflow-service.ts` como facade temporal usando cliente interno.

- Riesgo: Medio
- Impacto: Bajo-Medio
- Archivos implicados: 1 cliente interno nuevo + `socialflow-service.ts` + tests existentes
- Tests necesarios: `tests/lib/campobase-socialflow-service.test.ts`, `tests/api/campobase-socialflow-route.test.ts`, freeze test
- Rollback: sencillo (revert del facade al import legacy)
- Pros: mínimo churn de consumidores
- Contras: mantiene lógica crítica en namespace legacy

### Opción B
Crear servicio canónico en `src/lib/campamento-base/` y dejar `src/lib/campobase/socialflow-service.ts` como adapter temporal.

- Riesgo: Medio-Bajo
- Impacto: Medio
- Archivos implicados: servicio canónico + cliente interno + adapter legacy + tests
- Tests necesarios: tests nuevos de servicio canónico + regresión de tests actuales del adapter
- Rollback: bueno (adapter mantiene interfaz previa)
- Pros: alinea con namespace canónico y reduce deuda estructural sin romper consumidores
- Contras: más archivos que Opción A

### Opción C
Migrar consumidores uno por uno a clientes internos y luego deprecar `socialflow-service.ts`.

- Riesgo: Medio-Alto
- Impacto: Alto
- Archivos implicados: múltiples rutas/componentes/libs/tests
- Tests necesarios: amplia regresión transversal
- Rollback: más complejo (cambios distribuidos)
- Pros: elimina dependencia legacy por consumo directo
- Contras: mayor superficie y mayor probabilidad de drift/regresión

### Recomendación final

- **Recomendada: Opción B (canónico + adapter temporal)**
  - Balancea seguridad operativa con dirección arquitectónica canónica.
  - Permite remover el import crítico legacy en `socialflow-service.ts` sin forzar migración masiva de consumidores en C.2.

---

## Bloque 5 — Cliente interno recomendado

### Opción 1
`src/lib/capabilities/internal-api-clients/socialflow-campobase.ts` (cliente unificado)

### Opción 2
Clientes separados:
- `socialflow-automation.ts`
- `socialflow-observability.ts`
- `socialflow-operator.ts`
- `socialflow-events.ts`

### Recomendación

- **Recomendada: Opción 1 (cliente unificado)** para el primer paso real de C.2.
  - Menor overhead inicial.
  - Menos puntos de configuración de auth headers/token/requestId.
  - Más simple para introducir adapters de compatibilidad de tipos while preserving legacy API.
- Evolución posterior: dividir por dominio cuando el contrato interno deje estado neutral/queued y haya más consumidores directos.

---

## Bloque 6 — Primer commit real de Phase C.2 (propuesto, no implementado)

### Nombre sugerido

`feat(campamento-base): introduce socialflow internal facade adapter for campobase`

### Objetivo

Eliminar dependencia directa de `@/lib/socialflow/contracts/campobase` en `src/lib/campobase/socialflow-service.ts` usando un servicio canónico + adapter temporal compatible.

### Archivos a crear

- `src/lib/capabilities/internal-api-clients/socialflow-campobase.ts`
- `src/lib/campamento-base/socialflow/service.ts`
- `tests/lib/campamento-base-socialflow-service.test.ts`

### Archivos a modificar

- `src/lib/campobase/socialflow-service.ts` (solo wiring de contrato hacia servicio canónico; sin romper API exportada)
- `tests/lib/campobase-socialflow-service.test.ts` (mocks/adapters)
- `tests/api/campobase-socialflow-route.test.ts` (si requiere actualizar mocks de borde)

### Archivos que NO se deben tocar

- Cualquier archivo de Mentoría
- Cualquier archivo de Clinic
- `migrations/*`
- Endpoints internos existentes (`src/app/api/internal/socialflow/**`) en este primer commit
- Workers y configuraciones de deploy

### Tests nuevos/modificados

- Nuevo: `tests/lib/campamento-base-socialflow-service.test.ts`
- Modificados: `tests/lib/campobase-socialflow-service.test.ts`, potencialmente `tests/api/campobase-socialflow-route.test.ts`
- Mantener: `tests/architecture/campobase-namespace-freeze.test.ts`

### Validaciones del commit

- `pnpm typecheck`
- `npx vitest run tests/lib/campobase-socialflow-service.test.ts`
- `npx vitest run tests/api/campobase-socialflow-route.test.ts`
- `npx vitest run tests/architecture/campobase-namespace-freeze.test.ts`

### Rollback

- Revert único commit.
- Adapter legacy en `src/lib/campobase/socialflow-service.ts` permite fallback directo sin tocar consumidores.

### Por qué es el paso más seguro

- Cambia el borde de integración (blocker import) sin forzar migración masiva.
- Preserva API pública actual de Campobase.
- Mantiene capacidad de rollback rápido.

---

## Validaciones solicitadas en este checkpoint

Comandos solicitados por el usuario:

- `pnpm typecheck`
- `npx vitest run tests/architecture/campobase-namespace-freeze.test.ts`

Resultado:

- `npx vitest run tests/architecture/campobase-namespace-freeze.test.ts` ✅ (2/2 tests)
- `pnpm typecheck` ✅ (exit code 0)

---

## Conclusión de checkpoint

- Archivo creado: **sí**
- Ruta: `docs/audits/SAAS_SEPARATION_PHASE_C2_CAMPOBASE_SOCIALFLOW_SERVICE_PREP.md`
- Tipo de informe: **completo (reducido y enfocado)**
- Import legacy crítico todavía presente: **sí** (`@/lib/socialflow/contracts/campobase` en `src/lib/campobase/socialflow-service.ts`)
- Consumidores directos detectados: **9** (5 runtime/lib+route+component + 4 tests)
- Opción recomendada para Phase C.2: **Opción B**
- Cliente interno recomendado: **Opción 1 (`socialflow-campobase.ts`)**
- Validaciones: **ejecutadas y exitosas** (`pnpm typecheck`, freeze test)
- ¿Se puede implementar C.2 después de este checkpoint?: **sí**
- Siguiente commit recomendado (sin implementar): `feat(campamento-base): introduce socialflow internal facade adapter for campobase`
