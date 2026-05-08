# P10.29 - SocialFlow Production SaaS Readiness Audit

Fecha: 2026-05-08
Estado: `AUDITED`
Alcance: SocialFlow como SaaS comercial independiente production-ready.

## Resumen ejecutivo

SocialFlow esta en buen estado para piloto controlado y demostracion comercial, pero no esta listo todavia para venderse como SaaS self-serve production-ready con suscripciones Stripe, onboarding cliente completo, workspace real, control de entitlements, metricas productivas y conexion gobernada con Campamento Base.

Lectura actual:

| Dimension | Estado | Evaluacion |
| --- | --- | --- |
| Landing publica | Activa y premium | Lista para captacion/piloto controlado. |
| Dominio canonico | Activo | `socialflow.drako.systems` funciona junto a compat `socialflows.drako.systems`. |
| APIs publicas | Protegidas en Worker | La superficie publica del Worker sigue limitada a `/`, `/socialflow`, `/socialflow/auth`. |
| Auth producto | Parcial | Hay boundary SocialFlow aislado, pero falta ciclo comercial de tenant/workspace/invitaciones. |
| Workspace cliente | Parcial/mezclado | Existe shell y pantallas, pero aun tienen copy y acciones genericas de Campamento/Factory. |
| Stripe | Parcial generico | Hay checkout workspace y checkout SaaS generico, pero SocialFlow no tiene planes/entitlements propios conectados. |
| Datos sociales | Parcial | Hay entidades en `SOCIAL_DB`, pero schema se autoasegura en runtime y falta ownership/migracion canonica de producto. |
| LinkedIn/OAuth | Parcial | Hay OAuth, persistencia y publishing LinkedIn, pero falta UX completa, token lifecycle y boundary consistente de producto. |
| IA | Parcial | Hay orquestador/agentes y persistencia, pero algunos providers siguen siendo placeholder/deterministicos. |
| Calendario/publicacion | Parcial con riesgo | Hay scheduler y publishing, pero existe ruta que puede publicar en vivo desde contrato simplificado sin revision humana explicita. |
| Metricas | Parcial | Hay snapshots y observabilidad, pero no ingestion productiva completa de analitica social real. |
| Campamento Base | Parcial | Hay contratos de automatizacion/observabilidad, pero falta contrato comercial/gobierno estable para SaaS independiente. |

Conclusion: SocialFlow esta aproximadamente en `piloto avanzado`, no en `SaaS comercial production-ready`. Recomendacion: no vender self-serve con cobro automatico hasta cerrar los bloqueantes P0 listados abajo.

## Validacion previa ejecutada

Antes de auditar se ejecuto la validacion solicitada:

| Comando | Resultado |
| --- | --- |
| `git status --short` | PASS, worktree limpio al inicio. |
| `pnpm typecheck` | PASS. |
| `pnpm lint` | PASS, 0 errores, 208 warnings existentes. |
| `pnpm test` | PASS. |
| `pnpm build` | PASS. |

## Evidencia tecnica principal

| Area | Evidencia | Lectura |
| --- | --- | --- |
| Worker publico | `packages/shared/workers-handlers/index.ts`, tests `workers-socialflow-public-routes` y `workers-socialflow-host-fencing` | La landing publica esta cubierta y `/api/*` sigue protegido por Origin/host fencing. |
| Worker SocialFlow | `workers/socialflows/wrangler.workers.toml` declara `saas-socialflows-prod`, ambos dominios y `WORKERS_ONLY_MODE=true` | Dominio y runtime publico estan en fase controlada. No se debe tocar en esta fase. |
| SOCIAL_DB | `src/lib/socialflow/repository.ts:31-69` | El runtime crea/asegura tablas en codigo (`CREATE TABLE IF NOT EXISTS`). Para produccion hace falta migracion canonica/versionada. |
| Post lifecycle | `src/app/api/socialflow/posts/route.ts:61-149` | API crea posts y en contrato simplificado puede llamar `publishSocialPostLive` si no hay `scheduledAt`. Riesgo contra "revision humana antes de publicar". |
| Isolation de post by id | `src/lib/socialflow/repository.ts:98-101` | `getSaasSocialPostById` filtra por `tenant_id` e `id`, no por `saas_id`. Debe cerrarse antes de multi-SaaS comercial. |
| Workspace shell | `src/modules/socialflow-app/layout.tsx:45-54` y `src/components/layouts/socialflow-shell.tsx:83-133` | Plan, billing y onboarding estan hardcoded; UI habla de Campamento/Base/shared SaaS core. |
| Billing actual | `src/modules/socialflow-app/settings/billing-page.tsx:12-28`, `src/components/settings/billing-settings.tsx:24-44`, `src/app/api/billing/create-checkout/route.ts:51-64` | Billing conectado es de tenant workspace, no planes SocialFlow de gestion social. |
| Checkout SaaS generico | `src/app/api/stripe/checkout-saas/route.ts:18-90`, `src/lib/billing/saas-plans.ts:87-137` | Base tecnica existe, pero no esta conectada como flujo comercial SocialFlow. |
| Registro producto | `src/app/api/socialflow/auths/registrations/route.ts:29-35` | Registro acepta `tenantId` del body. Antes de self-serve debe haber tenant provisioning/invite ownership claro. |
| Demo auth | `src/lib/socialflow/auth/server.ts:21-30` | Modo `local_demo` existe por header. Debe estar garantizado fuera de produccion. |
| LinkedIn connect | `src/app/api/socialflow/linkedin/connect/route.ts:18-26` | Usa `requireTenantAccess`, no la session SocialFlow aislada. Boundary inconsistente para producto independiente. |
| LinkedIn callback/persistencia | `src/lib/socialflow/linkedin/oauth.ts:183-223` | Persistencia requiere `DRACO_DB` y `SOCIAL_DB`; hay diagnostico, pero falta UX/comercializacion. |
| Token lifecycle | `src/lib/socialflow/linkedin/publishing.ts:56-60` | Refresh automatico no soportado. Hace falta reconnect UX y estados operativos claros. |
| Scheduler cron | `src/app/api/cron/social/publish/route.ts:13-30` | Scheduler productivo requiere auth cron y procesa posts programados. |
| Endpoint test | `src/app/api/test-social-scheduler/route.ts:8-66` | Ruta de test sin auth en arbol Next. Aunque Worker publico actual proteja `/api/*`, debe eliminarse o cerrarse antes de runtime Next/publico. |
| IA | `src/lib/socialflow/ai/SocialFlowOrchestrator.ts:72-114`, `src/lib/socialflow/ai/models/CloudflareProvider.ts:3-15` | Hay pipeline, pero provider Cloudflare esta preparado como placeholder sin llamada real. |
| Setup/plan workspace | `src/modules/socialflow-app/pages/setup-page.tsx:1-4`, `analysis-page.tsx:20-37`, `plan-page.tsx:30-67` | Onboarding actual es generico de estrategia/factory, no onboarding operativo SocialFlow. |
| Team | `src/modules/socialflow-app/settings/team-page.tsx:22-24` | Team roster es read-only; invitaciones y roles siguen pendientes. |

## Readiness comercial por capacidad

| Capacidad necesaria | Estado actual | Gap exacto | Prioridad |
| --- | --- | --- | --- |
| Suscripciones Stripe SocialFlow | Existe billing workspace y checkout SaaS generico. | Faltan planes SocialFlow, price IDs propios, checkout product-native, webhooks con scope SocialFlow y estados de suscripcion usados por el workspace. | P0 |
| Planes/servicios contratables | No hay catalogo comercial SocialFlow conectado al producto. | Definir `Starter/Pro/Agency/Managed` o equivalente, limites, SLA, volumen de posts, cuentas, usuarios, IA, aprobaciones y soporte. | P0 |
| Onboarding cliente | Auth page existe; setup es `StrategicForm` generico. | Crear onboarding SocialFlow: empresa, objetivos, tono, audiencia, canales, frecuencia, politica de revision, responsables, primera conexion social. | P0 |
| Workspace real | Hay workspace y dashboard, pero con shell/copy generico y hardcodes. | Rehacer como SocialFlow app: calendario, canales, ideas, borradores, aprobaciones, cuentas sociales, metricas, billing y equipo. | P0 |
| Entitlements | No hay gating por plan SocialFlow. | Proteger rutas y APIs por tenant + subscription + plan limits. | P0 |
| Conexion de cuentas sociales | LinkedIn existe parcialmente; Instagram/X son solo narrativa/visual. | UI productiva para conectar, diagnosticar, reconectar, desconectar y ver permisos; no prometer providers no productivos. | P0 |
| Publicacion controlada | Existe scheduler/live publish LinkedIn. | Bloquear publish sin `APPROVED`/revision humana, auditar aprobador, separar preparar vs publicar. | P0 |
| Calendario editorial | Hay posts, estados y calendario. | Falta UX completa de plan mensual, drag/schedule, aprobaciones, conflictos, vistas por canal/campana. | P1 |
| Agentes IA | Hay orquestador y agentes. | Conectar provider productivo, prompts/politicas, limites por plan, trazabilidad de generacion y revision humana. | P1 |
| Metricas/reporting | Hay snapshots desde `SOCIAL_DB` y observabilidad. | Ingestion real de metricas por provider, ventanas temporales, dashboards cliente, exports, alertas y explicacion de datos faltantes. | P1 |
| Team/roles | Read-only roster. | Invite flow, RBAC por acciones: owner/admin/editor/reviewer/viewer. | P0 |
| Campamento Base integration | Hay automation/observability contracts. | Definir contrato estable de eventos, metricas, soporte y gobierno sin mezclar copy/UX ni DB logic interna en SocialFlow. | P1 |
| Seguridad tenant/SaaS | Auth y host fencing existen. | Cerrar `saas_id` en queries by-id, revisar registro con tenantId, cerrar endpoint test, asegurar `local_demo` fuera de prod. | P0 |
| Operacion | Cron y operator actions existen. | Runbooks, alertas, idempotencia por workflow, rate limits por provider, replay/retry gobernado y soporte cliente. | P1 |

## Bloqueantes P0 antes de vender self-serve

1. Crear modelo comercial SocialFlow propio.
   - Planes, precios, limites, entitlements, trial, cancelacion, upgrade/downgrade y estado de cuenta.
   - No reutilizar el billing de tenant workspace como si fuera billing SocialFlow.

2. Conectar Stripe a SocialFlow, no solo al workspace generico.
   - Usar o adaptar `checkout-saas`/`saas_plans` con scope SocialFlow.
   - Webhook debe activar/desactivar acceso y registrar eventos de suscripcion para Campamento Base.

3. Construir onboarding product-native.
   - Registro debe crear o vincular tenant/workspace de forma controlada.
   - El usuario no debe poder autoasignarse a un `tenantId` arbitrario salvo invitacion firmada.

4. Cerrar publicacion sin revision.
   - El POST simplificado que publica en vivo sin `scheduledAt` debe eliminarse o quedar detras de una politica explicita que exija aprobacion previa.
   - Scheduler solo deberia publicar posts `APPROVED` y `SCHEDULED`, con `approvedBy/approvedAt`.

5. Formalizar schema y ownership de `SOCIAL_DB`.
   - Mover runtime DDL hacia migraciones versionadas.
   - Definir si SocialFlow usa D1 fisica propia o base compartida por fase, con criterio de salida.

6. Resolver workspace UX.
   - Quitar copy de Campamento/Base/Factory del producto cliente.
   - Separar operator control plane de experiencia cliente.

7. Unificar boundary de SocialFlow.
   - APIs de producto deben depender consistentemente de SocialFlow auth/session y RBAC.
   - Revisar LinkedIn connect, billing, checkout y endpoints auxiliares.

8. Cerrar endpoints de test o debug.
   - `src/app/api/test-social-scheduler/route.ts` no debe existir accesible en un runtime publico.

9. Completar team/RBAC.
   - Invitar miembros, aceptar invitacion, roles granulares y auditoria por accion.

10. Definir contrato Campamento Base.
   - SocialFlow emite eventos y snapshots; Campamento observa/gobierna.
   - Campamento no debe ser parte visible del workspace cliente salvo soporte/estado interno.

## Roadmap recomendado

### Fase A - Product contract y seguridad comercial

Resultado: SocialFlow puede abrir beta cerrada pagada sin publicar contenido por accidente.

- Especificar planes, entitlements y limites.
- Especificar modelo tenant/workspace/user/role.
- Cerrar publicacion sin revision.
- Cerrar `getSaasSocialPostById` con `saas_id`.
- Eliminar/cerrar endpoint test scheduler.
- Verificar `local_demo` imposible en host productivo.

### Fase B - Stripe y onboarding

Resultado: cliente puede contratar o entrar a trial controlado y completar setup.

- Crear plan catalog SocialFlow.
- Wire checkout/product billing al scope SocialFlow.
- Procesar webhook y activar entitlement.
- Onboarding: perfil negocio, tono, objetivos, canales, frecuencia, equipo y primer calendario.
- Billing page con planes SocialFlow reales.

### Fase C - Workspace cliente real

Resultado: cliente opera el producto sin lenguaje interno Drako/Campamento.

- Dashboard SocialFlow: calendario, canales, ideas, borradores, aprobaciones, metricas.
- Account/team/billing/settings product-native.
- UX para conectar LinkedIn, diagnosticar permisos y reconectar.
- Estados claros: draft, in review, approved, scheduled, publishing, published, failed.

### Fase D - Operacion y Campamento Base

Resultado: Campamento Base observa y gobierna sin mezclar logica interna.

- Eventos canonicos: subscription, onboarding, generation, approval, publish, failure, reconnect, support.
- Observability snapshots estables.
- Operator actions auditadas.
- Runbooks y alertas.

### Fase E - IA y metricas productivas

Resultado: automatizacion vendible con limites honestos.

- Provider IA productivo con limites por plan.
- Generacion trazable por prompt/version/modelo.
- Politicas de seguridad/copy claims.
- Ingestion de metricas LinkedIn y reportes cliente.
- Preparar futura expansion Instagram/X solo cuando haya integracion verificada.

## Decision recomendada

No posicionar todavia SocialFlow como SaaS self-serve production-ready. Posicionarlo como:

- `Piloto controlado comercial`
- `Beta privada pagada`
- `Servicio gestionado con automatizacion asistida`

La venta puede avanzar si el contrato comercial promete revision humana y alcance controlado, pero el producto no debe aceptar clientes self-serve con publicacion automatica y cobro recurrente sin cerrar los P0.

## No cambiado en esta auditoria

- No se toco Cloudflare.
- No se tocaron workflows.
- No se tocaron DBs ni migraciones.
- No se tocaron OAuth/LinkedIn.
- No se tocaron APIs.
- No se tocaron middleware, Mentoría ni Campamento Base productivo.
- No se abrieron rutas publicas.
- No se cambio `WORKERS_ONLY_MODE`.
