# Clinic TaskOps Legacy Service Tests Static Adapter Readiness Audit

## Scope

Auditoria exclusiva de:

- `tests/lib/campobase-clinic-platform-service.test.ts`
- `tests/lib/campobase-taskops-platform-service.test.ts`
- `src/lib/campobase/clinic-platform-service.ts`
- `src/lib/campobase/taskops-platform-service.ts`

Objetivo:

- decidir si los tests legacy pueden convertirse en verificacion estatica de adapter;
- decidir si se puede reducir el guardrail de `11` a `10` o `9` en un bloque posterior;
- documentar cobertura faltante antes de tocar imports, tests o guardrail.

Regla canonica aplicada:

- Campamento Base es canonico como control-plane.
- Clinic es SaaS vertical independiente.
- TaskOps es modulo/motor transversal.
- `src/lib/campamento-base/` solo debe contener control-plane neutral si aplica.
- `src/lib/clinic/` debe contener logica de dominio Clinic si aplica.
- `src/lib/taskops/` debe contener logica transversal TaskOps si aplica.
- Campobase es legacy congelado.
- `src/lib/campobase/` solo se mantiene como compatibilidad temporal.
- No se debe crear ningun import nuevo hacia `@/lib/campobase`.

Esta auditoria no implementa cambios, no modifica tests, no modifica guardrail y no toca runtime.

## Guardrail Actual

- Archivo: `tests/architecture/campobase-namespace-freeze.test.ts`
- Size pinned actual: `11`
- Edge Clinic auditado:
  - `tests/lib/campobase-clinic-platform-service.test.ts::@/lib/campobase/clinic-platform-service`
- Edge TaskOps auditado:
  - `tests/lib/campobase-taskops-platform-service.test.ts::@/lib/campobase/taskops-platform-service`

Si se eliminara solo Clinic:

- Size esperado: `10`

Si se eliminara solo TaskOps:

- Size esperado: `10`

Si se eliminaran ambos:

- Size esperado: `9`

Resultado de auditoria:

- No se recomienda eliminar ninguno ahora.
- Ambos tests siguen cubriendo comportamiento funcional real, no solo adapter.

## Clinic

### Servicio legacy actual

Archivo: `src/lib/campobase/clinic-platform-service.ts`

Exports actuales:

- `CLINIC_DAILY_APPOINTMENT_HEALTH_KEY`
- `registerClinicPlatform`

Exports no publicos pero relevantes:

- `ClinicAutomationConfig`
- `normalizeClinicAutomationConfig`
- `addDays`
- automation handler registrado via `registerAutomationHandler(CLINIC_DAILY_APPOINTMENT_HEALTH_KEY, ...)`

Responsabilidades funcionales:

- Registra handler de automation `clinic.daily_appointment_health`.
- Normaliza config:
  - `lookaheadDays`, default `7`;
  - `overdueFollowupHours`, default `24`.
- Consulta appointments via `resolveAppointmentsContext` y `listAppointmentsForSaas`.
- Calcula metricas:
  - `upcomingAppointments`;
  - `unconfirmedAppointments`;
  - `overdueFollowups`.
- Construye summary y output del `AutomationExecutionResult`.
- Bootstrap de plataforma Clinic:
  - resuelve contexto Clinic via `resolveClinicContext`;
  - asegura integracion WhatsApp disponible;
  - registra automation si no existe;
  - conecta integracion WhatsApp si no existe;
  - usa identidad WhatsApp primaria cuando existe.

### Test legacy actual

Archivo: `tests/lib/campobase-clinic-platform-service.test.ts`

Import legacy:

- `@/lib/campobase/clinic-platform-service`

Cubre:

- `registerClinicPlatform` llama `ensureWhatsappIntegrationAvailable`.
- Registra automation con `CLINIC_DAILY_APPOINTMENT_HEALTH_KEY`.
- Crea conexion WhatsApp con estado `PENDING` cuando no hay identidad.
- Captura el handler registrado por `registerAutomationHandler`.
- Ejecuta el handler con datos de appointments.
- Verifica consulta a `resolveAppointmentsContext`.
- Verifica metricas:
  - `upcomingAppointments: 3`;
  - `unconfirmedAppointments: 2`;
  - `overdueFollowups: 1`.
- Verifica summary y output.

Clasificacion:

- No es verificacion estatica de adapter.
- Es cobertura funcional real del servicio legacy Clinic.

### Equivalente canonico/neutral

Estado actual:

- No existe equivalente 1:1 bajo `src/lib/campamento-base/`.
- No existe cliente neutral `src/lib/capabilities/internal-api-clients/clinic-control-plane.ts`.
- Existe namespace de dominio Clinic:
  - `src/lib/clinic/api-helpers.ts`
  - `src/lib/clinic/context.ts`
  - `src/lib/clinic/repository.ts`
  - `src/lib/clinic/types.ts`
- El contrato `docs/contracts/campamento-base-clinic-orchestration-contract-v1.md` recomienda frontera neutral, no mover logica de producto Clinic a Campamento Base.

Ownership recomendado:

- Logica de dominio Clinic: `src/lib/clinic/`.
- Orquestacion/control-plane neutral: cliente interno bajo `src/lib/capabilities/internal-api-clients/` o superficie neutral en Campamento Base, sin logica Clinic.
- Adapter legacy temporal: `src/lib/campobase/clinic-platform-service.ts`.

### Readiness

Se puede convertir el test legacy Clinic a verificacion estatica de adapter ahora:

- No.

Motivo:

- El test actual es la cobertura directa de appointment health y bootstrap de automation/integration.
- Convertirlo a estatico ahora bajaria el allowlist, pero perderia cobertura funcional sin equivalente canonico/neutral.

Riesgo de reducir el edge Clinic ahora:

- Medium/high.

Cobertura que debe existir antes:

- Test funcional nuevo para el futuro cliente/contrato neutral Clinic, o test de dominio Clinic que cubra:
  - metricas de appointment health;
  - config defaults;
  - registro de automation;
  - bootstrap de integracion WhatsApp;
  - estados con/sin identidad WhatsApp.
- Solo despues, el test legacy podria convertirse en verificacion estatica de adapter.

## TaskOps

### Servicio legacy actual

Archivo: `src/lib/campobase/taskops-platform-service.ts`

Exports actuales:

- `TASKOPS_PENDING_TASK_AUDIT_KEY`
- `registerTaskOpsPlatform`

Exports no publicos pero relevantes:

- `TaskOpsAutomationConfig`
- `normalizeTaskOpsConfig`
- automation handler registrado via `registerAutomationHandler(TASKOPS_PENDING_TASK_AUDIT_KEY, ...)`

Responsabilidades funcionales:

- Registra handler de automation `taskops.pending_task_audit`.
- Normaliza config:
  - `overdueAfterHours`, default `24`.
- Consulta tareas via `resolveTasksContext` y `listTasks`.
- Calcula metricas:
  - `pendingOpenTasks`;
  - `overdueTasks`;
  - `criticalOpenTasks`.
- Construye summary y output del `AutomationExecutionResult`.
- Bootstrap de plataforma TaskOps:
  - asegura integracion WhatsApp disponible;
  - registra automation si no existe;
  - conecta integracion WhatsApp si no existe;
  - usa identidad WhatsApp primaria cuando existe.

Relacion con signal bus / `task.overdue`:

- El servicio no registra directamente el signal handler.
- El signal handler vive en `src/lib/campobase/taskops-platform.ts`.
- `taskops-platform.ts` dispara `triggerAutomation` con `TASKOPS_PENDING_TASK_AUDIT_KEY` cuando recibe `task.overdue`.
- Por eso, reducir el test del service sin cobertura equivalente tambien debilita la confianza en el flujo `task.overdue` cubierto por `tests/lib/cross-saas-taskops-flow.test.ts`.

### Test legacy actual

Archivo: `tests/lib/campobase-taskops-platform-service.test.ts`

Import legacy:

- `@/lib/campobase/taskops-platform-service`

Cubre:

- `registerTaskOpsPlatform` llama `ensureWhatsappIntegrationAvailable`.
- Registra automation con `TASKOPS_PENDING_TASK_AUDIT_KEY`.
- Crea conexion WhatsApp.
- Captura el handler registrado por `registerAutomationHandler`.
- Ejecuta el handler con tareas abiertas, in-progress, done y critical.
- Verifica consulta a `resolveTasksContext`.
- Verifica metricas:
  - `pendingOpenTasks: 2`;
  - `overdueTasks: 2`;
  - `criticalOpenTasks: 1`.
- Verifica summary y output.

Clasificacion:

- No es verificacion estatica de adapter.
- Es cobertura funcional real del servicio legacy TaskOps.

### Equivalente canonico/neutral

Estado actual:

- No existe equivalente 1:1 bajo `src/lib/campamento-base/`.
- No existe cliente neutral `src/lib/capabilities/internal-api-clients/taskops-control-plane.ts`.
- No existe namespace `src/lib/taskops/` actual.
- El contrato `docs/contracts/campamento-base-taskops-orchestration-contract-v1.md` recomienda frontera neutral y futuro namespace `src/lib/taskops/`.

Ownership recomendado:

- Logica transversal TaskOps: futuro `src/lib/taskops/`.
- Orquestacion/control-plane neutral: cliente interno bajo `src/lib/capabilities/internal-api-clients/` o superficie neutral en Campamento Base, sin logica operativa TaskOps.
- Adapter legacy temporal: `src/lib/campobase/taskops-platform-service.ts`.

### Readiness

Se puede convertir el test legacy TaskOps a verificacion estatica de adapter ahora:

- No.

Motivo:

- El test actual es la cobertura directa del pending task audit y bootstrap de automation/integration.
- TaskOps tambien participa en flujo transversal `task.overdue`.
- No existe cobertura canonica/neutral equivalente.

Riesgo de reducir el edge TaskOps ahora:

- High.

Cobertura que debe existir antes:

- Test funcional nuevo para futuro cliente/contrato neutral TaskOps o namespace `src/lib/taskops/` que cubra:
  - metricas de pending task audit;
  - config defaults;
  - registro de automation;
  - bootstrap de integracion WhatsApp;
  - compatibilidad con `TASKOPS_PENDING_TASK_AUDIT_KEY`;
  - relacion con `task.overdue` o contrato que preserve el trigger.
- Mantener `tests/lib/cross-saas-taskops-flow.test.ts` hasta que el flujo transversal tenga cobertura neutral.

## Opciones

### Opcion A: Convertir Clinic legacy test a verificacion estatica de adapter

Riesgo: medium/high.

Impacto:

- Podria bajar guardrail de `11` a `10`.
- Perderia cobertura funcional directa de appointment health y bootstrap Clinic si no se crea cobertura equivalente antes.

Archivos a tocar en bloque futuro:

- `tests/lib/campobase-clinic-platform-service.test.ts`
- `tests/architecture/campobase-namespace-freeze.test.ts`

Tests necesarios:

- `npx vitest run tests/lib/campobase-clinic-platform-service.test.ts`
- test funcional Clinic neutral/canonico si existe.
- `npx vitest run tests/architecture/campobase-namespace-freeze.test.ts`
- `pnpm typecheck`

Rollback:

- Restaurar test funcional legacy y pin `11`.

Recomendacion:

- No recomendado ahora.

### Opcion B: Convertir TaskOps legacy test a verificacion estatica de adapter

Riesgo: high.

Impacto:

- Podria bajar guardrail de `11` a `10`.
- Perderia cobertura funcional directa de pending task audit y bootstrap TaskOps.
- Puede reducir confianza indirecta del flujo `task.overdue`.

Archivos a tocar en bloque futuro:

- `tests/lib/campobase-taskops-platform-service.test.ts`
- `tests/architecture/campobase-namespace-freeze.test.ts`

Tests necesarios:

- `npx vitest run tests/lib/campobase-taskops-platform-service.test.ts`
- `npx vitest run tests/lib/cross-saas-taskops-flow.test.ts`
- test funcional TaskOps neutral/canonico si existe.
- `npx vitest run tests/architecture/campobase-namespace-freeze.test.ts`
- `pnpm typecheck`

Rollback:

- Restaurar test funcional legacy y pin `11`.

Recomendacion:

- No recomendado ahora.

### Opcion C: Crear primero modulo/cliente neutral Clinic antes de tocar test legacy

Riesgo: low/medium.

Impacto:

- Mantiene cobertura mientras se introduce frontera neutral.
- Permite migrar comportamiento fuera del import legacy de forma controlada.
- No requiere tocar platform-bootstrap.

Archivos a tocar en bloque futuro:

- Posible `src/lib/capabilities/internal-api-clients/clinic-control-plane.ts`
- Posible test `tests/lib/clinic-control-plane-internal-client.test.ts`
- Opcional actualizacion del contrato Clinic.

Tests necesarios:

- test del cliente/contrato neutral Clinic.
- `pnpm typecheck`
- guardrail.

Rollback:

- Revertir cliente/test/ajuste documental sin impacto en runtime Clinic legacy.

Recomendacion:

- Recomendado antes de reducir el edge Clinic.

### Opcion D: Crear primero modulo/cliente neutral TaskOps antes de tocar test legacy

Riesgo: medium.

Impacto:

- Mantiene cobertura mientras se define frontera transversal TaskOps.
- Prepara reduccion posterior sin romper `task.overdue`.
- No requiere tocar platform-bootstrap ni factory-orchestrator.

Archivos a tocar en bloque futuro:

- Posible `src/lib/capabilities/internal-api-clients/taskops-control-plane.ts`
- Posible test `tests/lib/taskops-control-plane-internal-client.test.ts`
- Opcional actualizacion del contrato TaskOps.

Tests necesarios:

- test del cliente/contrato neutral TaskOps.
- `npx vitest run tests/lib/cross-saas-taskops-flow.test.ts` cuando haya integracion con signal flow.
- `pnpm typecheck`
- guardrail.

Rollback:

- Revertir cliente/test/ajuste documental sin impacto en runtime TaskOps legacy.

Recomendacion:

- Recomendado antes de reducir el edge TaskOps, pero despues o en paralelo documental con Clinic.

### Opcion E: No reducir todavia; mantener ambos tests funcionales legacy hasta tener cobertura equivalente

Riesgo: low inmediato.

Impacto:

- Mantiene guardrail en `11`.
- Conserva cobertura funcional real de Clinic y TaskOps.
- No aumenta deuda; la deuda queda congelada y documentada.

Archivos a tocar:

- Ninguno en bloque tecnico inmediato.

Tests necesarios:

- Los dos tests legacy actuales.
- Guardrail.
- Typecheck.

Rollback:

- No aplica.

Recomendacion:

- Recomendacion final para el estado actual.

## Recomendacion Final

No reducir Clinic ni TaskOps ahora.

Opcion recomendada:

- Opcion E como decision inmediata.
- Luego Opcion C para Clinic y Opcion D para TaskOps, creando cobertura neutral/canonica antes de convertir tests legacy a verificacion estatica.

Orden sugerido:

1. `design neutral clinic control-plane internal client contract and test harness`
2. `design taskops neutral control-plane client contract and compatibility tests`
3. Solo despues auditar conversion estatica de:
   - `tests/lib/campobase-clinic-platform-service.test.ts`
   - `tests/lib/campobase-taskops-platform-service.test.ts`

## Siguiente Bloque Recomendado

Sin implementarlo:

`design neutral clinic control-plane internal client contract and test harness`

Por que este primero:

- Clinic tiene menor riesgo transversal que TaskOps.
- Ya existe namespace `src/lib/clinic/`.
- Permite avanzar ownership sin tocar platform-bootstrap, factory-orchestrator, rutas, componentes ni migrations.

Validaciones recomendadas para ese bloque futuro:

- `pnpm typecheck`
- `npx vitest run tests/lib/clinic-control-plane-internal-client.test.ts`
- `npx vitest run tests/lib/campobase-clinic-platform-service.test.ts`
- `npx vitest run tests/architecture/campobase-namespace-freeze.test.ts`
