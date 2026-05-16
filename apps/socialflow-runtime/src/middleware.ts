import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { normalizeHost, resolveHostMode } from "@shared-neutral/hosts";
import { readSocialFlowRuntimeTokenSession } from "./lib/auth/session";
import { getSocialFlowRuntimeEnv } from "./lib/runtime-env";
import { getRuntimeCorrelationId, logRuntimeEvent } from "./lib/runtime-observability";
import { verifyLinkedInCanaryGateState } from "./lib/socialflow/linkedin/canary-gate-state";

const CANARY_GATE_HEADER = "x-socialflow-canary-gate";
const CANARY_GATE_QUERY = "canaryGate";
const CANARY_GATE_COOKIE = "__Host-socialflow_canary_gate";
const LINKEDIN_CALLBACK_PREFIX = "/api/socialflow/linkedin/callback";

function isPublicSocialFlowPath(pathname: string) {
  return (
    pathname === "/socialflow/auth" ||
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/api/socialflow/auths/") ||
    pathname.startsWith(LINKEDIN_CALLBACK_PREFIX) ||
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

function isLinkedInCallbackPath(pathname: string) {
  return pathname === LINKEDIN_CALLBACK_PREFIX || pathname.startsWith(`${LINKEDIN_CALLBACK_PREFIX}/`);
}

function setCanaryGateCookie(response: NextResponse, gateToken: string) {
  response.cookies.set({
    name: CANARY_GATE_COOKIE,
    value: gateToken,
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
  });
}

async function allowLinkedInCallbackWithoutGateHeader(request: NextRequest, gateToken: string) {
  if (request.method !== "GET" || !isLinkedInCallbackPath(request.nextUrl.pathname)) {
    return { ok: false as const, reason: "not_callback_request" };
  }

  const state = request.nextUrl.searchParams.get("state");
  const result = await verifyLinkedInCanaryGateState(state, gateToken);
  if (!result.ok) {
    return { ok: false as const, reason: result.reason };
  }

  const hasOAuthPayload =
    request.nextUrl.searchParams.has("code")
    || request.nextUrl.searchParams.has("error");
  if (!hasOAuthPayload) {
    return { ok: false as const, reason: "callback_missing_code_or_error" };
  }

  return { ok: true as const, tenantId: result.tenantId, saasId: result.saasId };
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
    const gateCookie = request.cookies.get(CANARY_GATE_COOKIE)?.value?.trim() ?? "";
    const queryGate = request.nextUrl.searchParams.get(CANARY_GATE_QUERY)?.trim() ?? "";
    const hasValidHeader = provided.length > 0 && provided === gateToken;
    const hasValidCookie = gateCookie.length > 0 && gateCookie === gateToken;
    const hasValidQuery = queryGate.length > 0 && queryGate === gateToken;

    if (hasValidQuery && request.method === "GET" && !hasValidHeader && !hasValidCookie) {
      const redirectUrl = new URL(request.url);
      redirectUrl.searchParams.delete(CANARY_GATE_QUERY);
      const response = NextResponse.redirect(redirectUrl, 307);
      setCanaryGateCookie(response, gateToken);
      logRuntimeEvent("log", "middleware_canary_gate_cookie_bootstrapped", {
        pathname,
        method: request.method,
        host,
        correlationId: getRuntimeCorrelationId(request),
      });
      return response;
    }

    if (!hasValidHeader && !hasValidCookie) {
      const callbackBypass = await allowLinkedInCallbackWithoutGateHeader(request, gateToken);
      if (callbackBypass.ok) {
        logRuntimeEvent("log", "middleware_canary_gate_callback_state_accepted", {
          pathname,
          method: request.method,
          host,
          tenantId: callbackBypass.tenantId,
          saasId: callbackBypass.saasId,
          correlationId: getRuntimeCorrelationId(request),
        });
      } else {
        return canaryGateDeniedResponse(
          request,
          host,
          !provided
            ? isLikelyCrawlerUserAgent(userAgent)
              ? "missing_gate_header_bot_or_crawler"
              : queryGate
                ? `invalid_gate_query:${callbackBypass.reason}`
                : `missing_gate_header:${callbackBypass.reason}`
            : `invalid_gate_header:${callbackBypass.reason}`,
        );
      }
    }

    if (provided && !hasValidHeader) {
      return canaryGateDeniedResponse(
        request,
        host,
        "invalid_gate_header",
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
