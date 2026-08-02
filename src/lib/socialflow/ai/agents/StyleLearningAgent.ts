import { defaultLocalModel } from "../models/localModel";
import { listSaasSocialPosts, listSaasSocialMetricsForPost, resolveSocialContext } from "@/lib/socialflow/repository";
import { upsertKnowledgeDocByType } from "@/lib/socialflow/knowledge/repository";
import { saveStyleSnapshot } from "@/lib/socialflow/intelligence/NicheIntelligenceService";
import { env } from "@/lib/cf";
import type { SaasSocialPost } from "@/lib/social-core/types";

const MAX_POSTS_ANALYZED = 30;

const STOPWORDS = new Set([
  "para", "esto", "esta", "estos", "estas", "pero", "porque", "como", "cuando",
  "donde", "todo", "toda", "todos", "todas", "muy", "mas", "mucho", "poco",
  "sobre", "entre", "hasta", "desde", "cada", "otro", "otra", "otros", "otras",
  "eres", "sido", "hace", "hacer", "puedes", "puede", "quiere", "quieres",
  "tiene", "tienen", "tienes", "vamos", "vamos", "solo", "sino", "aqui", "asi",
  "nunca", "siempre", "nadie", "algo", "alguien", "también", "tambien",
  "the", "and", "with", "your", "that", "this", "from", "have", "just",
  "what", "when", "make", "more", "about", "into", "them", "than", "will",
]);

export type StyleLearningResult = {
  postsAnalyzed: number;
  avgCaptionLength: number;
  topHookPatterns: string[];
  topHashtags: Array<{ tag: string; avgEngagement: number; uses: number }>;
  recurringTopics: string[];
  bestPerformingHours: number[];
  summaryText: string;
};

function extractHashtags(post: SaasSocialPost): string[] {
  const fromMetadata = Array.isArray(post.metadata?.hashtags)
    ? (post.metadata!.hashtags as unknown[]).filter((h): h is string => typeof h === "string")
    : [];
  const fromBody = post.body.match(/#[\p{L}0-9_]+/gu) ?? [];
  return Array.from(new Set([...fromMetadata, ...fromBody].map((h) => h.toLowerCase())));
}

// Heuristic hook classifier — mirrors the regex-based classifiers already used
// elsewhere in this codebase (e.g. pickOpenerCategory in generate-from-image).
function classifyHook(firstLine: string): string {
  const line = firstLine.trim();
  if (!line) return "sin hook";
  if (/^(\d+)\s/.test(line)) return "lista numerada";
  if (/\?\s*$/.test(line)) return "pregunta directa";
  if (/^(nadie|nunca|lo que nadie|nadie te dice)/i.test(line)) return "revelación / secreto";
  if (/^(antes de|si (estás|quieres|trabajas|eres))/i.test(line)) return "condicional / advertencia";
  if (/^(te comparto|hoy|esta semana|esta es)/i.test(line)) return "anuncio directo";
  return "afirmación directa";
}

function extractRecurringTopics(posts: SaasSocialPost[]): string[] {
  const freq = new Map<string, number>();
  for (const post of posts) {
    const words = post.body
      .toLowerCase()
      .normalize("NFD").replace(/[̀-ͯ]/g, "")
      .match(/[a-z]{4,}/g) ?? [];
    for (const word of words) {
      if (STOPWORDS.has(word)) continue;
      freq.set(word, (freq.get(word) ?? 0) + 1);
    }
  }
  return Array.from(freq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([word]) => word);
}

export class StyleLearningAgent {
  async run(input: { tenantId: string; saasId: string }): Promise<StyleLearningResult | null> {
    const ctx = await resolveSocialContext({ tenantId: input.tenantId, saasId: input.saasId });
    const allPosts = await listSaasSocialPosts(ctx);

    const published = allPosts
      .filter((post) => (post.status === "POSTED" || post.status === "PUBLISHED") && post.body?.trim())
      .sort((a, b) =>
        new Date(b.postedAt ?? b.scheduledAt ?? b.createdAt).getTime()
        - new Date(a.postedAt ?? a.scheduledAt ?? a.createdAt).getTime(),
      )
      .slice(0, MAX_POSTS_ANALYZED);

    if (published.length === 0) return null;

    const withEngagement = await Promise.all(
      published.map(async (post) => {
        const metrics = await listSaasSocialMetricsForPost(ctx, post.id).catch(() => []);
        const latest = metrics[0] ?? null;
        const engagement = latest ? latest.likes + latest.comments + latest.shares : 0;
        return { post, engagement, hasMetrics: Boolean(latest) };
      }),
    );
    const hasAnyMetrics = withEngagement.some((w) => w.hasMetrics);

    const avgCaptionLength = Math.round(
      published.reduce((sum, post) => sum + post.body.length, 0) / published.length,
    );

    const hookCounts = new Map<string, number>();
    for (const post of published) {
      const hook = classifyHook(post.body.split("\n")[0] ?? "");
      hookCounts.set(hook, (hookCounts.get(hook) ?? 0) + 1);
    }
    const topHookPatterns = Array.from(hookCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([hook]) => hook);

    const hashtagStats = new Map<string, { totalEngagement: number; uses: number }>();
    for (const { post, engagement } of withEngagement) {
      for (const tag of extractHashtags(post)) {
        const entry = hashtagStats.get(tag) ?? { totalEngagement: 0, uses: 0 };
        entry.totalEngagement += engagement;
        entry.uses += 1;
        hashtagStats.set(tag, entry);
      }
    }
    const topHashtags = Array.from(hashtagStats.entries())
      .map(([tag, { totalEngagement, uses }]) => ({
        tag,
        avgEngagement: Math.round((totalEngagement / uses) * 10) / 10,
        uses,
      }))
      .sort((a, b) => b.avgEngagement - a.avgEngagement)
      .slice(0, 10);

    const recurringTopics = extractRecurringTopics(published);

    const hourStats = new Map<number, { totalEngagement: number; count: number }>();
    for (const { post, engagement } of withEngagement) {
      const stamp = post.postedAt ?? post.scheduledAt;
      if (!stamp) continue;
      const hour = new Date(stamp).getUTCHours();
      const entry = hourStats.get(hour) ?? { totalEngagement: 0, count: 0 };
      entry.totalEngagement += engagement;
      entry.count += 1;
      hourStats.set(hour, entry);
    }
    const bestPerformingHours = Array.from(hourStats.entries())
      .map(([hour, { totalEngagement, count }]) => ({ hour, avg: totalEngagement / count }))
      .sort((a, b) => b.avg - a.avg)
      .slice(0, 3)
      .map(({ hour }) => hour);

    const baseSummary = [
      `Análisis basado en ${published.length} posts publicados.`,
      `Longitud media de caption: ${avgCaptionLength} caracteres.`,
      topHookPatterns.length ? `Estructuras de hook más usadas: ${topHookPatterns.join(", ")}.` : "",
      recurringTopics.length ? `Temas recurrentes: ${recurringTopics.join(", ")}.` : "",
      hasAnyMetrics && topHashtags.length
        ? `Hashtags con mejor engagement medio: ${topHashtags.slice(0, 5).map((h) => `${h.tag} (${h.avgEngagement})`).join(", ")}.`
        : "Aún no hay suficientes métricas reales para rankear hashtags por engagement.",
      bestPerformingHours.length && hasAnyMetrics
        ? `Horas UTC con mejor rendimiento histórico: ${bestPerformingHours.join(", ")}.`
        : "",
    ].filter(Boolean).join(" ");

    const prompt = `Resume en un párrafo, en español, el estilo de escritura real de este creador a partir de datos de sus propios posts publicados. No inventes cifras nuevas ni temas que no aparezcan aquí — reescribe de forma natural exactamente esta información:\n\n${baseSummary}`;

    const { data } = await defaultLocalModel.generateStructured<{ summary: string }>(
      { prompt, tenantId: input.tenantId, saasId: input.saasId },
      () => ({ summary: baseSummary }),
    );

    const summaryText = typeof data.summary === "string" && data.summary.trim() ? data.summary.trim() : baseSummary;

    await upsertKnowledgeDocByType({
      tenantId: input.tenantId,
      saasId: input.saasId,
      name: "Estilo aprendido de posts",
      type: "auto_learned_style",
      contentText: summaryText,
    });

    const result: StyleLearningResult = {
      postsAnalyzed: published.length,
      avgCaptionLength,
      topHookPatterns,
      topHashtags,
      recurringTopics,
      bestPerformingHours,
      summaryText,
    };

    // Additive: the KB doc above keeps overwriting (compatibility with existing
    // readers of getKnowledgeContext), while this also appends to history so the
    // brain can look back further than "just the latest run" — see
    // NicheIntelligenceService.detectContentFatigue.
    const dracoEnv = env();
    if (dracoEnv) {
      await saveStyleSnapshot(input.tenantId, input.saasId, JSON.stringify(result), published.length, dracoEnv);
    }

    return result;
  }
}
