import { env } from "@/lib/cf";
import { reportAiUsage, reportSocialflowAiUsage } from "@/lib/ai/usage";

export type LocalModelRequest = {
  prompt: string;
  system?: string;
  // Optional context for AI cost tracking
  tenantId?: string;
  saasId?: string;
  // Nombre del agente caller (ej: "ImageAnalysisAgent", "ContentGeneratorAgent") — cuando
  // se pasa junto con tenantId, además del contador agregado de reportAiUsage se escribe
  // una fila en socialflow_ai_usage_log (SOCIAL_DB) para ese agente/modelo/llamada.
  // Ausente en cualquier caller que no lo pase explícitamente: cero cambio de
  // comportamiento para ellos.
  agent?: string;
  // Nombres de campo que mergeAiStructuredOutput nunca sobrescribe con la respuesta de
  // la IA, aunque la IA los incluya en su JSON — se quedan exactamente con el valor del
  // seed/base (ver mergeAiStructuredOutput más abajo). Vacío por defecto: no cambia el
  // comportamiento de ningún caller existente que no lo pase explícitamente.
  protectedKeys?: string[];
  // Opcional — sobreescribe el max_tokens por defecto (4096) para esta llamada.
  // Ausente en cualquier caller existente: cero cambio de comportamiento para ellos.
  // Ver CarouselComposerAgent.ts (CAROUSEL_MAX_TOKENS) — el único caller que lo usa hoy.
  maxTokens?: number;
};

export type LocalModelResponse<T> = {
  data: T;
  raw: string;
  // true cuando `data` es el seed determinista (DeterministicLocalModel), no una
  // respuesta real de Mistral — ver WorkersAiLocalModel.generateStructured. Los callers
  // que no puedan tolerar contenido de plantilla (ej. CarouselComposerAgent) deben
  // comprobarlo y lanzar en vez de devolver el fallback como si fuera contenido real.
  isFallback: boolean;
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
      isFallback: true,
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
// protectedKeys (vacío por defecto, no afecta a callers que no lo pasan): nombres de
// campo que se quedan siempre con el valor de `base`, sin importar lo que traiga
// `candidate` — se comprueban en dos sitios:
//  1) como key literal de un objeto (ej. "effects", "imageSegments" en ReelsConfig),
//  2) como valor del campo `role` del propio objeto que se está fusionando (ej. "cta"
//     protege el overlay entero cuyo role es "cta" — texto, animación, posición y
//     tamaño ya decididos por seed, no tiene sentido protegerlo campo a campo).
export function mergeAiStructuredOutput<T>(base: T, candidate: unknown, protectedKeys: Set<string> = new Set()): T {
  if (candidate === null || candidate === undefined) return base;

  if (Array.isArray(base)) {
    if (!Array.isArray(candidate) || candidate.length === 0) return base;

    // Arrays of primitives (e.g. hashtag lists) have no per-element id to preserve,
    // so the AI's full list can replace the seed outright. Object arrays (keyword
    // clusters, post variants, etc.) keep the index-aligned merge below so each
    // element's seeded id survives — mapping over base here would otherwise cap
    // the result to base.length, discarding anything the model generated beyond
    // the seed's size (this is what truncated hashtags down to the seed pool).
    const isPrimitiveArray = base.every((item) => item === null || typeof item !== "object");
    if (isPrimitiveArray) return candidate as unknown as T;

    return base.map((item, index) => mergeAiStructuredOutput(item, candidate[index], protectedKeys)) as unknown as T;
  }

  if (base !== null && typeof base === "object") {
    if (candidate === null || typeof candidate !== "object" || Array.isArray(candidate)) return base;
    const baseRecord = base as Record<string, unknown>;

    const role = baseRecord.role;
    if (typeof role === "string" && protectedKeys.has(role)) return base;

    const candidateRecord = candidate as Record<string, unknown>;
    const result: Record<string, unknown> = { ...baseRecord };
    for (const key of Object.keys(baseRecord)) {
      if (/(^id$|Id$|ID$)/.test(key)) continue;
      if (protectedKeys.has(key)) continue;
      result[key] = mergeAiStructuredOutput(baseRecord[key], candidateRecord[key], protectedKeys);
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
        max_tokens: req.maxTokens ?? 4096,
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
      const merged = mergeAiStructuredOutput(base, parsed, new Set(req.protectedKeys ?? []));
      const decorated = attachMeta(merged, {
        generatedAt: new Date().toISOString(),
        promptPreview: req.prompt.slice(0, 120),
        system: req.system ?? null,
        engine: "workers-ai",
        model: WORKERS_AI_MODEL,
      });

      // Estimate token counts from prompt/output length (Workers AI doesn't report them)
      if (req.tenantId && req.saasId) {
        const promptText = `${req.system ?? ""} ${req.prompt}`;
        const estimatedIn = Math.ceil(promptText.length / 4);
        const estimatedOut = Math.ceil(cleaned.length / 4);
        void reportAiUsage({ tenantId: req.tenantId, saasId: req.saasId, model: WORKERS_AI_MODEL, tokensIn: estimatedIn, tokensOut: estimatedOut });
        if (req.agent) {
          void reportSocialflowAiUsage({
            tenantId: req.tenantId,
            agent: req.agent,
            model: WORKERS_AI_MODEL,
            inputTokens: estimatedIn,
            outputTokens: estimatedOut,
          });
        }
      }

      return {
        data: decorated as unknown as T,
        raw: cleaned,
        isFallback: false,
      };
    } catch (error) {
      console.error("SOCIALFLOW_AI_GENERATION_FAILED", error);
      return this.fallback.generateStructured(req, schemaFactory);
    }
  }
}

export const defaultLocalModel: LocalModelClient = new WorkersAiLocalModel();
