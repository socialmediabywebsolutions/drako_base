export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { env } from "@/lib/cf";
import { requireCurrentSocialFlowSession } from "@/lib/socialflow/auth/request";
import { guardAiAccess, isActiveSocialFlowTrial } from "@/lib/socialflow/billing/enforce";
import { resolveSocialContext, upsertSaasSocialCampaign, upsertSaasSocialPost } from "@/lib/socialflow/repository";
import { publishSocialPostLive } from "@/lib/socialflow/live-publishing";
import { BestTimeToPostAgent } from "@/lib/socialflow/ai/agents/BestTimeToPostAgent";
import { getKnowledgeContext } from "@/lib/socialflow/knowledge/repository";
import { getChannelProfile } from "@/lib/socialflow/profile/repository";
import { getNicheIntelligence, getStyleHistory, safeParseObject } from "@/lib/socialflow/intelligence/NicheIntelligenceService";
import { extractTrendSignals } from "@/lib/socialflow/intelligence/TrendKeywordAgent";
import { extractEngagementPatterns } from "@/lib/socialflow/intelligence/CrossTenantIntelligenceAgent";
import { ContentFatigueAgent, type ContentFatigueResult } from "@/lib/socialflow/ai/agents/ContentFatigueAgent";
import { calculateViralScore, mapContentTypeToViralFormat } from "@/lib/socialflow/intelligence/ViralScoreAgent";
import { getLatestPerformanceSnapshot } from "@/lib/socialflow/ai/agents/ContentPerformanceAgent";
import { getInfluencerBenchmark } from "@/lib/socialflow/intelligence/InfluencerBenchmarkAgent";
import { getLatestHashtagIntelligence } from "@/lib/socialflow/ai/agents/HashtagIntelligenceAgent";
import { getLatestAudienceGrowth } from "@/lib/socialflow/ai/agents/AudienceGrowthAgent";
import { getLatestOptimalPostingSchedule } from "@/lib/socialflow/ai/agents/OptimalPostingScheduleAgent";
import type { ImageAnalysis } from "@/lib/socialflow/ai/agents/ImageAnalysisAgent";

// ---------------------------------------------------------------------------
// Intent extraction — uses Workers AI Llama when available, regex fallback
// ---------------------------------------------------------------------------

type ParsedIntent = {
  action: "generate" | "modify" | "chat" | "ideas";
  topic: string;
  tone: string;
  frequencyPerWeek: number;
  reply: string;
};

type IdeaFormat = "reel" | "carrusel" | "post";

type IdeaSuggestion = {
  hook: string;
  format: IdeaFormat;
  whyViral: string;
};

type DateRange = {
  startDate: string;
  endDate: string;
  dateLabel: string;
};

type ProviderKey = "INSTAGRAM" | "LINKEDIN" | "FACEBOOK_PAGE" | "TIKTOK";

const GENERATE_KEYWORDS_ES = ["genera", "crea", "quiero", "necesito", "haz", "hazme", "prepara", "campaña", "posts", "publicaciones", "contenido"];
const MODIFY_KEYWORDS_ES = ["cambia", "modifica", "actualiza", "mejora", "regenera", "hazlos", "más formal", "más casual", "más corto", "más largo", "cambia el tono"];
// Comprobado DESPUÉS de generate/modify en parseIntentFallback — un "genera contenido
// con tendencias virales" explícito no debe robárselo esta lista, solo mensajes que
// piden ideas sin pedir generación directa (ver auditoría previa de esta ruta).
const IDEAS_KEYWORDS_ES = ["ideas", "qué grabo", "que grabo", "qué creo", "que creo", "qué publico", "que publico", "viral", "tendencias", "inspiración", "inspiracion", "crecer", "cómo crezco", "como crezco", "ganar seguidores", "más seguidores", "mas seguidores", "audiencia nueva", "cada cuánto publico", "cada cuanto publico", "qué día publico", "que dia publico", "ritmo de publicación", "ritmo de publicacion"];
// Solo se evalúa cuando el cliente ya reenvió lastIdeas (ver POST) — nunca se dispara
// sobre un mensaje "genera..." en frío, así que no choca con GENERATE_KEYWORDS_ES.
const CONFIRM_IDEA_KEYWORDS_ES = ["créalo tú", "crealo tu", "hazlo tú", "hazlo tu", "créalo", "crealo", "hazlo", "genera"];

const MONTHS_ES: Record<string, number> = {
  enero: 0, febrero: 1, marzo: 2, abril: 3, mayo: 4, junio: 5,
  julio: 6, agosto: 7, septiembre: 8, octubre: 9, noviembre: 10, diciembre: 11,
};

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function startOfISOWeek(d: Date): Date {
  const day = d.getDay(); // 0=Sun
  const diff = day === 0 ? -6 : 1 - day; // shift to Monday
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + diff);
}

function extractDateRange(message: string): DateRange {
  const lower = message.toLowerCase();
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const DAY_MS = 86_400_000;

  // "los próximos N días"
  const proximosDias = lower.match(/(?:los?\s+)?pr[oó]ximos?\s+(\d+)\s+d[ií]as?/);
  if (proximosDias) {
    const days = parseInt(proximosDias[1]);
    const end = new Date(today.getTime() + (days - 1) * DAY_MS);
    return { startDate: toDateStr(today), endDate: toDateStr(end), dateLabel: `próximos ${days} días` };
  }

  // "la próxima semana" before "esta semana" (longer match wins)
  if (/(?:la\s+)?pr[oó]xima\s+semana/.test(lower)) {
    const nextMon = startOfISOWeek(new Date(today.getTime() + 7 * DAY_MS));
    const nextSun = new Date(nextMon.getTime() + 6 * DAY_MS);
    return { startDate: toDateStr(nextMon), endDate: toDateStr(nextSun), dateLabel: "próxima semana" };
  }

  // "esta semana"
  if (/\besta\s+semana\b/.test(lower)) {
    const mon = startOfISOWeek(today);
    const sun = new Date(mon.getTime() + 6 * DAY_MS);
    return { startDate: toDateStr(mon), endDate: toDateStr(sun), dateLabel: "esta semana" };
  }

  // "del D al D de MES" or "del D de MES al D de MES"
  const rangeMatch = lower.match(/del?\s+(\d+)\s+(?:de\s+(\w+)\s+)?al?\s+(\d+)\s+de\s+(\w+)/);
  if (rangeMatch) {
    const [, d1, m1Raw, d2, m2Raw] = rangeMatch;
    const month2 = MONTHS_ES[m2Raw];
    if (month2 !== undefined) {
      const month1 = m1Raw ? (MONTHS_ES[m1Raw] ?? month2) : month2;
      const year = now.getFullYear() + (month2 < now.getMonth() ? 1 : 0);
      const start = new Date(year, month1, parseInt(d1));
      const end = new Date(year, month2, parseInt(d2));
      return { startDate: toDateStr(start), endDate: toDateStr(end), dateLabel: `${d1} al ${d2} de ${m2Raw}` };
    }
  }

  // "este mes"
  if (/\beste\s+mes\b/.test(lower)) {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return { startDate: toDateStr(start), endDate: toDateStr(end), dateLabel: "este mes" };
  }

  // Solo nombre de mes: "julio", "agosto", etc.
  for (const [name, month] of Object.entries(MONTHS_ES)) {
    if (lower.includes(name)) {
      const year = now.getFullYear() + (month < now.getMonth() ? 1 : 0);
      const start = new Date(year, month, 1);
      const end = new Date(year, month + 1, 0);
      return { startDate: toDateStr(start), endDate: toDateStr(end), dateLabel: name };
    }
  }

  // Default: current week (Mon → Sun)
  const mon = startOfISOWeek(today);
  const sun = new Date(mon.getTime() + 6 * DAY_MS);
  return { startDate: toDateStr(mon), endDate: toDateStr(sun), dateLabel: "esta semana" };
}

function extractProvider(message: string): ProviderKey {
  const lower = message.toLowerCase();
  if (/instagram|ig\b/.test(lower)) return "INSTAGRAM";
  if (/linkedin|linked\s*in/.test(lower)) return "LINKEDIN";
  if (/facebook|fb\b/.test(lower)) return "FACEBOOK_PAGE";
  if (/tiktok/.test(lower)) return "TIKTOK";
  return "INSTAGRAM";
}

function extractFrequency(message: string): number {
  const m = message.match(/(\d+)\s*(?:post|publicaci|contenid|por\s*semana|a\s*la\s*semana)/i);
  if (m) {
    const n = parseInt(m[1], 10);
    if (n >= 1 && n <= 28) return n;
  }
  return 7;
}

function extractTopic(message: string): string {
  return message
    .replace(/\b(genera|crea|quiero|necesito|haz|hazme|prepara|una|un|los|las|mi|mis)\b/gi, "")
    .replace(/\b(\d+)\s*(posts?|publicaciones?)\b/gi, "")
    .replace(/\b(esta semana|este mes|para hoy|la próxima semana|próxima semana)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}

async function parseIntentWithAI(
  message: string,
  knowledgeContext: string,
  defaultTone: string,
  defaultNiche: string,
  regexAction: "generate" | "modify" | "chat" | "ideas",
): Promise<ParsedIntent | null> {
  const e = env();
  if (!e?.AI) return null;

  const systemPrompt = `Eres un asistente de marketing que extrae parámetros de campaña de mensajes en español. Devuelve SOLO JSON válido, sin markdown ni explicación.

Contexto de marca:
${knowledgeContext || `Nicho: ${defaultNiche}. Tono: ${defaultTone}.`}

Estructura JSON requerida:
{
  "action": "generate" | "modify" | "chat" | "ideas",
  "topic": "<tema de campaña en español, máx 80 chars>",
  "tone": "<tono de comunicación, usa el default de marca si no se especifica>",
  "frequencyPerWeek": <entero 1-28>,
  "reply": "<respuesta al usuario en español, 1-2 frases, confirma la acción sin hacer preguntas>"
}

REGLAS CRÍTICAS:
- Si el usuario menciona posts, publicaciones, campaña, contenido, crear, generar → action DEBE ser "generate". NUNCA devuelvas "chat" en ese caso.
- Si el usuario pide cambiar/modificar posts existentes → action="modify".
- Si el usuario pide ideas, inspiración, qué está viral o qué debería publicar (sin pedir generar una campaña completa) → action="ideas".
- action="chat" SOLO para saludos o preguntas que no pidan contenido ni ideas.
- reply NO debe hacer preguntas. Debe confirmar la acción con los datos disponibles y decir que ya está generando.
- frequencyPerWeek: extrae el número del mensaje. Si dice "3 posts" → 3. Si no se menciona → 7.
- NUNCA pidas más información. Genera con lo que el usuario ya dio.`;

  try {
    const result = await e.AI.run("@cf/meta/llama-3.1-70b-instruct", {
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: message },
      ],
    }) as { response?: string };

    const raw = result?.response?.trim() ?? "";
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]) as Partial<ParsedIntent>;

    // Regex intent is authoritative for action: prevent AI from downgrading a
    // detected generate/modify to chat (the common failure mode with LLMs).
    const action = regexAction !== "chat" ? regexAction : (parsed.action ?? "chat");

    const freq = typeof parsed.frequencyPerWeek === "number" && parsed.frequencyPerWeek >= 1
      ? parsed.frequencyPerWeek
      : extractFrequency(message);

    return {
      action,
      topic: (parsed.topic ?? extractTopic(message)) || defaultNiche,
      tone: parsed.tone ?? defaultTone,
      frequencyPerWeek: freq,
      reply: parsed.reply ?? "Entendido, generando tu campaña...",
    };
  } catch {
    return null;
  }
}

const PROVIDER_LABEL: Record<ProviderKey, string> = {
  INSTAGRAM: "Instagram",
  LINKEDIN: "LinkedIn",
  FACEBOOK_PAGE: "Facebook",
  TIKTOK: "TikTok",
};

function parseIntentFallback(
  message: string,
  defaultTone: string,
  defaultNiche: string,
  provider: ProviderKey,
  dateLabel: string,
): ParsedIntent {
  const lower = message.toLowerCase();
  const isGenerate = GENERATE_KEYWORDS_ES.some((k) => lower.includes(k));
  const isModify = MODIFY_KEYWORDS_ES.some((k) => lower.includes(k));
  const isIdeas = IDEAS_KEYWORDS_ES.some((k) => lower.includes(k));

  const action = isModify ? "modify" : isGenerate ? "generate" : isIdeas ? "ideas" : "chat";
  const freq = extractFrequency(message);
  const topic = extractTopic(message) || defaultNiche;

  const replyMap: Record<string, string> = {
    generate: `Perfecto, voy a generar ${freq} posts sobre "${topic}" para ${PROVIDER_LABEL[provider]} — ${dateLabel}. Dame un momento...`,
    modify: "Entendido. Voy a regenerar los posts con los cambios solicitados.",
    ideas: "Dame un momento, reviso qué está funcionando en tu nicho ahora mismo...",
    chat: "Puedo ayudarte a generar campañas y posts. Dime qué contenido necesitas y cuántos posts quieres.",
  };

  return { action, topic, tone: defaultTone, frequencyPerWeek: freq, reply: replyMap[action] };
}

// ---------------------------------------------------------------------------
// "ideas" intent — datos reales de socialcors_niche_intelligence, nunca inventados
// (ver auditoría: getNicheIntelligence expone el mismo `analysis` del que se extraen
// TANTO trendSignals — qué está sonando ahora, sin números — COMO engagementPatterns
// — avgEngagement/tenantsReporting reales, vía CrossTenantIntelligenceAgent). Una sola
// llamada a getNicheIntelligence basta para ambas fuentes.
// ---------------------------------------------------------------------------

type NicheDataForIdeas = {
  trendHooks: string[];
  topEngagementHooks: { hook: string; avgEngagement: number; tenantsReporting: number }[];
  topEngagementFormats: { format: string; avgEngagement: number; tenantsReporting: number }[];
};

async function loadNicheDataForIdeas(
  niche: string,
  dracoEnv: ReturnType<typeof env>,
  tenantId: string,
  saasId: string,
  accountType: "influencer" | "empresa",
): Promise<NicheDataForIdeas | null> {
  if (!dracoEnv) return null;
  const intel = await getNicheIntelligence(niche, dracoEnv, tenantId, saasId, accountType);
  if (!intel) return null;

  const trendSignals = extractTrendSignals(intel.analysis);
  const engagementPatterns = extractEngagementPatterns(intel.analysis);
  if (!trendSignals && !engagementPatterns) return null;

  return {
    trendHooks: [
      ...(trendSignals?.youtubeHooks ?? []),
      ...(trendSignals?.redditTopics ?? []),
      ...(trendSignals?.globalTrends ?? []),
    ].slice(0, 10),
    topEngagementHooks: (engagementPatterns?.hooksQueFuncionanRealmente ?? []).slice(0, 5),
    topEngagementFormats: (engagementPatterns?.formatosGanadoresReales ?? []).slice(0, 5),
  };
}

function formatNicheDataForPrompt(data: NicheDataForIdeas): string {
  const lines: string[] = [];
  if (data.topEngagementHooks.length) {
    lines.push("Hooks con engagement real medido en tu nicho:");
    for (const h of data.topEngagementHooks) {
      lines.push(`- "${h.hook}": engagement medio ${h.avgEngagement} (${h.tenantsReporting} cuentas reales reportando)`);
    }
  }
  if (data.topEngagementFormats.length) {
    lines.push("Formatos con mejor rendimiento real en tu nicho:");
    for (const f of data.topEngagementFormats) {
      lines.push(`- ${f.format}: engagement medio ${f.avgEngagement} (${f.tenantsReporting} cuentas reales reportando)`);
    }
  }
  if (data.trendHooks.length) {
    lines.push(`Temas/hooks sonando ahora mismo (YouTube/Reddit/tendencias globales): ${data.trendHooks.join(", ")}`);
  }
  return lines.join("\n");
}

// Fatiga (ContentFatigueAgent) + estilo aprendido (snapshot más reciente de
// getStyleHistory) como contexto adicional para el chat — barato: ContentFatigueAgent
// solo lee posts en vivo (sin LLM), y getStyleHistory lee el snapshot ya calculado por
// el cron diario style-learning en vez de re-ejecutar StyleLearningAgent (caro: posts +
// métricas + LLM). Silencioso ante falta de datos (<5 posts, o sin snapshot todavía) —
// nunca bloquea ni ensucia el prompt con un bloque vacío.
async function loadFatigueAndStyleBlock(
  tenantId: string,
  saasId: string,
  dracoEnv: ReturnType<typeof env>,
): Promise<{ block: string; fatigue: ContentFatigueResult | null }> {
  const [fatigue, styleHistory] = await Promise.all([
    new ContentFatigueAgent().run({ tenantId, saasId }).catch(() => null),
    dracoEnv ? getStyleHistory(tenantId, saasId, dracoEnv).catch(() => []) : Promise.resolve([]),
  ]);

  const lines: string[] = [];
  if (fatigue?.hookFatigued) {
    lines.push(`EVITAR: el hook "${fatigue.hookStreak.value}" está sobreusado (${fatigue.hookStreak.length} veces seguidas) — NO lo sugieras.`);
  }
  if (fatigue?.formatFatigued) {
    lines.push(`EVITAR: el formato "${fatigue.formatStreak.value}" está sobreusado (${fatigue.formatStreak.length} veces seguidas) — si tiene sentido, sugiere un formato distinto.`);
  }

  const latestSnapshot = styleHistory[0] ?? null;
  const parsedSnapshot = latestSnapshot ? safeParseObject(latestSnapshot.snapshotJson) : null;
  const summaryText = typeof parsedSnapshot?.summaryText === "string" ? parsedSnapshot.summaryText.trim() : "";
  if (summaryText) {
    lines.push(`Estilo real de este cliente (de sus propios posts publicados): ${summaryText}`);
  }

  return { block: lines.join("\n"), fatigue };
}

// Mix de hashtags recomendado (HashtagIntelligenceAgent) — snapshot ya calculado por el
// cron diario de style-learning, nunca se re-ejecuta en vivo aquí (posts + llamada a
// Mistral). Universal para cualquier accountType, a diferencia del benchmark de
// influencers. Silencioso si no hay snapshot todavía (tenant nuevo, o <5 posts con
// hashtags reales).
async function loadHashtagIntelligenceBlock(
  tenantId: string,
  saasId: string,
  dracoEnv: ReturnType<typeof env>,
): Promise<string> {
  const hashtagIntel = dracoEnv ? await getLatestHashtagIntelligence(tenantId, saasId, dracoEnv).catch(() => null) : null;
  if (!hashtagIntel) return "";

  const { recommendedMix, overusedHashtags, insight } = hashtagIntel;
  const mixLine = [...recommendedMix.niche, ...recommendedMix.trending, ...recommendedMix.reach].join(" ");

  return [
    mixLine ? `Mix de hashtags recomendado para este cliente (nicho + tendencia + alcance): ${mixLine}` : "",
    overusedHashtags.length ? `Hashtags que este cliente ya tiene sobreusados (evita repetirlos): ${overusedHashtags.join(" ")}` : "",
    insight ? `Por qué: ${insight}` : "",
  ].filter(Boolean).join("\n");
}

// Insight de AudienceGrowthAgent — snapshot ya calculado por el cron diario de
// style-learning, nunca se re-ejecuta en vivo aquí (posts + métricas + LLM). Silencioso
// si no hay snapshot todavía (tenant nuevo, o <5 posts con métricas reales).
async function loadAudienceGrowthBlock(
  tenantId: string,
  saasId: string,
  dracoEnv: ReturnType<typeof env>,
): Promise<string> {
  const growth = dracoEnv ? await getLatestAudienceGrowth(tenantId, saasId, dracoEnv).catch(() => null) : null;
  if (!growth) return "";

  return [
    `Sobre qué atrae audiencia nueva vs. qué fideliza a la que ya tiene: ${growth.insight}`,
    `Recomendación para crecer: ${growth.recommendation}`,
  ].join("\n");
}

// Insight de OptimalPostingScheduleAgent (ritmo: días, separación entre posts, orden de
// formatos) — snapshot ya calculado por el cron diario de style-learning, nunca se
// re-ejecuta en vivo aquí. Silencioso si no hay snapshot todavía (tenant nuevo, o <10
// posts con métricas reales).
async function loadPostingScheduleBlock(
  tenantId: string,
  saasId: string,
  dracoEnv: ReturnType<typeof env>,
): Promise<string> {
  const schedule = dracoEnv ? await getLatestOptimalPostingSchedule(tenantId, saasId, dracoEnv).catch(() => null) : null;
  if (!schedule) return "";

  return [
    schedule.bestDays.length ? `Días de la semana con mejor engagement para este cliente: ${schedule.bestDays.join(", ")}` : "",
    `Separación entre posts que mejor le funciona: ${schedule.optimalGapDays} día(s) de descanso.`,
    schedule.bestFormatSequence.length ? `Orden de formatos con mejor rendimiento acumulado: ${schedule.bestFormatSequence.join(" → ")}` : "",
    `Por qué: ${schedule.insight}`,
    `Recomendación de calendario semanal: ${schedule.weeklyScheduleRecommendation}`,
  ].filter(Boolean).join("\n");
}

// Separa los hashtags inline del caption generado por el modelo — calculateViralScore
// espera un caption "limpio" + un array de hashtags aparte (mismo contrato que ya usan
// generate-from-image/generate-ai-carousel), y publishOptions/pendingPost también
// necesitan el caption limpio con los hashtags movidos a metadata (ver
// buildPostCaption en live-publishing.ts, que arma el caption final como
// body + metadata.hashtags — sin esto los hashtags se perderían al publicar).
function extractHashtags(text: string): { cleanCaption: string; hashtags: string[] } {
  const hashtags = text.match(/#\w+/g) ?? [];
  const cleanCaption = text
    .replace(/#\w+/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return { cleanCaption, hashtags };
}

// saas_social_posts.content_type real ("FEED"|"REEL"|"STORY"|"SHORT"|"CAROUSEL") →
// el trío que espera la UI del chat. STORY/FEED se pliegan a "post" — no hay un cuarto
// bucket en el diseño pedido.
function mapContentTypeToIdeaFormat(contentType: string): IdeaFormat {
  if (contentType === "REEL" || contentType === "SHORT") return "reel";
  if (contentType === "CAROUSEL") return "carrusel";
  return "post";
}

function buildFallbackIdeas(data: NicheDataForIdeas, niche: string): IdeaSuggestion[] {
  const ideas: IdeaSuggestion[] = [];
  for (const h of data.topEngagementHooks.slice(0, 2)) {
    ideas.push({
      hook: h.hook,
      format: "reel",
      whyViral: `Engagement medio de ${h.avgEngagement} en tu nicho, reportado por ${h.tenantsReporting} cuentas reales.`,
    });
  }
  const topFormat = data.topEngagementFormats[0];
  if (topFormat && ideas.length < 3) {
    ideas.push({
      hook: data.trendHooks[0] ?? niche,
      format: mapContentTypeToIdeaFormat(topFormat.format),
      whyViral: `El formato ${topFormat.format} tiene engagement medio ${topFormat.avgEngagement} en tu nicho (${topFormat.tenantsReporting} cuentas reales).`,
    });
  }
  return ideas;
}

function formatIdeasReply(ideas: IdeaSuggestion[]): string {
  return ideas
    .map((idea, i) => `${i + 1}. **${idea.hook}** (${idea.format})\n   Por qué puede funcionar: ${idea.whyViral}`)
    .join("\n\n");
}

async function buildIdeasReply(
  niche: string,
  dracoEnv: ReturnType<typeof env>,
  tenantId: string,
  saasId: string,
  accountType: "influencer" | "empresa",
): Promise<{ reply: string; ideas: IdeaSuggestion[] }> {
  const data = await loadNicheDataForIdeas(niche, dracoEnv, tenantId, saasId, accountType).catch(() => null);

  if (!data) {
    return {
      reply:
        "Todavía no tengo suficientes datos de tendencias para tu nicho — el Cerebro necesita que corra al menos una vez el análisis semanal. Mientras tanto, puedo generarte una campaña con lo que ya sé de tu marca si querés.",
      ideas: [],
    };
  }

  if (dracoEnv?.AI) {
    try {
      const dataBlock = formatNicheDataForPrompt(data);
      const { block: fatigueStyleBlock } = await loadFatigueAndStyleBlock(tenantId, saasId, dracoEnv);

      // Insight de ContentPerformanceAgent — snapshot ya calculado por el cron diario
      // de style-learning (nunca se re-ejecuta el agente en vivo aquí: hace su propia
      // llamada a Mistral, igual de caro que StyleLearningAgent). Silencioso si no hay
      // snapshot todavía (tenant nuevo, o <5 posts con métricas reales).
      const perfSnapshot = dracoEnv ? await getLatestPerformanceSnapshot(tenantId, saasId, dracoEnv).catch(() => null) : null;
      const perfInsightRaw = perfSnapshot ? safeParseObject(perfSnapshot.snapshotJson)?.insight : null;
      const perfInsight = typeof perfInsightRaw === "string" ? perfInsightRaw.trim() : "";

      // Benchmark de influencers reales de YouTube — solo tiene sentido para cuentas
      // influencer (una empresa no compite por suscriptores de canal); cero coste extra
      // para accountType="empresa", ni siquiera se llama.
      const influencerBenchmark =
        accountType === "influencer" && dracoEnv
          ? await getInfluencerBenchmark(niche, dracoEnv, tenantId, saasId).catch(() => null)
          : null;
      const benchmarkBlock = influencerBenchmark
        ? `\nCómo lo hacen los canales de YouTube más vistos esta semana en tu nicho: ${influencerBenchmark.insight}\n`
        : "";

      const hashtagBlock = await loadHashtagIntelligenceBlock(tenantId, saasId, dracoEnv);
      const growthBlock = await loadAudienceGrowthBlock(tenantId, saasId, dracoEnv);
      const scheduleBlock = await loadPostingScheduleBlock(tenantId, saasId, dracoEnv);

      const prompt = `Eres un estratega de contenido. Con estos datos REALES de la cuenta y su nicho (nunca inventes cifras nuevas ni datos que no estén aquí):

${dataBlock}
${fatigueStyleBlock ? `\n${fatigueStyleBlock}\n` : ""}${perfInsight ? `\nTus posts con mejor rendimiento histórico usaron estos patrones: ${perfInsight}\n` : ""}${benchmarkBlock}${hashtagBlock ? `\n${hashtagBlock}\n` : ""}${growthBlock ? `\n${growthBlock}\n` : ""}${scheduleBlock ? `\n${scheduleBlock}\n` : ""}
Propón exactamente 3 ideas de contenido concretas para hoy. Responde SOLO con JSON válido, sin markdown, con esta forma exacta:
{"ideas": [{"hook": "...", "format": "reel"|"carrusel"|"post", "whyViral": "..."}]}

Cada "whyViral" debe citar un dato real de arriba (una cifra de engagement, cuántas cuentas lo reportan, o que está sonando ahora) — nunca una cifra inventada. Responde todo en español.`;

      const result = (await dracoEnv.AI.run("@cf/meta/llama-3.1-70b-instruct", {
        messages: [{ role: "user", content: prompt }],
      })) as { response?: string };

      const raw = result?.response?.trim() ?? "";
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]) as { ideas?: unknown };
        if (Array.isArray(parsed.ideas)) {
          const ideas = parsed.ideas
            .filter(
              (i): i is IdeaSuggestion =>
                Boolean(i) &&
                typeof i === "object" &&
                typeof (i as IdeaSuggestion).hook === "string" &&
                typeof (i as IdeaSuggestion).whyViral === "string" &&
                ["reel", "carrusel", "post"].includes((i as IdeaSuggestion).format),
            )
            .slice(0, 3);
          if (ideas.length) {
            return { reply: formatIdeasReply(ideas), ideas };
          }
        }
      }
    } catch {
      // cae al fallback determinista de abajo — nunca deja al usuario sin respuesta
    }
  }

  // Fallback determinista — sin IA disponible o respuesta inválida, se listan los
  // datos reales directamente, sin paráfrasis, para no romper la regla de "nunca
  // inventar" ni siquiera en este camino.
  const fallbackIdeas = buildFallbackIdeas(data, niche);
  if (!fallbackIdeas.length) {
    return {
      reply: "Todavía no tengo suficientes datos de engagement real en tu nicho para sugerir ideas con números concretos.",
      ideas: [],
    };
  }
  return { reply: formatIdeasReply(fallbackIdeas), ideas: fallbackIdeas };
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(request: Request) {
  try {
    const session = await requireCurrentSocialFlowSession(request);

    const aiGuard = await guardAiAccess(session.tenantId, session.role);
    if (!aiGuard.ok) {
      return NextResponse.json(
        { ok: false, error: aiGuard.code, message: aiGuard.message },
        { status: 403 },
      );
    }

    const body = (await request.json().catch(() => null)) as {
      message?: string;
      saasId?: string;
      lastIdeas?: IdeaSuggestion[];
      imageKey?: string;
      imageAnalysis?: ImageAnalysis;
      imageConversation?: { role: "user" | "assistant"; content: string }[];
      publishAction?: "now" | "schedule";
      pendingPost?: { title?: string; body?: string; imageHint?: string; contentType?: string; hashtags?: string[] };
    } | null;

    if (!body?.message?.trim()) {
      return NextResponse.json({ ok: false, error: "message is required" }, { status: 400 });
    }

    const saasId = body.saasId ?? "socialflow";
    const userMessage = body.message.trim();

    // Publicación directa desde el chat — se evalúa ANTES que cualquier otra rama:
    // un click en "Publicar ahora"/"Programar" nunca debe pasar por el parseo de
    // intención genérico ni por la conversación de imagen, aunque el cliente siga
    // mandando imageKey/imageAnalysis de la conversación activa.
    if (body.publishAction && body.pendingPost) {
      const PUBLISHABLE_CONTENT_TYPES = new Set(["FEED", "REEL", "STORY"]);
      const title = body.pendingPost.title?.trim() ?? "";
      const postBody = body.pendingPost.body?.trim() ?? "";
      const imageHint = body.pendingPost.imageHint?.trim() ?? "";
      const contentType = body.pendingPost.contentType ?? "";
      const hashtags = (body.pendingPost.hashtags ?? []).filter((h): h is string => typeof h === "string" && h.trim().length > 0);
      const metadata = hashtags.length ? { hashtags } : null;

      if (!title || !postBody || !imageHint || !PUBLISHABLE_CONTENT_TYPES.has(contentType)) {
        return NextResponse.json(
          { ok: false, error: "INVALID_PENDING_POST", message: "title, body, imageHint and a valid contentType (FEED/REEL/STORY) are required" },
          { status: 400 },
        );
      }

      const ctx = await resolveSocialContext({ tenantId: session.tenantId, saasId });
      const applyTrialCaptionLink = await isActiveSocialFlowTrial(session.tenantId, session.role);
      const validContentType = contentType as "FEED" | "REEL" | "STORY";

      if (body.publishAction === "now") {
        try {
          const post = await upsertSaasSocialPost(ctx, {
            saasId,
            campaignId: null,
            channelId: null,
            provider: "INSTAGRAM",
            contentType: validContentType,
            title: title.slice(0, 72),
            body: postBody,
            imageHint,
            status: "SCHEDULED",
            scheduledAt: new Date().toISOString(),
            postedAt: null,
            externalPostId: null,
            creationMode: "MANUAL",
            metadata,
          }, { applyTrialCaptionLink });

          const result = await publishSocialPostLive(ctx, post.id, { skipClaim: true });
          if (!result.ok) {
            return NextResponse.json({
              ok: false,
              action: "publish_failed",
              postId: post.id,
              error: result.code,
              message: result.message ?? "No se pudo publicar el post.",
            });
          }
          return NextResponse.json({ ok: true, action: "published", postId: post.id, reply: "✅ Publicado en Instagram." });
        } catch (error) {
          console.error("SOCIALFLOW_AI_CHAT_PUBLISH_NOW_ERROR", error);
          return NextResponse.json(
            { ok: false, error: "PUBLISH_FAILED", message: "No se pudo publicar el post. Inténtalo de nuevo." },
            { status: 500 },
          );
        }
      }

      // publishAction === "schedule"
      try {
        const bestHours = await new BestTimeToPostAgent().run(ctx);
        const hasRealData = bestHours[validContentType] !== null;
        const hour = bestHours[validContentType] ?? 18;

        const scheduled = new Date();
        scheduled.setUTCHours(hour, 0, 0, 0);
        if (scheduled.getTime() <= Date.now()) {
          scheduled.setUTCDate(scheduled.getUTCDate() + 1);
        }
        const scheduledAt = scheduled.toISOString();

        const post = await upsertSaasSocialPost(ctx, {
          saasId,
          campaignId: null,
          channelId: null,
          provider: "INSTAGRAM",
          contentType: validContentType,
          title: title.slice(0, 72),
          body: postBody,
          imageHint,
          status: "SCHEDULED",
          scheduledAt,
          postedAt: null,
          externalPostId: null,
          creationMode: "MANUAL",
          metadata,
        }, { applyTrialCaptionLink });

        const hourLabel = scheduled.toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short", timeZone: "UTC" });
        const reply = hasRealData
          ? `📅 Programado para las ${hourLabel} (UTC) — es tu mejor momento según tu historial de engagement.`
          : `📅 Programado para las ${hourLabel} (UTC). Todavía no tengo suficiente historial de engagement tuyo para este formato, así que usé una hora general recomendada.`;

        return NextResponse.json({ ok: true, action: "scheduled", postId: post.id, scheduledAt, reply });
      } catch (error) {
        console.error("SOCIALFLOW_AI_CHAT_SCHEDULE_ERROR", error);
        return NextResponse.json(
          { ok: false, error: "SCHEDULE_FAILED", message: "No se pudo programar el post. Inténtalo de nuevo." },
          { status: 500 },
        );
      }
    }

    // Imagen adjunta al chat — conversación iterativa sobre el caption de ESTA pieza
    // concreta (subida desde "¿Qué creo hoy?"). Se evalúa ANTES del parseo de intención
    // genérico de abajo: un "hazlo más corto" coincide con MODIFY_KEYWORDS_ES y, sin este
    // early-return, dispararía una regeneración de campaña completa vía la cola en vez de
    // ajustar el texto de esta imagen.
    if (body.imageKey && body.imageAnalysis) {
      const imageAnalysis = body.imageAnalysis;
      const conversation = Array.isArray(body.imageConversation) ? body.imageConversation : [];

      const [imgProfile, imgKnowledgeContext] = await Promise.all([
        getChannelProfile(session.tenantId, saasId).catch(() => null),
        getKnowledgeContext(session.tenantId, saasId).catch(() => ""),
      ]);
      const imgNiche = imgProfile?.niche || imgProfile?.brandName || saasId;
      const imgTone = imgProfile?.toneOfVoice || "profesional, cercano, concreto";

      const nicheData = await loadNicheDataForIdeas(imgNiche, env(), session.tenantId, saasId, session.accountType ?? "influencer").catch(() => null);
      const nicheBlock = nicheData ? formatNicheDataForPrompt(nicheData) : "";
      const { block: fatigueStyleBlock, fatigue } = await loadFatigueAndStyleBlock(session.tenantId, saasId, env());
      const hashtagBlock = await loadHashtagIntelligenceBlock(session.tenantId, saasId, env());

      const systemPrompt = `Eres el asistente creativo de ${imgProfile?.brandName || imgNiche}, una marca en el nicho "${imgNiche}". Tono de la marca: ${imgTone}.
${imgKnowledgeContext ? `Contexto de marca:\n${imgKnowledgeContext}\n` : ""}
El cliente subió una foto/vídeo. Análisis visual real de la pieza (nunca inventes detalles que no estén aquí):
- Descripción: ${imageAnalysis.description}
- Contexto: ${imageAnalysis.context}
- Detalle específico: ${imageAnalysis.specificContext}
- Temas sugeridos: ${imageAnalysis.suggestedThemes.join(", ") || "ninguno"}
- Tipo de contenido recomendado: ${imageAnalysis.recommendedPostType}
${nicheBlock ? `\nQué está funcionando ahora mismo en este nicho (datos reales, cítalos solo si son relevantes):\n${nicheBlock}\n` : ""}
${fatigueStyleBlock ? `\nContexto interno del cliente (para que ajustes tu propuesta — NO lo menciones literalmente en el caption, es solo para ti):\n${fatigueStyleBlock}\n` : ""}
${hashtagBlock ? `\nPara los hashtags del caption, usa como base este mix recomendado (evita los sobreusados):\n${hashtagBlock}\n` : ""}
Tu tarea: proponer o ajustar el TEXTO/CAPTION de esta pieza concreta, adaptado al estilo de la marca. NUNCA generes una campaña completa ni hables de varios posts — solo esta pieza. Responde ÚNICAMENTE con el texto de la publicación (el caption tal cual se publicaría) — sin preguntas, sin encabezados, sin comentarios adicionales antes o después. Responde en español.`;

      try {
        const e = env();
        if (!e?.AI) {
          return NextResponse.json({
            ok: true,
            action: "image_chat",
            reply: "No puedo generar el texto ahora mismo — el servicio de IA no está disponible. Inténtalo en unos minutos.",
          });
        }
        const result = (await e.AI.run("@cf/meta/llama-3.1-70b-instruct", {
          messages: [{ role: "system", content: systemPrompt }, ...conversation, { role: "user", content: userMessage }],
        })) as { response?: string };
        const rawCaption = result?.response?.trim() || "No se me ocurrió nada — ¿puedes darme más detalle de lo que buscas?";
        // caption/hashtags separados: el caption LIMPIO (sin hashtags inline) es lo que
        // viaja en pendingPost.body para publicar — buildPostCaption (live-publishing.ts)
        // arma el caption final como body + metadata.hashtags, así que los hashtags
        // extraídos aquí se reenvían en el JSON para que el cliente los incluya en
        // publishOptions.hashtags y no se pierdan al publicar.
        const { cleanCaption, hashtags } = extractHashtags(rawCaption);

        const viralScore = await calculateViralScore({
          caption: cleanCaption,
          hashtags,
          format: mapContentTypeToViralFormat(imageAnalysis.recommendedPostType),
          niche: imgNiche,
          tenantId: session.tenantId,
          saasId,
          env: e,
        });
        // calculateViralScore nunca lanza (degrada a un score neutro 5/"Medio" ante
        // cualquier fallo) — score > 5 excluye tanto ese neutro como cualquier score
        // real bajo, así que basta esta única condición para "omitir silenciosamente".
        const showViralScore = viralScore.score > 5;

        // reply = texto crudo del modelo (CON hashtags, para que el cliente los vea en
        // el chat) + pregunta de seguimiento fija del servidor (nunca del modelo) +
        // avisos deterministas — nunca el modelo decide este texto, para que
        // pendingPost.body (el campo `caption`, ya limpio) no lleve texto conversacional
        // que acabaría publicado tal cual en Instagram.
        const formatAdvisory =
          fatigue?.formatFatigued && fatigue.formatStreak.value === imageAnalysis.recommendedPostType
            ? `\n\n💡 Llevas ${fatigue.formatStreak.length} publicaciones seguidas en formato ${imageAnalysis.recommendedPostType} — ¿probamos con otro formato para esta pieza?`
            : "";
        const viralAdvisory = showViralScore
          ? `\n\n⚡ Potencial viral: ${viralScore.label} (${viralScore.score}/10) — ${viralScore.explanation}`
          : "";
        const reply = `${rawCaption}\n\n¿Quieres ajustar algo (tono, longitud, emojis) o lo publicamos?${formatAdvisory}${viralAdvisory}`;
        return NextResponse.json({ ok: true, action: "image_chat", reply, caption: cleanCaption, hashtags, viralScore });
      } catch (error) {
        console.error("SOCIALFLOW_AI_CHAT_IMAGE_ERROR", error);
        return NextResponse.json(
          { ok: false, error: "IMAGE_CHAT_FAILED", message: "No se pudo generar el texto para esta imagen. Inténtalo de nuevo." },
          { status: 500 },
        );
      }
    }

    // "Créalo tú" — solo se evalúa cuando el cliente reenvía lastIdeas (la respuesta de
    // ideas más reciente), así que un "genera 7 posts de fitness" en frío nunca entra
    // aquí y sigue su camino normal más abajo (evita el choque con GENERATE_KEYWORDS_ES).
    if (body.lastIdeas?.length) {
      const lowerConfirm = userMessage.toLowerCase();
      const isConfirm = CONFIRM_IDEA_KEYWORDS_ES.some((k) => lowerConfirm.includes(k));
      if (isConfirm) {
        const chosenIdea = body.lastIdeas[0];
        if (chosenIdea.format === "carrusel") {
          return NextResponse.json({
            ok: true,
            action: "handoff_carousel",
            reply: `Perfecto — te llevo a Crear Carrusel con "${chosenIdea.hook}" ya cargado.`,
            handoff: { href: `/socialflow/carrusel/subir?topic=${encodeURIComponent(chosenIdea.hook)}` },
          });
        }
        const manualHref = chosenIdea.format === "reel" ? "/socialflow/publicar/reel" : "/socialflow/publicar/post";
        const manualLabel = chosenIdea.format === "reel" ? "Crear Reel" : "Crear Post";
        return NextResponse.json({
          ok: true,
          action: "chat",
          reply: `Ese formato todavía no se genera 100% automático sin una foto/vídeo tuyo — subí uno desde "${manualLabel}" (${manualHref}) y la IA se encarga del resto con "${chosenIdea.hook}" como ángulo.`,
        });
      }
    }

    // Load brand profile + KB context in parallel
    const [profile, knowledgeContext] = await Promise.all([
      getChannelProfile(session.tenantId, saasId).catch(() => null),
      getKnowledgeContext(session.tenantId, saasId).catch(() => ""),
    ]);

    const defaultNiche = profile?.niche || profile?.brandName || saasId;
    const defaultTone = profile?.toneOfVoice || "profesional, cercano, concreto";

    // Extract date range and provider from message (rule-based, always reliable)
    const dateRange = extractDateRange(userMessage);
    const provider = extractProvider(userMessage);

    // Regex fallback runs first so its action can guard the AI result.
    const fallbackIntent = parseIntentFallback(userMessage, defaultTone, defaultNiche, provider, dateRange.dateLabel);
    const intent =
      (await parseIntentWithAI(userMessage, knowledgeContext, defaultTone, defaultNiche, fallbackIntent.action)) ??
      fallbackIntent;

    // Pure conversational — no generation needed
    if (intent.action === "chat") {
      return NextResponse.json({ ok: true, action: "chat", reply: intent.reply });
    }

    // Ideas — respuesta síncrona con datos reales del nicho, no encola nada (a
    // diferencia de generate/modify, no hay contenido que crear todavía).
    if (intent.action === "ideas") {
      const { reply, ideas } = await buildIdeasReply(defaultNiche, env(), session.tenantId, saasId, session.accountType ?? "influencer");
      return NextResponse.json({ ok: true, action: "ideas", reply, ideas });
    }

    // Generation or modify — enqueue campaign
    const queue = env()?.SOCIALFLOW_AI_QUEUE;
    if (!queue) {
      return NextResponse.json({ ok: false, error: "SOCIALFLOW_AI_QUEUE_UNAVAILABLE" }, { status: 503 });
    }

    const campaignId = `ai_campaign_${Date.now()}`;
    const ctx = await resolveSocialContext({ tenantId: session.tenantId, saasId });
    await upsertSaasSocialCampaign(ctx, {
      id: campaignId,
      saasId,
      name: `IA: ${intent.topic.slice(0, 60)}`,
      objective: null,
      status: "GENERATING",
      targetSegment: "DEFAULT",
      startDate: dateRange.startDate,
      endDate: dateRange.endDate,
      budgetEstimate: null,
      notes: null,
    });

    const applyTrialCaptionLink = await isActiveSocialFlowTrial(session.tenantId, session.role);

    await queue.send({
      tenantId: session.tenantId,
      saasId,
      niche: intent.topic,
      tone: intent.tone,
      frequencyPerWeek: intent.frequencyPerWeek,
      campaignId,
      startDate: dateRange.startDate,
      endDate: dateRange.endDate,
      provider,
      applyTrialCaptionLink,
    });

    // Build a reply that includes date context if AI didn't (AI reply ignores dates)
    const reply = fallbackIntent.reply;

    return NextResponse.json({
      ok: true,
      action: "generating",
      campaignId,
      reply,
      params: {
        topic: intent.topic,
        tone: intent.tone,
        frequencyPerWeek: intent.frequencyPerWeek,
        provider,
        dateLabel: dateRange.dateLabel,
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "SESSION_REQUIRED") {
      return NextResponse.json({ ok: false, error: "SESSION_REQUIRED" }, { status: 401 });
    }
    const msg = error instanceof Error ? error.message : String(error);
    console.error("SOCIALFLOW_AI_CHAT_ERROR", { message: msg, error });
    return NextResponse.json({ ok: false, error: "Internal Error" }, { status: 500 });
  }
}
