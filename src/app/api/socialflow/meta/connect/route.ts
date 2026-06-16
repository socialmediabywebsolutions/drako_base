import { requireCurrentSocialFlowSession } from "@/lib/socialflow/auth/request";
import { buildSocialFlowMetaConnectUrl } from "@/lib/socialflow/meta/oauth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const saasId = searchParams.get("saasId")?.trim() || "";
    const redirectTo = searchParams.get("redirectTo")?.trim() || null;

    if (!saasId) {
      return new Response(JSON.stringify({ error: "saasId is required" }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
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
      return new Response(JSON.stringify({ error: "SESSION_REQUIRED" }), {
        status: 401,
        headers: { "content-type": "application/json" },
      });
    }

    console.error("SOCIALFLOW_META_CONNECT_ERROR", error);
    return new Response(JSON.stringify({ error: "META_CONNECT_FAILED" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
}
