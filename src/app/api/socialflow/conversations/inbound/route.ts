import { env } from "@/lib/cf";
import { generateConversationalReply } from "@/lib/socialflow/conversational/engine";
import {
  getConversationSettings,
  ingestConversationThread,
  resolveSocialContext,
} from "@/lib/socialflow/conversational/repository";
import { getChannelKnowledge } from "@/lib/socialflow/profile/repository";
import type { ConversationThreadType } from "@/lib/socialflow/conversational/types";
import { detectLeadSignals } from "@/lib/socialflow/leads/detector";
import { createLead } from "@/lib/socialflow/leads/repository";

export const dynamic = "force-dynamic";

// Bug 2 fix: verify real Meta webhook POST events via HMAC-SHA256 (X-Hub-Signature-256).
// crypto.subtle.verify is constant-time, preventing timing attacks.
async function verifyMetaSignature(rawBody: string, request: Request): Promise<boolean> {
  const appSecret = env()?.META_APP_SECRET;
  if (!appSecret) return false;
  const signature = request.headers.get("x-hub-signature-256");
  if (!signature?.startsWith("sha256=")) return false;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(appSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );
  const sigHex = signature.slice(7);
  const sigBytes = new Uint8Array(sigHex.match(/.{2}/g)?.map((b) => parseInt(b, 16)) ?? []);
  if (sigBytes.length === 0) return false;
  return crypto.subtle.verify("HMAC", key, sigBytes, encoder.encode(rawBody));
}

// Meta webhook verification challenge (GET)
export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const challenge = url.searchParams.get("hub.challenge");
  const verifyToken = url.searchParams.get("hub.verify_token");
  const expected = env()?.SOCIALFLOW_WEBHOOK_VERIFY_TOKEN;

  // Bug 3 fix: guard against empty/unset expected token before comparing.
  if (expected && mode === "subscribe" && verifyToken === expected && challenge) {
    return new Response(challenge, { status: 200, headers: { "content-type": "text/plain" } });
  }
  return new Response(JSON.stringify({ error: "FORBIDDEN" }), {
    status: 403,
    headers: { "content-type": "application/json" },
  });
}

// Inbound webhook event (POST)
// Requires a valid X-Hub-Signature-256 HMAC header on every request — no unsigned
// fallback. There is no known caller of the old ?verifyToken= relay mode in this repo.
// Bug 1 fix: tenantId is read from the URL query param (operator-controlled at webhook
// registration time), never from the request body, so a caller cannot escalate to another
// tenant by supplying a different tenantId in the POST body.
export async function POST(request: Request) {
  try {
    // Read raw body first so HMAC can verify the exact bytes Meta signed.
    const rawBody = await request.text().catch(() => "");

    const authenticated = await verifyMetaSignature(rawBody, request);

    if (!authenticated) {
      return new Response(JSON.stringify({ error: "FORBIDDEN" }), {
        status: 403,
        headers: { "content-type": "application/json" },
      });
    }

    // Bug 1 fix: tenantId comes from URL, not body.
    const url = new URL(request.url);
    const tenantId = url.searchParams.get("tenantId")?.trim();

    type InboundBody = {
      provider?: string;
      thread_type?: string;
      incoming_message?: string;
      sender_name?: string;
      sender_handle?: string;
      platform_thread_id?: string;
      context_post_id?: string;
      saasId?: string;
    };
    let body: InboundBody | null = null;
    try {
      body = rawBody ? (JSON.parse(rawBody) as InboundBody) : null;
    } catch {
      // leave null
    }

    const saasId = body?.saasId?.trim() || "socialflow";
    const provider = body?.provider?.trim();
    const incomingMessage = body?.incoming_message?.trim();
    const threadType = (body?.thread_type?.trim() || "DM") as ConversationThreadType;

    if (!tenantId || !provider || !incomingMessage) {
      return new Response(JSON.stringify({ error: "MISSING_REQUIRED_FIELDS" }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    }

    const ctx = await resolveSocialContext({ tenantId, saasId });
    const knowledge = await getChannelKnowledge(tenantId, saasId);
    const { suggestedReply, aiMetadata } = await generateConversationalReply({
      incomingMessage,
      threadType,
      senderName: body?.sender_name ?? null,
      profile: knowledge.profile,
      knowledge,
    });

    const settings = await getConversationSettings(ctx);
    const status =
      settings.autoSendEnabled && settings.autoSendProviders.includes(provider)
        ? "AUTO_APPROVED"
        : "PENDING";

    const thread = await ingestConversationThread(ctx, {
      provider,
      threadType,
      platformThreadId: body?.platform_thread_id ?? null,
      senderName: body?.sender_name ?? null,
      senderHandle: body?.sender_handle ?? null,
      incomingMessage,
      contextPostId: body?.context_post_id ?? null,
      suggestedReply,
      status,
      aiMetadata,
    });

    // Lead detection: score the message and persist a lead record if signals found.
    const leadSignals = detectLeadSignals(incomingMessage);
    let leadId: string | null = null;
    if (leadSignals.isLead && leadSignals.temperature) {
      try {
        const lead = await createLead(ctx, {
          threadId: thread.id,
          provider,
          senderName: body?.sender_name ?? null,
          senderHandle: body?.sender_handle ?? null,
          incomingMessage,
          intentScore: leadSignals.intentScore,
          temperature: leadSignals.temperature,
        });
        leadId = lead.id;
      } catch (err) {
        console.warn("SOCIALFLOW_LEAD_CREATE_WARN", err instanceof Error ? err.message : "unknown");
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        threadId: thread.id,
        status: thread.status,
        lead: leadId ? { id: leadId, temperature: leadSignals.temperature, score: leadSignals.intentScore } : null,
      }),
      {
        status: 200,
        headers: { "content-type": "application/json" },
      },
    );
  } catch (error) {
    console.error("SOCIALFLOW_INBOUND_ERROR", error instanceof Error ? error.message : "unknown");
    return new Response(JSON.stringify({ error: "INBOUND_FAILED" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
}
