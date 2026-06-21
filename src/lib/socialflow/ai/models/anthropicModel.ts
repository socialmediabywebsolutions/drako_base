import { env } from "@/lib/cf";
import { reportAiUsage } from "@/lib/ai/usage";
import {
  attachMeta,
  defaultLocalModel,
  mergeAiStructuredOutput,
  stripJsonFences,
  type LocalModelClient,
  type LocalModelRequest,
  type LocalModelResponse,
} from "@/lib/socialflow/ai/models/localModel";

const ANTHROPIC_MODEL = "claude-sonnet-4-6";
const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";

const ANTHROPIC_SYSTEM_PROMPT =
  "You are SocialFlow's strategic intelligence engine. Respond ONLY with valid JSON matching the requested shape exactly. No markdown fences, no commentary.";

function resolveApiKey(): string | null {
  const direct = typeof process !== "undefined" ? process.env.ANTHROPIC_API_KEY : null;
  if (direct?.trim()) return direct.trim();
  const bound = env()?.ANTHROPIC_API_KEY;
  return typeof bound === "string" && bound.trim().length > 0 ? bound.trim() : null;
}

// Backed by the Anthropic Messages API (claude-sonnet-4-6) when ANTHROPIC_API_KEY is configured,
// falling back to the Workers AI / deterministic chain on any missing key, HTTP error or parse failure.
export class AnthropicLocalModel implements LocalModelClient {
  constructor(private readonly fallback: LocalModelClient = defaultLocalModel) {}

  async generateStructured<T>(req: LocalModelRequest, schemaFactory: () => T): Promise<LocalModelResponse<T>> {
    const apiKey = resolveApiKey();
    if (!apiKey) {
      return this.fallback.generateStructured(req, schemaFactory);
    }

    const base = schemaFactory();

    try {
      const response = await fetch(ANTHROPIC_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": ANTHROPIC_VERSION,
        },
        body: JSON.stringify({
          model: ANTHROPIC_MODEL,
          max_tokens: 4096,
          system: req.system ?? ANTHROPIC_SYSTEM_PROMPT,
          messages: [
            {
              role: "user",
              content: `${req.prompt}\n\nRespond with JSON matching this shape exactly:\n${JSON.stringify(base)}`,
            },
          ],
        }),
      });

      if (!response.ok) {
        throw new Error(`SOCIALFLOW_ANTHROPIC_HTTP_${response.status}`);
      }

      const payload = (await response.json()) as {
        content?: Array<{ type: string; text?: string }>;
        usage?: { input_tokens?: number; output_tokens?: number };
      };
      const text = payload.content?.find((block) => block.type === "text")?.text;
      if (!text) {
        throw new Error("SOCIALFLOW_ANTHROPIC_EMPTY_RESPONSE");
      }

      const cleaned = stripJsonFences(text);
      const parsed = JSON.parse(cleaned);
      const merged = mergeAiStructuredOutput(base, parsed);
      const decorated = attachMeta(merged, {
        generatedAt: new Date().toISOString(),
        promptPreview: req.prompt.slice(0, 120),
        system: req.system ?? null,
        engine: "anthropic",
        model: ANTHROPIC_MODEL,
      });

      // Report exact token usage from Anthropic's response
      if (req.tenantId && req.saasId) {
        void reportAiUsage({
          tenantId: req.tenantId,
          saasId: req.saasId,
          model: ANTHROPIC_MODEL,
          tokensIn: payload.usage?.input_tokens ?? 0,
          tokensOut: payload.usage?.output_tokens ?? 0,
        });
      }

      return {
        data: decorated as unknown as T,
        raw: cleaned,
      };
    } catch (error) {
      console.error("SOCIALFLOW_ANTHROPIC_GENERATION_FAILED", error);
      return this.fallback.generateStructured(req, schemaFactory);
    }
  }
}

export const intelligenceModel: LocalModelClient = new AnthropicLocalModel();
