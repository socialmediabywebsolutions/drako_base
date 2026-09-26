import { MarketResearchAgent } from "./agents/MarketResearchAgent";
import { KeywordAgent } from "./agents/KeywordAgent";
import { CompetitorAgent } from "./agents/CompetitorAgent";
import { StrategyAgent } from "./agents/StrategyAgent";
import { ContentGeneratorAgent } from "./agents/ContentGeneratorAgent";
import { OptimizationAgent } from "./agents/OptimizationAgent";
import { SchedulerAgent } from "./agents/SchedulerAgent";
import { TrendAgent } from "./agents/TrendAgent";
import type { BrandProfile, SocialAIPipelineInput, SocialAIPipelineResult, StrategyItem } from "./types";
import { STRATEGY_FORMAT_TO_CONTENT_TYPE } from "./types";
import type { SaasSocialContentType } from "@/lib/social-core/types";
import { getSaasSocialCampaignById, listSaasSocialAccounts, listSaasSocialChannels, resolveSocialContext, upsertSaasSocialCampaign, upsertSaasSocialPost } from "../repository";
import { getChannelKnowledge, saveCompetitorInsights } from "../profile/repository";
import { getKnowledgeContext } from "../knowledge/repository";
import { getLocal } from "../local/repository";
import { getStyleHistory } from "../intelligence/NicheIntelligenceService";
import { getSeasonalityContext } from "./agents/SeasonalityAgent";
import { extractBestHourByFormat } from "./agents/BestTimeToPostAgent";
import { getLatestOptimalPostingSchedule, mapBestDaysToIsoWeekdays } from "./agents/OptimalPostingScheduleAgent";
import { getLatestContentDiversity, mapOverusedFormatForStrategy } from "./agents/ContentDiversityAgent";
import { generatePostImage } from "./image-generator";
import { buildImagePrompt } from "./image-prompt-builder";
import { env } from "@/lib/cf";
import { cleanOpening } from "./openers/cleanOpening";

// Handle real de la cuenta de Instagram conectada (OAuth) para este tenant/saas, si existe
// — prioriza la marcada como primaria (is_primary=1) entre las CONNECTED_REAL, y si ninguna
// lo está, cualquier Instagram conectado. Devuelve null si no hay ninguna cuenta conectada
// todavía (ej. cliente en onboarding) — buildProfile cae entonces al fallback de siempre
// (profile.channelName / @saasId). Usado por Reels y Carruseles por igual, ya que ambos
// construyen su BrandProfile a través de buildProfile().
async function resolvePrimaryInstagramHandle(tenantId: string, saasId: string): Promise<string | null> {
  const ctx = await resolveSocialContext({ tenantId, saasId });
  const accounts = await listSaasSocialAccounts(ctx);
  const primary =
    accounts.find((a) => a.provider === "INSTAGRAM" && a.status === "CONNECTED_REAL" && a.isPrimary) ??
    accounts.find((a) => a.provider === "INSTAGRAM" && a.status === "CONNECTED_REAL");
  return primary?.handle?.trim() || null;
}

// Objetivo propio de la campaña (saas_social_campaigns.objective), si la campaña define
// uno — sobrescribe el clientObjective del perfil solo para el contenido de esta campaña.
// Resiliente igual que resolvePrimaryInstagramHandle: nunca debe tumbar buildProfile.
async function resolveCampaignObjective(tenantId: string, saasId: string, campaignId: string | undefined) {
  if (!campaignId) return null;
  const ctx = await resolveSocialContext({ tenantId, saasId });
  const campaign = await getSaasSocialCampaignById(ctx, campaignId);
  return campaign?.objective ?? null;
}

export class SocialFlowOrchestrator {
  private marketResearch = new MarketResearchAgent();
  private keywordAgent = new KeywordAgent();
  private competitorAgent = new CompetitorAgent();
  private strategyAgent = new StrategyAgent();
  private contentGenerator = new ContentGeneratorAgent();
  private optimizationAgent = new OptimizationAgent();
  private schedulerAgent = new SchedulerAgent();
  private trendAgent = new TrendAgent();

  async buildProfile(input: SocialAIPipelineInput): Promise<BrandProfile> {
    // DracoEnv | null — mismo patrón que ContentGeneratorAgent/ReelsAgent para
    // getNicheIntelligence: se comprueba una vez y se degrada a Promise.resolve(null) si
    // no hay bindings (ej. entorno local sin Cloudflare), en vez de forzar un valor
    // "vacío" que no satisface el tipo DracoEnv (DRACO_DB es obligatorio en él).
    const dracoEnv = env();
    const [{ profile, competitors }, knowledgeContext, connectedInstagramHandle, campaignObjective, seasonalContextRaw, empresaLocal] = await Promise.all([
      getChannelKnowledge(input.tenantId, input.saasId),
      getKnowledgeContext(input.tenantId, input.saasId).catch(() => ""),
      // Handle real de Instagram (OAuth, saas_social_accounts) — fuente de verdad para
      // channelHandle. profile.channelName (socialflow_profiles.display_name) es un campo
      // de onboarding manual sin relación con la cuenta conectada; se usa solo como
      // fallback cuando el cliente aún no ha conectado ninguna cuenta de Instagram. Nunca
      // debe tumbar buildProfile si SOCIAL_DB falla — se degrada al fallback existente.
      resolvePrimaryInstagramHandle(input.tenantId, input.saasId).catch(() => null),
      resolveCampaignObjective(input.tenantId, input.saasId, input.campaignId).catch(() => null),
      // Usa input.niche directamente en vez de esperar a `niche` (línea de abajo, que
      // también cae a profile.niche) — SocialAIPipelineInput.niche es obligatorio en el
      // tipo, así que en la práctica ya está disponible aquí sin esperar a que resuelva
      // getChannelKnowledge; si algún caller lo manda vacío igualmente, getSeasonalityContext
      // devuelve null con gracia (mismo criterio que el resto de fetches de este Promise.all)
      // en vez de forzar una segunda ronda secuencial solo para este caso borde.
      dracoEnv
        ? getSeasonalityContext(input.niche, dracoEnv, input.tenantId, input.saasId).catch(() => null)
        : Promise.resolve(null),
      // Onboarding empresa (Empleados/Mi Local, saas_empresa_local) es un flujo separado
      // del onboarding genérico de marca/nicho (socialflow_profiles, arriba en `profile`)
      // — un cliente empresa puede completar uno sin el otro. Cuando existe,
      // business_name/niche/description de saas_empresa_local tienen prioridad sobre
      // socialflow_profiles para identidad de marca (ver brandName/niche/shortDescription
      // más abajo). Solo se consulta para cuentas empresa — un influencer no tiene "local".
      input.accountType === "empresa"
        ? getLocal(input.tenantId, input.saasId).catch(() => null)
        : Promise.resolve(null),
    ]);

    const niche = input.niche || empresaLocal?.niche || profile.niche || input.saasId;

    // seasonalTopics ya no es un campo manual del formulario de perfil (ver
    // profile/page.tsx) — lo gestiona la IA a partir de SeasonalityAgent. Tolera JSON
    // malformado sin tumbar buildProfile: seasonalTopics se queda en [] si el parseo
    // falla o el campo "themes" no viene en la forma esperada.
    let seasonalTopics: string[] = [];
    if (seasonalContextRaw) {
      try {
        const parsed: unknown = JSON.parse(seasonalContextRaw);
        const themes = parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>).themes : null;
        if (Array.isArray(themes)) {
          seasonalTopics = themes.filter((t): t is string => typeof t === "string");
        }
      } catch {
        // seasonalTopics se queda en []
      }
    }
    const tone = profile.toneOfVoice || input.tone || "neutro y profesional";
    // Nunca usar el saas_id técnico como nombre de marca visible — un identificador interno
    // (ej. "socialflow", herencia del rebrand a Socialcors) puede colarse literal en el
    // contenido generado si el tenant no completó el onboarding (ver bug carrusel Socialcors,
    // tenant 775444ce).
    const brandName = empresaLocal?.businessName || profile.brandName || "esta empresa";
    const shortDescription = empresaLocal?.description || profile.shortDescription || `${niche} social automation`;

    const baseLongDescription = profile.longDescription || shortDescription || `${niche} content pipeline`;
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
      shortDescription,
      longDescription,
      mission: profile.mission || `Grow ${brandName} with consistent social execution.`,
      valueProposition: profile.valueProposition || `${niche} content for ${profile.audienceDescription || "your audience"}.`,
      toneOfVoice: tone,
      personality: profile.personality || tone,
      voiceInstruction,
      accountType: input.accountType ?? null,
      ageRange: profile.ageRange || null,
      gender: profile.gender || null,
      // Si la campaña (input.campaignId) tiene su propio objetivo, sobrescribe el del
      // perfil solo para el contenido de esta campaña — ver saas_social_campaigns.objective.
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
      seasonalTopics,
      seasonalContext: seasonalContextRaw ?? "",
      marketSignals: profile.marketSignals,
      opportunitySignals: profile.opportunitySignals,
      demandSignals: profile.demandSignals.length ? profile.demandSignals : [niche],
      forbiddenTopics: profile.forbiddenTopics,
      prohibitedClaims: profile.prohibitedClaims,
      bannedWords: profile.bannedWords,
      forbiddenAngles: profile.forbiddenAngles,
    };
  }

  async generateFullCampaign(input: SocialAIPipelineInput): Promise<SocialAIPipelineResult> {
    const profile = await this.buildProfile(input);
    // competitorAgent/trendAgent/marketResearch son independientes entre sí (ninguno
    // depende del resultado de otro) — se paralelizan. marketResearch nunca debe romper
    // la generación de campaña: degrada a null ante cualquier fallo (ver comentario en
    // SocialAIPipelineResult — su output todavía no se propaga al resto del pipeline de
    // redacción, solo queda disponible en el resultado final).
    const [competitors, trends, marketResearch] = await Promise.all([
      this.competitorAgent.run({ niche: profile.niche }),
      this.trendAgent.run({ profile }),
      this.marketResearch.run({ profile, tenantId: input.tenantId, saasId: input.saasId }).catch((err) => {
        console.error("[SocialFlowOrchestrator] marketResearch failed, continuing without it", err instanceof Error ? err.message : String(err));
        return null;
      }),
    ]);
    // Persist AI-discovered competitor insights back into socialflow_profiles
    await saveCompetitorInsights(input.tenantId, competitors, input.saasId).catch(() => {});
    const ctx = await resolveSocialContext({ tenantId: input.tenantId, saasId: input.saasId });
    const channels = await listSaasSocialChannels(ctx);
    const { research, engine: keywordEngine } = await this.keywordAgent.run({ profile, trends });
    const numPosts = Math.max(1, Math.min(28, input.frequencyPerWeek));

    // ContentDiversityAgent — lee el snapshot ya calculado por el cron diario
    // (socialcors_content_diversity, nunca se re-ejecuta el agente en vivo aquí) y lo
    // traduce al único hint que StrategyAgent puede aplicar (solo elige entre
    // "carousel"/"reel" — un sobreuso de FEED/STORY no tiene nada que ajustar aquí, ver
    // mapOverusedFormatForStrategy). Degradación elegante: cualquier fallo deja
    // avoidFormat undefined y StrategyAgent cae exactamente al comportamiento de
    // siempre (alternancia 50/50 en la rama sin objetivo).
    let avoidFormat: "carousel" | "reel" | null = null;
    try {
      const dracoEnv = env();
      if (dracoEnv) {
        const diversity = await getLatestContentDiversity(input.tenantId, input.saasId, dracoEnv);
        avoidFormat = mapOverusedFormatForStrategy(diversity);
      }
    } catch (err) {
      console.error("[SocialFlowOrchestrator] content diversity lookup failed, falling back to no format preference", err instanceof Error ? err.message : String(err));
    }

    const strategy = await this.strategyAgent.run({ profile, horizonDays: numPosts, avoidFormat });
    const generatedPosts = [];
    const optimizedPosts = [];
    for (const item of strategy.items) {
      const generated = await this.contentGenerator.run({ profile, strategyItem: item, keywordEngine, trends, tenantId: input.tenantId, saasId: input.saasId });
      generatedPosts.push(generated);
      const optimized = await this.optimizationAgent.run({ profile, variant: generated.variants[0], keywordEngine });
      optimizedPosts.push(optimized);
    }
    // BestTimeToPostAgent — resuelto aquí (no dentro de SchedulerAgent, que se mantiene
    // síncrono y sin I/O) leyendo el snapshot más reciente de socialcors_style_history.
    // Degradación elegante: cualquier fallo deja optimalHoursByFormat undefined y
    // SchedulerAgent cae exactamente a las reglas de nicho de siempre.
    let optimalHoursByFormat: Partial<Record<SaasSocialContentType, number>> | undefined;
    try {
      const dracoEnv = env();
      if (dracoEnv) {
        const styleHistory = await getStyleHistory(input.tenantId, input.saasId, dracoEnv);
        const parsed = styleHistory[0] ? extractBestHourByFormat(styleHistory[0].snapshotJson) : null;
        if (parsed) {
          optimalHoursByFormat = Object.fromEntries(
            Object.entries(parsed).filter(([, hour]) => hour !== null),
          ) as Partial<Record<SaasSocialContentType, number>>;
        }
      }
    } catch (err) {
      console.error("[SocialFlowOrchestrator] bestHourByFormat lookup failed, falling back to niche rules", err instanceof Error ? err.message : String(err));
    }

    // OptimalPostingScheduleAgent — combina la HORA óptima de arriba con el DÍA óptimo:
    // lee el snapshot ya calculado por el cron diario (socialcors_posting_schedule,
    // nunca se re-ejecuta el agente en vivo aquí) y lo traduce a días ISO para que
    // SchedulerAgent los priorice. Degradación elegante: cualquier fallo deja
    // preferredWeekdays undefined y SchedulerAgent cae exactamente al comportamiento de
    // siempre (sin preferencia de día).
    let preferredWeekdays: number[] | undefined;
    try {
      const dracoEnv = env();
      if (dracoEnv) {
        const postingSchedule = await getLatestOptimalPostingSchedule(input.tenantId, input.saasId, dracoEnv);
        if (postingSchedule?.bestDays.length) {
          preferredWeekdays = mapBestDaysToIsoWeekdays(postingSchedule.bestDays);
        }
      }
    } catch (err) {
      console.error("[SocialFlowOrchestrator] posting schedule lookup failed, falling back to no day preference", err instanceof Error ? err.message : String(err));
    }

    const schedule = this.schedulerAgent.run({
      strategy: strategy.items as StrategyItem[],
      frequencyPerWeek: input.frequencyPerWeek,
      startDate: input.startDate ?? null,
      endDate: input.endDate ?? null,
      niche: profile.niche,
      optimalHoursByFormat,
      preferredWeekdays,
    });
    const campaignId = await this.persistToDb(input, profile, strategy.items as StrategyItem[], optimizedPosts, schedule);
    return { profile, research, keywords: research, competitors, marketResearch, strategy, generatedPosts, optimizedPosts, schedule, campaignId };
  }

  async generateStrategyOnly(input: SocialAIPipelineInput) { const profile = await this.buildProfile(input); const competitors = await this.competitorAgent.run({ niche: profile.niche }); const trends = await this.trendAgent.run({ profile }); const { research } = await this.keywordAgent.run({ profile, trends }); const strategy = await this.strategyAgent.run({ profile, horizonDays: 7 }); return { profile, research, keywords: research, competitors, strategy }; }
  async generateSinglePost(input: SocialAIPipelineInput) { const profile = await this.buildProfile(input); const trends = await this.trendAgent.run({ profile }); const { engine: keywordEngine } = await this.keywordAgent.run({ profile, trends }); const strategy = await this.strategyAgent.run({ profile, horizonDays: 1 }); const item = strategy.items[0]; const generated = await this.contentGenerator.run({ profile, strategyItem: item, keywordEngine, trends, tenantId: input.tenantId, saasId: input.saasId }); const optimized = await this.optimizationAgent.run({ profile, variant: generated.variants[0], keywordEngine }); return { profile, strategyItem: item, generated, optimized }; }

  private async persistToDb(input: SocialAIPipelineInput, profile: BrandProfile, strategyItems: StrategyItem[], optimizedPosts: { id: string; improvedText: string; hashtags?: string[] }[], schedule: { id: string; postId: string; scheduledAt: string }[]): Promise<string> {
    const ctx = await resolveSocialContext({ tenantId: input.tenantId, saasId: input.saasId });
    const campaign = await upsertSaasSocialCampaign(ctx, { id: input.campaignId ?? `ai_campaign_${Date.now()}`, saasId: input.saasId, name: `IA: ${input.niche}`, objective: null, status: "ACTIVE", targetSegment: "DEFAULT", startDate: input.startDate ?? null, endDate: input.endDate ?? null, budgetEstimate: null, notes: `Generated for ${input.niche}` });
    const channels = await listSaasSocialChannels(ctx);
    const postProvider = input.provider ?? "INSTAGRAM";
    const channelId = channels.find(c => c.provider === postProvider)?.id ?? null;
    let savedCount = 0;
    for (const item of strategyItems) {
      try {
        const sched = schedule.find((entry) => entry.postId === item.id);
        // OptimizationAgent stores id as variant.id ("gen_day_1_v1"); match by prefix to handle that.
        const optimized = optimizedPosts.find(
          (entry) => entry.id === `gen_${item.id}` || entry.id === item.id || entry.id.startsWith(`gen_${item.id}_`),
        );
        const postId = `ai_post_${campaign.id}_${item.id}`;
        const body = optimized?.improvedText ? cleanOpening(optimized.improvedText) : item.angle;
        const imagePrompt = buildImagePrompt({ theme: item.theme, angle: item.angle, body }, profile);
        const imageHint = await generatePostImage(imagePrompt, postId, input.tenantId);
        const postProvider = input.provider ?? "INSTAGRAM";
        // Instagram no publica sin imagen: un post así se queda en DRAFT marcado para
        // revisión manual, y TrendAutoApproveCron no lo aprueba (ver su filtro de
        // image_hint) — antes llegaba a SCHEDULED y fallaba al publicar con
        // INSTAGRAM_MEDIA_REQUIRED.
        const imageGenerationFailed = postProvider === "INSTAGRAM" && !imageHint;
        const hashtags = (optimized?.hashtags ?? []).slice(0, 15);
        const contentType: SaasSocialContentType = STRATEGY_FORMAT_TO_CONTENT_TYPE[item.format] ?? "FEED";
        await upsertSaasSocialPost(ctx, { id: postId, saasId: input.saasId, channelId, campaignId: campaign.id, provider: postProvider, contentType, title: item.theme, body, imageHint, status: "DRAFT", scheduledAt: sched?.scheduledAt ?? null, postedAt: null, externalPostId: null, creationMode: "AUTO", metadata: { targetProvider: postProvider, strategyItemId: item.id, scheduledAt: sched?.scheduledAt ?? null, hashtags, angle: item.angle, callToAction: item.callToAction, ...(imageGenerationFailed ? { error_message: "IMAGE_GENERATION_FAILED" } : {}) } }, { applyTrialCaptionLink: input.applyTrialCaptionLink });
        savedCount++;
      } catch (postError) {
        console.error(`[SocialFlowOrchestrator] Failed to persist post for item ${item.id}`, postError instanceof Error ? postError.message : String(postError));
      }
    }
    console.log(`[SocialFlowOrchestrator] Saved ${savedCount}/${strategyItems.length} posts for campaign ${campaign.id}`);
    return campaign.id;
  }
}
