import type { DracoEnv } from "@/lib/cf";
import { listHoldingSocialFeed, saveRevistaArticle, type HoldingSocialPost } from "./repository";

type AiTextResponse = { response?: string };

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 80);
}

function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

function generateId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }
}

type ParsedArticle = {
  title: string;
  excerpt: string;
  body: string;
};

function parseAiArticle(raw: string): ParsedArticle {
  // Try to extract structured sections from the AI output
  const titleMatch = raw.match(/(?:título|title)[:\s]+(.+)/i);
  const excerptMatch = raw.match(/(?:resumen|excerpt|summary)[:\s]+([\s\S]+?)(?:\n\n|\ncuerpo|\nbody|$)/i);
  const bodyMatch = raw.match(/(?:cuerpo|body|artículo)[:\s]+([\s\S]+)/i);

  const title = titleMatch?.[1]?.trim() ?? raw.split("\n")[0]?.trim() ?? "Actividad reciente en Drako Systems";
  const excerpt = excerptMatch?.[1]?.trim() ?? raw.slice(0, 200).trim();
  const body = bodyMatch?.[1]?.trim() ?? raw;

  return { title, excerpt, body };
}

export class RevistaCronAgent {
  private env: DracoEnv;

  constructor(env: DracoEnv) {
    this.env = env;
  }

  async run(): Promise<{ articlesGenerated: number }> {
    const posts = await listHoldingSocialFeed({ limit: 20 });

    if (posts.length === 0) {
      console.log("[RevistaCronAgent] No published posts found, skipping article generation");
      return { articlesGenerated: 0 };
    }

    let articlesGenerated = 0;

    // Generate main holding-level editorial article
    const holdingArticle = await this.generateHoldingArticle(posts);
    if (holdingArticle) {
      await saveRevistaArticle(holdingArticle);
      articlesGenerated++;
    }

    // Generate per-SaaS mini-articles when there are 3+ posts for that SaaS
    const bySaas = this.groupBySaas(posts);
    for (const [saasId, saasPosts] of Object.entries(bySaas)) {
      if (saasPosts.length >= 3) {
        const saasArticle = await this.generateSaasArticle(saasId, saasPosts);
        if (saasArticle) {
          await saveRevistaArticle(saasArticle);
          articlesGenerated++;
        }
      }
    }

    return { articlesGenerated };
  }

  private groupBySaas(posts: HoldingSocialPost[]): Record<string, HoldingSocialPost[]> {
    return posts.reduce<Record<string, HoldingSocialPost[]>>((acc, post) => {
      if (!acc[post.saasId]) acc[post.saasId] = [];
      acc[post.saasId].push(post);
      return acc;
    }, {});
  }

  private formatPostsForPrompt(posts: HoldingSocialPost[]): string {
    return posts
      .map(
        (p, i) =>
          `[${i + 1}] ${p.saasName} (${p.provider}): ${p.body.slice(0, 300)}`,
      )
      .join("\n\n");
  }

  private async callAi(prompt: string): Promise<string | null> {
    const ai = this.env.AI;
    if (!ai) {
      console.warn("[RevistaCronAgent] AI binding not available");
      return null;
    }

    try {
      const response = await ai.run("@cf/meta/llama-3.1-8b-instruct", {
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
        max_tokens: 1024,
      }) as AiTextResponse;

      return response?.response ?? null;
    } catch (err) {
      console.error("[RevistaCronAgent] AI call failed", err instanceof Error ? err.message : String(err));
      return null;
    }
  }

  private async generateHoldingArticle(posts: HoldingSocialPost[]) {
    const postsText = this.formatPostsForPrompt(posts);
    const prompt = `Eres el editor de Drako Systems, una empresa holding de SaaS impulsados por IA. Escribe un artículo editorial en español sobre la actividad reciente de nuestros productos. Aquí están los últimos posts publicados en redes sociales:

${postsText}

Genera un artículo con el siguiente formato exacto:
Título: [título atractivo]
Resumen: [resumen de 2 frases que capture la esencia del artículo]
Cuerpo: [cuerpo de 3-4 párrafos profesionales y dinámicos]

El tono es profesional pero dinámico, orientado a mostrar el poder de la IA automatizando el negocio digital. Habla desde la perspectiva del holding Drako Systems.`;

    const raw = await this.callAi(prompt);
    if (!raw) return null;

    const parsed = parseAiArticle(raw);
    const now = nowSeconds();
    const slug = `${slugify(parsed.title)}-${now}`;

    return {
      id: generateId(),
      slug,
      title: parsed.title,
      excerpt: parsed.excerpt,
      body: parsed.body,
      saasId: null,
      category: "ia" as const,
      coverImageUrl: null,
      authorName: "Drako IA",
      publishedAt: now,
      createdAt: now,
      status: "published" as const,
      sourcePostIds: posts.map((p) => p.id),
    };
  }

  private async generateSaasArticle(saasId: string, posts: HoldingSocialPost[]) {
    const saasName = posts[0]?.saasName ?? saasId;
    const postsText = this.formatPostsForPrompt(posts);
    const prompt = `Eres el editor de Drako Systems. Escribe un mini-artículo en español sobre la actividad reciente de ${saasName}, uno de nuestros productos SaaS. Aquí están los últimos posts publicados en redes sociales:

${postsText}

Genera un artículo con el siguiente formato exacto:
Título: [título atractivo sobre ${saasName}]
Resumen: [resumen de 2 frases]
Cuerpo: [cuerpo de 2-3 párrafos sobre el producto y su actividad reciente]

El tono es profesional y orientado al resultado. Destaca cómo la automatización con IA impulsa el crecimiento de ${saasName}.`;

    const raw = await this.callAi(prompt);
    if (!raw) return null;

    const parsed = parseAiArticle(raw);
    const now = nowSeconds();
    const slug = `${saasId}-${slugify(parsed.title)}-${now}`;

    return {
      id: generateId(),
      slug,
      title: parsed.title,
      excerpt: parsed.excerpt,
      body: parsed.body,
      saasId,
      category: "producto" as const,
      coverImageUrl: null,
      authorName: "Drako IA",
      publishedAt: now,
      createdAt: now,
      status: "published" as const,
      sourcePostIds: posts.map((p) => p.id),
    };
  }
}
