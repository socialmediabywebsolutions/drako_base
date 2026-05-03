# 13_progress_log

## Objetivo de este archivo
Bitacora tecnica incremental para continuidad entre chats. Registrar hechos verificables, no intenciones.

## Formato de entrada
```md
## [YYYY-MM-DD HH:mm UTC+TZ] TAG
- Contexto:
- Cambio realizado:
- Archivos tocados:
- Verificacion ejecutada:
- Resultado:
- Riesgo residual:
- Siguiente accion:
- Relacion con issues:
```

## [2026-05-03 14:40 UTC+02:00] SOCIALFLOW-P7-OPERATOR-HEALTH-PANEL
- Contexto:
  - P6 dejo disponible el contrato `src/lib/socialflow/contracts/observability.ts` para que Campamento Base observe SocialFlow sin importar motores internos.
- Cambio realizado:
  - `/operator/socialflow` ahora muestra salud operativa real consumiendo `GET /api/operator/socialflow?tenantId=...&saasId=...`.
  - El panel muestra health general, scheduler, LinkedIn, publishing 30 dias, posts atascados en `PUBLISHING`, ultimos fallos, ultimos publicados, eventos e incidentes.
  - Se agrego test de UI para asegurar que el panel consulta el contrato operator y pinta el `observability` recibido.
- Archivos tocados:
  - `src/components/campobase/CampoBaseSocialAutomationControl.tsx`
  - `tests/components/operator-socialflow-health-panel.test.tsx`
  - `docs/knowledge-pack/13_progress_log.md`
- Verificacion ejecutada:
  - `pnpm typecheck`
  - `pnpm exec vitest run tests/components/operator-socialflow-health-panel.test.tsx tests/lib/socialflow-operator-observability.test.ts tests/api/campobase-socialflow-route.test.ts tests/architecture/socialflow-vertical-boundaries.test.ts`
- Resultado:
  - Campamento Base visualiza la observabilidad de SocialFlow por contrato publico, sin tocar Mentoria, `apps/*`, workers, middleware ni motores internos de publishing/scheduler.
- Riesgo residual:
  - Queda pendiente validacion visual en navegador real si se quiere ajustar densidad/jerarquia del panel operator.
- Siguiente accion:
  - Ejecutar validacion completa final y, si producto lo requiere, abrir `/operator/socialflow` en runtime local.

## [2026-05-03 09:55 UTC+02:00] SOCIALFLOW-P5-1-PUBLISHING-RELIABILITY-NATIVE
- Contexto:
  - P5 habia endurecido la fiabilidad de publicacion, pero la implementacion real seguia en `src/lib/social/*`, una capa ya marcada como legacy.
- Cambio realizado:
  - Se movio la implementacion real de `repository`, `live-publishing` y `scheduler` a `src/lib/socialflow/*`.
  - Se creo `src/lib/socialflow/linkedin/publishing.ts` como primitiva nativa de publicacion LinkedIn.
  - `src/lib/social/repository.ts`, `src/lib/social/live-publishing.ts`, `src/lib/social/scheduler.ts` y `src/lib/social/linkedin-service.ts` quedaron como facades deprecated.
  - Los tests de publishing y scheduler apuntan ahora a los modulos canonicos SocialFlow.
  - Se extendio `tests/architecture/socialflow-vertical-boundaries.test.ts` para impedir que la reliability canonica vuelva a legacy.
- Verificacion ejecutada:
  - `pnpm typecheck`
  - `pnpm lint`
  - `pnpm test`
  - `pnpm build`
  - `pnpm exec vitest run tests/architecture/socialflow-vertical-boundaries.test.ts tests/lib/social-live-publishing-integration.test.ts tests/lib/social-scheduler.test.ts tests/api/social-cron-publish-route.test.ts tests/api/social-posts-route.test.ts tests/api/linkedin-publish-route.test.ts`
- Resultado:
  - Publishing reliability queda nativo en SocialFlow sin tocar Mentoria.
- Riesgo residual:
  - Algunos consumidores legacy pueden seguir importando `@/lib/social/*`, pero reciben facades hacia SocialFlow; se deben migrar gradualmente a imports canonicos.
- Siguiente accion:
  - Reducir los modulos legacy restantes bajo `src/lib/social/*`, especialmente AI/profile/content-engine, sin cambiar comportamiento productivo.

## [2026-05-03 16:55 UTC+02:00] PLATFORM-P6-5-CANONICAL-PRODUCT-MAP
- Contexto:
  - La auditoria de `apps/*` confirmo que esas carpetas no contienen runtime activo: no tienen `package.json`, wrangler config, UI real ni APIs.
  - El runtime vendible vive en `src/app/*`, `src/app/api/*`, `src/lib/*` y `workers/*`.
- Cambio realizado:
  - Se documento el mapa canonico de producto en `docs/knowledge-pack/10_matriz_global_de_rutas_y_entrypoints.md`.
  - Se marco `apps/*` como starter/manifest legacy, no runtime canonico.
  - Se agrego `tests/architecture/canonical-product-map.test.ts` para impedir que `apps/*` crezca con package, wrangler config, `src/*` o APIs sin decision explicita.
  - Se agrego `ISSUE-010` para cerrar a futuro la ubicacion definitiva de `apps/*` como templates/archivo controlado.
- Archivos tocados:
  - `docs/knowledge-pack/10_matriz_global_de_rutas_y_entrypoints.md`
  - `docs/knowledge-pack/12_open_issues.md`
  - `docs/knowledge-pack/13_progress_log.md`
  - `tests/architecture/canonical-product-map.test.ts`
- Verificacion ejecutada:
  - `pnpm typecheck`
  - `pnpm lint`
  - `pnpm test`
  - `pnpm build`
- Resultado:
  - Queda fijado que `apps/*` no es fuente canonica de runtime y que los productos activos se desarrollan en sus superficies reales.
- Riesgo residual:
  - `apps/*` sigue fisicamente en el repo hasta decidir si se mueve a templates o archivo controlado.
- Siguiente accion:
  - Resolver `ISSUE-010` cuando se prepare la plantilla formal de futuros SaaS.
  - No renombrar workers plurales productivos sin plan de deploy.

## [2026-05-02 12:20 UTC+02:00] SOCIALFLOW-P1-VERTICAL-BOUNDARY
- Contexto:
  - P1 de separacion vertical: SocialFlow debe funcionar como SaaS independiente y Campamento Base solo como capa operator/contrato.
- Cambio realizado:
  - Se creo `src/lib/social-core/types.ts` como capa neutral de contratos sociales.
  - Se creo el namespace producto `src/lib/socialflow/*` para engine AI, repositorio, scheduler, publishing, profile y contrato de automatizacion.
  - Campamento Base dejo de importar `@/lib/social/ai/socialflow-engine` y ahora llama `@/lib/socialflow/contracts/automation`.
  - Las rutas canonicas `/api/socialflow/*` consumen fronteras `socialflow/*`.
  - Se agrego `tests/architecture/socialflow-vertical-boundaries.test.ts` para proteger `social-core`, Campamento Base y rutas legacy `410`.
- Verificacion ejecutada:
  - `pnpm typecheck`
  - `pnpm lint`
  - `pnpm exec vitest run tests/architecture/socialflow-vertical-boundaries.test.ts tests/api/social-posts-route.test.ts tests/api/linkedin-publish-route.test.ts tests/api/social-cron-publish-route.test.ts tests/lib/campobase-socialflow-service.test.ts`
- Resultado:
  - Frontera P1 aplicada sin tocar Mentoria aula/chat/pizarra/learning-loop.
- Riesgo residual:
  - `src/lib/social/*` sigue existiendo como compatibilidad legacy; debe reducirse en fases posteriores sin romper rutas canonicas.
- Siguiente accion:
  - Migrar gradualmente repositorio/publishing/LinkedIn desde legacy hacia implementaciones nativas `src/lib/socialflow/*`.

## [2026-05-02 23:18 UTC+02:00] SOCIALFLOW-LINKEDIN-OAUTH-CANONICALIZED
- Contexto:
  - Migracion del OAuth de LinkedIn desde rutas legacy `/api/social/linkedin/*` y callback operativo `/auth/linkedin/callback` hacia la frontera canonica de SocialFlow.
- Cambio realizado:
  - Se extendio `src/lib/social/linkedin.ts` para resolver callback configurable y se repusieron helpers core de parseo/normalizacion usados por token exchange, profile fetch y publish.
  - Se creo la frontera `src/lib/socialflow/linkedin/*` con tipos, cliente OAuth, repositorio y orquestacion canonica del callback.
  - Se habilitaron `/api/socialflow/linkedin/connect` y `/api/socialflow/linkedin/callback` como entrypoints canonicos.
  - `/api/social/linkedin/connect`, `/api/social/linkedin/callback` y `/auth/linkedin/callback` quedaron como bridges `308` sin ejecutar logica OAuth.
  - `src/components/saas/socialflow/SocialFlowWorkspaceClient.tsx` ya apunta al connect canonico.
  - Se actualizaron tests de rutas, boundaries, middleware y logica OAuth para verificar arquitectura canonica + redirects legacy.
- Archivos tocados:
  - `src/lib/social/linkedin.ts`
  - `src/lib/socialflow/linkedin/types.ts`
  - `src/lib/socialflow/linkedin/client.ts`
  - `src/lib/socialflow/linkedin/repository.ts`
  - `src/lib/socialflow/linkedin/oauth.ts`
  - `src/app/api/socialflow/linkedin/connect/route.ts`
  - `src/app/api/socialflow/linkedin/callback/route.ts`
  - `src/app/api/social/linkedin/connect/route.ts`
  - `src/app/api/social/linkedin/callback/route.ts`
  - `src/app/auth/linkedin/callback/route.ts`
  - `src/components/saas/socialflow/SocialFlowWorkspaceClient.tsx`
  - `tests/api/linkedin-connect-route.test.ts`
  - `tests/api/linkedin-callback-route.test.ts`
  - `tests/lib/socialflow-linkedin-oauth.test.ts`
  - `tests/architecture/socialflow-vertical-boundaries.test.ts`
  - `docs/knowledge-pack/08_socialflow_saas_automatizacion_social.md`
  - `docs/knowledge-pack/13_progress_log.md`
- Verificacion ejecutada:
  - `pnpm test -- --run tests/lib/social-linkedin.test.ts tests/lib/linkedin-publish.test.ts tests/lib/socialflow-linkedin-oauth.test.ts tests/api/linkedin-connect-route.test.ts tests/api/linkedin-callback-route.test.ts tests/api/social-posts-route.test.ts tests/api/linkedin-publish-route.test.ts tests/architecture/socialflow-vertical-boundaries.test.ts tests/middleware-linkedin-rate-limit.test.ts`
- Resultado:
  - Flujo OAuth canonico de LinkedIn en SocialFlow validado; rutas legacy y callback operativo quedaron controlados por redirect `308`.
- Riesgo residual:
  - Sigue existiendo dependencia del core legacy `src/lib/social/linkedin.ts` mientras la verticalizacion no extraiga completamente todas las primitivas de LinkedIn a `src/lib/socialflow/*`.
- Siguiente accion:
  - Ejecutar `typecheck/lint/build` del workspace completo cuando se aborde el paquete de lints globales ya existentes fuera de este cambio.
- Relacion con issues:
  - `ISSUE-006`

## [2026-04-08 16:49 UTC+02:00] BASELINE-KNOWLEDGE-PACK
- Contexto:
  - Se consolida un paquete documental tecnico para continuidad del ecosistema.
- Cambio realizado:
  - Creacion del knowledge pack base y del playbook de continuidad.
- Archivos tocados:
  - `docs/knowledge-pack/01_mapa_global_del_sistema.md`
  - `docs/knowledge-pack/02_separacion_de_sistemas_y_fronteras.md`
  - `docs/knowledge-pack/03_modelo_local_next3000_vs_wrangler8787.md`
  - `docs/knowledge-pack/04_reglas_de_middleware_y_enrutamiento.md`
  - `docs/knowledge-pack/05_drako_marca_central_y_governance.md`
  - `docs/knowledge-pack/06_campamento_base_operador_interno.md`
  - `docs/knowledge-pack/07_mentoria_saas_flujo_completo.md`
  - `docs/knowledge-pack/08_socialflow_saas_automatizacion_social.md`
  - `docs/knowledge-pack/09_fabrica_saas_estado_futuro.md`
  - `docs/knowledge-pack/10_matriz_global_de_rutas_y_entrypoints.md`
  - `docs/knowledge-pack/11_current_state.md`
  - `docs/knowledge-pack/12_open_issues.md`
  - `docs/knowledge-pack/13_progress_log.md`
  - `docs/knowledge-pack/14_debug_playbook.md`
- Verificacion ejecutada:
  - Revision de rutas, middleware y focos activos de Mentoria.
- Resultado:
  - Base documental lista para continuidad entre chats.
- Riesgo residual:
  - Drift entre runtime local, middleware y DB si no se valida en `:8787`.
- Siguiente accion:
  - Registrar evidencia real al cerrar cada bloque de trabajo.
- Relacion con issues:
  - `ISSUE-006`, `ISSUE-007`

## [2026-04-11 09:21 UTC+02:00] MENTORIA-LOCAL-E2E-CANONICALIZED
- Contexto:
  - Cierre del hito de Mentoria local tras resolver sesion, onboarding y workspace en runtime real OpenNext/Wrangler.
- Cambio realizado:
  - Se fija como canon local el runtime raiz (`wrangler.jsonc` -> `drako_db_local`).
  - Se consolidan los fixes ya aplicados: cookie local por host real, alta de tenant hermana en `createFamily()`, y esquema local complementario para `drako_events`, `mentoria_feedback_jobs` y `mentoria_system_events`.
  - Se documenta el riesgo de doble estado D1 local entre root y `workers/mentorias`.
- Archivos tocados:
  - `src/lib/mentoria/family-repository.ts`
  - `workers/mentorias/migrations/0001_local_mentoria_schema_bootstrap.sql`
  - `workers/mentorias/migrations/0002_local_runtime_metrics.sql`
  - `workers/mentorias/migrations/0003_local_resilience_feedback.sql`
  - `docs/knowledge-pack/11_current_state.md`
  - `docs/knowledge-pack/12_open_issues.md`
  - `docs/knowledge-pack/13_progress_log.md`
- Verificacion ejecutada:
  - Runtime local en `:8787` con signup, login, onboarding GET/POST, workspace y `/mentoria/app`.
  - `PRAGMA foreign_key_list(student_trials);`
  - `PRAGMA table_info(drako_events);`
  - Confirmacion de dos estados locales separados en `.wrangler/state/v3/d1/...` y `workers/mentorias/.wrangler/state/v3/d1/...`.
- Resultado:
  - Hito local consolidado y documentado con canon de reproduccion y riesgo residual explicito.
- Riesgo residual:
  - Persistencia de doble bootstrap local root vs worker hasta automatizar o encapsular el procedimiento.
- Siguiente accion:
  - Auditar el modulo de verificacion/QA operativa para convertir el procedimiento manual en un runbook o script unico.
- Relacion con issues:
  - `ISSUE-001`, `ISSUE-002`, `ISSUE-003`, `ISSUE-007`, `ISSUE-009`

## [2026-04-11 09:34 UTC+02:00] MENTORIA-LOCAL-BOOTSTRAP-QA-CANON
- Contexto:
  - Consolidacion del procedimiento operativo para evitar drift entre la D1 local root y la D1 local de `workers/mentorias`.
- Cambio realizado:
  - Se crean scripts root para bootstrap canonico, smoke QA y QA end-to-end de Mentoria.
  - Se fija como procedimiento oficial hidratar primero `drako_db_local` via `wrangler.jsonc` y alinear la D1 del worker solo bajo demanda con `--align-worker`.
- Archivos tocados:
  - `package.json`
  - `scripts/local/mentoria-local-bootstrap.mjs`
  - `scripts/local/mentoria-local-smoke.mjs`
  - `scripts/local/mentoria-local-qa.mjs`
  - `docs/knowledge-pack/11_current_state.md`
  - `docs/knowledge-pack/12_open_issues.md`
  - `docs/knowledge-pack/13_progress_log.md`
- Verificacion ejecutada:
  - Inspeccion de `wrangler.jsonc` y `workers/mentorias/wrangler.workers.toml`.
  - Confirmacion de migraciones locales 0001/0002/0003 bajo `workers/mentorias/migrations`.
- Resultado:
  - Queda definido un unico entrypoint operativo para bootstrap + QA local de Mentoria.
- Riesgo residual:
  - Persisten dos estados fisicos de D1 local; el riesgo queda mitigado por script y runbook, no eliminado estructuralmente.
- Siguiente accion:
  - Ejecutar `pnpm mentoria:local:qa` en una maquina limpia para validar reproducibilidad completa sin intervencion manual.
- Relacion con issues:
  - `ISSUE-006`, `ISSUE-009`

## [2026-05-03 13:10 UTC+02:00] SOCIALFLOW-P6-OPERATOR-OBSERVABILITY-CONTRACT
- Contexto:
  - Campamento Base necesitaba consultar salud operativa de SocialFlow sin importar scheduler, live publishing ni motores internos del producto.
- Cambio realizado:
  - Se crea `src/lib/socialflow/contracts/observability.ts` como contrato operator para health, scheduler, posts por estado, publicaciones recientes, fallos, `PUBLISHING` atascados, conexiones LinkedIn, metricas 7/30 dias y eventos/incidentes.
  - `src/lib/campobase/socialflow-service.ts` expone `getCampoBaseSocialFlowObservability()` delegando solo al contrato.
  - `/api/operator/socialflow` y el compat `/api/campobase/socialflow` devuelven `observability` cuando la consulta incluye `tenantId` y `saasId`.
  - Se agregan tests de contrato y frontera para impedir imports directos a motores internos.
- Archivos tocados:
  - `src/lib/socialflow/contracts/observability.ts`
  - `src/lib/campobase/socialflow-service.ts`
  - `src/app/api/operator/socialflow/route.ts`
  - `tests/lib/socialflow-operator-observability.test.ts`
  - `tests/architecture/socialflow-vertical-boundaries.test.ts`
  - `tests/api/campobase-socialflow-route.test.ts`
  - `docs/knowledge-pack/08_socialflow_saas_automatizacion_social.md`
  - `docs/knowledge-pack/10_matriz_global_de_rutas_y_entrypoints.md`
  - `docs/knowledge-pack/13_progress_log.md`
- Verificacion ejecutada:
  - `pnpm exec vitest run tests/lib/socialflow-operator-observability.test.ts tests/architecture/socialflow-vertical-boundaries.test.ts tests/api/campobase-socialflow-route.test.ts`
  - `pnpm typecheck`
- Resultado:
  - Campamento Base observa SocialFlow por contrato publico y mantiene bloqueados los imports a `repository`, `live-publishing`, `scheduler` y `linkedin/publishing`.
- Riesgo residual:
  - La UI operator aun puede decidir cuanto de `observability` mostrar; el contrato backend ya queda disponible.
- Siguiente accion:
  - Añadir visualizacion operator de la salud SocialFlow si producto lo requiere, sin importar motores internos.

## [2026-04-12 16:05 UTC+02:00] MENTORIA-WHATSAPP-ENTRYPOINT-HONEST
- Contexto:
  - Integracion inicial real de WhatsApp para Mentoria usando el resolver `platform_type`.
- Cambio realizado:
  - Creacion de `src/lib/mentoria/whatsapp-entry.ts` con validaciones reales (DB Mentoria, actor y pertenencia `tenantId/saasId`).
  - El handler `mentoria-whatsapp-handler.ts` se convierte en adapter fino al entrypoint.
  - Se registra Mentoria en `bootstrapHandlers()` y se crea el test `tests/mentoria-whatsapp.integration.test.ts`.
- Archivos tocados:
  - `src/lib/mentoria/whatsapp-entry.ts`
  - `src/lib/conversation-router/handlers/mentoria-whatsapp-handler.ts`
  - `src/app/api/conversation-router/route.ts`
  - `tests/mentoria-whatsapp.integration.test.ts`
  - `docs/knowledge-pack/11_current_state.md`
  - `docs/knowledge-pack/12_open_issues.md`
  - `docs/knowledge-pack/13_progress_log.md`
- Verificacion ejecutada:
  - `npm run typecheck`
  - `npm test`
  - `npm run build`
- Resultado:
  - WhatsApp enruta via handler de Mentoria, valida actor real y devuelve `MENTORIA_WHATSAPP_NOT_READY` hasta completar automatizacion.
- Riesgo residual:
  - Falta automatizacion de respuestas Mentoria sobre WhatsApp; QA manual por definir (`ISSUE-006`).
- Siguiente accion:
  - Diseñar el flujo real de automatizacion Mentoria WhatsApp y checklist QA antes de habilitar respuestas.
- Relacion con issues:
  - `ISSUE-006`

## [2026-04-12 17:12 UTC+02:00] MENTORIA-WHATSAPP-INTEGRATION-STUB-READY
- Contexto:
  - El test de integracion de Mentoria WhatsApp seguia fallando con `MENTORIA_SAAS_CONTEXT_MISMATCH` debido al mock global de `@/lib/cf` que anulaba los bindings configurados en el test.
- Cambio realizado:
  - Se reescribio el test `tests/mentoria-whatsapp.integration.test.ts` para importar el modulo real de Cloudflare (`env/setGlobalEnv`), configurar un stub D1 en memoria compatible con `queryOne` y reusar el handler real del router.
  - Se elimino el `console.log` residual de `MentoriaFamilyRepository`.
- Archivos tocados:
  - `tests/mentoria-whatsapp.integration.test.ts`
  - `src/lib/mentoria/family-repository.ts`
- Verificacion ejecutada:
  - `npm test -- --run tests/mentoria-whatsapp.integration.test.ts`
  - `npm run typecheck`
  - `npm run build`
- Resultado:
  - El router enruta la plataforma Mentoria correcta en el test, valida actor real y devuelve `MENTORIA_WHATSAPP_NOT_READY` como se espera.
- Riesgo residual:
  - El flujo Mentoria sigue marcado como "not ready" hasta implementar la automatizacion completa y checklist QA (`ISSUE-006`).
- Siguiente accion:
  - Diseñar la automatizacion WhatsApp y checklist QA para poder retirar el mensaje `MENTORIA_WHATSAPP_NOT_READY` cuando el flujo este operativo.
- Relacion con issues:
  - `ISSUE-006`

## Checklist al cerrar cada sesion
- [ ] Actualizar `11_current_state.md` si cambio el baseline tecnico.
- [ ] Actualizar el estado de issues en `12_open_issues.md`.
- [ ] Agregar entrada nueva con timestamp real.
- [ ] Validar al menos un flujo critico en `:8787` si hubo cambios de middleware/auth/DB.
- [ ] Dejar siguiente accion explicita para el proximo chat.
