import { requireTenantAccess } from "@/lib/auth/session";
import { buildSocialFlowLinkedInConnectUrl } from "@/lib/socialflow/linkedin/oauth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const saasId = searchParams.get("saasId")?.trim() || "";
  const redirectTo = searchParams.get("redirectTo")?.trim() || null;

  if (!saasId) {
    return new Response(JSON.stringify({ error: "saasId is required" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  const session = await requireTenantAccess(request);
  const oauth = buildSocialFlowLinkedInConnectUrl({
    request,
    tenantId: session.tenantId,
    saasId,
    redirectTo,
  });

  return Response.redirect(oauth.authorizationUrl, 307);
}
