import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { normalizeHost, resolveHostMode } from "@shared-neutral/hosts";
import { readSocialFlowRuntimeTokenSession } from "./lib/auth/session";
import { getSocialFlowRuntimeEnv } from "./lib/runtime-env";
import { getRuntimeCorrelationId, logRuntimeEvent } from "./lib/runtime-observability";

const CANARY_GATE_HEADER = "x-socialflow-canary-gate";

function isPublicSocialFlowPath(pathname: string) {
  return (
    pathname === "/socialflow/auth" ||
    pathname.startsWith("/api/socialflow/auths/") ||
    pathname === "/api/socialflow/linkedin/callback" ||
    pathname === "/api/socialflow/runtime/health" ||
    pathname === "/api/socialflow/runtime/readiness"
  );
}

function isApiPath(pathname: string) {
  return pathname.startsWith("/api/");
}

function isLikelyCrawlerUserAgent(userAgent: string): boolean {
  return /(bot|crawler|spider|preview|scraper|headless|monitor)/i.test(userAgent);
}

function resolveCanaryGatedHosts(): Set<string> {
  const configured = getSocialFlowRuntimeEnv()?.SOCIALFLOW_CANARY_GATED_HOSTS ?? "";
  const hosts = configured
    .split(",")
    .map((value) => normalizeHost(value))
    .filter(Boolean);

  return new Set(hosts.length > 0 ? hosts : ["socialflow-canary.drako.systems"]);
}

function shouldEnforceCanaryGate(host: string): boolean {
  const normalized = normalizeHost(host);
  return normalized.length > 0 && resolveCanaryGatedHosts().has(normalized);
}

function canaryGateDeniedResponse(request: NextRequest, host: string, reason: string) {
  const details = {
    pathname: request.nextUrl.pathname,
    method: request.method,
    host,
    reason,
    correlationId: getRuntimeCorrelationId(request),
    userAgent: request.headers.get("user-agent") ?? "unknown",
  };
  logRuntimeEvent("warn", "middleware_canary_gate_denied", details);

  if (isApiPath(request.nextUrl.pathname)) {
    return NextResponse.json(
      {
        ok: false,
        error: "SOCIALFLOW_CANARY_GATE_DENIED",
        reason,
      },
      { status: 403 },
    );
  }

  return new NextResponse(
    "<!doctype html><html><body><h1>SocialFlow gated canary</h1><p>Access denied.</p></body></html>",
    {
      status: 403,
      headers: { "content-type": "text/html; charset=utf-8" },
    },
  );
}

function canaryGateMisconfiguredResponse(request: NextRequest, host: string) {
  logRuntimeEvent("error", "middleware_canary_gate_misconfigured", {
    pathname: request.nextUrl.pathname,
    method: request.method,
    host,
    correlationId: getRuntimeCorrelationId(request),
  });

  if (isApiPath(request.nextUrl.pathname)) {
    return NextResponse.json(
      {
        ok: false,
        error: "SOCIALFLOW_CANARY_GATE_MISCONFIGURED",
      },
      { status: 503 },
    );
  }

  return new NextResponse(
    "<!doctype html><html><body><h1>SocialFlow gated canary unavailable</h1><p>Access gate is not configured.</p></body></html>",
    {
      status: 503,
      headers: { "content-type": "text/html; charset=utf-8" },
    },
  );
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
  requestHeaders.set("x-correlation-id", getRuntimeCorrelationId(request));
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
  logRuntimeEvent("warn", "middleware_forbidden_host_mode", { pathname });
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
  logRuntimeEvent("warn", "middleware_session_required", {
    pathname: request.nextUrl.pathname,
    method: request.method,
  });
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
  const hostMode = resolveHostMode(host, getSocialFlowRuntimeEnv()?.CF_PAGES_ENVIRONMENT ?? null);
  const userAgent = request.headers.get("user-agent") ?? "";

  if (hostMode === "CAMPAMENTO_BASE") {
    return forbiddenHostModeResponse(pathname);
  }

  if (shouldEnforceCanaryGate(host)) {
    const gateToken = getSocialFlowRuntimeEnv()?.SOCIALFLOW_CANARY_GATE_TOKEN?.trim() ?? "";
    if (!gateToken) {
      return canaryGateMisconfiguredResponse(request, host);
    }

    const provided = request.headers.get(CANARY_GATE_HEADER)?.trim() ?? "";
    if (!provided || provided !== gateToken) {
      return canaryGateDeniedResponse(
        request,
        host,
        !provided
          ? isLikelyCrawlerUserAgent(userAgent)
            ? "missing_gate_header_bot_or_crawler"
            : "missing_gate_header"
          : "invalid_gate_header",
      );
    }
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
