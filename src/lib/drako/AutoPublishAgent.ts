import { env, type DracoEnv } from "@/lib/cf";
import { listPublishedJournalArticles, type JournalArticle } from "@/lib/drako/journal-repository";
import { insertSocialPosts } from "@/lib/drako/social-posts-repository";

// AutoPublishAgent de @drako.systems. Lo llama /api/cron/auto-publish (cron "0 10 * * 1-5"
// de drako-scheduler y el botón "Generar ahora" del operator).
//   1. Lee el último artículo publicado del Journal (directo de D1: el worker no se llama
//      a su propia API por HTTP).
//   2. Si tiene menos de 24 h, lo adapta a Instagram y LinkedIn con Mistral (mismo modelo
//      que JournalAgent); si no, genera un post genérico sobre el ecosistema Drako.
//   3. Guarda ambos posts en drako_social_posts con status 'pendiente'.
// No publica en Meta/LinkedIn: eso se activará cuando existan META_ACCESS_TOKEN y
// LINKEDIN_ACCESS_TOKEN.

const MODEL = "@cf/mistralai/mistral-small-3.1-24b-instruct";
const SITE_URL = "https://drako.systems";
const DAY_MS = 24 * 60 * 60 * 1000;

const INSTAGRAM_MAX = 2200;
const LINKEDIN_MAX = 700;
const INSTAGRAM_HASHTAGS = ["#IA", "#SaaS", "#Drako", "#TechEcosystem", "#Innovation"];
const LINKEDIN_HASHTAGS = ["#IA", "#SaaS", "#Drako"];

const SYSTEM_PROMPT =
  "Eres el community manager de Drako Systems, un holding tecnológico que crea y dirige SaaS impulsados por IA " +
  "(Socialcors, Mentoría, Crypto IA, Cazh, Rentia). Escribes en español de España, claro, sin humo ni emojis en exceso. " +
  "Respondes SOLO con JSON válido, sin bloques de código ni comentarios.";

export type AutoPublishResult = { instagram: string; linkedin: string; saved: number; sourceArticleId: string | null };

function stripJsonFences(text: string): string {
  return text.replace(/```json/gi, "").replace(/```/g, "").trim();
}

function stripHashtags(text: string): string {
  return text.replace(/(^|\s)#[\p{L}\p{N}_]+/gu, "$1").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

// Recorta en el último límite de palabra para que quepa en `max` caracteres.
function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

// Cuerpo sin hashtags + exactamente los hashtags fijados, respetando el límite total.
function composePost(body: string, hashtags: string[], max: number): string {
  const tags = hashtags.join(" ");
  const room = max - tags.length - 2;
  return `${truncate(stripHashtags(body), room)}\n\n${tags}`;
}

function isRecent(article: JournalArticle, now: number): boolean {
  const published = Date.parse(article.publishedAt);
  return !Number.isNaN(published) && now - published < DAY_MS;
}

async function askModel(e: DracoEnv | null, prompt: string): Promise<{ instagram?: unknown; linkedin?: unknown }> {
  const ai = e?.AI;
  if (!ai?.run) throw new Error("AUTO_PUBLISH_AI_BINDING_MISSING");
  const response = (await ai.run(MODEL, {
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: prompt },
    ],
    max_tokens: 1500,
  })) as { response?: unknown };
  const raw = response?.response;
  if (raw && typeof raw === "object") return raw as { instagram?: unknown; linkedin?: unknown };
  if (typeof raw !== "string" || !raw.trim()) throw new Error("AUTO_PUBLISH_AI_EMPTY_RESPONSE");
  return JSON.parse(stripJsonFences(raw)) as { instagram?: unknown; linkedin?: unknown };
}

const OUTPUT_SHAPE =
  'Responde con JSON con exactamente esta forma: {"instagram": "string", "linkedin": "string"}. ' +
  "Instagram: 600-1500 caracteres, cercano, con saltos de línea y una llamada a la acción; SIN hashtags (se añaden después). " +
  "LinkedIn: tono profesional, máximo 550 caracteres, sin hashtags ni emojis.";

function articlePrompt(article: JournalArticle): string {
  const url = `${SITE_URL}/journal/${article.slug}`;
  const text = article.content.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 3000);
  return (
    `Adapta este artículo del Journal de Drako a un post de Instagram y otro de LinkedIn. Menciona que el artículo completo está en ${url}.\n\n` +
    `Título: ${article.title}\nResumen: ${article.excerpt}\nTexto: ${text}\n\n${OUTPUT_SHAPE}`
  );
}

function genericPrompt(): string {
  return (
    "No hay artículo nuevo hoy. Escribe un post sobre el ecosistema Drako: un holding que construye SaaS de IA " +
    "que comparten una misma inteligencia, cómo opera y qué aporta a pymes y fundadores. Elige un ángulo concreto, no una lista de productos. " +
    `Invita a seguir el ecosistema en ${SITE_URL}/ecosystem.\n\n${OUTPUT_SHAPE}`
  );
}

// Sin IA o si el modelo falla, el post sale del propio artículo (o de un texto fijo):
// el cron nunca se queda sin generar.
function fallbackPosts(article: JournalArticle | null): { instagram: string; linkedin: string } {
  if (article) {
    const url = `${SITE_URL}/journal/${article.slug}`;
    return {
      instagram: `${article.title}\n\n${article.excerpt}\n\nLee el artículo completo en el Journal de Drako 👉 ${url}`,
      linkedin: `Nuevo en el Journal de Drako: ${article.title}. ${article.excerpt} Artículo completo: ${url}`,
    };
  }
  return {
    instagram:
      "Drako no es una agencia ni una herramienta suelta: es un holding que construye SaaS de IA que comparten una misma inteligencia.\n\n" +
      "Cada producto resuelve un problema real — redes sociales, educación, finanzas, inmobiliaria — y todos aprenden del mismo cerebro.\n\n" +
      `Sigue el ecosistema en tiempo real 👉 ${SITE_URL}/ecosystem`,
    linkedin:
      "En Drako construimos y dirigimos SaaS especializados impulsados por IA. Cada producto resuelve un problema concreto y todos comparten " +
      `la misma infraestructura e inteligencia. Publicamos el estado del ecosistema en abierto: ${SITE_URL}/ecosystem`,
  };
}

export async function runAutoPublishAgent(e: DracoEnv | null = env()): Promise<AutoPublishResult> {
  let article: JournalArticle | null = null;
  try {
    const latest = (await listPublishedJournalArticles(1)).articles[0] ?? null;
    article = latest && isRecent(latest, Date.now()) ? latest : null;
  } catch (error) {
    console.error("AUTO_PUBLISH_JOURNAL_READ_FAILED", error instanceof Error ? error.message : String(error));
  }

  let drafts = fallbackPosts(article);
  try {
    const data = await askModel(e, article ? articlePrompt(article) : genericPrompt());
    drafts = {
      instagram: typeof data.instagram === "string" && data.instagram.trim() ? data.instagram.trim() : drafts.instagram,
      linkedin: typeof data.linkedin === "string" && data.linkedin.trim() ? data.linkedin.trim() : drafts.linkedin,
    };
  } catch (error) {
    console.error("AUTO_PUBLISH_AI_FAILED", error instanceof Error ? error.message : String(error));
  }

  const instagram = composePost(drafts.instagram, INSTAGRAM_HASHTAGS, INSTAGRAM_MAX);
  const linkedin = composePost(drafts.linkedin, LINKEDIN_HASHTAGS, LINKEDIN_MAX);
  const sourceArticleId = article?.id ?? null;

  const saved = await insertSocialPosts([
    { platform: "instagram", content: instagram, hashtags: INSTAGRAM_HASHTAGS, sourceArticleId },
    { platform: "linkedin", content: linkedin, hashtags: LINKEDIN_HASHTAGS, sourceArticleId },
  ]);

  return { instagram, linkedin, saved, sourceArticleId };
}
