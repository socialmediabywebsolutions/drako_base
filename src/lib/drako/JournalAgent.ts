import { env } from "@/lib/cf";
import type { JournalArticleInput } from "@/lib/drako/journal-repository";

// Genera un artículo del Journal de drako.systems: texto con Workers AI (Mistral
// Small 3.1) y portada con SDXL subida a R2. No escribe en D1 — devuelve el
// artículo listo para insertJournalArticle.

const ARTICLE_MODEL = "@cf/mistralai/mistral-small-3.1-24b-instruct";
const COVER_MODEL = "@cf/stabilityai/stable-diffusion-xl-base-1.0";
const R2_PUBLIC_BASE = "https://pub-04c730a67921499bac35a1f62402cc17.r2.dev";

export const JOURNAL_TOPICS = [
  "Automatización empresarial con IA",
  "El futuro del SaaS en Europa",
  "Cómo la IA transforma el marketing digital",
  "Agentes IA: la próxima revolución",
  "Blockchain e IA: convergencia inevitable",
  "Machine Learning para PyMEs",
  "Ética en la inteligencia artificial",
  "IA generativa y creatividad empresarial",
  "Automatización de procesos con agentes IA",
  "El rol de los LLMs en el software moderno",
] as const;

const SYSTEM_PROMPT =
  "Eres el equipo editorial de Drako Systems, un holding tecnológico que crea y dirige SaaS impulsados por IA. " +
  "Escribes en español de España, con tono experto, claro y sin humo. " +
  "Respondes SOLO con JSON válido, sin bloques de código ni comentarios.";

// Rotación semanal: mismo tema durante toda la semana ISO, el siguiente la próxima.
export function pickWeeklyTopic(date = new Date()): string {
  const weekIndex = Math.floor(date.getTime() / (7 * 24 * 60 * 60 * 1000));
  return JOURNAL_TOPICS[weekIndex % JOURNAL_TOPICS.length];
}

export function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

const ALLOWED_TAGS = new Set(["h2", "h3", "h4", "p", "ul", "ol", "li", "strong", "em", "b", "i", "blockquote", "a", "br", "code", "pre"]);

// El HTML del modelo se pinta con dangerouslySetInnerHTML — solo pasan las etiquetas
// de texto de ALLOWED_TAGS, sin atributos salvo href http(s) en <a>.
export function sanitizeArticleHtml(html: string): string {
  const withoutBlocks = html.replace(/<(script|style|iframe|object|embed|svg|math)[\s\S]*?<\/\1\s*>/gi, "");
  return withoutBlocks.replace(/<\/?([a-zA-Z0-9]+)([^>]*)>/g, (match, rawTag: string, attrs: string) => {
    const tag = rawTag.toLowerCase();
    if (!ALLOWED_TAGS.has(tag)) return "";
    if (match.startsWith("</")) return `</${tag}>`;
    if (tag === "a") {
      const href = attrs.match(/href\s*=\s*["']([^"']+)["']/i)?.[1] ?? "";
      return /^https?:\/\//i.test(href)
        ? `<a href="${href.replace(/"/g, "&quot;")}" target="_blank" rel="noopener noreferrer">`
        : "<a>";
    }
    return `<${tag}>`;
  });
}

function stripJsonFences(text: string): string {
  return text.replace(/```json/gi, "").replace(/```/g, "").trim();
}

function asString(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function estimateReadingTime(html: string): number {
  const words = html.replace(/<[^>]+>/g, " ").trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

async function readStream(stream: ReadableStream<Uint8Array>): Promise<ArrayBuffer> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) chunks.push(value);
  }
  const merged = new Uint8Array(chunks.reduce((sum, c) => sum + c.length, 0));
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.length;
  }
  return merged.buffer as ArrayBuffer;
}

async function generateArticleText(topic: string) {
  const ai = env()?.AI;
  if (!ai?.run) throw new Error("JOURNAL_AI_BINDING_MISSING");

  const shape = {
    title: "string",
    slug: "string-en-kebab-case",
    excerpt: "string (1-2 frases)",
    content: "string HTML con <h2>, <p>, <ul>, <li>, <strong>, <blockquote>",
    category: "string (una palabra, ej. ia, saas, automatizacion, etica)",
    tags: ["string"],
    reading_time: 6,
    seo_title: "string (máx. 60 caracteres)",
    seo_description: "string (máx. 155 caracteres)",
  };

  const response = (await ai.run(ARTICLE_MODEL, {
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content:
          `Escribe un artículo original para el Journal de Drako sobre: "${topic}".\n` +
          "Entre 900 y 1300 palabras, con introducción, 4-6 secciones con <h2> y una conclusión práctica. " +
          "Incluye ejemplos concretos para fundadores y equipos técnicos. Sin <h1> ni imágenes en el HTML.\n\n" +
          `Responde con JSON con exactamente esta forma:\n${JSON.stringify(shape)}`,
      },
    ],
    max_tokens: 4096,
  })) as { response?: unknown };

  const raw = response?.response;
  const text = typeof raw === "string" ? raw : raw && typeof raw === "object" ? JSON.stringify(raw) : "";
  if (!text) throw new Error("JOURNAL_AI_EMPTY_RESPONSE");
  return JSON.parse(stripJsonFences(text)) as Record<string, unknown>;
}

// Nunca lanza: sin binding o si SDXL falla, el artículo sale sin portada.
async function generateCover(title: string, slug: string): Promise<string | null> {
  const bindings = env();
  if (!bindings?.AI?.run || !bindings.SOCIAL_MEDIA_BUCKET) return null;

  try {
    const output = await bindings.AI.run(COVER_MODEL, {
      prompt:
        `editorial cover illustration about "${title}", futuristic digital technology, abstract data visualization, ` +
        "clean light background, blue #3b82f6 and turquoise #06b6d4 accents, soft glow, cinematic lighting, ultra detailed",
      negative_prompt: "text, letters, watermark, logo, people, faces, office, blurry, low quality",
      num_steps: 20,
      width: 1344,
      height: 768,
    });
    const buffer =
      output instanceof ReadableStream ? await readStream(output as ReadableStream<Uint8Array>)
      : output instanceof ArrayBuffer ? output
      : output instanceof Uint8Array ? (output.buffer as ArrayBuffer)
      : null;
    if (!buffer) return null;

    // SDXL devuelve PNG — se guarda con su extensión real.
    const key = `journal/covers/${slug}.png`;
    await bindings.SOCIAL_MEDIA_BUCKET.put(key, buffer, { httpMetadata: { contentType: "image/png" } });
    return `${R2_PUBLIC_BASE}/${key}`;
  } catch (err) {
    console.error("JOURNAL_COVER_FAILED", { slug, error: err instanceof Error ? err.message : String(err) });
    return null;
  }
}

export async function generateJournalArticle(topic: string = pickWeeklyTopic()): Promise<JournalArticleInput> {
  const data = await generateArticleText(topic);

  const title = asString(data.title, topic);
  const slug = slugify(asString(data.slug, title)) || slugify(title) || `articulo-${Date.now().toString(36)}`;
  const content = sanitizeArticleHtml(asString(data.content, ""));
  if (!content) throw new Error("JOURNAL_AI_EMPTY_CONTENT");

  const excerpt = asString(data.excerpt, content.replace(/<[^>]+>/g, " ").trim().slice(0, 220));
  const tags = Array.isArray(data.tags)
    ? data.tags.filter((t): t is string => typeof t === "string" && t.trim().length > 0).map((t) => t.trim()).slice(0, 8)
    : [];
  const readingTime =
    typeof data.reading_time === "number" && Number.isFinite(data.reading_time) && data.reading_time > 0
      ? Math.round(data.reading_time)
      : estimateReadingTime(content);

  return {
    slug,
    title,
    excerpt,
    content,
    coverImageUrl: await generateCover(title, slug),
    category: slugify(asString(data.category, "ia")) || "ia",
    tags,
    readingTime,
    seoTitle: asString(data.seo_title, title).slice(0, 70),
    seoDescription: asString(data.seo_description, excerpt).slice(0, 160),
  };
}
