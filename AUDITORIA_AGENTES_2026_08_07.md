# Auditoría de solo lectura — Agentes, Servicios de Inteligencia y Sistemas IA de Socialcors

**Fecha:** 2026-08-07
**Alcance:** Auditoría de solo lectura (no se modificó ningún archivo). Cubre agentes IA, servicios de inteligencia, crons, keywords/SEO, extracción de voz del cliente, contenido técnico por nicho e integración con Instagram Graph API.

**Árbol fuente de verdad confirmado:** `src/lib/socialflow/` (última modificación real: 4-7 ago 2026, wired a rutas API activas). `src/lib/social/ai/` (sin "flow") es una copia legacy — nadie la importa (`grep` de `@/lib/social/ai` no arroja resultados fuera de sí misma); es código muerto, no una variante en producción. `apps/socialflow-runtime/` y `workers/socialflow-ai-worker/` sí son relevantes: el worker de la cola (`workers/socialflow-ai-worker/src/index.ts`) importa el **mismo** `SocialFlowOrchestrator` de `src/lib/socialflow/ai/` vía ruta relativa — no es una copia paralela, es el mismo código fuente ejecutándose como consumidor de cola. `apps/socialflow-runtime/src/lib/socialflow/ai/orchestrator.ts` sí parece ser una reimplementación aparte (`RuntimeSocialAIPipelineInput`) — no se investigó en profundidad por estar fuera del alcance pedido, pero no aparece referenciada desde ninguna ruta API real de `src/app/api/socialflow/`.

---

## 1. AGENTES

Todos en `src/lib/socialflow/ai/agents/` (13 archivos):

- ✅ **CarouselComposerAgent.ts** — Compone el arco narrativo completo de un carrusel (intro/desarrollo/cierre_cta) en una sola llamada a Mistral, intercalando fotos reales y slides generados por IA. Usado en `posts/generate-ai-carousel/route.ts`, `carousel/regenerate-slide/route.ts`, `campaigns/[id]/photos/route.ts`, `posts/generate-from-image/route.ts`.
- ✅ **CompetitorAgent.ts** — Genera patrones de competencia vía LLM puro (sin datos reales), usado por `SocialFlowOrchestrator.generateFullCampaign`/`generateStrategyOnly`, que a su vez corre en `workers/socialflow-ai-worker` (consumidor de cola) y en `posts/generate-from-image`.
- ✅ **CompetitorIntelligenceAgent.ts** — Distinto del anterior: geocodifica la dirección del negocio, llama a Google Places (`searchNearbyCompetitors`) para traer competidores reales cercanos, y pide a Mistral un informe de posicionamiento. Wired a `knowledge/analyze-local-competitors/route.ts`, y esa ruta sí tiene botón en UI (`empresa/local/local-client.tsx`).
- ✅ **ContentGeneratorAgent.ts** — Genera el caption/post final; integra `NicheIntelligenceService` (tendencias del nicho + detección de fatiga de contenido). Corazón del pipeline, usado en `SocialFlowOrchestrator`, `generate-from-image`, `campaigns/[id]/photos`.
- ✅ **ImageAnalysisAgent.ts** — Analiza la foto subida con Mistral Small 3.1 24B (visión), extrae `specificContext`, `momentType`, `employeeDetected`. Usado en `generate-from-image`, `generate-ai-carousel`, `campaigns/[id]/photos`, y consumido internamente por `ContentGeneratorAgent`/`CarouselComposerAgent`.
- ✅ **KeywordAgent.ts** — Genera clusters de keywords/hashtags (awareness/consideration/conversion) vía LLM, sembrado con `baseKeywords`/`priorityKeywords` del perfil manual. Usado en `SocialFlowOrchestrator` y `generate-from-image`.
- ⚠️ **MarketResearchAgent.ts** — Se instancia en `SocialFlowOrchestrator` (`private marketResearch = new MarketResearchAgent()`) pero **`.run()` nunca se llama en ningún punto del código real** (confirmado por grep — cero ocurrencias de `marketResearch.run` fuera de la declaración). Es código muerto: existe, está importado, pero nunca se invoca.
- ✅ **OptimizationAgent.ts** — Reescribe/optimiza el texto generado, fuerza 10-15 hashtags y añade el CTA de objetivo al final. Usado en `SocialFlowOrchestrator`, `generate-from-image`, `campaigns/[id]/photos`, y dentro de `ContentGeneratorAgent`/`CarouselComposerAgent`.
- ✅ **ProfileChatAgent.ts** — Chat guiado por bloques (identidad/nicho/audiencia/negocio/competidores/objetivos) para completar el perfil del cliente. Usado en `profile/chat/route.ts`, con UI en `ProfileAiChat.tsx`.
- ✅ **SchedulerAgent.ts** — Calcula slots de publicación (determinista, sin IA) evitando colisiones con posts ya programados. Usado en `SocialFlowOrchestrator.generateFullCampaign`.
- ✅ **StrategyAgent.ts** — Diseña la estrategia de N posts (tema/ángulo/CTA/formato por día). Usado en `SocialFlowOrchestrator` y `ReelsAgent.ts`.
- ✅ **StyleLearningAgent.ts** — Analiza hasta 30 posts publicados del tenant, extrae patrones de hook/hashtags/temas recurrentes, guarda snapshot en `socialcors_style_history` y sobreescribe el doc de KB `auto_learned_style`. Corre vía cron diario `/api/cron/social/style-learning`.
- ✅ **TrendAgent.ts** — Genera tendencias/ángulos virales/horas óptimas vía LLM. Usado en `SocialFlowOrchestrator`, `ContentGeneratorAgent`, `CarouselComposerAgent`, `KeywordAgent`.

**Nota adicional:** `SocialFlowOrchestrator.generateStrategyOnly()` está definido pero **sin ningún caller** en todo el repo (solo `generateFullCampaign` y `generateSinglePost` tienen callers reales) — código muerto de menor severidad.

---

## 2. SERVICIOS DE INTELIGENCIA

Carpeta `src/lib/socialflow/intelligence/`:

- ✅ **NicheIntelligence** (`NicheIntelligenceService.ts` + `NicheIntelligenceCronAgent.ts`) — Caché cross-tenant (no por cliente) de "qué está funcionando esta semana" por nicho: hashtags, formatos, hooks, horas óptimas, señales de fatiga. Genera vía LLM para 55 nichos predefinidos (`NICHE_INTELLIGENCE_NICHES`). **Tabla `socialcors_niche_intelligence`** (migración `workers/socialflows/migrations/0207_cerebro_phase1.sql`, ajustada en `0208`). INSERT/UPDATE confirmados en `upsertNicheIntelligence()` (`NicheIntelligenceCronAgent.ts:109-146`). Lectura real en `ContentGeneratorAgent.ts:78`, `ViralScoreAgent.ts:127`, `WeeklyBriefingAgent.ts:232`. **Conectado al flujo real de generación de contenido.**
- ✅ **StyleLearning** (`StyleLearningAgent.ts`, dentro de `ai/agents/` pero registrado como servicio de "Cerebro") — Ver sección 5 (detalle completo). **Tabla `socialcors_style_history`** (misma migración 0207). INSERT confirmado en `saveStyleSnapshot()` (`NicheIntelligenceService.ts:160-197`), llamado desde `StyleLearningAgent.ts:191`.
- ✅ **ViralScore** (`ViralScoreAgent.ts`) — Evalúa un post ANTES de publicarse (1-10) usando hook/hashtags/formato/timing/alineación de nicho, cruzando `NicheIntelligence` + detección de fatiga. Nunca lanza excepción: degrada a score neutro 5.0. **No tiene tabla propia** — es cálculo en caliente, no persiste resultados en DB. Usado en `posts/generate-from-image/route.ts:621` y `campaigns/[id]/photos/route.ts:563` (dentro del flujo real de generación). **Conectado.**
- ❌ **VoiceExtraction** — No existe ningún símbolo, archivo ni clase `VoiceExtractionAgent` (ni con ninguna variante de nombre) en todo el repo. Ver sección 5.
- ✅ **KeywordEngine** — No es un "servicio" separado sino el tipo de salida (`KeywordEngineOutput`) de `KeywordAgent.ts`. Ver sección 1/4.
- ✅ **TrendAgent** — Ver sección 1 (agente, no servicio de intelligence/).
- ❌ **ContentValue** — No existe ningún archivo/símbolo con este nombre en el repo.
- ⚠️ **MarketAnalysis** — No existe como servicio/clase, pero sí como **tipo de documento de Knowledge Base** (`type: "market_analysis"`) que escribe `CompetitorIntelligenceAgent` vía `upsertKnowledgeDocByType` en `analyze-local-competitors/route.ts:57`. Es un dato dentro de la KB del cliente, no un motor de análisis de mercado independiente.
- ❌ **CompetitorAnalysis** — No existe como símbolo de código; solo aparece como texto en `onboarding/checklistRepository.ts` (ítem de checklist, no lógica).

---

## 3. CRONS ACTIVOS

⚠️ **Importante:** `./wrangler.workers.toml` (raíz del repo) está marcado explícitamente como legacy en su propia línea 2: *"LEGACY/ARCHIVED: deploy oficial usa exclusivamente workers/\*/wrangler.workers.toml via --config en CI/CD"* — y efectivamente **no contiene ningún bloque `[triggers]`/`crons`**. El deploy real de Socialcors usa `workers/socialflows/wrangler.workers.toml`, cuyo bloque es:

```
[triggers]
crons = ["*/5 * * * *", "0 3 * * *", "0 3 * * 1"]
```

El handler `scheduled()` real se inyecta post-build vía `scripts/patch-socialflow-cron-handler.mjs` (parchea `.open-next/socialflows-standalone/worker.js`):

- ✅ **`*/5 * * * *`** (cada 5 min) → `GET /api/cron/social` (`processScheduledPosts` en `src/lib/socialflow/scheduler.ts` — publica posts programados vía `publishSocialPostLive`, y además dispara `processDeferredInstagramMetrics` al final de cada tick) **y** `GET /api/cron/social/comments` (lee comentarios recientes de Instagram y responde automáticamente con IA — `src/app/api/cron/social/comments/route.ts`).
- ✅ **`0 3 * * *`** (diario, 03:00 UTC) → `GET /api/cron/social/style-learning` → `StyleLearningAgent.run()` por tenant.
- ✅ **`0 3 * * 1`** (semanal, lunes 03:00 UTC) → `GET /api/cron/social/niche-intelligence` (`runNicheIntelligenceCron` — refresca las 55 filas de `socialcors_niche_intelligence`) seguido de `GET /api/cron/social/weekly-briefing` (`runWeeklyBriefingForAllTenants`).

⚠️ **Hallazgo:** existe la ruta `src/app/api/cron/social/metrics/route.ts` (`processInstagramMetrics` — backfill completo de insights de cuenta + medios para TODAS las cuentas de Instagram conectadas), pero **no aparece en ningún `case` del patch script** — no está enganchada a ningún disparador cron real. Solo la variante acotada `processDeferredInstagramMetrics` (posts publicados hace 15min-2h) corre automáticamente, como efecto secundario del cron de cada 5 min. La ruta `/api/cron/social/metrics` existe pero está desconectada de cualquier disparador automático — solo se ejecutaría si alguien la llama manualmente.

---

## 4. KEYWORDS Y SEO

No existe integración con ninguna API externa de SEO/investigación de keywords (se buscó Google Trends, SEMrush, Ahrefs, SerpApi, tendencias de TikTok — cero resultados).

Lo que sí existe:
- `src/lib/socialflow/ai/agents/KeywordAgent.ts` — genera 3 clusters (awareness/consideration/conversion) **puramente vía prompt a Mistral**, sembrado con `profile.baseKeywords`/`priorityKeywords`/`baseHashtags` — campos que el cliente llena manualmente en el perfil (o que `ProfileChatAgent` propone/infiere durante el onboarding conversacional).
- `src/lib/socialflow/intelligence/NicheIntelligenceCronAgent.ts` — sí es un sistema real (aunque también generado por LLM, no datos de búsqueda reales) de hashtags/formatos/hooks "en tendencia" por nicho, cacheado semanalmente en `socialcors_niche_intelligence` y consumido por `ContentGeneratorAgent` y `ViralScoreAgent`.

**Conclusión:** no hay ningún motor de keywords/SEO basado en datos reales de búsqueda (volumen, dificultad, CPC). Todo el input de "keywords" es: (a) manual desde el perfil del cliente, o (b) generado por LLM sin fuente de datos externa verificable — ni siquiera desconectado, simplemente no existe como concepto en este codebase.

---

## 5. VOZ DEL CLIENTE

❌ **`VoiceExtractionAgent` no existe.** ⚠️ **`StyleLearningAgent` sí existe y es lo más cercano**, pero funciona distinto a lo que su nombre podría sugerir — no es una extracción de "voz/tono" en sentido estilístico profundo, sino un análisis estadístico/heurístico de patrones:

**Qué hace exactamente** (`src/lib/socialflow/ai/agents/StyleLearningAgent.ts`), paso a paso:
1. **Input:** `tenantId`, `saasId`.
2. Trae hasta 30 posts publicados más recientes (`status IN ('POSTED','PUBLISHED')`) vía `listSaasSocialPosts`.
3. Para cada post, trae sus métricas más recientes (`listSaasSocialMetricsForPost`) y calcula engagement = likes+comments+shares.
4. **Longitud media de caption** — promedio simple de caracteres.
5. **Clasificación de hooks** — heurística por regex sobre la primera línea de cada post (`classifyHook`): "lista numerada", "pregunta directa", "revelación/secreto", "condicional/advertencia", "anuncio directo", "afirmación directa". Cuenta frecuencias, toma el top-3.
6. **Hashtags top** — extrae hashtags de `metadata.hashtags` + regex sobre el body, calcula engagement promedio por hashtag, ordena y toma top-10.
7. **Temas recurrentes** — tokeniza el body, filtra stopwords en español/inglés, cuenta frecuencia de palabras de 4+ letras, toma top-8.
8. **Mejores horas** — agrupa engagement por hora UTC de publicación, toma las 3 mejores.
9. Construye un resumen determinista (`baseSummary`) con todos estos datos, y le pide a Mistral que lo **reescriba en prosa natural** (sin inventar cifras nuevas — instrucción explícita en el prompt).
10. **Output:** guarda el resumen como documento de KB tipo `auto_learned_style` (sobreescribe siempre — `upsertKnowledgeDocByType`), **y además** guarda un snapshot histórico en `socialcors_style_history` vía `saveStyleSnapshot` (hasta 12 snapshots por tenant, usado por `detectContentFatigue` para avisar si el mismo patrón de hook se repite 3 veces seguidas).
11. **Dónde se usa el output:** el doc de KB (`auto_learned_style`) se inyecta en `longDescription`/knowledge context leído por `getKnowledgeContext` (usado por `SocialFlowOrchestrator.buildProfile`, que alimenta a todos los agentes de generación). El historial (`socialcors_style_history`) alimenta `detectContentFatigue` en `ContentGeneratorAgent` y `ViralScoreAgent`.

**Corre vía cron diario** `0 3 * * *` → `/api/cron/social/style-learning`.

Es decir: analiza posts pasados y extrae patrones estadísticos de hooks/hashtags/horarios/temas — no un análisis lingüístico de "tono de voz" propiamente dicho (no analiza vocabulario personal, muletillas, estructura de frases del cliente en sí). No hay ningún otro agente que haga eso.

---

## 6. CONTENIDO TÉCNICO POR NICHO

❌ **No existe ningún motor que genere datos técnicos reales por nicho** (series/repeticiones para fitness, calorías/macros para recetas, clima/temperatura para viajes, etc.). Se buscó explícitamente: `calorías`, `macros`, `series y repeticiones`, `clima`, `temperatura`, `weather`, `nutritional` — sin resultados de lógica real.

Lo que existe es solo **clasificación de categoría visual** en `ImageAnalysisAgent.ts` (líneas 168-172): el prompt de visión pide identificar la categoría (gym/fuerza, cuerdas/funcional, cocina/nutrición, running/outdoor, otras) y extraer un "detalle concreto" — pero con una **regla explícita anti-invención** (`ImageAnalysisAgent.ts:176`): *"si no puedes identificar con claridad un dato concreto... NUNCA lo inventes ni des una cifra exacta que no puedas ver"*. Es decir, el sistema está deliberadamente diseñado para **no fabricar** datos técnicos (kilómetros exactos, ejercicio exacto, etc.) cuando no son visualmente verificables, en vez de tener un motor que los calcule o busque.

`ContentGeneratorAgent.ts` sí tiene un hardcodeo de hashtags específicos de fitness (`fitnessNicheKeys`, líneas 111-118) pero es solo una lista fija de hashtags, no contenido técnico generado.

---

## 7. INSTAGRAM GRAPH API

Implementación real en `src/lib/socialflow/meta/` (no existe `src/lib/socialflow/instagram/` como paquete completo — solo `instagram/oauth.ts` para el flujo OAuth `instagram_business_login`).

**Endpoints implementados hoy:**

- ✅ **Publicación de contenido** — `src/lib/socialflow/meta/publishing.ts`:
  - `POST {apiBase}/{igUserId}/media` — crea contenedor de imagen/reel/story/carrusel (`publishInstagramContent`, línea 372; child containers de carrusel, línea 207).
  - `POST {apiBase}/{igUserId}/media` con `media_type=CAROUSEL` y `children` — contenedor padre de carrusel (línea 270).
  - `POST {apiBase}/{igUserId}/media_publish` — publica el contenedor (líneas 307 y 430).
  - `POST {FB_GRAPH_BASE}/{pageId}/photos` o `/feed` — publicación en Facebook Page (`publishFacebookPageContent`, línea 503).
- ✅ **OAuth / autenticación** — `meta/core.ts`: intercambio de código por token corto→largo (`exchangeMetaCodeForAccessToken`), listado de páginas (`fetchMetaPages` → `GET /me/accounts`), resolución de la cuenta de Instagram Business vinculada a una página (`fetchInstagramBusinessAccount` → `GET /{pageId}?fields=instagram_business_account{id,username}`).
- ✅ **Se lee el historial de posts del cliente:** SÍ. `fetchInstagramRecentMedia()` (`meta/core.ts:588`) → `GET /{igUserId}/media?fields=id,timestamp,like_count,comments_count&limit=25`. Se usa tanto en el cron de comentarios como en `metrics-collector.ts` para matchear posts publicados con sus métricas.
- ✅ **Se leen métricas/insights:** SÍ, dos niveles:
  - Nivel cuenta: `fetchInstagramAccountInsights()` (`meta/core.ts:550`) → `GET /{igUserId}/insights?metric=impressions,reach&period=day...` + `GET /{igUserId}?fields=followers_count`.
  - Nivel medio individual: `fetchInstagramMediaInsights()` (`meta/core.ts:622`) → `GET /{mediaId}/insights?metric=impressions,reach,saved,shares`.
  - Persistidas en `saas_social_metrics` vía `processInstagramMetrics()`/`processDeferredInstagramMetrics()` (`meta/metrics-collector.ts`).
- ✅ **Se leen comentarios:** SÍ. `fetchInstagramComments()` (`meta/comments.ts:37`) → `GET /{mediaId}/comments?fields=id,text,username,timestamp&limit=50`. Usado en el cron de auto-respuesta (`/api/cron/social/comments`), que además analiza sentimiento (`analyzeSentiment`) y genera respuestas con IA (`generateConversationalReply`).
- ✅ **Se responde a comentarios:** `replyToInstagramComment()` (`meta/comments.ts:82`) → `POST /{commentId}/replies`.

Todos estos endpoints están conectados al flujo real (crons activos de sección 3 + rutas de publicación/OAuth en `src/app/api/socialflow/`), no son código huérfano.

---

## Pendiente / fuera de alcance

- `apps/socialflow-runtime/src/lib/socialflow/ai/orchestrator.ts` — reimplementación paralela (`RuntimeSocialAIPipelineInput`) no auditada en profundidad; no aparece referenciada desde ninguna ruta API real de `src/app/api/socialflow/`, pero merece una pasada dedicada para confirmar que no está en uso.
