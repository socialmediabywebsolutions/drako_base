# Meta Ecosystem SaaS Separation and Campamento Base Audit

Fecha: 2026-06-12

Alcance: auditoria read-only del estado real de separacion de SaaS, conexion con Campamento Base, deuda legacy `campobase`, contratos, guardrails y ruta segura siguiente.

Regla aplicada: no se modifico codigo productivo, tests, guardrails, migrations, UI, rutas API ni modulos funcionales. Este documento es el unico archivo creado.

## Resumen ejecutivo

La separacion de SaaS esta bien encaminada, pero no esta cerrada a nivel arquitectura production-ready. El estado actual muestra una transicion madura desde `src/lib/campobase` hacia `src/lib/campamento-base`, contratos internos y namespaces de producto, con guardrail legacy reducido y estable en `4`. SocialFlow esta bastante avanzado como producto independiente, Clinic quedo suficientemente neutralizado para el bloque reciente, y TaskOps es el bloqueo principal actual.

El mayor riesgo arquitectonico es que Campamento Base siga absorbiendo logica operacional de productos mediante imports directos o loaders internos, convirtiendose otra vez en un monolito de control-plane + runtime de SaaS. Hoy ese riesgo esta controlado por guardrails y contratos, pero TaskOps todavia no tiene namespace neutral de runtime en codigo (`src/lib/taskops` no existe), y dos edges runtime siguen vivos dentro de `src/lib/campobase`.

Estado sintetico:

| Area | Estado | Lectura |
| --- | --- | --- |
| Campamento Base | AMARILLO | Control-plane en progreso; aun contiene provisioning, operator, SocialFlow control-plane service y loader neutral parcial. |
| SocialFlow | AMARILLO/VERDE | Producto con namespace propio, rutas propias e internal API; aun existen bridges/adapters y dependencias compartidas. |
| Clinic | VERDE/AMARILLO | Neutralizacion reciente correcta; legacy adapter ya reexporta wrapper neutral. |
| TaskOps | NARANJA | Motor transversal sin namespace neutral; permanece bloqueando el guardrail. |
| Factory/provisioning | AMARILLO/NARANJA | Tiene runtime factory y provisioning real, pero debe evitar crear SaaS acoplados al control-plane. |
| Guardrails/tests | VERDE | Freeze `campobase` pasa y esta pinned en `4`. |
| Contratos/docs | AMARILLO | Hay contratos TaskOps, SocialFlow, Clinic y bootstrap; falta consolidar fuente de verdad y contratos runtime/product-template. |

## Inventario global real

### Productos, SaaS y modulos detectados

- Drako: marca/ecosistema central, reflejado en docs, `src/lib/drako`, rutas `src/app/drakos`, catalogo y governance.
- Campamento Base: control-plane canonico en `src/lib/campamento-base` y rutas `src/app/api/campamento-base`.
- `campobase`: legacy congelado en `src/lib/campobase`, con adapters y edges TaskOps restantes.
- SocialFlow: SaaS social independiente en `src/lib/socialflow`, rutas `src/app/socialflow`, `src/app/api/socialflow`, `src/modules/socialflow-app` y contratos internos.
- Clinic: vertical/SaaS en `src/lib/clinic`, rutas `src/app/clinic`, `src/app/api/clinic`, wrapper/control-plane neutral.
- TaskOps: motor transversal; no existe `src/lib/taskops`; runtime legacy actual en `src/lib/campobase/taskops-platform*.ts`, usando `src/lib/tasks`.
- Factory/provisioning: `src/lib/factory`, `src/lib/saas-factory`, `src/lib/provisioning`, `src/lib/campamento-base/saas-factory-*`, rutas `src/app/api/factory`, `src/app/api/owner/saas-factory`, `src/app/api/campamento-base/saas-factory`.
- Mentoria: vertical historico/producto en `src/lib/mentoria`, `src/app/mentoria`, `src/app/mentorias`, rutas API `mentoria/mentorias`.
- Bases/Drakos/Auths: dominios de plataforma/autenticacion (`src/app/bases`, `src/app/drakos`, `src/lib/auth`, `src/lib/auths`, `src/lib/authz`).
- Operator/Owner: superficies de operacion y holding (`src/lib/operator`, `src/lib/owner`, rutas `src/app/api/operator`, `src/app/api/owner`).
- Runtime compartido: `automation-core`, `integration-core`, `observability-core`, `saas-contract`, `tasks`, `whatsapp`, `billing`, `stripe`, `db`, `tenants`, `domains`.
- Adapters legacy: `src/lib/campobase/*`, `src/lib/social/*` deprecado hacia `src/lib/socialflow/*`, operator bridges hacia Campamento Base.
- Demo/mock/fallback: `.demo`, `.tmp-preflight`, `_temp`, `src/app/_saas_broken`, varios scripts/reportes y fallbacks de observabilidad/production-readiness.

### Namespaces principales

- Canonicos/control-plane: `src/lib/campamento-base`, `src/app/api/campamento-base`.
- Legacy: `src/lib/campobase`, `src/app/api/campobase`.
- Productos: `src/lib/socialflow`, `src/lib/clinic`, `src/lib/mentoria`.
- Runtime compartido: `src/lib/automation-core`, `src/lib/integration-core`, `src/lib/observability-core`, `src/lib/saas-contract`, `src/lib/tasks`, `src/lib/whatsapp`.
- Infra/provisioning: `src/lib/factory`, `src/lib/provisioning`, `src/lib/cloudflare`, `src/lib/domains`, `src/lib/billing`, `src/lib/stripe`.
- Apps/rutas: `src/app/api/socialflow`, `src/app/api/internal/socialflow`, `src/app/api/clinic`, `src/app/api/factory`, `src/app/api/operator`, `src/app/api/owner`, `src/app/api/campamento-base`, `src/app/api/campobase`.

### Auditorias recientes y fuente documental

Auditorias relevantes en `docs/audits`:

- `REMAINING_TASKOPS_CAMPOBASE_FREEZE_EDGES_AFTER_CLINIC_SHRINK_TO_4.md`
- `CLINIC_PLATFORM_WRAPPER_SERVICE_IMPLEMENTATION_READINESS_BEFORE_SHRINK_6_TO_4.md`
- `CLINIC_LEGACY_STATIC_CONVERSION_FINAL_READINESS_AFTER_CONTEXT_RESOLUTION.md`
- `FACTORY_ORCHESTRATOR_LEGACY_EDGE_READINESS_AFTER_RUNTIME_EQUIVALENT_COVERAGE.md`
- `FACTORY_ORCHESTRATOR_PLATFORM_BOOTSTRAP_MIGRATION_READINESS_AFTER_NEUTRAL_LOADER.md`
- `PLATFORM_BOOTSTRAP_BLOCKERS_CHECKPOINT.md`
- `CAMPOBASE_LEGACY_REDUCTION_CHECKPOINT.md`
- `CAMPAMENTO_BASE_VS_CAMPOBASE_NAMESPACE_AUDIT.md`
- `SAAS_SEPARATION_AUDIT_2026-05-22.md`
- `SAAS_INDEPENDENCE_AUDIT_2026.md`
- `P2-34B-FULL-SOCIALFLOW-INDEPENDENCE-AND-CAPABILITY-AUDIT.md`
- `p10-29-socialflow-production-saas-readiness-audit.md`

La fuente de verdad mas reciente para el guardrail actual es el propio test `tests/architecture/campobase-namespace-freeze.test.ts` y la auditoria TaskOps post-shrink a `4`.

### Tests de arquitectura

Existen:

- `tests/architecture/campobase-namespace-freeze.test.ts`
- `tests/architecture/saas-boundary-import-guards.test.ts`
- `tests/architecture/control-plane-separation-audit.test.ts`
- `tests/architecture/socialflow-vertical-boundaries.test.ts`
- `tests/architecture/socialflow-runtime-boundary.test.ts`
- `tests/architecture/socialflow-runtime-split-scaffold.test.ts`
- `tests/architecture/mentoria-vertical-boundaries.test.ts`
- `tests/architecture/legacy-alias-boundaries.test.ts`
- `tests/architecture/legacy-compat-sunset.test.ts`
- `tests/architecture/canonical-product-map.test.ts`
- `tests/architecture/socialflow-draco-dependency-radar.test.ts`

### Workflows/CI relevantes

En `.github/workflows`:

- `drako-factory-deploy.yml`
- `deploy-multi-saas-workers.yml`
- `build-worker.yml`
- `dks-cron-runbook.yaml`

Scripts relevantes en `package.json`:

- `typecheck`: `tsc --noEmit`
- `test`: `vitest run`
- `audit:control-plane-separation`
- `build:factory`
- `check:production`
- `predeploy:holding`
- `check:workers`, `check:hostnames`
- deploys legacy root bloqueados por scripts `archived:*`.

## Estado por producto/modulo

### 1. Campamento Base

Responsabilidad actual: control-plane/holding operativo, catalogos core, operator notifications, provisioning SaaS, factory orchestration, social automation control-plane service, platform bootstrap loader, analytics/BI y contracts service.

Estado real:

- Canonico en `src/lib/campamento-base`.
- Rutas canonicas en `src/app/api/campamento-base`.
- Operator/socialflow routes ya importan servicios canonicos (`platform-operator-service`, `socialflow-control-plane-service`) en lugar de legacy `campobase`.
- `platform-bootstrap-loader.ts` es neutral pero parcial: SocialFlow `READY`, Clinic y TaskOps `SKIPPED`.
- Sigue teniendo un servicio SocialFlow control-plane que registra automations y llama internal APIs; es aceptable si se considera facade/control-plane, no runtime interno del producto.

Imports directos hacia SaaS:

- `src/lib/campamento-base/socialflow-platform.ts` carga `socialflow-control-plane-service`.
- `src/lib/campamento-base/orchestrator/snapshot-db.ts` usa `socialflow-control-plane-service`.
- `src/lib/campamento-base/platform-bootstrap-loader.ts` usa definicion de SocialFlow.
- No se detecta import productivo vivo desde Campamento Base hacia `@/lib/campobase` salvo comentario.

Riesgos:

- Campamento Base aun concentra provisioning, templates, stripe wizard, operator y servicios de producto.
- Si nuevas verticales siguen el patron de importar runtime interno, el control-plane se convierte en monolito.
- El loader neutral no ejecuta Clinic/TaskOps, por lo que la paridad runtime no esta completa.

### 2. SocialFlow

Estado real:

- Namespace propio en `src/lib/socialflow`.
- Rutas propias en `src/app/socialflow`, `src/app/api/socialflow`.
- Internal API en `src/app/api/internal/socialflow`.
- Contratos en `src/lib/socialflow/contracts`.
- Control-plane Campamento Base usa clientes internos `src/lib/capabilities/internal-api-clients/socialflow-control-plane.ts`.
- Social legacy en `src/lib/social/*` reexporta/depreca hacia `src/lib/socialflow/*`.
- `src/lib/campobase/socialflow-service.ts` es adapter hacia `@/lib/campamento-base/socialflow-control-plane-service`.
- `src/lib/campobase/socialflow-platform.ts` reexporta `@/lib/campamento-base/socialflow-platform`.

Dependencias hacia Campamento Base:

- SocialFlow product code no deberia importar `@/lib/campamento-base`; los guards lo vigilan.
- Tests verifican que internal API no use contratos Campobase/owner-dashboard indebidos.

Dependencias desde Campamento Base:

- `socialflow-control-plane-service` registra automations y llama a internal API clients.
- `socialflow-platform` define bootstrap canonical.
- `operator/socialflow` route usa control-plane service.

Automatizacion social:

- Hay keys `socialflow.content_generation` y `socialflow.health_check`.
- Live publishing, scheduler, LinkedIn OAuth, token encryption, private pilot y observability tienen modulos propios.
- Riesgo residual: aun existen fallbacks/bridges, y hay muchos tests de readiness/production-readiness que deben seguir alineados.

Independencia real:

- Alta para runtime producto.
- Media para control-plane: sigue gobernada desde Campamento Base por servicios canonicos, lo cual es deseado si la interaccion es por API/contract; no deseado si vuelve a leer repositorios internos directamente.

### 3. Clinic

Estado tras neutralizacion:

- `src/lib/clinic/service.ts` implementa registro neutral via internal API client/capabilities y planes de orchestration/context/handler.
- `src/lib/clinic/platform-wrapper.ts` define `clinicPlatformDefinition` y `clinicPlatformBootstrap`.
- `src/lib/campobase/clinic-platform.ts` reexporta desde `@/lib/clinic/platform-wrapper`.
- `src/lib/campobase/platform-bootstrap.ts` importa Clinic desde `@/lib/clinic/platform-wrapper`, no desde `@/lib/campobase/clinic-platform`.
- No queda edge guardrail Clinic.

Cobertura:

- `tests/lib/clinic-service.test.ts`
- `tests/lib/clinic-platform-wrapper.test.ts`
- `tests/lib/clinic-control-plane-orchestration.test.ts`
- `tests/lib/clinic-control-plane-handler-registration.test.ts`
- `tests/lib/clinic-control-plane-context-resolution.test.ts`
- `tests/lib/clinic-control-plane-internal-client.test.ts`

Riesgo:

- `src/lib/campobase/clinic-platform-service.ts` aun existe como legacy, pero no aparece en el guardrail actual como import vivo.
- `platform-bootstrap-loader.ts` aun marca Clinic `SKIPPED`, asi que falta cerrar paridad de loader neutral si se quiere eliminar el loader legacy completo.

Lectura: Clinic puede considerarse suficientemente neutralizada para esta fase, con deuda legacy congelada/no conectada al guardrail actual.

### 4. TaskOps

Estado real:

- No existe `src/lib/taskops`.
- Runtime actual esta en:
  - `src/lib/campobase/taskops-platform.ts`
  - `src/lib/campobase/taskops-platform-service.ts`
- Usa runtime compartido:
  - `@/lib/automation-core`
  - `@/lib/integration-core`
  - `@/lib/tasks/repository`
  - `@/lib/whatsapp/repository`
- `taskops-platform.ts` define plataforma SaaS-contract, signal handler `task.overdue` y llama servicio legacy.
- `taskops-platform-service.ts` registra automation `taskops.pending_task_audit` e integracion WhatsApp.

Edges guardrail:

- `src/lib/campobase/platform-bootstrap.ts::@/lib/campobase/taskops-platform`
- `src/lib/campobase/taskops-platform.ts::@/lib/campobase/taskops-platform-service`
- `tests/lib/campobase-taskops-platform-service.test.ts::@/lib/campobase/taskops-platform-service`
- `tests/lib/cross-saas-taskops-flow.test.ts::@/lib/campobase/taskops-platform`

Contratos existentes:

- `docs/contracts/campamento-base-taskops-orchestration-contract-v1.md`
- `docs/contracts/taskops-neutral-runtime-parity-contract-v1.md`

Falta:

- Namespace neutral de runtime, probablemente `src/lib/taskops`.
- Service/wrapper neutral equivalente.
- Runtime parity ejecutable fuera de `campobase`.
- Bridge cross-saas para signal `task.overdue`.
- Tests neutrales antes de tocar legacy wiring.

Lectura: TaskOps no es SaaS vertical normal; es motor transversal. Es el bloqueo principal actual.

### 5. Factory / provisioning / SaaS creation

Estado real:

- `src/lib/factory/orchestrator.ts` crea runtime definitions dinamicas y registra automations/integrations en `saas-contract`.
- `src/lib/campamento-base/saas-factory-orchestrator.ts` implementa provisioning real con DB, Stripe, Cloudflare/domain provider, job runner, runtime contract, bootstrap, rollback y eventos.
- `src/lib/campamento-base/platform-bootstrap-loader.ts` ofrece neutral parity parcial para SocialFlow y skips Clinic/TaskOps.
- Tests de paridad existen:
  - `tests/lib/factory-orchestrator-runtime-parity.test.ts`
  - `tests/lib/factory-orchestrator-runtime-equivalent.test.ts`
  - `tests/lib/saas-factory-orchestrator-flow.test.ts`
  - `tests/lib/provisioning-domain-flow.test.ts`

Riesgos:

- `src/app/_saas_broken/create` aun referencia tipos/helpers de Campamento Base y parece demo/broken.
- Factory puede crear "basic-operational-saas" funcional, pero la independencia real depende de que los productos nuevos nazcan con contrato estandar y no con imports al control-plane.
- Hay dos planos: runtime factory generico y provisioning Campamento Base; deben quedar claramente separados.

### 6. Otros modulos detectados

| Modulo | Clasificacion | Observacion |
| --- | --- | --- |
| Mentoria | SaaS/vertical historico | Rutas y docs abundantes; tiene guardrails propios, no fue foco de este bloque. |
| Bases | runtime/plataforma | Auths/telemetries; parece base compartida, no SaaS vertical puro. |
| Drakos | marca/auth/product shell | Rutas auths y catalogo; requiere clasificacion formal futura. |
| Operador/Owner | control surfaces | Superficies de operacion; aceptables si llaman contracts/control-plane. |
| Observability | runtime compartido | `observability-core` + reports/checks; maduro pero con fallbacks. |
| Billing/Stripe | runtime compartido/infra | Modulos extensos, tests, provisioning; riesgo medio por acoplamiento a factory. |
| Auth/Authz | runtime compartido | NextAuth/session/campamento-core; debe vigilarse en readiness socialflow. |
| Tasks | modulo transversal | Base funcional de TaskOps; no equivale a TaskOps neutral completo. |
| Social legacy | adapter legacy | `src/lib/social/*` deprecado hacia `socialflow`; mantener congelado/migrar por fases. |

## Mapa de conexiones con Campamento Base

| Producto/modulo | Tipo | Forma de conexion | Estado | Riesgo | Accion recomendada |
| --- | --- | --- | --- | --- | --- |
| Campamento Base | control-plane | self/imports internos/API interna | aceptable temporal | medio | Mantener como holding, reducir logica runtime de producto. |
| `campobase` | adapter legacy | imports directos legacy congelados | legacy controlado | alto | No crear imports nuevos; reducir `4 -> 0` solo por bloques con contrato. |
| SocialFlow | SaaS vertical | internal API, contratos, control-plane service, adapter legacy residual | aceptable temporal | medio | Mantener conexiones por internal API; evitar imports a repositorios internos desde control-plane. |
| Clinic | SaaS vertical | wrapper/service neutral, legacy reexport | limpio/aceptable temporal | bajo | Cerrar loader neutral cuando convenga; no tocar legacy service si no bloquea. |
| TaskOps | modulo transversal | import directo legacy, automation-core, tasks repo, signal handler | acoplamiento peligroso | alto | Crear runtime neutral TaskOps antes de reducir guardrail. |
| Factory | modulo transversal/provisioning | imports a Campamento Base, DB, Stripe, domains, saas-contract | aceptable temporal | medio-alto | Definir contrato factory/provisioning y plantilla SaaS estandar. |
| Operator/Owner | control surfaces | API/control-plane services/adapters | aceptable temporal | medio | Mantener como cliente de control-plane, no runtime de SaaS. |
| Automation-core | runtime compartido | libreria compartida | limpio | bajo | Mantener estable; usar como base TaskOps neutral. |
| Integration-core | runtime compartido | libreria compartida/providers | limpio | bajo | Mantener; vigilar providers que importan SocialFlow internals. |
| Observability-core | runtime compartido | health/incidents/activities | limpio | bajo | Reforzar smoke/runtime checks. |
| Billing/Stripe | runtime compartido/infra | DB/Stripe/provisioning | aceptable temporal | medio | Aislar contratos por producto y factory. |
| Auth/Authz | runtime compartido | session/access checks | aceptable temporal | medio | Verificar aislamiento por SaaS y tenants. |
| Mentoria | SaaS vertical | rutas/modulos propios | desconocido/amarillo | medio | Auditar separacion en bloque propio, no mezclar con TaskOps. |

## Auditoria de imports y acoplamientos

### Imports vivos a `@/lib/campobase`

En codigo productivo versionado (`src`), los imports vivos relevantes son:

- `src/lib/campobase/platform-bootstrap.ts:18` -> dynamic import `@/lib/campobase/taskops-platform`.
- `src/lib/campobase/taskops-platform.ts:5` -> import `@/lib/campobase/taskops-platform-service`.

En tests:

- `tests/lib/campobase-taskops-platform-service.test.ts` -> import dinamico de `@/lib/campobase/taskops-platform-service`.
- `tests/lib/cross-saas-taskops-flow.test.ts` -> import dinamico de `@/lib/campobase/taskops-platform`.

Otros usos son asserts negativos, comentarios, scripts de auditoria o docs. No deben contarse como acoplamiento runtime.

### Imports vivos a `@/lib/campamento-base`

Se usan en:

- Rutas API Campamento Base/core/operator/templates/stripe wizard.
- Componentes de control-plane/onboarding/marketplace.
- `src/lib/campobase/*` como adapters legacy hacia canonico.
- Tests de contratos/paridad.
- Scripts `stripe-idempotence.ts` y `verify-provisioning-states.ts`.

Estado: aceptable para control-plane; peligroso si aparece dentro de runtime de producto vertical, salvo contratos permitidos.

### Campamento Base <-> SocialFlow

- Control-plane usa `socialflow-control-plane-service`.
- Servicio llama internal API clients en `src/lib/capabilities/internal-api-clients/socialflow-control-plane.ts`.
- SocialFlow product usa `src/lib/socialflow/*` y contracts.
- Tests vigilan que internal routes no importen `@/lib/campobase/socialflow-service`.

Estado: aceptable temporal. Mantener por contratos/API interna.

### Campamento Base <-> Clinic

- Legacy bootstrap importa `@/lib/clinic/platform-wrapper`.
- Clinic service usa capabilities/internal API client y planes neutrales.
- No hay edge Clinic en guardrail actual.

Estado: suficientemente neutral para esta fase.

### Campamento Base <-> TaskOps

- Legacy bootstrap importa `@/lib/campobase/taskops-platform`.
- TaskOps platform importa service legacy.
- Cross-saas test ejecuta plataforma legacy.

Estado: acoplamiento peligroso controlado por guardrail.

### Factory <-> SaaS

- Factory runtime registra plataformas dinamicas via `saas-contract`.
- Campamento Base provisioning calcula domains, Stripe, bootstrap y DB.
- Tests de factory verifican loader neutral/parity.

Estado: aceptable temporal; falta contrato formal de factory/provisioning que prohiba nuevos SaaS acoplados.

### SaaS <-> SaaS

- SocialFlow tiene guards de boundary.
- TaskOps cross-saas flow indica necesidad de bridge transversal.
- No se detecto nuevo import productivo SocialFlow -> Clinic o Clinic -> SocialFlow en la muestra inspeccionada.

## Guardrail actual

Archivo: `tests/architecture/campobase-namespace-freeze.test.ts`.

Pinned size actual: `4`.

Allowlist actual:

| Edge | Tipo | Dominio | Riesgo | Lectura |
| --- | --- | --- | --- | --- |
| `src/lib/campobase/platform-bootstrap.ts::@/lib/campobase/taskops-platform` | runtime src | TaskOps/bootstrap | alto | Mantiene TaskOps en loader legacy. |
| `src/lib/campobase/taskops-platform.ts::@/lib/campobase/taskops-platform-service` | runtime src | TaskOps service | alto | Runtime TaskOps no neutral. |
| `tests/lib/campobase-taskops-platform-service.test.ts::@/lib/campobase/taskops-platform-service` | test-only | TaskOps legacy service | medio | Cobertura funcional de servicio legacy. |
| `tests/lib/cross-saas-taskops-flow.test.ts::@/lib/campobase/taskops-platform` | test-only/cross-saas | TaskOps signal bridge | alto | Cobertura de `task.overdue` usando plataforma legacy. |

Coincidencia con estado esperado: si. Los 4 edges coinciden con la lista esperada del contexto.

Edge que podria bajar primero:

- El test `tests/lib/campobase-taskops-platform-service.test.ts` solo despues de crear `tests/lib/taskops-service.test.ts` neutral con paridad funcional.

Edges que NO deben tocarse todavia:

- `src/lib/campobase/platform-bootstrap.ts::@/lib/campobase/taskops-platform`
- `tests/lib/cross-saas-taskops-flow.test.ts::@/lib/campobase/taskops-platform`

Motivo: aun no existe runtime neutral TaskOps ni bridge neutral para `task.overdue`.

Camino seguro `4 -> 3 -> 2 -> 0`:

1. Crear contrato/implementacion neutral TaskOps y test de service parity.
2. Migrar `tests/lib/campobase-taskops-platform-service.test.ts` a neutral o convertirlo a static adapter check: `4 -> 3`.
3. Crear `src/lib/taskops/platform.ts`/wrapper neutral y migrar test cross-saas a ese bridge: `3 -> 2`.
4. Cambiar `src/lib/campobase/taskops-platform.ts` a adapter/reexport neutral o eliminar import interno al service legacy: `2 -> 1`.
5. Cambiar `src/lib/campobase/platform-bootstrap.ts` para cargar TaskOps neutral, o retirar loader legacy si ya existe loader canonico completo: `1 -> 0`.

## Contratos y documentos

Contratos existentes en `docs/contracts`:

- `campobase-socialflow-internal-api-v1.md`
- `campamento-base-api-v1.0.md`
- `campamento-base-social-automation-registry-contract-v1.md`
- `campamento-base-social-automation-history-contract-v1.md`
- `campamento-base-clinic-orchestration-contract-v1.md`
- `clinic-control-plane-internal-client-contract-v1.md`
- `campamento-base-platform-bootstrap-loader-contract-v1.md`
- `campamento-base-taskops-orchestration-contract-v1.md`
- `taskops-neutral-runtime-parity-contract-v1.md`

Existe contrato TaskOps: si, documental.

Existe contrato SocialFlow control-plane: si, aunque el nombre `campobase-socialflow-internal-api-v1.md` conserva legacy naming.

Existe contrato Clinic wrapper/service: si, por `campamento-base-clinic-orchestration-contract-v1.md` y `clinic-control-plane-internal-client-contract-v1.md`.

Existe contrato Factory/provisioning: parcial. Hay docs/audits y codigo, pero falta contrato formal unico de factory/provisioning que defina separacion SaaS/control-plane y plantilla estandar.

Contratos faltantes recomendados:

- `docs/contracts/taskops-control-plane-internal-client-contract-v1.md` o equivalente, si TaskOps expone internal API.
- `docs/contracts/factory-provisioning-product-boundary-contract-v1.md`.
- `docs/contracts/saas-product-template-boundary-contract-v1.md`.
- `docs/contracts/campamento-base-control-plane-to-saas-contract-v1.md` consolidado, para evitar contratos dispersos por producto.

Auditorias obsoletas/parcialmente historicas:

- Auditorias con allowlist de 10, 11, 14 o imports antiguos de SocialFlow/Clinic ya no reflejan el guardrail actual.
- `CAMPAMENTO_BASE_VS_CAMPOBASE_NAMESPACE_AUDIT.md` contiene hallazgos antiguos utiles como contexto, pero no es fuente actual de edges.

Auditorias todavia utiles:

- Las posteriores a shrink a `4`.
- Readiness de Clinic wrapper/service.
- Readiness de factory neutral loader/parity.
- SocialFlow production/readiness recientes para independencia de producto.

## Madurez por area

| Area | Madurez | Motivo |
| --- | --- | --- |
| Campamento Base | AMARILLO | Control-plane fuerte, pero aun mezcla provisioning, operator y servicios de producto. |
| SocialFlow | AMARILLO/VERDE | Buen namespace, rutas, internal API y contratos; quedan adapters/fallbacks. |
| Clinic | VERDE/AMARILLO | Neutralizado; falta cerrar loader neutral completo. |
| TaskOps | NARANJA | Sin namespace neutral; bloquea guardrail. |
| Factory/provisioning | AMARILLO/NARANJA | Real y testeado, pero contrato de producto nuevo incompleto. |
| Observabilidad | AMARILLO/VERDE | Core y checks existen; production readiness aun depende de fallbacks/smokes. |
| Billing/Stripe | AMARILLO | Completo y testeado, pero acoplado a factory/provisioning. |
| Auth | AMARILLO | Existe auth/authz; requiere vigilancia de tenant/SaaS isolation. |
| CI/CD | AMARILLO | Workflows canonicos y deploys legacy bloqueados; confirmar cobertura en PR. |
| Tests/guardrails | VERDE | Freeze y guards pasan; coverage estatica fuerte. |
| Documentacion/contratos | AMARILLO | Mucho material; falta consolidacion y marcar obsoleto. |
| Separacion real SaaS | AMARILLO | SocialFlow/Clinic avanzados; TaskOps/factory pendientes. |
| Conexion SaaS -> Campamento Base | AMARILLO | Contratos/API internas en progreso; evitar imports directos nuevos. |

## Riesgos principales

| Severidad | Riesgo | Impacto | Probabilidad | Area/archivo | Mitigacion |
| --- | --- | --- | --- | --- | --- |
| Alta | TaskOps sin runtime neutral | Bloquea `campobase` freeze a cero y mantiene loader legacy | Alta | `src/lib/campobase/taskops-platform*.ts` | Crear `src/lib/taskops` con service/platform parity antes de tocar edges. |
| Alta | Campamento Base como monolito | Nuevos SaaS nacen acoplados al control-plane | Media | `src/lib/campamento-base/*`, factory/provisioning | Contrato estandar SaaS-control-plane + guardrail no direct SaaS runtime imports. |
| Alta | Factory crea productos mal acoplados | Deuda se multiplica por cada SaaS nuevo | Media | `src/lib/factory/orchestrator.ts`, `src/lib/campamento-base/saas-factory-orchestrator.ts` | Factory/provisioning boundary contract y templates neutros. |
| Media-alta | Guardrails estaticos sin suficiente runtime parity | Tests pasan aunque runtime real no exista en neutral | Media | architecture tests, loader neutral | Tests runtime neutros por producto antes de reducir guardrail. |
| Media | SocialFlow aun ligado a bridges | Producto parece independiente pero control-plane podria leer detalles internos | Media | `socialflow-control-plane-service`, `src/lib/social/*` | Mantener internal API clients y prohibir imports a repositorios internos desde control-plane. |
| Media | Docs/audits con estados antiguos | Codex/humanos podrian seguir mapas obsoletos | Alta | `docs/audits` | Crear indice de auditorias vigentes/obsoletas. |
| Media | Fallbacks/demo confunden produccion | Rutas o flujos `_saas_broken`/fallback pueden parecer canonicos | Media | `src/app/_saas_broken`, reports/fallback scripts | Etiquetar/aislar demo, production readiness guard. |
| Media | Billing/Stripe acoplado a provisioning | Fallos de pago/provisioning afectan factory y SaaS | Media | `billing`, `stripe`, `saas-factory-orchestrator` | Contrato de provisioning idempotente y smoke por estado. |
| Media | Auth/tenant isolation incompleto en futuros SaaS | Riesgo produccion multi-tenant | Media | `auth`, `authz`, product routes | Template de authz obligatorio por SaaS. |

## Respuestas a preguntas criticas

1. La separacion de SaaS esta bien encaminada: si, especialmente SocialFlow y Clinic, pero no esta terminada.
2. Campamento Base actua como control-plane: mayoritariamente si, aunque todavia retiene servicios de producto/provisioning que deben limitarse por contratos.
3. SocialFlow esta realmente separado: bastante, con namespace/rutas/internal API propios; aun no es aislamiento perfecto por bridges y control-plane service.
4. Clinic quedo suficientemente neutralizado: si para esta fase; falta cerrar loader neutral completo si se quiere retirar legacy bootstrap.
5. TaskOps es el bloqueo principal actual: si.
6. Antes de crear mas SaaS hay que cerrar contrato de plantilla SaaS/control-plane, factory/provisioning boundary y TaskOps neutral.
7. No se debe tocar todavia el wiring runtime legacy TaskOps ni bajar guardrail sin paridad neutral.
8. El siguiente bloque tecnico mas seguro es TaskOps neutral contract/runtime parity implementation, no otro shrink manual.
9. El mayor riesgo arquitectonico actual es que Campamento Base vuelva a ser monolito operativo por imports directos.
10. Falta para production-ready arquitectura: guardrail `campobase` a cero, contratos consolidados, runtime smoke por SaaS, auth/billing/observability por producto, CI que bloquee imports nuevos y docs vigentes.

## Plan de accion por fases

### FASE 1 - Consolidar estado actual

- Mantener guardrail `campobase` en size `4`.
- Documentar este mapa de conexiones como snapshot vigente.
- Bloquear imports nuevos a `@/lib/campobase`.
- Confirmar CI con `typecheck` y architecture tests.
- Marcar auditorias antiguas como historicas o no vigentes.

### FASE 2 - TaskOps neutral

- Crear contrato operativo neutral definitivo si el existente no cubre runtime completo.
- Crear namespace neutral `src/lib/taskops`.
- Crear service/wrapper neutral con paridad funcional de `taskops-platform-service`.
- Crear plataforma neutral con signal handler `task.overdue`.
- Crear tests neutrales.
- Reducir guardrail `4 -> 3 -> 2 -> 0` solo despues de paridad validada.

### FASE 3 - Campamento Base como control-plane puro

- Eliminar imports directos hacia runtime interno de SaaS cuando exista API/contract/event.
- Mantener control-plane services como facades, no como repositorios de producto.
- Revisar operator/factory/provisioning para que llamen contratos estandar.

### FASE 4 - Separacion real de SaaS

- SocialFlow como producto independiente con internal API estable.
- Clinic como vertical independiente con wrapper/control-plane neutral.
- Futuros SaaS nacen con template estandar y sin `campobase`.
- Campamento Base gobierna por contratos, events, queues o APIs internas.

### FASE 5 - Produccion

- Health endpoints por producto.
- Smoke tests por producto/control-plane.
- Observabilidad y incident rollups.
- Billing/auth/tenant checks.
- Documentacion production-ready y checklist por SaaS.

## Siguiente bloque recomendado para Codex

Nombre del bloque: `TASKOPS_NEUTRAL_RUNTIME_PARITY_AND_GUARDRAIL_PREP`.

Objetivo: crear la frontera neutral TaskOps y cobertura de paridad sin reducir todavia el guardrail hasta demostrar equivalencia.

Tipo de trabajo: contrato + codigo neutral + tests puntuales. No debe ser auditoria solamente.

Archivos a crear:

- `src/lib/taskops/service.ts`
- `src/lib/taskops/platform.ts`
- `tests/lib/taskops-service.test.ts`
- `tests/lib/taskops-platform.test.ts`
- Opcional: `docs/contracts/taskops-control-plane-internal-client-contract-v1.md` si se decide exponer internal API.

Archivos a modificar:

- En la primera iteracion, solo tests neutrales nuevos y docs/contratos si faltan.
- En una segunda iteracion, potencialmente `src/lib/campobase/taskops-platform.ts` para convertirlo en adapter hacia neutral.
- En una tercera iteracion, `src/lib/campobase/platform-bootstrap.ts` para cargar TaskOps neutral.
- `tests/architecture/campobase-namespace-freeze.test.ts` solo cuando el edge correspondiente ya no exista realmente.

Archivos que NO debe tocar al inicio:

- `src/lib/campobase/platform-bootstrap.ts`
- `tests/lib/cross-saas-taskops-flow.test.ts`
- `tests/architecture/campobase-namespace-freeze.test.ts`
- SocialFlow, Clinic, Factory no relacionados.
- Migrations/UI/rutas API.

Validaciones minimas:

- `pnpm typecheck`
- `npx vitest run tests/architecture/campobase-namespace-freeze.test.ts`
- `npx vitest run tests/lib/taskops-service.test.ts tests/lib/taskops-platform.test.ts`
- Luego, solo si se toca wiring legacy: `tests/lib/campobase-taskops-platform-service.test.ts` y `tests/lib/cross-saas-taskops-flow.test.ts`.

Puede reducir guardrail: no en el primer bloque de creacion neutral. Si los tests neutrales demuestran paridad y el import legacy se retira realmente, entonces si, en bloque separado de shrink.

## Validaciones ejecutadas

Primer intento desde cwd UNC fallo por entorno Windows/cmd (`package.json` no encontrado en `C:\Windows` y `vitest` no resuelto). No cuenta como fallo del proyecto.

Validaciones correctas ejecutadas desde WSL en `/home/drako/workspace/drako_base`:

- `pnpm typecheck`: PASS.
- `npx vitest run tests/architecture/campobase-namespace-freeze.test.ts`: PASS, 1 file, 2 tests.
- `npx vitest run tests/lib/campobase-taskops-platform-service.test.ts tests/lib/cross-saas-taskops-flow.test.ts tests/lib/clinic-service.test.ts tests/lib/clinic-platform-wrapper.test.ts tests/lib/factory-orchestrator-runtime-parity.test.ts tests/lib/factory-orchestrator-runtime-equivalent.test.ts`: PASS, 6 files, 35 tests.

## Resultado final de auditoria

- Archivo creado: `docs/audits/META_ECOSYSTEM_SAAS_SEPARATION_CAMPAMENTO_BASE_AUDIT.md`.
- Codigo productivo tocado: no.
- Tests modificados: no.
- Guardrail modificado: no.
- Estado actual de separacion SaaS: bien encaminado, no production-ready.
- Estado conexion Campamento Base: control-plane parcial/aceptable, con riesgo de monolito si no se refuerzan contratos.
- Size actual guardrail: `4`.
- Edges legacy restantes:
  - `src/lib/campobase/platform-bootstrap.ts::@/lib/campobase/taskops-platform`
  - `src/lib/campobase/taskops-platform.ts::@/lib/campobase/taskops-platform-service`
  - `tests/lib/campobase-taskops-platform-service.test.ts::@/lib/campobase/taskops-platform-service`
  - `tests/lib/cross-saas-taskops-flow.test.ts::@/lib/campobase/taskops-platform`
- Bloque tecnico recomendado: TaskOps neutral runtime parity.
- Siguiente paso debe ser TaskOps neutral, no separacion de otro SaaS.
