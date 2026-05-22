# P2-34B - Full SocialFlow Independence And Product Capability Audit

Fecha: 2026-05-21

Modo: auditoria local read-only de codigo, rutas, configs, migraciones, tests y documentacion. No se ejecuto cutover, no se publico contenido real, no se tocaron DNS, Workers remotos ni datos remotos.

## Resumen ejecutivo

SocialFlow ya no es solo una idea ni una maqueta: tiene superficie de producto, auth propia, worker/config propios, D1 real para auth/profile/social state, OAuth LinkedIn, validacion segura de conexion, guard de publicacion en la ruta web principal, bloqueo de autopublish en private pilot y evidencia P2-34 PASS.

El dictamen de producto, sin embargo, es mas sobrio: SocialFlow es un runtime funcional controlado, no todavia un SaaS independiente comercial ni la vision canonica avanzada de "social operating system". El producto actual cubre autenticacion, perfil, conexion LinkedIn, campanas, posts, calendario editorial, AI deterministica/stub y exportacion parcial. Las capacidades de inteligencia social, CRM social, sentiment, relationship memory, prediction, experimentation, conversational AI y multi-agent system avanzado estan ausentes, son scaffolding o derivan de datos manuales del perfil.

Nivel actual: **Nivel 2 - runtime funcional controlado**.

Readiness:

| Dictamen | Estado |
| --- | --- |
| socialflow-independent-saas | parcial |
| current-level | 2 |
| private-pilot-ready | no |
| commercial-beta-ready | no |
| canonical-vision-implemented | parcial |
| should-proceed-to-p2-35-real-publish-workflow | no |
| recommended-next-phase | P2-35A SocialFlow Product Pilot Hardening Before Real Publish |

## Fuentes canonicas usadas

- Documento canonico encontrado: `docs/knowledge-pack/08_socialflow_saas_automatizacion_social.md`.
- Documento replacement solicitado no encontrado en el arbol local.
- El documento canonico local define sobre todo frontera de producto/auth, rutas canonicas y separacion con Campamento Base/Mentoria. No contiene en texto local toda la vision avanzada listada en el prompt, por lo que esta auditoria usa:
  - frontera canonica del documento local;
  - vision avanzada indicada por el encargo P2-34B como matriz de producto obligatoria.

Evidencia canonica local:

- `docs/knowledge-pack/08_socialflow_saas_automatizacion_social.md:14` lista superficies funcionales: marketing, auth, workspace, operator social.
- `docs/knowledge-pack/08_socialflow_saas_automatizacion_social.md:25` define auth boundary SocialFlow.
- `docs/knowledge-pack/08_socialflow_saas_automatizacion_social.md:32` diferencia producto SocialFlow de Campamento Base/operator.
- `docs/knowledge-pack/08_socialflow_saas_automatizacion_social.md:39` define frontera de librerias.
- `docs/knowledge-pack/08_socialflow_saas_automatizacion_social.md:48` canoniza OAuth LinkedIn en `/api/socialflow/linkedin/connect` y `/api/socialflow/linkedin/callback`.
- `docs/knowledge-pack/08_socialflow_saas_automatizacion_social.md:52` prohibe usar endpoints Mentoria, exponer operator controls al tenant y reactivar rutas legacy de publicacion.

## Fase 1 - Mapa real de SocialFlow

### UI

| Superficie | Estado | Evidencia | Clasificacion |
| --- | --- | --- | --- |
| Marketing/product page | Existe | `src/app/products/socialflow/page.tsx` | partial |
| Auth producto | Existe | `src/app/socialflow/auth/page.tsx`, `apps/socialflow-runtime/src/app/socialflow/auth/page.tsx` | implemented |
| Workspace principal | Existe | `src/app/socialflow/(workspace)/page.tsx`, `apps/socialflow-runtime/src/app/socialflow/(workspace)/page.tsx` | partial |
| Profile/settings | Existe con persistencia | `src/app/socialflow/(workspace)/profile/page.tsx`, `src/app/api/socialflow/profile/route.ts` | implemented |
| AI page | Existe pero demo/stub | `src/app/socialflow/(workspace)/ai/page.tsx:124`, `apps/socialflow-runtime/src/app/socialflow/(workspace)/ai/page.tsx` | demo-backed |
| Setup | Fail-closed | `src/app/socialflow/(workspace)/setup/page.tsx:6` | missing |
| Planning | Fail-closed | `src/app/socialflow/(workspace)/plan/page.tsx:6` | missing |
| Analysis | Fail-closed | `src/app/socialflow/(workspace)/analysis/page.tsx:6` | missing |
| Sessions | Fail-closed | `src/app/socialflow/(workspace)/sessions/page.tsx:8` | missing |
| Billing | Fail-closed | `src/app/socialflow/(workspace)/settings/billing/page.tsx:14` | missing |
| Team | Read-only/boundary pending | `src/app/socialflow/(workspace)/settings/team/page.tsx` | partial |
| Account | Read-only isolated summary | `src/app/socialflow/(workspace)/settings/account/page.tsx` | partial |
| Ownership | Exists but not product-native transfer | `src/app/socialflow/(workspace)/settings/ownership/page.tsx` | partial |
| Operator social | Internal operator surface | `src/app/operator/socialflow/page.tsx` | implemented |
| Campamento bridge | Redirects to operator | `src/app/campobase/socialflow/page.tsx` | implemented boundary |

### API

| API | Estado | Evidencia | Clasificacion |
| --- | --- | --- | --- |
| `/api/socialflow/auths/registrations` | Existe | `src/app/api/socialflow/auths/registrations/route.ts`, runtime mirror | implemented |
| `/api/socialflow/auths/logins` | Existe | `src/app/api/socialflow/auths/logins/route.ts`, runtime mirror | implemented |
| `/api/socialflow/auths/logouts` | Existe | `src/app/api/socialflow/auths/logouts/route.ts`, runtime mirror | implemented |
| `/api/socialflow/profile` | Existe, tenant checked | `src/app/api/socialflow/profile/route.ts:42`, `:64` | implemented |
| `/api/socialflow/campaigns` | Existe | `src/app/api/socialflow/campaigns/route.ts:9`, `:33`, `:89` | partial |
| `/api/socialflow/posts` | Existe | web guard `src/app/api/socialflow/posts/route.ts:139`; runtime variant `apps/socialflow-runtime/src/app/api/socialflow/posts/route.ts:135` | partial/unsafe |
| `/api/socialflow/ai/generate` | Existe | `src/app/api/socialflow/ai/generate/route.ts:7`, runtime mirror | demo-backed |
| `/api/socialflow/ai/regenerate` | Existe | `src/app/api/socialflow/ai/regenerate/route.ts`, runtime mirror | demo-backed |
| `/api/socialflow/linkedin/connect` | Existe | `src/app/api/socialflow/linkedin/connect/route.ts`, runtime mirror | implemented |
| `/api/socialflow/linkedin/callback` | Existe | `src/app/api/socialflow/linkedin/callback/route.ts`, runtime mirror | implemented |
| `/api/socialflow/linkedin/validate-connection` | Existe | web `src/app/api/socialflow/linkedin/validate-connection/route.ts`; runtime canary scoped `apps/socialflow-runtime/src/app/api/socialflow/linkedin/validate-connection/route.ts:14` | implemented/limited |
| `/api/socialflow/exports/current` | Existe | web `src/app/api/socialflow/exports/current/route.ts`; runtime export `apps/socialflow-runtime/src/lib/socialflow/exports-service.ts` | partial |
| Runtime health/readiness | Existe | `apps/socialflow-runtime/src/app/api/socialflow/runtime/health/route.ts:6`, readiness `:6` | implemented |
| Runtime reharden/key rotation | Existe y testeado | `apps/socialflow-runtime/src/app/api/socialflow/runtime/reharden/route.ts`, `rotate-token-encryption-key/route.ts` | implemented/operator |

### Workers, configs y dominios

| Elemento | Estado | Evidencia |
| --- | --- | --- |
| Worker SocialFlow prod dedicado | Existe | `workers/socialflows/wrangler.workers.toml:1` nombre `saas-socialflows-prod` |
| workers.dev deshabilitado | Existe | `workers/socialflows/wrangler.workers.toml:5` |
| Dominios propios SocialFlow | Existen en config | `workers/socialflows/wrangler.workers.toml:10`, `:14` para `socialflows.drako.systems` y `socialflow.drako.systems` |
| Runtime canary dedicado | Existe | `apps/socialflow-runtime/wrangler.toml:1` nombre `saas-socialflows-runtime-canary` |
| Runtime deploy contract | Existe, inactivo desplegable | `apps/socialflow-runtime/runtime-deploy-contract.json:3` activationState `inactive-deployable` |
| Root shared worker todavia contiene SocialFlow bindings | Existe | `wrangler.workers.toml:31`, `:51` | runtime-shared risk |

### Bindings D1

| Binding | DB | Evidencia | Estado |
| --- | --- | --- | --- |
| `SOCIAL_DB` | `saas_socialflows_prod_db` | `workers/socialflows/wrangler.workers.toml:26`; `apps/socialflow-runtime/wrangler.toml:16` | implemented |
| `SOCIALFLOW_AUTHS_DB` | `saas_socialflow_auths_prod_db` | `workers/socialflows/wrangler.workers.toml:31`; `apps/socialflow-runtime/wrangler.toml:21` | implemented |
| `SAASES_DB` | `saas_socialflows_prod_db` | `workers/socialflows/wrangler.workers.toml:20` | partial/legacy naming |
| `DRACO_DB` | `drako_db_prod` | `apps/socialflow-runtime/wrangler.toml:12` | runtime-shared |

### Secrets requeridos por nombre

No se imprimieron valores de secrets. Nombres inferidos de config y codigo:

- `SOCIALFLOW_AUTHS_SECRET`
- `SOCIALFLOW_TOKEN_ENCRYPTION_SECRET`
- `SOCIALFLOW_TOKEN_ENCRYPTION_NEXT_SECRET`
- `LINKEDIN_CLIENT_ID`
- `LINKEDIN_CLIENT_SECRET`
- `LINKEDIN_REDIRECT_URI`
- `SOCIALFLOW_CANARY_GATE_TOKEN`

Evidencia: `apps/socialflow-runtime/runtime-deploy-contract.json`, `src/lib/socialflow/token-encryption.ts`, `apps/socialflow-runtime/src/lib/socialflow/token-encryption.ts`, `apps/socialflow-runtime/src/middleware.ts:222`.

### Tablas D1 usadas

Auth:

- `socialflow_users`
- `socialflow_credentials`
- `socialflow_sessions`

Evidencia: `migrations/0142_socialflow_auths.sql:6`, `:17`, `:30`.

Social runtime:

- `saas_social_accounts`
- `saas_social_channels`
- `saas_social_campaigns`
- `saas_social_posts`
- `saas_social_metrics`
- `saas_social_channel_ideas`
- `saas_social_channel_knowledge`
- `saas_social_channel_signals`
- `socialflow_runtime_channel_profiles`
- `socialflow_runtime_channel_competitors`
- `socialflow_runtime_channel_assets`
- `socialflow_profiles`

Evidencia: `src/lib/socialflow/repository.ts:34-42`, `apps/socialflow-runtime/src/lib/socialflow/runtime-repository-core.ts:157-164`, `migrations/0184_socialflow_runtime_social_db.sql`, `migrations/0185_socialflow_profiles.sql`.

### Tests existentes relevantes

- `tests/api/socialflow-posts-route.test.ts`
- `tests/api/socialflow-profile-route.test.ts`
- `tests/api/socialflow-linkedin-validate-connection-route.test.ts`
- `tests/lib/socialflow-token-encryption.test.ts`
- `tests/lib/socialflow-private-pilot.test.ts`
- `tests/architecture/socialflow-vertical-boundaries.test.ts`
- `tests/architecture/socialflow-runtime-split-scaffold.test.ts`
- `tests/workers-socialflow-host-fencing.test.ts`
- `tests/workers-socialflow-public-routes.test.ts`
- Runtime route tests: `apps/socialflow-runtime/src/app/api/socialflow/linkedin/validate-connection/route.test.ts`, `runtime/reharden/route.test.ts`, `runtime/rotate-token-encryption-key/route.test.ts`.

### Auditorias P2-27 a P2-34

Evidencia revisada:

- `docs/audits/P2-27-LINKEDIN-OAUTH-REAL-PERSISTENCE.md`
- `docs/audits/P2-28-TOKEN-STORAGE-HARDENING.md`
- `docs/audits/P2-29-CANARY-GATE-ROTATION-AND-LIMITED-TRAFFIC-READINESS.md`
- `docs/audits/P2-30-STAFF-CONTROLLED-LIMITED-TRAFFIC-DRILL.md`
- `docs/audits/P2-30B-STAFF-AUTHENTICATED-LINKEDIN-CAPABILITY-DRY-RUN.md`
- `docs/audits/P2-31-PRODUCTION-CUTOVER-READINESS-AUDIT.md`
- `docs/audits/P2-31C-SOCIALFLOW-PROFILE-D1-PERSISTENCE.md`
- `docs/audits/P2-31E-CONTROLLED-TOKEN-ENCRYPTION-KEY-ROTATION.md`
- `docs/audits/P2-31F-CANARY-DUAL-KEY-REMOTE-ROTATION.md`
- `docs/audits/P2-31G-PRODUCTION-SECRET-PARITY-AND-DEPLOY-PREREQUISITES.md`
- `docs/audits/P2-32-STAFF-ONLY-PRODUCTION-SHADOW-SMOKE.md`
- `docs/audits/P2-33-ONE-TENANT-PRIVATE-PILOT-READINESS.md`
- `docs/audits/P2-33B-ACTIVATE-PRIVATE-PILOT-RUNTIME-GUARDS.md`
- `docs/audits/P2-34-ONE-TENANT-PRIVATE-PILOT-EXECUTION.md`

P2-34 confirma: produccion responde, session staff/admin tenant-bound, profile D1, LinkedIn validate-connection, tokens cifrados, draft post sin publish, scheduler bloqueado, token leakage no, production cutover no.

## Fase 2 - Independencia real como SaaS

| Pregunta | Resultado | Evidencia | Riesgo |
| --- | --- | --- | --- |
| Opera sin Campamento Base | Parcialmente si | rutas `/socialflow/*`, `/api/socialflow/*`; layout dice boundary propio en `src/app/socialflow/(workspace)/layout.tsx:43` | operator/exports todavia leen `DRACO_DB` |
| Depende de Drako como marca | Si | dominios `*.drako.systems`; auth demo email `demo@drako.systems`; runtime contract Drako | branding/ecosistema no separado |
| Depende de Drako como runtime | Parcialmente si | root `wrangler.workers.toml` conserva bindings SocialFlow y `DRACO_DB`; runtime canary usa `DRACO_DB` | runtime compartido |
| Depende de Mentoria | No directo en rutas SocialFlow | canonico prohibe endpoints Mentoria; configs separan `SOCIALFLOW_AUTHS_DB` | root worker aun incluye bindings Mentoria |
| Auth propia | Si | `migrations/0142_socialflow_auths.sql`; runtime auth `apps/socialflow-runtime/src/lib/auth/session.ts` | web app conserva modo local_demo |
| Cookies aisladas | Si | runtime contract cookie `__Host-socialflow_canary_session`; `apps/socialflow-runtime/src/lib/auth/session.ts:20` | pendiente confirmar cookie final para comercial |
| D1 propia/bindings claros | Si, con shared core | `SOCIAL_DB`, `SOCIALFLOW_AUTHS_DB`; runtime tambien `DRACO_DB` | no fully standalone |
| Worker propio | Si | `saas-socialflows-prod`, `saas-socialflows-runtime-canary` | split prod/canary no singular |
| Dominio propio | Si, bajo Drako | `socialflow.drako.systems`, `socialflows.drako.systems` | no dominio independiente de marca |
| Rutas productivas propias | Si | `/socialflow/*`, `/api/socialflow/*` | runtime/web divergencia |
| Configuracion propia | Si | `workers/socialflows/wrangler.workers.toml`, `apps/socialflow-runtime/wrangler.toml` | root config compartida sigue viva |

Dictamen: **operationally independent but runtime-shared / partially independent**.

No es fully independent porque:

- el runtime canary y exportacion dependen de `DRACO_DB`;
- el root worker compartido aun contiene bindings SocialFlow;
- dominios siguen bajo `drako.systems`;
- existe coexistencia web app vs runtime app con comportamiento distinto;
- billing/onboarding/tenant provisioning propio no existe.

## Fase 3 - Matriz contra vision canonica avanzada

| Capability | Status | Evidencia codigo | Evidencia DB | Evidencia UI/API | Tests | Riesgo | Prioridad | Siguiente accion |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1. Knowledge Ingestion Engine | PARTIAL | profile repo normaliza profile/competitors/assets en `src/lib/socialflow/profile/repository.ts`; runtime profile store | `socialflow_profiles`, `socialflow_runtime_channel_profiles`, competitors/assets | Profile UI permite campos manuales; no ingestion real web/PDF/ecommerce/FAQs/social | profile route tests | conocimiento manual, no ingestion engine | P1 | crear ingestion jobs y tablas de sources/chunks |
| 2. Market Intelligence | DEMO | `MarketResearchAgent.ts` devuelve patrones genericos; runtime orchestrator deriva de profile/competitors | competitors en JSON/payload | Profile snapshot muestra market signals | sin tests de inteligencia real | decisiones basadas en datos manuales | P2 | ingestion + competitor snapshots + benchmarks |
| 3. Trend Intelligence | DEMO | `TrendAgent.ts`, runtime `buildTrendInsights` derivan de profile | `marketSignals`, `trendingTopics` en profile | Profile campos manuales; AI page | sin tests de feeds reales | tendencias no reales | P2 | connectors de tendencias por plataforma |
| 4. Keyword Intelligence | PARTIAL | `KeywordAgent.ts`; runtime keyword builder | profile keywords | Profile UI base/priority/long-tail keywords; AI generate | AI basic route tests ausentes | keyword research no valida demanda | P2 | keyword source model + intent scoring |
| 5. Social Audit Engine | PARTIAL | `getSocialAnalyticsSnapshot` en `src/lib/socialflow/repository.ts:79` | `saas_social_metrics` | summary workspace posts/campaigns; no audit diagnostic | repository/API tests parciales | metricas pasivas sin diagnostico | P2 | audit endpoint con diagnostics y gaps |
| 6. Sentiment & Community Analysis | MISSING | no motor de sentiment/DM/comment analysis encontrado | sin tablas sentiment/comments/DMs | sin UI | sin tests | no entiende comunidad | P3 | tablas interactions + sentiment classifier |
| 7. Audience Intent Intelligence | PARTIAL | profile audience/keywords; no intent engine | profile JSON | Profile fields | sin tests | intent manual, no detectado | P2 | intent taxonomy + classifier |
| 8. Lead Intelligence | MISSING | `leads_generated` existe como metric field pero sin lead workflow | `saas_social_metrics.leads_generated` | sin CRM/leads UI | sin tests | no hay leads accionables | P1 | social leads table + lead inbox |
| 9. Conversational AI | MISSING | no comment/DM responder productivo | sin tablas conversaciones | marketing mockup menciona AI response, product no | sin tests | vision incumplida | P3 | comment/DM connector + approval queue |
| 10. Relationship Memory | MISSING | no memory por usuario/conversacion | sin tablas contacts/conversations/memory | sin UI | sin tests | no hay relacion digital acumulada | P3 | relationship hub schema |
| 11. AI Campaign Orchestrator | PARTIAL/DEMO | `SocialFlowOrchestrator.ts`; runtime orchestrator | campaigns/posts/knowledge | `/api/socialflow/ai/generate`; AI page web dice deterministic stub | no robust AI tests | genera contenido sin modelo real ni datos reales | P1 | provider real gated + evals + approvals |
| 12. Learning Engine | MISSING | no aprendizaje de campanas ni global anonimo | sin tablas learning/global/private split | sin UI | sin tests | no mejora con uso | P3 | learning events + tenant/global separation |
| 13. Prediction Engine | MISSING | no viralidad/horarios/fatiga/riesgo | sin prediction tables | sin UI | sin tests | sin prediccion | P3 | prediction service + metrics backfill |
| 14. Autonomous Experimentation | MISSING | no AB testing hooks/CTA | sin experiment tables | sin UI | sin tests | no optimization loop | P3 | experiments schema + assignment/reporting |
| 15. Multi-Agent System | PARTIAL/DEMO | agents existen: MarketResearch, Keyword, Competitor, Strategy, ContentGenerator, Optimization, Scheduler, Trend | work logs no product-native SocialFlow loop | AI output no roles canonicos completos | sin tests multi-agent | nombres y roles no equivalen a system autonomo | P3 | agent registry + task/event logs |
| 16. UX/Dashboard | PARTIAL | workspace dashboard/campaigns/posts/calendar | D1 posts/campaigns | `src/app/socialflow/(workspace)/page.tsx` | component test | dashboard de scheduler, no OS de decisiones | P1 | actionable home: priorities/opportunities/alerts |
| 17. Human Override | PARTIAL/UNSAFE | PATCH approve/reject/schedule; web publish guard | post status | Pipeline editorial click-to-advance; web confirmPublish | posts guard tests | runtime POST puede intentar publish sin confirmacion explicita | P0 | unificar runtime guard con web guard |
| 18. Relationship Hub / CRM Social | MISSING | no CRM social | sin contacts/leads/conversations | sin UI | sin tests | no cumple vision relacional | P1 | lead/relationship hub MVP |

Conclusiones de vision:

- PASS real solo en frontera/auth/profile/LinkedIn/draft-safe flow.
- PARTIAL en profile knowledge, campaign/post workflow, metrics basicas, AI orchestrator scaffolding y human review parcial.
- DEMO en AI, market/trend/keyword intelligence.
- MISSING en CRM social, sentiment, conversational AI, relationship memory, learning, prediction, experimentation y multi-agent avanzado.
- UNSAFE relativo en divergencia runtime publish guard.

## Fase 4 - Auditoria de datos y persistencia

### Usa D1 real

- Auth SocialFlow: `socialflow_users`, `socialflow_credentials`, `socialflow_sessions`.
- Profile: `socialflow_profiles` y runtime channel profile store.
- LinkedIn/social accounts: `saas_social_accounts`.
- Campanas/posts: `saas_social_campaigns`, `saas_social_posts`.
- Metrics: `saas_social_metrics`.
- Knowledge/signals: `saas_social_channel_knowledge`, `saas_social_channel_signals`.

### Demo/in-memory/fallback

- AI web usa modelo deterministic stub: `src/lib/socialflow/ai/models/localModel.ts:15`.
- Cloudflare provider placeholder sin llamada real: `src/lib/socialflow/ai/models/CloudflareProvider.ts:9`.
- Runtime AI provider deterministico: `apps/socialflow-runtime/src/lib/socialflow/ai/provider.ts:10`.
- AI page web declara demo/stub y persiste demo campaign/posts: `src/app/socialflow/(workspace)/ai/page.tsx:124`.
- Runtime scheduler simulation devuelve solo `{ ok: true }`: `apps/socialflow-runtime/src/lib/socialflow/posts-repository.ts:308`.
- Export runtime usa identidad fallback si falta seed SaaS: `apps/socialflow-runtime/src/lib/socialflow/exports-service.ts:144-147`.
- Web auth server conserva `local_demo`: `src/lib/socialflow/auth/server.ts:25`.

### Runtime schema creation

Riesgo: repositorios crean/alteran schema en runtime, lo que puede ocultar drift de migraciones.

- Web repo: `src/lib/socialflow/repository.ts:34-51`.
- Runtime repo: `apps/socialflow-runtime/src/lib/socialflow/runtime-repository-core.ts:157-168`.

### Tenant safety

Fortalezas:

- La mayoria de queries productivas filtran por `tenant_id` y `saas_id`.
- Profile route rechaza tenant mismatch: `src/app/api/socialflow/profile/route.ts:45`, `:71`.
- Runtime session valida tenant contra auth user: `apps/socialflow-runtime/src/lib/auth/session.ts:40-55`.
- Export runtime valida scope de filas devueltas: `apps/socialflow-runtime/src/lib/socialflow/exports-service.ts:72-90`.

Riesgos:

- `getSaasSocialPostById` en web filtra por tenant y post id, pero no por `saas_id`: `src/lib/socialflow/repository.ts:99`. Despues algunas metricas usan `post.saasId`, lo que reduce mezcla en lecturas posteriores, pero el lookup inicial podria cruzar SaaS dentro del mismo tenant si IDs colisionan o se usan manualmente.
- `claimScheduledPostForPublishing` filtra por tenant y status, pero no por `saas_id`: `src/lib/socialflow/repository.ts:73`.
- Runtime POST simplificado puede intentar publicacion live sin `confirmPublish`: `apps/socialflow-runtime/src/app/api/socialflow/posts/route.ts:135-168`.
- Export runtime contiene una query de dossier que trae todos los campos de la fila: `apps/socialflow-runtime/src/lib/socialflow/exports-service.ts:159-166`. No se ejecuto en esta auditoria; se marca para hardening por principio de minimo dato.

## Fase 5 - Auditoria de seguridad

### PASS / fortalezas

- Auth boundary SocialFlow propia: `src/lib/socialflow/auth/request.ts`, runtime `apps/socialflow-runtime/src/lib/auth/session.ts`.
- Tenant isolation validada contra claims/header/user: `src/lib/socialflow/auth/server.ts:52-66`, runtime `apps/socialflow-runtime/src/lib/auth/session.ts:40-55`.
- Runtime middleware exige session para rutas no publicas y setea headers tenant: `apps/socialflow-runtime/src/middleware.ts:151-163`, `:192`, `:287`.
- Canary gate existe para hosts configurados: `apps/socialflow-runtime/src/middleware.ts:222-275`.
- Validate-connection runtime esta limitado a canary tenant y saas: `apps/socialflow-runtime/src/app/api/socialflow/linkedin/validate-connection/route.ts:14-17`, `:125-149`.
- Token encryption soporta cifrado/decrypt/rotacion dual key; tests en `tests/lib/socialflow-token-encryption.test.ts` y runtime rotation tests.
- Web publish guard exige `confirmPublish=true`, admin, allowlist, cuenta real, sin validation error, token cifrado y prevalidacion LinkedIn: `src/app/api/socialflow/posts/route.ts:139-230`.
- Private pilot autopublish bloqueado: `src/lib/socialflow/scheduler.ts:53`.
- P2-34 confirma no leakage de campos sensibles de token/metadata de auth: `docs/audits/P2-34-ONE-TENANT-PRIVATE-PILOT-EXECUTION.md:91-99`, `:132-139`.

### Riesgos / gaps

- Divergencia de guard: runtime `POST /api/socialflow/posts` intenta live publish para contrato simplificado no programado sin campo `confirmPublish`: `apps/socialflow-runtime/src/app/api/socialflow/posts/route.ts:135-168`.
- Runtime live publish decrypta tokens legacy plaintext por compatibilidad: `apps/socialflow-runtime/src/lib/socialflow/linkedin/publishing.ts:30-31`; validate-connection lo reporta sin filtrar, pero publish deberia requerir cifrado en camino productivo.
- Web auth conserva `local_demo` por header: `src/lib/socialflow/auth/server.ts:25-33`.
- Export puede generar paquete con fallback de identidad si falta seed SaaS: `apps/socialflow-runtime/src/lib/socialflow/exports-service.ts:144-147`.
- Operator/product boundary existe, pero operator page usa componente interno `SocialAutomationControl`: `src/app/operator/socialflow/page.tsx:1`; se debe mantener fuera de tenant UI.

## Fase 6 - Auditoria UX/producto

Lo que un usuario puede hacer hoy:

- Autenticarse en `/socialflow/auth`.
- Entrar a workspace protegido.
- Crear campanas.
- Crear posts y verlos en lista/calendario/pipeline.
- Avanzar estado editorial con UI basica.
- Configurar perfil de marca/audiencia/keywords/competidores de forma manual.
- Conectar y validar LinkedIn en flujo controlado.
- Generar campana AI en modo deterministico/demo.
- Guardar draft sin publicar.

Evidencia:

- Workspace principal carga campaigns/posts via `/api/socialflow/*`: `src/app/socialflow/(workspace)/page.tsx:35-38`.
- CTA primer post: `src/app/socialflow/(workspace)/page.tsx:105-114`.
- Summary cards y calendario: `src/app/socialflow/(workspace)/page.tsx:118-122`, `:195-203`.
- Pipeline editorial: `src/app/socialflow/(workspace)/page.tsx:204-230`, `:268-323`.
- Profile UI cubre brand identity, audience, keywords, competitors y market signals: `src/app/socialflow/(workspace)/profile/page.tsx:104`, `:214`, `:271`, `:304`, `:338-358`.

Gaps UX:

- Setup, planning, analysis y sessions estan fail-closed.
- Billing no esta conectado.
- No hay onboarding guiado de tenant cliente.
- No hay lectura clara de "que hago ahora" segun estado real de cuenta.
- El dashboard es mas scheduler/editorial que decision engine.
- No hay UX separada empresa vs influencer.
- No hay inbox social, leads, relaciones, sentiment, learning, predictions ni experiments.
- AI page expone JSON crudo, util para staff/dev pero no para cliente final.

## Fase 7 - Readiness comercial

| Pregunta | Estado | Evidencia |
| --- | --- | --- |
| Cliente puede entrar y entender que hacer | Parcial | workspace CTA y forms, pero setup fail-closed |
| Puede configurar marca | Si | Profile page + `/api/socialflow/profile` |
| Puede conectar LinkedIn | Si, controlado | LinkedIn connect/callback/validate |
| Puede generar contenido | Si, demo/stub | AI generate deterministic |
| Puede revisarlo | Parcial | pipeline status y PostList |
| Puede guardar draft | Si | P2-34 draft post validado |
| Puede aprobar publicacion segura | Parcial | web guard si, runtime divergence no |
| Tiene metricas o learning | Metricas parciales, learning no | `saas_social_metrics`, no learning engine |
| Hay bloqueo por falta de datos | Si | advanced intelligence depende de profile/manual data |
| Hay pricing/billing/plan | No | billing page fail-closed |
| Hay onboarding tenant cliente | No | setup fail-closed |

Dictamen comercial: **no private-pilot-ready para cliente real externo**. Si se define "private pilot" como staff-only tecnico controlado, P2-34 PASS puede continuar en modo interno. Para un piloto real con cliente, falta onboarding, billing/plan, guard unificado y capacidades minimas de insights/CRM.

## Fase 8 - Clasificacion final

Escala:

- Nivel 0: demo.
- Nivel 1: skeleton funcional.
- Nivel 2: runtime funcional controlado.
- Nivel 3: private pilot usable.
- Nivel 4: limited beta.
- Nivel 5: production-ready comercial.
- Nivel 6: vision canonica avanzada.

Estado actual real: **Nivel 2**.

Justificacion:

- Supera Nivel 1 por auth real, D1 real, LinkedIn OAuth/validation, drafts y guards.
- No llega a Nivel 3 porque onboarding, billing, analysis/planning/setup, UX de cliente, publish guard runtime y advanced product loop no estan listos.
- No llega a Nivel 4/5 porque falta comercializacion, planes, soporte de tenants externos, observabilidad producto y hardening de divergencias runtime.
- No llega a Nivel 6 porque la mayoria de capabilities canonicas avanzadas estan missing/demo.

## Fase 9 - Roadmap de cierre P0-P4

### P0 - Bloquea independencia/seguridad

| Objetivo | Archivos/rutas probables | DB/migraciones | Tests | Validacion | Riesgo |
| --- | --- | --- | --- | --- | --- |
| Unificar publish guard web/runtime: `confirmPublish=true`, admin, allowlist, token cifrado, validate prepublish | `apps/socialflow-runtime/src/app/api/socialflow/posts/route.ts`, `apps/socialflow-runtime/src/lib/socialflow/live-publishing-service.ts`, web route como referencia | none | runtime posts route tests + existing web posts tests | draft no publica; publish sin confirmacion bloquea | publicacion accidental |
| Bloquear plaintext token en runtime publish | `apps/socialflow-runtime/src/lib/socialflow/linkedin/publishing.ts`, token encryption helpers | none | add encrypted/plaintext publish tests | plaintext fail closed | compat legacy puede romper |
| Eliminar o feature-gate `local_demo` en SocialFlow prod path | `src/lib/socialflow/auth/server.ts` | none | auth server tests | prod no acepta demo header | dev workflows afectados |
| Asegurar lookup por `tenant_id + saas_id + id` en post operations | `src/lib/socialflow/repository.ts`, runtime parity | none | repository/API tests cross-saas same tenant | no cross-SaaS row read | regression en IDs legacy |
| Quitar fallback silencioso de export o convertirlo en hard error para piloto comercial | `apps/socialflow-runtime/src/lib/socialflow/exports-service.ts` | seed required | export tests | sin SaaS seed -> error explicito | exports de staff pueden fallar |

### P1 - Bloquea piloto real

| Objetivo | Archivos/rutas probables | DB/migraciones | Tests | Validacion | Riesgo |
| --- | --- | --- | --- | --- | --- |
| Onboarding cliente minimo | `/socialflow/setup`, `/api/socialflow/profile`, profile services | extend `socialflow_profiles` or onboarding table | e2e setup | cliente llega a first value sin staff | scope creep |
| Product-native billing/plan read model | `/socialflow/settings/billing`, auth/account routes | plans/subscriptions table or Stripe mapping | billing page tests | plan visible y no cross-product | compliance |
| Relationship Hub MVP | new `/socialflow/leads` or `/relationships` | `socialflow_contacts`, `socialflow_leads`, `socialflow_interactions` | API + UI tests | lead create/update scoped | data model churn |
| Actionable dashboard | workspace home | metrics/insights table | component/API tests | muestra next steps por estado | UX confusion |
| AI provider real behind safe config | AI service/orchestrator/provider | ai_runs/evals table | provider contract tests | real generation gated and logged | cost/safety |

### P2 - Bloquea beta comercial

| Objetivo | Archivos/rutas probables | DB/migraciones | Tests | Validacion | Riesgo |
| --- | --- | --- | --- | --- | --- |
| Market/competitor intelligence real | profile + intelligence APIs | competitor_snapshots, market_signals | integration tests with fixtures | benchmarks reproducibles | external APIs |
| Social audit engine | `/analysis` | social_audits, post_metrics snapshots | audit tests | diagnostics by tenant | metric availability |
| Team invites/roles | settings/team + auths | invitations/roles tables | authz tests | role lifecycle isolated | privilege escalation |
| Export hardening/min-data | exports service | none | export scope tests | no broad fields, no fallback silent | data portability gaps |
| Production observability product view | operator + product status | incidents/events | observability tests | customer-safe status | leaking internals |

### P3 - Bloquea vision avanzada

| Objetivo | Archivos/rutas probables | DB/migraciones | Tests | Validacion | Riesgo |
| --- | --- | --- | --- | --- | --- |
| Sentiment/community analysis | new ingestion/interactions service | comments, dms, sentiment_scores | classifier/eval tests | emotions/intents per interaction | privacy |
| Conversational AI approvals | inbox/community manager | replies, approvals, policy logs | workflow tests | human approval before response | accidental response |
| Learning engine | campaigns/metrics/AI logs | learning_events, tenant_patterns, global_patterns | privacy separation tests | tenant private vs global anon split | data leakage |
| Prediction engine | analytics/prediction service | predictions, model_versions | backtest tests | viral/hour/fatigue predictions | false confidence |
| Experimentation engine | posts/campaigns | experiments, variants, assignments, outcomes | AB tests | automatic learning from outcomes | sample size |
| Multi-agent canonical roles | orchestrator/agent registry | agent_tasks, agent_work_logs product scoped | agent contract tests | roles Brand Strategist, Market Analyst, etc. | runaway autonomy |

### P4 - Mejora moat/escala

| Objetivo | Archivos/rutas probables | DB/migraciones | Tests | Validacion | Riesgo |
| --- | --- | --- | --- | --- | --- |
| Multi-platform connectors | linkedin core + new providers | social_accounts per provider | provider contract tests | LinkedIn + others normalized | provider policy |
| Trend source mesh | intelligence workers | trend_sources/chunks | source tests | fresh trend snapshots | source drift |
| Global anonymized benchmarks | learning engine | anonymized aggregates | privacy tests | no tenant reidentification | compliance |
| Enterprise audit logs | runtime/auth/operator | audit_logs | security tests | complete traceability | volume/cost |
| Domain/brand independence | deployment configs/marketing | none | smoke tests | non-Drako domain optional | migration effort |

## Brechas principales

### Contra vision canonica

- Falta ingestion real de conocimiento desde webs/PDF/ecommerce/FAQs/redes.
- Inteligencia de mercado/tendencias/keywords existe como formulario y generacion deterministica, no como sistema con fuentes vivas.
- No hay social CRM, relationship memory, conversational AI ni sentiment.
- No hay learning engine, prediction engine ni experimentation loop.
- El multi-agent system no cubre los roles canonicos completos ni opera autonomamente sobre eventos.
- La UI no es todavia un operating system de decisiones; es mayormente scheduler/editorial dashboard.

### Tecnicas

- Coexisten web app y runtime app con divergencias.
- Runtime publish guard no iguala al guard web.
- Runtime schema auto-creation puede esconder drift.
- Algunos lookups web no filtran `saas_id` en la primera consulta.
- Export runtime tiene fallback de identidad.
- Root worker shared conserva bindings SocialFlow.

### UX

- Setup, planning, analysis, sessions y billing estan no cableados.
- AI page muestra JSON crudo.
- No hay onboarding guiado ni estado de cuenta accionable.
- No hay distincion empresa/influencer.
- No hay inbox social/leads/relationship hub.

### Comerciales

- No hay billing productivo.
- No hay plan/pricing operativo.
- No hay onboarding tenant cliente.
- No hay beta-ready support surface.
- No hay evidencia de metricas/learning suficiente para promesa comercial avanzada.

## Recomendacion sobre P2-35

No recomiendo avanzar directamente a **P2-35 controlled real publish approval workflow** como real publish externo.

Motivo: P2-34 demostro flujo tecnico controlado, pero P2-34B detecta que la ruta runtime tiene un comportamiento de publicacion distinto al guard web, y que el producto no esta listo para piloto real de cliente. Ejecutar real publish ahora aumentaria riesgo operativo sin resolver la divergencia de seguridad.

Recomendacion exacta:

**P2-35A SocialFlow Product Pilot Hardening Before Real Publish**

Objetivo de P2-35A:

- unificar guard de publicacion web/runtime;
- bloquear tokens plaintext en publish runtime;
- cerrar local_demo/fallbacks en produccion;
- endurecer tenant+saas query scope;
- habilitar onboarding minimo, status de cuenta y review humana clara;
- definir "private pilot usable" con un cliente real sin publicar automaticamente.

## Dictamen final

- `socialflow-independent-saas: parcial`
- `current-level: 2`
- `private-pilot-ready: no`
- `commercial-beta-ready: no`
- `canonical-vision-implemented: parcial`
- `major-blockers: runtime publish guard divergence; onboarding/setup missing; billing missing; CRM/relationship hub missing; advanced intelligence mostly demo/missing; web/runtime split not fully unified; some fallback/demo paths remain`
- `should-proceed-to-p2-35-real-publish-workflow: no`
- `recommended-next-phase: P2-35A SocialFlow Product Pilot Hardening Before Real Publish`
