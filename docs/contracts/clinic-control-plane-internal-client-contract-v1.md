# Clinic Control Plane Internal Client Contract v1

## 1. Purpose

Este contrato prepara la salida gradual del legacy:

`src/lib/campobase/clinic-platform-service.ts`

sin perder cobertura funcional y sin mover logica de dominio Clinic dentro de Campamento Base.

El objetivo es definir una frontera neutral para que Campamento Base pueda orquestar Clinic mediante contrato interno, y para que bloques posteriores puedan mover cobertura fuera del import legacy:

`tests/lib/campobase-clinic-platform-service.test.ts::@/lib/campobase/clinic-platform-service`

Este bloque es contract-first y test harness estatico. No implementa cliente runtime, no toca legacy Clinic y no reduce el guardrail.

## 2. Ownership

Ownership definido:

- Clinic es SaaS vertical independiente con dominio propio.
- Campamento Base es orquestador/control-plane: coordina, observa, registra capacidad y solicita acciones mediante frontera neutral.
- `src/lib/clinic/` contiene logica de dominio Clinic si aplica.
- `src/lib/capabilities/internal-api-clients/` puede contener clientes internos neutrales.
- `src/lib/campamento-base/` puede contener control-plane neutral, pero no logica de dominio Clinic.
- Legacy campobase queda como adapter temporal durante la migracion controlada.

Reglas de frontera:

- No crear nuevos imports hacia `@/lib/campobase`.
- No crear archivos nuevos con nombre `campobase`.
- No crear `src/lib/campamento-base/clinic-platform.ts` para mover ahi logica de producto Clinic.
- No mover runtime Clinic en este contrato.
- No tocar `platform-bootstrap` hasta que Clinic y TaskOps tengan fronteras neutrales consolidadas.

## 3. Current Legacy Behavior

El servicio legacy `src/lib/campobase/clinic-platform-service.ts` expone:

- `CLINIC_DAILY_APPOINTMENT_HEALTH_KEY`
- `registerClinicPlatform`

Comportamiento funcional actual:

- Registra el automation handler `clinic.daily_appointment_health`.
- Normaliza config de appointment health:
  - `lookaheadDays`, default `7`;
  - `overdueFollowupHours`, default `24`.
- Ejecuta appointment health leyendo appointments mediante contexto Clinic.
- Calcula metricas:
  - `upcomingAppointments`;
  - `unconfirmedAppointments`;
  - `overdueFollowups`.
- Devuelve `AutomationExecutionResult` con `summary`, `metrics` y `output`.
- Durante `registerClinicPlatform`:
  - resuelve contexto Clinic;
  - asegura disponibilidad de WhatsApp;
  - registra automation si no existe;
  - consulta integracion existente;
  - crea integracion WhatsApp si no existe;
  - usa identidad WhatsApp primaria si existe;
  - deja la integracion en estado `PENDING` si no hay identidad primaria.

El test legacy `tests/lib/campobase-clinic-platform-service.test.ts` cubre comportamiento real:

- automation registration;
- WhatsApp integration bootstrap;
- appointment health metrics;
- config esperada para el handler;
- summary/output del audit.

Por eso no debe convertirse en verificacion estatica de adapter hasta que exista cobertura neutral equivalente.

## 4. Neutral Client Boundary

Frontera neutral propuesta:

`src/lib/capabilities/internal-api-clients/clinic-control-plane.ts`

Responsabilidad:

- Exponer una interfaz de orquestacion para que Campamento Base solicite capacidades Clinic.
- Mantener la logica de dominio Clinic detras de Clinic, no dentro de Campamento Base.
- Evitar que Campamento Base importe internals del runtime Clinic.
- Evitar que nuevos consumidores dependan de `src/lib/campobase/`.

Capacidades minimas:

- Health/appointment audit trigger:
  - disparar o solicitar appointment health audit;
  - retornar metricas operativas neutrales.
- Automation registration:
  - declarar o registrar la automation Clinic esperada;
  - preservar `clinic.daily_appointment_health` como automation key de compatibilidad mientras exista.
- Integration bootstrap state:
  - reportar si la integracion WhatsApp existe;
  - reportar si debe conectarse o queda pendiente.
- WhatsApp readiness:
  - validar disponibilidad del provider;
  - reflejar si existe primary WhatsApp identity.
- Observability/snapshot:
  - exponer health/status minimo para operator/control-plane;
  - devolver request/result metadata sin filtrar logica interna Clinic.

## 5. Proposed API

Tipos propuestos, sin implementacion en este bloque:

```ts
export type ClinicControlPlaneStatus = "healthy" | "degraded" | "pending" | "unavailable";

export type ClinicControlPlaneHealthSnapshot = {
  tenantId: string;
  saasId: string;
  status: ClinicControlPlaneStatus;
  generatedAt: string;
  appointmentHealth?: {
    upcomingAppointments: number;
    unconfirmedAppointments: number;
    overdueFollowups: number;
  };
  checks: Array<{
    key: string;
    ok: boolean;
    message?: string;
  }>;
};

export type ClinicControlPlaneAutomationRegistration = {
  tenantId: string;
  saasId: string;
  automationKey: "clinic.daily_appointment_health";
  displayName: string;
  enabled: boolean;
  scheduleMode: "scheduled" | "manual";
  config: {
    lookaheadDays: number;
    overdueFollowupHours: number;
  };
};

export type ClinicControlPlaneIntegrationState = {
  tenantId: string;
  saasId: string;
  integrationKey: "whatsapp";
  status: "CONNECTED" | "PENDING" | "MISSING";
  hasPrimaryWhatsappIdentity: boolean;
  connectionLabel?: string;
};

export type ClinicAppointmentHealthAuditRequest = {
  tenantId: string;
  saasId: string;
  lookaheadDays?: number;
  overdueFollowupHours?: number;
  requestedBy: string;
};

export type ClinicAppointmentHealthAuditResult = {
  tenantId: string;
  saasId: string;
  ok: boolean;
  summary: string;
  metrics: {
    upcomingAppointments: number;
    unconfirmedAppointments: number;
    overdueFollowups: number;
  };
  output: {
    lookaheadDays: number;
    overdueFollowupHours: number;
  };
};
```

Funciones propuestas, sin implementacion en este bloque:

```ts
export async function fetchClinicControlPlaneHealth(
  tenantId: string,
  saasId: string,
): Promise<ClinicControlPlaneHealthSnapshot>;

export async function registerClinicControlPlaneAutomation(
  input: ClinicControlPlaneAutomationRegistration,
): Promise<ClinicControlPlaneAutomationRegistration>;

export async function ensureClinicControlPlaneIntegration(
  tenantId: string,
  saasId: string,
): Promise<ClinicControlPlaneIntegrationState>;

export async function triggerClinicAppointmentHealthAudit(
  input: ClinicAppointmentHealthAuditRequest,
): Promise<ClinicAppointmentHealthAuditResult>;
```

Notas de diseno:

- La API neutral no debe importar desde `@/lib/campobase`.
- El cliente neutral puede vivir en `src/lib/capabilities/internal-api-clients/clinic-control-plane.ts`.
- La logica de appointment health debe vivir detras de Clinic o en una frontera Clinic propia, no en `src/lib/campamento-base/clinic-platform.ts`.
- Campamento Base consume resultados y estados, no implementa reglas internas de appointments.

## 6. Test Coverage Migration Strategy

Estado actual:

- `tests/lib/campobase-clinic-platform-service.test.ts` cubre comportamiento funcional real.
- No debe convertirse todavia en test estatico de adapter.

Estrategia futura:

1. Crear cliente neutral y test contractual:
   - `src/lib/capabilities/internal-api-clients/clinic-control-plane.ts`
   - `tests/lib/clinic-control-plane-internal-client.test.ts`
2. Cubrir appointment metrics fuera del import legacy:
   - `upcomingAppointments`;
   - `unconfirmedAppointments`;
   - `overdueFollowups`;
   - defaults `lookaheadDays: 7` y `overdueFollowupHours: 24`.
3. Cubrir automation registration fuera del import legacy:
   - automation key `clinic.daily_appointment_health`;
   - schedule/config;
   - idempotencia cuando ya existe automation.
4. Cubrir WhatsApp integration bootstrap fuera del import legacy:
   - provider readiness;
   - estado `PENDING` sin identidad;
   - estado `CONNECTED` con primary WhatsApp identity;
   - metadata minima de integracion.
5. Solo despues convertir `tests/lib/campobase-clinic-platform-service.test.ts` en verificacion estatica de adapter.
6. Solo despues evaluar bajar el guardrail de `11` a `10`.

Cobertura que no se debe perder:

- appointment health;
- config defaults;
- automation registration;
- WhatsApp integration bootstrap;
- primary WhatsApp identity.

## 7. Non-goals

Este contrato no autoriza:

- tocar runtime Clinic;
- tocar `src/lib/campobase/clinic-platform-service.ts`;
- tocar `tests/lib/campobase-clinic-platform-service.test.ts`;
- tocar `platform-bootstrap`;
- tocar `factory-orchestrator`;
- tocar TaskOps;
- tocar UI;
- tocar rutas API;
- tocar migrations;
- bajar el guardrail;
- mover logica Clinic a Campamento Base;
- crear `src/lib/campamento-base/clinic-platform.ts`;
- crear imports nuevos hacia `@/lib/campobase`.

## 8. First Implementation Block Proposal

Siguiente bloque real propuesto, sin implementarlo aqui:

`create neutral clinic control-plane internal client and contract tests`

Objetivo:

- Crear el cliente neutral en `src/lib/capabilities/internal-api-clients/clinic-control-plane.ts`.
- Crear tests contractuales/funcionales del cliente neutral.
- Mantener legacy Clinic intacto.
- Mantener el guardrail en `11` hasta que exista cobertura equivalente.

Archivos a crear en ese bloque futuro:

- `src/lib/capabilities/internal-api-clients/clinic-control-plane.ts`
- `tests/lib/clinic-control-plane-internal-client.test.ts`

Archivos que no deben tocarse en ese bloque futuro:

- `src/lib/campobase/clinic-platform-service.ts`
- `tests/lib/campobase-clinic-platform-service.test.ts`, salvo que el bloque sea explicitamente de migracion posterior.
- `tests/architecture/campobase-namespace-freeze.test.ts`, salvo que ya exista cobertura equivalente y se apruebe reducir.
- `src/lib/campobase/platform-bootstrap.ts`
- `src/lib/campobase/clinic-platform.ts`
- `src/lib/campobase/taskops-platform*`
- `src/app/**/*`
- `src/components/**/*`
- `migrations/**/*`

Validaciones recomendadas:

- `pnpm typecheck`
- `npx vitest run tests/lib/clinic-control-plane-internal-client.test.ts`
- `npx vitest run tests/lib/campobase-clinic-platform-service.test.ts`
- `npx vitest run tests/architecture/campobase-namespace-freeze.test.ts`

Rollback:

- Revertir cliente neutral y test nuevo.
- No habria cambios de runtime legacy ni guardrail que restaurar.
