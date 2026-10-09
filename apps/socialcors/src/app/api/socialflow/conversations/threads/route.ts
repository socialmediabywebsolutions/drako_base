import { requireCurrentSocialFlowSession } from "@/lib/socialflow/auth/request";
import { generateConversationalReply } from "@/lib/socialflow/conversational/engine";
import {
  ingestConversationThread,
  listConversationThreads,
  resolveSocialContext,
} from "@/lib/socialflow/conversational/repository";
import { getChannelKnowledge } from "@/lib/socialflow/profile/repository";
import { getKnowledgeContext } from "@/lib/socialflow/knowledge/repository";
import type { ConversationThreadStatus, ConversationThreadType } from "@/lib/socialflow/conversational/types";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const session = await requireCurrentSocialFlowSession(request);
    const url = new URL(request.url);
    const saasId = url.searchParams.get("saasId")?.trim() || "socialflow";
    const status = url.searchParams.get("status")?.trim() as ConversationThreadStatus | null;
    const provider = url.searchParams.get("provider")?.trim();
    const limitRaw = url.searchParams.get("limit");
    const limit = limitRaw ? Math.min(Math.max(parseInt(limitRaw, 10) || 50, 1), 200) : 50;

    const ctx = await resolveSocialContext({ tenantId: session.tenantId, saasId });
    const threads = await listConversationThreads(ctx, { status, provider, limit });

    return new Response(JSON.stringify({ ok: true, threads }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "SESSION_REQUIRED") {
      return new Response(JSON.stringify({ error: "SESSION_REQUIRED" }), {
        status: 401,
        headers: { "content-type": "application/json" },
      });
    }
    console.error("SOCIALFLOW_THREADS_LIST_ERROR", error instanceof Error ? error.message : "unknown");
    return new Response(JSON.stringify({ error: "THREADS_LIST_FAILED" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireCurrentSocialFlowSession(request);
    const body = (await request.json().catch(() => null)) as {
      provider?: string;
      thread_type?: string;
      incoming_message?: string;
      sender_name?: string;
      sender_handle?: string;
      platform_thread_id?: string;
      context_post_id?: string;
      saasId?: string;
    } | null;

    const saasId = body?.saasId?.trim() || "socialflow";
    const provider = body?.provider?.trim();
    const incomingMessage = body?.incoming_message?.trim();
    const threadType = (body?.thread_type?.trim() || "DM") as ConversationThreadType;

    if (!provider || !incomingMessage) {
      return new Response(JSON.stringify({ error: "MISSING_REQUIRED_FIELDS" }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    }

    const ctx = await resolveSocialContext({ tenantId: session.tenantId, saasId });
    const [knowledge, knowledgeContext] = await Promise.all([
      getChannelKnowledge(session.tenantId, saasId),
      getKnowledgeContext(session.tenantId, saasId).catch(() => ""),
    ]);
    const { suggestedReply, aiMetadata } = await generateConversationalReply({
      incomingMessage,
      threadType,
      provider,
      senderName: body?.sender_name ?? null,
      profile: knowledge.profile,
      knowledge,
      knowledgeContext,
      tenantId: session.tenantId,
      saasId,
    });

    const thread = await ingestConversationThread(ctx, {
      provider,
      threadType,
      platformThreadId: body?.platform_thread_id ?? null,
      senderName: body?.sender_name ?? null,
      senderHandle: body?.sender_handle ?? null,
      incomingMessage,
      contextPostId: body?.context_post_id ?? null,
      suggestedReply,
      status: "PENDING",
      aiMetadata,
    });

    return new Response(JSON.stringify({ ok: true, thread }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "SESSION_REQUIRED") {
      return new Response(JSON.stringify({ error: "SESSION_REQUIRED" }), {
        status: 401,
        headers: { "content-type": "application/json" },
      });
    }
    console.error("SOCIALFLOW_THREADS_INGEST_ERROR", error instanceof Error ? error.message : "unknown");
    return new Response(JSON.stringify({ error: "THREAD_INGEST_FAILED" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
}
