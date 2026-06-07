# Campamento Base Namespace Rules

## Canonical decision
- Producto/capa canónica: Campamento Base.
- Namespace canónico: `src/lib/campamento-base/`.
- Namespace legacy temporal: `src/lib/campobase/`.

## Rules
- Todo nuevo código de control plane debe ir en `src/lib/campamento-base/`.
- No se permite crear nuevo código en `src/lib/campobase/`.
- No se permite añadir nuevos imports hacia `@/lib/campobase`.
- `src/lib/campobase/` solo puede tocarse para:
  - migración controlada
  - adapter temporal
  - eliminación validada
  - corrección urgente documentada
- La migración debe ser archivo por archivo, nunca en bloque.
- No se debe borrar `src/lib/campobase/` hasta que todos sus consumidores estén migrados y validados.
- `src/lib/campobase/socialflow-service.ts` es blocker de Phase C.2 y debe tratarse con prompt específico.

## Current known state
- `src/lib/campamento-base/`: 25 archivos.
- `src/lib/campobase/`: 10 archivos.
- imports hacia `@/lib/campamento-base`: 65.
- imports hacia `@/lib/campobase`: 52.

## Migration policy
- Migrar `campobase` en pasos pequeños y verificables, con un archivo o grupo mínimo por commit.
- Antes de migrar cada archivo:
  - identificar consumidores directos
  - definir test coverage mínima (unit/integration/architecture guardrail)
  - validar compatibilidad de contratos públicos
- Durante la migración:
  - mantener adapter/facade temporal para rollback
  - evitar cambios de naming y comportamiento en el mismo commit
  - registrar en auditoría qué se movió, qué quedó, y por qué
- Rollback:
  - cada commit debe poder revertirse sin romper consumidores legacy
  - mantener rutas de compatibilidad explícitas hasta validar consumidores migrados
- Adapters temporales:
  - deben marcarse explícitamente como compat/transitional
  - deben tener fecha/criterio de retiro en documentación
- Documentación:
  - actualizar runbooks y auditorías por cada migración
  - mantener matriz de estado de consumidores legacy (pendiente/en migración/migrado)

## Forbidden actions
- renombrar carpetas en bloque
- mover todo `campobase` de golpe
- borrar legacy sin pruebas
- mezclar SocialFlow runtime dentro de Campamento Base
- crear nuevos imports hacia `@/lib/campobase`
- cambiar Phase C.2 sin checkpoint específico
