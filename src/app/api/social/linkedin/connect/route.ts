import { requireTenantAccess } from "@/lib/auth/session";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const saasId = searchParams.get("saasId");

  if (!saasId) {
    return new Response(JSON.stringify({ error: "saasId is required" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  const session = await requireTenantAccess(request);
  const tenantId = session.tenantId;

  const clientId = process.env.LINKEDIN_CLIENT_ID || "test-client-id";
  const requestUrl = new URL(request.url);
  const origin = requestUrl.origin;
  
  let callbackPath = "/auth/linkedin/callback";
  const redirectUri = `${origin}${callbackPath}`;
  
  const state = `${tenantId}__${saasId}`;

  const authUrl = new URL("https://www.linkedin.com/oauth/v2/authorization");
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", "r_liteprofile r_emailaddress");
  authUrl.searchParams.set("state", state);

  return Response.redirect(authUrl.toString(), 307);
}
