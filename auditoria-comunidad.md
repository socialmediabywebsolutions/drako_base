# Auditoría — decisión y generación de formato de contenido (Post/Reel/Carrusel/Historia)

Auditoría de solo lectura. Ningún archivo del código fue modificado.

---

## Nota previa: dos árboles de código para "agentes"

Existen **dos** directorios de agentes en el repo:

- `src/lib/social/ai/agents/` — versión antigua (archivos de marzo 2026, `StrategyAgent.ts` de 46 líneas). **No tiene ningún importador en el resto del código** (`grep` de `lib/social/ai` no devolvió resultados fuera de sí mismo) → parece código muerto/abandonado.
- `src/lib/socialflow/ai/agents/` — versión activa (archivos actualizados hasta agosto 2026, `StrategyAgent.ts` de 117 líneas, importado desde `SocialFlowOrchestrator.ts` y usado en producción).

Todo lo que sigue se refiere exclusivamente a `src/lib/socialflow/ai/`, que es el árbol real.

---

## 1. Strategy Agent / decisión de formato

Hay **dos vías independientes** que deciden formato, sin relación entre sí:

### 1a. Pipeline de campaña (texto/estrategia) — `StrategyAgent.ts`
`src/lib/socialflow/ai/agents/StrategyAgent.ts:53`

```ts
format: i % 2 === 0 ? "carousel" : "reel",
```

El formato se decide por **paridad del índice del día** (alternancia fija carrusel/reel), tanto en el fallback determinista (`buildBaseStrategy`) como en el prompt que se le manda al LLM (línea 104: `format: "carousel" o "reel"` — ni siquiera se le ofrece "post" o "story" como opción al modelo). No hay ninguna lógica de "crecimiento vs. engagement vs. fidelización".

Orquestado desde `SocialFlowOrchestrator.generateFullCampaign` / `generateStrategyOnly` / `generateSinglePost` (`src/lib/socialflow/ai/SocialFlowOrchestrator.ts:198,239,240`).

### 1b. Pipeline foto→post — `ImageAnalysisAgent.ts`
`src/lib/socialflow/ai/agents/ImageAnalysisAgent.ts:16-58, 222-249`

Aquí el formato (`recommendedPostType: FEED|REEL|STORY`) sí se decide con una lógica real, pero **basada en el contenido visual de la foto**, no en un objetivo de negocio:

- El modelo de visión (Mistral Small 3.1, vía Workers AI) clasifica primero un `momentType`: `"accion"` / `"intimo_personal"` / `"estatico_compuesto"`.
- Ese `momentType` determina el formato con una regla fija (líneas 222-225):
  - `accion` → **REEL**
  - `intimo_personal` → **STORY**
  - `estatico_compuesto` → **FEED**
- Fallback sin IA disponible: `nicheDefaultPostType()` (línea 46) — solo mira si el nicho es deportivo (regex fitness/gym/running/etc.) → REEL, si no → FEED. Nunca produce STORY en fallback.

Este pipeline es el que usa `generate-from-image/route.ts` (subida real de foto del cliente).

### ¿Existe campo de "objetivo/intención" en D1?

**Sí, dos**, pero **ninguno alimenta la decisión de formato** — solo se usan para elegir el texto del CTA final:

- `saas_social_campaigns.objective` (columna real, ver `migrations/0203_saas_social_campaigns_objective_enum.sql` y `src/lib/socialflow/repository.ts:75`) — objetivo por campaña.
- `socialflow_profiles.client_objective` (columna real, ver `src/lib/socialflow/profile/repository.ts:53,148-151`) — objetivo por defecto del perfil, tipo `SocialFlowClientObjective = "followers" | "engagement" | "leads" | "sales" | "saves" | "virality"` (`src/lib/socialflow/ai/types.ts:3`).

`SocialFlowOrchestrator.buildProfile` resuelve `campaignObjective` (de la campaña) sobre `profile.clientObjective` (línea 152) y lo mete en `BrandProfile.clientObjective`. Pero el único consumidor de ese campo es `resolveObjectiveCta()` en `src/lib/socialflow/ai/utils/ctaUtils.ts:9-28` — un mapa fijo `objetivo → frase de CTA` (ej. `sales` → "Link en bio para conseguirlo 🛒"), usado por `ContentGeneratorAgent`, `OptimizationAgent` y `CarouselComposerAgent` solo para el CTA del texto. **Ningún agente lee `clientObjective` para decidir el `format`.**

**Conclusión punto 1:** hoy no existe ninguna lógica "objetivo de negocio → formato". El formato sale de (a) alternancia fija día par/impar, o (b) heurística de qué tipo de foto subió el cliente. El campo `objective`/`clientObjective` ya existe en BD y en el perfil de marca — es la pieza más fácil de enganchar si se quiere introducir esa lógica, porque el dato ya viaja hasta `BrandProfile` en cada llamada.

---

## 2. Historias (Stories)

**Sí existen hoy**, pero de forma limitada:

- **Generación:** no hay un `StoryAgent` dedicado (confirmado — no existe ningún archivo `StoryAgent.ts`/`StoriesAgent.ts`/`generateStory` en el repo). La única vía de generación es la rama STORY de `ImageAnalysisAgent` (ver punto 1b) cuando el cliente sube una foto "íntima/casual" — el sistema simplemente clasifica esa foto como STORY y reutiliza el mismo pipeline de imagen/caption que un post normal.
- **Publicación:** `src/lib/socialflow/meta/publishing.ts:379-405`. Es un contenedor `media_type=STORIES` con `image_url` o `video_url`. Comentario explícito en el código (línea ~404): **"Stories do not support captions via the API"** — no llevan caption/texto en la publicación real a Meta.
- **Elementos interactivos:** confirmado que **no existen**. Búsqueda de `poll|sticker|countdown|encuesta|pregunta interactiva|cuenta atrás` en todo `src/lib/socialflow` y `src/app/api/socialflow` no arroja ninguna implementación real — los únicos hits son menciones de "Story polls" dentro de `CompetitorAgent.ts` (texto de ejemplo sobre qué hace la *competencia*, no una feature del producto). Hoy las Historias son **imagen o vídeo estático**, sin stickers de Meta (encuesta, pregunta, cuenta atrás, etc.).

- **Cuota — confirmado, bucket propio y separado:**
  `src/lib/socialflow/billing/enforce.ts:46-56, 219-269`. Historias tiene un **techo diario** (`PLAN_STORIES_DAILY_CAP`, 1-2/día según plan, simétrico influencer/empresa), completamente distinto del pool semanal de Instagram. La query que calcula el pool semanal de Instagram excluye explícitamente STORY (`igContentFilter = { provider: "INSTAGRAM", excludeContentTypes: ["STORY"] }`, línea 247) y Stories se cuenta aparte con `contentType: "STORY"` (línea 253). Comentario del propio código (línea 219-224): *"Historias es un bucket 100% separado del semanal combinado de Instagram (no compite con él)"*. Además, el cap diario de Historias es **solo informativo** (`isAtCap`) — no bloquea publicación; el único límite que sí bloquea de verdad es `DAILY_CAP=2` del feed/reel/carrusel combinado (línea 275-278, `canPublishNow`).

---

## 3. Carrusel "Crear con IA" sin foto

**Confirmado: es el único formato con generación sin foto de entrada.**

- Entry point único: `src/app/api/socialflow/posts/generate-ai-carousel/route.ts` ("Hermano de posts/generate-from-image/route.ts para el modo 'Crear con IA'", línea 17-18). No existe ningún `generate-ai-post` ni `generate-ai-reel` equivalente sin foto — verificado listando `src/app/api/socialflow/posts/` (solo `generate-ai-carousel`, `generate-from-image`, `generate-linkedin`) y comprobando que `reels/generate` y `reels/generate-ai-video` **exigen `imageUrl` como campo obligatorio** (400 si falta — `src/app/api/socialflow/reels/generate/route.ts:22-26`, `reels/generate-ai-video/route.ts:25-29`).

- **Acoplamiento a Carrusel — alto, por diseño estructural, no por un simple `if`:**
  - `CarouselComposerAgent.resolveSlidePlan()` (`src/lib/socialflow/ai/agents/CarouselComposerAgent.ts:198-236`) está construido alrededor del concepto de "N slides", con lógica de intercalado foto/texto-IA para el modo mixto (líneas 185-236) — un concepto que no existe en Post (1 imagen) ni Reel (vídeo continuo).
  - El fondo de un slide sin foto se genera vía **Canvas 2D estático** (`StaticSlideRenderer.ts:109,374,472` + `CarouselStylePacks.ts:23` — "técnica de fondo generado — solo se usa cuando el slide no trae foto"), un renderer pensado para slides estáticos apilables, no para un feed post independiente ni para vídeo.
  - Límites propios: `CAROUSEL_MIN_SLIDES`/`CAROUSEL_MAX_ITEMS` en `meta/publishing.ts`, duplicados como constante local en `CarouselComposerAgent.ts:173-179` (`MIN_TOPIC_SLIDE_COUNT=2`) — un carrusel de 1 slide ni siquiera es válido hoy, así que ni "extender el pipeline a Post" es tan directo como reusar 1 slide.

- **Extender a Post (imagen estática):** relativamente factible — reutilizaría `StaticSlideRenderer` + `CarouselStylePacks` para generar 1 sola imagen de fondo con texto, sin necesidad de la lógica de intercalado/mínimo-2-slides. Sería el salto más corto.
- **Extender a Reel (vídeo):** mucho más difícil — `ReelsAgent.run()` recibe `imageUrl: string` como campo **obligatorio** (no opcional) y todo el motor (`ReelsEngine`, `CanvasRenderer`, `music-selector.ts`) está construido sobre transformar una imagen de entrada real en clips con efectos, no sobre generar la imagen base desde cero. Requeriría además generar primero una imagen base con IA (vía `image-generator.ts`, que hoy solo se usa para el flujo de campaña texto, `SocialFlowOrchestrator.persistToDb:259`) y luego alimentarla al pipeline de vídeo — un salto de dos pasos, no una extensión trivial del carrusel.

---

## 4. Métricas actuales

### Reach y saved: se piden a Meta y se guardan — pero solo dentro de `metadata` (JSON), no como columnas propias

`src/lib/socialflow/meta/core.ts:608-639`, función `fetchInstagramMediaInsights`:
```ts
metric = isReel
  ? "reach,saved,shares,video_views,plays,ig_reels_avg_watch_time"
  : "impressions,reach,saved,shares";
```
Sí se solicitan y se parsean (`reach: sumInsightMetric(...)`, `saved: sumInsightMetric(...)`). El collector (`src/lib/socialflow/meta/metrics-collector.ts`, líneas 105-124, 292-312, 367-386) los mete en el campo `metadata` de cada fila:
```ts
metadata: { type: "media", mediaId: item.id, reach: mediaInsights.reach, saved: mediaInsights.saved, ... }
```
Es decir: **el dato SÍ llega y SÍ se persiste**, pero queda enterrado dentro de un JSON string en la columna `metadata`, no en una columna consultable propia — de ahí el bug conocido de que reach/impressions "no se guardan" a efectos prácticos de reporting (impressions sí tiene columna propia, pero para cuentas MEDIA_CREATOR llega en 0 a nivel de cuenta por diseño — ver comentario línea 227-231 — y solo se suma correctamente vía el loop per-media).

### "Sends" (compartidos por DM): no se piden en absoluto

No hay ninguna métrica llamada `sends` en `core.ts`. El campo más cercano que sí se pide es `shares` (parte del string de métricas de arriba, mapeado a la columna real `shares` de `saas_social_metrics`), pero **no hay evidencia en el código de que se distinga "compartido por DM" de otro tipo de share** — el código trata `shares` como un único número agregado que devuelve la Graph API, sin desglose.

### Historias nunca reciben métricas

Comentario explícito en `metrics-collector.ts:320-322`: el backfill existe precisamente porque `fetchInstagramRecentMedia` (`/media` edge) **nunca incluye Stories** (expiran a las 24h) — y no hay ninguna llamada separada a un endpoint de insights de Stories en todo el código. Conclusión: **Stories no generan ninguna fila en `saas_social_metrics`, ni siquiera parcial.**

### Schema completo de `saas_social_metrics`

`migrations/0026_social_core.sql:68-88` (sin alteraciones posteriores — verificado que ninguna migración más reciente toca esta tabla):

```sql
CREATE TABLE IF NOT EXISTS saas_social_metrics (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  saas_id TEXT NOT NULL,
  post_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  impressions INTEGER NOT NULL,
  likes INTEGER NOT NULL,
  comments INTEGER NOT NULL,
  shares INTEGER NOT NULL,
  clicks INTEGER NOT NULL,
  leads_generated INTEGER NOT NULL,
  captured_at TEXT NOT NULL,
  metadata TEXT
);
-- + índices por (tenant_id, saas_id, post_id) y (tenant_id, saas_id, captured_at)
```

Columnas propias: `impressions, likes, comments, shares, clicks, leads_generated`. **`reach` y `saved` NO son columnas** — viven solo dentro del JSON `metadata`, junto con `videoViews/plays/avgWatchTimeMs` (solo para reels) y campos de tipo de captura (`type: "account" | "media" | "media_deferred" | "media_backfill"`).

---

## 5. Cuotas por formato

**Confirmado — coincide con tu entendimiento:** el pool semanal de Instagram es compartido entre Post/Reel/Carrusel, e Historias tiene bucket propio (diario, no semanal).

`src/lib/socialflow/billing/enforce.ts:225-270` (`getWeeklyPublishStatus`):

- **Pool semanal combinado Post+Reel+Carrusel** (`PLAN_INSTAGRAM_WEEKLY_LIMIT`, líneas 37-44): 6-14 posts/semana según plan (empresa siempre 2 menos que influencer al mismo tier). Con **carryover de máx. 1 semana** — el sobrante no usado la semana pasada se suma a esta (línea 258-259).
- **Historias — bucket propio, diario** (`PLAN_STORIES_DAILY_CAP`, líneas 49-56): 1-2/día, simétrico influencer/empresa, sin relación con el pool semanal (query explícitamente excluye STORY del cálculo del pool de Instagram, línea 247; Stories se cuenta aparte, línea 253).
- **LinkedIn** — pool semanal totalmente independiente (`PLAN_LINKEDIN_WEEKLY_LIMIT`, líneas 61-68), mismo mecanismo de carryover.
- **Único límite que bloquea de verdad la publicación:** `DAILY_CAP=2` (línea 73, `canPublishNow` línea 275-278) — techo diario de Instagram (Post+Reel+Carrusel juntos, no separado por formato). Todo lo demás (semanal, mensual, cap diario de Stories) es solo informativo/UI (`isOverQuota`/`isAtCap`), no bloquea.
- Dentro del pool semanal no hay sub-cuota por formato individual (p.ej. no hay "máx. X reels/semana" distinto de "máx. Y carruseles/semana") — es un único contador que suma Post+Reel+Carrusel indistintamente.

---

## Resumen para decidir próximos pasos

| Punto | Estado actual |
|---|---|
| Decisión de formato por objetivo | No existe. Hay alternancia fija (día par/impar) o heurística visual de la foto. El campo `objective`/`clientObjective` ya existe en BD y perfil, pero solo alimenta el CTA. |
| Historias | Generación básica vía la misma rama de `ImageAnalysisAgent`, sin agente propio, sin interactividad (ni polls ni stickers), sin caption (API de Meta no lo permite), sin captura de métricas. Cuota: bucket diario propio, confirmado. |
| Carrusel sin foto | Único formato con ese modo. Acoplado estructuralmente (multi-slide, Canvas renderer, intercalado foto/IA). Extender a Post es relativamente corto (reusar `StaticSlideRenderer`); extender a Reel requiere motor de vídeo nuevo. |
| Métricas | `reach` y `saved` se piden y se guardan, pero enterrados en `metadata` JSON, no en columnas. `sends` no se pide en absoluto (solo `shares`, agregado, sin desglose por DM). Historias no generan fila de métricas nunca. |
| Cuotas | Pool semanal Instagram = Post+Reel+Carrusel compartido, con carryover 1 semana. Historias = bucket diario propio, separado, no bloqueante. |
