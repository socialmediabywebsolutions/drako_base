import type { MentoriaTeachingResponse } from "@/lib/agents/mentoria/base-agent";
import { env } from "@/lib/cf";

export type MentoriaLlmMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type MentoriaLlmResult = {
  provider: "workers-ai";
  text: string;
  totalTokens: number;
  model: string;
  isFallback?: boolean;
  failureReason?: string;
};

const AI_TIMEOUT_MS = 15000;

const DEFAULT_FAST_MODEL = "@cf/meta/llama-3.1-8b-instruct-fast";
const DEFAULT_SMART_MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

type MentoriaLlmMode = "fast" | "smart";

function resolveMentoriaModel(mode: MentoriaLlmMode = "fast") {
  const bindings = env();
  const configuredFastModel =
    (typeof process !== "undefined" ? process.env?.MENTORIA_AI_MODEL_FAST : undefined)
    || ((bindings as Record<string, string | undefined> | null)?.MENTORIA_AI_MODEL_FAST);
  const configuredSmartModel =
    (typeof process !== "undefined" ? process.env?.MENTORIA_AI_MODEL_SMART : undefined)
    || ((bindings as Record<string, string | undefined> | null)?.MENTORIA_AI_MODEL_SMART);

  if (mode === "smart") {
    return configuredSmartModel?.trim() || DEFAULT_SMART_MODEL;
  }
  return configuredFastModel?.trim() || DEFAULT_FAST_MODEL;
}

function isProviderUnavailableMessage(message: string) {
  const normalized = message.toLowerCase();
  return [
    "trial expired",
    "upgrade to continue",
    "quota",
    "billing",
    "credit",
    "insufficient balance",
    "payment required",
    "account disabled",
    "account not in good standing",
  ].some((fragment) => normalized.includes(fragment));
}

function parseWorkersAiResponse(response: unknown): { text: string; totalTokens: number } {
  const body = response as
    | {
        response?: string | { text?: string; tokens?: number };
        choices?: Array<{ message?: { content?: string } }>;
        usage?: { total_tokens?: number };
      }
    | null;

  const text =
    typeof body?.response === "string"
      ? body.response
      : body?.response && typeof body.response === "object" && typeof body.response.text === "string"
        ? body.response.text
        : body?.choices?.[0]?.message?.content;

  if (!text?.trim()) {
    throw new Error("MENTORIA_AI_EMPTY_RESPONSE");
  }

  const totalTokens =
    typeof body?.response === "object" && body.response && "tokens" in body.response
      ? Number(body.response.tokens ?? 0)
      : Number(body?.usage?.total_tokens ?? 0);

  return {
    text: text.trim(),
    totalTokens,
  };
}

function createTimeoutPromise<T>(ms: number): Promise<T> {
  return new Promise((_, reject) =>
    setTimeout(() => reject(new Error("MENTORIA_AI_TIMEOUT")), ms)
  );
}

export async function runMentoriaLlm(messages: MentoriaLlmMessage[]): Promise<MentoriaLlmResult> {
  const bindings = env();
  const hardOff = (
    (typeof process !== "undefined" ? process.env?.AI_HARD_OFF : undefined) ||
    ((bindings as unknown as Record<string, string | undefined>)?.AI_HARD_OFF)
  );
  if (hardOff && hardOff.toLowerCase() === "true") {
    throw new Error("MENTORIA_AI_NOT_AVAILABLE");
  }
  const ai = bindings?.AI;
  const model = resolveMentoriaModel("fast");

  if (!ai?.run) {
    throw new Error("AI_BINDING_MISSING");
  }

  try {
    const response = await Promise.race([
      ai.run(model, { messages }),
      createTimeoutPromise(AI_TIMEOUT_MS),
    ]);
    
    const parsed = parseWorkersAiResponse(response);

    return {
      provider: "workers-ai",
      text: parsed.text,
      totalTokens: parsed.totalTokens,
      model,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[MentoriaLLM] AI call failed:", {
      provider: "workers-ai",
      model,
      error: errorMessage,
    });
    
    if (errorMessage === "MENTORIA_AI_TIMEOUT") {
      throw new Error("MENTORIA_AI_TIMEOUT");
    }
    if (errorMessage === "MENTORIA_AI_EMPTY_RESPONSE") {
      throw new Error("MENTORIA_AI_EMPTY_RESPONSE");
    }
    if (isProviderUnavailableMessage(errorMessage)) {
      throw new Error("AI_PROVIDER_UNAVAILABLE");
    }
    
    throw new Error("MENTORIA_AI_PROVIDER_ERROR");
  }
}

function parseStructuredResponse(text: string): MentoriaTeachingResponse | null {
  const parseCandidate = (candidate: string) => {
    try {
      const parsed = JSON.parse(candidate) as Partial<MentoriaTeachingResponse>;
      if (
        typeof parsed.explanation === "string"
        && Array.isArray(parsed.suggestedSteps)
        && parsed.suggestedSteps.every((item) => typeof item === "string")
        && typeof parsed.reinforcementQuestion === "string"
      ) {
        return {
          explanation: parsed.explanation.trim(),
          suggestedSteps: parsed.suggestedSteps.map((item) => item.trim()).filter(Boolean).slice(0, 4),
          reinforcementQuestion: parsed.reinforcementQuestion.trim(),
        };
      }
    } catch {
      return null;
    }
    return null;
  };

  const direct = parseCandidate(text);
  if (direct) return direct;

  const fencedMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fencedMatch?.[1]) {
    return parseCandidate(fencedMatch[1].trim());
  }

  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start >= 0 && end > start) {
    return parseCandidate(text.slice(start, end + 1));
  }

  return null;
}

export async function runMentoriaLlmStructured(input: {
  messages: MentoriaLlmMessage[];
  responseSchemaHint: Record<string, unknown>;
}): Promise<MentoriaTeachingResponse & { provider: string; totalTokens: number; model?: string; isFallback?: boolean }> {
  try {
    const llm = await runMentoriaLlm([
      ...input.messages,
      {
        role: "user",
        content: `Formato de salida JSON obligatorio: ${JSON.stringify(input.responseSchemaHint)}.`,
      },
    ]);

    const parsed = parseStructuredResponse(llm.text);
    if (!parsed) {
      console.error("[MentoriaLLM] Failed to parse structured response");
      throw new Error("MENTORIA_AGENT_INVALID_JSON_RESPONSE");
    }

    return {
      ...parsed,
      provider: llm.provider,
      totalTokens: llm.totalTokens,
      model: llm.model,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[MentoriaLLM] Structured call failed:", errorMessage);
    throw error;
  }
}
