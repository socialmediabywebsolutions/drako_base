import { getSocialFlowRuntimeEnv } from "../../runtime-env";

export type RuntimeAiStructuredRequest<T> = {
  prompt: string;
  system?: string;
  seed: () => T;
};

export type RuntimeAiStructuredResponse<T> = {
  data: T;
  raw: string;
  provider: "runtime-deterministic" | "workers-ai";
};

export interface RuntimeAiProvider {
  generateStructured<T>(request: RuntimeAiStructuredRequest<T>): Promise<RuntimeAiStructuredResponse<T>>;
}

const RUNTIME_AI_MODEL = "@cf/meta/llama-3-8b-instruct";

const RUNTIME_AI_SYSTEM_PROMPT =
  "You are SocialFlow's content generation engine. Respond ONLY with valid JSON matching the requested shape exactly. No markdown fences, no commentary.";

class RuntimeDeterministicAiProvider implements RuntimeAiProvider {
  async generateStructured<T>(request: RuntimeAiStructuredRequest<T>): Promise<RuntimeAiStructuredResponse<T>> {
    const base = request.seed();
    return {
      data: base,
      raw: JSON.stringify({
        provider: "runtime-deterministic",
        promptPreview: request.prompt.slice(0, 120),
        system: request.system ?? null,
      }),
      provider: "runtime-deterministic",
    };
  }
}

function stripJsonFences(text: string): string {
  return text.replace(/```json/gi, "").replace(/```/g, "").trim();
}

// Overlays AI-provided values onto the deterministic seed, preserving its shape and ids.
function mergeAiStructuredOutput<T>(base: T, candidate: unknown): T {
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

class RuntimeWorkersAiProvider implements RuntimeAiProvider {
  private readonly fallback = new RuntimeDeterministicAiProvider();

  async generateStructured<T>(request: RuntimeAiStructuredRequest<T>): Promise<RuntimeAiStructuredResponse<T>> {
    const binding = getSocialFlowRuntimeEnv()?.AI;
    if (!binding?.run) {
      return this.fallback.generateStructured(request);
    }

    const base = request.seed();

    try {
      const response = (await binding.run(RUNTIME_AI_MODEL, {
        messages: [
          { role: "system", content: request.system ?? RUNTIME_AI_SYSTEM_PROMPT },
          {
            role: "user",
            content: `${request.prompt}\n\nRespond with JSON matching this shape exactly:\n${JSON.stringify(base)}`,
          },
        ],
      })) as { response?: string };

      const text = response?.response;
      if (!text) {
        throw new Error("SOCIALFLOW_RUNTIME_AI_EMPTY_RESPONSE");
      }

      const cleaned = stripJsonFences(text);
      const parsed = JSON.parse(cleaned);
      const merged = mergeAiStructuredOutput(base, parsed);

      return {
        data: merged,
        raw: cleaned,
        provider: "workers-ai",
      };
    } catch (error) {
      console.error("SOCIALFLOW_RUNTIME_AI_GENERATION_FAILED", error);
      return this.fallback.generateStructured(request);
    }
  }
}

export function createRuntimeAiProvider(): RuntimeAiProvider {
  return new RuntimeWorkersAiProvider();
}
