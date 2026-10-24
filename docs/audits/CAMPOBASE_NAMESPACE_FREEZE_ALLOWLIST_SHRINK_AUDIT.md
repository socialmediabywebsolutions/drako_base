# CAMPOBASE_NAMESPACE_FREEZE_ALLOWLIST_SHRINK_AUDIT

**Date:** 2026-06-07  
**Block:** `audit campobase namespace freeze allowlist shrink readiness`  
**Scope:** inspeccion + documentacion + validacion (sin cambios productivos)

## 1) Inspeccion del guardrail actual

Archivo auditado:
- `tests/architecture/campobase-namespace-freeze.test.ts`

Estado actual del guardrail:
- El guardrail permite una allowlist estatica `FROZEN_CAMPOBASE_IMPORT_ALLOWLIST`.
- El test exige:
  - `foundEdges` debe ser subconjunto de la allowlist (sin edges inesperados).
  - `FROZEN_CAMPOBASE_IMPORT_ALLOWLIST.size === 30`.
- Esto protege contra crecimiento, pero no obliga a remover edges ya migrados.

### 1.1 Edges legacy permitidos actualmente por el guardrail

La allowlist actual contiene 30 edges:

1. `src/app/api/operator/platform/route.ts::@/lib/campobase/platform-operator-service`
2. `src/app/api/operator/socialflow/route.ts::@/lib/campobase/socialflow-service`
3. `src/components/campobase/CampoBaseSocialAutomationControl.tsx::@/lib/campobase/socialflow-service`
4. `src/components/campobase/PlatformOperatorControlSurface.tsx::@/lib/campobase/platform-operator-service`
5. `src/lib/campamento-base/orchestrator/snapshot-db.ts::@/lib/campobase/socialflow-service`
6. `src/lib/campobase/clinic-platform.ts::@/lib/campobase/clinic-platform-service`
7. `src/lib/campobase/platform-bootstrap.ts::@/lib/campobase/clinic-platform`
8. `src/lib/campobase/platform-bootstrap.ts::@/lib/campobase/socialflow-platform`
9. `src/lib/campobase/platform-bootstrap.ts::@/lib/campobase/taskops-platform`
10. `src/lib/campobase/platform-operator-service.ts::@/lib/campobase/platform-bootstrap`
11. `src/lib/campobase/socialflow-platform.ts::@/lib/campobase/socialflow-service`
12. `src/lib/campobase/taskops-platform.ts::@/lib/campobase/taskops-platform-service`
13. `src/lib/operator/social-automation-history.ts::@/lib/campobase/social-automation-history`
14. `src/lib/operator/socialflow-service.ts::@/lib/campobase/socialflow-service`
15. `tests/api/campobase-platform-route.test.ts::@/lib/campobase/platform-operator-service`
16. `tests/api/campobase-socialflow-route.test.ts::@/lib/campobase/socialflow-service`
17. `tests/components/campobase-social-page.test.tsx::@/lib/campobase/social-automation-history`
18. `tests/components/campobase-social-page.test.tsx::@/lib/campobase/socialflow-service`
19. `tests/components/operator-socialflow-health-panel.test.tsx::@/lib/campobase/socialflow-service`
20. `tests/lib/campobase-clinic-platform-service.test.ts::@/lib/campobase/clinic-platform-service`
21. `tests/lib/campobase-platform-bootstrap.test.ts::@/lib/campobase/platform-bootstrap`
22. `tests/lib/campobase-social-automation-history.test.ts::@/lib/campobase/social-automation-history`
23. `tests/lib/campobase-social-automation-registry.test.ts::@/lib/campobase/social-automation-registry`
24. `tests/lib/campobase-socialflow-service.test.ts::@/lib/campobase/socialflow-service`
25. `tests/lib/campobase-taskops-platform-service.test.ts::@/lib/campobase/taskops-platform-service`
26. `tests/lib/cross-saas-taskops-flow.test.ts::@/lib/campobase/taskops-platform`
27. `tests/lib/factory-orchestrator.test.ts::@/lib/campobase/platform-bootstrap`
28. `tests/lib/saas-contract-definitions.test.ts::@/lib/campobase/clinic-platform`
29. `tests/lib/saas-contract-definitions.test.ts::@/lib/campobase/socialflow-platform`
30. `tests/lib/saas-contract-definitions.test.ts::@/lib/campobase/taskops-platform`

### 1.2 Cruce con auditorias previas

Archivos auditados:
- `docs/audits/REMAINING_CAMPOBASE_RUNTIME_IMPORTS_AUDIT.md`
- `docs/audits/PLATFORM_OPERATOR_CONTROL_SURFACE_IMPORT_READINESS_AUDIT.md`
- `docs/audits/CAMPOBASE_SOCIAL_AUTOMATION_CONTROL_IMPORT_READINESS_AUDIT.md`

Conclusiones consistentes con el estado actual:
- Migraciones recientes ya movieron imports criticos a canonico (`campamento-base`) en rutas/operator y componentes.
- La allowlist actual todavia conserva varios edges legacy que ya no existen.
- El pin de tamano en `30` esta desactualizado respecto al estado real encontrado.

## 2) Comparacion con estado real

### 2.1 Busqueda pedida: `src/**/*.ts` y `src/**/*.tsx` hacia `@/lib/campobase`

Edges reales actuales en `src` (5):

1. `src/lib/campobase/clinic-platform.ts::@/lib/campobase/clinic-platform-service`
2. `src/lib/campobase/platform-bootstrap.ts::@/lib/campobase/clinic-platform`
3. `src/lib/campobase/platform-bootstrap.ts::@/lib/campobase/taskops-platform`
4. `src/lib/campobase/taskops-platform.ts::@/lib/campobase/taskops-platform-service`
5. `src/lib/operator/social-automation-history.ts::@/lib/campobase/social-automation-history`

### 2.2 Clasificacion solicitada

#### A) Edges reales actuales
- En scope total del guardrail (`src` + `tests` + `scripts`): 19 edges detectados.
- En `src` unicamente: 5 edges.

#### B) Edges allowlisted ya inexistentes

Se detectan 11 edges stale en la allowlist actual:

1. `src/app/api/operator/platform/route.ts::@/lib/campobase/platform-operator-service`
2. `src/app/api/operator/socialflow/route.ts::@/lib/campobase/socialflow-service`
3. `src/components/campobase/CampoBaseSocialAutomationControl.tsx::@/lib/campobase/socialflow-service`
4. `src/components/campobase/PlatformOperatorControlSurface.tsx::@/lib/campobase/platform-operator-service`
5. `src/lib/campamento-base/orchestrator/snapshot-db.ts::@/lib/campobase/socialflow-service`
6. `src/lib/campobase/platform-bootstrap.ts::@/lib/campobase/socialflow-platform`
7. `src/lib/campobase/platform-operator-service.ts::@/lib/campobase/platform-bootstrap`
8. `src/lib/campobase/socialflow-platform.ts::@/lib/campobase/socialflow-service`
9. `src/lib/operator/socialflow-service.ts::@/lib/campobase/socialflow-service`
10. `tests/api/campobase-platform-route.test.ts::@/lib/campobase/platform-operator-service`
11. `tests/api/campobase-socialflow-route.test.ts::@/lib/campobase/socialflow-service`

#### C) Edges allowlisted todavia necesarios
- Los otros 19 edges de la allowlist siguen presentes y son necesarios hoy para no romper el freeze test.

#### D) Edges dentro de legacy congelado `src/lib/campobase/*`
- `src/lib/campobase/clinic-platform.ts::@/lib/campobase/clinic-platform-service`
- `src/lib/campobase/platform-bootstrap.ts::@/lib/campobase/clinic-platform`
- `src/lib/campobase/platform-bootstrap.ts::@/lib/campobase/taskops-platform`
- `src/lib/campobase/taskops-platform.ts::@/lib/campobase/taskops-platform-service`

#### E) Edges fuera de legacy que aun hay que migrar
- `src/lib/operator/social-automation-history.ts::@/lib/campobase/social-automation-history`

No hay otros edges externos en `src` apuntando a `@/lib/campobase`.

### 2.3 ¿Size/contador desactualizado?

Si.

- `allowlist.size` actual: 30
- edges reales detectados por el mismo criterio del guardrail: 19
- diferencia stale: 11

Conclusion: el pin `toBe(30)` esta desactualizado para estado post-migraciones recientes.

## 3) Riesgo de tocar el guardrail

- Riesgo tecnico: low si solo se eliminan edges ya inexistentes y se ajusta el size.
- Riesgo de compatibilidad: low (no cambia runtime, solo politica de freeze).
- Riesgo operativo: medium-low por posibilidad de eliminar edge equivocado (mitigable con freeze test + typecheck).

## 4) Opciones (A/B/C)

### Opcion A — Reducir allowlist ahora
- Riesgo: low
- Impacto: limpia deuda de guardrail y alinea policy con estado real.
- Tests necesarios:
  - `pnpm typecheck`
  - `npx vitest run tests/architecture/campobase-namespace-freeze.test.ts`
- Rollback:
  - restaurar edges removidos y tamano previo en el mismo archivo de test.

### Opcion B — Esperar hasta migrar otro edge runtime
- Riesgo: low inmediato / medium estrategico
- Impacto: mantiene desalineacion entre allowlist y realidad; retrasa reduccion controlada.
- Tests necesarios:
  - los mismos cuando eventualmente se haga el shrink.
- Rollback:
  - no aplica (no hay cambio ahora).

### Opcion C — Separar allowlist en runtime externo vs legacy interno antes de reducir
- Riesgo: medium (cambio estructural mayor del guardrail).
- Impacto: mejor legibilidad y gobernanza futura, pero mayor superficie de cambio.
- Tests necesarios:
  - `pnpm typecheck`
  - `npx vitest run tests/architecture/campobase-namespace-freeze.test.ts`
  - idealmente tests adicionales del propio guardrail si se reestructura la logica.
- Rollback:
  - revert de reestructura completa del guardrail.

## 5) Recomendacion final

Recomendada: Opcion A (reducir allowlist ahora).

Motivo:
- Hay evidencia directa de 11 edges stale ya migrados/eliminados.
- El guardrail actualmente no falla porque solo bloquea crecimiento, no obsolescencia.
- Reducir ahora mantiene el freeze creible y evita arrastrar deuda de policy.

## 6) Validaciones ejecutadas en este bloque de auditoria

Ejecutado (solo lo solicitado):
- `pnpm typecheck`
- `npx vitest run tests/architecture/campobase-namespace-freeze.test.ts`

Resultado: ambos pasan en estado actual sin cambiar codigo productivo.

## 7) Propuesta de shrink (sin implementar en este bloque)

Si se aprueba el siguiente bloque de cambio del guardrail, remover exactamente estos 11 edges stale:

1. `src/app/api/operator/platform/route.ts::@/lib/campobase/platform-operator-service`
2. `src/app/api/operator/socialflow/route.ts::@/lib/campobase/socialflow-service`
3. `src/components/campobase/CampoBaseSocialAutomationControl.tsx::@/lib/campobase/socialflow-service`
4. `src/components/campobase/PlatformOperatorControlSurface.tsx::@/lib/campobase/platform-operator-service`
5. `src/lib/campamento-base/orchestrator/snapshot-db.ts::@/lib/campobase/socialflow-service`
6. `src/lib/campobase/platform-bootstrap.ts::@/lib/campobase/socialflow-platform`
7. `src/lib/campobase/platform-operator-service.ts::@/lib/campobase/platform-bootstrap`
8. `src/lib/campobase/socialflow-platform.ts::@/lib/campobase/socialflow-service`
9. `src/lib/operator/socialflow-service.ts::@/lib/campobase/socialflow-service`
10. `tests/api/campobase-platform-route.test.ts::@/lib/campobase/platform-operator-service`
11. `tests/api/campobase-socialflow-route.test.ts::@/lib/campobase/socialflow-service`

Y actualizar el pin de tamano de `30` a `19`.
