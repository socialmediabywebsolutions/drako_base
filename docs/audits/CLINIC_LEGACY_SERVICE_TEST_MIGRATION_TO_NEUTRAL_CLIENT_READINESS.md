# Clinic Legacy Service Test Migration To Neutral Client Readiness

## Scope

Auditoria del test legacy:

- `tests/lib/campobase-clinic-platform-service.test.ts`

contra la cobertura neutral nueva:

- `src/lib/capabilities/internal-api-clients/clinic-control-plane.ts`
- `tests/lib/clinic-control-plane-internal-client.test.ts`
- `tests/lib/clinic-control-plane-internal-client-contract.test.ts`

Objetivo:

- decidir si el test legacy Clinic puede convertirse en verificacion estatica de adapter;
- decidir si despues seria seguro reducir el guardrail de `11` a `10`;
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

Si se elimina el edge Clinic:

- Size esperado: `10`

Resultado de auditoria:

- No se recomienda eliminarlo ahora.
- La cobertura neutral es una base correcta, pero aun no equivale completamente al test funcional legacy.

## Cobertura Legacy Actual

Archivo: `tests/lib/campobase-clinic-platform-service.test.ts`

Import legacy:

- `@/lib/campobase/clinic-platform-service`

Cubre comportamiento funcional real de `src/lib/campobase/clinic-platform-service.ts`:

- `registerClinicPlatform`:
  - llama `ensureWhatsappIntegrationAvailable`;
  - llama `getAutomation`;
  - registra automation via `registerAutomation`;
  - usa `CLINIC_DAILY_APPOINTMENT_HEALTH_KEY`;
  - consulta integracion existente via `getIntegrationConnection`;
  - crea conexion WhatsApp via `connectIntegration`;
  - deja status `PENDING` cuando no hay identidad.
- Automation handler:
  - se registra con `registerAutomationHandler`;
  - se captura desde el mock hoisted;
  - consulta appointments con `resolveAppointmentsContext` y `listAppointmentsForSaas`;
  - calcula metricas desde appointments reales del test:
    - `upcomingAppointments: 3`;
    - `unconfirmedAppointments: 2`;
    - `overdueFollowups: 1`;
  - produce `summary`;
  - produce `output`.

Cobertura especifica que existe solo en legacy:

- Side effects reales contra `automation-core` mockeado.
- Side effects reales contra `integration-core` mockeado.
- Invocacion real de `resolveClinicContext`.
- Invocacion real de `resolveAppointmentsContext`.
- Filtrado/categorizacion de appointments segun status y fecha.
- Captura y ejecucion del handler registrado por `registerAutomationHandler`.

## Cobertura Neutral Actual

Archivo: `tests/lib/clinic-control-plane-internal-client.test.ts`

Import canonico/neutral:

- `@/lib/capabilities/internal-api-clients/clinic-control-plane`

Cubre:

- El cliente no importa desde `@/lib/campobase`.
- Exporta tipos/funciones esperadas.
- Registra automation neutral con key `clinic.daily_appointment_health`.
- Normaliza defaults:
  - `lookaheadDays: 7`;
  - `overdueFollowupHours: 24`.
- Representa estados WhatsApp:
  - `PENDING`;
  - `CONNECTED`;
  - `MISSING`.
- Representa `hasPrimaryWhatsappIdentity`.
- Construye health snapshot neutral.
- Representa metricas:
  - `upcomingAppointments`;
  - `unconfirmedAppointments`;
  - `overdueFollowups`.
- Construye summary con `3 upcoming`.
- Falla de forma explicita cuando se intenta ejecutar audit sin backend neutral real.
- Verifica que los archivos nuevos no usan nombre `campobase`.

Archivo: `tests/lib/clinic-control-plane-internal-client-contract.test.ts`

Cubre:

- Existe contrato documental.
- Declara Clinic como SaaS vertical independiente.
- Declara Campamento Base como orquestador/control-plane.
- Propone frontera neutral.
- No propone mover logica Clinic a `src/lib/campamento-base/clinic-platform.ts`.
- Menciona appointment health, automation registration, WhatsApp integration bootstrap y primary WhatsApp identity.
- No importa desde `@/lib/campobase`.

## Equivalencias Y Brechas

| Area | Legacy actual | Neutral actual | Estado |
|---|---|---|---|
| Appointment health metrics | Calcula desde appointments mockeados por status/fecha | Representa metricas recibidas y health snapshot | parcial |
| Config defaults | Usa config del handler; defaults viven en service | Normaliza `7` y `24` en registration/result builder | equivalente parcial |
| Automation registration | Verifica llamada real a `registerAutomation` | Registra automation neutral in-memory | parcial |
| WhatsApp integration bootstrap | Verifica llamada real a `ensureWhatsappIntegrationAvailable` y `connectIntegration` | Representa estados `PENDING`/`CONNECTED`/`MISSING` | parcial |
| Primary WhatsApp identity | Legacy crea credenciales si existe, pero test actual solo cubre ausencia | Neutral cubre presencia booleana | neutral mas explicito, pero no side effect real |
| Summary/output | Verifica summary/output del handler real | Verifica summary/result builder neutral | parcial |
| Handler registration | Verifica `registerAutomationHandler` y ejecuta handler | No aplica; el cliente neutral no registra handler runtime | solo legacy |
| No campobase imports | No, el test legacy importa legacy por definicion | Si | neutral completo |

Lectura:

- La cobertura neutral ya cubre la forma contractual esperada.
- Todavia no cubre la ejecucion funcional que hoy solo vive en el service legacy.
- La diferencia principal no es de tipos sino de comportamiento: el legacy calcula desde appointments y dispara side effects de bootstrap.

## Readiness

Se puede convertir el test legacy Clinic a verificacion estatica de adapter ahora:

- No.

Riesgo de convertir ahora:

- Medium.

Se perderia cobertura funcional:

- Si.

Cobertura que se perderia si se convierte ahora:

- Calculo real de appointment health desde appointments.
- Registro real del automation handler.
- Side effects reales de `registerClinicPlatform` contra mocks de automation/integration.
- Verificacion de `resolveClinicContext` y `resolveAppointmentsContext`.

Se puede bajar el guardrail de `11` a `10` despues:

- Si, pero no inmediatamente.
- Primero hay que ampliar cobertura neutral o crear cobertura de dominio Clinic equivalente.

Asserts/cobertura que conviene anadir antes de migrar:

- En neutral o test adicional:
  - summary completo con `2 unconfirmed` y `1 overdue followups`;
  - output con defaults `lookaheadDays: 7` y `overdueFollowupHours: 24`;
  - idempotencia/overwrite de registration neutral;
  - estado `PENDING` sin primary identity y `CONNECTED` con primary identity;
  - error controlado `CLINIC_CONTROL_PLANE_NOT_CONFIGURED`.
- En dominio Clinic o helper futuro:
  - calculo de appointment metrics desde appointments con status/fechas;
  - exclusion de `DONE`, `CANCELLED`, `NO_SHOW`;
  - conteo de `REQUESTED`/`PENDING` como unconfirmed/overdue.

## Opciones

### Opcion A: Convertir directamente el test legacy a verificacion estatica y bajar guardrail a 10

Riesgo: medium.

Impacto:

- Reduce allowlist de `11` a `10`.
- Elimina el import legacy del test.
- Pierde cobertura funcional del handler y bootstrap si no se compensa antes.

Archivos a tocar en bloque futuro:

- `tests/lib/campobase-clinic-platform-service.test.ts`
- `tests/architecture/campobase-namespace-freeze.test.ts`

Tests necesarios:

- `npx vitest run tests/lib/campobase-clinic-platform-service.test.ts`
- `npx vitest run tests/lib/clinic-control-plane-internal-client.test.ts`
- `npx vitest run tests/architecture/campobase-namespace-freeze.test.ts`
- `pnpm typecheck`

Rollback:

- Restaurar test legacy funcional.
- Restaurar edge allowlisted y pin `11`.

Recomendacion:

- No recomendado ahora.

### Opcion B: Ampliar primero el test neutral, sin tocar legacy todavia

Riesgo: low.

Impacto:

- Refuerza cobertura neutral sin tocar legacy ni guardrail.
- No reduce allowlist todavia.
- Prepara una conversion posterior con menos perdida.

Archivos a tocar en bloque futuro:

- `tests/lib/clinic-control-plane-internal-client.test.ts`
- opcionalmente `src/lib/capabilities/internal-api-clients/clinic-control-plane.ts` si faltan helpers neutrales.

Tests necesarios:

- `npx vitest run tests/lib/clinic-control-plane-internal-client.test.ts`
- `npx vitest run tests/lib/campobase-clinic-platform-service.test.ts`
- `npx vitest run tests/architecture/campobase-namespace-freeze.test.ts`
- `pnpm typecheck`

Rollback:

- Revertir solo cambios del cliente neutral/test neutral.
- Legacy y guardrail quedan intactos.

Recomendacion:

- Recomendado como siguiente bloque si se quiere seguir bajando riesgo antes de reducir.

### Opcion C: Mantener ambos tests por ahora y no bajar guardrail

Riesgo: low inmediato.

Impacto:

- Mantiene size `11`.
- Conserva cobertura funcional legacy y cobertura neutral.
- No avanza reduccion del allowlist.

Archivos a tocar:

- Ninguno.

Tests necesarios:

- Los tests puntuales actuales.

Rollback:

- No aplica.

Recomendacion:

- Correcto si no se quiere ampliar neutral todavia.

### Opcion D: Crear nuevo test neutral adicional y luego convertir legacy a estatico

Riesgo: low/medium.

Impacto:

- Permite separar cobertura de contrato neutral de cobertura de appointment metrics/dominio.
- Evita inflar demasiado `tests/lib/clinic-control-plane-internal-client.test.ts`.
- Puede preparar mejor el bloque de reduccion a `10`.

Archivos a tocar en bloque futuro:

- Nuevo test neutral o de dominio Clinic, sin nombre `campobase`.
- Posible helper neutral si se aprueba.
- Luego, en bloque separado:
  - `tests/lib/campobase-clinic-platform-service.test.ts`
  - `tests/architecture/campobase-namespace-freeze.test.ts`

Tests necesarios:

- Test neutral/dominio nuevo.
- `npx vitest run tests/lib/clinic-control-plane-internal-client.test.ts`
- `npx vitest run tests/lib/campobase-clinic-platform-service.test.ts`
- guardrail.
- `pnpm typecheck`

Rollback:

- Revertir test nuevo/helper neutral.
- Si ya se redujo guardrail, restaurar edge y pin `11`.

Recomendacion:

- Buena alternativa si la cobertura de appointment metrics debe vivir separada del cliente in-memory.

## Recomendacion Final

Opcion recomendada:

- Opcion B como siguiente bloque pequeno.

Motivo:

- La cobertura neutral existe y es sana, pero aun es parcialmente representacional.
- Antes de convertir el test legacy a estatico, conviene ampliar el test neutral con asserts de output/summary/defaults y estados WhatsApp.
- La parte de calculo real desde appointments sigue requiriendo una decision: helper neutral/dominio Clinic o conservar legacy funcional un bloque mas.

Decision sobre guardrail:

- No reducir ahora.
- Reducir de `11` a `10` solo despues de ampliar cobertura neutral o crear cobertura equivalente y convertir el test legacy a verificacion estatica.

## Siguiente Bloque Recomendado

Sin implementarlo:

`expand neutral clinic control-plane test coverage before legacy static conversion`

Alcance sugerido:

- Tocar solo:
  - `tests/lib/clinic-control-plane-internal-client.test.ts`
  - opcionalmente `src/lib/capabilities/internal-api-clients/clinic-control-plane.ts` si hace falta exponer helper neutral.
- No tocar:
  - `tests/lib/campobase-clinic-platform-service.test.ts`
  - `src/lib/campobase/clinic-platform-service.ts`
  - guardrail.

Validaciones sugeridas:

- `pnpm typecheck`
- `npx vitest run tests/lib/clinic-control-plane-internal-client.test.ts`
- `npx vitest run tests/lib/campobase-clinic-platform-service.test.ts`
- `npx vitest run tests/architecture/campobase-namespace-freeze.test.ts`
