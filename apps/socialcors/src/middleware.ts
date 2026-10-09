import { NextResponse, type NextRequest } from "next/server";
import {
  CORRELATION_HEADER,
  generateCorrelationId,
  isValidCorrelationId,
  normalizeCorrelationId,
} from "@/lib/correlation";

/**
 * Middleware propio de SocialCors (P3).
 *
 * Paridad con lo que src/middleware.ts del monolito aplica a los hosts de
 * SocialCors (socialflows.drako.systems, socialflow.drako.systems, socialcors.com):
 * - "/" → landing /socialflows (rewrite)
 * - redirecciones legacy /dashboard → /socialflow, /profile/setup → /socialflow/setup,
 *   /site/panel → /socialflow
 * - cabecera de correlación x-drako-correlation-id
 *
 * La identidad del tenant sale SIEMPRE de la sesión firmada
 * (__Host-socialflow_session); nunca de cabeceras. Por eso se eliminan las
 * cabeceras de contexto que un cliente podría enviar, y x-drako-effective-host se
 * fija desde Host. No se resuelve el host contra DRACO_DB ni se aplica rate-limit
 * (en este Worker ya era fail-open por falta de SCHEDULER).
 */

const SPOOFABLE_CONTEXT_HEADERS = [
  "x-drako-tenant-id",
  "x-tenant-id",
  "x-drako-saas-id",
  "x-drako-saas-slug",
  "x-drako-client-entry-mode",
  "x-drako-client-workspace-kind",
  "x-drako-effective-host",
  "x-drako-host-mode",
] as const;

function resolveLegacyRedirect(pathname: string): string | null {
  if (pathname === "/dashboard" || pathname.startsWith("/dashboard/")) {
    return pathname.replace(/^\/dashboard/, "/socialflow");
  }
  if (pathname === "/profile/setup" || pathname.startsWith("/profile/setup/")) {
    return pathname.replace(/^\/profile\/setup/, "/socialflow/setup");
  }
  if (pathname === "/site/panel" || pathname.startsWith("/site/panel/")) {
    return "/socialflow";
  }
  return null;
}

function resolveCorrelationId(req: NextRequest): string {
  const incoming = req.headers.get(CORRELATION_HEADER);
  return isValidCorrelationId(incoming) ? normalizeCorrelationId(incoming) : generateCorrelationId();
}

export function middleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname;
  const isApi = pathname.startsWith("/api");
  const correlationId = resolveCorrelationId(req);

  if (!isApi) {
    const legacyRedirect = resolveLegacyRedirect(pathname);
    if (legacyRedirect) {
      return NextResponse.redirect(new URL(legacyRedirect, req.url), 308);
    }
  }

  const requestHeaders = new Headers(req.headers);
  for (const header of SPOOFABLE_CONTEXT_HEADERS) requestHeaders.delete(header);
  const host = (req.headers.get("host") ?? "").trim().toLowerCase().split(":")[0] ?? "";
  if (host) requestHeaders.set("x-drako-effective-host", host);
  requestHeaders.set(CORRELATION_HEADER, correlationId);

  let response: NextResponse;
  if (!isApi && pathname === "/") {
    const url = req.nextUrl.clone();
    url.pathname = "/socialflows";
    response = NextResponse.rewrite(url, { request: { headers: requestHeaders } });
  } else {
    response = NextResponse.next({ request: { headers: requestHeaders } });
  }

  response.headers.set(CORRELATION_HEADER, correlationId);
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
