# Clinic Legacy Static Conversion After Neutral Coverage Expansion

## Scope

Auditoria posterior a la ampliacion de cobertura neutral Clinic.

Objetivo:

- decidir si `tests/lib/campobase-clinic-platform-service.test.ts` puede convertirse ahora en verificacion estatica de adapter;
- decidir si el guardrail puede bajar de `11` a `10`;
- no modificar codigo productivo, tests, imports, legacy Clinic ni guardrail.

Regla canonica aplicada:

- Clinic es SaaS vertical independiente.
- Campamento Base solo orquesta Clinic mediante frontera neutral.
- `src/lib/clinic/` contiene logica de dominio Clinic si aplica.
- `src/lib/capabilities/internal-api-clients/` contiene cliente neutral.
- Campobase es legacy congelado.
- `src/lib/campobase/` solo se mantiene como compatibilidad temporal.
- No se debe crear ningun import nuevo hacia `@/lib/campobase`.

## Guardrail Actual

- Archivo: `tests/architecture/campobase-namespace-freeze.test.ts`
- Size pinned actual: `11`
- Edge Clinic actual:
  - `tests/lib/campobase-clinic-platform-service.test.ts::@/lib/campobase/clinic-platform-service`

Nuevo size esperado si se elimina:

- `10`

Resultado de auditoria:

- No se recomienda eliminar el edge ahora.
- La cobertura neutral ampliada ya cubre el contrato operativo basico, pero no reemplaza aun la cobertura funcional del service legacy.

## Cobertura Neutral Tras Ampliacion

Archivo: `tests/lib/clinic-control-plane-internal-client.test.ts`

Cobertura actual:

- El cliente neutral no importa desde `@/lib/campobase`.
- Exporta tipos y funciones esperadas.
- Registra automation neutral con key `clinic.daily_appointment_health`.
- Normaliza defaults:
  - `lookaheadDays: 7`;
  - `overdueFollowupHours: 24`.
- Permite overwrite/idempotencia de registration neutral mediante `getClinicControlPlaneAutomationRegistration`.
- Representa estados WhatsApp:
  - `PENDING` sin primary identity;
  - `CONNECTED` con primary identity;
  - `MISSING` sin integracion.
- Representa `hasPrimaryWhatsappIdentity`.
- Construye health snapshot neutral.
- Representa appointment health metrics:
  - `upcomingAppointments`;
  - `unconfirmedAppointments`;
  - `overdueFollowups`.
- Verifica summary completo:
  - `3 upcoming`;
  - `2 unconfirmed`;
  - `1 overdue followups`.
- Verifica output/defaults:
  - `lookaheadDays: 7`;
  - `overdueFollowupHours: 24`.
- Falla de forma explicita con `CLINIC_CONTROL_PLANE_NOT_CONFIGURED` cuando se intenta ejecutar audit sin backend neutral real.
- Verifica que los archivos nuevos no usan nombre `campobase`.

Archivo: `tests/lib/clinic-control-plane-internal-client-contract.test.ts`

Cobertura actual:

- Existe contrato documental.
- Declara Clinic como SaaS vertical independiente.
- Declara Campamento Base como orquestador/control-plane.
- Propone frontera neutral.
- No propone mover logica Clinic a `src/lib/campamento-base/clinic-platform.ts`.
- Menciona appointment health, automation registration, WhatsApp integration bootstrap y primary WhatsApp identity.
- No importa desde `@/lib/campobase`.

## Cobertura Legacy Que Sigue Existiendo

Archivo: `tests/lib/campobase-clinic-platform-service.test.ts`

Import legacy:

- `@/lib/campobase/clinic-platform-service`

Sigue cubriendo comportamiento real de `src/lib/campobase/clinic-platform-service.ts`:

- Side effects contra `automation-core` mockeado:
  - `getAutomation`;
  - `registerAutomation`;
  - `registerAutomationHandler`.
- Side effects contra `integration-core` mockeado:
  - `getIntegrationConnection`;
  - `connectIntegration`.
- Side effects contra WhatsApp provider:
  - `ensureWhatsappIntegrationAvailable`.
- Resolucion real de contexto:
  - `resolveClinicContext`;
  - `resolveAppointmentsContext`;
  - `resolveWhatsappContext`.
- Captura y ejecucion del handler registrado.
- Calculo real desde appointments:
  - status `CONFIRMED`, `PENDING`, `REQUESTED`, `DONE`;
  - fechas futuras y pasadas;
  - `upcomingAppointments: 3`;
  - `unconfirmedAppointments: 2`;
  - `overdueFollowups: 1`.
- Summary/output del handler real.

## Equivalencias Y Brechas

| Area | Neutral ampliado | Legacy actual | Estado |
|---|---|---|---|
| Appointment health metrics | Representa metricas y snapshot | Calcula desde appointments/status/fechas | parcial |
| Summary/output | Cubre summary completo y defaults | Cubre summary/output del handler real | equivalente parcial |
| Config defaults | Cubre `7` y `24` | Usa config del handler real | equivalente parcial |
| Automation registration | Cubre registration neutral + overwrite | Verifica side effects reales contra `automation-core` | parcial |
| WhatsApp states | Cubre `PENDING`, `CONNECTED`, `MISSING`, primary identity | Verifica `PENDING` via `connectIntegration` real mockeado | neutral mas amplio, legacy mas real |
| Backend absent | Cubre error `CLINIC_CONTROL_PLANE_NOT_CONFIGURED` | No aplica | neutral completo |
| Handler execution | No ejecuta handler runtime | Captura y ejecuta handler registrado | solo legacy |
| Context resolution | No llama contextos Clinic | Verifica `resolveClinicContext` y `resolveAppointmentsContext` | solo legacy |
| No campobase imports | Si | No, por definicion legacy | neutral completo |

Lectura:

- La cobertura neutral ya es suficiente para contrato y representacion de control-plane.
- Todavia no es equivalente a la cobertura funcional del runtime legacy.
- La brecha mas importante es el calculo real desde appointments y los side effects reales de bootstrap.

## Riesgo

Riesgo de convertir el test legacy ahora:

- Medium.

Se perderia cobertura funcional:

- Si.

Cobertura funcional que se perderia:

- Ejecucion del handler registrado por `registerAutomationHandler`.
- Side effects reales contra `automation-core`.
- Side effects reales contra `integration-core`.
- Resolucion real de contexto Clinic/appointments/WhatsApp.
- Calculo real desde appointments.

Hace falta crear test de dominio Clinic antes:

- Recomendado.

Motivo:

- El cliente neutral debe orquestar/representar, no ser propietario de la logica de dominio.
- El calculo desde appointments pertenece mejor a `src/lib/clinic/` o a un helper de dominio Clinic, no a Campamento Base.

Hace falta test neutral adicional:

- Opcional.
- La cobertura neutral actual ya cubre lo pedido en el bloque anterior.
- Si se desea modelar mas bootstrap sin runtime real, puede hacerse, pero no reemplaza el calculo de dominio.

Puede bajar guardrail de `11` a `10` ahora:

- No recomendado.

Puede bajar despues:

- Si, cuando exista cobertura equivalente para el calculo desde appointments y se convierta el test legacy en verificacion estatica de adapter.

## Opciones

### Opcion A: Convertir ahora el test legacy a estatico y bajar guardrail a 10

Riesgo: medium.

Impacto:

- Reduce el allowlist de `11` a `10`.
- Elimina el import legacy del test.
- Pierde cobertura funcional del handler y bootstrap.

Archivos a tocar en bloque futuro:

- `tests/lib/campobase-clinic-platform-service.test.ts`
- `tests/architecture/campobase-namespace-freeze.test.ts`

Tests necesarios:

- `pnpm typecheck`
- `npx vitest run tests/lib/campobase-clinic-platform-service.test.ts`
- `npx vitest run tests/lib/clinic-control-plane-internal-client.test.ts`
- `npx vitest run tests/architecture/campobase-namespace-freeze.test.ts`

Rollback:

- Restaurar test legacy funcional.
- Restaurar edge allowlisted y pin `11`.

Recomendacion:

- No recomendado ahora.

### Opcion B: Crear primero test de dominio Clinic para calculo real desde appointments

Riesgo: low/medium.

Impacto:

- Conserva el guardrail en `11`.
- Crea cobertura fuera del import legacy para la parte que hoy sigue siendo solo legacy.
- Prepara una conversion estatica posterior con menos perdida real.

Archivos a tocar en bloque futuro:

- Posible helper de dominio bajo `src/lib/clinic/`.
- Test nuevo sin nombre `campobase`, por ejemplo `tests/lib/clinic-appointment-health.test.ts`.
- No tocar legacy Clinic ni guardrail en ese bloque.

Tests necesarios:

- Test de dominio nuevo.
- `npx vitest run tests/lib/campobase-clinic-platform-service.test.ts`
- `npx vitest run tests/lib/clinic-control-plane-internal-client.test.ts`
- `npx vitest run tests/architecture/campobase-namespace-freeze.test.ts`
- `pnpm typecheck`

Rollback:

- Revertir helper/test de dominio.
- Legacy y guardrail quedan intactos.

Recomendacion:

- Recomendado.

### Opcion C: Crear primero test neutral adicional para bootstrap/side effects modelados

Riesgo: low.

Impacto:

- Refuerza la capa neutral sin tocar legacy.
- Puede modelar estados de bootstrap, pero no reemplaza side effects reales contra `automation-core`/`integration-core`.

Archivos a tocar en bloque futuro:

- `tests/lib/clinic-control-plane-internal-client.test.ts`, o test neutral adicional.
- Opcionalmente `src/lib/capabilities/internal-api-clients/clinic-control-plane.ts`.

Tests necesarios:

- Test neutral afectado.
- Legacy Clinic test.
- Guardrail.
- Typecheck.

Rollback:

- Revertir cambios neutrales.

Recomendacion:

- Util, pero menor prioridad que Opcion B.

### Opcion D: Mantener test legacy funcional y avanzar primero con TaskOps neutral

Riesgo: low inmediato.

Impacto:

- Mantiene size `11`.
- Evita perder cobertura Clinic.
- Permite avanzar deuda en el otro dominio bloqueante.

Archivos a tocar en bloque futuro:

- Contrato/cliente/test neutral TaskOps, si se aprueba.
- No tocar Clinic legacy ni guardrail.

Tests necesarios:

- Tests TaskOps nuevos.
- Tests legacy TaskOps.
- Guardrail.
- Typecheck.

Rollback:

- Revertir bloque TaskOps neutral.

Recomendacion:

- Buena alternativa si se prefiere no crear dominio Clinic ahora.

## Recomendacion Final

Opcion recomendada:

- Opcion B: crear primero test de dominio Clinic para calculo real desde appointments.

Por que:

- La cobertura neutral ampliada ya cubre bien la frontera de control-plane.
- Lo que falta no deberia meterse en Campamento Base: es logica de dominio Clinic.
- Un test de dominio Clinic permite quitar la dependencia funcional del test legacy antes de convertirlo a estatico.

Decision sobre guardrail:

- No reducir ahora.
- Reducir de `11` a `10` solo despues de:
  - cubrir calculo real desde appointments fuera del import legacy;
  - convertir `tests/lib/campobase-clinic-platform-service.test.ts` en verificacion estatica de adapter;
  - eliminar el edge allowlisted;
  - bajar el pin a `10`.

## Siguiente Bloque Recomendado

Sin implementarlo:

`extract clinic appointment health domain calculation coverage before legacy static conversion`

Alcance sugerido:

- Crear cobertura de dominio Clinic para calculo de appointment health.
- No tocar:
  - `src/lib/campobase/clinic-platform-service.ts`;
  - `tests/lib/campobase-clinic-platform-service.test.ts`;
  - `tests/architecture/campobase-namespace-freeze.test.ts`;
  - platform-bootstrap;
  - TaskOps;
  - rutas/API/UI/migrations.

Validaciones sugeridas:

- `pnpm typecheck`
- test nuevo de dominio Clinic
- `npx vitest run tests/lib/clinic-control-plane-internal-client.test.ts`
- `npx vitest run tests/lib/campobase-clinic-platform-service.test.ts`
- `npx vitest run tests/architecture/campobase-namespace-freeze.test.ts`
