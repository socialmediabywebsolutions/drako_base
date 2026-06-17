import { requireCurrentSocialFlowSession } from "@/lib/socialflow/auth/request";
import { MetaIntegrationError } from "@/lib/socialflow/meta/core";
import { buildSocialFlowMetaConnectUrl } from "@/lib/socialflow/meta/oauth";

export const dynamic = "force-dynamic";

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
    const oauth = buildSocialFlowMetaConnectUrl({
      request,
      tenantId: session.tenantId,
      saasId,
      redirectTo,
    });

    return Response.redirect(oauth.authorizationUrl, 307);
  } catch (error) {
    if (error instanceof Error && error.message === "SESSION_REQUIRED") {
      return json({ error: "SESSION_REQUIRED" }, 401);
    }
    if (error instanceof MetaIntegrationError) {
      const status = error.code === "META_ENV_MISSING" ? 503 : 500;
      console.error("SOCIALFLOW_META_CONNECT_ERROR", error.code, error.details);
      return json({ error: error.code, message: error.message, details: error.details }, status);
    }
    console.error("SOCIALFLOW_META_CONNECT_ERROR", error);
    return json({ error: "META_CONNECT_FAILED", message: error instanceof Error ? error.message : "Unexpected error" }, 500);
  }
}
