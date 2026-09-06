# Datos reales escritos por los agentes — muestra de contenido (solo lectura)

Generado: 2026-08-31 ~17:30 UTC, contra `saas_socialflows_prod_db` (SOCIAL_DB) vía `wrangler d1 execute --remote`. Cero escrituras.

**Nota de corrección:** varios nombres de tabla/columna de la petición original no existen en el schema real. Antes de ejecutar corrí `PRAGMA table_info(...)` sobre las 10 tablas para confirmar los nombres reales, y ejecuté las queries corregidas (marcadas abajo). Correcciones aplicadas:

| Pedido | Real |
|---|---|
| `socialcors_weekly_briefings` | `socialcors_briefing_history` |
| `socialcors_strategic_plans` | `socialcors_strategic_plan` (singular) |
| `socialcors_style_profiles` | `socialcors_style_history` |
| `trend_signals_json` (columna) | no existe — va embebido en `analysis_json.trendSignals` |
| `content` (briefing) | `briefing_json` |
| `plan_json` | `snapshot_json` |
| `style_json` | `snapshot_json` |
| `analysis_json` (hashtag/brand/diversity) | `snapshot_json` (solo `niche_intelligence` usa `analysis_json` de verdad) |
| `prediction_json` | `snapshot_json` |
| `moment_json` | `snapshot_json` |
| `series_json` | `snapshot_json` |
| `detected_at` (viral_moments) | `created_at` |
| `socialcors_niche_intelligence.tenant_id` | no existe — la tabla está keyed por `(niche, account_type)`, sin tenant_id |

---

## Q1/Q2 — `socialcors_niche_intelligence`: contenido real de `analysis_json`

5 filas más recientes (todas del cron semanal `NicheIntelligenceCronAgent`, no de Socialcors específicamente ya que esta tabla no tiene tenant_id):

- **educacion / empresa** (`trend_last_fetched: 2026-08-31T11:49:07Z`): *"El nicho de educación en Instagram para el mercado hispanohablante está experimentando un auge significativo, especialmente en contenido interactivo y visual. Las marcas y negocios locales están aprovechando los Reels y los Stories para ofrecer micro-lecciones..."*
- **lifestyle / empresa** (`11:49:05Z`): *"...auge en contenido visualmente atractivo y auténtico... estilos de vida sostenibles, bienestar y viajes locales..."*
- **fitness / empresa** (`11:49:04Z`): *"...auge en contenido interactivo y educativo... rutinas personalizadas y consejos de nutrición... carruseles informativos y videos en vivo..."*
- **academia_oposiciones / empresa** (`trend_last_fetched: null` — nunca corrió TrendKeywordAgent para esta fila): *"...crecimiento significativo, con un enfoque creciente en contenido interactivo y educativo... colaboración con influencers del sector educativo..."*
- **academia_oposiciones / influencer** (`trend_last_fetched: null`): *"...uso de Reels y Stories para captar la atención... hooks personales y storytelling..."*

Muestra adicional (Q2, 3 filas con `analysis_json` no nulo — fitness/restauracion/lifestyle, todas accountType `influencer`): mismo patrón de `summary` en español, generado por Mistral, específico por nicho.

## Q10 — `trendSignals` dentro de `analysis_json` (lo que escribe TrendKeywordAgent)

3 nichos con `trendSignals` embebido, con hashtags reales asociados:

- **fitness / influencer** — hashtags: `#FitnessMotivation, #EntrenamientoEnCasa, #NutriciónSaludable, #GymLife, #FitnessChallenge, #EntrenamientoFuncional...` (19 hashtags reales)
- **restauracion / influencer** — hashtags: `#RecetasFaciles, #CocinaCasera, #Foodie, #ChefEnCasa, #DeliciasDeLaCasa...`
- **lifestyle / influencer** — hashtags: `#LifestyleEspañol, #VidaSaludable, #ModaSostenible, #DecoraciónDeInteriores, #BienestarMental...`

Estos son datos reales y recientes — pero **todos con `account_type: 'influencer'`**, ninguno `empresa` (que es el accountType de Socialcors). Consistente con el hallazgo ya conocido: la fila `(marketing, empresa)` de Socialcors sigue sin `trendSignals`.

## Q3 — `socialcors_briefing_history` (WeeklyBriefingAgent), tenant Socialcors real

```json
{"tenantId":"775444ce-5ed0-4e69-864f-dc3e0d886817","saasId":"socialflow","period":"semana del 24 de agosto al 31 de agosto","niche":"marketing","topPerformingPosts":[],"worstPerformingPosts":[],"contentMix":{},"followerChange":{"current":null,"capturedAt":null,"change":null},"nicheTrends":{"hashtags"...
```
Real, con el periodo correcto — pero `topPerformingPosts`/`worstPerformingPosts` vacíos y `followerChange` en null, porque Socialcors no tiene posts publicados reales todavía. El briefing es honesto: estructura real, contenido vacío donde no hay datos fuente.

## Q4 — `socialcors_strategic_plan` (StrategicPlanningAgent), tenant Socialcors real

```json
{"monthlyObjective":"Establecer una base sólida de contenido en el nicho de marketing.","priorities":["Crear y publicar contenido educativo sobre estrategias de marketing efectivas.","Utilizar hooks en tendencia para captar la atención de la audiencia.","Publicar al menos 3 veces por semana para comenzar a construir una rutina de contenido."],"keyOpportunity":"Aprovechar las tendencias actuales del nicho para generar contenido relevante y atractivo.","alert":null,"executiveSummary":"Tu cuenta es...
```
Plan real, coherente con una cuenta nueva sin actividad — recomienda "publicar al menos 3 veces por semana para comenzar", no inventa métricas que no existen.

## Q5/Q6/Q7/Q8/Q13 — Sin datos de Socialcors (confirmado, no es error de query)

`socialcors_style_history`, `socialcors_hashtag_intelligence`, `socialcors_brand_consistency`, `socialcors_content_diversity`, `socialcors_content_series` — las 5 devolvieron `"results": []` para `tenant_id = '775444ce-...'`. Coherente con la auditoría anterior: estas tablas SÍ tienen filas (de otros tenants/pilotos), pero **cero para Socialcors**, porque su cron (`style-learning`, diario) exige `≥10 posts publicados` y Socialcors no llega a ese umbral.

## Q9 — `socialcors_churn_predictions` (ChurnPredictionAgent), tenant Socialcors real

```json
{"churnRiskScore":70,"riskFactors":["Sin publicar hace 9999 días","Sin iniciar sesión hace 14 días"],"daysSinceLastPost":9999,"daysSinceLastLogin":14}
```
Dato real — pero **"9999 días sin publicar" tiene toda la pinta de ser un valor centinela/default** (no un cálculo real de fecha), no `daysSinceLastLogin: 14` que sí parece calculado de verdad. Nota de calidad de dato, no investigada más a fondo — fuera del alcance de esta consulta.

## Q11 — `agent_execution_log`, últimas 15 filas reales

| agent_name | status | started_at | rows_written |
|---|---|---|---|
| TrendAutoApproveCron | success | 17:15:35 | 0 |
| TrendAutoApproveCron | success | 17:00:35 | 0 |
| TrendAutoApproveCron | success | 16:45:35 | 0 |
| TrendAutoApproveCron | success | 16:30:35 | 0 |
| TrendAutoApproveCron | success | 16:15:35 | 0 |
| TrendAutoApproveCron | success | 16:00:35 | 0 |
| **ViralMomentAgent** | **success** | **15:54:17** | **6** |
| TrendAutoApproveCron | success | 15:45:35 | 0 |
| TrendAutoApproveCron | success | 15:30:35 | 0 |
| TrendAutoApproveCron | success | 15:15:35 | 0 |
| TrendAutoApproveCron | success | 15:00:35 | 0 |
| TrendAutoApproveCron | success | 14:45:35 | 0 |
| TrendAutoApproveCron | success | 14:30:35 | 0 |
| TrendAutoApproveCron | success | 14:15:35 | 0 |
| TrendAutoApproveCron | success | 14:00:35 | 0 |

**Corrección a un hallazgo anterior de esta misma sesión:** dije antes que `ViralMomentAgent` no pasaba por la instrumentación — **es falso, esta query lo desmiente**. SÍ hay una fila real, `status: success`, `rows_written: 6`, capturada por `withAgentExecutionLog`. Lo que sigue sin explicación es el horario (15:54:17, no coincide con ninguna marca de `0 */4 * * *` = 00/04/08/12/16/20h UTC) y por qué es la única vez que aparece. Sigo investigando esto en paralelo (ver conversación).

`TrendAutoApproveCron` corre perfecto cada 15min exactos (worker `socialflow-ai-worker`, separado de `socialflows-prod`) — confirma que los Cron Triggers de Cloudflare funcionan bien en general; el problema está aislado al dispatcher de `socialflows-prod`.

## Q12 — `socialcors_viral_moments`, única fila real

```json
{"viralMoments":[],"alertsGenerated":0}
```
tenant_id: `ea85eb95-3c1e-4192-a2de-333bba37b842` — **no es Socialcors** (`775444ce-...`). Es un tenant/piloto distinto. Y el contenido, aunque real, está vacío (`viralMoments: []`) — el agente corrió, no encontró ningún momento viral, y lo registró honestamente. El `rows_written: 6` de `agent_execution_log` no corresponde a "6 momentos virales" sino probablemente a 6 topics evaluados/trackeados internamente (no confirmado, requeriría leer `ViralMomentAgent.ts` línea por línea, fuera de alcance aquí).

---

## Ampliación — mismos agentes, contenido real de OTROS tenants (donde Socialcors está vacío)

Para las tablas donde Socialcors no tiene ninguna fila (todas gateadas por `≥10 posts publicados`, umbral que Socialcors no alcanza), esto es lo que el mismo agente SÍ escribió para otro tenant piloto (`ea85eb95-3c1e-4192-a2de-333bba37b842`, nicho fitness) — confirma que la lógica funciona con datos reales cuando el gate se cumple:

**StyleLearningAgent** (`socialcors_style_history`, 30 posts analizados):
```json
{"postsAnalyzed":30,"avgCaptionLength":515,"topHookPatterns":["afirmación directa","anuncio directo"],"topHashtags":[{"tag":"#fitnessparamujeres","avgEngagement":0,"uses":30},{"tag":"#vidasaludable","avgEngagement":0,"uses":30},{"tag":"#mujerfit","avgEngagement":0,"uses":29}...
```

**HashtagIntelligenceAgent** (`socialcors_hashtag_intelligence`):
```json
{"overusedHashtags":["#fitnessparamujeres","#vidasaludable","#fitnessmotivacion","#habitossaludables","#saludybienestar","#nutricionsaludable","#entrenamientofemenino","#vidafit","#mujerfit","#fitnesslatina","#bienestarfemenino","#fitness"],"recommendedMix":{"niche":["#FitnessMotivacion","#FitnessEspañol","#FitnessChallenges","#FitnessMental","#FitnessLatino"],"trending":["#EntrenamientoEnCasa",...
```
Detecta que el tenant repite los mismos 12 hashtags siempre y recomienda una mezcla nueva — real, accionable.

**BrandConsistencyAgent** (`socialcors_brand_consistency`):
```json
{"avgConsistencyScore":85,"lowScorePosts":[],"alert":false,"recommendation":"Tu contenido reciente generado por IA es coherente con tu marca — sigue así."}
```

**ContentDiversityAgent** (`socialcors_content_diversity`):
```json
{"formatDiversity":{"distribution":{"FEED":8,"STORY":2},"alert":true,"recommendation":"Llevas 8 de tus últimos 10 posts en formato Post — es momento de publicar un Carrusel o un Historia para variar."},"topicDiversity":{"alert":false,"recommendation":"Tus temas recientes son lo bastante variados."},"overallDiversityScore":50}
```
Alerta real y específica (8 de 10 en el mismo formato), no genérica.

**InfluencerBenchmarkAgent** (`socialcors_influencer_benchmarks`, niche `videojuegos_streaming`, vía YouTube Data API real):
```json
{"topChannels":[{"name":"elbebéSSJ","subscribers":1120,"avgViews":1023,"topHooks":["todo el día🔥| !tts para chat de voz | Código \"elbebe\" en la tienda",...]},{"name":"El Mundo de Andy","subscribers":37,"avgViews":1473,"topHooks":["😱 El negocio millonario detrás de sus videos","😱 De YouTuber a MILLONARIO"]}],"insight":"Los hooks qu...
```
Canales de YouTube reales, con nombres, suscriptores y hooks reales extraídos de títulos de video reales — no placeholders.

**SeasonalOpportunityAgent** para Socialcors específicamente (confirmando la fila real que sí tiene):
```json
{"upcomingOpportunities":[]}
```
Vacío pero real — hoy no hay ningún evento estacional dentro de la ventana de 21 días para el nicho marketing.

---

## Conclusión de esta muestra

Los datos que SÍ existen son genuinamente reales (nichos correctos, hashtags reales, planes coherentes con el estado real de la cuenta, sin métricas inventadas) — no hay evidencia de datos placeholder o mockeados en ninguna tabla consultada. El patrón dominante para Socialcors específicamente es: **estructura real + contenido vacío/neutral**, porque el tenant no tiene actividad real todavía (0 posts publicados) — eso es honesto, no un bug. Los gaps reales (tablas en 0 para cualquier tenant) coinciden exactamente con lo ya diagnosticado en la auditoría de mapeo anterior.
