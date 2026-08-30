import { listSaasSocialPosts, resolveSocialContext } from "@/lib/socialflow/repository";
import { env, type DracoEnv } from "@/lib/cf";
import type { SaasSocialPost } from "@/lib/social-core/types";

const MAX_POSTS_ANALYZED = 30;
const MIN_POSTS = 10;
const FORMAT_WINDOW = 10;
const TOPIC_WINDOW = 5;
const FORMAT_RATIO_THRESHOLD = 0.6;
const TOPIC_MATCH_MIN = 4; // de 5 — exige mayoría, no las 5 exactas (heurístico aproximado)

const TRACKED_FORMATS = ["FEED", "REEL", "STORY", "CAROUSEL"] as const;
const FORMAT_LABEL_ES: Record<string, string> = { FEED: "Post", REEL: "Reel", STORY: "Historia", CAROUSEL: "Carrusel" };

const STOPWORDS = new Set([
  "que", "qué", "como", "cómo", "cuando", "cuándo", "donde", "dónde", "cuanto", "cuánto",
  "para", "esto", "esta", "estos", "estas", "pero", "porque", "todo", "toda", "todos",
  "todas", "muy", "mas", "más", "mucho", "poco", "sobre", "entre", "hasta", "desde", "cada",
  "otro", "otra", "otros", "otras", "eres", "sido", "hace", "hacer", "quiere", "quieres",
  "tiene", "tienen", "vamos", "solo", "sino", "aqui", "así", "nunca", "siempre", "nadie",
  "algo", "alguien", "también", "tambien", "una", "unos", "unas", "los", "las", "del", "con",
]);

function normalizeText(text: string): string {
  return text.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

// Mismo heurístico barato de "clave de tema" ya usado en ViralMomentAgent/
// ContentSeriesAgent (no exportado en ninguno de los dos — copia local por archivo, es
// el patrón ya establecido en esta base).
function extractTopicKey(text: string): string {
  const normalized = normalizeText(text.split("\n")[0] ?? "").replace(/[¿?¡!.,;:"'()]/g, " ");
  const words = normalized.match(/[a-z]{3,}/g) ?? [];
  return words.filter((w) => !STOPWORDS.has(w)).slice(0, 4).join(" ");
}

function mostCommonWithCount<T>(values: T[]): { value: T; count: number } {
  const counts = new Map<T, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  let best: T = values[0];
  let bestCount = 0;
  for (const [value, count] of counts) {
    if (count > bestCount) {
      best = value;
      bestCount = count;
    }
  }
  return { value: best, count: bestCount };
}

export type FormatDiversity = {
  distribution: Record<string, number>;
  alert: boolean;
  recommendation: string;
};

export type TopicDiversity = {
  alert: boolean;
  recommendation: string;
};

export type ContentDiversityResult = {
  formatDiversity: FormatDiversity;
  topicDiversity: TopicDiversity;
  overallDiversityScore: number;
};

function buildFormatDiversity(posts: SaasSocialPost[]): FormatDiversity {
  const last10 = posts.slice(0, FORMAT_WINDOW);

  // distribution refleja la MISMA ventana que decide `alert` (últimos 10) — no los 30
  // analizados: así el formato dominante que dispara la alerta es siempre el mismo que
  // se puede derivar de `distribution` después (ver mapOverusedFormatForStrategy), sin
  // que un patrón distinto en los posts 11-30 pueda contradecirlo.
  const distribution: Record<string, number> = {};
  for (const post of last10) distribution[post.contentType] = (distribution[post.contentType] ?? 0) + 1;

  const { value: dominantFormat, count } = mostCommonWithCount(last10.map((p) => p.contentType));
  const ratio = count / last10.length;
  const alert = ratio > FORMAT_RATIO_THRESHOLD;

  // Para sugerir qué formato probar, sí conviene mirar los 30 analizados (más señal de
  // qué llevas menos usando en general) — no está atado a la ventana de la alerta.
  const fullDistribution: Record<string, number> = {};
  for (const post of posts) fullDistribution[post.contentType] = (fullDistribution[post.contentType] ?? 0) + 1;
  const leastUsed = TRACKED_FORMATS
    .filter((f) => f !== dominantFormat)
    .sort((a, b) => (fullDistribution[a] ?? 0) - (fullDistribution[b] ?? 0))
    .slice(0, 2)
    .map((f) => FORMAT_LABEL_ES[f]);

  const recommendation = alert
    ? `Llevas ${count} de tus últimos ${last10.length} posts en formato ${FORMAT_LABEL_ES[dominantFormat] ?? dominantFormat} — es momento de publicar un ${leastUsed.join(" o un ")} para variar.`
    : "Tu mezcla de formatos está balanceada — sigue así.";

  return { distribution, alert, recommendation };
}

function buildTopicDiversity(posts: SaasSocialPost[]): TopicDiversity {
  const last5 = posts.slice(0, TOPIC_WINDOW);
  if (last5.length < TOPIC_WINDOW) return { alert: false, recommendation: "Todavía no hay suficientes posts recientes para evaluar variedad de tema." };

  const keys = last5.map((p) => extractTopicKey(p.body)).filter((k) => k.length > 0);
  if (keys.length < TOPIC_WINDOW) return { alert: false, recommendation: "Tus temas recientes son lo bastante variados." };

  const { value: dominantKey, count } = mostCommonWithCount(keys);
  const alert = count >= TOPIC_MATCH_MIN;

  const recommendation = alert
    ? `Tus últimos ${TOPIC_WINDOW} posts giran en torno a "${dominantKey}" — prueba un ángulo distinto (caso de uso, mito vs. realidad, detrás de cámaras) para no saturar a tu audiencia.`
    : "Tus temas recientes son lo bastante variados.";

  return { alert, recommendation };
}

function computeOverallScore(posts: SaasSocialPost[], last10: SaasSocialPost[], last5Keys: string[]): number {
  const formatRepeatRatio = mostCommonWithCount(last10.map((p) => p.contentType)).count / last10.length;
  const topicRepeatRatio = last5Keys.length ? mostCommonWithCount(last5Keys).count / last5Keys.length : 0;
  return Math.round(100 * (1 - (formatRepeatRatio * 0.5 + topicRepeatRatio * 0.5)));
}

// Detecta fatiga de variedad por RATIO sobre una ventana (no racha ininterrumpida, que
// ya cubre ContentFatigueAgent) — complementario, no redundante: FEED,FEED,REEL,FEED×7
// tiene una racha rota pero un ratio de 9/10, un patrón real que ContentFatigueAgent no
// detecta. Puramente estadístico/heurístico, sin llamadas a Mistral (las
// recomendaciones son texto plantilla, no generativo). No escribe en el Intelligence
// Feed — ContentFatigueAgent ya posee esa alerta; esta señal se consume por el pipeline
// de generación (StrategyAgent, vía SocialFlowOrchestrator) y por el chat. Persiste en
// socialcors_content_diversity (tabla propia por tenant, migración 0236).
export class ContentDiversityAgent {
  async run(input: { tenantId: string; saasId: string; accountType?: "influencer" | "empresa" }): Promise<ContentDiversityResult | null> {
    const ctx = await resolveSocialContext({ tenantId: input.tenantId, saasId: input.saasId });
    const allPosts = await listSaasSocialPosts(ctx);

    // Cualquier estado (POSTED/SCHEDULED/DRAFT) — a diferencia de la mayoría de agentes
    // del Cerebro, aquí importa el patrón de lo que el cliente está PLANEANDO publicar,
    // no solo lo ya publicado. listSaasSocialPosts ya devuelve ORDER BY created_at DESC.
    const posts = allPosts.slice(0, MAX_POSTS_ANALYZED);
    if (posts.length < MIN_POSTS) return null;

    const formatDiversity = buildFormatDiversity(posts);
    const topicDiversity = buildTopicDiversity(posts);

    const last10 = posts.slice(0, FORMAT_WINDOW);
    const last5Keys = posts.slice(0, TOPIC_WINDOW).map((p) => extractTopicKey(p.body)).filter((k) => k.length > 0);
    const overallDiversityScore = computeOverallScore(posts, last10, last5Keys);

    const result: ContentDiversityResult = { formatDiversity, topicDiversity, overallDiversityScore };

    const dracoEnv = env();
    if (dracoEnv) {
      await upsertContentDiversity(input.tenantId, input.saasId, JSON.stringify(result), posts.length, dracoEnv);
    }

    return result;
  }
}

// --- Persistencia (tabla propia por tenant, ver migración 0236) -------------------

async function upsertContentDiversity(
  tenantId: string,
  saasId: string,
  snapshot: string,
  postCount: number,
  dracoEnv: DracoEnv,
): Promise<void> {
  const db = dracoEnv?.SOCIAL_DB;
  if (!db) return;

  try {
    const now = new Date().toISOString();
    const existing = await db
      .prepare(`SELECT id FROM socialcors_content_diversity WHERE tenant_id = ? AND saas_id = ? LIMIT 1`)
      .bind(tenantId, saasId)
      .first<{ id: string }>();

    if (existing) {
      await db
        .prepare(`UPDATE socialcors_content_diversity SET snapshot_json = ?, post_count = ?, updated_at = ? WHERE id = ?`)
        .bind(snapshot, postCount, now, existing.id)
        .run();
      return;
    }

    await db
      .prepare(
        `INSERT INTO socialcors_content_diversity (id, tenant_id, saas_id, snapshot_json, post_count, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(crypto.randomUUID(), tenantId, saasId, snapshot, postCount, now, now)
      .run();
  } catch (err) {
    console.error("[ContentDiversityAgent] upsertContentDiversity failed", tenantId, saasId, err instanceof Error ? err.message : String(err));
  }
}

// Lectura barata para el pipeline de generación (SocialFlowOrchestrator) y el chat —
// nunca vuelve a leer posts, solo el snapshot que ya calculó el cron diario.
export async function getLatestContentDiversity(
  tenantId: string,
  saasId: string,
  dracoEnv: DracoEnv,
): Promise<ContentDiversityResult | null> {
  const db = dracoEnv?.SOCIAL_DB;
  if (!db) return null;

  try {
    const row = await db
      .prepare(`SELECT snapshot_json FROM socialcors_content_diversity WHERE tenant_id = ? AND saas_id = ? LIMIT 1`)
      .bind(tenantId, saasId)
      .first<{ snapshot_json: string }>();

    if (!row) return null;
    return JSON.parse(row.snapshot_json) as ContentDiversityResult;
  } catch (err) {
    console.error("[ContentDiversityAgent] getLatestContentDiversity failed", tenantId, saasId, err instanceof Error ? err.message : String(err));
    return null;
  }
}

// El formato dominante de socialcors_content_diversity mapeado a lo único que
// StrategyAgent puede evitar (solo elige entre "carousel"/"reel" — nunca FEED/STORY, así
// que un sobreuso de esos dos formatos no tiene nada que ajustar aquí). Devuelve null
// cuando no hay alerta de formato o cuando el formato sobreusado no es CAROUSEL/REEL.
export function mapOverusedFormatForStrategy(result: ContentDiversityResult | null): "carousel" | "reel" | null {
  if (!result?.formatDiversity.alert) return null;
  const { distribution } = result.formatDiversity;
  const dominant = Object.entries(distribution).sort((a, b) => b[1] - a[1])[0]?.[0];
  if (dominant === "CAROUSEL") return "carousel";
  if (dominant === "REEL") return "reel";
  return null;
}
