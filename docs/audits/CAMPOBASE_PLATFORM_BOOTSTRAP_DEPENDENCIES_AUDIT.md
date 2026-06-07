# CAMPOBASE Platform Bootstrap Dependencies Audit

**Fecha:** 2026-06-07  
**Bloque:** `audit platform bootstrap legacy dependencies before canonicalization`  
**Objetivo:** auditar módulos bloqueantes de `platform-bootstrap` para decidir el primer candidato seguro a canonicalización.

---

## 1) Inspección de módulos bloqueantes

### A) `src/lib/campobase/socialflow-platform.ts`

**Exports públicos**
- `SOCIALFLOW_PLATFORM_SAAS_ID`
- `socialFlowPlatformDefinition`
- `socialFlowPlatformBootstrap`

**Imports actuales**
- `@/lib/integration-core/providers/linkedin`
- `@/lib/saas-contract` (types + helpers)
- **dynamic import** `@/lib/campobase/socialflow-service`

**¿Importa desde `@/lib/campobase/*`?**
- Sí: `@/lib/campobase/socialflow-service`.

**¿Importa lógica interna de dominio?**
- SocialFlow: sí (arranque por `socialflow-service`).
- Clinic: no.
- TaskOps: no.

**Dependencias compartidas**
- `saas-contract`: sí.
- `integration-core`: sí (LinkedIn provider).
- `automation-core`: no.
- `observability-core`: no directo.

**Comportamiento que aporta al bootstrap**
- Define la metadata estática de plataforma SocialFlow (automations/integrations/matcher).
- En `connect()`, garantiza carga del servicio SocialFlow y disponibilidad de integración LinkedIn.

**¿Puede moverse a `src/lib/campamento-base/` sin contaminar namespace canónico?**
- **No en su estado literal actual** (por import a `@/lib/campobase/socialflow-service`).
- **Sí, condicionalmente**, si en canonicalización se apunta el `connect()` al servicio canónico ya existente (`@/lib/campamento-base/socialflow-control-plane-service`) sin introducir imports legacy.

**Riesgo**
- **Medium**.

---

### B) `src/lib/campobase/clinic-platform.ts`

**Exports públicos**
- `CLINIC_PLATFORM_SAAS_ID`
- `clinicPlatformDefinition`
- `clinicPlatformBootstrap`

**Imports actuales**
- `@/lib/integration-core/providers/whatsapp`
- `@/lib/saas-contract` (types + helpers)
- `@/lib/campobase/clinic-platform-service`

**¿Importa desde `@/lib/campobase/*`?**
- Sí: `@/lib/campobase/clinic-platform-service`.

**¿Importa lógica interna de dominio?**
- Clinic: sí (bootstrap de Clinic).
- SocialFlow: no.
- TaskOps: no.

**Dependencias compartidas**
- `saas-contract`: sí.
- `integration-core`: sí (WhatsApp provider).
- `automation-core`: no directo en este archivo.
- `observability-core`: no directo.

**Comportamiento que aporta al bootstrap**
- Publica definición estática de plataforma Clinic.
- En `connect()`, delega registro/arranque a `registerClinicPlatform` del servicio legacy de Clinic.

**¿Puede moverse a `src/lib/campamento-base/` sin contaminar namespace canónico?**
- **No actualmente**, porque no existe equivalente canónico de `clinic-platform-service` y mover literal requeriría import legacy.

**Riesgo**
- **High**.

---

### C) `src/lib/campobase/taskops-platform.ts`

**Exports públicos**
- `TASKOPS_PLATFORM_SAAS_ID`
- `taskOpsPlatformDefinition`
- `taskOpsPlatformBootstrap`

**Imports actuales**
- `@/lib/automation-core` (`AutomationCoreError`, `triggerAutomation`)
- `@/lib/saas-contract` (types + helpers)
- `@/lib/integration-core/providers/whatsapp`
- `@/lib/campobase/taskops-platform-service`

**¿Importa desde `@/lib/campobase/*`?**
- Sí: `@/lib/campobase/taskops-platform-service`.

**¿Importa lógica interna de dominio?**
- TaskOps: sí (registro de plataforma TaskOps + señal `task.overdue`).
- SocialFlow: no.
- Clinic: no.

**Dependencias compartidas**
- `saas-contract`: sí.
- `automation-core`: sí (trigger con manejo de in-progress).
- `integration-core`: sí (WhatsApp provider).
- `observability-core`: no directo.

**Comportamiento que aporta al bootstrap**
- Define plataforma TaskOps.
- Conecta bootstrap TaskOps en `connect()`.
- Expone `signalHandlers` para `task.overdue` con ejecución automática de auditoría pendiente.

**¿Puede moverse a `src/lib/campamento-base/` sin contaminar namespace canónico?**
- **No actualmente**, por dependencia directa a `taskops-platform-service` legacy (sin equivalente canónico).

**Riesgo**
- **High** (más lógica runtime/signal que Clinic/SocialFlow definition-only).

---

## 2) Consumidores directos actuales

### Consumidores de `@/lib/campobase/socialflow-platform`
| Path | Módulo usado | Capa | Riesgo | ¿Puede esperar? |
|---|---|---|---|---|
| `src/lib/campobase/platform-bootstrap.ts` | dynamic import `socialFlowPlatformDefinition`, `socialFlowPlatformBootstrap` | lib | high | no (bloquea canonicalización de bootstrap) |
| `tests/lib/saas-contract-definitions.test.ts` | import estático de definition/bootstrap | test | low | sí |
| `tests/lib/campobase-platform-bootstrap.test.ts` | `vi.mock("@/lib/campobase/socialflow-platform")` | test | low | sí |

### Consumidores de `@/lib/campobase/clinic-platform`
| Path | Módulo usado | Capa | Riesgo | ¿Puede esperar? |
|---|---|---|---|---|
| `src/lib/campobase/platform-bootstrap.ts` | dynamic import `clinicPlatformDefinition`, `clinicPlatformBootstrap` | lib | high | no |
| `tests/lib/saas-contract-definitions.test.ts` | import estático de definition/bootstrap | test | low | sí |
| `tests/lib/campobase-platform-bootstrap.test.ts` | `vi.mock("@/lib/campobase/clinic-platform")` | test | low | sí |

### Consumidores de `@/lib/campobase/taskops-platform`
| Path | Módulo usado | Capa | Riesgo | ¿Puede esperar? |
|---|---|---|---|---|
| `src/lib/campobase/platform-bootstrap.ts` | dynamic import `taskOpsPlatformDefinition`, `taskOpsPlatformBootstrap` | lib | high | no |
| `tests/lib/saas-contract-definitions.test.ts` | import estático de definition/bootstrap | test | low | sí |
| `tests/lib/campobase-platform-bootstrap.test.ts` | `vi.mock("@/lib/campobase/taskops-platform")` | test | low | sí |
| `tests/lib/cross-saas-taskops-flow.test.ts` | dynamic import `taskOpsPlatformDefinition`, `taskOpsPlatformBootstrap` | test | medium | migrar pronto tras canónico TaskOps |

**Nota:** hay referencias en docs/audits previas, pero no son consumidores de runtime.

---

## 3) Orden recomendado de canonicalización

### Opción A — Canonizar `socialflow-platform.ts`
- **Riesgo:** medium.
- **Impacto:** alto en reducción de bloqueo del bootstrap, con alcance acotado.
- **Dependencias:** `saas-contract`, `integration-core/providers/linkedin`, y ajuste de `connect()` para evitar `@/lib/campobase/socialflow-service`.
- **Tests necesarios:**
  - `tests/lib/saas-contract-definitions.test.ts`
  - `tests/lib/campobase-platform-bootstrap.test.ts`
  - `tests/architecture/campobase-namespace-freeze.test.ts`
- **Rollback:** revert del archivo canónico + restaurar import dynamic en adapter legacy.
- **Evaluación:** **mejor primer candidato** por menor acoplamiento legacy operativo que Clinic/TaskOps.

### Opción B — Canonizar `clinic-platform.ts`
- **Riesgo:** high.
- **Impacto:** medio.
- **Dependencias:** bloqueo por `@/lib/campobase/clinic-platform-service` (sin equivalente canónico).
- **Tests necesarios:**
  - `tests/lib/saas-contract-definitions.test.ts`
  - `tests/lib/campobase-clinic-platform-service.test.ts`
  - freeze namespace
- **Rollback:** simple, pero con alto riesgo de canónico contaminado si se fuerza ahora.
- **Evaluación:** no recomendado como primer paso.

### Opción C — Canonizar `taskops-platform.ts`
- **Riesgo:** high (cercano a critical por señales/automation).
- **Impacto:** medio/alto, pero con mayor superficie de regresión.
- **Dependencias:** `@/lib/campobase/taskops-platform-service` + `automation-core` + `signalHandlers`.
- **Tests necesarios:**
  - `tests/lib/saas-contract-definitions.test.ts`
  - `tests/lib/cross-saas-taskops-flow.test.ts`
  - `tests/lib/campobase-taskops-platform-service.test.ts`
  - freeze namespace
- **Rollback:** posible, pero mayor probabilidad de efectos colaterales de ejecución.
- **Evaluación:** no recomendado como primer paso.

### Opción D — No canonizar ninguno todavía
- **Riesgo:** low inmediato / medium de deuda.
- **Impacto:** posterga reducción de legacy y deja bloqueado `platform-bootstrap`.
- **Dependencias:** crear primero contratos/interfaces compartidos o servicios canónicos faltantes.
- **Tests necesarios:** ninguno nuevo inmediato.
- **Rollback:** no aplica (sin cambios).
- **Evaluación:** válido si se prioriza cero riesgo absoluto, pero frena progreso.

### Recomendación final
- **Primero:** **Opción A** (`socialflow-platform.ts`) en bloque mínimo y controlado.
- **Después:** preparar equivalentes canónicos de Clinic/TaskOps antes de intentar B/C.

---

## 4) Plan incremental propuesto (sin implementación)

### Bloque 1 (recomendado)
- **Primer módulo a canonizar:** `socialflow-platform.ts`.
- **Archivo canónico a crear:** `src/lib/campamento-base/socialflow-platform.ts`.
- **Archivo legacy a convertir en adapter:** `src/lib/campobase/socialflow-platform.ts` (re-export canónico).
- **Tests necesarios:**
  - actualizar/añadir test canónico para `socialflow-platform`
  - `tests/lib/saas-contract-definitions.test.ts`
  - `tests/lib/campobase-platform-bootstrap.test.ts`
  - `tests/architecture/campobase-namespace-freeze.test.ts`
- **Validaciones:**
  - `pnpm typecheck`
  - vitest puntual de los tests anteriores
- **No tocar:**
  - `src/app/api/*`
  - `src/components/*`
  - `src/lib/mentoria/*`
  - `src/lib/clinic/*`
  - `src/lib/socialflow/*`
  - `migrations/*`
- **Rollback:** revert de archivo canónico + adapter + asserts/allowlist relacionados.

### Bloque 2
- Diseñar y crear equivalente canónico de `clinic-platform-service` (o contrato canónico intermedio), luego canonizar `clinic-platform.ts` + adapter legacy.

### Bloque 3
- Diseñar y crear equivalente canónico de `taskops-platform-service`, luego canonizar `taskops-platform.ts` + adapter legacy y validar flujo de señales.

### Bloque 4
- Reintentar canonicalización de `platform-bootstrap` ya apuntando solo a módulos canónicos.

---

## 5) Conclusión de auditoría

- Los tres módulos siguen bloqueando `platform-bootstrap` por dependencias directas a `@/lib/campobase/*`.
- El **mejor primer candidato** para mover a canónico es `socialflow-platform.ts`.
- `clinic-platform.ts` y `taskops-platform.ts` **no deberían tocarse aún** hasta crear equivalentes canónicos de sus servicios legacy dependientes.
