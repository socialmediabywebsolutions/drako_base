export const dynamic = "force-dynamic";

import { requireCurrentSocialFlowSession } from "@/lib/socialflow/auth/request";
import { guardChannelLimit } from "@/lib/socialflow/billing/enforce";
import { InstagramOAuthError, buildInstagramAuthorizationUrl } from "@/lib/socialflow/instagram/oauth";

function json(body: Record<string, unknown>, status: number) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const saasId = searchParams.get("saasId")?.trim() || "";
    const redirectTo = searchParams.get("redirectTo")?.trim() || null;

    if (!saasId) {
      return json({ error: "INVALID_PARAMS", message: "saasId is required" }, 400);
    }

    const session = await requireCurrentSocialFlowSession(request);

    const channelGuard = await guardChannelLimit(session.tenantId, saasId);
    if (!channelGuard.ok) {
      const url = new URL(`/socialflow/settings/accounts`, request.url);
      url.searchParams.set("planError", channelGuard.code);
      url.searchParams.set("planMessage", channelGuard.message);
      return Response.redirect(url.toString(), 307);
    }

    const { authorizationUrl } = await buildInstagramAuthorizationUrl({
      request,
      tenantId: session.tenantId,
      saasId,
      redirectTo,
    });

    return Response.redirect(authorizationUrl, 307);
  } catch (error) {
    if (error instanceof Error && error.message === "SESSION_REQUIRED") {
      return json({ error: "SESSION_REQUIRED" }, 401);
    }
    if (error instanceof InstagramOAuthError) {
      const status = error.code === "INSTAGRAM_ENV_MISSING" ? 503 : 500;
      console.error("INSTAGRAM_CONNECT_ERROR", error.code, error.details);
      return json({ error: error.code, message: error.message, details: error.details }, status);
    }
    console.error("INSTAGRAM_CONNECT_ERROR", error);
    return json({ error: "INSTAGRAM_CONNECT_FAILED", message: error instanceof Error ? error.message : "Unexpected error" }, 500);
  }
}
