import { requireCurrentSocialFlowSession } from "@/lib/socialflow/auth/request";
import { createKeywordDmTrigger, listKeywordDmTriggers, resolveSocialContext } from "@/lib/socialflow/keyword-dm/repository";
import type { KeywordMatchType } from "@/lib/socialflow/keyword-dm/types";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const session = await requireCurrentSocialFlowSession(request);
    const url = new URL(request.url);
    const saasId = url.searchParams.get("saasId")?.trim() || "socialflow";

    const ctx = await resolveSocialContext({ tenantId: session.tenantId, saasId });
    const triggers = await listKeywordDmTriggers(ctx);

    return new Response(JSON.stringify({ ok: true, triggers }), {
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
    console.error("SOCIALFLOW_KEYWORD_TRIGGERS_GET_ERROR", error instanceof Error ? error.message : "unknown");
    return new Response(JSON.stringify({ error: "KEYWORD_TRIGGERS_LIST_FAILED" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireCurrentSocialFlowSession(request);
    const body = (await request.json().catch(() => null)) as {
      saasId?: string;
      keyword?: string;
      matchType?: string;
      dmMessage?: string;
    } | null;

    const saasId = body?.saasId?.trim() || "socialflow";
    const keyword = body?.keyword?.trim();
    const matchType = body?.matchType;
    const dmMessage = body?.dmMessage?.trim();

    if (!keyword || !dmMessage || (matchType !== "exact" && matchType !== "contains")) {
      return new Response(JSON.stringify({ error: "INVALID_TRIGGER_INPUT" }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    }

    const ctx = await resolveSocialContext({ tenantId: session.tenantId, saasId });
    // target_post_id no se expone todavía en esta primera versión — todos los triggers
    // aplican a todos los posts del tenant (ver Fase 4 del plan de Keyword Trigger + Auto DM).
    const trigger = await createKeywordDmTrigger(ctx, {
      keyword,
      matchType: matchType as KeywordMatchType,
      dmMessage,
      targetPostId: null,
    });

    return new Response(JSON.stringify({ ok: true, trigger }), {
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
    console.error("SOCIALFLOW_KEYWORD_TRIGGERS_POST_ERROR", error instanceof Error ? error.message : "unknown");
    return new Response(JSON.stringify({ error: "KEYWORD_TRIGGER_CREATE_FAILED" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
}
