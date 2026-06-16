import { requireCurrentSocialFlowSession } from "@/lib/socialflow/auth/request";
import {
  getConversationSettings,
  resolveSocialContext,
  upsertConversationSettings,
} from "@/lib/socialflow/conversational/repository";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const session = await requireCurrentSocialFlowSession(request);
    const url = new URL(request.url);
    const saasId = url.searchParams.get("saasId")?.trim() || "socialflow";

    const ctx = await resolveSocialContext({ tenantId: session.tenantId, saasId });
    const settings = await getConversationSettings(ctx);

    return new Response(JSON.stringify({ ok: true, settings }), {
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
    console.error("SOCIALFLOW_SETTINGS_GET_ERROR", error instanceof Error ? error.message : "unknown");
    return new Response(JSON.stringify({ error: "SETTINGS_GET_FAILED" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireCurrentSocialFlowSession(request);
    const body = (await request.json().catch(() => null)) as {
      autoSendEnabled?: boolean;
      autoSendProviders?: string[];
      saasId?: string;
    } | null;

    const saasId = body?.saasId?.trim() || "socialflow";

    if (typeof body?.autoSendEnabled !== "boolean") {
      return new Response(JSON.stringify({ error: "MISSING_AUTO_SEND_ENABLED" }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    }

    const ctx = await resolveSocialContext({ tenantId: session.tenantId, saasId });
    const settings = await upsertConversationSettings(ctx, {
      autoSendEnabled: body.autoSendEnabled,
      autoSendProviders: Array.isArray(body.autoSendProviders) ? body.autoSendProviders : undefined,
    });

    return new Response(JSON.stringify({ ok: true, settings }), {
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
    console.error("SOCIALFLOW_SETTINGS_POST_ERROR", error instanceof Error ? error.message : "unknown");
    return new Response(JSON.stringify({ error: "SETTINGS_UPDATE_FAILED" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
}
