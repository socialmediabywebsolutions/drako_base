import { defaultLocalModel } from "../models/localModel";
import { listSaasSocialPosts, resolveSocialContext } from "@/lib/socialflow/repository";
import { upsertKnowledgeDocByType } from "@/lib/socialflow/knowledge/repository";
import type { SaasSocialPost } from "@/lib/social-core/types";

// Analiza los posts publicados reales de un tenant para extraer su voz/estilo de
// escritura (emojis, muletillas, forma de dirigirse a la audiencia, CTAs reales,
// tono dominante) — a diferencia de StyleLearningAgent (estadísticas de
// longitud/hooks/hashtags/horarios), esto es una huella lingüística, no un análisis
// de rendimiento. Corre en el mismo cron que StyleLearningAgent (ver
// /api/cron/social/style-learning/route.ts) sobre la misma ventana de posts.

const MAX_POSTS_ANALYZED = 30;
const EXCERPT_LENGTH = 160;

export type VoiceTone = "motivacional" | "tecnico" | "intimo" | "educativo";

export type VoiceProfileResult = {
  postsAnalyzed: number;
  topEmojis: { emoji: string; count: number }[];
  frequentExpressions: string[];
  avgSentenceLength: number;
  audienceAddressStyle: string;
  realCTAs: string[];
  dominantTones: Record<VoiceTone, number>;
  avoidedPatterns: string[];
  summaryText: string;
};

// Unicode property escape — cubre emoji reales sin arrastrar una librería de
// segmentación de grafemas solo para este conteo de frecuencia.
const EMOJI_RE = /\p{Extended_Pictographic}/gu;
const SENTENCE_END_RE = /[.!?]+/;

const ADDRESS_PATTERNS: Record<string, RegExp> = {
  "tú/te/tu (segunda persona singular)": /\b(tú|te|tu|tus)\b/gi,
  "vosotros/vosotras": /\b(vosotro?a?s)\b/gi,
  "usted formal": /\b(usted|ustedes)\b/gi,
  "chicas/chicos/amigas/amigos (vocativo)": /\b(chicas?|chicos?|amigas?|amigos?)\b/gi,
};

function extractTopEmojis(posts: SaasSocialPost[]): { emoji: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const post of posts) {
    for (const e of post.body.match(EMOJI_RE) ?? []) {
      counts.set(e, (counts.get(e) ?? 0) + 1);
    }
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([emoji, count]) => ({ emoji, count }));
}

function splitSentences(body: string): string[] {
  return body.split(SENTENCE_END_RE).map((s) => s.trim()).filter(Boolean);
}

function computeAvgSentenceLength(posts: SaasSocialPost[]): number {
  const sentences = posts.flatMap((p) => splitSentences(p.body));
  if (!sentences.length) return 0;
  return Math.round(sentences.reduce((sum, s) => sum + s.length, 0) / sentences.length);
}

// n-gramas de 2-4 palabras con frecuencia >=3 en la ventana analizada — candidatos
// crudos, Mistral filtra cuáles son muletillas genuinas vs conectores genéricos
// ("en este post", "de la mejor manera") que un conteo puro no puede distinguir.
function extractExpressionCandidates(posts: SaasSocialPost[]): string[] {
  const freq = new Map<string, number>();
  for (const post of posts) {
    const words = post.body
      .toLowerCase()
      .normalize("NFD").replace(/[̀-ͯ]/g, "")
      .match(/[a-z]+/g) ?? [];
    for (let n = 2; n <= 4; n++) {
      for (let i = 0; i + n <= words.length; i++) {
        const gram = words.slice(i, i + n).join(" ");
        if (gram.length < 6) continue;
        freq.set(gram, (freq.get(gram) ?? 0) + 1);
      }
    }
  }
  return Array.from(freq.entries())
    .filter(([, count]) => count >= 3)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([gram]) => gram);
}

function detectAddressCounts(posts: SaasSocialPost[]): Record<string, number> {
  const combined = posts.map((p) => p.body).join(" ");
  const counts: Record<string, number> = {};
  for (const [label, re] of Object.entries(ADDRESS_PATTERNS)) {
    counts[label] = (combined.match(re) ?? []).length;
  }
  return counts;
}

// La última línea no vacía de cada post suele ser el CTA — candidatos crudos,
// Mistral agrupa variantes/paráfrasis y elige los realmente recurrentes.
function extractCtaCandidates(posts: SaasSocialPost[]): string[] {
  return posts
    .map((p) => p.body.trim().split("\n").filter(Boolean).pop() ?? "")
    .filter((line) => line.length > 0 && line.length <= 120);
}

function formatVoiceProfileForPrompt(v: VoiceProfileResult): string {
  const lines: string[] = [
    "Estas características son patrones REALES observados en posts publicados de esta cuenta — no son preferencias declaradas, son lo que esta persona realmente hace. Prioriza sonar como ESTA cuenta específica, no como un influencer genérico del nicho.",
  ];
  if (v.topEmojis.length) {
    lines.push(`- Emojis que usa con frecuencia: ${v.topEmojis.map((e) => e.emoji).join(" ")} — intégralos con moderación, en este mismo estilo. No inventes emojis distintos a estos.`);
  }
  if (v.frequentExpressions.length) {
    lines.push(`- Expresiones propias que repite: ${v.frequentExpressions.map((e) => `"${e}"`).join(", ")} — úsalas si encajan naturalmente, nunca fuerces todas en el mismo post.`);
  }
  lines.push(`- Frases cortas: sus oraciones promedian ~${v.avgSentenceLength} caracteres. Evita párrafos largos y frases subordinadas — prefiere frases directas.`);
  if (v.audienceAddressStyle) {
    lines.push(`- Se dirige a su audiencia así: ${v.audienceAddressStyle}.`);
  }
  if (v.realCTAs.length) {
    lines.push(`- CTAs reales que usa: ${v.realCTAs.map((c) => `"${c}"`).join(", ")} — prioriza CTAs en este estilo sobre CTAs genéricos.`);
  }
  const toneEntries = Object.entries(v.dominantTones).filter(([, weight]) => weight > 0);
  if (toneEntries.length) {
    lines.push(`- Tono dominante: ${toneEntries.map(([tone, weight]) => `${tone} (${weight}%)`).join(", ")}.`);
  }
  if (v.avoidedPatterns.length) {
    lines.push(`- Patrones que esta cuenta evita (guía, no prohibición absoluta): ${v.avoidedPatterns.join("; ")}.`);
  }
  return lines.join("\n");
}

type VoiceProfileAiFields = {
  frequentExpressions: string[];
  audienceAddressStyle: string;
  realCTAs: string[];
  dominantTones: Record<VoiceTone, number>;
  avoidedPatterns: string[];
  summaryText: string;
};

export class VoiceExtractionAgent {
  async run(input: { tenantId: string; saasId: string }): Promise<VoiceProfileResult | null> {
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

    const topEmojis = extractTopEmojis(published);
    const avgSentenceLength = computeAvgSentenceLength(published);
    const expressionCandidates = extractExpressionCandidates(published);
    const addressCounts = detectAddressCounts(published);
    const ctaCandidates = extractCtaCandidates(published);
    const excerpts = published.map((p) => p.body.trim().slice(0, EXCERPT_LENGTH)).join("\n---\n");

    const baseSummary = [
      `Análisis de voz basado en ${published.length} posts publicados.`,
      topEmojis.length ? `Emojis más usados: ${topEmojis.map((e) => e.emoji).join(" ")}.` : "",
      `Longitud media de frase: ${avgSentenceLength} caracteres.`,
    ].filter(Boolean).join(" ");

    const prompt = `Analiza estos fragmentos reales de posts publicados por esta cuenta y extrae su voz/estilo de escritura REAL, en español. No inventes nada que no esté respaldado por el texto.

FRAGMENTOS (uno por post, primeros ${EXCERPT_LENGTH} caracteres de cada uno):
${excerpts}

CANDIDATOS DE EXPRESIONES REPETIDAS (detectadas por frecuencia — filtra las que sean muletillas genuinas de esta cuenta, descarta conectores genéricos como "en este post" o "de la mejor manera"):
${expressionCandidates.join(", ") || "(ninguna detectada)"}

CANDIDATOS DE ÚLTIMA LÍNEA (posible CTA — agrupa variantes/paráfrasis similares y elige las 3-5 más recurrentes):
${ctaCandidates.join("\n") || "(ninguno detectado)"}

CONTEO DE FORMAS DE DIRIGIRSE A LA AUDIENCIA (detectado por regex sobre el texto completo):
${Object.entries(addressCounts).map(([k, v]) => `${k}: ${v}`).join(", ")}

Devuelve:
- frequentExpressions: las muletillas/expresiones reales (no conectores genéricos)
- realCTAs: 3-5 CTAs reales que esta cuenta usa
- audienceAddressStyle: una frase describiendo cómo se dirige a su audiencia
- dominantTones: objeto con claves "motivacional", "tecnico", "intimo", "educativo", cada una un número 0-100 que sume 100 entre las cuatro
- avoidedPatterns: 2-4 patrones de vocabulario/tono que esta cuenta evita comparado con lo típico del nicho (guía, no certeza absoluta)
- summaryText: resumen en prosa de todo lo anterior, listo para usarse como instrucción de voz para otro modelo de IA que va a escribir en el mismo estilo

Responde SOLO con el JSON solicitado.`;

    const seed: VoiceProfileAiFields = {
      frequentExpressions: expressionCandidates.slice(0, 5),
      audienceAddressStyle: "",
      realCTAs: ctaCandidates.slice(0, 3),
      dominantTones: { motivacional: 25, tecnico: 25, intimo: 25, educativo: 25 },
      avoidedPatterns: [],
      summaryText: baseSummary,
    };

    const { data } = await defaultLocalModel.generateStructured<VoiceProfileAiFields>(
      { prompt, tenantId: input.tenantId, saasId: input.saasId },
      () => seed,
    );

    const result: VoiceProfileResult = {
      postsAnalyzed: published.length,
      topEmojis,
      avgSentenceLength,
      frequentExpressions: Array.isArray(data.frequentExpressions) && data.frequentExpressions.length ? data.frequentExpressions : seed.frequentExpressions,
      audienceAddressStyle: typeof data.audienceAddressStyle === "string" && data.audienceAddressStyle.trim() ? data.audienceAddressStyle.trim() : "sin datos suficientes para determinarlo",
      realCTAs: Array.isArray(data.realCTAs) && data.realCTAs.length ? data.realCTAs : seed.realCTAs,
      dominantTones: data.dominantTones && typeof data.dominantTones === "object" ? data.dominantTones : seed.dominantTones,
      avoidedPatterns: Array.isArray(data.avoidedPatterns) ? data.avoidedPatterns : [],
      summaryText: typeof data.summaryText === "string" && data.summaryText.trim() ? data.summaryText.trim() : baseSummary,
    };

    await upsertKnowledgeDocByType({
      tenantId: input.tenantId,
      saasId: input.saasId,
      name: "Voz extraída de posts",
      type: "voice_profile",
      contentText: formatVoiceProfileForPrompt(result),
    });

    return result;
  }
}
