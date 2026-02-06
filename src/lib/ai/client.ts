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
  if (!e.CLOUDFLARE_ACCOUNT_ID || !e.AI_GATEWAY_ID) return null;
  // OpenAI-compatible chat completions endpoint
  return `https://gateway.ai.cloudflare.com/v1/${e.CLOUDFLARE_ACCOUNT_ID}/${e.AI_GATEWAY_ID}/compat/chat/completions`;
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
  if (!url) throw new Error("AI Gateway compat URL not configured (missing CLOUDFLARE_ACCOUNT_ID or AI_GATEWAY_ID)");
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

export async function runAi(req: AiRequest & { taskType?: string }): Promise<AiResponse> {
  if (!req.messages || req.messages.length === 0) {
    throw new Error("messages are required");
  }

  const workerUrl = process.env.AUTOPILOT_WORKER_URL || "http://localhost:8787";
  const workerSecret = process.env.VERCEL_TO_WORKER_SECRET;

  try {
    const response = await fetch(`${workerUrl}/internal/ai/run`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${workerSecret}`,
        "X-Drako-Origin-Secret": workerSecret || "",
        "X-Drako-Tenant-Id": req.tenantId,
        "X-Drako-Saas-Id": req.saasId || "",
      },
      body: JSON.stringify({
        messages: req.messages,
        taskType: req.taskType || "default",
        mode: req.mode,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}) as any) as any;
      console.error("AI_WORKER_ERROR", { status: response.status, errorData });
      throw new Error((errorData as { error?: string }).error || `AI Worker returned ${response.status}`);
    }

    const data = await response.json() as any;
    return {
      ok: true,
      content: data.content,
      usage: data.usage,
      model: data.model,
      provider: "workers-ai", // The router tells us it's CF AI for now
    };
  } catch (error) {
    console.error("AI_ROUTER_FETCH_ERROR", error);
    // Legacy Mock Fallback for local dev without worker
    if (process.env.NODE_ENV === "development") {
      console.warn("AI_MOCK_FALLBACK: Worker unavailable, using mock");
      const { generateMockResponse } = await import("./mock-client");
      const assistantMessages = req.messages.filter(m => m.role === "assistant");
      const inferredPhase = Math.max(0, assistantMessages.length);
      const mockData = generateMockResponse(req.messages, inferredPhase);
      return {
        ok: true,
        content: JSON.stringify(mockData),
        usage: { tokens: 150 },
        model: "mock-drako-partner",
        provider: "workers-ai"
      };
    }
    throw error;
  }
}
