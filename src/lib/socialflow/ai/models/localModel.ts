import { env } from "@/lib/cf";

export type LocalModelRequest = {
  prompt: string;
  system?: string;
};

export type LocalModelResponse<T> = {
  data: T;
  raw: string;
};

export interface LocalModelClient {
  generateStructured<T>(req: LocalModelRequest, schemaFactory: () => T): Promise<LocalModelResponse<T>>;
}

// Attaches _meta without losing array-ness: object-spreading an array would
// turn it into a plain object ({0: ..., 1: ..., _meta: ...}), breaking
// downstream callers that expect an array (e.g. CompetitorAgent).
export function attachMeta<T>(base: T, meta: Record<string, unknown>): T & { _meta: unknown } {
  if (Array.isArray(base)) {
    return Object.assign([...base], { _meta: meta }) as unknown as T & { _meta: unknown };
  }
  return { ...base, _meta: meta } as T & { _meta: unknown };
}

// Deterministic stub model for demo: no external calls, no randomness critical for tests
export class DeterministicLocalModel implements LocalModelClient {
  async generateStructured<T>(req: LocalModelRequest, schemaFactory: () => T): Promise<LocalModelResponse<T>> {
    const base = schemaFactory();
    const now = new Date().toISOString();
    const decorated = attachMeta(base, {
      generatedAt: now,
      promptPreview: req.prompt.slice(0, 120),
      system: req.system ?? null,
      engine: "local-deterministic-stub",
    });

    return {
      data: decorated as unknown as T,
      raw: JSON.stringify(decorated),
    };
  }
}

const WORKERS_AI_MODEL = "@cf/mistralai/mistral-small-3.1-24b-instruct";

const WORKERS_AI_SYSTEM_PROMPT =
  "You are SocialFlow's content generation engine. Respond ONLY with valid JSON matching the requested shape exactly. No markdown fences, no commentary.";

export function stripJsonFences(text: string): string {
  return text.replace(/```json/gi, "").replace(/```/g, "").trim();
}

// Overlays AI-provided values onto the deterministic seed, preserving its shape and ids.
export function mergeAiStructuredOutput<T>(base: T, candidate: unknown): T {
  if (candidate === null || candidate === undefined) return base;

  if (Array.isArray(base)) {
    if (!Array.isArray(candidate)) return base;
    return base.map((item, index) => mergeAiStructuredOutput(item, candidate[index])) as unknown as T;
  }

  if (base !== null && typeof base === "object") {
    if (candidate === null || typeof candidate !== "object" || Array.isArray(candidate)) return base;
    const baseRecord = base as Record<string, unknown>;
    const candidateRecord = candidate as Record<string, unknown>;
    const result: Record<string, unknown> = { ...baseRecord };
    for (const key of Object.keys(baseRecord)) {
      if (/(^id$|Id$|ID$)/.test(key)) continue;
      result[key] = mergeAiStructuredOutput(baseRecord[key], candidateRecord[key]);
    }
    return result as T;
  }

  if (typeof base === "string") {
    return (typeof candidate === "string" && candidate.trim() ? candidate.trim() : base) as unknown as T;
  }

  if (typeof base === "number") {
    return (typeof candidate === "number" && Number.isFinite(candidate) ? candidate : base) as unknown as T;
  }

  return base;
}

// Backed by Cloudflare Workers AI when the binding is available, falling back to the
// deterministic stub on any missing binding, empty response or parse failure.
export class WorkersAiLocalModel implements LocalModelClient {
  private readonly fallback = new DeterministicLocalModel();

  async generateStructured<T>(req: LocalModelRequest, schemaFactory: () => T): Promise<LocalModelResponse<T>> {
    const binding = env()?.AI;
    if (!binding?.run) {
      return this.fallback.generateStructured(req, schemaFactory);
    }

    const base = schemaFactory();

    try {
      const response = (await binding.run(WORKERS_AI_MODEL, {
        messages: [
          { role: "system", content: req.system ?? WORKERS_AI_SYSTEM_PROMPT },
          {
            role: "user",
            content: `${req.prompt}\n\nRespond with JSON matching this shape exactly:\n${JSON.stringify(base)}`,
          },
        ],
        max_tokens: 4096,
      })) as { response?: unknown };

      const raw = response?.response;
      let text: string;
      if (typeof raw === "string") {
        text = raw;
      } else if (raw && typeof raw === "object") {
        text = JSON.stringify(raw);
      } else {
        throw new Error("SOCIALFLOW_AI_EMPTY_RESPONSE");
      }

      const cleaned = stripJsonFences(text);
      const parsed = JSON.parse(cleaned);
      const merged = mergeAiStructuredOutput(base, parsed);
      const decorated = attachMeta(merged, {
        generatedAt: new Date().toISOString(),
        promptPreview: req.prompt.slice(0, 120),
        system: req.system ?? null,
        engine: "workers-ai",
        model: WORKERS_AI_MODEL,
      });

      return {
        data: decorated as unknown as T,
        raw: cleaned,
      };
    } catch (error) {
      console.error("SOCIALFLOW_AI_GENERATION_FAILED", error);
      return this.fallback.generateStructured(req, schemaFactory);
    }
  }
}

export const defaultLocalModel: LocalModelClient = new WorkersAiLocalModel();
