# TaskOps Platform Ownership Audit

**Fecha:** 2026-06-07  
**Bloque:** `audit taskops platform ownership before canonicalization`  
**Tipo:** auditoría reducida (solo inspección y documentación)

---

## 1) Inspección de módulos TaskOps legacy

### 1.1 `src/lib/campobase/taskops-platform.ts`

**Exports públicos**
- `TASKOPS_PLATFORM_SAAS_ID`
- `taskOpsPlatformDefinition`
- `taskOpsPlatformBootstrap`

**Imports actuales**
- `@/lib/automation-core`
- `@/lib/saas-contract`
- `@/lib/integration-core/providers/whatsapp`
- `@/lib/campobase/taskops-platform-service`

**¿Importa desde `@/lib/campobase/*`?**
- Sí (`@/lib/campobase/taskops-platform-service`).

**Dependencias core**
- `saas-contract`: sí
- `automation-core`: sí (`triggerAutomation`, `AutomationCoreError`)
- `integration-core`: sí (key de WhatsApp vía definition)
- `observability-core`: no directo

**¿Contiene lógica de producto TaskOps o solo bootstrap?**
- Es más que wrapper puro:
  - definición de plataforma (metadata)
  - bootstrap `connect`
  - `signalHandlers` (`task.overdue`) con ejecución real de automatización
- Por tanto, mezcla contrato + wiring + lógica de reacción de ejecución.

**Aporte a `platform-bootstrap`**
- Entrega definition/bootstrap para registrar `taskops` en `saas-contract`.

**Consumidores detectados**
- Runtime:
  - `src/lib/campobase/platform-bootstrap.ts`
- Tests:
  - `tests/lib/saas-contract-definitions.test.ts`
  - `tests/lib/campobase-platform-bootstrap.test.ts` (mock)
  - `tests/lib/cross-saas-taskops-flow.test.ts`

**Riesgo general**
- **High** (por signal handlers y trigger de automation en capa platform).

---

### 1.2 `src/lib/campobase/taskops-platform-service.ts`

**Exports públicos**
- `TASKOPS_PENDING_TASK_AUDIT_KEY`
- `registerTaskOpsPlatform`

**Imports actuales**
- `@/lib/automation-core`
- `@/lib/integration-core`
- `@/lib/integration-core/providers/whatsapp`
- `@/lib/tasks/repository`
- `@/lib/whatsapp/repository`

**¿Importa desde `@/lib/campobase/*`?**
- No (es módulo legacy raíz, pero no trae otros `campobase/*`).

**Dependencias core**
- `saas-contract`: no
- `automation-core`: sí (registro handler + register/get automation)
- `integration-core`: sí (register/get integration + WhatsApp bootstrap)
- `observability-core`: no directo

**¿Contiene lógica de producto TaskOps?**
- Sí, lógica funcional de auditoría de tareas:
  - cálculo de pending/overdue/critical tasks
  - registro y ejecución de automation
  - bootstrap de integración WhatsApp para contexto TaskOps

**¿Solo registro/bootstrap?**
- No. Incluye comportamiento funcional operativo sobre dominio de tareas.

**Aporte a `platform-bootstrap`**
- Es el motor real detrás de `taskOpsPlatformBootstrap.connect(...)`.

**Consumidores detectados**
- Runtime:
  - `src/lib/campobase/taskops-platform.ts`
- Tests:
  - `tests/lib/campobase-taskops-platform-service.test.ts`

**Riesgo general**
- **High/Critical** (impacta ejecución transversal vía signals + automation).

---

### 1.3 Rutas/componentes/tests/docs relacionados con TaskOps

**Rutas/components explícitas `taskops`**
- No se detectan rutas o componentes UI específicos `/taskops/*`.

**Superficie funcional asociada al dominio tareas (transversal)**
- `src/app/api/tasks/*` (API genérica de tareas por `saasId`)
- uso de tasks en módulos cross-saas (`owner`, `socialflow`, `whatsapp automation`, factory control plane)

**Tests relevantes**
- `tests/lib/cross-saas-taskops-flow.test.ts` (flujo señal `task.overdue` cross-saas)
- `tests/lib/campobase-taskops-platform-service.test.ts`
- `tests/lib/saas-contract-definitions.test.ts`
- `tests/lib/campobase-platform-bootstrap.test.ts`

**Docs/config y señales de posicionamiento**
- `docs/drako-runtime-model.md` describe `task.overdue` como flujo transversal de ejecución.
- No aparecen docs de producto vertical TaskOps equivalentes a Clinic (`app/clinic`, `api/clinic`, `lib/clinic`).

**Lectura de evidencia**
- TaskOps se comporta más como módulo operativo transversal de ejecución (task audit + signal handling) que como vertical producto con superficies propias.

---

## 2) Determinación de ownership

### Opción A — TaskOps como capacidad interna de Campamento Base
**A favor**
- Está acoplado hoy al bootstrap/control-plane legacy.
- Usa cores compartidos (automation/integration) y surface operator.

**En contra**
- Tiene lógica funcional de ejecución que no debería vivir en platform definition.
- Cross-saas signal handling sugiere módulo de ejecución, no simple capability interna UI/control.

**Impacto arquitectónico**
- Puede mezclar control-plane con lógica operativa especializada.

**Riesgo**
- High.

**Recomendación**
- No como destino final directo.

---

### Opción B — TaskOps como SaaS/módulo vertical independiente
**A favor**
- Tiene identidad `saasId: taskops` y definition propia.
- Participa como entidad separada en flujo cross-saas (test).

**En contra**
- No hay superficie vertical propia clara (`/app/taskops`, `/api/taskops`, `lib/taskops` inexistentes).
- Se apoya en dominio tasks genérico.

**Impacto arquitectónico**
- Podría sobredimensionar separación sin evidencia de producto vertical real.

**Riesgo**
- Medium/High.

**Recomendación**
- No concluyente como opción principal.

---

### Opción C — TaskOps como motor transversal compartido (no SaaS puro)
**A favor**
- Evidencia fuerte de ejecución transversal (`task.overdue` via signal bus, automation core, control plane).
- Dominio base proviene de `tasks/*` genérico multi-SaaS.
- No hay UI/API vertical dedicadas TaskOps.

**En contra**
- Actualmente se registra como plataforma `saas-contract` (`taskops`).

**Impacto arquitectónico**
- Favorece separar motor operativo transversal de control-plane sin forzar vertical artificial.

**Riesgo**
- Medium (requiere contrato/namespace neutral bien definido).

**Recomendación**
- **Opción recomendada**.

---

### Opción D — TaskOps legacy/demo congelado
**A favor**
- Menor riesgo inmediato.

**En contra**
- Mantiene bloqueo de `platform-bootstrap` y deuda arquitectónica.

**Impacto arquitectónico**
- Deuda acumulada; frena separación progresiva.

**Riesgo**
- Medium.

**Recomendación**
- Solo como estado temporal.

---

### Opción E — Evidencia insuficiente
**A favor**
- Prudente si hubiera señales ambiguas.

**En contra**
- Hay evidencia suficiente de comportamiento transversal (runtime model + tests cross-saas + tasks domain).

**Impacto arquitectónico**
- Retrasa decisiones que ya pueden encaminarse.

**Riesgo**
- Low técnico / Medium de gobernanza.

**Recomendación**
- No necesaria en este estado.

---

## 3) Namespace correcto

### Opción 1 — `src/lib/campamento-base/taskops-platform.ts`
- **Riesgo:** high
- **Impacto:** potencial mezcla de lógica operativa transversal dentro del control-plane
- **Archivos implicados:** nuevo módulo canónico + adapter + ajustes bootstrap/tests
- **Tests necesarios:** saas-contract defs + cross-saas taskops + bootstrap + freeze
- **Rollback:** posible, pero con alto riesgo de regresión por signals
- **Evaluación:** no recomendado como destino final de lógica TaskOps

### Opción 2 — `src/lib/taskops/taskops-platform.ts`
- **Riesgo:** medium
- **Impacto:** separa responsabilidad operacional en namespace dedicado
- **Archivos implicados:** nuevo namespace taskops + adapter legacy + wiring contrato
- **Tests necesarios:** cross-saas, platform bootstrap compat, taskops service contract, freeze
- **Rollback:** moderado
- **Evaluación:** buena opción si se confirma entidad separada (vertical o módulo dedicado)

### Opción 3 — `src/lib/taskops/` como módulo vertical/transversal
- **Riesgo:** medium (más bajo que mover a campamento-base)
- **Impacto:** máxima claridad de ownership técnico
- **Archivos implicados:** namespace dedicado + contratos neutrales
- **Tests necesarios:** contract + cross-saas + compat
- **Rollback:** moderado
- **Evaluación:** **mejor opción estructural** con evidencia actual

### Opción 4 — mantener temporalmente en `src/lib/campobase/` legacy congelado
- **Riesgo:** low inmediato / medium deuda
- **Impacto:** bloquea canonicalización total de bootstrap
- **Archivos implicados:** ninguno
- **Tests necesarios:** freeze actual
- **Rollback:** no aplica
- **Evaluación:** solo temporal

### Opción 5 — contrato neutral en `src/lib/campamento-base/` para orquestar TaskOps sin mover lógica TaskOps
- **Riesgo:** low/medium
- **Impacto:** desacopla control-plane de implementación TaskOps
- **Archivos implicados:** contrato/orquestador neutral + adapter/wiring gradual
- **Tests necesarios:** contrato neutral + cross-saas + freeze
- **Rollback:** fácil
- **Evaluación:** **recomendación final inmediata** (combinada luego con Opción 3)

**Recomendación final de namespace**
- No absorber TaskOps operativo dentro de `src/lib/campamento-base/` como lógica de producto/motor.
- Avanzar primero con contrato neutral en Campamento Base (Opción 5).
- Evolucionar implementación a namespace dedicado `src/lib/taskops/` (Opción 3).

---

## 4) Impacto sobre `platform-bootstrap`

`src/lib/campobase/platform-bootstrap.ts` hoy:
- importa dinámicamente `@/lib/campobase/taskops-platform`
- registra definition/bootstrap de TaskOps en `saas-contract`

**Cómo usa TaskOps actualmente**
- consume `taskOpsPlatformDefinition` y `taskOpsPlatformBootstrap`
- depende indirectamente de `taskops-platform-service` (lógica real)

**¿TaskOps bloquea crear `src/lib/campamento-base/platform-bootstrap.ts`?**
- **Sí.** Mientras TaskOps siga en legacy con dependencia y lógica de ejecución embebida.

**¿Se puede aislar mediante contrato?**
- **Sí.** Contrato neutral de orquestación Campamento Base ↔ TaskOps reduce acoplamiento y prepara migración.

**¿Conviene esperar antes de tocar TaskOps?**
- Conviene no mover código operativo directamente a campamento-base.
- Sí conviene preparar contrato neutral antes de canonicalizar wrappers.

**Cambio mínimo seguro (si se hace en bloque posterior)**
- Definir contrato neutral/documentación+cliente de orquestación sin tocar runtime TaskOps.

---

## 5) Comparación con SocialFlow y Clinic

### SocialFlow
- Pudo canonizarse porque había servicio canónico claro en `campamento-base` y wrapper migrable sin arrastrar lógica transversal adicional.

### Clinic
- Se clasificó como vertical independiente con dominio y superficies dedicadas (`app/api/lib clinic`).

### TaskOps (comparación)
- Se parece **menos a Clinic** (sin superficie vertical dedicada).
- Se parece **parcialmente a SocialFlow** por patrón platform definition/bootstrap.
- Pero, por evidencia de señalización y task engine cross-saas, se parece **más a motor transversal**.

**Riesgo de meter TaskOps dentro de Campamento Base**
- Alto riesgo de mezclar control-plane con lógica operativa transversal de ejecución.

**¿Requiere contrato neutral antes de mover código?**
- **Sí.** Recomendado como precondición.

---

## 6) Próximo bloque recomendado (sin implementar)

### Bloque recomendado
`define neutral campamento-base ↔ taskops orchestration contract`

### Objetivo
Separar ownership entre orquestación (Campamento Base) y ejecución TaskOps (módulo transversal), sin tocar runtime actual.

### Archivos a tocar
- Crear documento de contrato neutral TaskOps en `docs/contracts/`.
- (Posterior) diseñar cliente interno neutral TaskOps en `src/lib/capabilities/internal-api-clients/`.

### Archivos que NO se deben tocar
- `src/lib/campobase/taskops-platform.ts`
- `src/lib/campobase/taskops-platform-service.ts`
- `src/lib/campobase/platform-bootstrap.ts`
- `src/lib/tasks/*`
- `src/app/api/tasks/*`
- `src/app/*` y `src/components/*`
- `migrations/*`

### Tests necesarios (cuando se implemente)
- test de contrato/cliente interno TaskOps
- `tests/lib/cross-saas-taskops-flow.test.ts`
- `tests/lib/campobase-platform-bootstrap.test.ts` (compat)
- `tests/architecture/campobase-namespace-freeze.test.ts`

### Validaciones
- `pnpm typecheck`
- vitest puntual del contrato/cliente + cross-saas + freeze

### Rollback
- Revert del contrato/cliente neutral sin tocar runtime TaskOps legado.

### Por qué es el paso más seguro
- Mantiene behavior actual estable.
- Evita contaminar Campamento Base con lógica operativa transversal.
- Desbloquea migración futura por fases y con rollback simple.

---

## 7) Conclusión

- TaskOps no muestra evidencia fuerte de vertical de producto independiente al estilo Clinic.
- La evidencia actual encaja mejor con **módulo/motor transversal de ejecución**.
- `platform-bootstrap` sigue bloqueado por dependencia legacy TaskOps hasta introducir contrato neutral y desacople progresivo.
