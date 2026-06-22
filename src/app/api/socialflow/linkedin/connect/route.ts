import { requireCurrentSocialFlowSession } from "@/lib/socialflow/auth/request";
import { guardChannelLimit } from "@/lib/socialflow/billing/enforce";
import { buildSocialFlowLinkedInConnectUrl } from "@/lib/socialflow/linkedin/oauth";

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

    const channelGuard = await guardChannelLimit(session.tenantId, saasId);
    if (!channelGuard.ok) {
      const url = new URL(`/socialflow/settings/accounts`, request.url);
      url.searchParams.set("planError", channelGuard.code);
      url.searchParams.set("planMessage", channelGuard.message);
      return Response.redirect(url.toString(), 307);
    }

    const oauth = buildSocialFlowLinkedInConnectUrl({
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

    console.error("SOCIALFLOW_LINKEDIN_CONNECT_ERROR", error);
    return new Response(JSON.stringify({ error: "LINKEDIN_CONNECT_FAILED" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
}
