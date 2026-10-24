# Campamento Base Social Automation Registry Contract v1

## 1. Purpose

Este contrato existe para decidir como sustituir gradualmente:

`src/lib/campobase/social-automation-registry.ts`

sin romper tests legacy, sin crear nuevas dependencias hacia Campobase y sin mezclar responsabilidades con SocialFlow runtime.

Alcance de este bloque:

- documentacion contractual unicamente;
- sin implementacion tecnica;
- sin cambios de imports, runtime o tests;
- sin modulo canonico nuevo todavia.

El objetivo es definir ownership, fuente de verdad y API futura antes de reducir el edge restante del guardrail.

## 2. Ownership

Ownership definido:

- Campamento Base es dueno del registry si se considera configuracion/control-plane de automatizacion social.
- SocialFlow puede consumir configuracion para ejecutar automatizaciones, pero no debe ser dueno del control-plane registry.
- `automation-core` puede ser fuente de verdad si se decide consolidar configuracion de automatizaciones en una sola tabla/servicio.
- `src/lib/operator/` puede exponer una facade de consumo si la UI/operator necesita leer o mutar registry.
- `src/lib/campobase/` queda como adapter legacy temporal durante la migracion controlada.

Regla canonica obligatoria:

- Campamento Base es canonico.
- `src/lib/campamento-base/` es el namespace canonico si el registry pertenece al control-plane.
- `src/lib/operator/` puede ser facade de consumo.
- Campobase es legacy congelado.
- `src/lib/campobase/` solo se mantiene como compatibilidad temporal.
- No se debe crear ningun archivo nuevo con nombre `campobase`.
- No se debe crear ningun import nuevo hacia `@/lib/campobase`.

## 3. Current legacy state

Estado actual documentado:

- `src/lib/campobase/social-automation-registry.ts`
  - implementacion legacy real;
  - persistencia D1 directa via `@/lib/db`;
  - tabla propia legacy;
  - sin consumidores runtime detectados actualmente en `src`.
- `tests/lib/campobase-social-automation-registry.test.ts`
  - test de compatibilidad de la implementacion legacy;
  - unico consumidor TypeScript activo del modulo legacy, aparte del guardrail.

Exports actuales:

- `CampoBaseSocialAutomationRegistryItem`
- `UpsertCampoBaseSocialAutomationRegistryInput`
- `upsertCampoBaseSocialAutomationRegistry`
- `getCampoBaseSocialAutomationRegistryItem`
- `listCampoBaseSocialAutomationRegistryItems`
- `listEnabledCampoBaseSocialAutomationRegistryItems`
- `setCampoBaseSocialAutomationEnabled`
- `removeCampoBaseSocialAutomationRegistryItem`

Tabla legacy:

- Nombre: `campobase_social_automation_registry`
- Primary key: `tenant_id`, `saas_id`
- Indice unico: `idx_campobase_social_automation_registry_unique`
- Indice enabled/updated: `idx_campobase_social_automation_registry_enabled_updated`

Campos legacy y shape externo:

- `tenantId` (`tenant_id`)
- `saasId` (`saas_id`)
- `niche`
- `tone`
- `frequencyPerWeek` (`frequency_per_week`)
- `enabled`
- `createdAt` (`created_at`)
- `updatedAt` (`updated_at`)

Lectura arquitectonica:

- El modulo guarda configuracion vigente de automatizacion social, no historial.
- No ejecuta SocialFlow runtime.
- No llama a contratos de `src/lib/socialflow/contracts/*`.
- No usa `automation-core`, aunque su responsabilidad se solapa parcialmente con `AutomationRegistration.config`.

## 4. Source of truth decision

### A. Mantener tabla propia canonica para registry

Ventajas:

- Preserva la semantica CRUD actual 1:1.
- Permite una migracion pequena desde legacy hacia `src/lib/campamento-base/social-automation-registry.ts`.
- Mantiene el registry como concepto explicito de control-plane.
- Facilita un adapter legacy delgado.

Riesgos:

- Puede duplicar fuente de verdad con `automation-core`.
- Requiere decidir si se reutiliza la tabla legacy o se crea tabla canonica nueva.
- Si SocialFlow ya usa `AutomationRegistration.config`, podria quedar un registry no consumido.

Impacto:

- Nuevo modulo canonico en `src/lib/campamento-base/social-automation-registry.ts`.
- Adapter temporal en `src/lib/campobase/social-automation-registry.ts`.
- Test canonico nuevo o migracion del test actual.
- Guardrail baja de `12` a `11` si el test deja de importar legacy.

Rollback:

- Revertir modulo canonico y adapter.
- Restaurar test legacy y edge allowlisted.
- Mantener tabla legacy intacta.

Recomendacion:

- Viable solo si se confirma que el registry separado sigue siendo fuente de verdad necesaria.

### B. Usar `automation-core` como fuente de verdad

Ventajas:

- Evita doble fuente de verdad.
- Aprovecha `AutomationRegistration.config`, donde ya caben `niche`, `tone` y `frequencyPerWeek`.
- Alinea enable/disable con `enableAutomation` y `disableAutomation`.
- Encaja con `src/lib/campamento-base/socialflow-control-plane-service.ts`, que ya registra y consulta automatizaciones SocialFlow.

Riesgos:

- No hay delete/remove 1:1 equivalente al legacy registry.
- La API legacy de list/get/upsert tendria que mapearse a registrations.
- Puede requerir normalizadores para distinguir automatizaciones SocialFlow de otras automation keys.
- Requiere decidir como preservar timestamps y defaults legacy.

Impacto:

- Posible modulo canonico como wrapper sobre `automation-core`, o funciones dedicadas en control-plane.
- Adapter legacy podria delegar a la API canonica sin mantener tabla propia.
- Tests deben validar mapping de config y enabled.

Rollback:

- Revertir wrapper/canonico y test migration.
- Mantener tabla legacy sin migracion de datos.

Recomendacion:

- Fuente de verdad recomendada si se confirma que no hay consumidores runtime de la tabla legacy y que `automation-core` es el registro operativo real.

### C. Exponer registry como capa de compatibilidad sobre `socialflow-control-plane-service`

Ventajas:

- Evita crear otro repositorio de datos.
- Reutiliza APIs existentes:
  - `registerCampoBaseSocialAutomation`
  - `getCampoBaseSocialAutomationStatus`
  - `getCampoBaseSocialAutomationStatusForSaas`
  - `enableCampoBaseSocialAutomationForSaas`
  - `disableCampoBaseSocialAutomationForSaas`
- Reduce superficie nueva.

Riesgos:

- Mezcla una semantica CRUD de registry con un servicio control-plane ya amplio.
- `removeSocialAutomationRegistryItem` no tiene equivalente claro.
- El naming legacy `CampoBase...` sigue filtrandose en la API canonica actual del servicio.
- Puede hacer mas dificil extraer facade `src/lib/operator/` despues.

Impacto:

- No necesariamente crea `social-automation-registry.ts`.
- Test legacy podria migrarse a expectativas sobre el servicio control-plane.
- El guardrail podria bajar si el test deja de importar legacy.

Rollback:

- Restaurar test legacy y edge del guardrail.
- No requiere revertir tabla si no se toca persistencia.

Recomendacion:

- Util para deprecacion si se decide no conservar registry como concepto. No recomendado si se necesita API registry estable y neutra.

## 5. Canonical API surface

Si se crea modulo canonico, la ubicacion propuesta es:

`src/lib/campamento-base/social-automation-registry.ts`

Funciones propuestas:

- `upsertSocialAutomationRegistryItem(input: UpsertSocialAutomationRegistryInput): Promise<SocialAutomationRegistryItem>`
- `getSocialAutomationRegistryItem(tenantId: string, saasId: string): Promise<SocialAutomationRegistryItem | null>`
- `listSocialAutomationRegistryItems(): Promise<SocialAutomationRegistryItem[]>`
- `listEnabledSocialAutomationRegistryItems(): Promise<SocialAutomationRegistryItem[]>`
- `setSocialAutomationRegistryEnabled(tenantId: string, saasId: string, enabled: boolean): Promise<SocialAutomationRegistryItem | null>`
- `removeSocialAutomationRegistryItem(tenantId: string, saasId: string): Promise<boolean>`

Tipos propuestos:

- `SocialAutomationRegistryItem`
- `UpsertSocialAutomationRegistryInput`
- `SocialAutomationRegistryStatus` si aplica

Contrato minimo:

- No importar desde `@/lib/campobase`.
- No depender de SocialFlow runtime.
- Exponer nombres neutros sin `CampoBase`.
- Mantener compatibilidad externa con `tenantId + saasId`.
- Documentar si la persistencia real es tabla canonica propia o `automation-core`.

## 6. Data shape

Shape estable propuesto:

```ts
type SocialAutomationRegistryItem = {
  tenantId: string;
  saasId: string;
  niche: string;
  tone: string;
  frequencyPerWeek: number;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
};

type UpsertSocialAutomationRegistryInput = {
  tenantId: string;
  saasId: string;
  niche: string;
  tone: string;
  frequencyPerWeek: number;
  enabled?: boolean;
};
```

Compatibilidad con legacy:

- `tenantId`, `saasId`, `niche`, `tone`, `frequencyPerWeek`, `enabled`, `createdAt` y `updatedAt` deben conservar significado.
- Si se usa tabla legacy temporalmente, el modulo canonico debe ocultar nombres SQL legacy.
- Si se usa `automation-core`, `niche`, `tone` y `frequencyPerWeek` deben mapearse a `AutomationRegistration.config`.
- `enabled` debe mapearse a estado de registration.
- `createdAt` y `updatedAt` deben derivarse de la fuente de verdad elegida y mantenerse estables para tests.

## 7. Relationship with automation-core

Lo que ya cubre `automation-core`:

- Registro de automatizaciones por `tenantId`, `saasId` y `automationKey`.
- Estado `enabled`.
- Configuracion arbitraria en `config`.
- Timestamps de registration.
- APIs usadas por `socialflow-control-plane-service`:
  - `registerAutomation`
  - `getAutomation`
  - `listAutomations`
  - `enableAutomation`
  - `disableAutomation`

Lo que el legacy registry cubre y `automation-core` no expone como registry 1:1:

- CRUD neutro por `tenantId + saasId` sin requerir `automationKey` en la API publica.
- `removeCampoBaseSocialAutomationRegistryItem`.
- Listado de solo enabled registry items con shape especifica.
- Tabla legacy propia con nombre `campobase_social_automation_registry`.

Mapping recomendado si se elige `automation-core`:

- `niche`, `tone`, `frequencyPerWeek` -> `AutomationRegistration.config`.
- `enabled` -> `AutomationRegistration.enabled`.
- `tenantId`, `saasId` -> claves de registration.
- `automationKey` implicita -> `socialflow.content_generation` para registry social principal, salvo que el contrato extienda multiproposito.

Como evitar doble fuente de verdad:

- Elegir una sola fuente oficial antes de implementar.
- Si se usa `automation-core`, no escribir tabla registry nueva en paralelo.
- Si se mantiene tabla canonica propia, definir explicitamente que `automation-core` consume datos derivados o sincronizados, no otra verdad primaria.
- No introducir un wrapper que escriba ambos sitios sin reglas de reconciliacion.

Recomendacion de fuente de verdad:

- Preferir `automation-core` como fuente de verdad operativa si el objetivo es reducir deuda y no hay consumidores runtime de la tabla legacy.
- Crear modulo canonico propio solo como API/facade si se necesita preservar contrato registry, no como segunda persistencia.

## 8. Migration strategy

### Phase A - Contract only

Solo este documento.

No tocar:

- codigo productivo;
- tests;
- imports;
- runtime;
- migrations;
- guardrail.

### Phase B - Canonical module decision

Decidir si:

- se crea modulo canonico propio en `src/lib/campamento-base/social-automation-registry.ts`;
- se crea wrapper sobre `automation-core`;
- se depreca el registry como concepto separado y se migra hacia `socialflow-control-plane-service`.

Decision requerida:

- fuente de verdad;
- estrategia para `remove`;
- mapping de timestamps;
- compatibilidad con test legacy;
- si hace falta facade `src/lib/operator/`.

### Phase C - Create canonical module

Crear `src/lib/campamento-base/social-automation-registry.ts` si aplica.

Condiciones:

- No importar desde `@/lib/campobase`.
- No tocar SocialFlow runtime.
- No tocar Clinic ni TaskOps.
- Mantener API neutra.

### Phase D - Convert legacy adapter

Convertir `src/lib/campobase/social-automation-registry.ts` en adapter temporal si se aprueba.

Condiciones:

- El adapter debe delegar al canonico.
- No debe seguir siendo fuente primaria de nueva logica.
- Debe conservar exports legacy mientras existan consumidores.

### Phase E - Update tests and shrink allowlist

Migrar `tests/lib/campobase-social-automation-registry.test.ts` para cubrir el canonico o dividir cobertura:

- test canonico para comportamiento principal;
- test minimo de adapter si se requiere compat.

Despues:

- eliminar edge `tests/lib/campobase-social-automation-registry.test.ts::@/lib/campobase/social-automation-registry`;
- bajar guardrail de `12` a `11` si aplica.

## 9. Non-goals

Este contrato no autoriza:

- tocar SocialFlow runtime;
- tocar UI;
- tocar rutas;
- tocar servicios runtime;
- tocar Clinic;
- tocar TaskOps;
- tocar platform-bootstrap;
- tocar factory/orchestrator;
- tocar Mentoría;
- tocar migrations;
- eliminar legacy todavia;
- crear imports nuevos hacia `@/lib/campobase`;
- crear archivos nuevos con nombre `campobase`.

## 10. First safe implementation block proposal

Bloque tecnico propuesto, sin implementarlo:

`create canonical social automation registry facade over automation-core`

Objetivo:

- Crear una API canonica neutra para registry social bajo Campamento Base.
- Usar `automation-core` como fuente de verdad si se confirma que no hay consumidores runtime de la tabla legacy.
- Mantener `src/lib/campobase/social-automation-registry.ts` como adapter temporal.
- Reducir el guardrail solo cuando el test deje de importar legacy.

Archivos a crear:

- `src/lib/campamento-base/social-automation-registry.ts`
- `tests/lib/campamento-base-social-automation-registry.test.ts`

Archivos a modificar:

- `src/lib/campobase/social-automation-registry.ts`
- `tests/lib/campobase-social-automation-registry.test.ts`
- `tests/architecture/campobase-namespace-freeze.test.ts`

Archivos que NO se deben tocar:

- `src/lib/campamento-base/socialflow-control-plane-service.ts`, salvo que el bloque aprobado decida integracion explicita;
- `src/lib/socialflow/**/*`;
- `src/components/**/*`;
- `src/app/**/*`;
- `src/lib/campobase/clinic-platform*`;
- `src/lib/campobase/taskops-platform*`;
- `src/lib/campobase/platform-bootstrap.ts`;
- `tests/lib/campobase-clinic-platform-service.test.ts`;
- `tests/lib/campobase-taskops-platform-service.test.ts`;
- `tests/lib/cross-saas-taskops-flow.test.ts`;
- `tests/lib/factory-orchestrator.test.ts`;
- `tests/lib/saas-contract-definitions.test.ts`;
- `migrations/**/*`.

Tests necesarios:

- `pnpm typecheck`
- `npx vitest run tests/lib/campamento-base-social-automation-registry.test.ts`
- `npx vitest run tests/lib/campobase-social-automation-registry.test.ts`
- `npx vitest run tests/architecture/campobase-namespace-freeze.test.ts`

Validaciones:

- Confirmar que no se introduce import nuevo hacia `@/lib/campobase`.
- Confirmar que el nuevo modulo canonico no contiene `@/lib/campobase`.
- Confirmar que el guardrail baja de `12` a `11` solo despues de migrar el test legacy.
- Confirmar que no se toca SocialFlow runtime.

Rollback:

- Revertir modulo canonico y test canonico.
- Restaurar legacy implementation original.
- Restaurar edge allowlisted y pin `12`.

Por que es el paso mas seguro:

- Separa contrato/API canonica de SocialFlow runtime.
- Evita tocar rutas, UI, Clinic, TaskOps y platform-bootstrap.
- Usa la fuente de verdad operativa existente si se confirma `automation-core`.
- Mantiene compat legacy mientras reduce deuda de imports de forma controlada.

