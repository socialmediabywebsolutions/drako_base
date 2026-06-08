# Remaining Campobase Freeze Edges After Registry Shrink To 11

## Scope

Auditoria del guardrail `tests/architecture/campobase-namespace-freeze.test.ts` despues de reducir el allowlist a `11`.

Regla canonica aplicada:

- Campamento Base es canonico.
- `src/lib/campamento-base/` es el namespace canonico.
- `src/lib/operator/` puede ser facade de consumo.
- Campobase es legacy congelado.
- `src/lib/campobase/` solo se mantiene como compatibilidad temporal.
- No se debe crear ningun import nuevo hacia `@/lib/campobase`.

Esta auditoria solo inspecciona, clasifica y propone el siguiente bloque de menor riesgo. No modifica codigo productivo, imports, tests, componentes, rutas, servicios, runtime, Clinic, TaskOps, Mentoria ni migrations.

## Guardrail Actual

- Archivo: `tests/architecture/campobase-namespace-freeze.test.ts`
- Size pinned actual: `11`
- Edges encontrados permitidos: `11`
- Search dirs del guardrail: `src`, `tests`, `scripts`
- Patron congelado: imports, exports e imports dinamicos cuyo specifier empieza por `@/lib/campobase`.

## Edges Permitidos

| # | Path | Import legacy | Ambito | Pertenece a | Categoria | Riesgo | Equivalente canonico actual | Accion recomendada |
|---|---|---|---|---|---|---|---|---|
| 1 | `src/lib/campobase/clinic-platform.ts` | `@/lib/campobase/clinic-platform-service` | legacy interno | Clinic | Clinic | medium | No existe modulo canonico `clinic-platform-service`; el contrato recomienda frontera neutral Clinic, no mover dominio a Campamento Base | no tocar todavia |
| 2 | `src/lib/campobase/platform-bootstrap.ts` | `@/lib/campobase/clinic-platform` | legacy interno | platform-bootstrap / Clinic | platform-bootstrap | high | No existe `src/lib/campamento-base/clinic-platform.ts`; contrato Clinic recomienda no crear logica Clinic en Campamento Base | no tocar todavia |
| 3 | `src/lib/campobase/platform-bootstrap.ts` | `@/lib/campobase/taskops-platform` | legacy interno | platform-bootstrap / TaskOps | platform-bootstrap | high | No existe `src/lib/campamento-base/taskops-platform.ts`; contrato TaskOps recomienda namespace/cliente neutral | no tocar todavia |
| 4 | `src/lib/campobase/taskops-platform.ts` | `@/lib/campobase/taskops-platform-service` | legacy interno | TaskOps | TaskOps | high | No existe modulo canonico `taskops-platform-service`; contrato recomienda frontera neutral TaskOps | no tocar todavia |
| 5 | `tests/lib/campobase-clinic-platform-service.test.ts` | `@/lib/campobase/clinic-platform-service` | tests | Clinic | test legacy adapter | medium | No existe equivalente canonico actual; posible futuro cliente neutral `clinic-control-plane` | mantener como adapter test |
| 6 | `tests/lib/campobase-platform-bootstrap.test.ts` | `@/lib/campobase/platform-bootstrap` | tests | platform-bootstrap | test de compatibilidad | high | No existe bootstrap canonico completo; bloqueado por Clinic y TaskOps | no tocar todavia |
| 7 | `tests/lib/campobase-taskops-platform-service.test.ts` | `@/lib/campobase/taskops-platform-service` | tests | TaskOps | test legacy adapter | medium/high | No existe equivalente canonico actual; posible futuro cliente neutral `taskops-control-plane` | mantener como adapter test |
| 8 | `tests/lib/cross-saas-taskops-flow.test.ts` | `@/lib/campobase/taskops-platform` | tests | TaskOps | TaskOps | high | No existe equivalente canonico actual | requiere auditoria previa |
| 9 | `tests/lib/factory-orchestrator.test.ts` | `@/lib/campobase/platform-bootstrap` | tests | factory-orchestrator / platform-bootstrap | factory/orchestrator | high | No existe bootstrap canonico completo | requiere auditoria previa |
| 10 | `tests/lib/saas-contract-definitions.test.ts` | `@/lib/campobase/clinic-platform` | tests | saas-contract-definitions / Clinic | Clinic | medium | No existe definicion Clinic canonica actual | requiere contrato |
| 11 | `tests/lib/saas-contract-definitions.test.ts` | `@/lib/campobase/taskops-platform` | tests | saas-contract-definitions / TaskOps | TaskOps | medium/high | No existe definicion TaskOps canonica actual | requiere contrato |

## Lectura Por Dominio

### Clinic

Edges restantes:

- `src/lib/campobase/clinic-platform.ts::@/lib/campobase/clinic-platform-service`
- `tests/lib/campobase-clinic-platform-service.test.ts::@/lib/campobase/clinic-platform-service`
- `tests/lib/saas-contract-definitions.test.ts::@/lib/campobase/clinic-platform`
- `src/lib/campobase/platform-bootstrap.ts::@/lib/campobase/clinic-platform`

Estado:

- Existe contrato documental: `docs/contracts/campamento-base-clinic-orchestration-contract-v1.md`.
- El contrato posiciona Clinic como vertical independiente y recomienda frontera neutral, no mover logica Clinic a `src/lib/campamento-base/clinic-platform.ts`.
- No existe equivalente canonico actual para `clinic-platform` ni `clinic-platform-service`.

Conclusion:

- Clinic no debe migrarse por sustitucion 1:1 todavia.
- El camino seguro es disenar cliente/contrato tecnico neutral antes de reducir edges runtime.

### TaskOps

Edges restantes:

- `src/lib/campobase/taskops-platform.ts::@/lib/campobase/taskops-platform-service`
- `tests/lib/campobase-taskops-platform-service.test.ts::@/lib/campobase/taskops-platform-service`
- `tests/lib/cross-saas-taskops-flow.test.ts::@/lib/campobase/taskops-platform`
- `tests/lib/saas-contract-definitions.test.ts::@/lib/campobase/taskops-platform`
- `src/lib/campobase/platform-bootstrap.ts::@/lib/campobase/taskops-platform`

Estado:

- Existe contrato documental: `docs/contracts/campamento-base-taskops-orchestration-contract-v1.md`.
- TaskOps se describe como motor transversal con signal handlers y flujo `task.overdue`.
- No existe equivalente canonico actual para `taskops-platform` ni `taskops-platform-service`.

Conclusion:

- TaskOps es mas riesgoso que Clinic por el flujo cross-SaaS y signal bus.
- Requiere auditoria o cliente neutral antes de tocar imports runtime.

### Platform Bootstrap

Edges restantes:

- `src/lib/campobase/platform-bootstrap.ts::@/lib/campobase/clinic-platform`
- `src/lib/campobase/platform-bootstrap.ts::@/lib/campobase/taskops-platform`
- `tests/lib/campobase-platform-bootstrap.test.ts::@/lib/campobase/platform-bootstrap`
- `tests/lib/factory-orchestrator.test.ts::@/lib/campobase/platform-bootstrap`

Estado:

- SocialFlow ya carga desde `@/lib/campamento-base/socialflow-platform`.
- Clinic y TaskOps siguen bloqueando canonicalizacion completa.
- `factory-orchestrator.test.ts` valida el loader compartido en runtime.

Conclusion:

- No tocar platform-bootstrap todavia.
- Debe esperar a que Clinic y TaskOps tengan frontera neutral o adapters canonicos aprobados.

### SaaS Contract Definitions

Edges restantes:

- `tests/lib/saas-contract-definitions.test.ts::@/lib/campobase/clinic-platform`
- `tests/lib/saas-contract-definitions.test.ts::@/lib/campobase/taskops-platform`

Estado:

- El test valida definiciones estaticas SocialFlow, Clinic y TaskOps.
- SocialFlow ya usa modulo canonico.
- Clinic y TaskOps siguen importando wrappers legacy.

Conclusion:

- Es un candidato de reduccion solo despues de introducir definiciones neutrales/canonicas o convertir el test en verificacion estatica de adapters con cobertura equivalente en otro lugar.

## Top 3 Candidatos Seguros

### 1. Auditar y preparar reduccion del test legacy Clinic service

- Archivo que se tocaria en bloque posterior: `tests/lib/campobase-clinic-platform-service.test.ts`
- Import que se cambiaria: `@/lib/campobase/clinic-platform-service`
- Equivalente recomendado: ninguno actual; futuro contrato/cliente neutral Clinic, por ejemplo `src/lib/capabilities/internal-api-clients/clinic-control-plane.ts`, o test canonico vertical bajo `src/lib/clinic/` si se aprueba.
- Tests necesarios:
  - test canonico/neutral Clinic nuevo o existente.
  - `npx vitest run tests/lib/campobase-clinic-platform-service.test.ts`
  - `npx vitest run tests/architecture/campobase-namespace-freeze.test.ts`
  - `pnpm typecheck`
- Validaciones:
  - Confirmar que no se pierde cobertura de appointment health, automation registration e integracion WhatsApp.
  - Confirmar que el test legacy queda como verificacion estatica de adapter solo si existe cobertura funcional equivalente.
- Rollback:
  - Restaurar import legacy del test y pin `11` si no se reduce el edge.
- Por que debe esperar:
  - Hoy el test cubre comportamiento real del servicio legacy. Reducirlo sin cobertura canonica/neutral eliminaria senal funcional Clinic.

### 2. Auditar y preparar reduccion del test legacy TaskOps service

- Archivo que se tocaria en bloque posterior: `tests/lib/campobase-taskops-platform-service.test.ts`
- Import que se cambiaria: `@/lib/campobase/taskops-platform-service`
- Equivalente recomendado: ninguno actual; futuro contrato/cliente neutral TaskOps, por ejemplo `src/lib/capabilities/internal-api-clients/taskops-control-plane.ts`, o namespace `src/lib/taskops/` si se aprueba.
- Tests necesarios:
  - test canonico/neutral TaskOps nuevo o existente.
  - `npx vitest run tests/lib/campobase-taskops-platform-service.test.ts`
  - `npx vitest run tests/lib/cross-saas-taskops-flow.test.ts` si cambia cobertura de señales.
  - `npx vitest run tests/architecture/campobase-namespace-freeze.test.ts`
  - `pnpm typecheck`
- Validaciones:
  - Confirmar que pending task audit, registration, WhatsApp integration y handler siguen cubiertos.
  - Confirmar que no se altera `task.overdue`.
- Rollback:
  - Restaurar import legacy del test y pin `11`.
- Por que debe esperar:
  - TaskOps tiene acoplamiento transversal y signal bus; primero hace falta frontera neutral o cobertura canonica equivalente.

### 3. Auditar `saas-contract-definitions` para separar definiciones estaticas de adapters legacy

- Archivo que se tocaria en bloque posterior: `tests/lib/saas-contract-definitions.test.ts`
- Imports que se cambiarian:
  - `@/lib/campobase/clinic-platform`
  - `@/lib/campobase/taskops-platform`
- Equivalente recomendado: definiciones neutrales/canonicas aun no existentes para Clinic y TaskOps; no crear `src/lib/campamento-base/clinic-platform.ts` ni `src/lib/campamento-base/taskops-platform.ts` con logica de producto.
- Tests necesarios:
  - `npx vitest run tests/lib/saas-contract-definitions.test.ts`
  - tests de contratos Clinic/TaskOps nuevos si se crean definiciones neutrales.
  - guardrail.
- Validaciones:
  - Confirmar que las definiciones estaticas no arrastran bootstrap runtime legacy.
  - Confirmar que no se crean imports nuevos a `@/lib/campobase`.
- Rollback:
  - Restaurar imports legacy del test y pin `11`.
- Por que es relativamente seguro:
  - Es test-only y apunta a definiciones estaticas.
- Por que debe esperar:
  - No hay equivalente canonico actual; si se migra sin contrato tecnico puede inventar ownership incorrecto.

## Edges Que No Deben Tocarse Todavia

- Clinic:
  - `src/lib/campobase/clinic-platform.ts`
  - `tests/lib/campobase-clinic-platform-service.test.ts`
  - `tests/lib/saas-contract-definitions.test.ts` para Clinic
  - Motivo: depende de ownership vertical y frontera neutral; no hay equivalente canonico actual.

- TaskOps:
  - `src/lib/campobase/taskops-platform.ts`
  - `tests/lib/campobase-taskops-platform-service.test.ts`
  - `tests/lib/cross-saas-taskops-flow.test.ts`
  - `tests/lib/saas-contract-definitions.test.ts` para TaskOps
  - Motivo: depende de namespace transversal, signal bus y flujo `task.overdue`.

- Platform bootstrap:
  - `src/lib/campobase/platform-bootstrap.ts`
  - `tests/lib/campobase-platform-bootstrap.test.ts`
  - Motivo: sigue bloqueado por Clinic y TaskOps.

- Factory/orchestrator:
  - `tests/lib/factory-orchestrator.test.ts`
  - Motivo: requiere auditoria propia porque valida el loader compartido en runtime y el registro de SaaS dinamico.

- Tests legacy que siguen cubriendo adapters:
  - `tests/lib/campobase-clinic-platform-service.test.ts`
  - `tests/lib/campobase-taskops-platform-service.test.ts`
  - Motivo: aun contienen cobertura funcional real sin equivalente canonico actual.

## Recomendacion De Siguiente Bloque

Siguiente bloque recomendado, sin implementarlo:

`audit clinic and taskops legacy service tests for static adapter shrink readiness`

Alcance recomendado:

- Auditar solo:
  - `tests/lib/campobase-clinic-platform-service.test.ts`
  - `tests/lib/campobase-taskops-platform-service.test.ts`
  - contratos Clinic/TaskOps existentes.
- Decidir si existe cobertura funcional canonica/neutral suficiente para convertir esos tests a verificacion estatica de adapter.
- No tocar runtime, platform-bootstrap, factory-orchestrator, rutas, componentes ni migrations.

Resultado esperado del bloque tecnico posterior:

- El allowlist podria bajar de `11` a `10` o `9` solo si antes existe cobertura funcional equivalente fuera del import legacy.
- Si no hay cobertura equivalente, no reducir todavia.
