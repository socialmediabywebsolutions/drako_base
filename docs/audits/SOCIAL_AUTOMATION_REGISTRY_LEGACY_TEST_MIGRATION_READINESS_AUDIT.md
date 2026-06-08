# Social Automation Registry Legacy Test Migration Readiness Audit

## Scope

Auditoria para decidir si ya es seguro migrar:

`tests/lib/campobase-social-automation-registry.test.ts`

desde:

`@/lib/campobase/social-automation-registry`

hacia:

`@/lib/campamento-base/social-automation-registry`

y reducir el guardrail de `12` a `11`.

Esta auditoria no implementa cambios, no modifica tests y no toca el guardrail.

## 1. Inspeccion previa

### Test legacy actual

Archivo: `tests/lib/campobase-social-automation-registry.test.ts`

Import legacy actual:

- `@/lib/campobase/social-automation-registry`

Cobertura actual:

- Verifica que `src/lib/campobase/social-automation-registry.ts` delega al canonico.
- Verifica que mantiene exports legacy publicos.
- Cubre upsert con shape legacy-compatible.
- Cubre actualizacion preservando `createdAt` y cambiando `updatedAt`.
- Cubre get por `tenantId + saasId`.
- Cubre list global.
- Cubre list enabled.
- Cubre enable/disable.
- Cubre `removeCampoBaseSocialAutomationRegistryItem` con comportamiento controlado canonico:
  - falla con `SOCIAL_AUTOMATION_REGISTRY_REMOVE_UNSUPPORTED` si existe;
  - devuelve `false` si no existe.

Clasificacion:

- Es test de adapter legacy con cobertura funcional amplia.
- Mantiene un edge del guardrail porque importa runtime desde `@/lib/campobase/social-automation-registry`.

### Test canonico actual

Archivo: `tests/lib/campamento-base-social-automation-registry.test.ts`

Import canonico:

- `@/lib/campamento-base/social-automation-registry`

Cobertura actual:

- Verifica que el modulo canonico no importa desde `@/lib/campobase`.
- Verifica exports canonicos esperados.
- Cubre upsert via `automation-core`.
- Cubre get.
- Cubre list global.
- Cubre list enabled.
- Cubre enable/disable.
- Cubre remove no soportado si existe y `false` si no existe.
- Verifica que no se crean archivos nuevos con nombre `campobase`.
- Verifica que el test canonico no introduce import legacy.

### Diferencia entre test de adapter y test canonico

El test canonico cubre la logica principal del registry sobre `automation-core`.

El test legacy cubre dos cosas:

- compatibilidad de nombres legacy;
- delegacion del adapter legacy hacia el canonico.

La cobertura funcional amplia esta duplicada entre el test legacy y el test canonico. La unica senal exclusiva del test legacy es que el adapter conserva aliases publicos y no contiene logica D1 legacy.

### Necesidad de test propio del adapter

El adapter legacy sigue necesitando algun test propio mientras exista `src/lib/campobase/social-automation-registry.ts`.

Pero no necesita importar runtime desde `@/lib/campobase/social-automation-registry` para cubrir esa compatibilidad minima. Puede cubrirse con lectura estatica del archivo:

- contiene import canonico `@/lib/campamento-base/social-automation-registry`;
- no contiene `@/lib/db`;
- no contiene tabla `campobase_social_automation_registry`;
- exporta aliases legacy esperados como texto;
- conserva comentario de adapter temporal.

### Readiness

El test puede migrarse ahora si el objetivo es bajar el guardrail, siempre que:

- la cobertura funcional quede en el test canonico;
- el test legacy deje de importar runtime desde `@/lib/campobase/social-automation-registry`;
- se conserve un test estatico minimo de adapter;
- se elimine el edge del allowlist;
- el pin baje de `12` a `11`.

## 2. Contrato canonico vs legacy adapter

### Exports legacy disponibles

Archivo: `src/lib/campobase/social-automation-registry.ts`

Tipos:

- `CampoBaseSocialAutomationRegistryItem`
- `UpsertCampoBaseSocialAutomationRegistryInput`

Funciones:

- `upsertCampoBaseSocialAutomationRegistry`
- `getCampoBaseSocialAutomationRegistryItem`
- `listCampoBaseSocialAutomationRegistryItems`
- `listEnabledCampoBaseSocialAutomationRegistryItems`
- `setCampoBaseSocialAutomationEnabled`
- `removeCampoBaseSocialAutomationRegistryItem`

Todos delegan al modulo canonico.

### Exports canonicos disponibles

Archivo: `src/lib/campamento-base/social-automation-registry.ts`

Tipos:

- `SocialAutomationRegistryItem`
- `UpsertSocialAutomationRegistryInput`

Funciones:

- `upsertSocialAutomationRegistryItem`
- `getSocialAutomationRegistryItem`
- `listSocialAutomationRegistryItems`
- `listEnabledSocialAutomationRegistryItems`
- `setSocialAutomationRegistryEnabled`
- `removeSocialAutomationRegistryItem`

### Mapping legacy -> canonico

| Legacy | Canonico | Paridad |
|---|---|---|
| `CampoBaseSocialAutomationRegistryItem` | `SocialAutomationRegistryItem` | completa por alias |
| `UpsertCampoBaseSocialAutomationRegistryInput` | `UpsertSocialAutomationRegistryInput` | completa por alias |
| `upsertCampoBaseSocialAutomationRegistry` | `upsertSocialAutomationRegistryItem` | completa |
| `getCampoBaseSocialAutomationRegistryItem` | `getSocialAutomationRegistryItem` | completa |
| `listCampoBaseSocialAutomationRegistryItems` | `listSocialAutomationRegistryItems` | completa |
| `listEnabledCampoBaseSocialAutomationRegistryItems` | `listEnabledSocialAutomationRegistryItems` | completa |
| `setCampoBaseSocialAutomationEnabled` | `setSocialAutomationRegistryEnabled` | completa |
| `removeCampoBaseSocialAutomationRegistryItem` | `removeSocialAutomationRegistryItem` | comportamiento controlado, no delete real |

### Remove

`removeSocialAutomationRegistryItem`:

- consulta `automation-core`;
- devuelve `false` si no existe registration;
- lanza `AutomationCoreError("SOCIAL_AUTOMATION_REGISTRY_REMOVE_UNSUPPORTED")` si existe;
- no inventa persistencia ni delete inseguro.

`removeCampoBaseSocialAutomationRegistryItem`:

- delega directamente al canonico;
- por tanto tiene el mismo comportamiento controlado.

Conclusion:

- Hay paridad suficiente para migrar el test funcional al canonico.
- No hay paridad con el viejo delete D1 real, pero ese comportamiento ya fue reemplazado por contrato canonico controlado.
- El test legacy actual ya acepta esa realidad, asi que no bloquea migracion.

## 3. Guardrail

Archivo: `tests/architecture/campobase-namespace-freeze.test.ts`

Size pinned actual:

- `12`

Edge actual relacionado con registry:

- `tests/lib/campobase-social-automation-registry.test.ts::@/lib/campobase/social-automation-registry`

¿Se puede eliminar ahora?

- Si se migra el test legacy para no importar runtime desde `@/lib/campobase/social-automation-registry`, si.
- No debe eliminarse antes de cambiar el import, porque el guardrail detectaria el edge como inesperado.

Size esperado si se elimina:

- `11`

Riesgo:

- Bajo si se conserva test estatico minimo del adapter.
- Medio si se elimina toda cobertura del adapter, porque se perderia la senal de que el archivo legacy sigue delegando al canonico.

## 4. Opciones

### Opcion A: Migrar el test legacy completamente al canonico y bajar guardrail

Riesgo: low/medium.

Impacto:

- `tests/lib/campobase-social-automation-registry.test.ts` dejaria de importar `@/lib/campobase/social-automation-registry`.
- Se bajaria el pin de `12` a `11`.
- La cobertura funcional quedaria alineada con el canonico.

Archivos a tocar:

- `tests/lib/campobase-social-automation-registry.test.ts`
- `tests/architecture/campobase-namespace-freeze.test.ts`

Tests necesarios:

- `pnpm typecheck`
- `npx vitest run tests/lib/campamento-base-social-automation-registry.test.ts`
- `npx vitest run tests/lib/campobase-social-automation-registry.test.ts`
- `npx vitest run tests/architecture/campobase-namespace-freeze.test.ts`

Rollback:

- Restaurar import legacy y edge allowlisted.
- Restaurar pin `12`.

Recomendacion:

- Aceptable, pero menos precisa que Opcion D si elimina toda senal del adapter.

### Opcion B: Mantener test legacy como adapter y no bajar guardrail

Riesgo: low inmediato.

Impacto:

- No reduce deuda.
- Mantiene size pinned `12`.
- Mantiene import runtime legacy en tests.

Archivos a tocar:

- Ninguno.

Tests necesarios:

- Los mismos tests puntuales actuales.

Rollback:

- No aplica.

Recomendacion:

- Seguro, pero no avanza el objetivo de shrink del allowlist.

### Opcion C: Dividir cobertura

Riesgo: low.

Impacto:

- Mantener test minimo de adapter legacy.
- Mover cobertura funcional amplia al canonico.
- Bajar guardrail solo si el test minimo no importa legacy directamente.

Archivos a tocar:

- `tests/lib/campobase-social-automation-registry.test.ts`
- `tests/architecture/campobase-namespace-freeze.test.ts`

Tests necesarios:

- `pnpm typecheck`
- test canonico registry
- test legacy adapter
- guardrail

Rollback:

- Restaurar test legacy runtime y allowlist.

Recomendacion:

- Buena opcion conceptual. En la practica se materializa mejor como Opcion D.

### Opcion D: Test estatico de adapter sin import runtime a `@/lib/campobase`

Riesgo: low.

Impacto:

- `tests/lib/campobase-social-automation-registry.test.ts` se convierte en test estatico del adapter.
- No importa runtime desde `@/lib/campobase/social-automation-registry`.
- Mantiene senal de compat:
  - adapter apunta al canonico;
  - no usa `@/lib/db`;
  - no usa tabla legacy;
  - conserva aliases legacy.
- Permite eliminar edge del guardrail.
- Pin baja de `12` a `11`.

Archivos a tocar:

- `tests/lib/campobase-social-automation-registry.test.ts`
- `tests/architecture/campobase-namespace-freeze.test.ts`

Tests necesarios:

- `pnpm typecheck`
- `npx vitest run tests/lib/campamento-base-social-automation-registry.test.ts`
- `npx vitest run tests/lib/campobase-social-automation-registry.test.ts`
- `npx vitest run tests/architecture/campobase-namespace-freeze.test.ts`

Rollback:

- Restaurar test legacy runtime.
- Restaurar edge allowlisted.
- Restaurar pin `12`.

Recomendacion final:

- Recomendada.
- Es el menor cambio que reduce el guardrail sin perder la senal especifica del adapter.

## 5. Implementacion recomendada posterior

Siguiente bloque tecnico recomendado, sin implementarlo:

`migrate social automation registry adapter test to static canonical dependency check and shrink guardrail to 11`

Alcance sugerido:

- Cambiar `tests/lib/campobase-social-automation-registry.test.ts` para eliminar el import runtime `@/lib/campobase/social-automation-registry`.
- Mantener aserciones estaticas sobre `src/lib/campobase/social-automation-registry.ts`.
- Confirmar que la cobertura funcional sigue en `tests/lib/campamento-base-social-automation-registry.test.ts`.
- Eliminar del allowlist:
  - `tests/lib/campobase-social-automation-registry.test.ts::@/lib/campobase/social-automation-registry`
- Bajar pin de `12` a `11`.

