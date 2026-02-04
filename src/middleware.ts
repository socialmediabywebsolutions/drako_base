// src/middleware.ts
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { env } from "@/lib/cf";
import { resolveHostToSaas } from "@/lib/empire/host-resolver";
import { recordCampamentoEvent } from "@/lib/empire/events";
import { DEMO_TENANT_ID } from "@/lib/tenants/services";
import { resolveEffectiveHost, resolveHostMode } from "@/lib/hosts";

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

    // Skip Next.js internal routes
    if (pathname.startsWith("/_next") || pathname === "/favicon.ico") {
      return NextResponse.next();
    }

    // ✅ AUTH CHECK: Protect /site/panel routes
    if (pathname.startsWith("/site/panel")) {
      const token = req.cookies.get("next-auth.session-token") || req.cookies.get("__Secure-next-auth.session-token");

      if (!token) {
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
      return NextResponse.next({ request: { headers } });
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
      "/agentes",
      "/departments",
      "/departamentos",
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
      contextHeaders.delete("x-drako-tenant-id");
      contextHeaders.delete("x-tenant-id");
      contextHeaders.delete("x-drako-saas-id");
      contextHeaders.delete("x-drako-saas-slug");
      contextHeaders.delete("x-drako-correlation-id");

      const correlationId = globalThis.crypto?.randomUUID?.() ?? `corr_${Date.now()}`;
      contextHeaders.set("x-drako-host-mode", hostMode);
      contextHeaders.set("x-drako-effective-host", host);
      contextHeaders.set("x-drako-pages-environment", pagesEnvironmentHeader);

      if (!bindings || !hasDb) {
        contextHeaders.set("x-drako-correlation-id", correlationId);
        return persistCookie(NextResponse.next({ request: { headers: contextHeaders } }));
      }

      const resolutionHost = isPagesDevHost ? "drako.systems" : host;

      // OLIMPO: Wrap host resolution in try/catch
      let resolution;
      try {
        resolution = await resolveHostToSaas(resolutionHost);
      } catch (error) {
        console.error("HOST_RESOLUTION_FAILED", error);
        contextHeaders.set("x-drako-correlation-id", correlationId);
        return persistCookie(NextResponse.next({ request: { headers: contextHeaders } }));
      }

      if (resolution.status === "ACTIVE") {
        if (resolution.tenantId) {
          contextHeaders.set("x-drako-tenant-id", resolution.tenantId);
          contextHeaders.set("x-tenant-id", resolution.tenantId);
        }
        if (resolution.saasId) {
          contextHeaders.set("x-drako-saas-id", resolution.saasId);
          contextHeaders.set("x-drako-saas-slug", resolution.saasSlug ?? "");
        }
      }
      contextHeaders.set("x-drako-correlation-id", resolution.correlationId ?? correlationId);
      return persistCookie(NextResponse.next({ request: { headers: contextHeaders } }));
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
      if (pathname === "/" || adminPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) {
        const url = new URL(req.url);
        url.pathname = "/site";
        return persistCookie(NextResponse.rewrite(url, { request: { headers: responseHeaders } }));
      }
      return persistCookie(NextResponse.next({ request: { headers: responseHeaders } }));
    }

    if (isAdminHost) {
      if (pathname === "/") {
        const url = new URL(req.url);
        url.pathname = "/admin";
        return persistCookie(NextResponse.rewrite(url, { request: { headers: responseHeaders } }));
      }
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
      resolution = await resolveHostToSaas(host);
    } catch (error) {
      console.error("HOST_RESOLUTION_FAILED", error);
      return persistCookie(NextResponse.next());
    }

    const tenantId = resolution.tenantId ?? DEMO_TENANT_ID;
    const correlationId = resolution.correlationId;
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
          correlationId,
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
          correlationId,
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
      headers.set("x-drako-correlation-id", correlationId);
      headers.set("x-drako-domain-status", resolution.status);
      return persistCookie(NextResponse.next({ request: { headers } }));
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
