# Auditoría técnica — Cerebro de Socialcors (Sprint A)
*Auditoría de solo lectura, verificada contra código y base de datos de producción el 2026-08-07*

**Alcance:** Investigación previa a la implementación del Sprint A del Cerebro de Socialcors — el pipeline central de datos (`BrandProfile`) que alimenta todos los agentes de generación (Posts, Reels, Historias, Carruseles, Campañas). No se modificó ningún archivo del repositorio; la única acción de escritura fue ninguna (solo se ejecutaron `SELECT` de solo lectura contra la base de datos de producción).

---

## 1. MAPEO PERDIDO

**`SocialFlowOrchestrator.buildProfile()`** — `src/lib/socialflow/ai/SocialFlowOrchestrator.ts:53-134`:

```typescript
async buildProfile(input: SocialAIPipelineInput): Promise<BrandProfile> {
    const [{ profile, competitors }, knowledgeContext, connectedInstagramHandle, campaignObjective] = await Promise.all([
      getChannelKnowledge(input.tenantId, input.saasId),
      getKnowledgeContext(input.tenantId, input.saasId).catch(() => ""),
      resolvePrimaryInstagramHandle(input.tenantId, input.saasId).catch(() => null),
      resolveCampaignObjective(input.tenantId, input.saasId, input.campaignId).catch(() => null),
    ]);

    const niche = input.niche || profile.niche || input.saasId;
    const tone = profile.toneOfVoice || input.tone || "neutro y profesional";
    const brandName = profile.brandName || input.saasId.replace(/[-_]/g, " ");

    const baseLongDescription = profile.longDescription || profile.shortDescription || `${niche} content pipeline`;
    const longDescription = knowledgeContext
      ? `${baseLongDescription}\n\n--- Knowledge Base ---\n${knowledgeContext}`
      : baseLongDescription;

    const personalCreatorSignal = /primera persona|influencer|creador|creadora|personal brand|mi marca|mis seguidores/i;
    const isPersonalCreator = [profile.personality, profile.toneOfVoice, profile.shortDescription, knowledgeContext]
      .some((f) => personalCreatorSignal.test(f ?? ""));
    const voiceInstruction = isPersonalCreator
      ? `Escribe en primera persona singular (yo). Habla directamente como si fueras ${brandName} dirigiéndote a tu audiencia. NUNCA uses "${brandName}" en tercera persona ni como si fuera una empresa. Ejemplo correcto: "Te comparto..." — Ejemplo incorrecto: "En ${brandName} compartimos..."`
      : "";

    return {
      brandIdentity: brandName,
      channelHandle: connectedInstagramHandle
        ? `@${connectedInstagramHandle}`
        : profile.channelName
          ? `@${profile.channelName}`
          : `@${input.saasId}`,
      shortDescription: profile.shortDescription || `${niche} social automation`,
      longDescription,
      mission: profile.mission || `Grow ${brandName} with consistent social execution.`,
      valueProposition: profile.valueProposition || `${niche} content for ${profile.audienceDescription || "your audience"}.`,
      toneOfVoice: tone,
      personality: profile.personality || tone,
      voiceInstruction,
      accountType: input.accountType ?? null,
      ageRange: profile.ageRange || null,
      gender: profile.gender || null,
      clientObjective: (campaignObjective as BrandProfile["clientObjective"]) || profile.clientObjective || null,
      niche,
      audience: profile.audienceDescription || `${niche} buyers`,
      buyerPersona: profile.buyerPersona || `${niche} operator`,
      painPoints: profile.painPoints.length ? profile.painPoints : [niche],
      desires: profile.desires.length ? profile.desires : ["growth"],
      objections: profile.objections.length ? profile.objections : ["time"],
      services: profile.services,
      products: profile.products,
      offers: profile.offers,
      differentiators: profile.differentiators,
      primaryCTA: profile.primaryCTA || "Reserva ahora",
      secondaryCTAs: profile.secondaryCTAs,
      baseKeywords: profile.baseKeywords.length ? profile.baseKeywords : [niche],
      priorityKeywords: profile.priorityKeywords.length ? profile.priorityKeywords : [niche],
      longTailKeywords: profile.longTailKeywords.length ? profile.longTailKeywords : [`${niche} ${brandName}`],
      baseHashtags: profile.baseHashtags.length ? profile.baseHashtags : [`#${brandName.replace(/\s+/g, "").toLowerCase()}`],
      priorityHashtags: profile.priorityHashtags.length ? profile.priorityHashtags : profile.baseKeywords.map((k) => `#${k.replace(/\s+/g, "")}`),
      competitorHashtags: profile.competitorHashtags.length ? profile.competitorHashtags : competitors.map((c) => `#${c.name.replace(/\s+/g, "")}`),
      contentPillars: profile.contentPillars.length ? profile.contentPillars : [niche],
      preferredFormats: profile.preferredFormats.length ? profile.preferredFormats : ["carousel", "single"],
      avoidedFormats: profile.avoidedFormats,
      viralThemes: profile.viralThemes,
      trendingTopics: profile.trendingTopics,
      seasonalTopics: profile.seasonalTopics,
      marketSignals: profile.marketSignals,
      opportunitySignals: profile.opportunitySignals,
      demandSignals: profile.demandSignals.length ? profile.demandSignals : [niche],
      forbiddenTopics: profile.forbiddenTopics,
      prohibitedClaims: profile.prohibitedClaims,
      bannedWords: profile.bannedWords,
      forbiddenAngles: profile.forbiddenAngles,
    };
  }
```

**`BrandProfile`** — `src/lib/socialflow/ai/types.ts:1-64` (tipo completo):

```typescript
export type SocialFlowClientObjective = "followers" | "engagement" | "leads" | "sales" | "saves" | "virality";

export type BrandProfile = {
  brandIdentity: string;
  channelHandle: string;
  shortDescription: string;
  longDescription: string;
  mission: string;
  valueProposition: string;
  toneOfVoice: string;
  personality: string;
  voiceInstruction: string;
  accountType?: "influencer" | "empresa" | null;
  ageRange?: string | null;
  gender?: string | null;

  niche: string;
  audience: string;
  buyerPersona: string;
  painPoints: string[];
  desires: string[];
  objections: string[];

  services: string[];
  products: string[];
  offers: string[];
  differentiators: string[];
  primaryCTA: string;
  secondaryCTAs: string[];
  clientObjective?: SocialFlowClientObjective | null;

  baseKeywords: string[];
  priorityKeywords: string[];
  longTailKeywords: string[];
  baseHashtags: string[];
  priorityHashtags: string[];
  competitorHashtags: string[];
  contentPillars: string[];
  preferredFormats: string[];
  avoidedFormats: string[];

  viralThemes: string[];
  trendingTopics: string[];
  seasonalTopics: string[];

  marketSignals: string[];
  opportunitySignals: string[];
  demandSignals: string[];

  forbiddenTopics: string[];
  prohibitedClaims: string[];
  bannedWords: string[];
  forbiddenAngles: string[];
};
```

**`ChannelProfile`** — `src/lib/socialflow/profile/types.ts:49-127` (shape real de `socialflow_profiles`, ver `workers/socialflows/migrations/0185_socialflow_profiles.sql` + `0199_socialflow_profiles_persona_fields.sql` + `0210_profile_contact_email.sql`).

### Campos de `ChannelProfile`/`socialflow_profiles` que NO se mapean a `BrandProfile` en `buildProfile()`

| Campo de `ChannelProfile` | ¿Se usa en buildProfile()? |
|---|---|
| `websiteUrl` | No |
| `activeSocialNetworks` | No |
| `primaryLanguage` | No |
| `targetCountry` | No |
| `targetMarkets` | No |
| `subniches` | No |
| `mainTopics` | No |
| `secondaryTopics` | No |
| `allowedTopics` | No |
| `awarenessLevel` | No |
| `audienceLanguage` | No |
| `audienceStyle` | No |
| `avgPrice` | No |
| `transformations` | No |
| `postingFrequencyGoal` | No |
| `audienceQuestions` | No |
| `recurringObjections` | No |
| `industryTrends` | No |
| `prohibitedClaims` | Sí (mapea 1:1) |
| `complianceNotes` | No |
| `brandSafetyRules` | No |
| `assetSummary` | No |
| `growthGoalFollowers` | No |
| `growthGoalTimeline` | No |
| `contentStyle` | No |
| `postingFrequency` (número) | No |

**CONFIRMADO**: 24 campos de `ChannelProfile` (de los ~60 totales) se pierden por completo en el mapeo — nunca llegan a `BrandProfile` ni por tanto al prompt de ningún agente. Notablemente: `mainTopics`, `secondaryTopics`, `subniches`, `awarenessLevel`, `audienceStyle`, `brandSafetyRules`, `complianceNotes`, `assetSummary` (probablemente un resumen ya sintetizado de los assets subidos por el cliente) y `targetMarkets`/`targetCountry` — todos potencialmente valiosos para el prompt del carrusel.

### Campos de `BrandProfile` nunca rellenados

**REFUTADO**. Los 39 campos de `BrandProfile` reciben siempre un valor concreto en `buildProfile()` — cada uno tiene un fallback determinista (`profile.X || <default>` o `profile.X.length ? profile.X : [default]`), así que ningún campo del tipo queda `undefined` en runtime. El problema no es "campos vacíos en BrandProfile", sino que buildProfile() sencillamente ignora 24 columnas de la fuente (`ChannelProfile`) al construir el objeto — nunca las lee, no que las lea y las descarte.

---

## 2. KB EN BUILDPROFILE

**`getKnowledgeContext()`** — `src/lib/socialflow/knowledge/repository.ts:136-200`:

```typescript
export async function getKnowledgeContext(
  tenantId: string,
  saasId: string,
): Promise<string> {
  const db = await getDb(tenantId, saasId);
  const { results } = await db
    .prepare(
      `SELECT name, type, content_text
       FROM ${TABLE}
       WHERE tenant_id = ? AND saas_id = ?
       ORDER BY created_at DESC
       LIMIT 20`,
    )
    .bind(tenantId, saasId)
    .all<{ name: string; type: string; content_text: string }>();

  if (!results?.length) return "";

  const styleDocs = results.filter((d) => d.type === "auto_learned_style").slice(0, 1);
  const marketDocs = results.filter((d) => d.type === "market_analysis").slice(0, 1);
  const competitorDocs = results.filter((d) => d.type === "competitor").slice(0, 5);
  const catalogDocs = results.filter((d) => d.type === "catalog").slice(0, CATALOG_CONTEXT_DOCS);
  const knowledgeDocs = results
    .filter(
      (d) =>
        d.type !== "market_analysis" &&
        d.type !== "competitor" &&
        d.type !== "auto_learned_style" &&
        d.type !== "catalog",
    )
    .slice(0, CONTEXT_DOCS);

  const parts: string[] = [];

  if (styleDocs.length) {
    parts.push(`## LEARNED WRITING STYLE (from this account's own published posts)\n${styleDocs[0].content_text.slice(0, 2000)}`);
  }
  if (marketDocs.length) {
    parts.push(`## MARKET INTELLIGENCE\n${marketDocs[0].content_text.slice(0, 2000)}`);
  }
  if (competitorDocs.length) {
    const section = competitorDocs
      .map((d) => `[${d.name}]\n${d.content_text.slice(0, CONTEXT_SNIPPET)}`)
      .join("\n\n");
    parts.push(`## COMPETITOR INTELLIGENCE\n${section}`);
  }
  if (catalogDocs.length) {
    const section = catalogDocs
      .map((d) => `[${d.name}]\n${d.content_text.slice(0, CATALOG_CONTEXT_SNIPPET)}`)
      .join("\n\n---\n\n");
    parts.push(`## PRODUCT CATALOG\n${section}`);
  }
  if (knowledgeDocs.length) {
    const section = knowledgeDocs
      .map((d) => `[${d.name}]\n${d.content_text.slice(0, CONTEXT_SNIPPET)}`)
      .join("\n\n---\n\n");
    parts.push(`## BRAND KNOWLEDGE BASE\n${section}`);
  }

  return parts.join("\n\n===\n\n");
}
```

**Tipos incluidos**: `auto_learned_style` (máx. 1 doc, 2000 chars), `market_analysis` (máx. 1 doc, 2000 chars), `competitor` (máx. 5 docs, 800 chars c/u), `catalog` (máx. 3 docs, 3000 chars c/u), y "el resto" (`pdf`/`url`/`text`, máx. 5 docs, 800 chars c/u). Consulta trae hasta 20 filas totales (`LIMIT 20`), y cada categoría trunca por `.slice(0, N_chars)` en caracteres, no en tokens — no hay lógica de priorización por relevancia, solo por `created_at DESC` (más reciente primero) dentro de cada tipo.

**Trazado de la cadena hasta `CarouselComposerAgent`**:

1. `buildProfile()` (`SocialFlowOrchestrator.ts:56,71-73`) llama `getKnowledgeContext()` y concatena el resultado dentro de `BrandProfile.longDescription`.
2. Los 3 route handlers que llaman a `CarouselComposerAgent` (`generate-ai-carousel/route.ts:165-172`, `carousel/regenerate-slide/route.ts:50-57`, `campaigns/[id]/photos/route.ts`) obtienen el `profile` completo (con `longDescription` ya enriquecido) vía `orchestrator.buildProfile(...)` y se lo pasan tal cual a `CarouselComposerAgent.run({ profile, ... })`.
3. **Corte confirmado en `CarouselComposerAgent.ts`**: el método `run()` (líneas 164-327) construye el prompt en las líneas 275-291 usando `profile.niche`, `profile.brandIdentity`, `profile.voiceInstruction`, `profile.clientObjective`/`primaryCTA`, `profile.contentPillars`, `profile.toneOfVoice`, `profile.baseHashtags`/`priorityHashtags` — **`profile.longDescription` y `profile.shortDescription` nunca se leen en este archivo** (confirmado por grep exacto: 0 coincidencias de `longDescription`/`shortDescription`/`knowledgeContext` en `CarouselComposerAgent.ts`).

**CONFIRMADO**: el corte no está en `buildProfile()` (que sí incorpora la KB correctamente en `longDescription`), sino específicamente en `CarouselComposerAgent.ts` — el agente recibe el `BrandProfile` completo con la KB embebida, pero simplemente no la usa al construir su prompt. Contraste directo: `ContentGeneratorAgent.ts:47` sí lee `profile.longDescription` dentro de `richProfileLines()` y la inyecta en el prompt (`ContentGeneratorAgent.ts:98,133`) — es decir, el mismo campo SÍ llega a Mistral para posts/reels, pero NO para carruseles.

---

## 3. STYLELEARNING VACÍO

**`StyleLearningAgent.run()`** — `src/lib/socialflow/ai/agents/StyleLearningAgent.ts:70-196`. Flujo: filtra posts `POSTED`/`PUBLISHED` con body no vacío → `if (published.length === 0) return null;` en la línea 83 → analiza hooks/hashtags/temas/horas → genera resumen vía Mistral → `upsertKnowledgeDocByType(type: "auto_learned_style")` (línea 167-173) → **adicionalmente** llama `saveStyleSnapshot(...)` (línea 191) hacia `socialcors_style_history`.

**Condición mínima para ejecutarse**: no está dentro del propio agente sino en el cron que lo invoca — `src/app/api/cron/social/style-learning/route.ts:8,36-49`:
```typescript
const MIN_PUBLISHED_POSTS = 10;
...
const result = await socialDb
  .prepare(
    `SELECT tenant_id, saas_id, COUNT(*) as published_count
     FROM saas_social_posts
     WHERE status IN ('POSTED', 'PUBLISHED')
     GROUP BY tenant_id, saas_id
     HAVING COUNT(*) >= ?`,
  )
  .bind(MIN_PUBLISHED_POSTS)
  .all<TenantRow>();
```
Solo se ejecuta `StyleLearningAgent` para pares tenant/saas con **≥10 posts publicados**. Dentro del agente mismo, no hay try/catch que trague errores de forma silenciosa en el flujo principal — sí hay un try/catch aislado alrededor de `saveStyleSnapshot` dentro de `NicheIntelligenceService.ts:170-196` (loguea con `console.error` y no relanza), y el KB doc (`upsertKnowledgeDocByType`) no está envuelto en try/catch propio dentro del agente (si falla, el cron lo captura en su propio try/catch por tenant, línea 61-78 de la ruta cron, y sigue con el resto).

**Resultados de las consultas D1 (solo lectura, ejecutadas contra `saas_socialflows_prod_db --remote`)**:

```sql
SELECT COUNT(*) FROM saas_social_posts
WHERE tenant_id = 'ea85eb95-3c1e-4192-a2de-333bba37b842' AND status IN ('POSTED', 'PUBLISHED');
-- Resultado: 101
```
```sql
SELECT COUNT(*) FROM socialcors_style_history;
-- Resultado: 0
```

**Contradicción detectada**: el tenant auditado tiene **101 posts publicados**, muy por encima del umbral de 10 requerido por el cron — debería llevar semanas cualificando para `StyleLearningAgent`. Sin embargo `socialcors_style_history` tiene **0 filas en toda la base de datos** (no solo para este tenant). Esto indica que el cron diario (`0 3 * * *`, ver `workers/socialflows/wrangler.workers.toml:74`) **nunca se ha ejecutado con éxito**, o el handler `scheduled` inyectado por `scripts/patch-socialflow-cron-handler.mjs:63-96` no está llegando a disparar `/api/cron/social/style-learning` en el despliegue actual (posibles causas no verificables solo con lectura de código: `CRON_SECRET` no configurado en el worker desplegado, el patch post-build no se aplicó en el último deploy, o el fetch interno al propio `APP_URL` está fallando silenciosamente — el `.catch()` de la línea 74-76 del script solo hace `console.error`, no re-lanza). Esto requiere revisar logs de Cloudflare Workers (`wrangler tail`) para confirmar la causa raíz exacta — no se puede determinar solo con lectura estática.

**¿`buildProfile()` lee `socialcors_style_history` o el doc de KB `auto_learned_style`?**

**CONFIRMADO: lee el documento de KB, nunca la tabla `socialcors_style_history` directamente.** `SocialFlowOrchestrator.buildProfile()` (`SocialFlowOrchestrator.ts:56`) solo llama a `getKnowledgeContext(input.tenantId, input.saasId)`, que en `src/lib/socialflow/knowledge/repository.ts:154,170-172` filtra `results.filter((d) => d.type === "auto_learned_style")` sobre la tabla `socialflow_knowledge_documents` (no `socialcors_style_history`). La función `getStyleHistory()` (que sí lee `socialcors_style_history`, en `src/lib/socialflow/intelligence/NicheIntelligenceService.ts:133-154`) **nunca se llama desde `buildProfile()` ni desde `SocialFlowOrchestrator.ts` en absoluto** — solo la llaman directamente `ContentGeneratorAgent.run()` (`ContentGeneratorAgent.ts:7,80`) y `calculateViralScore()` (`ViralScoreAgent.ts:2,128`), cada uno con su propio `tenantId`/`saasId` pasado explícitamente, fuera del objeto `BrandProfile`.

Como ambas rutas dependen en última instancia de que `StyleLearningAgent` haya corrido al menos una vez (para poblar el doc KB Y la tabla history), y el cron parece no haber corrido nunca para este tenant pese a cumplir el umbral, ambas fuentes de "estilo aprendido" están vacías en la práctica — aunque por razones distintas y en capas distintas del sistema.

---

## 4. NICHEINTELLIGENCE EN CARRUSEL

**Grep exacto sobre `CarouselComposerAgent.ts`**:
```
$ grep -n "getNicheIntelligence\|getStyleHistory\|NicheIntelligenceService" src/lib/socialflow/ai/agents/CarouselComposerAgent.ts
(sin resultados)
```
**CONFIRMADO: no hay ninguna llamada.** `CarouselComposerAgent.ts` no importa `NicheIntelligenceService` en absoluto (confirmado en el import block del archivo).

**Patrón exacto usado por `ContentGeneratorAgent`** (`src/lib/socialflow/ai/agents/ContentGeneratorAgent.ts`):

Import (línea 7-8):
```typescript
import { getNicheIntelligence, getStyleHistory, detectContentFatigue } from "@/lib/socialflow/intelligence/NicheIntelligenceService";
import { env } from "@/lib/cf";
```

Llamada + inyección en el prompt (líneas 75-91):
```typescript
const dracoEnv = env();
const [nicheIntel, styleHistory] = dracoEnv
  ? await Promise.all([
      getNicheIntelligence(profile.niche, dracoEnv),
      input.tenantId && input.saasId
        ? getStyleHistory(input.tenantId, input.saasId, dracoEnv)
        : Promise.resolve([]),
    ])
  : [null, []];
const fatigueWarning = detectContentFatigue(styleHistory);

const nicheIntelSection = nicheIntel
  ? `\n## Tendencias actuales del nicho ${profile.niche} (últimos 7 días)\n${nicheIntel.hashtags.length ? `Hashtags en tendencia: ${nicheIntel.hashtags.join(" ")}\n` : ""}${nicheIntel.formats.length ? `Formatos que están funcionando mejor: ${nicheIntel.formats.join(", ")}\n` : ""}${nicheIntel.hooks.length ? `Hooks que están funcionando: ${nicheIntel.hooks.join(" | ")}\n` : ""}`
  : "";
const fatigueSection = fatigueWarning
  ? `\n⚠️ ATENCIÓN — FATIGA DE CONTENIDO DETECTADA: ${fatigueWarning.description}\n`
  : "";
```
Y se inyecta en el prompt final en la línea 140: `${nicheIntelSection}${fatigueSection}`.

Este patrón requiere `input.tenantId`/`input.saasId` explícitos además de `profile` — que `CarouselComposerAgent.run()` no recibe en su firma de entrada actual (`CarouselComposerAgent.ts:165-189`, sin `tenantId`/`saasId`/`env` en ningún parámetro).

---

## 5. CAPTION DEL CARRUSEL

**¿Genera `CarouselComposerAgent` un caption/descripción separado de los slides?**

**REFUTADO — no existe caption propio.** El tipo de salida es (`CarouselComposerAgent.ts:49-55`):
```typescript
export type CarouselComposition = {
  id: string;
  openerCategory: OpenerCategory;
  slides: CarouselSlideText[];     // length === total slides
  hashtags: string[];              // 10-15
  tone: string;
};

export type CarouselSlideText = {
  order: number;
  role: CarouselSlideRole;         // "intro" | "desarrollo" | "cierre_cta"
  text: string;                    // clamped a CAROUSEL_SLIDE_TEXT_LIMITS[role]
  photoIndex?: number;
};
```
No hay campo `caption`/`description`/`body` en `CarouselComposition`. El prompt de Mistral (líneas 275-291) solo pide el texto de cada slide + hashtags, nunca un texto de Instagram independiente (con hook + desarrollo + CTA a nivel de post, distinto de los textos incrustados visualmente en cada tarjeta).

**¿Dónde se "muestra" el caption en la UI?** No existe: el "caption" final de Instagram se construye por el **frontend**, uniendo el texto de todos los slides con `\n\n` — confirmado en `src/components/socialflow/publish-carrusel.tsx:685-708` (`saveCarousel()`):
```typescript
const ordered = [...slides].sort((a, b) => a.order - b.order);
const introSlide = ordered.find((s) => s.role === "intro");
const title = (introSlide?.text ?? ordered[0]?.text ?? "").slice(0, 72);
const body = ordered.map((s) => s.text).join("\n\n");

const res = await fetch("/api/socialflow/posts", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    saasId, provider: "INSTAGRAM", contentType: "CAROUSEL",
    title, body, imageHint: ordered[0]?.renderedImageUrl ?? null,
    status: "SCHEDULED", scheduledAt,
    metadata: { slides: ordered.map(...), hashtags, carouselIndex, styleVariantKey: style?.key ?? null },
  }),
});
```
El mismo patrón se replica server-side en `campaigns/[id]/photos/route.ts:376` (`body: composition.slides.map((s) => s.text).join("\n\n")`). No hay búsqueda de "caption" (case-insensitive) en ningún componente de carrusel (`publish-carrusel.tsx`, `AiCarouselCreator.tsx`, `carrusel-selector.tsx`) — confirmado por grep sin resultados. Es decir: el pie de foto de Instagram termina siendo literalmente el texto de las tarjetas visuales concatenado, no un texto redactado a propósito para la sección de descripción (que podría llevar más contexto, hashtags integrados en prosa, un hook distinto al de la primera tarjeta, etc.).

---

## 6. VIRALSCORE

**`calculateViralScore()`** (función principal exportada, no hay clase `.run()`) — `src/lib/socialflow/intelligence/ViralScoreAgent.ts:116-183`:

```typescript
export async function calculateViralScore(input: {
  caption: string;
  hashtags: string[];
  format: ViralScoreFormat;
  niche: string;
  tenantId: string;
  saasId: string;
  env: Env;
}): Promise<ViralScore> {
  try {
    const [nicheIntel, styleHistory] = await Promise.all([
      getNicheIntelligence(input.niche, input.env),
      getStyleHistory(input.tenantId, input.saasId, input.env),
    ]);
    const fatigueWarning = detectContentFatigue(styleHistory);

    const seed: ViralScorePayload = {
      score: 5, explanation: "", improvements: [],
      factors: { hooks: 5, hashtags: 5, format: 5, timing: 5, niche_alignment: 5 },
    };

    const { data } = await defaultLocalModel.generateStructured<ViralScoreResult>(
      {
        prompt: buildViralScorePrompt({
          caption: input.caption, hashtags: input.hashtags, format: input.format, niche: input.niche,
          nicheHashtags: nicheIntel?.hashtags ?? [], nicheFormats: nicheIntel?.formats ?? [],
          nicheHooks: nicheIntel?.hooks ?? [], fatigueDescription: fatigueWarning?.description ?? null,
        }),
        tenantId: input.tenantId, saasId: input.saasId,
      },
      () => seed as ViralScoreResult,
    );

    if (data._meta?.engine !== "workers-ai") {
      return buildNeutralScore();
    }

    const score = clampScore(data.score, 5);
    const fallback = buildNeutralScore();
    return {
      score,
      label: labelForScore(score),
      explanation: typeof data.explanation === "string" && data.explanation.trim() ? data.explanation.trim() : fallback.explanation,
      improvements: Array.isArray(data.improvements) && data.improvements.length ? data.improvements.slice(0, 3) : fallback.improvements,
      factors: {
        hooks: clampScore(data.factors?.hooks, score),
        hashtags: clampScore(data.factors?.hashtags, score),
        format: clampScore(data.factors?.format, score),
        timing: clampScore(data.factors?.timing, score),
        niche_alignment: clampScore(data.factors?.niche_alignment, score),
      },
    };
  } catch (err) {
    console.error("[ViralScoreAgent] calculateViralScore failed, returning neutral score", err instanceof Error ? err.message : String(err));
    return buildNeutralScore();
  }
}
```

**Input/output completos**: `input` es el objeto tipado literal de arriba (`caption`, `hashtags`, `format: ViralScoreFormat`, `niche`, `tenantId`, `saasId`, `env: Env`). Output = `ViralScore` (`ViralScoreAgent.ts:16-22`):
```typescript
export type ViralScore = {
  score: number;
  label: "Bajo" | "Medio" | "Alto" | "Viral";
  explanation: string;
  improvements: string[];
  factors: { hooks: number; hashtags: number; format: number; timing: number; niche_alignment: number };
};
```
`ViralScoreFormat = "POST" | "REEL" | "HISTORIA" | "CARRUSEL"` — el mapeo `CONTENT_TYPE_TO_VIRAL_FORMAT` (líneas 28-33) sí incluye `CAROUSEL: "CARRUSEL"`, con un comentario explícito en el código: *"CAROUSEL has no source here today — none of the current call sites (single-photo generation) produce it — included for completeness/forward compatibility."*

**¿Se llama en algún endpoint relacionado con el carrusel?**

Grep de `calculateViralScore` en `posts/generate-from-image/route.ts` y `campaigns/[id]/photos/route.ts`:
- `posts/generate-from-image/route.ts:19` (import) y `:621` (llamada)
- `campaigns/[id]/photos/route.ts:26` (import) y `:563` (llamada)

**CONFIRMADO por análisis de flujo: la llamada SÍ existe en el archivo, pero NUNCA se ejecuta para el flujo de carrusel.** En ambos endpoints la rama `CAROUSEL` (`isCarousel`/`isCarouselRequest`) hace su propio `return NextResponse.json(...)` mucho antes de llegar a la línea donde se invoca `calculateViralScore`:
- `posts/generate-from-image/route.ts`: la rama carrusel retorna en la línea 411-437 (`return NextResponse.json({ ... suggestedCarouselPost ... })`); `calculateViralScore` se llama recién en la línea 621, dentro del flujo de post único (FEED/REEL/STORY) que arranca después de esa rama.
- `campaigns/[id]/photos/route.ts`: la rama de lote de carruseles retorna en la línea 399-403 (`return NextResponse.json({ suggestedCarouselPosts: posts, ... })`); `calculateViralScore` se llama en la línea 563, dentro del flujo de una sola foto que arranca en la línea 406.

En ninguno de los dos endpoints el objeto `composition` (resultado de `CarouselComposerAgent`) llega jamás a pasar por `calculateViralScore` — el comentario propio del código en `ViralScoreAgent.ts:27` ("none of the current call sites... produce it") es preciso y se confirma con evidencia de flujo real.

---

## Resumen ejecutivo de las 5 afirmaciones

1. **Parcialmente confirmado, con matiz importante**: 24 campos de `ChannelProfile` no se mapean a `BrandProfile` en `buildProfile()`. Pero ningún campo de `BrandProfile` queda vacío — todos tienen fallback. El problema es de omisión en el mapeo (columnas ignoradas), no de campos que se intentan llenar y fallan.
2. **Confirmado, pero con matiz de ubicación**: la KB SÍ llega hasta `BrandProfile.longDescription` (buildProfile la incorpora correctamente). El corte real está un paso más adelante: `CarouselComposerAgent.ts` recibe `longDescription` con la KB embebida y simplemente nunca la lee al construir su prompt (a diferencia de `ContentGeneratorAgent`, que sí lo hace vía `richProfileLines()`).
3. **Confirmado con evidencia de producción**: `socialcors_style_history` tiene 0 filas pese a que el tenant auditado tiene 101 posts publicados (>10x el umbral del cron). `buildProfile()` nunca lee esa tabla — solo lee el doc KB `auto_learned_style`, que depende del mismo agente/cron que tampoco parece haber corrido con éxito.
4. **Confirmado por grep exacto**: cero referencias a `getNicheIntelligence`/`NicheIntelligenceService` en `CarouselComposerAgent.ts`, mientras que `ContentGeneratorAgent` sí lo usa con un patrón claro y replicable.
5. **Confirmado y ampliado**: `CarouselComposerAgent` no solo ignora KB/keywords de audiencia/NicheIntelligence/StyleHistory — tampoco genera un caption de Instagram independiente de los textos visuales de los slides, y `ViralScoreAgent`, aunque técnicamente soporta el formato `CARRUSEL`, nunca se invoca en la práctica para contenido de carrusel en ninguno de los dos endpoints que lo producen.

---

## Pendiente de investigación (no verificable solo con lectura estática)

- Causa raíz exacta de por qué el cron `0 3 * * *` (style-learning) nunca ha escrito en `socialcors_style_history` pese a cumplirse el umbral de posts — requiere revisar logs reales de Cloudflare Workers (`wrangler tail`) o el dashboard de Cron Triggers, no solo el código.
