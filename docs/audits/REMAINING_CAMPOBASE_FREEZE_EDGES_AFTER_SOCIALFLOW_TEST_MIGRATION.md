# Remaining Campobase Freeze Edges After SocialFlow Test Migration

## Scope

Auditoria del guardrail `tests/architecture/campobase-namespace-freeze.test.ts` despues de la migracion de imports SocialFlow legacy en tests.

Regla canonica aplicada:

- Campamento Base es canonico.
- `src/lib/campamento-base/` es el namespace canonico.
- `src/lib/operator/` puede ser facade de consumo.
- Campobase es legacy congelado.
- `src/lib/campobase/` solo se mantiene como compatibilidad temporal.
- No se debe crear ningun import nuevo hacia `@/lib/campobase`.

No se inspecciono para implementar cambios. Esta auditoria solo clasifica los edges restantes y propone el siguiente bloque de menor riesgo.

## Guardrail Actual

- Archivo: `tests/architecture/campobase-namespace-freeze.test.ts`
- Size pinned actual: `14`
- Edges encontrados permitidos: `14`
- Search dirs del guardrail: `src`, `tests`, `scripts`
- Patron congelado: imports, exports e imports dinamicos cuyo specifier empieza por `@/lib/campobase`.

## Edges Permitidos

| # | Path | Import legacy | Ambito | Pertenece a | Categoria | Riesgo | Equivalente canonico actual | Accion recomendada |
|---|---|---|---|---|---|---|---|---|
| 1 | `src/lib/campobase/clinic-platform.ts` | `@/lib/campobase/clinic-platform-service` | legacy interno | Clinic | Clinic | medium | No hay modulo canonico Clinic equivalente bajo `src/lib/campamento-base/` | no tocar todavia |
| 2 | `src/lib/campobase/platform-bootstrap.ts` | `@/lib/campobase/clinic-platform` | legacy interno | platform-bootstrap / Clinic | legacy interno congelado | high | No hay `src/lib/campamento-base/clinic-platform.ts` | no tocar todavia |
| 3 | `src/lib/campobase/platform-bootstrap.ts` | `@/lib/campobase/taskops-platform` | legacy interno | platform-bootstrap / TaskOps | legacy interno congelado | high | No hay `src/lib/campamento-base/taskops-platform.ts` | no tocar todavia |
| 4 | `src/lib/campobase/taskops-platform.ts` | `@/lib/campobase/taskops-platform-service` | legacy interno | TaskOps | TaskOps | medium | No hay modulo canonico TaskOps equivalente bajo `src/lib/campamento-base/` | no tocar todavia |
| 5 | `tests/lib/campobase-clinic-platform-service.test.ts` | `@/lib/campobase/clinic-platform-service` | tests | Clinic | test legacy adapter | medium | No hay equivalente canonico Clinic actual | mantener como adapter test |
| 6 | `tests/lib/campobase-platform-bootstrap.test.ts` | `@/lib/campobase/platform-bootstrap` | tests | platform-bootstrap | test de compatibilidad | high | No hay bootstrap canonico completo; SocialFlow ya carga `@/lib/campamento-base/socialflow-platform`, Clinic/TaskOps siguen legacy | no tocar todavia |
| 7 | `tests/lib/campobase-social-automation-history.test.ts` | `@/lib/campobase/social-automation-history` | tests | SocialFlow | test legacy adapter | low | Si: `@/lib/campamento-base/social-automation-history` | migrar ahora |
| 8 | `tests/lib/campobase-social-automation-registry.test.ts` | `@/lib/campobase/social-automation-registry` | tests | SocialFlow | test legacy adapter | medium | No hay `src/lib/campamento-base/social-automation-registry.ts` actual | requiere contrato |
| 9 | `tests/lib/campobase-socialflow-service.test.ts` | `@/lib/campobase/socialflow-service` | tests | SocialFlow | test legacy adapter | low | Si: `@/lib/campamento-base/socialflow-control-plane-service` | migrar ahora |
| 10 | `tests/lib/campobase-taskops-platform-service.test.ts` | `@/lib/campobase/taskops-platform-service` | tests | TaskOps | test legacy adapter | medium | No hay equivalente canonico TaskOps actual | mantener como adapter test |
| 11 | `tests/lib/cross-saas-taskops-flow.test.ts` | `@/lib/campobase/taskops-platform` | tests | TaskOps | TaskOps | high | No hay equivalente canonico TaskOps actual | no tocar todavia |
| 12 | `tests/lib/factory-orchestrator.test.ts` | `@/lib/campobase/platform-bootstrap` | tests | factory-orchestrator / platform-bootstrap | factory/orchestrator | high | No hay bootstrap canonico completo | requiere auditoria previa |
| 13 | `tests/lib/saas-contract-definitions.test.ts` | `@/lib/campobase/clinic-platform` | tests | Clinic | Clinic | medium | No hay equivalente canonico Clinic actual | requiere contrato |
| 14 | `tests/lib/saas-contract-definitions.test.ts` | `@/lib/campobase/taskops-platform` | tests | TaskOps | TaskOps | medium | No hay equivalente canonico TaskOps actual | requiere contrato |

## Lectura Por Dominio

### SocialFlow

Edges restantes:

- `tests/lib/campobase-social-automation-history.test.ts::@/lib/campobase/social-automation-history`
- `tests/lib/campobase-social-automation-registry.test.ts::@/lib/campobase/social-automation-registry`
- `tests/lib/campobase-socialflow-service.test.ts::@/lib/campobase/socialflow-service`

Estado:

- `socialflow-service` legacy es adapter hacia `@/lib/campamento-base/socialflow-control-plane-service`.
- `social-automation-history` legacy es adapter hacia `@/lib/campamento-base/social-automation-history`.
- `social-automation-registry` sigue siendo implementacion legacy directa y no tiene equivalente canonico actual.

Conclusiones:

- `campobase-socialflow-service.test.ts` y `campobase-social-automation-history.test.ts` son los candidatos mas seguros.
- `campobase-social-automation-registry.test.ts` debe esperar contrato o modulo canonico.

### Clinic

Edges restantes:

- `src/lib/campobase/clinic-platform.ts::@/lib/campobase/clinic-platform-service`
- `tests/lib/campobase-clinic-platform-service.test.ts::@/lib/campobase/clinic-platform-service`
- `tests/lib/saas-contract-definitions.test.ts::@/lib/campobase/clinic-platform`
- `src/lib/campobase/platform-bootstrap.ts::@/lib/campobase/clinic-platform`

Estado:

- No existe equivalente canonico actual bajo `src/lib/campamento-base/`.
- Depende de ownership/contrato vertical Clinic.
- Debe quedar congelado hasta un bloque Clinic propio.

### TaskOps

Edges restantes:

- `src/lib/campobase/taskops-platform.ts::@/lib/campobase/taskops-platform-service`
- `tests/lib/campobase-taskops-platform-service.test.ts::@/lib/campobase/taskops-platform-service`
- `tests/lib/cross-saas-taskops-flow.test.ts::@/lib/campobase/taskops-platform`
- `tests/lib/saas-contract-definitions.test.ts::@/lib/campobase/taskops-platform`
- `src/lib/campobase/platform-bootstrap.ts::@/lib/campobase/taskops-platform`

Estado:

- No existe equivalente canonico actual bajo `src/lib/campamento-base/`.
- Depende de namespace transversal y del flujo cross-SaaS `task.overdue`.
- Debe quedar congelado hasta un bloque TaskOps propio.

### Platform Bootstrap

Edges restantes:

- `src/lib/campobase/platform-bootstrap.ts::@/lib/campobase/clinic-platform`
- `src/lib/campobase/platform-bootstrap.ts::@/lib/campobase/taskops-platform`
- `tests/lib/campobase-platform-bootstrap.test.ts::@/lib/campobase/platform-bootstrap`
- `tests/lib/factory-orchestrator.test.ts::@/lib/campobase/platform-bootstrap`

Estado:

- SocialFlow ya fue canonicalizado dentro del bootstrap hacia `@/lib/campamento-base/socialflow-platform`.
- Clinic y TaskOps siguen bloqueando canonicalizacion completa.
- `factory-orchestrator.test.ts` usa el loader legacy como parte del contrato de resolucion runtime.

Conclusion:

- No tocar platform-bootstrap todavia.
- Requiere auditoria propia cuando Clinic/TaskOps tengan equivalentes canónicos o contrato de transicion.

## Top 3 Candidatos Seguros

### 1. Migrar test SocialFlow service legacy adapter

- Archivo a tocar: `tests/lib/campobase-socialflow-service.test.ts`
- Import a cambiar: `@/lib/campobase/socialflow-service`
- Equivalente recomendado: `@/lib/campamento-base/socialflow-control-plane-service`
- Tests necesarios:
  - `npx vitest run tests/lib/campobase-socialflow-service.test.ts`
  - `npx vitest run tests/lib/campamento-base-socialflow-control-plane-service.test.ts`
  - `npx vitest run tests/architecture/campobase-namespace-freeze.test.ts`
- Validaciones:
  - Confirmar que la cobertura funcional sigue pasando con el servicio canonico.
  - Mantener un test separado que compruebe el adapter legacy sin importarlo como dependencia principal, si todavia se necesita compat.
- Rollback:
  - Revertir solo el import del test y restaurar el edge allowlisted.
- Por que es seguro:
  - El archivo legacy `src/lib/campobase/socialflow-service.ts` ya reexporta el canonico.
  - No toca SocialFlow runtime ni rutas ni componentes.

### 2. Migrar test SocialFlow history legacy adapter

- Archivo a tocar: `tests/lib/campobase-social-automation-history.test.ts`
- Import a cambiar: `@/lib/campobase/social-automation-history`
- Equivalente recomendado: `@/lib/campamento-base/social-automation-history`
- Tests necesarios:
  - `npx vitest run tests/lib/campobase-social-automation-history.test.ts`
  - `npx vitest run tests/lib/campamento-base-social-automation-history.test.ts`
  - `npx vitest run tests/architecture/campobase-namespace-freeze.test.ts`
- Validaciones:
  - Ajustar expectativas solo si el contrato canonico usa estados extendidos o nombres de error canonicos.
  - Confirmar que no se crea ningun import nuevo hacia `@/lib/campobase`.
- Rollback:
  - Revertir el import y expectativas del test.
- Por que es seguro:
  - Ya existe modulo canonico.
  - El adapter legacy consume ese canonico.

### 3. Reducir cobertura legacy SocialFlow manteniendo test minimo de adapter

- Archivo a tocar: `tests/lib/campobase-socialflow-service.test.ts` o `tests/lib/campobase-social-automation-history.test.ts`
- Import a cambiar: mover la cobertura funcional al canonico y dejar solo una comprobacion de adapter si se decide conservar compat.
- Equivalente recomendado:
  - `@/lib/campamento-base/socialflow-control-plane-service`
  - `@/lib/campamento-base/social-automation-history`
- Tests necesarios:
  - Test canonico afectado.
  - Guardrail de namespace freeze.
- Validaciones:
  - Verificar que el allowlist baja de `14` en el bloque tecnico posterior.
  - Verificar que los adapters legacy siguen existiendo solo como compat temporal.
- Rollback:
  - Restaurar el test legacy original y el allowlist anterior.
- Por que debe esperar ligeramente:
  - Es seguro tecnicamente, pero requiere decidir si se elimina el test legacy completo o si se conserva una asercion minima de compat.

## Edges Que No Deben Tocarse Todavia

- Clinic:
  - `src/lib/campobase/clinic-platform.ts`
  - `tests/lib/campobase-clinic-platform-service.test.ts`
  - `tests/lib/saas-contract-definitions.test.ts` para Clinic
  - Motivo: depende de ownership/contrato vertical y no tiene equivalente canonico actual.

- TaskOps:
  - `src/lib/campobase/taskops-platform.ts`
  - `tests/lib/campobase-taskops-platform-service.test.ts`
  - `tests/lib/cross-saas-taskops-flow.test.ts`
  - `tests/lib/saas-contract-definitions.test.ts` para TaskOps
  - Motivo: depende de namespace transversal, signal bus y flujo cross-SaaS.

- Platform bootstrap:
  - `src/lib/campobase/platform-bootstrap.ts`
  - `tests/lib/campobase-platform-bootstrap.test.ts`
  - Motivo: sigue bloqueado por Clinic/TaskOps.

- Factory/orchestrator:
  - `tests/lib/factory-orchestrator.test.ts`
  - Motivo: requiere auditoria propia porque valida el loader compartido en runtime.

- SocialFlow registry legacy:
  - `tests/lib/campobase-social-automation-registry.test.ts`
  - Motivo: no existe equivalente canonico actual; requiere contrato antes de migrar.

## Recomendacion De Siguiente Bloque

Siguiente bloque recomendado, sin implementarlo:

`migrate socialflow legacy adapter tests to canonical campamento-base imports and shrink campobase namespace freeze allowlist`

Alcance recomendado:

- Empezar por `tests/lib/campobase-socialflow-service.test.ts`.
- Despues `tests/lib/campobase-social-automation-history.test.ts`.
- No tocar `social-automation-registry`, Clinic, TaskOps, platform-bootstrap ni factory-orchestrator en ese bloque.

Resultado esperado del bloque tecnico posterior:

- Allowlist podria bajar de `14` a `12` si se migran los dos tests SocialFlow con equivalente canonico.
- Riesgo bajo si se limita a tests y guardrail.

