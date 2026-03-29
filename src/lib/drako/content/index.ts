import type { UserContext } from "@/lib/drako/memory";
import { env } from "@/lib/cf";

export type ContentRequest<TInput = Record<string, unknown>> = {
  id: string;
  kind: string;
  context: UserContext;
  input: TInput;
  metadata: Record<string, unknown>;
  createdAt: string;
};

export type ContentArtifact<TPayload = Record<string, unknown>> = {
  id: string;
  kind: string;
  payload: TPayload;
  createdAt: string;
};

export type ContentMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type ContentProvider = "workers-ai";

type ContentExecutionMetadata = {
  messages?: ContentMessage[];
  model?: string;
  provider?: ContentProvider;
  temperature?: number;
  maxTokens?: number;
};

function readConfigValue(name: string): string | null {
  const bindings = env();
  const boundValue = bindings && name in bindings ? (bindings[name as keyof typeof bindings] as string | undefined) : undefined;
  const processValue = typeof process !== "undefined" ? process.env?.[name] : undefined;
  const value = boundValue ?? processValue;
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

async function callWorkersAi(input: {
  model: string;
  messages: ContentMessage[];
}): Promise<ContentArtifact<{ provider: ContentProvider; text: string; totalTokens: number }>> {
  const hardOff = readConfigValue("AI_HARD_OFF");
  if (hardOff && hardOff.toLowerCase() === "true") {
    throw new Error("DRAKO_CONTENT_PROVIDER_DISABLED");
  }

  const bindings = env();
  const ai = bindings?.AI;
  if (!ai?.run) {
    throw new Error("DRAKO_CONTENT_PROVIDER_NOT_CONFIGURED");
  }

  const response = await ai.run(input.model, { messages: input.messages }) as
    | {
        response?: string | { text?: string; tokens?: number };
        choices?: Array<{ message?: { content?: string } }>;
        usage?: { total_tokens?: number };
      }
    | null;

  const text =
    typeof response?.response === "string"
      ? response.response
      : response?.response && typeof response.response === "object" && typeof response.response.text === "string"
        ? response.response.text
        : response?.choices?.[0]?.message?.content;

  if (!text?.trim()) {
    throw new Error("CONTENT_PROVIDER_EMPTY_RESPONSE:workers-ai");
  }

  const totalTokens =
    typeof response?.response === "object" && response.response && "tokens" in response.response
      ? Number(response.response.tokens ?? 0)
      : Number(response?.usage?.total_tokens ?? 0);

  return {
    id: crypto.randomUUID(),
    kind: "llm_completion",
    payload: {
      provider: "workers-ai",
      text: text.trim(),
      totalTokens,
    },
    createdAt: new Date().toISOString(),
  };
}

export function createContentRequest<TInput>(input: {
  id?: string;
  kind: string;
  context: UserContext;
  input: TInput;
  metadata?: Record<string, unknown>;
  createdAt?: string;
}): ContentRequest<TInput> {
  return {
    id: input.id ?? crypto.randomUUID(),
    kind: input.kind,
    context: input.context,
    input: input.input,
    metadata: input.metadata ?? {},
    createdAt: input.createdAt ?? new Date().toISOString(),
  };
}

export async function executeContentRequest<TInput>(
  request: ContentRequest<TInput>,
): Promise<ContentArtifact<{ provider: ContentProvider; text: string; totalTokens: number }>> {
  const metadata = (request.metadata ?? {}) as ContentExecutionMetadata;
  const messages = metadata.messages;
  if (!Array.isArray(messages) || messages.length === 0) {
    throw new Error(`CONTENT_MESSAGES_REQUIRED:${request.kind}`);
  }

  if (metadata.provider && metadata.provider !== "workers-ai") {
    throw new Error(`CONTENT_PROVIDER_UNSUPPORTED:${metadata.provider}`);
  }

  return callWorkersAi({
    model: metadata.model ?? readConfigValue("MENTORIA_CLOUDFLARE_MODEL") ?? "@cf/meta/llama-3.1-70b-instruct",
    messages,
  });
}
