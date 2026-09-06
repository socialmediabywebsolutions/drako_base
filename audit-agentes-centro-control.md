# Auditoría de solo lectura — Mapa de datos por agente para el centro de control

Generado: 2026-08-31 ~17:15 UTC. Todas las cifras de este informe vienen de queries reales ejecutadas contra `saas_socialflows_prod_db` (SOCIAL_DB) vía `wrangler d1 execute --remote`, salvo donde se indica explícitamente que se reutiliza un dato de una auditoría previa sin re-confirmar. Cero escrituras, cero cambios de código.

Tenant piloto Socialcors: `775444ce-5ed0-4e69-864f-dc3e0d886817`, saasId `socialflow`, niche `marketing`, accountType `empresa`.

---

## PARTE A — Estado de `agent_execution_log`

Query ejecutada literalmente:
```sql
SELECT agent_name, status, COUNT(*) as runs, MAX(started_at) as ultima_ejecucion, SUM(rows_written) as total_filas_escritas
FROM agent_execution_log GROUP BY agent_name, status ORDER BY ultima_ejecucion DESC
```

| agent_name | status | runs | última_ejecución | total_filas_escritas |
|---|---|---|---|---|
| TrendAutoApproveCron | success | 10 | 2026-08-31T15:45:35.441Z | 0 |

**Solo 1 de los 26 agentes instrumentados tiene alguna fila: `TrendAutoApproveCron`** (10 ejecuciones, todas `success`, corriendo cada 15min como se espera, 0 filas escritas cada vez — coherente con la causa raíz ya diagnosticada en una auditoría anterior: `socialcors_trend_triggers` sigue en 0 porque la fila `(marketing, empresa)` de niche intelligence no tiene `trendSignals` propios).

**Los otros 25 agentes instrumentados no tienen ninguna fila todavía.** Desglose por qué, según el cron de cada uno:

- **Anomalía real a investigar aparte:** `TrendKeywordAgent`/`TrendTriggerConnector` (cron `*/20min`, vía `/api/cron/social/trend-keywords`) deberían haber corrido ~11 veces desde que se desplegó la instrumentación (~13:29 UTC) hasta ahora (~17:15 UTC) y no tienen ni una fila. No se investiga la causa aquí — está fuera del alcance de esta auditoría de solo lectura — pero es la anomalía más señalable de este informe: el cron de 20 minutos es el que más debería haber logueado y es el único de "alta frecuencia" con cero filas.
- `viral-moment` (cron `0 */4 * * *`, 12 agentes... 1 agente: ViralMomentAgent + processInstagramMetrics): ver Parte B — sus tablas de salida SÍ se actualizaron a las 15:54 UTC hoy (dato real, reciente), un horario que **no coincide con ninguna marca de las 0/4/8/12/16/20h UTC** del cron `0 */4 * * *`. Esto sugiere que esa actualización vino de un disparo manual (botón "Run" del panel operator, o una prueba) y no del cron automático — y ese camino manual, si existe, no pasa por `withAgentExecutionLog`. No confirmado con certeza, es la explicación más consistente con los datos.
- `style-learning`/`seasonality`/`audience-insights`/`seasonal-opportunity`/`churn-prediction` (diario, `0 3 * * *`) y `niche-intelligence`/`influencer-benchmark`/`cross-tenant-intelligence`/`viral-opportunity`/`weekly-briefing`/`best-practices`/`strategic-plan` (semanal, `0 3 * * 1`): su próxima ventana programada desde el deploy de la instrumentación (~13:29 UTC hoy, lunes) es mañana 03:00 UTC (diarios) / el próximo lunes 03:00 UTC (semanales) — **es esperable que no tengan filas todavía**, no es una señal de fallo.

---

## PARTE B — Señal indirecta por agente (tabla propia), por grupo funcional

Queries ejecutadas contra SOCIAL_DB (`COUNT(*)` + `MAX()` de la columna de fecha real de cada tabla, verificada por schema antes de consultar). Columna "Socialcors (tenant)" = segunda query filtrando `WHERE tenant_id = '775444ce-...'`, solo ejecutada para tablas con columna `tenant_id` y `total > 0`.

### Grupo 1 — Tendencias y mercado

| Agente | Tabla | Total filas | Última escritura | Socialcors (tenant) |
|---|---|---|---|---|
| TrendKeywordAgent | `socialcors_niche_intelligence` (compartida, keyed por niche+account_type, sin tenant_id) | 132 | 2026-08-31T11:49:07.021Z | N/A (no tiene tenant_id) |
| NicheIntelligenceCronAgent | `socialcors_niche_intelligence` (misma tabla, ver Parte C para atribución) | 132 | 2026-08-31T11:49:07.021Z | N/A |
| CrossTenantIntelligenceAgent | `socialcors_niche_intelligence.analysis_json.engagementPatterns` (mismo campo dentro de la misma tabla) | — | — | **Re-confirmado ahora mismo: `engagementPatterns` NO está presente en la fila `(marketing, empresa)` ni `(marketing, influencer)`** — `has_engagement_patterns = 0` en ambas. El agente hace `UPDATE ... WHERE id = ?` sobre una fila ya existente y se salta en silencio si no encuentra fila para ese (niche, accountType) — confirmado leyendo `mergeEngagementPatterns()` en el código. No se puede saber desde aquí si nunca corrió o si corrió y no encontró fila que actualizar. |
| ViralOpportunityAgent | `socialflow_intelligence_feed` (`source LIKE 'viral_opportunity:%'`) | **0** | — | 0 |
| ViralMomentAgent | `socialcors_viral_moments` + `socialcors_viral_topic_tracking` | 1 / 44 | **2026-08-31T15:54:33Z** / **2026-08-31T15:54:24Z** (dato fresco, ver anomalía en Parte A) | 0 / N/A (topic_tracking no tiene tenant_id, es por niche+account_type) |
| WeeklyBriefingAgent | `socialcors_briefing_history` | 37 | 2026-08-31T10:15:30.953Z | **6** |
| MarketResearchAgent | Sin tabla propia — no persiste, ver Parte C | — | — | — |

### Grupo 2 — Aprendizaje del cliente

| Agente | Tabla | Total filas | Última escritura | Socialcors (tenant) |
|---|---|---|---|---|
| StyleLearningAgent | `socialcors_style_history` | 12 | 2026-08-31T09:00:26.267Z | **0** |
| VoiceExtractionAgent | `socialflow_knowledge_documents` (`type='voice_profile'`) | 1 | 2026-08-31T09:00:29.005Z | **0** |
| ContentFatigueAgent | `socialflow_intelligence_feed` (`source LIKE 'content_fatigue:%'`) | 2 | 2026-08-31T09:00:19.671Z | **0** |
| EngagementLearningAgent | Sin tabla propia — función pura, sin I/O, ver Parte C | — | — | — |
| BestTimeToPostAgent | Sin tabla propia — función pura sobre `saas_social_posts`, resultado embebido en `socialcors_style_history.snapshot_json.bestHourByFormat` | — | — | — |
| ContentPerformanceAgent | `socialcors_performance_snapshots` | **0** | — | 0 |
| AudienceGrowthAgent | `socialcors_audience_growth` | **0** | — | 0 |
| OptimalPostingScheduleAgent | `socialcors_posting_schedule` | **0** | — | 0 |
| HashtagIntelligenceAgent | `socialcors_hashtag_intelligence` | 1 | 2026-08-31T09:00:28.969Z | **0** |
| SentimentTrendAgent | `socialcors_sentiment_trend` | **0** | — | 0 |

### Grupo 3 — Planificación y estrategia

| Agente | Tabla | Total filas | Última escritura | Socialcors (tenant) |
|---|---|---|---|---|
| StrategicPlanningAgent | `socialcors_strategic_plan` | 3 | 2026-08-31T10:16:07.923Z | **1** |
| ContentSeriesAgent | `socialcors_content_series` | **0** | — | 0 |
| SeasonalOpportunityAgent | `socialcors_seasonal_opportunities` | 3 | 2026-08-31T09:00:53.279Z | **1** |
| BrandConsistencyAgent | `socialcors_brand_consistency` | 1 | 2026-08-31T09:00:29.863Z | **0** |
| ContentDiversityAgent | `socialcors_content_diversity` | 1 | 2026-08-31T09:00:19.389Z | **0** |
| RevenueOpportunityAgent | `socialcors_revenue_opportunities` | **0** | — | 0 |
| BestPracticesAgent | `socialcors_best_practices` | **0** | — | 0 |
| ChurnPredictionAgent | `socialcors_churn_predictions` | 6 | 2026-08-31T09:00:57.918Z | **1** |

### Grupo 4 — Benchmarking y onboarding

| Agente | Tabla | Total filas | Última escritura | Socialcors (tenant) |
|---|---|---|---|---|
| InfluencerBenchmarkAgent | `socialcors_influencer_benchmarks` (keyed por `niche`, sin tenant_id — solo aplica a accountType="influencer", Socialcors es "empresa") | 19 | 2026-08-31T10:14:25.019Z | N/A (no tiene tenant_id; y no aplica a Socialcors por accountType) |
| CompetitorIntelligenceAgent | Sin tabla propia — no persiste, ver Parte C | — | — | — |
| NicheInitializationTrigger | No es un agente de cron — trigger on-demand que escribe en `socialcors_niche_intelligence` (misma tabla del Grupo 1) solo cuando un tenant conecta su primera cuenta social | — | — | — |

### Autónomo

| Agente | Tabla | Total filas | Última escritura | Socialcors (tenant) |
|---|---|---|---|---|
| TrendAutoApproveCron | `socialcors_trend_triggers` | **0** (reconfirmado, causa raíz ya diagnosticada en auditoría previa — no reinvestigada aquí) | — | 0 |

---

## PARTE C — Flujo de datos punto a punto (input → output)

### Grupo 1 — Tendencias y mercado

- **TrendKeywordAgent**: Lee YouTube Data API (`fetchYoutubeHooks`) + Reddit (`fetchRedditTopics`, por subreddit mapeado a nicho) + Google Trends (`fetchGlobalTrends`) → escribe `trendSignals` + `trend_last_fetched` dentro de `socialcors_niche_intelligence.analysis_json` (verificado por código, `src/lib/socialflow/intelligence/TrendKeywordAgent.ts`).
- **NicheIntelligenceCronAgent**: Lee su propia fila previa de `socialcors_niche_intelligence` (incluido `trendSignals` que dejó TrendKeywordAgent) + llama a Mistral (`defaultLocalModel.generateStructured`) → escribe `summary`/`hashtags_json`/`formats_json`/`hooks_json`/`optimal_hours_json`/`fatigue_signals_json` en la misma fila (verificado, `NicheIntelligenceCronAgent.ts`).
- **CrossTenantIntelligenceAgent**: Lee patrones de engagement por tenant (agrupando `socialflow_profiles` por nicho resuelto) → intenta fusionar `engagementPatterns` en la fila de `socialcors_niche_intelligence` ya escrita por NicheIntelligenceCronAgent esa misma semana (**(sin datos aún)** — confirmado que el campo no llegó a escribirse en la fila actual).
- **ViralOpportunityAgent**: Lee `engagementPatterns` (el mismo campo de arriba, que hoy no existe) → escribiría en `socialflow_intelligence_feed` (`source: viral_opportunity:*`) **(sin datos aún)** — coherente con que su prerequisito (CrossTenantIntelligenceAgent) tampoco tiene datos.
- **ViralMomentAgent**: Lee `socialcors_niche_intelligence` (trendSignals de TrendKeywordAgent, vía `getNicheIntelligence`/`extractTrendSignals`) + `saas_social_posts` del tenant → escribe `socialcors_viral_moments` + `socialcors_viral_topic_tracking` (verificado, `ViralMomentAgent.ts`).
- **WeeklyBriefingAgent**: Sintetiza datos de múltiples agentes del Cerebro del tenant esa semana → escribe `socialcors_briefing_history` y lo envía (canal `sent_via`). *(fuente: auditoría previa, no re-verificado línea por línea en este fork)*.
- **MarketResearchAgent**: Lee `socialcors_niche_intelligence` (vía `getNicheIntelligence`) → llama a Mistral con ese contexto → **devuelve el resultado al caller, no persiste nada él mismo** (verificado, `MarketResearchAgent.ts:73-99` — es parte del pipeline on-demand de generación de contenido, no un cron).

### Grupo 2 — Aprendizaje del cliente

- **StyleLearningAgent**: Lee `saas_social_posts` publicados del tenant (gate: ≥10 posts) → escribe snapshot en `socialcors_style_history`. *(auditoría previa)*.
- **VoiceExtractionAgent**: Lee `saas_social_posts` del tenant → escribe `socialflow_knowledge_documents` (`type='voice_profile'`) (verificado, `upsertKnowledgeDocByType(..., type: "voice_profile")`).
- **ContentFatigueAgent**: Lee `socialcors_style_history` reciente del tenant → escribe alertas en `socialflow_intelligence_feed` (`source: content_fatigue:hook` / `:format`) solo si detecta fatiga real. *(auditoría previa)*.
- **EngagementLearningAgent**: Función pura (`computeEngagementPatterns`), sin I/O propio — la usan `StyleLearningAgent` (embebido en su snapshot) y `CrossTenantIntelligenceAgent` (una vez por tenant miembro antes de agregar). Sin tabla de entrada/salida propia (verificado, `EngagementLearningAgent.ts`).
- **BestTimeToPostAgent**: Lee `saas_social_posts`/métricas vía `getRecentPostEngagementByHour` (ventana 90 días) → función pura `computeBestHourByFormat`, el resultado se embebe dentro de `socialcors_style_history.snapshot_json.bestHourByFormat` (verificado, `BestTimeToPostAgent.ts`).
- **ContentPerformanceAgent**: Lee `saas_social_posts`+métricas del tenant → escribiría `socialcors_performance_snapshots` **(sin datos aún)**.
- **AudienceGrowthAgent**: Lee posts/métricas del tenant → escribiría `socialcors_audience_growth` **(sin datos aún)**.
- **OptimalPostingScheduleAgent**: Lee posts/métricas del tenant → escribiría `socialcors_posting_schedule` **(sin datos aún)**.
- **HashtagIntelligenceAgent**: Lee `saas_social_posts` del tenant → escribe `socialcors_hashtag_intelligence` (hashtags sobreusados). *(auditoría previa)*.
- **SentimentTrendAgent**: Lee comentarios/posts del tenant → escribiría `socialcors_sentiment_trend` **(sin datos aún)**.

### Grupo 3 — Planificación y estrategia

- **StrategicPlanningAgent**: 1 llamada a Mistral que sintetiza el snapshot más reciente de cada agente del Cerebro para el tenant → escribe `socialcors_strategic_plan`. *(auditoría previa; sí tiene 1 fila real de Socialcors, confirmado en Parte B)*.
- **ContentSeriesAgent**: Lee posts del tenant buscando series recurrentes → escribiría `socialcors_content_series` **(sin datos aún)**.
- **SeasonalOpportunityAgent**: Calendario fijo de eventos por nicho (San Valentín, Black Friday, etc.) + `socialflow_profiles` → escribe `socialcors_seasonal_opportunities` con countdown 21/14/7 días. *(auditoría previa; 1 fila real de Socialcors confirmada)*.
- **BrandConsistencyAgent**: Lee contenido generado reciente + perfil de marca del tenant → escribe `socialcors_brand_consistency` (alertas de desviación). *(auditoría previa)*.
- **ContentDiversityAgent**: Lee posts recientes del tenant → escribe `socialcors_content_diversity` (score de sobreuso de formato/tema). *(auditoría previa)*.
- **RevenueOpportunityAgent**: Lee snapshots ya persistidos por AudienceGrowthAgent + SentimentTrendAgent en el mismo ciclo (solo accountType="empresa") → escribiría `socialcors_revenue_opportunities` **(sin datos aún — coherente con que sus dos dependencias, AudienceGrowthAgent y SentimentTrendAgent, también están en 0)**.
- **BestPracticesAgent**: Lee snapshots de `ContentPerformanceAgent` de todos los tenants del mismo niche+accountType, compara contra el tenant → escribiría `socialcors_best_practices` **(sin datos aún — coherente con que ContentPerformanceAgent, su fuente, también está en 0)**.
- **ChurnPredictionAgent**: Lee actividad del tenant (días desde último post/login, ratio de rechazo, drafts abandonados) vía `socialflow_profiles` → escribe `socialcors_churn_predictions`. *(auditoría previa; 1 fila real de Socialcors confirmada)*.

### Grupo 4 — Benchmarking y onboarding

- **InfluencerBenchmarkAgent**: Lee YouTube Data API (`fetchTopYoutubeChannels`, top 3 canales por nicho) + Mistral → escribe `socialcors_influencer_benchmarks` (verificado, `InfluencerBenchmarkAgent.ts`). Solo relevante para `accountType="influencer"` — Socialcors es "empresa", así que estructuralmente nunca tendrá fila propia aquí, no es un bug.
- **CompetitorIntelligenceAgent**: Lee `saas_empresa_local` (dirección del negocio) + Google Places API (competidores cercanos reales) + Mistral → **devuelve el resultado al caller, no persiste nada él mismo** (verificado, comentario explícito en el código: "Does NOT persist to the knowledge base itself — callers decide"). Requiere `GOOGLE_MAPS_API_KEY` configurada y dirección geocodificada, o lanza error.
- **NicheInitializationTrigger** (`triggerNicheInitializationOnFirstAccount`): Se dispara cuando un tenant conecta su primera cuenta social (no es cron) → lee el perfil del canal (`getChannelProfile`) → resuelve el nicho a uno de 66 slugs → llama a `generateNicheAnalysis()` (la misma función que usa NicheIntelligenceCronAgent) → escribe en `socialcors_niche_intelligence`. Es fire-and-forget, nunca lanza al caller (verificado, `nicheInitTrigger.ts`).

### Autónomo

- **TrendAutoApproveCron**: Lee `socialcors_trend_triggers` en estado `TRIGGERED` dentro de la ventana de veto de 45min → si no hay veto humano, mueve el post generado a `SCHEDULED` (auto-aprobación) → actualiza `socialcors_trend_triggers.status`. Corre cada 15min (10 ejecuciones confirmadas en Parte A, todas exitosas, 0 filas afectadas porque la tabla de origen sigue vacía — causa raíz ya diagnosticada en auditoría previa: la fila `(marketing, empresa)` de niche intelligence no tiene `trendSignals` todavía).

---

## Resumen ejecutivo

De los ~29 agentes auditados:
- **10 tienen dato real hoy** (de cualquier tenant): TrendKeywordAgent/NicheIntelligenceCronAgent (vía niche_intelligence), ViralMomentAgent, WeeklyBriefingAgent, StyleLearningAgent, VoiceExtractionAgent, ContentFatigueAgent, HashtagIntelligenceAgent, StrategicPlanningAgent, SeasonalOpportunityAgent, BrandConsistencyAgent, ContentDiversityAgent, ChurnPredictionAgent, InfluencerBenchmarkAgent (13 realmente, contando cada tabla con filas >0).
- **De esos 13, solo 5 tienen al menos 1 fila específica del tenant Socialcors**: WeeklyBriefingAgent (6), StrategicPlanningAgent (1), SeasonalOpportunityAgent (1), ChurnPredictionAgent (1) — el resto de agentes con dato global (StyleLearningAgent, VoiceExtractionAgent, ContentFatigueAgent, HashtagIntelligenceAgent, BrandConsistencyAgent, ContentDiversityAgent) tienen **0 filas de Socialcors específicamente**, coherente con que Socialcors no llega al umbral de `MIN_PUBLISHED_POSTS >= 10` que gatea esos crons.
- **9 agentes siguen en cero filas absolutas, para cualquier tenant**: ContentPerformanceAgent, AudienceGrowthAgent, OptimalPostingScheduleAgent, SentimentTrendAgent, ContentSeriesAgent, RevenueOpportunityAgent, BestPracticesAgent, ViralOpportunityAgent, CrossTenantIntelligenceAgent (vía engagementPatterns) — y hay una cadena de dependencia clara: RevenueOpportunityAgent depende de AudienceGrowthAgent+SentimentTrendAgent (ambos en 0), BestPracticesAgent depende de ContentPerformanceAgent (en 0), ViralOpportunityAgent depende de CrossTenantIntelligenceAgent (en 0).
- **5 agentes no tienen tabla propia por diseño**: MarketResearchAgent, EngagementLearningAgent, BestTimeToPostAgent, CompetitorIntelligenceAgent (los 4 son on-demand/función pura, no cron) — no son "agujeros", es su arquitectura.
- **agent_execution_log solo tiene señal de 1 de 26 agentes instrumentados** (TrendAutoApproveCron) — el resto de crons diarios/semanales aún no han llegado a su próxima ventana desde que se desplegó el logging, salvo `trend-keywords` (cron de 20min) que debería tener ~11 ejecuciones registradas y tiene 0 — anomalía real señalada, no investigada más allá en este informe.
