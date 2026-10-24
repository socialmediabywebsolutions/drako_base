import { defaultLocalModel } from "../models/localModel";
import { resolveSocialContext, listSaasSocialPosts } from "@/lib/socialflow/repository";
import { getChannelProfile } from "@/lib/socialflow/profile/repository";
import { getSocialFlowAccountTypeByTenant } from "@/lib/socialflow/auth/account-type";
import { getNicheIntelligence, type Env } from "@/lib/socialflow/intelligence/NicheIntelligenceService";
import { extractTrendSignals, type TrendSignals } from "@/lib/socialflow/intelligence/TrendKeywordAgent";
import { seedFeedItems, dismissFeedItemsBySource } from "@/lib/socialflow/intelligence/repository";
import { env, type DracoEnv } from "@/lib/cf";

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const MOMENTUM_CAP_HOURS = 48;
const ALERT_THRESHOLD_SCORE = 8;
const MIN_SOURCES_FOR_CANDIDATE = 2;
const MAX_ALERTS_PER_TENANT = 3;
const RECENT_POSTS_LOOKBACK_DAYS = 60;
const SOURCE_PREFIX = "viral_moment";

// Aproximación barata para agrupar hooks/títulos heterogéneos (YouTube/Reddit/Google
// Trends nunca coinciden en texto exacto) en una clave de tema común — mismo criterio
// que extractTopicKey en AudienceInsightAgent.ts (no es NLP real, es una pista barata
// antes de cualquier decisión; la única llamada a Mistral por tema es para el ángulo de
// contenido, no para esta agrupación).
const STOPWORDS = new Set([
  "que", "qué", "como", "cómo", "cuando", "cuándo", "donde", "dónde", "cuanto", "cuánto",
  "para", "esto", "esta", "estos", "estas", "pero", "porque", "todo", "toda", "todos",
  "todas", "muy", "mas", "más", "mucho", "poco", "sobre", "entre", "hasta", "desde", "cada",
  "otro", "otra", "otros", "otras", "eres", "sido", "hace", "hacer", "quiere", "quieres",
  "tiene", "tienen", "vamos", "solo", "sino", "aqui", "así", "nunca", "siempre", "nadie",
  "algo", "alguien", "también", "tambien", "una", "unos", "unas", "los", "las", "del", "con",
  "the", "and", "for", "you", "your", "this", "that", "with", "from", "how", "what",
]);

// Relleno de plataforma que domina los títulos de Shorts/Reels ("#viral #shorts
// #trending ...") — sin quitarlo, la clave de tema de casi cualquier hook de YouTube
// acababa siendo "viral shorts trending ..." y no describía ningún tema real.
const PLATFORM_NOISE = new Set([
  "viral", "virales", "viralvideo", "viralshorts", "shorts", "short", "reels", "reel", "trending",
  "trendingreels", "youtube", "youtubeshorts", "ytshorts", "foryou", "fyp", "explore", "video",
  "videos", "millionviews", "shortsfeed", "subscribe", "motivation",
]);

// Longitud mínima de palabra para que dos textos de fuentes distintas cuenten como el
// mismo tema — con 3 letras coincidían palabras vacías ("new", "top", "day").
const MIN_MATCH_WORD_LENGTH = 5;

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/&#?\w+;/g, " ")
    .replace(/#\S+/g, " ")
    .replace(/https?:\S+|www\.\S+/g, " ");
}

function significantWords(text: string, minLength: number): string[] {
  const normalized = normalizeText(text).replace(/[¿?¡!.,;:"'()]/g, " ");
  const words = normalized.match(new RegExp(`[a-z]{${minLength},}`, "g")) ?? [];
  return words.filter((w) => !STOPWORDS.has(w) && !PLATFORM_NOISE.has(w));
}

function extractTopicWords(text: string): string[] {
  return significantWords(text, 3).slice(0, 4);
}

function extractTopicKey(text: string): string {
  return extractTopicWords(text).join(" ");
}

type TopicCandidate = { label: string; sources: Set<string> };

// Candidatos = hooks de YouTube y temas de Reddit (las fuentes específicas del nicho);
// sources = su propia fuente + cualquier otra fuente con al menos un texto que comparta
// una palabra significativa con él. Antes se exigía que la clave de 4 palabras
// coincidiera EXACTA entre fuentes — un título de YouTube, un post de Reddit y una
// tendencia de Google nunca coinciden así, y las 446 filas de tracking tenían siempre 1
// sola fuente (viralMoments: [] para todos los tenants). Google Trends ES es una señal
// de país, no del nicho: solo sirve para corroborar, nunca genera candidato propio.
// sourcesCount refleja presencia actual, no un acumulado histórico.
function extractCurrentTopics(signals: TrendSignals): Map<string, TopicCandidate> {
  const bySource: Record<string, string[]> = {
    youtube: signals.youtubeHooks,
    reddit: signals.redditTopics,
    global: signals.globalTrends,
  };
  const wordsBySource = Object.fromEntries(
    Object.entries(bySource).map(([source, texts]) => [source, new Set(texts.flatMap((t) => significantWords(t, MIN_MATCH_WORD_LENGTH)))]),
  );

  const map = new Map<string, TopicCandidate>();
  for (const source of ["youtube", "reddit"]) {
    for (const text of bySource[source]) {
      const key = extractTopicKey(text);
      if (!key) continue;
      const words = significantWords(text, MIN_MATCH_WORD_LENGTH);
      const entry = map.get(key) ?? { label: text, sources: new Set<string>() };
      entry.sources.add(source);
      for (const other of Object.keys(bySource)) {
        if (other !== source && words.some((w) => wordsBySource[other].has(w))) entry.sources.add(other);
      }
      map.set(key, entry);
    }
  }
  return map;
}

type TrackedCandidate = { key: string; label: string; sources: string[]; firstSeenAt: string };

// Sincroniza el tracking propio de temas (socialcors_viral_topic_tracking, migración
// 0231) contra los temas detectados ESTA corrida: crea fila nueva (first_seen_at = ahora)
// para temas nunca vistos, actualiza last_seen_at/sources para los que ya existían
// (conservando su first_seen_at real), y poda filas que llevan >7 días sin aparecer
// (ya no son relevantes para este nicho). Esta tabla es la única fuente de "cuánto lleva
// subiendo un tema" — socialcors_niche_intelligence.trendSignals se sobrescribe en el
// sitio en cada refresco (ver TrendKeywordAgent.processNiche) y no guarda historial.
async function syncTopicTracking(
  db: D1Database,
  niche: string,
  accountType: string,
  currentTopics: Map<string, TopicCandidate>,
): Promise<TrackedCandidate[]> {
  const nowIso = new Date().toISOString();
  const candidates: TrackedCandidate[] = [];

  for (const [key, { label, sources }] of currentTopics) {
    const sourcesArr = Array.from(sources);
    const existing = await db
      .prepare(`SELECT id, first_seen_at FROM socialcors_viral_topic_tracking WHERE niche = ? AND account_type = ? AND topic = ? LIMIT 1`)
      .bind(niche, accountType, key)
      .first<{ id: string; first_seen_at: string }>();

    if (existing) {
      await db
        .prepare(`UPDATE socialcors_viral_topic_tracking SET topic_label = ?, sources_json = ?, last_seen_at = ?, updated_at = ? WHERE id = ?`)
        .bind(label, JSON.stringify(sourcesArr), nowIso, nowIso, existing.id)
        .run();
      candidates.push({ key, label, sources: sourcesArr, firstSeenAt: existing.first_seen_at });
    } else {
      await db
        .prepare(
          `INSERT INTO socialcors_viral_topic_tracking (id, niche, account_type, topic, topic_label, sources_json, first_seen_at, last_seen_at, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(crypto.randomUUID(), niche, accountType, key, label, JSON.stringify(sourcesArr), nowIso, nowIso, nowIso, nowIso)
        .run();
      candidates.push({ key, label, sources: sourcesArr, firstSeenAt: nowIso });
    }
  }

  const staleCutoff = new Date(Date.now() - SEVEN_DAYS_MS).toISOString();
  await db
    .prepare(`DELETE FROM socialcors_viral_topic_tracking WHERE niche = ? AND account_type = ? AND last_seen_at < ?`)
    .bind(niche, accountType, staleCutoff)
    .run()
    .catch(() => {});

  return candidates;
}

type ScoredCandidate = TrackedCandidate & { momentumScore: number };

// Candidato real de "momento viral": aparece en >=2 fuentes ESTA corrida, y lleva
// detectado (first_seen_at) dentro de los últimos 7 días (si lleva más, ya no es
// emergente, es un tema evergreen del nicho). momentumScore = nº de fuentes × horas
// desde la primera detección, con tope de 48h (últimas 48h = ventana de "está subiendo
// ahora", más allá de eso el score deja de crecer aunque el tema se mantenga vivo).
function scoreMomentumCandidates(candidates: TrackedCandidate[]): ScoredCandidate[] {
  const now = Date.now();
  return candidates
    .filter((c) => c.sources.length >= MIN_SOURCES_FOR_CANDIDATE)
    .filter((c) => now - new Date(c.firstSeenAt).getTime() <= SEVEN_DAYS_MS)
    .map((c) => {
      const hoursSinceFirstSeen = Math.max(0, (now - new Date(c.firstSeenAt).getTime()) / 3_600_000);
      const momentumScore = c.sources.length * Math.min(MOMENTUM_CAP_HOURS, hoursSinceFirstSeen);
      return { ...c, momentumScore };
    })
    .filter((c) => c.momentumScore >= ALERT_THRESHOLD_SCORE)
    .sort((a, b) => b.momentumScore - a.momentumScore);
}

// Heurística barata (mismo espíritu que extractTopicKey): ¿el cliente ya cubrió este
// tema? Se considera cubierto si al menos la mitad de las palabras significativas del
// tema aparecen en su propio corpus de posts publicados recientes — no exige coincidir
// la frase exacta (un post real rara vez repite el hook literal de YouTube/Reddit).
function hasTenantAlreadyCoveredTopic(topicKey: string, publishedCorpus: string): boolean {
  const words = topicKey.split(" ").filter(Boolean);
  if (!words.length) return false;
  const matched = words.filter((w) => publishedCorpus.includes(w));
  return matched.length / words.length >= 0.5;
}

function buildAnglePrompt(topicLabel: string, niche: string, accountType: string): string {
  return `Eres un estratega de contenido para el nicho "${niche}" (cuenta tipo ${accountType}). Este tema está ganando tracción real ahora mismo en múltiples fuentes (YouTube, Reddit y/o tendencias globales), pero todavía no es mainstream: "${topicLabel}".

Sugiere un ángulo de contenido concreto y accionable para que este cliente publique sobre este tema antes de que se sature (máximo 2 frases, en español, sin inventar cifras ni datos que no tengas).

Responde SOLO con un objeto JSON válido, sin markdown ni backticks, con esta forma exacta:
{"suggestedAngle": "..."}`;
}

type AngleResult = { suggestedAngle: string; _meta?: { engine?: string } };

async function generateSuggestedAngle(topicLabel: string, niche: string, accountType: string, tenantId: string, saasId: string): Promise<string> {
  const { data } = await defaultLocalModel.generateStructured<AngleResult>(
    { prompt: buildAnglePrompt(topicLabel, niche, accountType), tenantId, saasId },
    () => ({ suggestedAngle: "" }) as AngleResult,
  );

  if (data._meta?.engine === "workers-ai" && typeof data.suggestedAngle === "string" && data.suggestedAngle.trim()) {
    return data.suggestedAngle.trim();
  }
  return `Crea contenido rápido sobre "${topicLabel}" mientras está en tendencia en tu nicho.`;
}

export type ViralMoment = {
  topic: string;
  momentumScore: number;
  sources: string[];
  suggestedAngle: string;
};

export type ViralMomentResult = {
  viralMoments: ViralMoment[];
  alertsGenerated: number;
};

function feedSourceFor(niche: string, accountType: string, topicKey: string): string {
  return `${SOURCE_PREFIX}:${niche}:${accountType}:${topicKey}`;
}

// Detecta temas que están subiendo rápido en el nicho del tenant (cruzando
// youtubeHooks/redditTopics/globalTrends de TrendKeywordAgent con tracking propio, ver
// socialcors_viral_topic_tracking) y alerta en el Intelligence Feed (type "alert",
// priority "high") cuando el cliente aún no ha publicado sobre el tema. Persiste el
// snapshot tenant-facing en socialcors_viral_moments (migración 0231) para que el chat
// lo lea sin recalcular (posts + niche intelligence + hasta N llamadas a Mistral) en
// cada mensaje.
export class ViralMomentAgent {
  async run(input: { tenantId: string; saasId: string; accountType?: "influencer" | "empresa" }): Promise<ViralMomentResult | null> {
    const dracoEnv = env();
    if (!dracoEnv?.SOCIAL_DB) return null;

    const profile = await getChannelProfile(input.tenantId, input.saasId);
    if (!profile.niche) return null;

    const accountType =
      input.accountType ?? (await getSocialFlowAccountTypeByTenant(input.tenantId).catch(() => null)) ?? "influencer";

    const nicheIntel = await getNicheIntelligence(profile.niche, dracoEnv, input.tenantId, input.saasId, accountType).catch(() => null);
    if (!nicheIntel) return null;

    const signals = extractTrendSignals(nicheIntel.analysis);
    if (!signals) return null;

    const currentTopics = extractCurrentTopics(signals);
    const tracked = currentTopics.size
      ? await syncTopicTracking(dracoEnv.SOCIAL_DB, nicheIntel.niche, accountType, currentTopics)
      : [];
    const scored = scoreMomentumCandidates(tracked);

    const ctx = await resolveSocialContext({ tenantId: input.tenantId, saasId: input.saasId });
    const posts = await listSaasSocialPosts(ctx);
    const publishedCorpus = normalizeText(
      posts
        .filter((p) => p.status === "POSTED" || p.status === "PUBLISHED")
        .filter((p) => new Date(p.postedAt ?? p.updatedAt).getTime() >= Date.now() - RECENT_POSTS_LOOKBACK_DAYS * 24 * 60 * 60 * 1000)
        .map((p) => `${p.title ?? ""} ${p.body ?? ""}`)
        .join(" "),
    );

    const notYetPublished = scored.filter((c) => !hasTenantAlreadyCoveredTopic(c.key, publishedCorpus));
    const topCandidates = notYetPublished.slice(0, MAX_ALERTS_PER_TENANT);

    const previousSnapshot = await getLatestViralMoments(input.tenantId, input.saasId, dracoEnv);
    const previousByKey = new Map((previousSnapshot?.viralMoments ?? []).map((m) => [extractTopicKey(m.topic), m]));

    const viralMoments: ViralMoment[] = [];
    for (const candidate of topCandidates) {
      const cached = previousByKey.get(candidate.key);
      const suggestedAngle =
        cached?.suggestedAngle ?? (await generateSuggestedAngle(candidate.label, profile.niche, accountType, input.tenantId, input.saasId));
      viralMoments.push({
        topic: candidate.label,
        momentumScore: Math.round(candidate.momentumScore),
        sources: candidate.sources,
        suggestedAngle,
      });
    }

    // Dismiss: temas que estaban alertados antes y ya no califican (el cliente publicó,
    // perdieron momentum, o superaron los 7 días) — nunca se dejan huérfanos, mismo
    // criterio documentado en dismissFeedItemsBySource (ContentFatigueAgent).
    const currentKeys = new Set(viralMoments.map((m) => extractTopicKey(m.topic)));
    for (const staleKey of previousByKey.keys()) {
      if (!currentKeys.has(staleKey)) {
        await dismissFeedItemsBySource(input.tenantId, feedSourceFor(nicheIntel.niche, accountType, staleKey), input.saasId);
      }
    }

    let alertsGenerated = 0;
    for (const moment of viralMoments) {
      const topicKey = extractTopicKey(moment.topic);
      await seedFeedItems(
        input.tenantId,
        [
          {
            type: "alert" as const,
            priority: "high" as const,
            title: `🔥 Momento viral: ${moment.topic} está explotando en ${profile.niche} ahora mismo`,
            description: `Está subiendo en ${moment.sources.join(" + ")} y todavía no has publicado sobre esto. Ángulo sugerido: ${moment.suggestedAngle}`,
            source: feedSourceFor(nicheIntel.niche, accountType, topicKey),
          },
        ],
        input.saasId,
      );
      alertsGenerated++;
    }

    const result: ViralMomentResult = { viralMoments, alertsGenerated };
    await upsertViralMoments(input.tenantId, input.saasId, JSON.stringify(result), dracoEnv);
    return result;
  }
}

// --- Persistencia (snapshot por tenant, ver migración 0231) -----------------------

async function upsertViralMoments(tenantId: string, saasId: string, snapshot: string, dracoEnv: DracoEnv): Promise<void> {
  const db = dracoEnv?.SOCIAL_DB;
  if (!db) return;

  try {
    const now = new Date().toISOString();
    const existing = await db
      .prepare(`SELECT id FROM socialcors_viral_moments WHERE tenant_id = ? AND saas_id = ? LIMIT 1`)
      .bind(tenantId, saasId)
      .first<{ id: string }>();

    if (existing) {
      await db
        .prepare(`UPDATE socialcors_viral_moments SET snapshot_json = ?, updated_at = ? WHERE id = ?`)
        .bind(snapshot, now, existing.id)
        .run();
      return;
    }

    await db
      .prepare(
        `INSERT INTO socialcors_viral_moments (id, tenant_id, saas_id, snapshot_json, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .bind(crypto.randomUUID(), tenantId, saasId, snapshot, now, now)
      .run();
  } catch (err) {
    console.error("[ViralMomentAgent] upsertViralMoments failed", tenantId, saasId, err instanceof Error ? err.message : String(err));
  }
}

// Lectura barata para el chat — nunca vuelve a leer posts/niche intelligence ni a
// llamar a Mistral, solo el snapshot que ya calculó el cron de cada 4h.
export async function getLatestViralMoments(tenantId: string, saasId: string, dracoEnv: DracoEnv): Promise<ViralMomentResult | null> {
  const db = dracoEnv?.SOCIAL_DB;
  if (!db) return null;

  try {
    const row = await db
      .prepare(`SELECT snapshot_json FROM socialcors_viral_moments WHERE tenant_id = ? AND saas_id = ? LIMIT 1`)
      .bind(tenantId, saasId)
      .first<{ snapshot_json: string }>();

    if (!row) return null;
    return JSON.parse(row.snapshot_json) as ViralMomentResult;
  } catch (err) {
    console.error("[ViralMomentAgent] getLatestViralMoments failed", tenantId, saasId, err instanceof Error ? err.message : String(err));
    return null;
  }
}

export type ViralMomentTenantOutcome = { tenantId: string; saasId: string; ok: boolean; alertsGenerated?: number; error?: string };

// Corre para todo tenant onboardeado (no gated por nº de posts, a diferencia del cron
// diario de style-learning) — mismo patrón de enumeración que runViralOpportunityCron:
// nunca lanza por un tenant fallido, sigue con el resto.
export async function runViralMomentCron(cronEnv: Env): Promise<ViralMomentTenantOutcome[]> {
  const db = cronEnv?.SOCIAL_DB;
  if (!db) return [];

  const { results: tenantRows } = await db.prepare(`SELECT DISTINCT tenant_id, saas_id FROM socialflow_profiles`).all<{
    tenant_id: string;
    saas_id: string;
  }>();

  const results: ViralMomentTenantOutcome[] = [];
  for (const row of tenantRows ?? []) {
    try {
      const outcome = await new ViralMomentAgent().run({ tenantId: row.tenant_id, saasId: row.saas_id });
      results.push({ tenantId: row.tenant_id, saasId: row.saas_id, ok: true, alertsGenerated: outcome?.alertsGenerated ?? 0 });
    } catch (err) {
      console.error("[ViralMomentAgent] tenant failed", row.tenant_id, err instanceof Error ? err.message : String(err));
      results.push({ tenantId: row.tenant_id, saasId: row.saas_id, ok: false, error: err instanceof Error ? err.message : String(err) });
    }
  }
  return results;
}
