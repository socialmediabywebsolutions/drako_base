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
import { sendInstagramDirectMessage } from "@/lib/socialflow/meta/directMessages";

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

    // FIX crítico: "Aprobar" en un comentario o DM debe enviarlo de verdad a Instagram
    // antes de marcar el hilo como APPROVED — antes de este cambio, el PATCH solo
    // actualizaba la fila en D1 y el mensaje nunca salía.
    if (body?.status === "APPROVED") {
      const current = await getConversationThread(ctx, params.id);
      if (!current) {
        return new Response(JSON.stringify({ error: "THREAD_NOT_FOUND" }), {
          status: 404,
          headers: { "content-type": "application/json" },
        });
      }

      // COMMENT y DM comparten resolución de finalReply + cuenta/credenciales de
      // Instagram — solo difieren en qué API de Meta se llama al final (respuesta
      // pública a comentario vs. mensaje directo real, ver directMessages.ts).
      if (current.threadType === "COMMENT" || current.threadType === "DM") {
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

        // El operador ya aprobó el mensaje: un fallo al entregarlo a Meta es un problema
        // de entrega, no de aprobación. Se loguea pero NO bloquea el update de status —
        // si revertimos aquí, el hilo queda atascado sin que el operador pueda reintentar
        // desde la UI (el botón ya no ofrece "Aprobar" sobre un hilo ya APPROVED).
        try {
          const creds = await requireInstagramCredentials(instagramAccount);

          if (current.threadType === "COMMENT") {
            const replyResult = await replyToInstagramComment(current.platformThreadId, finalReply, creds.accessToken, creds.apiBase);
            if (!replyResult.ok) {
              console.error("SOCIALFLOW_INSTAGRAM_REPLY_DELIVERY_FAILED", current.id, replyResult.error);
            }
          } else if (current.threadType === "DM") {
            // current.platformThreadId es el IGSID del remitente para hilos DM (viene
            // del webhook inbound, ver transformMetaWebhookBody en inbound/route.ts).
            const dmResult = await sendInstagramDirectMessage(creds.igUserId, current.platformThreadId, finalReply, creds.accessToken, creds.apiBase);
            if (!dmResult.ok) {
              console.error("SOCIALFLOW_INSTAGRAM_DM_DELIVERY_FAILED", current.id, dmResult.error);
            }
          }
        } catch (error) {
          console.error("SOCIALFLOW_INSTAGRAM_DELIVERY_ERROR", current.id, error instanceof Error ? error.message : "unknown");
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
