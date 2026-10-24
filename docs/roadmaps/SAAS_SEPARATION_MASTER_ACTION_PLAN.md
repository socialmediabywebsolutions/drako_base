# SaaS Separation Master Action Plan

Fecha: 2026-06-12

Estado: plan operativo vivo para separar SaaS/productos del ecosistema Drako y conectarlos correctamente con Campamento Base sin romper produccion ni multiplicar deuda.

Fuentes base:

- `docs/audits/META_ECOSYSTEM_SAAS_SEPARATION_CAMPAMENTO_BASE_AUDIT.md`
- `docs/audits/MEGA_ECOSYSTEM_FULL_SAAS_PRODUCT_FACTORY_AUDIT.md`
- `docs/audits/REMAINING_TASKOPS_CAMPOBASE_FREEZE_EDGES_AFTER_CLINIC_SHRINK_TO_4.md`
- `tests/architecture/campobase-namespace-freeze.test.ts`

Regla de este documento: es un plan. No implementa codigo, no modifica tests, no modifica guardrails y no habilita creacion de SaaS nuevos.

## Vision operativa

### Que significa separar un SaaS

Separar un SaaS en este repo significa que el producto tiene frontera propia y operable:

- namespace propio de producto, por ejemplo `src/lib/socialflow` o `src/lib/mentoria`;
- rutas publicas y privadas claramente asociadas al producto;
- APIs propias o internal APIs propias;
- auth/contexto de sesion propio o aislamiento explicito dentro del sistema `auths`;
- tenant isolation verificable en DB, queries, routes y tests;
- migrations/tablas identificables por producto o por contrato compartido;
- billing/pricing propio o declaracion explicita de que no monetiza todavia;
- observabilidad, health, smoke tests y production-readiness propios;
- contratos para integrarse con Campamento Base;
- cero dependencia nueva a `@/lib/campobase`;
- cero import directo peligroso desde producto hacia runtime interno de otro SaaS.

Separar no significa copiar todo a otro repo. Significa que dentro del monorepo cada producto puede evolucionar, desplegarse, probarse, observarse y monetizarse sin que Campamento Base ejecute su logica interna por accidente.

### Que significa conectar con Campamento Base

Conectar con Campamento Base significa que el control-plane puede gobernar, observar y operar el SaaS mediante fronteras estables:

- contrato de control-plane;
- internal API;
- event/queue/signal;
- adapter temporal controlado;
- registry/capability contract;
- snapshots/health/observability;
- billing/provisioning contract.

La conexion correcta permite que Campamento Base vea estado, active flujos permitidos, reciba eventos, observe salud y coordine provisioning sin importar repositorios internos ni ejecutar runtime privado del SaaS.

### Que NO debe hacer Campamento Base

Campamento Base no debe:

- convertirse en monolito de todos los SaaS;
- contener business logic interna de SocialFlow, Mentoria, Clinic o futuros SaaS;
- importar directamente runtime interno de productos si existe API/contract/event;
- crear nuevos imports a `@/lib/campobase`;
- usar Factory para crear productos antes de que exista plantilla estandar;
- mezclar billing/auth/DB de productos sin contrato;
- resolver casos de producto con hacks en owner/operator;
- declarar production-ready si los guards o smoke tests fallan.

### Requisitos para independencia de SaaS

Un SaaS independiente debe tener:

- namespace propio;
- ownership claro;
- rutas y APIs propias;
- auth/contexto propio;
- tenant isolation;
- DB/migrations trazables;
- contrato Campamento Base;
- control-plane integration por API/event/contract;
- tests unitarios, arquitectura y smoke;
- health endpoint;
- observabilidad;
- docs operativas;
- billing o declaracion de no monetizacion;
- rollback o recovery plan.

### Requisitos para production-ready

Un SaaS production-ready debe tener:

- `pnpm typecheck` verde;
- architecture tests relevantes verdes;
- smoke tests verdes;
- auth matrix por ruta;
- billing/access test post-pago si monetiza;
- tenant isolation evidence;
- production DB bindings verificados;
- secrets/env readiness;
- health endpoint con estado accionable;
- observabilidad de errores, jobs y actividad;
- runbook de rollback;
- CI/CD gate;
- docs vigentes;
- sin drift entre auditoria, tests y codigo.

## Matriz de productos

| Producto/modulo | Tipo | Estado actual | Prioridad | Bloqueador principal | Siguiente accion | Monetizar ahora | Ensenar a cliente | Riesgo |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Drako | marca/casa central | parcial | P5 | Marca mezclada con control-plane/factory | `DRAKO_BRAND_PRODUCT_BOUNDARY_AUDIT` | No | Si, como marca/catalogo | Medio |
| Campamento Base | control-plane | parcial | P0 | Riesgo de monolito operativo | Mantener como control-plane y bloquear runtime SaaS interno | No | No, interno | Alto |
| SocialFlow | SaaS vertical | parcial avanzado | P2 | Drift architecture/readiness | `SOCIALFLOW_ARCHITECTURE_DRIFT_FIX` | No, hasta cerrar gates | Si, demo/piloto controlado | Medio-alto |
| Mentoria | SaaS vertical | parcial profundo | P3 | Privacidad, familia, billing, E2E | `MENTORIA_DEEP_PRODUCT_PRIVACY_BILLING_AUDIT` | No | Demo interna, no venta amplia | Alto |
| Clinic | SaaS vertical | parcial neutralizado | P6 | Producto incompleto/auth/billing | Completar producto despues de prioridades base | No | Solo demo parcial | Medio |
| TaskOps | motor transversal | legacy | P1 | No existe `src/lib/taskops`; guardrail `4` | `TASKOPS_NEUTRAL_RUNTIME_PARITY_AND_GUARDRAIL_PREP` | No | No | Alto |
| Factory/provisioning | factory/provisioning | mezclado/parcial | P4 | Frontera con Campamento Base y plantilla estandar | `FACTORY_PROVISIONING_BOUNDARY_AUDIT` | No | No self-serve | Alto |
| Auth/Auths/Authz | runtime compartido | parcial | P6 | Multiples contextos y legacy compat | `AUTH_TENANCY_BILLING_MATRIX` | No | No aplica | Alto |
| Billing/Stripe | runtime compartido | parcial real | P6 | Acceso post-pago y metadata por SaaS | `AUTH_TENANCY_BILLING_MATRIX` | No como producto | No aplica | Alto |
| DB/Tenancy | runtime compartido | mezclado | P6 | Tablas historicas/duplicadas y aislamiento | `AUTH_TENANCY_BILLING_MATRIX` | No aplica | No aplica | Alto |
| Observabilidad | runtime compartido | parcial | P6 | Smoke matrix por producto | `OBSERVABILITY_SMOKE_MATRIX` | No aplica | No aplica | Medio |
| Automation-core | runtime compartido | separado | P1 soporte | TaskOps depende de el | Usarlo como base neutral TaskOps | No aplica | No aplica | Bajo |
| Integration-core | runtime compartido | separado/parcial | P1 soporte | Providers pueden conocer productos | Mantener reusable y auditar imports | No aplica | No aplica | Medio |
| WhatsApp | runtime compartido | parcial | P1 soporte | Usado por Clinic/TaskOps/Mentoria | Mantener por contratos | No aplica | No aplica | Medio |
| Owner/Operator | control-plane surfaces | parcial | P6 | Duplicacion y mezcla operativa | Revisar despues de TaskOps/SocialFlow | No | Interno | Medio |

## Orden correcto de trabajo

### FASE 0 - Congelacion estrategica

Objetivo: detener expansion hasta cerrar base arquitectonica.

Reglas:

- No crear nuevos SaaS.
- No ampliar `campobase`.
- No tocar TaskOps a ciegas.
- No usar Factory para crear productos nuevos.
- Solo cerrar arquitectura base.

Entregables:

- Este roadmap.
- Guardrail humano adoptado.
- Backlog priorizado.

Criterio de terminado:

- Equipo acepta que la prioridad es cierre arquitectonico, no expansion.

### FASE 1 - TaskOps neutral

Objetivo: sacar el runtime vivo de TaskOps de `src/lib/campobase` y reducir el guardrail `4 -> 0` sin perder comportamiento.

Trabajo:

- Crear `src/lib/taskops`.
- Crear runtime parity.
- Crear service/platform neutral.
- Crear bridge cross-saas neutral para `task.overdue`.
- Reducir guardrail `4 -> 3 -> 2 -> 0`.
- Eliminar dependencia viva de `campobase`.

Secuencia sugerida:

1. Ratificar contrato/paridad TaskOps.
2. Crear tests neutrales sin tocar legacy.
3. Crear service neutral.
4. Crear platform/bridge neutral.
5. Migrar tests legacy a neutral o static adapter checks.
6. Migrar runtime wiring.
7. Shrink guardrail solo cuando el edge desaparezca realmente.

Criterio de terminado:

- `src/lib/taskops` existe.
- `tests/lib/taskops-*.test.ts` cubren paridad.
- `tests/lib/cross-saas-taskops-flow.test.ts` ya no importa `@/lib/campobase`.
- `tests/architecture/campobase-namespace-freeze.test.ts` pinned size llega a `0`.

### FASE 2 - SocialFlow production-readiness

Objetivo: convertir SocialFlow en el primer SaaS vendible del ecosistema.

Trabajo:

- Corregir drift de tests architecture.
- Verificar runtime split.
- Verificar tenant isolation.
- Verificar billing/access.
- Verificar LinkedIn/social publishing.
- Verificar scheduler/composer/analytics.
- Definir si es vendible.

Bloqueadores conocidos:

- Drift en `socialflow-runtime-split-scaffold`.
- Drift en `socialflow-vertical-boundaries`.
- Evidencia tenant isolation/export delegada a contract, no reflejada por test.

Criterio de terminado:

- Architecture tests SocialFlow verdes.
- Billing-to-access smoke verde.
- LinkedIn/publishing gates definidos.
- SocialFlow declarado vendible solo si production-readiness gate pasa.

### FASE 3 - Mentoria deep audit

Objetivo: auditar Mentoria como SaaS educativo completo antes de venta o expansion.

Trabajo:

- Auditar producto educativo completo.
- Familia/padres/alumnos/tutores.
- Auth.
- Billing.
- Data privacy.
- Tareas/imagenes/examenes.
- Orquestador emocional.
- Agentes educativos.
- Persistencia.
- Tests E2E.
- Riesgo legal/productivo.

Criterio de terminado:

- Matriz de permisos guardian/student/tutor.
- Flujo E2E principal documentado.
- Riesgos privacidad menores clasificados.
- Plan de hardening aprobado.

### FASE 4 - Factory/provisioning boundary

Objetivo: separar Factory de Campamento Base y evitar que cree productos acoplados.

Trabajo:

- Separar Factory de Campamento Base.
- Definir contrato de creacion de SaaS.
- Definir plantilla estandar de SaaS nuevo.
- Prohibir imports directos peligrosos.
- Verificar rollback/jobs/domains/billing.
- Crear checklist antes de permitir crear nuevos SaaS.

Criterio de terminado:

- Existe contrato factory/provisioning.
- Existe plantilla estandar de SaaS.
- Create-SaaS gate falla si falta auth/billing/DB/observability.
- Factory no crea SaaS nuevos sin checklist completo.

### FASE 5 - Drako marca/casa central

Objetivo: clarificar Drako como marca/casa central y no confundirlo con Factory o Campamento Base.

Trabajo:

- Clarificar landing.
- Clarificar productos.
- Clarificar que vende Drako.
- Separar marketing de control-plane.
- Evitar confundir Drako con Factory.

Criterio de terminado:

- Drako comunica marca y catalogo.
- SocialFlow/Mentoria/otros productos tienen oferta separada.
- Campamento Base no aparece como producto publico.

### FASE 6 - Auth/Tenancy/Billing/Observability hardening

Objetivo: endurecer base transversal para que todos los SaaS sean operables.

Trabajo:

- Auth por producto.
- Tenant isolation.
- Billing por SaaS.
- Health endpoints.
- Smoke tests.
- Observabilidad por producto.
- CI/CD production gates.

Criterio de terminado:

- Matriz auth por ruta.
- Matriz billing/access por producto.
- Matriz smoke/health por producto.
- CI bloquea regressions.

### FASE 7 - Separacion uno a uno de SaaS futuros

Objetivo: recien entonces crear o separar nuevos SaaS.

Reglas:

- Solo despues de las fases anteriores.
- Cada nuevo SaaS debe nacer con contrato estandar.
- Debe tener namespace propio.
- Debe tener auth, billing, DB, tests, observability.
- Debe conectar con Campamento Base por API/event/contract, no imports directos.

Criterio de terminado:

- Nuevo SaaS pasa checklist estandar completo antes de ser vendible.

## Checklist estandar para separar un SaaS

Usar esta lista para SocialFlow, Mentoria, Clinic y cualquier futuro SaaS.

| # | Check | Pregunta de aceptacion |
| --- | --- | --- |
| 1 | Namespace propio | Existe `src/lib/<saas>` y contiene runtime del producto. |
| 2 | Rutas publicas | Landing/onboarding/public pages estan identificadas. |
| 3 | Rutas privadas | Dashboard/app privada usa auth/contexto del producto. |
| 4 | APIs propias | APIs del producto estan bajo `/api/<saas>` o internal namespace claro. |
| 5 | Auth propia o contexto auth | Existe sesion/contexto especifico o aislamiento documentado. |
| 6 | Tenant isolation | Queries/rutas/tests prueban `tenant_id`/scope correcto. |
| 7 | DB/tables/migrations | Tablas/migrations del producto estan inventariadas. |
| 8 | Billing/pricing | Planes, checkout, portal y acceso post-pago estan definidos o declarado N/A. |
| 9 | Control-plane contract | Existe contrato de conexion con Campamento Base. |
| 10 | Internal API/event bridge | Campamento Base opera por API/event/queue/contract. |
| 11 | No imports directos peligrosos | No hay producto -> producto ni producto -> control-plane runtime indebido. |
| 12 | Tests unitarios | Servicios core cubiertos. |
| 13 | Tests arquitectura | Boundaries y guardrails verdes. |
| 14 | Tests E2E/smoke | Flujo principal pasa con setup controlado. |
| 15 | Health endpoint | Existe endpoint o health contract del producto. |
| 16 | Observability | Incidents/activities/metrics/snapshots definidos. |
| 17 | Docs | Docs vigentes, no solo auditorias historicas. |
| 18 | Production readiness | Gate explicito y reproducible. |
| 19 | Comercializacion | Producto, plan, pricing, demo y limites claros. |
| 20 | Rollback | Runbook de rollback o recovery existe. |

Resultado de checklist:

- `0-9`: no separado.
- `10-14`: separado parcial, no vendible.
- `15-17`: piloto controlado.
- `18-20`: candidato production-ready.

## Plantilla de bloque por SaaS

Usar esta plantilla para futuros prompts tecnicos.

```md
Actua como arquitecto principal del ecosistema Drako.

Bloque: <NOMBRE_DEL_BLOQUE>
Producto: <SAAS>
Tipo: auditoria / contrato / codigo / test / hardening

Objetivo:
- <objetivo concreto>

Contexto canonico:
- Drako = marca/casa central.
- Campamento Base = control-plane.
- No nuevos imports a `@/lib/campobase`.
- Campamento Base conecta por API/event/contract, no runtime interno.

Archivos a revisar:
- <rutas>

Archivos a crear:
- <rutas>

Archivos a modificar:
- <rutas>

Archivos que NO tocar:
- tests/guardrails/migrations/UI/etc si aplica.

Tareas:
1. Auditoria inicial del SaaS.
2. Contrato de frontera.
3. Refactor minimo.
4. Tests.
5. Guardrails.
6. Production readiness.
7. CI.
8. Validacion.

Validaciones minimas:
- `pnpm typecheck`
- tests puntuales del producto
- tests architecture relevantes

Criterio de terminado:
- <condicion observable>

Commit recomendado:
- <mensaje sugerido, si el bloque permite commit>
```

## Backlog priorizado

| # | Bloque | Objetivo | Tipo | Archivos probables | Validaciones minimas | Riesgo | Criterio de terminado |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | `TASKOPS_NEUTRAL_RUNTIME_PARITY_AND_GUARDRAIL_PREP` | Fijar paridad y alcance antes de tocar legacy | contrato/test prep | `docs/contracts/*taskops*`, futuros `tests/lib/taskops-*` | `pnpm typecheck`, freeze | Medio | Plan/paridad neutral aprobada sin shrink prematuro. |
| 2 | `TASKOPS_NEUTRAL_SERVICE_PLATFORM` | Crear service/platform neutral | codigo/test | `src/lib/taskops/service.ts`, `src/lib/taskops/platform.ts`, `tests/lib/taskops-*` | typecheck, TaskOps neutral tests | Alto | TaskOps neutral reproduce service/platform behavior. |
| 3 | `TASKOPS_CROSS_SAAS_BRIDGE_NEUTRALIZATION` | Portar `task.overdue` a bridge neutral | codigo/test | `src/lib/taskops/*bridge*`, `tests/lib/cross-saas-taskops-flow.test.ts` | cross-saas TaskOps, freeze | Alto | Cross-saas flow no depende de `campobase`. |
| 4 | `CAMPOBASE_GUARDRAIL_SHRINK_4_TO_0` | Reducir allowlist tras edges eliminados | test/guardrail | `tests/architecture/campobase-namespace-freeze.test.ts` | freeze, TaskOps tests | Alto | Guardrail pinned `0`, sin imports vivos. |
| 5 | `SOCIALFLOW_ARCHITECTURE_DRIFT_FIX` | Alinear tests/docs con estado SocialFlow real | auditoria/codigo/test segun drift | `tests/architecture/socialflow-*`, `apps/socialflow-runtime`, `src/lib/campobase/socialflow-service.ts`, `src/lib/socialflow/export.ts` | SocialFlow architecture subset | Medio | Architecture SocialFlow verde sin relajar reglas indebidamente. |
| 6 | `SOCIALFLOW_PRODUCTION_READINESS_GATE` | Decidir vendibilidad SocialFlow | hardening/test | SocialFlow routes, billing, LinkedIn, scheduler, readiness scripts | typecheck, SocialFlow readiness, billing/access smoke | Alto | Gate documentado y verde. |
| 7 | `MENTORIA_DEEP_PRODUCT_PRIVACY_BILLING_AUDIT` | Auditar Mentoria en profundidad | auditoria | `src/lib/mentoria`, `src/app/mentoria`, `src/app/api/mentoria`, migrations | no suite completa; tests puntuales si aplica | Medio | Auditoria con riesgos privacidad/billing/E2E. |
| 8 | `MENTORIA_RUNTIME_HARDENING_PLAN` | Convertir auditoria Mentoria en plan ejecutable | contrato/hardening | docs/contracts, docs/roadmaps, Mentoria tests | Mentoria architecture/API selected | Alto | Plan por permisos, datos, billing y E2E. |
| 9 | `FACTORY_PROVISIONING_BOUNDARY_AUDIT` | Auditar frontera Factory/Campamento Base | auditoria | `src/lib/factory`, `src/lib/saas-factory`, `src/lib/campamento-base/saas-factory-*`, APIs factory | factory parity/e2e selected | Medio | Mapa de acoplamientos y riesgos. |
| 10 | `FACTORY_STANDARD_SAAS_TEMPLATE_CONTRACT` | Definir plantilla obligatoria para nuevo SaaS | contrato | `docs/contracts/saas-product-template-boundary-contract-v1.md`, factory docs | contract tests si existen | Medio | Contrato nuevo SaaS aprobado. |
| 11 | `DRAKO_BRAND_PRODUCT_BOUNDARY_AUDIT` | Separar marca, producto y control-plane | auditoria | `src/app`, `src/lib/drako`, product pages | route/static checks | Bajo | Drako definido como marca/casa central. |
| 12 | `AUTH_TENANCY_BILLING_MATRIX` | Matriz por ruta/producto | auditoria/contract | auth/auths/authz/billing/routes | auth/billing tests selected | Alto | Ninguna ruta critica sin owner/session/tenant decision. |
| 13 | `OBSERVABILITY_SMOKE_MATRIX` | Health/smoke por producto | auditoria/test plan | health routes, observability-core, CI | health/smoke selected | Medio | Matriz smoke CI por producto. |
| 14 | `NEW_SAAS_CREATION_PLAYBOOK` | Reabrir creacion SaaS con reglas | docs/contract | `docs/roadmaps`, `docs/contracts`, factory docs | template/architecture checks | Medio | Playbook exige checklist 20/20 antes de crear SaaS. |

## Reglas absolutas

- No crear mas SaaS hasta cerrar TaskOps y SocialFlow readiness.
- No tocar Factory para crear productos nuevos.
- No anadir imports a `@/lib/campobase`.
- No mover logica SaaS a Campamento Base.
- No mezclar Mentoria con SocialFlow.
- No tocar TaskOps legacy sin paridad neutral.
- No vender Mentoria sin auditoria de privacidad.
- No declarar SocialFlow production-ready con tests architecture fallando.
- No tocar billing sin test de acceso post-pago.
- No tocar auth sin matriz de rutas.
- No bajar guardrail si el import sigue vivo.
- No convertir tests funcionales legacy en checks estaticos sin cobertura neutral equivalente.
- No usar `src/app/_saas_broken` como base de producto.
- No considerar Clinic SaaS completo hasta cerrar auth, billing, onboarding y smoke.
- No exponer internal APIs sin auth/service-token o decision explicita.

## Estado inicial de ejecucion

Guardrail actual:

- `tests/architecture/campobase-namespace-freeze.test.ts`
- pinned size: `4`

Edges restantes:

- `src/lib/campobase/platform-bootstrap.ts::@/lib/campobase/taskops-platform`
- `src/lib/campobase/taskops-platform.ts::@/lib/campobase/taskops-platform-service`
- `tests/lib/campobase-taskops-platform-service.test.ts::@/lib/campobase/taskops-platform-service`
- `tests/lib/cross-saas-taskops-flow.test.ts::@/lib/campobase/taskops-platform`

Bloque recomendado para empezar:

- `TASKOPS_NEUTRAL_RUNTIME_PARITY_AND_GUARDRAIL_PREP`

Puede empezar separacion SaaS uno a uno ahora:

- No.

Antes debe hacerse:

1. Cerrar TaskOps neutral y llevar `campobase` guardrail a `0`.
2. Cerrar SocialFlow architecture drift y production-readiness gate.
3. Auditar Mentoria en privacidad/billing/E2E.
4. Definir frontera Factory/provisioning y plantilla estandar de SaaS.
5. Crear matriz Auth/Tenancy/Billing/Observability.

