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
const MODEL_SMART = "@cf/meta/llama-3.1-8b-instruct";

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
  })) as any;

  const durationMs = Date.now() - start;

  // Robust content extraction
  let content = "";
  if (typeof res?.response === "string") {
    content = res.response;
  } else if (typeof res?.response?.text === "string") {
    content = res.response.text;
  } else if (Array.isArray(res?.choices) && res.choices[0]?.message?.content) {
    content = res.choices[0].message.content;
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
    usage: { tokens: res?.response?.tokens || res?.usage?.total_tokens },
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
  if (!e) throw new Error("Env not available");
  const model = selectModel(req.mode);
  // Prefer binding when available (lower latency, authenticated)
  if ((e as unknown as { AI?: AiBinding })?.AI) {
    return callViaBinding(req, e, model);
  }
  return callViaCompat(req, e, model);
}
