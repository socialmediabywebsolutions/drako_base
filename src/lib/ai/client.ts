// Server-only AI client that routes all model calls through Cloudflare AI Gateway.
// Supports two modes:
//  A) Binding mode (env.AI.run) for Workers AI directly via gateway id.
//  B) OpenAI-compatible gateway fetch for extensibility (workers-ai/{model} and future providers).

import { env, DracoEnv } from "@/lib/cf";

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

function selectModel(mode: AiMode): string {
  return mode === "fast" ? MODEL_FAST : MODEL_SMART;
}

function buildMetadata(req: AiRequest) {
  const meta = {
    tenantId: req.tenantId,
    saasId: req.saasId ?? undefined,
    agentId: req.agentId ?? undefined,
    department: req.department ?? undefined,
    plan: req.plan ?? undefined,
    mode: req.mode,
  };
  return JSON.stringify(meta);
}

function getGatewayCompatUrl(e: DracoEnv) {
  if (!e.CF_ACCOUNT_ID || !e.AI_GATEWAY_ID) return null;
  // OpenAI-compatible chat completions endpoint
  return `https://gateway.ai.cloudflare.com/v1/${e.CF_ACCOUNT_ID}/${e.AI_GATEWAY_ID}/compat/chat/completions`;
}

async function callViaBinding(req: AiRequest, e: DracoEnv, model: string): Promise<AiResponse> {
  const binding = (e as unknown as { AI?: AiBinding })?.AI;
  if (!binding?.run) {
    throw new Error("AI binding not configured (AI)");
  }
  const start = Date.now();
  const metadata = buildMetadata(req);
  const res = (await binding.run(model, {
    messages: req.messages,
    metadata,
  }, {
    gateway: { id: e.AI_GATEWAY_ID },
    cacheTtl: req.cache ? 300 : 0,
    skipCache: !req.cache,
  })) as unknown;

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
    hasRes: !!res
  });

  return {
    ok: true,
    content,
    usage: {
      tokens: (typeof bindingRes?.response === 'object' ? bindingRes?.response?.tokens : undefined) || bindingRes?.usage?.total_tokens
    },
    model,
    provider: "workers-ai"
  };
}

async function callViaCompat(req: AiRequest, e: DracoEnv, model: string): Promise<AiResponse> {
  const url = getGatewayCompatUrl(e);
  if (!url) throw new Error("AI Gateway compat URL not configured (missing CF_ACCOUNT_ID or AI_GATEWAY_ID)");
  const start = Date.now();
  const metadata = buildMetadata(req);
  const body = {
    model: `workers-ai/${model}`,
    messages: req.messages,
  };
  const headers: Record<string, string> = {
    "content-type": "application/json",
    "cf-aig-metadata": metadata,
  };
  if (e.AI_GATEWAY_COMPAT_TOKEN) headers.authorization = `Bearer ${e.AI_GATEWAY_COMPAT_TOKEN}`;

  const resp = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  const durationMs = Date.now() - start;
  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    console.error("AI_COMPAT_ERROR", { status: resp.status, text });
    throw new Error(`AI compat request failed: ${resp.status}`);
  }
  const json = (await resp.json()) as {
    choices?: { message?: { content?: string } }[];
    usage?: { total_tokens?: number };
  };
  console.log("AI_COMPAT_CALL", { provider: "workers-ai", model, durationMs, tenantId: req.tenantId, agentId: req.agentId, cache: !!req.cache });
  return {
    ok: true,
    content: json.choices?.[0]?.message?.content ?? "",
    usage: { tokens: json.usage?.total_tokens },
    model,
    provider: "workers-ai",
  };
}

export async function runAi(req: AiRequest): Promise<AiResponse> {
  if (!req.messages || req.messages.length === 0) {
    throw new Error("messages are required");
  }
  const e = env();

  // DEVELOPMENT MODE: Use mock when no Cloudflare env available
  if (!e) {
    console.warn("AI_MOCK_MODE: No Cloudflare env detected, using mock responses");
    const { generateMockResponse } = await import("./mock-client");

    // Infer phase from history length (assistant messages count)
    // First message is intro (Phase 0). Next response triggers Phase 1 logic based on user input.
    // So if there is 1 assistant message in history (the intro), we are generating response for Phase 0 completion -> Phase 1.
    const assistantMessages = req.messages.filter(m => m.role === "assistant");
    const inferredPhase = Math.max(0, assistantMessages.length);

    console.log("AI_MOCK_INFERENCE", { assistantMsgCount: assistantMessages.length, inferredPhase });

    const mockData = generateMockResponse(req.messages, inferredPhase);
    return {
      ok: true,
      content: JSON.stringify(mockData),
      usage: { tokens: 150 },
      model: "mock-drako-partner",
      provider: "workers-ai"
    };
  }

  const model = selectModel(req.mode);

  try {
    // Prefer binding when available
    if ((e as unknown as { AI?: AiBinding })?.AI) {
      return await callViaBinding(req, e, model);
    }
    return await callViaCompat(req, e, model);
  } catch (error) {
    // Fallback logic: If smart model fails, try fast model
    if (req.mode === "smart") {
      console.warn("AI_SMART_FAILURE_FALLBACK", { error, model });
      const fallbackModel = MODEL_FAST;
      try {
        if ((e as unknown as { AI?: AiBinding })?.AI) {
          return await callViaBinding(req, e, fallbackModel);
        }
        return await callViaCompat(req, e, fallbackModel);
      } catch (fallbackError) {
        console.error("AI_TOTAL_FAILURE", fallbackError);
        throw fallbackError;
      }
    }
    throw error;
  }
}
