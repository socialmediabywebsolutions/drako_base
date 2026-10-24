import { env } from "@/lib/cf";

type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

type AiMode = "fast" | "smart";

type AiRequest = {
  messages: ChatMessage[];
  tenantId: string;
  saasId?: string | null;
  agentId?: string | null;
  department?: string | null;
  plan?: string | null;
  mode: AiMode;
  cache?: boolean;
};

type AiResponse = {
  ok: boolean;
  content?: string;
  usage?: { tokens?: number };
  model: string;
  provider: "workers-ai";
};

type AiBinding = { run: (model: string, inputs: Record<string, unknown>, options?: Record<string, unknown>) => Promise<unknown> };

const MODEL_FAST = "@cf/meta/llama-3-8b-instruct";
const MODEL_SMART = "@cf/meta/llama-3.1-70b-instruct";


export function _selectModel(mode: AiMode): string {
  return mode === "fast" ? MODEL_FAST : MODEL_SMART;
}

function buildMetadata(req: AiRequest): string {
  return JSON.stringify({
    tenantId: req.tenantId,
    saasId: req.saasId ?? undefined,
    agentId: req.agentId ?? undefined,
    department: req.department ?? undefined,
    plan: req.plan ?? undefined,
    mode: req.mode,
  });
}

export async function _callViaBinding(req: AiRequest, binding: AiBinding, model: string): Promise<AiResponse> {
  const start = Date.now();
  const metadata = buildMetadata(req);
  const res = (await binding.run(
    model,
    {
      messages: req.messages,
      metadata,
    },
    {
      cacheTtl: req.cache ? 300 : 0,
      skipCache: !req.cache,
    },
  )) as unknown;

  const durationMs = Date.now() - start;

  // Robust content extraction
  let content = "";
  const bindingRes = res as {
    response?: string | { text?: string; tokens?: number };
    choices?: { message?: { content?: string } }[];
    usage?: { total_tokens?: number };
  };

  if (typeof bindingRes?.response === "string") {
    content = bindingRes.response;
  } else if (typeof (bindingRes?.response as { text?: string })?.text === "string") {
    content = (bindingRes.response as { text?: string }).text as string;
  } else if (Array.isArray(bindingRes?.choices) && bindingRes.choices[0]?.message?.content) {
    content = bindingRes.choices[0].message.content;
  }

  console.log("AI_BINDING_CALL", {
    provider: "workers-ai",
    model,
    durationMs,
    tenantId: req.tenantId,
    hasContent: !!content,
    hasRes: !!res,
  });

  return {
    ok: true,
    content,
    usage: {
      tokens: (typeof bindingRes?.response === "object" ? bindingRes?.response?.tokens : undefined) || bindingRes?.usage?.total_tokens,
    },
    model,
    provider: "workers-ai",
  };
}

export async function runAi(req: AiRequest & { taskType?: string }): Promise<AiResponse> {
  if (!req.messages || req.messages.length === 0) {
    throw new Error("messages are required");
  }

  const runtimeEnv = env();
  const model = _selectModel(req.mode);
  const binding = runtimeEnv?.AI;

  if (!binding?.run) {
    throw new Error("DRAKO_AI_NOT_AVAILABLE");
  }

  return _callViaBinding(req, binding, model);
}
