# Auditoría — Cerebro (NicheIntelligence), Dashboard e Insights

**Fecha:** 2026-08-09
**Tipo:** Auditoría de solo lectura (D1 vía `wrangler d1 execute --remote` + lectura de código). No se modificó nada.
**Base de datos verificada:** `saas_socialflows_prod_db` (binding `SOCIAL_DB`, producción real — no la canary).

---

## AUDITORÍA 1 — Pipeline global del cerebro

Verificar que fuentes externas (YouTube, Reddit, Google Trends) alimentan NicheIntelligence y que llega al prompt de Mistral para cualquier cliente.

### 1. TrendKeywordAgent — ¿ha corrido?

Sí, activamente. Última corrida: **2026-08-09 04:19 UTC** (niche `running`). Refrescos escalonados recientes también para `mascotas`, `mindfulness`, `finanzas_personales`, `humor`, `musica`, `gaming`, `belleza`.

```
SELECT niche, trend_last_fetched, hooks_json FROM socialcors_niche_intelligence
WHERE trend_last_fetched IS NOT NULL ORDER BY trend_last_fetched DESC LIMIT 10;
```

Resultado (niche, trend_last_fetched):
- running — 2026-08-09T04:19:19.211Z
- mascotas — 2026-08-09T02:59:47.110Z
- mindfulness — 2026-08-09T00:57:09.543Z
- finanzas_personales — 2026-08-08T23:46:07.908Z
- humor — 2026-08-08T23:01:00.253Z
- musica — 2026-08-08T22:28:52.853Z
- gaming — 2026-08-08T21:58:45.841Z
- belleza — 2026-08-08T21:20:30.829Z

Esto confirma el diseño de `src/lib/socialflow/intelligence/TrendKeywordAgent.ts:49` (`runTrendKeywordCron`): un nicho por invocación (el más desactualizado primero), aproximadamente cada 20 minutos. Con 55 nichos, una vuelta completa tarda ~18.3h.

### 2. NicheIntelligence fitness — fitness

La fila existe con datos reales:
- `hooks_json`: 8 hooks en español.
- `hashtags_json`: 19 hashtags.
- `analysis_json.trendSignals`:
  - `youtubeHooks`: 10 títulos reales de YouTube Shorts (gym fails, calisthenics, workouts).
  - `redditTopics`: 10 hilos reales de r/fitness (Rant Wednesday, Moronic Monday, Physique Phriday...).
  - `globalTrends`: 10 búsquedas reales de Google Trends España (swansea vs birmingham, vuelta a burgos 2026, real madrid...).
  - `fetchedAt`: 2026-08-08T13:59:24.854Z, `youtubeDegraded: false`.

### 3. Puntos exactos de inyección al prompt de Mistral

| Archivo | Línea | Qué inyecta |
|---|---|---|
| `src/lib/socialflow/ai/agents/ContentGeneratorAgent.ts` | 79 | `getNicheIntelligence(profile.niche, dracoEnv, input.tenantId, input.saasId)` |
| `src/lib/socialflow/ai/agents/ContentGeneratorAgent.ts` | 96 | `nicheIntelSection` — inyecta `nicheIntel.hashtags`, `nicheIntel.formats`, `nicheIntel.hooks`, `realHashtagValues` |
| `src/lib/socialflow/ai/agents/CarouselComposerAgent.ts` | 291-293 | mismo `getNicheIntelligence(...)` |
| `src/lib/socialflow/ai/agents/CarouselComposerAgent.ts` | 406-407, 421 | `nicheIntelSection` inyectado en el prompt final |
| `src/lib/socialflow/reels/ReelsAgent.ts` | — | **No hay ninguna.** El archivo no importa `NicheIntelligenceService`. |

**Hallazgo crítico A — ReelsAgent no usa NicheIntelligence en absoluto.**
`ReelsAgent.ts` solo tiene un prompt (línea 594) que decide configuración técnica del vídeo (`effects`, `colorGrade`, `filmGrain`, música) a partir de `profile.niche` y `profile.brandIdentity` — cero hooks, hashtags o trends. Si el copy/caption del Reel se genera vía `ContentGeneratorAgent` por separado esto podría ser intencional (división de capas), pero los hooks de tendencia nunca llegan a la decisión de formato/efectos del Reel.

**Hallazgo crítico B — `trendSignals` (YouTube+Reddit+Trends) es prácticamente "solo escritura".**
`extractTrendSignals`/`trendSignals` no aparece en ninguno de los 3 agentes de generación de contenido. Solo se usa en:
- `TrendKeywordAgent.ts` (quien lo escribe).
- `NicheIntelligenceCronAgent.ts:138-140` — donde `realHooks` (solo `youtubeHooks`, hasta 8) sobrescribe `hooks_json` si existen.

De las 3 fuentes, solo **YouTube** realmente influye en lo que llega al prompt (vía `hooks_json`). `redditTopics` y `globalTrends` se capturan, se guardan en `analysis_json.trendSignals`, y ahí mueren: nunca se mezclan en `hashtags_json`/`formats_json` ni se inyectan directamente al prompt de Mistral. Tampoco alimentan el prompt del propio `NicheIntelligenceCronAgent` (`buildNicheAnalysisPrompt`, línea 93-109): ese prompt le pide al LLM que "imagine" tendencias sin pasarle los datos reales de Reddit/Trends como contexto.

### 4. buildProfile()/getNicheIntelligence() — ¿tenantId+saasId o solo string?

Recibe ambos correctamente:

```ts
// NicheIntelligenceService.ts:198-203
export async function getNicheIntelligence(
  rawNiche: string, env: Env, tenantId?: string, saasId?: string,
): Promise<NicheIntelligence | null>
```

`tenantId`/`saasId` se usan en `resolveNicheSlug()` (línea 160) para cachear el slug normalizado en el perfil del canal (`normalizeNiche`, con 3 niveles: exacto → regex parcial → clasificación por Mistral).

**Importante:** `socialcors_niche_intelligence` no tiene columnas `tenant_id`/`saas_id` — es una tabla **global por nicho**, compartida entre todos los tenants con el mismo `niche` normalizado (diseño intencional, comentado en el código: "cross-tenant, aggregated cache… not scoped to a single tenant on purpose, ver migración 0207"). `tenantId`/`saasId` solo sirven para resolver qué nicho normalizado usar, no para filtrar filas.

Schema real de la tabla:
```sql
CREATE TABLE socialcors_niche_intelligence (
  id TEXT PRIMARY KEY, niche TEXT NOT NULL,
  analysis_json TEXT NOT NULL DEFAULT '{}', hashtags_json TEXT NOT NULL DEFAULT '[]',
  formats_json TEXT NOT NULL DEFAULT '[]', hooks_json TEXT NOT NULL DEFAULT '[]',
  optimal_hours_json TEXT NOT NULL DEFAULT '[]', fatigue_signals_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  valid_until TEXT NOT NULL, trend_last_fetched TEXT
)
```

---

## AUDITORÍA 2 — Dashboard (influencer y empresa)

### 5. `(workspace)/page.tsx` — endpoint del dashboard

No llama a un endpoint HTTP: es un Server Component que llama directamente a funciones de repositorio (`src/app/socialflow/(workspace)/page.tsx:38-41`):

```ts
[summary, leadsCount] = await Promise.all([
  getSocialProductSummary(ctx),
  countLeadsSince(ctx, thirtyDaysAgoIso),
]);
```

### 6. Deduplicación (fix #722) y lectura de leads

Sí, está aplicada correctamente. `getSocialAnalyticsSnapshot` (`repository.ts:130`) usa `GROUP BY post_id` con `MAX(captured_at)` sobre `saas_social_metrics`, exactamente el patrón esperado. `countLeadsSince` sí lee de `socialflow_leads`.

**Causa raíz de las tarjetas vacías — no es la query, son los datos:**
- `socialflow_leads`: **0 filas en toda la base de datos** (`SELECT COUNT(*) → 0`). No hay ningún lead capturado nunca, para ningún tenant.
- `saas_social_metrics`: 99 filas totales, pero solo **2 `post_id` distintos**, y ambos son snapshots de tipo `account:<id>` (métricas de cuenta: seguidores, alcance agregado). **Cero filas con `post_id` de un post real.** Por tanto `getSocialAnalyticsSnapshot`/`buildAnalyticsWindow` siempre suman sobre un conjunto vacío de métricas por post → Impresiones/Engagement por post quedan en 0 aunque la query esté bien escrita.

### 7. Empresa vs influencer

Mismo dashboard. `page.tsx` es único; la única rama condicional por tipo de cuenta es el `EmpresaChecklist` (línea 51-58, `session.accountType === "empresa"`). `DashboardMetrics` recibe los mismos campos (`summary`, `auditScore`, `leadsCount`) sin distinción por tipo de cliente.

---

## AUDITORÍA 3 — Insights (métricas reales)

### 8. `/api/socialflow/insights/route.ts`

Delega en `getSocialInsightsSnapshot(ctx)` (`repository.ts:155-242`). Query de métricas (líneas 162-169):

```sql
SELECT post_id, MAX(captured_at) as captured_at, likes, comments, metadata
FROM saas_social_metrics
WHERE tenant_id = ? AND saas_id = ? AND captured_at >= ?
GROUP BY post_id ORDER BY captured_at DESC
```

Dedup correcta (ventana de 35 días). `reach`, `saved`, `plays` se leen del JSON de `metadata` (líneas 179-182), no de columnas propias — la tabla `saas_social_metrics` solo tiene columnas para `impressions/likes/comments/shares/clicks`.

### 9. "Alcance por formato"

`weeklyFormatBreakdown` (líneas 204-219): agrupa por 4 buckets semanales, sumando `metric.reach` por `content_type` (línea 215: `point[post.contentType] += metric.reach`). El campo existe y la query es correcta, pero como en Auditoría 2, no hay datos que sumar.

**Causa raíz — por qué reach/saved/plays = 0 pero followers = 18 sí funciona:**

Verificación de `saas_social_posts` para las dos cuentas conectadas:
- Cuenta `sofiamarenfit` (MEDIA_CREATOR, 18 followers, tenant `ea85eb95-3c1e-4192-a2de-333bba37b842`): 1 solo post `POSTED` con `external_post_id`, y es de tipo **STORY** (2026-08-03).
- Cuenta `info.drako.systems` (BUSINESS, 4 followers, tenant `socialflow-core`): 3 posts `FEED` `POSTED` con `external_post_id` válido, de junio 2026.
- **Ninguna de las dos cuentas tiene jamás una fila en `saas_social_metrics` con `post_id` real** (`SELECT COUNT(*) WHERE post_id NOT LIKE 'account:%' → 0` para ambas).

El pipeline que debería llenar esto es `processInstagramMetrics()` en `src/lib/socialflow/meta/metrics-collector.ts:154-340`. El flujo por post (líneas 246-308):

```ts
const media = await fetchInstagramRecentMedia(pageToken, igUserId, apiBase).catch((e) => {
  logMetaMetricsError("recent_media", account.id, accountType, e);
  return [];   // línea 246-249 — falla en silencio
});
...
for (const item of media.slice(0, 10)) {   // línea 254
  const { results: matchingPosts } = await socialDb.prepare(
    `SELECT id, saas_id, content_type FROM saas_social_posts WHERE tenant_id = ? AND external_post_id = ? LIMIT 1`
  ).bind(account.tenant_id, item.id).all();
  if (!matchingPosts?.length) continue;   // línea 264 — nunca escribe métricas si no matchea
  ...
}
```

`fetchInstagramRecentMedia` llama al edge `/{ig-user-id}/media` (`meta/core.ts:634`), que **no incluye Stories** en absoluto — eso explica por qué la cuenta con solo un STORY nunca tiene métricas por post. Pero la segunda cuenta tiene 3 posts FEED reales y tampoco tiene ni una fila — esto apunta a que `fetchInstagramRecentMedia` está fallando silenciosamente (el `.catch(() => [])` traga el error sin re-lanzarlo, solo lo loguea) para ambas cuentas por igual, dejando `media = []` siempre, de modo que el loop de matching nunca se ejecuta. Las escrituras de nivel-cuenta (`upsertSaasSocialMetrics` con `postId: account:<id>`, líneas 224-243 y 310-330) sí ocurren porque no dependen de `fetchInstagramRecentMedia` — de ahí que followers/reach de cuenta funcionen y el resto no.

**Diagnóstico:** el bug no está en las queries de dashboard/Insights (ambas deduplican y calculan correctamente) ni en NicheIntelligence — está en la captura de métricas por post en `processInstagramMetrics`, específicamente en `fetchInstagramRecentMedia` fallando silenciosamente o no matcheando nunca ningún `external_post_id`. Para confirmarlo con certeza haría falta revisar los logs de Cloudflare del cron (`[MetricsCron] endpoint=recent_media...`), no accesibles desde esta auditoría.

### 10. Qué falta para mostrar cada elemento pedido

- **Gráfico likes+comentarios por formato:** no existe ni el dato ni el componente. `weeklyFormatBreakdown` solo acumula `reach` (línea 215); habría que añadir acumuladores de `likes`/`comments` por `content_type` y un componente nuevo (no hay ningún `LikesCommentsByFormatChart` en `insights/_components/`).
- **Gráfico visualizaciones (plays) por formato:** tampoco existe. `plays30d` se calcula global (línea 196, solo para `REEL`), pero no hay desglose por formato ni componente de gráfico. Los únicos componentes en `insights/_components/` son `ReachByFormatChart.tsx`, `FollowerGrowthChart.tsx`, `InsightsSummaryCards.tsx`, `TopPostsList.tsx`.
- **Datos reales en Alcance/Guardados/Plays:** requiere arreglar la causa raíz descrita en el punto 9. Sin filas reales por post en `saas_social_metrics`, ningún cálculo del lado del código puede producir un número distinto de 0.

---

## Resumen de causas raíz (para priorizar)

1. `socialflow_leads` vacía → 0 leads en dashboard, para todos los tenants.
2. `processInstagramMetrics` nunca escribe métricas por post (solo por cuenta) → Alcance/Guardados/Plays/Engagement-por-post en 0 en Dashboard e Insights, para todos los tenants con datos reales.
3. `redditTopics`/`globalTrends` de TrendKeywordAgent se capturan pero no influyen en ningún prompt de generación — solo `youtubeHooks` llega (indirectamente, vía `hooks_json`).
4. `ReelsAgent.ts` no consume NicheIntelligence en absoluto.
5. Faltan datos (`likes/comments` y `plays` por formato) y componentes de gráfico para 2 de los 3 gráficos pedidos en Insights.
