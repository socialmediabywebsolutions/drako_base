// src/middleware.ts
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { env } from "@/lib/cf";
import { resolveHostToSaas } from "@/lib/empire/host-resolver";
import { recordCampamentoEvent } from "@/lib/empire/events";
import { DEMO_TENANT_ID } from "@/lib/tenants/services";
import { resolveEffectiveHost, resolveHostMode } from "@/lib/hosts";
import {
  CORRELATION_HEADER,
  TENANT_HEADER,
  SAAS_HEADER,
  generateCorrelationId,
  isValidCorrelationId,
  normalizeCorrelationId,
  shouldBypassCorrelation
} from "@/lib/correlation";
import { checkTenantRateLimit } from "@/lib/security/tenant-rate-limit";
import { extractSessionFromRequest } from "@/lib/edge-auth";


/**
 * MODO DEV
 * ----------
 * De momento NO bloqueamos ningún request.
 * Más adelante aquí conectaremos Cloudflare Access / Auth real.
 */
function buildHtmlResponse(message: string, status = 200, extra?: string) {
  return new NextResponse(
    `<!doctype html><html lang="es"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/><title>Campamento Base</title><style>body{font-family:system-ui,-apple-system,sans-serif;padding:40px;color:#0f172a;background:#f8fafc;}a.button{display:inline-block;margin-right:12px;margin-top:12px;padding:10px 14px;border-radius:999px;border:1px solid #0f172a;text-decoration:none;color:#0f172a;font-weight:600;}small{color:#475569;display:block;margin-top:12px}</style></head><body><h1 style="font-size:24px; margin-bottom:12px;">Campamento Base</h1><p style="font-size:16px; line-height:1.5; max-width:720px;">${message}</p>${extra ?? ""}</body></html>`,
    { status, headers: { "content-type": "text/html; charset=utf-8" } },
  );
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
  // Helper function for sample rate
  function resolveRoutingSampleRate(): number {
    const requestBindings = env();
    const raw = (requestBindings as unknown as Record<string, string | undefined> | null)?.DRACO_ROUTING_EVENTS_SAMPLE_RATE ?? "0.05";
    const parsed = Number.parseFloat(raw);
    if (Number.isNaN(parsed) || parsed <= 0) return 0;
    return Math.min(parsed, 1);
  }

  try {
    const pathname = req.nextUrl.pathname;
    const isApi = pathname.startsWith("/api");

    // 🔍 DRAKO STEEL v1.0.1: Correlation Identification
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

    // ✅ AUTH CHECK: Protect /site/panel routes (FAIL-CLOSED)
    if (pathname.startsWith("/site/panel")) {
      const session = await extractSessionFromRequest(req);

      if (!session) {
        // FAIL-CLOSED: No session → login
        const url = new URL("/auth/login", req.url);
        url.searchParams.set("callbackUrl", pathname);
        return NextResponse.redirect(url);
      }

      // 🛡️ ROLE CHECK: Only Owner/Superadmin/Staff can access Panel
      const role = session.role?.toLowerCase();
      if (!role || (role !== 'owner' && role !== 'superadmin' && role !== 'staff')) {
        // Redirect unauthorized tenants to their client portal
        return NextResponse.redirect(new URL("/client", req.url));
      }
    }

    // ✅ AUTH CHECK: Protect /client, /dashboard, /profile, & /site/onboarding routes (FAIL-CLOSED)
    if (
      pathname.startsWith("/client") ||
      pathname.startsWith("/dashboard") ||
      pathname.startsWith("/profile") ||
      pathname.startsWith("/site/onboarding")
    ) {
      const session = await extractSessionFromRequest(req);
      if (!session) {
        // FAIL-CLOSED: No session → login
        const url = new URL("/auth/login", req.url);
        url.searchParams.set("callbackUrl", pathname);
        return NextResponse.redirect(url);
      }
    }

    // OLIMPO: Check if Cloudflare bindings are available
    const requestBindings = env();

    // If no bindings (e.g., Vercel), proceed with minimal headers
    if (!requestBindings) {
      const headers = new Headers(req.headers);
      headers.set("x-drako-host-mode", "MINIMAL");
      headers.set("x-drako-environment", "vercel");
      headers.set(CORRELATION_HEADER, correlationId);
      const res = NextResponse.next({ request: { headers } });
      res.headers.set(CORRELATION_HEADER, correlationId);
      return res;
    }

    const hostInfo = resolveEffectiveHost(req);
    const host = hostInfo.effectiveHost;
    const pagesEnvironment = requestBindings?.CF_PAGES_ENVIRONMENT ?? process.env.CF_PAGES_ENVIRONMENT ?? null;
    const hostMode = resolveHostMode(host, pagesEnvironment);
    const pagesEnvironmentHeader = pagesEnvironment ?? "unknown";
    const isPagesDevHost = hostMode === "PREVIEW";
    const isPublicHost = hostMode === "PUBLIC_SAAS";
    const isAdminHost = hostMode === "CAMPAMENTO_BASE";

    // Rutas admin a proteger en host público
    const adminPrefixes = [
      "/admin",
      "/agents",
      "/departments",
      "/metrics",
      "/alerts",
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

    // Host-based routing split: public vs Campamento Base
    const persistCookie = (res: NextResponse) => {
      if (hostInfo.shouldPersistCookie) {
        res.cookies.set("drako_host", hostInfo.shouldPersistCookie, { path: "/", maxAge: 60 * 60 * 24 * 7 });
      }
      return res;
    };

    if (isApi) {
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

      if (!bindings || !hasDb) {
        contextHeaders.set(CORRELATION_HEADER, correlationId);
        const res = persistCookie(NextResponse.next({ request: { headers: contextHeaders } }));
        res.headers.set(CORRELATION_HEADER, correlationId);
        return res;
      }

      const resolutionHost = isPagesDevHost ? "drako.systems" : host;

      // OLIMPO: Wrap host resolution in try/catch
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

          // 🛡️ DRAKO STEEL v1.5: API HARD WALL (FAIL-CLOSED)
          // For API calls, if session exists, verify tenant isolation
          const session = await extractSessionFromRequest(req);
          if (session && session.tenantId && session.tenantId !== resolution.tenantId) {
            // Only Owner can cross-tenant
            const role = session.role?.toLowerCase();
            if (role !== 'owner' && role !== 'superadmin') {
              return NextResponse.json({ error: "CROSS_TENANT_ACCESS_FORBIDDEN" }, { status: 403 });
            }
          }

          // 🛡️ DRAKO STEEL v1.0.1: Rate Limit Protection
          const rateLimit = await checkTenantRateLimit({
            tenantId: resolution.tenantId,
            saasId: resolution.saasId,
            route: pathname,
            request: req,
            // Plan detection would ideally be cached here
            plan: "FREE",
          });

          if (!rateLimit.allowed) {
            return persistCookie(NextResponse.json({
              error: "RATE_LIMIT_EXCEEDED",
              retry_after: rateLimit.retryAfter,
              correlation_id: correlationId
            }, {
              status: 429,
              headers: {
                [CORRELATION_HEADER]: correlationId,
                "Retry-After": String(rateLimit.retryAfter || 60)
              }
            }));
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
      return res;
    }

    const responseHeaders = new Headers(req.headers);
    responseHeaders.set("x-drako-host-mode", hostMode);
    responseHeaders.set("x-drako-effective-host", host);
    responseHeaders.set("x-drako-pages-environment", pagesEnvironmentHeader);

    if (isPagesDevHost) {
      if (pathname !== "/preview" && !pathname.startsWith("/preview/")) {
        const url = new URL(req.url);
        url.pathname = "/preview";
        return persistCookie(NextResponse.rewrite(url, { request: { headers: responseHeaders } }));
      }
      return persistCookie(NextResponse.next({ request: { headers: responseHeaders } }));
    }

    if (isPublicHost) {
      if (adminPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) {
        // Redirect attempt to access admin via public host
        return persistCookie(NextResponse.redirect(new URL("/", req.url)));
      }
      return persistCookie(NextResponse.next({ request: { headers: responseHeaders } }));
    }

    if (isAdminHost) {
      return persistCookie(NextResponse.next({ request: { headers: responseHeaders } }));
    }

    const bindings = requestBindings;
    const hasDb = Boolean(bindings?.DRACO_DB);
    if (!bindings || !hasDb) {
      return persistCookie(NextResponse.next());
    }

    // OLIMPO: Wrap host resolution in try/catch
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
    const shouldLogActive = resolution.status === "ACTIVE" && sampleRate > 0 && Math.random() <= sampleRate;

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
      // Si D1 no está listo, no bloquear tráfico.
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

      // 🛡️ DRAKO STEEL v1.5: UI HARD WALL (The Great Filter) (FAIL-CLOSED)
      // Check if the current session belongs to this tenant
      const session = await extractSessionFromRequest(req);
      if (session && resolution.tenantId) {
        const userTenantId = session.tenantId;
        const userRole = session.role?.toLowerCase();

        // If user has a tenantId (is a Tenant User) AND it mismatches the resolved host tenant
        // AND user is NOT an Owner/Admin who can impersonate
        if (userTenantId && userTenantId !== resolution.tenantId && userRole !== 'owner' && userRole !== 'superadmin') {
          // HARD LOGOUT / BLOCK (FAIL-CLOSED)
          // We redirect to a specialized 403 page or just logout.
          // Logout is safer to prevent confusion.
          const url = new URL("/auth/error?error=TenantMismatch", req.url);
          return NextResponse.redirect(url);
        }
      }

      // 🦅 DRAKO ORCHESTRATOR: Shielded Client Isolation

      // 1. Block Tenants from /site/panel (Owner Only)
      if (pathname.startsWith("/site/panel")) {
        // If we resolved a Tenant (status ACTIVE), they should NEVER see Admin Panel.
        // Redirect to their Client Shielded Environment.
        const clientRoot = new URL("/client", req.url);
        return NextResponse.redirect(clientRoot);
      }

      // 2. Enforce /client linear flow based on Materialization Step
      if (pathname.startsWith("/client")) {
        const matStep = resolution.materializationStep ?? 0;

        if (matStep === 0 && !pathname.startsWith("/client/setup")) {
          return NextResponse.redirect(new URL("/client/setup", req.url));
        }
        if (matStep === 1 && !pathname.startsWith("/client/analysis")) {
          return NextResponse.redirect(new URL("/client/analysis", req.url));
        }
        // If step >= 2, they can access /client (and subroutes), 
        // but we might want to redirect Setup/Analysis back to /client if accessed directly?
        // For now, let's keep it simple: strict forward blocking.
        if (matStep >= 2 && (pathname === "/client/setup" || pathname === "/client/analysis")) {
          return NextResponse.redirect(new URL("/client", req.url));
        }
      }

      const res = persistCookie(NextResponse.next({ request: { headers } }));
      res.headers.set(CORRELATION_HEADER, finalCorrelationId);
      return res;
    }

    const unknownMessage = "SaaS no registrado para este dominio. Revisa el DNS o crea el mapping en Campamento Base.";
    const unknownExtra = isPagesDevHost
      ? `<a class="button" href="/site">Ir a /site</a><small>Host real: ${hostInfo.realHost} · Host virtual: ${host}</small>`
      : `<a class="button" href="/owner/domains">Ir a /owner/domains (admin)</a><a class="button" href="?__drako_host=drako.systems">Cambiar host (solo local)</a><a class="button" href="/api/owner/domains/repair" data-repair>Repair mapping (DEV)</a><small>Host real: ${hostInfo.realHost} · Host virtual: ${host}</small>`;

    if (resolution.status === "PENDING" || resolution.status === "PAUSED") {
      const reason = resolution.reason ?? (resolution.status === "PAUSED" ? "DOMAIN_PAUSED" : "DOMAIN_BLOCKED");
      const statusCode = reason === "DOMAIN_PENDING_ACTIVATION"
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
    // OLIMPO: GLOBAL CATCH - NEVER let an exception escape
    console.error("MIDDLEWARE_CRITICAL_FAILURE", error);
    // Return NextResponse.next() to allow the request to continue
    return NextResponse.next();
  }
}

// Ejecutar en todas las rutas
export const config = {
  matcher: "/:path*",
};
