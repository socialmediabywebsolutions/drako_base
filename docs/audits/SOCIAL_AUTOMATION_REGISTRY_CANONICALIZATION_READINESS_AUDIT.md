# Social Automation Registry Canonicalization Readiness Audit

## Scope

Auditoria exclusiva de:

- `src/lib/campobase/social-automation-registry.ts`
- `tests/lib/campobase-social-automation-registry.test.ts`

Contexto canonico aplicado:

- Campamento Base es canonico.
- `src/lib/campamento-base/` es el namespace canonico para control-plane si aplica.
- `src/lib/operator/` puede ser facade de consumo si aplica.
- Campobase es legacy congelado.
- `src/lib/campobase/` solo se mantiene como compatibilidad temporal.
- No se debe crear ningun import nuevo hacia `@/lib/campobase`.

Esta auditoria no implementa cambios, no crea modulo canonico y no toca tests.

## Registry Legacy Actual

Archivo: `src/lib/campobase/social-automation-registry.ts`

Exports actuales:

- Type `CampoBaseSocialAutomationRegistryItem`
- Type `UpsertCampoBaseSocialAutomationRegistryInput`
- `upsertCampoBaseSocialAutomationRegistry`
- `getCampoBaseSocialAutomationRegistryItem`
- `listCampoBaseSocialAutomationRegistryItems`
- `listEnabledCampoBaseSocialAutomationRegistryItems`
- `setCampoBaseSocialAutomationEnabled`
- `removeCampoBaseSocialAutomationRegistryItem`

Persistencia y estado:

- Usa D1 via `getDb` desde `@/lib/db`.
- No usa memoria como fuente de verdad; solo mantiene `schemaReady` como cache de inicializacion.
- Crea tabla propia: `campobase_social_automation_registry`.
- Crea indices propios:
  - `idx_campobase_social_automation_registry_unique`
  - `idx_campobase_social_automation_registry_enabled_updated`
- No llama a contratos externos.
- No usa SocialFlow runtime.
- No usa `automation-core`.

Problema que resuelve:

- Mantiene una configuracion simple por `tenantId + saasId` para automatizacion social:
  - `niche`
  - `tone`
  - `frequencyPerWeek`
  - `enabled`
  - timestamps de creacion/actualizacion

Lectura arquitectonica:

- Por datos y naming, pertenece al historico de integracion SocialFlow/Campobase legacy.
- Por responsabilidad, se parece a control-plane de configuracion de automatizaciones.
- En la arquitectura actual, el equivalente funcional parcial vive en `automation-core`, consumido por `src/lib/campamento-base/socialflow-control-plane-service.ts`.
- No parece pertenecer a SocialFlow runtime: no genera contenido, no ejecuta publicacion y no consume contratos de `src/lib/socialflow/contracts/*`.

## Modulos Canonicos Relacionados

### `src/lib/campamento-base/socialflow-control-plane-service.ts`

Este modulo ya registra y consulta automatizaciones SocialFlow mediante `automation-core`.

Cobertura parcial del registry legacy:

- `registerCampoBaseSocialAutomation` guarda `niche`, `tone`, `frequencyPerWeek` en `AutomationRegistration.config`.
- `getCampoBaseSocialAutomationStatus` lista automatizaciones desde `listAutomations`.
- `getCampoBaseSocialAutomationStatusForSaas` usa `getAutomation`.
- `enableCampoBaseSocialAutomationForSaas` y `disableCampoBaseSocialAutomationForSaas` usan `enableAutomation` / `disableAutomation`.

Brecha frente al registry legacy:

- No expone CRUD por tabla `campobase_social_automation_registry`.
- No expone remove/delete equivalente.
- No mantiene la tabla legacy.
- No tiene API canonica con nombres neutros para registry.

### `src/lib/campamento-base/social-automation-history.ts`

Este modulo es historico de ejecuciones, no registry de configuracion.

Cobertura parcial:

- Ninguna para `niche`, `tone`, `frequencyPerWeek` como configuracion vigente.
- No reemplaza el registry.

## Test Legacy Actual

Archivo: `tests/lib/campobase-social-automation-registry.test.ts`

Import legacy:

- `@/lib/campobase/social-automation-registry`

Simula:

- Fake D1 con array `rows`.
- `CREATE TABLE`, indices, `INSERT ... ON CONFLICT`, `UPDATE`, `DELETE`, `SELECT`.

Cubre:

- upsert inicial con timestamps.
- upsert preserva `createdAt` y cambia `updatedAt`.
- get por `tenantId + saasId`.
- list ordenado por `updatedAt desc`.
- listEnabled.
- set enabled.
- remove.

Clasificacion:

- Test de compatibilidad de implementacion legacy.
- No es test runtime externo.
- No debe migrarse 1:1 hasta definir si la fuente canonica sera tabla nueva, `automation-core`, o API de control-plane.

## Consumidores Detectados

Busqueda realizada sobre `src`, `tests`, `scripts`, `docs`.

| Path | Tipo | Simbolos usados | Riesgo | Accion recomendada |
|---|---|---|---|---|
| `tests/lib/campobase-social-automation-registry.test.ts` | tests | Todos los exports publicos del registry legacy | medium | Mantener hasta contrato o modulo canonico |
| `tests/architecture/campobase-namespace-freeze.test.ts` | guardrail | Edge allowlisted | low | Mantener pin hasta bloque tecnico |
| `docs/audits/*` | docs | Menciones historicas/auditoria | low | Actualizar solo si se ejecuta bloque posterior |

No se detectaron consumidores runtime en `src`.

No se detectaron consumidores en `scripts`.

## Opciones

### Opcion A: Crear modulo canonico en `src/lib/campamento-base/social-automation-registry.ts`

Riesgo: medium.

Impacto:

- Crea una API canonica para configuracion Social Automation dentro de Campamento Base.
- Permite migrar el test legacy y reducir el guardrail en un bloque pequeno posterior.
- Debe decidir si conserva la tabla legacy o usa tabla nueva/canonica.

Archivos implicados en un bloque posterior:

- `src/lib/campamento-base/social-automation-registry.ts`
- `src/lib/campobase/social-automation-registry.ts` como adapter temporal
- `tests/lib/campamento-base-social-automation-registry.test.ts` o test canonico equivalente
- `tests/lib/campobase-social-automation-registry.test.ts`
- `tests/architecture/campobase-namespace-freeze.test.ts`

Tests necesarios:

- Test canonico del registry.
- Test de adapter legacy si se conserva compat.
- Guardrail `campobase-namespace-freeze`.
- `pnpm typecheck`.

Rollback:

- Revertir modulo canonico, adapter y test migration.
- Restaurar edge allowlisted y pin anterior.

Recomendacion:

- Viable, pero no como primer paso. Requiere contrato documental previo para decidir tabla y ownership.

### Opcion B: Integrar registry dentro de `src/lib/campamento-base/socialflow-control-plane-service.ts`

Riesgo: medium/high.

Impacto:

- Evita un modulo nuevo.
- Mezcla CRUD de configuracion persistente con servicio control-plane que ya usa `automation-core`.
- Puede duplicar o confundir la fuente de verdad entre tabla legacy y automation registrations.

Archivos implicados en un bloque posterior:

- `src/lib/campamento-base/socialflow-control-plane-service.ts`
- tests del servicio control-plane
- test legacy del registry si se migra
- guardrail

Tests necesarios:

- `tests/lib/campamento-base-socialflow-control-plane-service.test.ts`
- test especifico de registry si se conserva superficie CRUD.
- guardrail.

Rollback:

- Revertir funciones nuevas en el servicio y test changes.

Recomendacion:

- No recomendado como primer movimiento. El servicio ya esta cargado de responsabilidades y el registry tiene semantica CRUD propia.

### Opcion C: Moverlo a `src/lib/socialflow/`

Riesgo: medium.

Impacto:

- Ubica la configuracion cerca del dominio SocialFlow.
- Puede ser correcto si se define como configuracion interna de producto SocialFlow.
- Pero el registry actual habla de `tenantId`, `saasId` y control-plane, no de ejecucion runtime SocialFlow.

Archivos implicados en un bloque posterior:

- `src/lib/socialflow/...`
- adapter legacy en `src/lib/campobase/social-automation-registry.ts`
- tests canonicos nuevos
- guardrail

Tests necesarios:

- Test de modulo SocialFlow nuevo.
- Tests de boundaries SocialFlow si aplican.
- Guardrail.

Rollback:

- Revertir modulo nuevo y adapter.

Recomendacion:

- Esperar. Solo elegir esta opcion si un contrato declara que la fuente de verdad pertenece al dominio SocialFlow y no al control-plane de Campamento Base.

### Opcion D: Mantenerlo como adapter legacy temporal y no tocar todavia

Riesgo: low inmediato, medium acumulado.

Impacto:

- No reduce el guardrail.
- Mantiene deuda conocida y congelada.
- Evita crear un canonico sin contrato.

Archivos implicados:

- Ninguno en este bloque.

Tests necesarios:

- Test legacy actual.
- Guardrail.

Rollback:

- No aplica.

Recomendacion:

- Correcto si no se aprueba contrato previo. No debe ser el estado final.

### Opcion E: Crear primero contrato documental antes de implementar

Riesgo: low.

Impacto:

- Define ownership antes de tocar codigo.
- Permite decidir entre:
  - modulo canonico independiente en Campamento Base,
  - integracion con `socialflow-control-plane-service`,
  - ubicacion en `src/lib/socialflow/`,
  - deprecacion si `automation-core` ya reemplaza el caso real.

Archivos implicados en un bloque posterior:

- Documento de contrato en `docs/contracts/`.
- Luego, si se aprueba, modulo/test/guardrail en bloque separado.

Tests necesarios:

- Para contrato documental: typecheck no estrictamente necesario por contenido docs, pero puede ejecutarse como gate liviano.
- Para implementacion posterior: typecheck, test canonico, test legacy adapter, guardrail.

Rollback:

- Revertir contrato documental sin impacto runtime.

Recomendacion:

- Recomendacion final: elegir Opcion E primero.

## Recomendacion Final

Ownership recomendado:

- Campamento Base control-plane, no SocialFlow runtime.

Namespace recomendado:

- Contrato primero.
- Si el contrato confirma que sigue existiendo registry separado, crear modulo canonico bajo `src/lib/campamento-base/social-automation-registry.ts`.
- Si el contrato concluye que `automation-core` ya es la fuente de verdad, no crear registry canonico 1:1; migrar/deprecar el test legacy hacia APIs del `socialflow-control-plane-service`.

Equivalente canonico actual:

- No existe equivalente 1:1.
- Existe equivalente parcial en `src/lib/campamento-base/socialflow-control-plane-service.ts` via `automation-core`.

Migracion 1:1:

- No recomendada todavia.
- Requiere contrato previo para decidir fuente de verdad y compatibilidad de tabla.

## Guardrail

Edge afectado:

- `tests/lib/campobase-social-automation-registry.test.ts::@/lib/campobase/social-automation-registry`

Size pinned actual:

- `12`

¿Se puede reducir ahora?

- No en este bloque.

Que deberia pasar antes de reducirlo:

- Aprobar contrato de ownership/fuente de verdad.
- Crear modulo canonico o decidir deprecacion hacia `socialflow-control-plane-service`.
- Migrar el test para que no importe `@/lib/campobase/social-automation-registry`.
- Mantener o crear una comprobacion de adapter solo si existe compat requerida.
- Bajar el pin del guardrail de `12` a `11` en el bloque tecnico posterior.

## Siguiente Bloque Recomendado

Sin implementarlo:

`write social automation registry canonical contract`

Alcance sugerido:

- Documento en `docs/contracts/`.
- Resolver fuente de verdad:
  - tabla legacy,
  - tabla canonica nueva,
  - `automation-core`,
  - o servicio control-plane.
- Definir si el modulo canonico debe existir en `src/lib/campamento-base/`.
- No tocar codigo productivo hasta cerrar el contrato.

