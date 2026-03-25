export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireTenantAccess, UnauthorizedError } from "@/lib/auth/session";
import { LINKEDIN_REDIRECT_URI } from "@/lib/social/linkedin";

function getLinkedInClientId() {
  const clientId = process.env.LINKEDIN_CLIENT_ID?.trim();
  if (!clientId) {
    throw new Error("LINKEDIN_CLIENT_ID is not configured");
  }
  return clientId;
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const saasId = url.searchParams.get("saasId")?.trim() || "";
    if (!saasId) {
      return NextResponse.json({ code: "INVALID_PARAMS", message: "saasId is required" }, { status: 400 });
    }

    const { tenantId } = await requireTenantAccess(request);
    const state = `${tenantId}__${saasId}`;
    const linkedInUrl = new URL("https://www.linkedin.com/oauth/v2/authorization");
    linkedInUrl.searchParams.set("response_type", "code");
    linkedInUrl.searchParams.set("client_id", getLinkedInClientId());
    linkedInUrl.searchParams.set("redirect_uri", LINKEDIN_REDIRECT_URI);
    linkedInUrl.searchParams.set("scope", "openid profile email w_member_social");
    linkedInUrl.searchParams.set("state", state);

    return NextResponse.redirect(linkedInUrl);
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ code: "UNAUTHORIZED", message: error.message }, { status: error.status });
    }
    return NextResponse.json(
      {
        code: "LINKEDIN_CONNECT_FAILED",
        message: error instanceof Error ? error.message : "LinkedIn connect failed.",
      },
      { status: 500 },
    );
  }
}
