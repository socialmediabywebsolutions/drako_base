import { requireCurrentSocialFlowSession } from "@/lib/socialflow/auth/request";
import { generateConversationalReply } from "@/lib/socialflow/conversational/engine";
import { getChannelKnowledge } from "@/lib/socialflow/profile/repository";
import { getKnowledgeContext } from "@/lib/socialflow/knowledge/repository";
import { BLOCKED_INTENT_REPLY, detectBlockedIntent } from "@/lib/socialflow/conversational/blocked-intent";
import type { ConversationThreadType } from "@/lib/socialflow/conversational/types";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const session = await requireCurrentSocialFlowSession(request);
    const body = (await request.json().catch(() => null)) as {
      message?: string;
      threadType?: string;
      provider?: string;
      saasId?: string;
    } | null;

    const message = body?.message?.trim();
    const threadType = (body?.threadType?.trim() || "DM") as ConversationThreadType;
    const provider = body?.provider?.trim() || "INSTAGRAM";
    const saasId = body?.saasId?.trim() || "socialflow";

    if (!message) {
      return new Response(JSON.stringify({ error: "MISSING_MESSAGE" }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    }

    // Gate de derivación a humano — se evalúa ANTES de tocar la IA (ni siquiera se
    // carga la Knowledge Base): precio/contrato/temas médicos/vida privada nunca deben
    // producir una sugerencia generada, aprobable con un clic desde el inbox.
    if (detectBlockedIntent(message)) {
      return new Response(
        JSON.stringify({
          ok: true,
          suggestedReply: BLOCKED_INTENT_REPLY,
          aiMetadata: { blockedIntent: true },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }

    const [knowledge, knowledgeContext] = await Promise.all([
      getChannelKnowledge(session.tenantId, saasId),
      getKnowledgeContext(session.tenantId, saasId).catch(() => ""),
    ]);
    const { suggestedReply, aiMetadata } = await generateConversationalReply({
      incomingMessage: message,
      threadType,
      provider,
      profile: knowledge.profile,
      knowledge,
      knowledgeContext,
      tenantId: session.tenantId,
      saasId,
    });

    return new Response(JSON.stringify({ ok: true, suggestedReply, aiMetadata }), {
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
    console.error("SOCIALFLOW_REPLY_SUGGEST_ERROR", error instanceof Error ? error.message : "unknown");
    return new Response(JSON.stringify({ error: "REPLY_SUGGEST_FAILED" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
}
