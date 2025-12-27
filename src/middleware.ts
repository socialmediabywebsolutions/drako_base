// src/middleware.ts
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { env } from "@/lib/cf";
import { resolveHostToSaas } from "@/lib/empire/host-resolver";
import { recordCampamentoEvent } from "@/lib/empire/events";
import { DEMO_TENANT_ID } from "@/lib/tenants/services";

/**
 * MODO DEV
 * ----------
 * De momento NO bloqueamos ningún request.
 * Más adelante aquí conectaremos Cloudflare Access / Auth real.
 */
function buildHtmlResponse(message: string, status = 200) {
  return new Response(
    `<!doctype html><html lang="es"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/><title>Campamento Base</title></head><body style="font-family:system-ui, -apple-system, sans-serif; padding:40px; color:#0f172a; background:#f8fafc;"><h1 style="font-size:24px; margin-bottom:12px;">Campamento Base</h1><p style="font-size:16px; line-height:1.5; max-width:640px;">${message}</p></body></html>`,
    { status, headers: { "content-type": "text/html; charset=utf-8" } },
  );
}

function resolveRoutingSampleRate(): number {
  const raw =
    (env() as unknown as Record<string, string | undefined> | null)?.DRACO_ROUTING_EVENTS_SAMPLE_RATE ??
    process.env.DRACO_ROUTING_EVENTS_SAMPLE_RATE ??
    "0.05";
  const parsed = Number.parseFloat(raw);
  if (Number.isNaN(parsed) || parsed <= 0) return 0;
  return Math.min(parsed, 1);
}

export async function middleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname;
  if (pathname.startsWith("/_next") || pathname.startsWith("/api") || pathname === "/favicon.ico") {
    return NextResponse.next();
  }

  const host = (req.headers.get("host") ?? "").toLowerCase();
  const isPublicHost = host === "drako.systems" || host === "www.drako.systems";
  const isAdminHost =
    host === "base.drako.systems" ||
    host === "admin.drako.systems" ||
    host === "drako-base-3.pages.dev";

  // Host-based routing split: public vs Campamento Base
  if (isPublicHost) {
    if (pathname === "/") {
      const url = new URL(req.url);
      url.pathname = "/site";
      return NextResponse.redirect(url);
    }
    if (pathname.startsWith("/admin")) {
      const url = new URL(req.url);
      url.pathname = "/site";
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  if (isAdminHost) {
    if (pathname === "/") {
      const url = new URL(req.url);
      url.pathname = "/admin";
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  const bindings = env();
  const hasDb = Boolean(bindings?.DRACO_DB);
  if (!bindings || !hasDb) {
    return NextResponse.next();
  }

  const resolution = await resolveHostToSaas(host);
  const tenantId = resolution.tenantId ?? DEMO_TENANT_ID;
  const correlationId = resolution.correlationId;
  const metadata = {
    host: resolution.normalizedHost,
    status: resolution.status,
    wasWww: resolution.wasWww,
    reason: resolution.reason ?? null,
  };

  try {
    const resolveType =
      resolution.status === "ACTIVE"
        ? "routing.resolve.success"
        : resolution.status === "NOT_FOUND"
          ? "routing.resolve.miss"
          : resolution.reason === "DOMAIN_ERROR"
            ? "routing.resolve.error"
            : "routing.resolve.pending";
    const severity =
      resolution.status === "ACTIVE" ? "INFO" : resolution.reason === "DOMAIN_ERROR" ? "ERROR" : "WARNING";

    const sampleRate = resolveRoutingSampleRate();
    const shouldLog =
      resolution.status !== "ACTIVE" ||
      (sampleRate > 0 && Math.random() <= sampleRate);
    if (shouldLog) {
      await recordCampamentoEvent({
        tenantId,
        saasId: resolution.saasId ?? null,
        type: resolveType,
        severity,
        source: "ROUTER",
        message:
          resolution.status === "ACTIVE"
            ? `Resolved host ${resolution.normalizedHost} to saas_id=${resolution.saasId ?? "unknown"}.`
            : `Routing status ${resolution.status} for host ${resolution.normalizedHost}.`,
        metadata: { ...metadata, sampleRate },
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
    return NextResponse.next({ request: { headers } });
  }

  if (resolution.status === "PENDING") {
    return buildHtmlResponse("Dominio en verificacion. Campamento Base esta validando la configuracion.");
  }
  if (resolution.status === "PAUSED") {
    return buildHtmlResponse("Este SaaS esta pausado por el owner. Vuelve mas tarde.");
  }
  return buildHtmlResponse("SaaS no registrado para este dominio. Revisa el DNS o crea el mapping en Campamento Base.");
}

// Ejecutar en todas las rutas
export const config = {
  matcher: "/:path*",
};
