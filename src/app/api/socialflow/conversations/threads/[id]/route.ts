import { requireCurrentSocialFlowSession } from "@/lib/socialflow/auth/request";
import {
  getConversationThread,
  resolveSocialContext,
  updateConversationThread,
} from "@/lib/socialflow/conversational/repository";
import type { ConversationThreadStatus } from "@/lib/socialflow/conversational/types";
import { listSaasSocialAccounts } from "@/lib/socialflow/repository";
import { requireInstagramCredentials } from "@/lib/socialflow/meta/publishing";
import { replyToInstagramComment } from "@/lib/socialflow/meta/comments";

export const dynamic = "force-dynamic";

const VALID_STATUSES: ConversationThreadStatus[] = [
  "PENDING",
  "AUTO_APPROVED",
  "APPROVED",
  "SENT",
  "DISMISSED",
  "NEEDS_HUMAN",
];

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await requireCurrentSocialFlowSession(request);
    const url = new URL(request.url);
    const saasId = url.searchParams.get("saasId")?.trim() || "socialflow";

    const ctx = await resolveSocialContext({ tenantId: session.tenantId, saasId });
    const thread = await getConversationThread(ctx, params.id);

    if (!thread) {
      return new Response(JSON.stringify({ error: "THREAD_NOT_FOUND" }), {
        status: 404,
        headers: { "content-type": "application/json" },
      });
    }

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
    console.error("SOCIALFLOW_THREAD_GET_ERROR", error instanceof Error ? error.message : "unknown");
    return new Response(JSON.stringify({ error: "THREAD_GET_FAILED" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await requireCurrentSocialFlowSession(request);
    const body = (await request.json().catch(() => null)) as {
      status?: string;
      finalReply?: string | null;
      saasId?: string;
    } | null;

    const saasId = body?.saasId?.trim() || "socialflow";

    if (body?.status && !VALID_STATUSES.includes(body.status as ConversationThreadStatus)) {
      return new Response(JSON.stringify({ error: "INVALID_STATUS" }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    }

    const ctx = await resolveSocialContext({ tenantId: session.tenantId, saasId });

    // FIX crítico: "Aprobar" en un comentario debe enviarlo de verdad a Instagram antes
    // de marcar el hilo como APPROVED — antes de este cambio, el PATCH solo actualizaba
    // la fila en D1 y el mensaje nunca salía. Los DM mantienen el comportamiento previo
    // (marcar APPROVED sin enviar) porque no existe ninguna función de envío de DM.
    if (body?.status === "APPROVED") {
      const current = await getConversationThread(ctx, params.id);
      if (!current) {
        return new Response(JSON.stringify({ error: "THREAD_NOT_FOUND" }), {
          status: 404,
          headers: { "content-type": "application/json" },
        });
      }

      if (current.threadType === "COMMENT") {
        const finalReply = "finalReply" in (body ?? {}) ? body?.finalReply ?? null : current.finalReply ?? current.suggestedReply;
        if (!current.platformThreadId || !finalReply?.trim()) {
          return new Response(JSON.stringify({ error: "MISSING_REPLY_OR_COMMENT_ID" }), {
            status: 400,
            headers: { "content-type": "application/json" },
          });
        }

        const accounts = await listSaasSocialAccounts(ctx);
        const instagramAccount = accounts.find((a) => a.provider === "INSTAGRAM" && a.status === "CONNECTED_REAL");
        if (!instagramAccount) {
          return new Response(JSON.stringify({ error: "INSTAGRAM_ACCOUNT_NOT_CONNECTED" }), {
            status: 502,
            headers: { "content-type": "application/json" },
          });
        }

        try {
          const creds = await requireInstagramCredentials(instagramAccount);
          const replyResult = await replyToInstagramComment(current.platformThreadId, finalReply, creds.accessToken, creds.apiBase);
          if (!replyResult.ok) {
            return new Response(JSON.stringify({ error: "INSTAGRAM_REPLY_FAILED", message: replyResult.error }), {
              status: 502,
              headers: { "content-type": "application/json" },
            });
          }
        } catch (error) {
          return new Response(
            JSON.stringify({ error: "INSTAGRAM_REPLY_FAILED", message: error instanceof Error ? error.message : "unknown" }),
            { status: 502, headers: { "content-type": "application/json" } },
          );
        }
      }
    }

    const thread = await updateConversationThread(ctx, params.id, {
      status: body?.status as ConversationThreadStatus | undefined,
      finalReply: "finalReply" in (body ?? {}) ? body?.finalReply ?? null : undefined,
    });

    if (!thread) {
      return new Response(JSON.stringify({ error: "THREAD_NOT_FOUND" }), {
        status: 404,
        headers: { "content-type": "application/json" },
      });
    }

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
    console.error("SOCIALFLOW_THREAD_PATCH_ERROR", error instanceof Error ? error.message : "unknown");
    return new Response(JSON.stringify({ error: "THREAD_UPDATE_FAILED" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
}
