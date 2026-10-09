import { requireCurrentSocialFlowSession } from "@/lib/socialflow/auth/request";
import { deleteKeywordDmTrigger, resolveSocialContext, setKeywordDmTriggerActive } from "@/lib/socialflow/keyword-dm/repository";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await requireCurrentSocialFlowSession(request);
    const body = (await request.json().catch(() => null)) as { saasId?: string; active?: boolean } | null;
    const saasId = body?.saasId?.trim() || "socialflow";

    if (typeof body?.active !== "boolean") {
      return new Response(JSON.stringify({ error: "INVALID_PATCH_BODY" }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    }

    const ctx = await resolveSocialContext({ tenantId: session.tenantId, saasId });
    const trigger = await setKeywordDmTriggerActive(ctx, params.id, body.active);
    if (!trigger) {
      return new Response(JSON.stringify({ error: "TRIGGER_NOT_FOUND" }), {
        status: 404,
        headers: { "content-type": "application/json" },
      });
    }

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
    console.error("SOCIALFLOW_KEYWORD_TRIGGER_PATCH_ERROR", error instanceof Error ? error.message : "unknown");
    return new Response(JSON.stringify({ error: "KEYWORD_TRIGGER_UPDATE_FAILED" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    const session = await requireCurrentSocialFlowSession(request);
    const url = new URL(request.url);
    const saasId = url.searchParams.get("saasId")?.trim() || "socialflow";

    const ctx = await resolveSocialContext({ tenantId: session.tenantId, saasId });
    const deleted = await deleteKeywordDmTrigger(ctx, params.id);
    if (!deleted) {
      return new Response(JSON.stringify({ error: "TRIGGER_NOT_FOUND" }), {
        status: 404,
        headers: { "content-type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
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
    console.error("SOCIALFLOW_KEYWORD_TRIGGER_DELETE_ERROR", error instanceof Error ? error.message : "unknown");
    return new Response(JSON.stringify({ error: "KEYWORD_TRIGGER_DELETE_FAILED" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
}
