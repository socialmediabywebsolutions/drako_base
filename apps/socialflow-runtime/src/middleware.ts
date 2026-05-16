import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { normalizeHost, resolveHostMode } from "@shared-neutral/hosts";
import { readSocialFlowRuntimeTokenSession } from "./lib/auth/session";

function isPublicSocialFlowPath(pathname: string) {
  return (
    pathname === "/socialflow/auth" ||
    pathname.startsWith("/api/socialflow/auths/") ||
    pathname === "/api/socialflow/linkedin/callback"
  );
}

function isApiPath(pathname: string) {
  return pathname.startsWith("/api/");
}

function buildRuntimeHeaders(
  request: NextRequest,
  params: {
    host: string;
    hostMode: ReturnType<typeof resolveHostMode>;
    tenantId?: string;
  },
) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-socialflow-runtime-root", "socialflow-runtime-canary");
  requestHeaders.set("x-socialflow-runtime-host", params.host || "unknown");
  requestHeaders.set("x-socialflow-runtime-host-mode", params.hostMode);

  if (params.tenantId) {
    requestHeaders.set("x-drako-client-entry-mode", "isolated");
    requestHeaders.set("x-drako-tenant-id", params.tenantId);
    requestHeaders.set("x-tenant-id", params.tenantId);
  }

  return requestHeaders;
}

function forbiddenHostModeResponse(pathname: string) {
  if (isApiPath(pathname)) {
    return NextResponse.json(
      {
        ok: false,
        error: "SOCIALFLOW_HOST_MODE_FORBIDDEN",
        message: "SocialFlow runtime does not serve control-plane hosts.",
      },
      { status: 403 },
    );
  }

  return new NextResponse(
    "<!doctype html><html><body><h1>SocialFlow host forbidden</h1><p>This inactive runtime only accepts SocialFlow product hosts.</p></body></html>",
    {
      status: 403,
      headers: { "content-type": "text/html; charset=utf-8" },
    },
  );
}

function unauthorizedResponse(request: NextRequest) {
  if (isApiPath(request.nextUrl.pathname)) {
    return NextResponse.json(
      {
        ok: false,
        error: "SESSION_REQUIRED",
      },
      { status: 401 },
    );
  }

  const url = new URL("/socialflow/auth", request.url);
  url.searchParams.set("next", request.nextUrl.pathname);
  return NextResponse.redirect(url, 307);
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const host = normalizeHost(request.headers.get("x-forwarded-host") || request.headers.get("host") || "");
  const hostMode = resolveHostMode(host, process.env.CF_PAGES_ENVIRONMENT ?? null);

  if (hostMode === "CAMPAMENTO_BASE") {
    return forbiddenHostModeResponse(pathname);
  }

  const tokenSession = await readSocialFlowRuntimeTokenSession(request);
  const requestHeaders = buildRuntimeHeaders(request, {
    host,
    hostMode,
    tenantId: tokenSession?.tenantId,
  });

  if (isPublicSocialFlowPath(pathname)) {
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  if (!tokenSession) {
    return unauthorizedResponse(request);
  }

  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: ["/socialflow/:path*", "/api/socialflow/:path*"],
};
