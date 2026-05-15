import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { normalizeHost, resolveHostMode } from "@shared-neutral/hosts";

export function middleware(request: NextRequest) {
  const host = normalizeHost(request.headers.get("x-forwarded-host") || request.headers.get("host") || "");
  const response = NextResponse.next();

  response.headers.set("x-socialflow-runtime-scaffold", "inactive");
  response.headers.set("x-socialflow-runtime-host", host || "unknown");
  response.headers.set("x-socialflow-runtime-host-mode", resolveHostMode(host));

  return response;
}

export const config = {
  matcher: ["/socialflow/:path*", "/api/socialflow/:path*"],
};
