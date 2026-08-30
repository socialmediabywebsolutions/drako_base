import { defaultLocalModel } from "../ai/models/localModel";
import { resolveSocialContext, listSaasSocialPosts, listSaasSocialMetricsForPost } from "@/lib/socialflow/repository";
import { getChannelProfile } from "@/lib/socialflow/profile/repository";
import { getSocialFlowAccountTypeByTenant } from "@/lib/socialflow/auth/account-type";
import { sendEmail } from "@/lib/email";
import type { SaasSocialPost } from "@/lib/social-core/types";
import { getNicheIntelligence, getStyleHistory, detectContentFatigue, type Env } from "./NicheIntelligenceService";

type NicheAccountType = "influencer" | "empresa";

const BRIEFING_ACCOUNT_TYPE_INSTRUCTION: Record<NicheAccountType, string> = {
  influencer: "Enfoca las recomendaciones en tendencias virales, formatos que están funcionando ahora mismo y hooks de esta semana en el nicho — piensa como un creador de contenido personal.",
  empresa: "Enfoca las recomendaciones en oportunidades de captación de clientes locales, reputación y diferenciación frente a la competencia — piensa como un negocio local, no como un creador personal.",
};

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const DEFAULT_SAAS_ID = "socialflow";

export type BriefingPost = {
  id: string;
  contentType: string;
  excerpt: string;
  engagement: number;
  likes: number;
  comments: number;
  shares: number;
  postedAt: string | null;
};

export type BriefingFollowerChange = {
  current: number | null;
  capturedAt: string | null;
  // Always null today: socialflow_social_metrics_snapshots keeps a single row per
  // (tenant, saas, provider) — see migration 0192's UNIQUE constraint — so there's
  // no historical value yet to diff against. Surfaced honestly instead of faking a
  // trend; becomes computable once a history table/mechanism exists for this metric.
  change: null;
};

export type BriefingResult = {
  tenantId: string;
  saasId: string;
  period: string;
  niche: string;
  topPerformingPosts: BriefingPost[];
  worstPerformingPosts: BriefingPost[];
  contentMix: Record<string, number>;
  followerChange: BriefingFollowerChange;
  nicheTrends: { hashtags: string[]; formats: string[]; hooks: string[] } | null;
  competitorActivity: string | null;
  recommendations: string[];
  fatigueWarning: string | null;
  nextWeekFocus: string;
  generatedAt: string;
};

export type WeeklyBriefingCronResult = { tenantId: string; saasId: string; ok: boolean; error?: string };

type PostWithEngagement = {
  post: SaasSocialPost;
  likes: number;
  comments: number;
  shares: number;
  engagement: number;
};

function formatEsDate(date: Date): string {
  return date.toLocaleDateString("es-ES", { day: "numeric", month: "long", timeZone: "UTC" });
}

function toBriefingPost(entry: PostWithEngagement): BriefingPost {
  return {
    id: entry.post.id,
    contentType: entry.post.contentType,
    excerpt: entry.post.body.slice(0, 140),
    engagement: entry.engagement,
    likes: entry.likes,
    comments: entry.comments,
    shares: entry.shares,
    postedAt: entry.post.postedAt,
  };
}

// ISO-8601 week number — used only to file socialcors_briefing_history rows under
// a stable (year, week_number), not for any date-math elsewhere.
function getIsoWeek(date: Date): { week: number; year: number } {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return { week, year: d.getUTCFullYear() };
}

async function getFollowerChange(db: D1Database, tenantId: string, saasId: string): Promise<BriefingFollowerChange> {
  const row = await db
    .prepare(
      `SELECT followers_count, captured_at FROM socialflow_social_metrics_snapshots
       WHERE tenant_id = ? AND saas_id = ? ORDER BY datetime(captured_at) DESC LIMIT 1`,
    )
    .bind(tenantId, saasId)
    .first<{ followers_count: number | null; captured_at: string }>();
  if (!row) return { current: null, capturedAt: null, change: null };
  return { current: row.followers_count, capturedAt: row.captured_at, change: null };
}

async function getLatestCompetitorSummary(db: D1Database, tenantId: string, saasId: string): Promise<string | null> {
  const row = await db
    .prepare(
      `SELECT content_text FROM socialflow_knowledge_documents
       WHERE tenant_id = ? AND saas_id = ? AND type IN ('competitor', 'market_analysis')
       ORDER BY created_at DESC LIMIT 1`,
    )
    .bind(tenantId, saasId)
    .first<{ content_text: string }>();
  return row?.content_text ? row.content_text.slice(0, 800) : null;
}

type RecommendationsPayload = { recommendations: string[]; nextWeekFocus: string };
type RecommendationsResult = RecommendationsPayload & { _meta?: { engine?: string } };

function buildFallbackRecommendations(input: { niche: string; postCount: number; nicheHooks: string[] }): RecommendationsPayload {
  const recommendations = [
    input.postCount === 0
      ? `Esta semana no se publicó contenido en ${input.niche} — retomar la cadencia habitual es la prioridad.`
      : `Mantén la constancia de publicación en ${input.niche} — la regularidad pesa tanto como el contenido individual.`,
    input.nicheHooks.length
      ? `Prueba alguno de estos hooks que están funcionando ahora mismo en ${input.niche}: ${input.nicheHooks.slice(0, 2).join(" | ")}.`
      : `Varía tus aperturas de post para evitar que la audiencia se acostumbre al mismo patrón.`,
    `Revisa qué formato (Reel, Carrusel, Foto) dio mejor resultado esta semana y repite esa estructura la próxima.`,
  ];
  return { recommendations, nextWeekFocus: `Consolidar la cadencia de publicación en ${input.niche}.` };
}

function buildRecommendationsPrompt(input: {
  niche: string;
  accountType: NicheAccountType;
  weekPosts: PostWithEngagement[];
  nicheHashtags: string[];
  nicheFormats: string[];
  nicheHooks: string[];
  fatigueDescription: string | null;
  competitorActivity: string | null;
}): string {
  const postsSummary = input.weekPosts.length
    ? input.weekPosts
        .map((p) => `- ${p.post.contentType}: "${p.post.body.slice(0, 80)}" — ${p.engagement} interacciones (${p.likes} likes, ${p.comments} comentarios, ${p.shares} compartidos)`)
        .join("\n")
    : "No se publicó ningún post esta semana.";

  return `Eres un consultor de redes sociales para el nicho "${input.niche}". Analiza el rendimiento real de esta semana y las tendencias del nicho, y da recomendaciones concretas y accionables para la semana que viene.

${BRIEFING_ACCOUNT_TYPE_INSTRUCTION[input.accountType]}

Posts publicados esta semana:
${postsSummary}

${input.nicheHashtags.length ? `Hashtags en tendencia en el nicho: ${input.nicheHashtags.slice(0, 10).join(" ")}\n` : ""}${input.nicheFormats.length ? `Formatos que están funcionando en el nicho: ${input.nicheFormats.join(", ")}\n` : ""}${input.nicheHooks.length ? `Hooks que están funcionando en el nicho: ${input.nicheHooks.slice(0, 5).join(" | ")}\n` : ""}${input.fatigueDescription ? `⚠️ Fatiga de contenido detectada: ${input.fatigueDescription}\n` : ""}${input.accountType === "empresa" && input.competitorActivity ? `Análisis de competencia local reciente:\n${input.competitorActivity}\n` : ""}
Responde SOLO con un objeto JSON válido, sin markdown ni backticks, con esta forma exacta:
{
  "recommendations": ["3 recomendaciones concretas y accionables, en español, basadas en los datos reales de arriba"],
  "nextWeekFocus": "una sola frase en español con el foco principal para la semana que viene"
}`;
}

async function generateRecommendations(input: {
  tenantId: string;
  saasId: string;
  niche: string;
  accountType: NicheAccountType;
  weekPosts: PostWithEngagement[];
  nicheHashtags: string[];
  nicheFormats: string[];
  nicheHooks: string[];
  fatigueDescription: string | null;
  competitorActivity: string | null;
}): Promise<RecommendationsPayload> {
  const seed: RecommendationsPayload = { recommendations: [], nextWeekFocus: "" };
  const { data } = await defaultLocalModel.generateStructured<RecommendationsResult>(
    {
      prompt: buildRecommendationsPrompt(input),
      tenantId: input.tenantId,
      saasId: input.saasId,
    },
    () => seed as RecommendationsResult,
  );

  // Unlike the niche-intelligence cache (where a bad response should preserve last
  // week's cached row), the briefing is a one-off weekly artifact — an empty section
  // would just be a useless email. Fall back to a deterministic, still-useful
  // recommendation instead of shipping a blank one.
  if (data._meta?.engine !== "workers-ai" || data.recommendations.length === 0) {
    return buildFallbackRecommendations({ niche: input.niche, postCount: input.weekPosts.length, nicheHooks: input.nicheHooks });
  }

  return {
    recommendations: data.recommendations.slice(0, 3),
    nextWeekFocus: data.nextWeekFocus?.trim() || buildFallbackRecommendations({ niche: input.niche, postCount: input.weekPosts.length, nicheHooks: input.nicheHooks }).nextWeekFocus,
  };
}

export async function generateBriefing(tenantId: string, saasId: string, env: Env): Promise<BriefingResult> {
  const ctx = await resolveSocialContext({ tenantId, saasId, env });
  const profile = await getChannelProfile(tenantId, saasId);

  const now = new Date();
  const periodStart = new Date(now.getTime() - WEEK_MS);
  const period = `semana del ${formatEsDate(periodStart)} al ${formatEsDate(now)}`;

  const allPosts = await listSaasSocialPosts(ctx);
  const weekPosts = allPosts.filter((post) => {
    if (post.status !== "POSTED" && post.status !== "PUBLISHED") return false;
    const stamp = post.postedAt ?? post.scheduledAt;
    if (!stamp) return false;
    const t = new Date(stamp).getTime();
    return t >= periodStart.getTime() && t <= now.getTime();
  });

  const withEngagement: PostWithEngagement[] = await Promise.all(
    weekPosts.map(async (post) => {
      const metrics = await listSaasSocialMetricsForPost(ctx, post.id).catch(() => []);
      const latest = metrics[0] ?? null;
      return {
        post,
        likes: latest?.likes ?? 0,
        comments: latest?.comments ?? 0,
        shares: latest?.shares ?? 0,
        engagement: latest ? latest.likes + latest.comments + latest.shares : 0,
      };
    }),
  );

  const sortedByEngagement = [...withEngagement].sort((a, b) => b.engagement - a.engagement);
  const topPerformingPosts = sortedByEngagement.slice(0, 3).map(toBriefingPost);
  const worstEntry = sortedByEngagement.length > 3 ? sortedByEngagement[sortedByEngagement.length - 1] : null;
  const worstPerformingPosts = worstEntry ? [toBriefingPost(worstEntry)] : [];

  const contentMix = weekPosts.reduce<Record<string, number>>((acc, post) => {
    const key = post.contentType.toLowerCase();
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});

  const [followerChange, accountType, styleHistory, competitorActivity] = await Promise.all([
    getFollowerChange(ctx.socialDb, tenantId, saasId),
    getSocialFlowAccountTypeByTenant(tenantId).then((v) => v ?? ("influencer" as NicheAccountType)).catch(() => "influencer" as NicheAccountType),
    getStyleHistory(tenantId, saasId, env),
    getLatestCompetitorSummary(ctx.socialDb, tenantId, saasId),
  ]);
  const nicheIntel = await getNicheIntelligence(profile.niche, env, tenantId, saasId, accountType);

  const fatigueWarning = detectContentFatigue(styleHistory);
  const nicheHashtags = nicheIntel?.hashtags ?? [];
  const nicheFormats = nicheIntel?.formats ?? [];
  const nicheHooks = nicheIntel?.hooks ?? [];

  const { recommendations, nextWeekFocus } = await generateRecommendations({
    tenantId,
    saasId,
    niche: profile.niche,
    accountType,
    weekPosts: withEngagement,
    nicheHashtags,
    nicheFormats,
    nicheHooks,
    fatigueDescription: fatigueWarning?.description ?? null,
    competitorActivity,
  });

  return {
    tenantId,
    saasId,
    period,
    niche: profile.niche,
    topPerformingPosts,
    worstPerformingPosts,
    contentMix,
    followerChange,
    nicheTrends: nicheIntel ? { hashtags: nicheHashtags, formats: nicheFormats, hooks: nicheHooks } : null,
    competitorActivity,
    recommendations,
    fatigueWarning: fatigueWarning?.description ?? null,
    nextWeekFocus,
    generatedAt: now.toISOString(),
  };
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function buildBriefingHtml(briefing: BriefingResult): string {
  const postRow = (p: BriefingPost) =>
    `<tr><td style="padding:8px 12px;border-bottom:1px solid #eee;">${escapeHtml(p.contentType)}</td><td style="padding:8px 12px;border-bottom:1px solid #eee;">${escapeHtml(p.excerpt)}${p.excerpt.length >= 140 ? "…" : ""}</td><td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:right;">${p.engagement}</td></tr>`;

  const contentMixLine = Object.entries(briefing.contentMix)
    .map(([type, count]) => `${count} ${escapeHtml(type)}`)
    .join(" · ") || "sin publicaciones esta semana";

  return `<!doctype html>
<html>
<body style="font-family:Arial,Helvetica,sans-serif;background:#f6f6f6;padding:24px;color:#222;">
  <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;">
    <div style="background:#111;color:#fff;padding:20px 24px;">
      <h1 style="margin:0;font-size:20px;">Tu briefing semanal de Socialcors</h1>
      <p style="margin:4px 0 0;color:#ccc;font-size:13px;">${escapeHtml(briefing.period)} · nicho: ${escapeHtml(briefing.niche)}</p>
    </div>
    <div style="padding:20px 24px;">
      <h2 style="font-size:15px;margin:0 0 8px;">Contenido publicado</h2>
      <p style="margin:0 0 16px;font-size:14px;">${escapeHtml(contentMixLine)}</p>

      ${briefing.topPerformingPosts.length ? `
      <h2 style="font-size:15px;margin:0 0 8px;">Lo que mejor funcionó</h2>
      <table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:16px;">
        <thead><tr><th style="text-align:left;padding:8px 12px;border-bottom:2px solid #111;">Tipo</th><th style="text-align:left;padding:8px 12px;border-bottom:2px solid #111;">Post</th><th style="text-align:right;padding:8px 12px;border-bottom:2px solid #111;">Interacciones</th></tr></thead>
        <tbody>${briefing.topPerformingPosts.map(postRow).join("")}</tbody>
      </table>` : ""}

      ${briefing.worstPerformingPosts.length ? `
      <h2 style="font-size:15px;margin:0 0 8px;">Con menos alcance</h2>
      <table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:16px;">
        <tbody>${briefing.worstPerformingPosts.map(postRow).join("")}</tbody>
      </table>` : ""}

      ${briefing.followerChange.current !== null ? `<p style="font-size:14px;">Seguidores actuales: <strong>${briefing.followerChange.current}</strong></p>` : ""}

      ${briefing.fatigueWarning ? `<p style="background:#fff3cd;border:1px solid #ffe69c;border-radius:6px;padding:10px 12px;font-size:13px;">⚠️ ${escapeHtml(briefing.fatigueWarning)}</p>` : ""}

      <h2 style="font-size:15px;margin:16px 0 8px;">Recomendaciones para esta semana</h2>
      <ul style="font-size:14px;padding-left:20px;margin:0 0 16px;">
        ${briefing.recommendations.map((r) => `<li style="margin-bottom:6px;">${escapeHtml(r)}</li>`).join("")}
      </ul>

      <h2 style="font-size:15px;margin:0 0 8px;">Foco de la semana que viene</h2>
      <p style="font-size:14px;margin:0;">${escapeHtml(briefing.nextWeekFocus)}</p>
    </div>
    <div style="padding:14px 24px;background:#fafafa;color:#888;font-size:11px;">Generado automáticamente por Socialcors — ${escapeHtml(briefing.generatedAt)}</div>
  </div>
</body>
</html>`;
}

// socialflow_profiles.contact_email (migration 0210) — seeded from the
// authenticated session at onboarding time, editable via the profile endpoint.
// Kept in SOCIAL_DB on purpose so this agent never touches SOCIALFLOW_AUTHS_DB
// (where the login email actually lives). null when not yet seeded — callers
// must treat that as "skip the email channel", not an error.
async function resolveTenantEmail(db: D1Database, tenantId: string, saasId: string): Promise<string | null> {
  const row = await db
    .prepare(`SELECT contact_email FROM socialflow_profiles WHERE tenant_id = ? AND saas_id = ? LIMIT 1`)
    .bind(tenantId, saasId)
    .first<{ contact_email: string | null }>();
  const email = row?.contact_email;
  return typeof email === "string" && email.includes("@") ? email : null;
}

// Returns whether the email was actually sent, so callers can record it in
// socialcors_briefing_history.sent_via accurately (deviates from a void return —
// necessary for that bookkeeping, see runWeeklyBriefingForAllTenants).
export async function sendBriefingEmail(tenantId: string, saasId: string, briefing: BriefingResult, env: Env): Promise<boolean> {
  const db = env?.SOCIAL_DB;
  if (!db) return false;

  const email = await resolveTenantEmail(db, tenantId, saasId);
  if (!email) {
    console.error("[WeeklyBriefingAgent] no contact email on file in SOCIAL_DB, skipping email", tenantId, saasId);
    return false;
  }

  const result = await sendEmail({
    to: email,
    subject: `Tu briefing semanal de Socialcors — ${briefing.period}`,
    html: buildBriefingHtml(briefing),
  });

  if (!result.ok) {
    console.error("[WeeklyBriefingAgent] sendEmail failed", tenantId, saasId, result.code);
    return false;
  }

  return true;
}

export async function saveBriefingInApp(
  tenantId: string,
  saasId: string,
  briefing: BriefingResult,
  sentVia: string[],
  env: Env,
): Promise<void> {
  const db = env?.SOCIAL_DB;
  if (!db) return;
  const now = new Date();
  const { week, year } = getIsoWeek(now);
  await db
    .prepare(
      `INSERT INTO socialcors_briefing_history (id, tenant_id, saas_id, briefing_json, sent_via, sent_at, week_number, year)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(crypto.randomUUID(), tenantId, saasId, JSON.stringify(briefing), sentVia.join(","), now.toISOString(), week, year)
    .run();
}

type BriefingPreferences = { emailEnabled: boolean; inappEnabled: boolean };

async function getBriefingPreferences(db: D1Database, tenantId: string, saasId: string): Promise<BriefingPreferences> {
  const row = await db
    .prepare(`SELECT email_enabled, inapp_enabled FROM socialcors_briefing_preferences WHERE tenant_id = ? AND saas_id = ? LIMIT 1`)
    .bind(tenantId, saasId)
    .first<{ email_enabled: number; inapp_enabled: number }>();
  if (!row) return { emailEnabled: true, inappEnabled: true };
  return { emailEnabled: row.email_enabled === 1, inappEnabled: row.inapp_enabled === 1 };
}

async function touchLastSentAt(db: D1Database, tenantId: string, saasId: string): Promise<void> {
  const now = new Date().toISOString();
  const existing = await db
    .prepare(`SELECT id FROM socialcors_briefing_preferences WHERE tenant_id = ? AND saas_id = ? LIMIT 1`)
    .bind(tenantId, saasId)
    .first<{ id: string }>();

  if (existing) {
    await db
      .prepare(`UPDATE socialcors_briefing_preferences SET last_sent_at = ?, updated_at = ? WHERE id = ?`)
      .bind(now, now, existing.id)
      .run();
    return;
  }

  await db
    .prepare(
      `INSERT INTO socialcors_briefing_preferences (id, tenant_id, saas_id, last_sent_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .bind(crypto.randomUUID(), tenantId, saasId, now, now, now)
    .run();
}

async function processTenantBriefing(db: D1Database, tenantId: string, saasId: string, env: Env): Promise<void> {
  const prefs = await getBriefingPreferences(db, tenantId, saasId);
  const briefing = await generateBriefing(tenantId, saasId, env);

  const sentVia: string[] = [];
  if (prefs.emailEnabled) {
    const sent = await sendBriefingEmail(tenantId, saasId, briefing, env);
    if (sent) sentVia.push("email");
  }
  // Always persisted regardless of inapp_enabled — that preference is for whether
  // the client-facing UI surfaces a notification (Fase 2), not whether we keep a
  // history record at all.
  sentVia.push("inapp");

  await saveBriefingInApp(tenantId, saasId, briefing, sentVia, env);
  await touchLastSentAt(db, tenantId, saasId);
}

// Single-tenant entry point — used by the admin refresh endpoint for testing.
export async function runWeeklyBriefingForTenant(tenantId: string, saasId: string, env: Env): Promise<void> {
  const db = env?.SOCIAL_DB;
  if (!db) throw new Error("SOCIAL_DB not configured");
  await processTenantBriefing(db, tenantId, saasId, env);
}

// "Active tenant" here means "has a socialflow_profiles row" (completed onboarding)
// — the SOCIAL_DB-native signal, since subscription/billing status lives in
// DRACO_DB, out of scope for this agent (SOCIAL_DB only).
export async function runWeeklyBriefingForAllTenants(env: Env): Promise<WeeklyBriefingCronResult[]> {
  const db = env?.SOCIAL_DB;
  if (!db) return [];

  const { results: tenantRows } = await db
    .prepare(`SELECT DISTINCT tenant_id, saas_id FROM socialflow_profiles`)
    .all<{ tenant_id: string; saas_id: string }>();

  const results: WeeklyBriefingCronResult[] = [];

  for (const row of tenantRows ?? []) {
    const tenantId = row.tenant_id;
    const saasId = row.saas_id;
    console.log("[WeeklyBriefingAgent] starting tenant", tenantId, saasId);
    try {
      await processTenantBriefing(db, tenantId, saasId, env);
      results.push({ tenantId, saasId, ok: true });
    } catch (err) {
      console.error("[WeeklyBriefingAgent] tenant failed", tenantId, saasId, err instanceof Error ? err.message : String(err));
      results.push({ tenantId, saasId, ok: false, error: err instanceof Error ? err.message : String(err) });
    }
    console.log("[WeeklyBriefingAgent] finished tenant", tenantId, saasId);
  }

  return results;
}

export { DEFAULT_SAAS_ID };
