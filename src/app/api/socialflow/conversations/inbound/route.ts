import { env } from "@/lib/cf";
import { generateConversationalReply } from "@/lib/socialflow/conversational/engine";
import {
  getConversationSettings,
  ingestConversationThread,
  resolveSocialContext,
} from "@/lib/socialflow/conversational/repository";
import { getChannelKnowledge } from "@/lib/socialflow/profile/repository";
import type { ConversationThreadType } from "@/lib/socialflow/conversational/types";

export const dynamic = "force-dynamic";

function verifyToken(request: Request): boolean {
  const url = new URL(request.url);
  const provided = url.searchParams.get("verifyToken");
  const expected = env()?.SOCIALFLOW_WEBHOOK_VERIFY_TOKEN;
  if (!expected || !provided) return false;
  return provided === expected;
}

// Meta webhook verification challenge
export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const challenge = url.searchParams.get("hub.challenge");
  const verifyToken = url.searchParams.get("hub.verify_token");
  const expected = env()?.SOCIALFLOW_WEBHOOK_VERIFY_TOKEN;

  if (mode === "subscribe" && verifyToken === expected && challenge) {
    return new Response(challenge, { status: 200, headers: { "content-type": "text/plain" } });
  }
  return new Response(JSON.stringify({ error: "FORBIDDEN" }), {
    status: 403,
    headers: { "content-type": "application/json" },
  });
}

// Inbound webhook event
export async function POST(request: Request) {
  try {
    if (!verifyToken(request)) {
      return new Response(JSON.stringify({ error: "FORBIDDEN" }), {
        status: 403,
        headers: { "content-type": "application/json" },
      });
    }

    const body = (await request.json().catch(() => null)) as {
      provider?: string;
      thread_type?: string;
      incoming_message?: string;
      sender_name?: string;
      sender_handle?: string;
      platform_thread_id?: string;
      context_post_id?: string;
      tenantId?: string;
      saasId?: string;
    } | null;

    const tenantId = body?.tenantId?.trim();
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

    return new Response(JSON.stringify({ ok: true, threadId: thread.id, status: thread.status }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  } catch (error) {
    console.error("SOCIALFLOW_INBOUND_ERROR", error instanceof Error ? error.message : "unknown");
    return new Response(JSON.stringify({ error: "INBOUND_FAILED" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
}
