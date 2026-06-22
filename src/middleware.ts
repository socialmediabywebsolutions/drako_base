// src/middleware.ts
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { env } from "@/lib/cf";
import { resolveHostToSaas } from "@/lib/empire/host-resolver";
import { recordCampamentoEvent } from "@/lib/empire/events";
import { DEMO_TENANT_ID } from "@/lib/tenants/services";
import { recordLegacyAliasUsageTelemetry } from "@/lib/observability/legacy-alias-usage";
import { resolveEffectiveHost, resolveHostMode } from "@/lib/hosts";
import {
  CORRELATION_HEADER,
  TENANT_HEADER,
  SAAS_HEADER,
  generateCorrelationId,
  isValidCorrelationId,
  normalizeCorrelationId,
  shouldBypassCorrelation,
} from "@/lib/correlation";
import { checkTenantRateLimit } from "@/lib/security/tenant-rate-limit";
import { extractSessionFromRequest } from "@/lib/edge-auth";
import { isRoutingsSubdomainsEnabled } from "@/lib/auths/flags";
import { resolveAuthsContextFromRequest, resolveAuthsLoginPath } from "@/lib/auths/contexts";
import {
  isLocalDemoClientBypassRequest,
  isTenantWorkspaceApiPath,
  isTenantWorkspacePath,
  resolveTenantWorkspaceEntryMode,
} from "@/lib/platform/surfaces";

/**
 * MODO DEV
 * ----------
 * De momento NO bloqueamos ningún request.
 * Más adelante aquí conectaremos Cloudflare Access / Auth real.
 */
function buildHtmlResponse(message: string, status = 200, extra?: string) {
  return new NextResponse(
    `<!doctype html><html lang="es"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/><title>Operator</title><style>body{font-family:system-ui,-apple-system,sans-serif;padding:40px;color:#0f172a;background:#f8fafc;}a.button{display:inline-block;margin-right:12px;margin-top:12px;padding:10px 14px;border-radius:999px;border:1px solid #0f172a;text-decoration:none;color:#0f172a;font-weight:600;}small{color:#475569;display:block;margin-top:12px}</style></head><body><h1 style="font-size:24px; margin-bottom:12px;">Operator</h1><p style="font-size:16px; line-height:1.5; max-width:720px;">${message}</p>${extra ?? ""}</body></html>`,
    { status, headers: { "content-type": "text/html; charset=utf-8" } },
  );
}

export function shouldBypassLocalLinkedInOAuthRateLimit(req: NextRequest): boolean {
  if (req.method !== "GET") return false;
  if (
    req.nextUrl.pathname !== "/api/socialflow/linkedin/connect" &&
    req.nextUrl.pathname !== "/api/social/linkedin/connect"
  ) {
    return false;
  }

  const host = (req.headers.get("x-forwarded-host") || req.headers.get("host") || "")
    .trim()
    .toLowerCase();

  return host === "localhost:8787" || host === "127.0.0.1:8787";
}

function requiresExplicitLocalAuthContext(req: NextRequest): boolean {
  const host = (req.headers.get("host") || req.headers.get("x-forwarded-host") || "")
    .trim()
    .toLowerCase();
  const normalizedHost = host.split(":")[0] ?? "";
  if (normalizedHost !== "localhost" && normalizedHost !== "127.0.0.1") return false;
  if (req.nextUrl.searchParams.get("__drako_host")) return false;
  if (req.cookies.get("drako_host")?.value) return false;
  return true;
}

function isAuthRoute(pathname: string): boolean {
  return (
    pathname.startsWith("/api/auth/") ||
    pathname.startsWith("/api/drakos/auths/") ||
    pathname.startsWith("/api/mentorias/auths/") ||
    pathname.startsWith("/api/socialflow/auths/") ||
    pathname.startsWith("/api/bases/auths/") ||
    pathname.startsWith("/mentorias/auths/") ||
    pathname.startsWith("/drakos/auths/") ||
    pathname.startsWith("/socialflow/auth") ||
    pathname.startsWith("/bases/")
  );
}

function resolveLegacyWorkspaceRedirect(pathname: string): string | null {
  if (pathname === "/dashboard" || pathname.startsWith("/dashboard/")) {
    return pathname.replace(/^\/dashboard/, "/socialflow");
  }
  if (pathname === "/profile/setup" || pathname.startsWith("/profile/setup/")) {
    return pathname.replace(/^\/profile\/setup/, "/socialflow/setup");
  }
  return null;
}

function resolveLegacyOperatorRedirect(pathname: string): string | null {
  if (pathname === "/owner" || pathname.startsWith("/owner/")) {
    return pathname.replace(/^\/owner/, "/operator");
  }
  if (pathname === "/campobase/platform" || pathname.startsWith("/campobase/platform/")) {
    return pathname.replace(/^\/campobase\/platform/, "/operator/platform");
  }
  if (pathname === "/campobase/socialflow" || pathname.startsWith("/campobase/socialflow/")) {
    return pathname.replace(/^\/campobase\/socialflow/, "/operator/socialflow");
  }
  if (pathname === "/campobase/social" || pathname.startsWith("/campobase/social/")) {
    return pathname.replace(/^\/campobase\/social/, "/operator/social");
  }
  return null;
}

type LegacyCompatKind = "owner-api" | "owner-ui" | "campobase-api" | "campobase-ui";

type LegacyCompatUsage = {
  kind: LegacyCompatKind;
  legacyPath: string;
  canonicalTarget: string;
};

// Keep legacy marker strings in middleware for readiness/architecture guards.
const LEGACY_COMPAT_ROUTE_LOG_MARKER = "LEGACY_COMPAT_ROUTE_HIT";
const LEGACY_COMPAT_ROUTE_EVENT_TYPE = "legacy.compat.route.hit";

function resolveLegacyCompatUsage(pathname: string, legacyOperatorRedirect: string | null): LegacyCompatUsage | null {
  if (pathname === "/api/owner" || pathname.startsWith("/api/owner/")) {
    const canonicalTarget =
      pathname.startsWith("/api/owner/factory/") || pathname.startsWith("/api/owner/saas-factory/")
        ? "factory-api"
        : "operator-api";
    return {
      kind: "owner-api",
      legacyPath: pathname,
      canonicalTarget,
    };
  }

  if (pathname === "/api/campobase" || pathname.startsWith("/api/campobase/")) {
    return {
      kind: "campobase-api",
      legacyPath: pathname,
      canonicalTarget: "operator-api",
    };
  }

  if (pathname === "/owner" || pathname.startsWith("/owner/")) {
    return {
      kind: "owner-ui",
      legacyPath: pathname,
      canonicalTarget: legacyOperatorRedirect ?? "/operator",
    };
  }

  if (pathname === "/campobase" || pathname.startsWith("/campobase/")) {
    return {
      kind: "campobase-ui",
      legacyPath: pathname,
      canonicalTarget: legacyOperatorRedirect ?? "/operator",
    };
  }

  return null;
}

function resolveLegacyCompatSampleRate(requestBindings: ReturnType<typeof env>): number {
  const raw =
    requestBindings?.DRAKO_LEGACY_COMPAT_SAMPLE_RATE
    ?? process.env.DRAKO_LEGACY_COMPAT_SAMPLE_RATE
    ?? "1";
  const parsed = Number.parseFloat(raw);
  if (Number.isNaN(parsed) || parsed <= 0) return 0;
  return Math.min(parsed, 1);
}

function applyLegacyCompatHeaders(
  response: NextResponse,
  legacyCompatUsage: LegacyCompatUsage,
  correlationId: string,
) {
  response.headers.set("X-Drako-Legacy-Compat", legacyCompatUsage.kind);
  response.headers.set("X-Drako-Control-Plane-Only", "true");
  response.headers.set("X-Drako-Sunset", "planned");
  response.headers.set("X-Drako-Compat-Canonical", legacyCompatUsage.canonicalTarget);
  response.headers.set("X-Drako-Compat-Path", legacyCompatUsage.legacyPath);
  response.headers.set("Deprecation", "true");
  response.headers.set(CORRELATION_HEADER, correlationId);
  return response;
}

async function recordLegacyCompatUsage(params: {
  requestBindings: ReturnType<typeof env>;
  legacyCompatUsage: LegacyCompatUsage | null;
  correlationId: string;
  host: string;
  hostMode: string;
  method: string;
  request: NextRequest;
}) {
  if (!params.legacyCompatUsage) return;
  void LEGACY_COMPAT_ROUTE_LOG_MARKER;
  void LEGACY_COMPAT_ROUTE_EVENT_TYPE;

  const sampleRate = resolveLegacyCompatSampleRate(params.requestBindings);
  const aliasType = params.legacyCompatUsage.kind.startsWith("owner") ? "owner" : "campobase";
  await recordLegacyAliasUsageTelemetry({
    requestBindings: params.requestBindings,
    aliasType,
    legacyPath: params.legacyCompatUsage.legacyPath,
    canonicalTarget: params.legacyCompatUsage.canonicalTarget,
    method: params.method,
    correlationId: params.correlationId,
    host: params.host,
    hostMode: params.hostMode,
    request: params.request,
    sampleRate,
  });
}

function isMentoriaProductPath(pathname: string): boolean {
  return (
    pathname === "/mentoria" ||
    pathname.startsWith("/mentoria/") ||
    pathname === "/app" ||
    pathname.startsWith("/app/") ||
    pathname === "/onboarding" ||
    pathname.startsWith("/onboarding/") ||
    pathname === "/share" ||
    pathname.startsWith("/share/") ||
    pathname === "/login" ||
    pathname === "/signup" ||
    pathname === "/auth/login" ||
    pathname === "/auth/register" ||
    pathname.startsWith("/mentorias/auths/")
  );
}

function rewriteMentoriaHostPath(req: NextRequest, pathname: string) {
  const url = new URL(req.url);

  if (pathname === "/") {
    url.pathname = "/site/mentoria";
    return NextResponse.rewrite(url);
  }

  if (pathname === "/mentoria/app") {
    url.pathname = "/mentoria/app/workspace";
    return NextResponse.rewrite(url);
  }

  if (pathname === "/app" || pathname.startsWith("/app/")) {
    url.pathname = pathname.replace(/^\/app/, "/mentoria/app");
    return NextResponse.redirect(url, 308);
  }

  if (pathname === "/onboarding" || pathname.startsWith("/onboarding/")) {
    url.pathname = pathname.replace(/^\/onboarding/, "/mentoria/onboarding");
    return NextResponse.rewrite(url);
  }

  if (pathname === "/share" || pathname.startsWith("/share/")) {
    url.pathname = pathname.replace(/^\/share/, "/mentoria/share");
    return NextResponse.rewrite(url);
  }

  if (pathname === "/signup") {
    url.pathname = "/mentorias/auths/registrations";
    return NextResponse.redirect(url, 308);
  }

  if (pathname === "/login") {
    url.pathname = "/mentorias/auths/logins";
    return NextResponse.rewrite(url);
  }

  if (pathname === "/auth/register") {
    url.pathname = "/mentorias/auths/registrations";
    return NextResponse.rewrite(url);
  }

  if (pathname === "/auth/login") {
    url.pathname = "/mentorias/auths/logins";
    return NextResponse.rewrite(url);
  }

  return null;
}

function rewriteSocialFlowHostPath(req: NextRequest, pathname: string) {
  if (pathname !== "/") {
    return null;
  }

  const url = new URL(req.url);
  url.pathname = "/socialflows";
  return NextResponse.rewrite(url);
}

/**
 * OLIMPO MIDDLEWARE - ULTRA MINIMAL & FAIL-SAFE
 *
 * ABSOLUTE RULES:
 * 1. NEVER throw exceptions - always return NextResponse
 * 2. MINIMAL imports - no heavy DB/SDK imports
 * 3. Graceful degradation when Cloudflare bindings unavailable
 */
export async function middleware(req: NextRequest) {
  function resolveRoutingSampleRate(): number {
    const requestBindings = env();
    const raw =
      (requestBindings as unknown as Record<string, string | undefined> | null)
        ?.DRACO_ROUTING_EVENTS_SAMPLE_RATE ?? "0.05";
    const parsed = Number.parseFloat(raw);
    if (Number.isNaN(parsed) || parsed <= 0) return 0;
    return Math.min(parsed, 1);
  }

  try {
    const pathname = req.nextUrl.pathname;
    const isApi = pathname.startsWith("/api");
    const requestedHost = req.headers.get("x-forwarded-host") || req.headers.get("host");
    const requestContext = resolveAuthsContextFromRequest(req);
    const loginPath = resolveAuthsLoginPath(requestContext);
    const isLocalDemoClientBypass = isLocalDemoClientBypassRequest({ pathname, requestedHost });
    const needsExplicitLocalContext = requiresExplicitLocalAuthContext(req);
    const legacyWorkspaceRedirect = resolveLegacyWorkspaceRedirect(pathname);
    const legacyOperatorRedirect = resolveLegacyOperatorRedirect(pathname);

    if (shouldBypassCorrelation(pathname)) {
      return NextResponse.next();
    }

    const incomingCorrelationId = req.headers.get(CORRELATION_HEADER);
    let correlationId: string;
    let isInvalidIncoming = false;

    if (isValidCorrelationId(incomingCorrelationId)) {
      correlationId = normalizeCorrelationId(incomingCorrelationId);
    } else {
      isInvalidIncoming = !!incomingCorrelationId;
      correlationId = generateCorrelationId();
    }

    if (process.env.CF_PAGES === "1" || process.env.CF_PAGES_ENVIRONMENT || process.env.CF_PAGES_URL) {
      return buildHtmlResponse(
        "Workers-only enforcement: this application must NOT run on Cloudflare Pages. Deploy using Cloudflare Workers (wrangler) only.",
        503,
      );
    }

    const requestBindings = env();
    const hostInfo = resolveEffectiveHost(req);
    const host = hostInfo.effectiveHost;
    const pagesEnvironment = requestBindings?.CF_PAGES_ENVIRONMENT ?? process.env.CF_PAGES_ENVIRONMENT ?? null;
    const hostMode = resolveHostMode(host, pagesEnvironment);
    const pagesEnvironmentHeader = pagesEnvironment ?? "unknown";
    const legacyCompatUsage = resolveLegacyCompatUsage(pathname, legacyOperatorRedirect);

    await recordLegacyCompatUsage({
      requestBindings,
      legacyCompatUsage,
      correlationId,
      host,
      hostMode,
      method: req.method,
      request: req,
    });

    if (legacyOperatorRedirect) {
      const redirectResponse = NextResponse.redirect(new URL(legacyOperatorRedirect, req.url), 308);
      if (hostInfo.shouldPersistCookie) {
        redirectResponse.cookies.set("drako_host", hostInfo.shouldPersistCookie, {
          path: "/",
          maxAge: 60 * 60 * 24 * 7,
        });
      }
      return legacyCompatUsage
        ? applyLegacyCompatHeaders(redirectResponse, legacyCompatUsage, correlationId)
        : redirectResponse;
    }

    if (pathname.startsWith("/site/panel")) {
      const session = await extractSessionFromRequest(req);

      if (!session && needsExplicitLocalContext) {
        return buildHtmlResponse(
          "Explicit auth context required in local development. Add ?__drako_host=bases.drako.systems, drako.systems, mentorias.drako.systems or a SocialFlow host.",
          400,
        );
      }

      if (!session) {
        const url = new URL(loginPath, req.url);
        url.searchParams.set("callbackUrl", pathname);
        return NextResponse.redirect(url);
      }

      const role = session.role?.toLowerCase();
      if (!role || (role !== "owner" && role !== "superadmin" && role !== "staff")) {
        return NextResponse.redirect(new URL("/socialflow", req.url));
      }
    }

    const isMentoriasHost =
      host === "mentoria.drako.systems" ||
      host === "mentorias.drako.systems" ||
      host.startsWith("mentoria.") ||
      host.startsWith("mentorias.");
    const isSocialFlowHost =
      host === "socialflow.drako.systems" ||
      host === "socialflows.drako.systems" ||
      host.startsWith("socialflow.") ||
      host.startsWith("socialflows.");

    if (!requestBindings) {
      if (isMentoriasHost && !isApi) {
        const mentoriaRewrite = rewriteMentoriaHostPath(req, pathname);
        if (mentoriaRewrite) return mentoriaRewrite;
      }
      if (isSocialFlowHost && !isApi) {
        const socialFlowRewrite = rewriteSocialFlowHostPath(req, pathname);
        if (socialFlowRewrite) return socialFlowRewrite;
      }

      const headers = new Headers(req.headers);
      headers.set("x-drako-host-mode", hostMode);
      headers.set("x-drako-effective-host", host);
      headers.set("x-drako-pages-environment", pagesEnvironmentHeader);
      if (isMentoriasHost) {
        headers.set("x-drako-saas-slug", "mentorias");
      }
      headers.set("x-drako-environment", "vercel");
      headers.set(CORRELATION_HEADER, correlationId);

      const res = NextResponse.next({ request: { headers } });
      res.headers.set(CORRELATION_HEADER, correlationId);
      if (legacyCompatUsage) {
        applyLegacyCompatHeaders(res, legacyCompatUsage, correlationId);
      }

      if (hostInfo.shouldPersistCookie) {
        res.cookies.set("drako_host", hostInfo.shouldPersistCookie, {
          path: "/",
          maxAge: 60 * 60 * 24 * 7,
        });
      }

      return res;
    }

    const isPagesDevHost = hostMode === "PREVIEW";
    const isPublicHost = hostMode === "PUBLIC_SAAS";
    const isAdminHost = hostMode === "CAMPAMENTO_BASE";

    if (isMentoriasHost && !isApi) {
      const mentoriaRewrite = rewriteMentoriaHostPath(req, pathname);
      if (mentoriaRewrite) return mentoriaRewrite;
    }
    if (isSocialFlowHost && !isApi) {
      const socialFlowRewrite = rewriteSocialFlowHostPath(req, pathname);
      if (socialFlowRewrite) return socialFlowRewrite;
    }

    const adminPrefixes = [
      "/admin",
      "/agents",
      "/departments",
      "/metrics",
      "/alerts",
      "/operator",
      "/owner",
      "/saas",
      "/inbox",
      "/dev-architects",
      "/grants",
      "/clients",
      "/clinic",
      "/billing",
      "/staff",
    ];

    const persistCookie = (res: NextResponse) => {
      if (hostInfo.shouldPersistCookie) {
        res.cookies.set("drako_host", hostInfo.shouldPersistCookie, {
          path: "/",
          maxAge: 60 * 60 * 24 * 7,
        });
      }
      return res;
    };

    if (isApi) {
      if (isRoutingsSubdomainsEnabled() && pathname.startsWith("/api/bases/") && !isAdminHost) {
        return NextResponse.json({ error: "Bases routes unavailable on this host" }, { status: 404 });
      }
      if (isRoutingsSubdomainsEnabled() && isMentoriasHost && pathname.startsWith("/api/drakos/")) {
        return NextResponse.json({ error: "Drakos routes unavailable on Mentorias host" }, { status: 404 });
      }
      if (isRoutingsSubdomainsEnabled() && !isMentoriasHost && pathname.startsWith("/api/mentorias/")) {
        return NextResponse.json({ error: "Mentorias routes unavailable on this host" }, { status: 404 });
      }
      if (
        isRoutingsSubdomainsEnabled() &&
        isAdminHost &&
        (pathname.startsWith("/api/drakos/auths/") ||
          pathname.startsWith("/api/mentorias/auths/") ||
          pathname.startsWith("/api/socialflow/auths/"))
      ) {
        return NextResponse.json({ error: "Final-user auth is unavailable on base host" }, { status: 403 });
      }
      if (pathname.startsWith("/api/bases/auths/")) {
        return NextResponse.json(
          {
            error: "BASES_CUSTOM_AUTHS_DEPRECATED",
            message: "Campamento Base operator auth uses NextAuth + D1 only. Use /bases/login.",
          },
          { status: 410 },
        );
      }

      const bindings = requestBindings;
      const hasDb = Boolean(bindings?.DRACO_DB);
      const contextHeaders = new Headers(req.headers);
      contextHeaders.delete(TENANT_HEADER);
      contextHeaders.delete("x-tenant-id");
      contextHeaders.delete(SAAS_HEADER);
      contextHeaders.delete("x-drako-saas-slug");
      contextHeaders.delete(CORRELATION_HEADER);

      contextHeaders.set("x-drako-host-mode", hostMode);
      contextHeaders.set("x-drako-effective-host", host);
      contextHeaders.set("x-drako-pages-environment", pagesEnvironmentHeader);
      if (isMentoriasHost) {
        contextHeaders.set("x-drako-saas-slug", "mentorias");
      }

      const tenantWorkspaceEntryMode = resolveTenantWorkspaceEntryMode({
        pathname,
        effectiveHost: host,
        pagesEnvironment,
        localDemoEnabled: isLocalDemoClientBypass,
      });

      if (tenantWorkspaceEntryMode) {
        contextHeaders.set("x-drako-client-entry-mode", tenantWorkspaceEntryMode);
        contextHeaders.set("x-drako-client-workspace-kind", "owned_saas");
      }

      if (isTenantWorkspaceApiPath(pathname)) {
        contextHeaders.set(CORRELATION_HEADER, correlationId);
        const res = persistCookie(NextResponse.next({ request: { headers: contextHeaders } }));
        res.headers.set(CORRELATION_HEADER, correlationId);
        if (legacyCompatUsage) {
          applyLegacyCompatHeaders(res, legacyCompatUsage, correlationId);
        }
        return res;
      }

      if (!bindings || !hasDb) {
        contextHeaders.set(CORRELATION_HEADER, correlationId);
        const res = persistCookie(NextResponse.next({ request: { headers: contextHeaders } }));
        res.headers.set(CORRELATION_HEADER, correlationId);
        if (legacyCompatUsage) {
          applyLegacyCompatHeaders(res, legacyCompatUsage, correlationId);
        }
        return res;
      }

      const resolutionHost = isPagesDevHost ? "drako.systems" : host;

      let resolution;
      try {
        resolution = await resolveHostToSaas(resolutionHost, correlationId);
      } catch (error) {
        console.error("HOST_RESOLUTION_FAILED", error);
        contextHeaders.set("x-drako-correlation-id", correlationId);
        return persistCookie(NextResponse.next({ request: { headers: contextHeaders } }));
      }

      if (resolution.status === "ACTIVE") {
        if (resolution.tenantId) {
          contextHeaders.set("x-drako-tenant-id", resolution.tenantId);
          contextHeaders.set("x-tenant-id", resolution.tenantId);

          const session = await extractSessionFromRequest(req);
          if (session && session.tenantId && session.tenantId !== resolution.tenantId && !isAuthRoute(pathname)) {
            const role = session.role?.toLowerCase();
            if (role !== "owner" && role !== "superadmin") {
              return NextResponse.json({ error: "CROSS_TENANT_ACCESS_FORBIDDEN" }, { status: 403 });
            }
          }

          const isDev = process.env.NODE_ENV === "development";
          const isSocialFlowRoute =
            pathname.startsWith("/api/socialflow/") || pathname.startsWith("/socialflow");
          const bypassLocalLinkedInOAuthRateLimit = shouldBypassLocalLinkedInOAuthRateLimit(req);

          if (!isDev && !bypassLocalLinkedInOAuthRateLimit && !isAuthRoute(pathname)) {
            const effectivePlan: "PRO" | "FREE" = isSocialFlowRoute ? "PRO" : "FREE";
            const rateLimit = await checkTenantRateLimit({
              tenantId: resolution.tenantId,
              saasId: resolution.saasId,
              route: pathname,
              request: req,
              plan: effectivePlan,
            });

            if (!rateLimit.allowed) {
              return persistCookie(
                NextResponse.json(
                  {
                    error: "RATE_LIMIT_EXCEEDED",
                    retry_after: rateLimit.retryAfter,
                    correlation_id: correlationId,
                  },
                  {
                    status: 429,
                    headers: {
                      [CORRELATION_HEADER]: correlationId,
                      "Retry-After": String(rateLimit.retryAfter || 60),
                    },
                  },
                ),
              );
            }
          }
        }

        if (resolution.saasId) {
          contextHeaders.set("x-drako-saas-id", resolution.saasId);
          contextHeaders.set("x-drako-saas-slug", resolution.saasSlug ?? "");
        }
      }

      contextHeaders.set(CORRELATION_HEADER, resolution.correlationId ?? correlationId);
      const res = persistCookie(NextResponse.next({ request: { headers: contextHeaders } }));
      res.headers.set(CORRELATION_HEADER, resolution.correlationId ?? correlationId);
      if (legacyCompatUsage) {
        applyLegacyCompatHeaders(res, legacyCompatUsage, resolution.correlationId ?? correlationId);
      }
      return res;
    }

    const responseHeaders = new Headers(req.headers);
    responseHeaders.set("x-drako-host-mode", hostMode);
    responseHeaders.set("x-drako-effective-host", host);
    responseHeaders.set("x-drako-pages-environment", pagesEnvironmentHeader);
    responseHeaders.set("x-drako-original-pathname", pathname);
    if (isMentoriasHost) {
      responseHeaders.set("x-drako-saas-slug", "mentorias");
    }

    const tenantWorkspaceEntryMode = resolveTenantWorkspaceEntryMode({
      pathname,
      effectiveHost: host,
      pagesEnvironment,
      localDemoEnabled: isLocalDemoClientBypass,
    });

    if (tenantWorkspaceEntryMode) {
      responseHeaders.set("x-drako-client-entry-mode", tenantWorkspaceEntryMode);
      responseHeaders.set("x-drako-client-workspace-kind", "owned_saas");
    }

    if (isPagesDevHost) {
      if (pathname !== "/preview" && !pathname.startsWith("/preview/")) {
        const url = new URL(req.url);
        url.pathname = "/preview";
        return persistCookie(NextResponse.rewrite(url, { request: { headers: responseHeaders } }));
      }
      return persistCookie(NextResponse.next({ request: { headers: responseHeaders } }));
    }

    if (isMentoriasHost && isMentoriaProductPath(pathname)) {
      return persistCookie(NextResponse.next({ request: { headers: responseHeaders } }));
    }

    if (isTenantWorkspacePath(pathname)) {
      return persistCookie(NextResponse.next({ request: { headers: responseHeaders } }));
    }

    if (isPublicHost) {
      if (isMentoriasHost) {
        const url = new URL(req.url);
        url.pathname = "/site/mentoria";
        return persistCookie(NextResponse.rewrite(url, { request: { headers: responseHeaders } }));
      }

      if (adminPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) {
        return persistCookie(NextResponse.redirect(new URL("/", req.url)));
      }

      return persistCookie(NextResponse.next({ request: { headers: responseHeaders } }));
    }

    if (isAdminHost) {
      if (pathname === "/auth/register") {
        return persistCookie(NextResponse.redirect(new URL("/bases/register", req.url)));
      }
      if (pathname === "/auth/login") {
        return persistCookie(NextResponse.redirect(new URL("/bases/login", req.url)));
      }

      if (
        isRoutingsSubdomainsEnabled() &&
        (pathname.startsWith("/drakos/auths/") ||
          pathname.startsWith("/mentorias/auths/") ||
          pathname.startsWith("/socialflow/auth"))
      ) {
        return persistCookie(NextResponse.redirect(new URL("/", req.url)));
      }

      const isAdminRoute = adminPrefixes.some(
        (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
      );

      if (isAdminRoute) {
        const session = await extractSessionFromRequest(req);
        if (!session) {
          const url = new URL("/bases/login", req.url);
          url.searchParams.set("callbackUrl", pathname);
          return persistCookie(NextResponse.redirect(url));
        }

        const role = session.role?.toLowerCase();
        if (!role || (role !== "owner" && role !== "superadmin" && role !== "staff" && role !== "admin")) {
          return persistCookie(NextResponse.redirect(new URL("/bases", req.url)));
        }
      }

      return persistCookie(NextResponse.next({ request: { headers: responseHeaders } }));
    }

    const bindings = requestBindings;
    const hasDb = Boolean(bindings?.DRACO_DB);
    if (!bindings || !hasDb) {
      return persistCookie(NextResponse.next());
    }

    let resolution;
    try {
      resolution = await resolveHostToSaas(host, correlationId);
    } catch (error) {
      console.error("HOST_RESOLUTION_FAILED", error);
      return persistCookie(NextResponse.next());
    }

    const tenantId = resolution.tenantId ?? DEMO_TENANT_ID;
    const finalCorrelationId = resolution.correlationId ?? correlationId;
    const metadata = {
      host: resolution.normalizedHost,
      status: resolution.status,
      wasWww: resolution.wasWww,
      reason: resolution.reason ?? null,
      domainId: resolution.domainId ?? null,
      verificationStatus: resolution.verificationStatus ?? null,
      verificationReason: resolution.verificationReason ?? null,
      lastCheckedAt: resolution.lastCheckedAt ?? null,
      updatedAt: resolution.updatedAt ?? null,
    };

    const sampleRate = resolveRoutingSampleRate();
    const shouldLogActive =
      resolution.status === "ACTIVE" && sampleRate > 0 && Math.random() <= sampleRate;

    try {
      if (shouldLogActive) {
        await recordCampamentoEvent({
          tenantId,
          saasId: resolution.saasId ?? null,
          type: "routing.resolve.domain.active",
          severity: resolution.severity ?? "INFO",
          source: "ROUTER",
          message: `Resolved host ${resolution.normalizedHost} to saas_id=${resolution.saasId ?? "unknown"}.`,
          metadata: { ...metadata, sampleRate },
          correlationId: finalCorrelationId,
        });
      } else if (resolution.status === "PENDING" || resolution.status === "PAUSED") {
        await recordCampamentoEvent({
          tenantId,
          saasId: resolution.saasId ?? null,
          type: "routing.resolve.domain.blocked",
          severity: resolution.severity ?? "WARNING",
          source: "ROUTER",
          message: `Blocked host ${resolution.normalizedHost} (${resolution.reason ?? "DOMAIN_BLOCKED"}).`,
          metadata,
          correlationId: finalCorrelationId,
        });
      }

      if (isInvalidIncoming) {
        await recordCampamentoEvent({
          tenantId,
          saasId: resolution.saasId ?? null,
          type: "observability.invalid_incoming",
          severity: "WARNING",
          source: "MIDDLEWARE",
          message: `Rejected invalid incoming correlation ID: ${incomingCorrelationId}. Assigned: ${correlationId}`,
          correlationId: finalCorrelationId,
        });
      }
    } catch (error) {
      console.warn("ROUTING_EVENT_FALLBACK", error);
    }

    if (resolution.status === "ACTIVE") {
      const headers = new Headers(req.headers);

      if (resolution.tenantId) {
        headers.set("x-drako-tenant-id", resolution.tenantId);
        headers.set("x-tenant-id", resolution.tenantId);
      }

      if (resolution.saasId) {
        headers.set("x-drako-saas-id", resolution.saasId);
        headers.set("x-drako-saas-slug", resolution.saasSlug ?? "");
      }

      headers.set(CORRELATION_HEADER, finalCorrelationId);
      headers.set("x-drako-domain-status", resolution.status);

      const activeEntryMode = resolveTenantWorkspaceEntryMode({
        pathname,
        effectiveHost: host,
        pagesEnvironment,
        localDemoEnabled: false,
      });

      if (activeEntryMode) {
        headers.set("x-drako-client-entry-mode", activeEntryMode);
        headers.set("x-drako-client-workspace-kind", "owned_saas");
      }

      const session = await extractSessionFromRequest(req);
      if (session && resolution.tenantId) {
        const userTenantId = session.tenantId;
        const userRole = session.role?.toLowerCase();

        if (
          userTenantId &&
          userTenantId !== resolution.tenantId &&
          userRole !== "owner" &&
          userRole !== "superadmin"
        ) {
          const url = new URL("/auth/error?error=TenantMismatch", req.url);
          return NextResponse.redirect(url);
        }
      }

      if (pathname.startsWith("/site/panel")) {
        const clientRoot = new URL("/socialflow", req.url);
        return NextResponse.redirect(clientRoot);
      }

      if (legacyWorkspaceRedirect) {
        return NextResponse.redirect(new URL(legacyWorkspaceRedirect, req.url), 308);
      }

      const res = persistCookie(NextResponse.next({ request: { headers } }));
      res.headers.set(CORRELATION_HEADER, finalCorrelationId);
      if (legacyCompatUsage) {
        applyLegacyCompatHeaders(res, legacyCompatUsage, finalCorrelationId);
      }
      return res;
    }

    const unknownMessage =
      "SaaS no registrado para este dominio. Revisa el DNS o crea el mapping en operator.";
    const unknownExtra = isPagesDevHost
      ? `<a class="button" href="/site">Ir a /site</a><small>Host real: ${hostInfo.realHost} · Host virtual: ${host}</small>`
      : `<a class="button" href="/operator/domains">Ir a /operator/domains (admin)</a><a class="button" href="?__drako_host=drako.systems">Cambiar host (solo local)</a><small>Host real: ${hostInfo.realHost} · Host virtual: ${host}</small>`;

    if (resolution.status === "PENDING" || resolution.status === "PAUSED") {
      const reason =
        resolution.reason ?? (resolution.status === "PAUSED" ? "DOMAIN_PAUSED" : "DOMAIN_BLOCKED");
      const statusCode =
        reason === "DOMAIN_PENDING_ACTIVATION"
          ? 409
          : reason === "DOMAIN_NOT_ACTIVE"
            ? 403
            : reason === "DOMAIN_PAUSED"
              ? 423
              : 403;

      const blockedHeaders = new Headers(responseHeaders);
      blockedHeaders.set("x-drako-domain-status", resolution.status);
      blockedHeaders.set("x-drako-domain-reason", reason);
      blockedHeaders.set("x-drako-correlation-id", correlationId);

      return persistCookie(
        NextResponse.json(
          {
            error: reason,
            host: resolution.normalizedHost,
            correlation_id: correlationId,
            domain_id: resolution.domainId ?? null,
            tenant_id: resolution.tenantId ?? null,
            saas_id: resolution.saasId ?? null,
          },
          { status: statusCode, headers: blockedHeaders },
        ),
      );
    }

    return persistCookie(buildHtmlResponse(unknownMessage, 200, unknownExtra));
  } catch (error) {
    console.error("MIDDLEWARE_CRITICAL_FAILURE", error);
    return NextResponse.next();
  }
}

export const config = {
  matcher: "/:path*",
};
