import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

// Enforce single-owner access via Cloudflare Access in production.
// Dev fallback: allow if running locally (no CF headers detected).
export function middleware(req: NextRequest) {
  const url = new URL(req.url);
  const isDev = url.hostname === "localhost" || url.hostname === "127.0.0.1";

  // If Cloudflare Access is configured, header CF-Access-Jwt-Assertion will be present.
  const cfJwt = req.headers.get("cf-access-jwt-assertion");

  if (isDev) {
    return NextResponse.next();
  }

  if (!cfJwt) {
    return new NextResponse(
      JSON.stringify({ error: "Unauthorized: configure Cloudflare Access for DRĀKO." }),
      { status: 401, headers: { "content-type": "application/json" } }
    );
  }

  // In a full implementation, verify JWT audience and email here.
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/|favicon.ico|public/).*)",
  ],
};
