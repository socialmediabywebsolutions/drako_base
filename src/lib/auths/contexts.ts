import { normalizeHost } from "@/lib/hosts";
import type { AuthsContext } from "@/lib/auths/types";
import {
  isTenantWorkspaceApiPath,
  isTenantWorkspacePath,
} from "@/lib/platform/surfaces";

/**
 * Canonical host-based auth context resolution.
 *
 * This is part of the minimum auth/tenant isolation contract.
 */
export function resolveAuthsContextFromHost(hostname: string | null | undefined): AuthsContext {
  const host = normalizeHost(hostname ?? "");
  if (!host) return "drakos";
  if (host === "base.drako.systems" || host === "bases.drako.systems" || host === "admin.drako.systems") return "bases";
  if (
    host === "mentoria.drako.systems" ||
    host === "mentorias.drako.systems" ||
    host.startsWith("mentoria.") ||
    host.startsWith("mentorias.")
  ) {
    return "mentorias";
  }
  if (
    host === "socialflow.drako.systems"
    || host.startsWith("socialflow.")
    || host.includes("socialflow")
  ) {
    return "socialflow";
  }
  return "drakos";
}

/**
 * Canonical path-based auth context resolution for known auth surfaces.
 *
 * This is part of the minimum auth/tenant isolation contract.
 */
export function resolveAuthsContextFromPath(pathname: string): AuthsContext | null {
  if (pathname.startsWith("/api/drakos/auths")) return "drakos";
  if (pathname.startsWith("/api/mentorias/auths")) return "mentorias";
  if (pathname.startsWith("/api/socialflow/auths")) return "socialflow";
  if (pathname.startsWith("/api/bases")) return "bases";
  if (pathname.startsWith("/drakos/auths")) return "drakos";
  if (pathname.startsWith("/mentorias/auths")) return "mentorias";
  if (pathname.startsWith("/socialflow/auth")) return "socialflow";
  if (pathname.startsWith("/bases/")) return "bases";
  return null;
}

type CanonicalAuthsRequestSignals = {
  effectiveHost: string | null;
  forwardedHost: string | null;
  host: string | null;
  pathname: string;
};

function resolveCanonicalAuthsContextFromSignals(signals: CanonicalAuthsRequestSignals): AuthsContext {
  const hostContext = resolveAuthsContextFromHost(signals.effectiveHost || signals.forwardedHost || signals.host);
  const pathContext = resolveAuthsContextFromPath(signals.pathname);
  if (pathContext) return pathContext;

  if (isTenantWorkspacePath(signals.pathname) || isTenantWorkspaceApiPath(signals.pathname)) {
    if (hostContext === "mentorias") return "mentorias";
    if (hostContext === "socialflow") return "socialflow";
    if (hostContext === "bases") return "bases";
    return "drakos";
  }

  return hostContext;
}

function resolveCompatLocalOverrideHost(url: URL): string | null {
  const localOverrideHost = url.searchParams.get("__drako_host");
  return localOverrideHost?.trim() || null;
}

/**
 * Canonical request-level auth context resolution.
 *
 * Official signals:
 * - x-drako-effective-host
 * - x-forwarded-host
 * - host
 * - pathname for known auth surfaces
 *
 * Compatibility note:
 * - __drako_host remains supported for local development compatibility, but it
 *   is not part of the minimum canonized contract.
 */
export function resolveAuthsContextFromRequest(request: Request): AuthsContext {
  const effectiveHost = request.headers.get("x-drako-effective-host");
  const saasSlugHeader = (request.headers.get("x-drako-saas-slug") || "").trim().toLowerCase();
  const forwardedHost = request.headers.get("x-forwarded-host");
  const host = request.headers.get("host");
  try {
    const url = new URL(request.url);
    const pathname = url.pathname || "/";
    const localOverrideHost = resolveCompatLocalOverrideHost(url);

    // Prefer explicit SaaS slug header when available (set by middleware after host resolution)
    if (saasSlugHeader === "mentorias") return "mentorias";
    if (saasSlugHeader === "socialflow") return "socialflow";
    if (saasSlugHeader === "campo_base" || saasSlugHeader === "bases") return "bases";
    return resolveCanonicalAuthsContextFromSignals({
      effectiveHost: localOverrideHost || effectiveHost,
      forwardedHost,
      host,
      pathname,
    });
  } catch {
    return resolveCanonicalAuthsContextFromSignals({
      effectiveHost,
      forwardedHost,
      host,
      pathname: "/",
    });
  }
}

/**
 * Legacy compatibility helper.
 *
 * This helper is intentionally outside the minimum canonized contract and
 * should not be used as the reference auth context resolver for new code.
 */
export function resolveLegacyAuthsContext(request: Request): AuthsContext {
  const fromHost = resolveAuthsContextFromRequest(request);
  if (fromHost !== "drakos") return fromHost;
  const referer = request.headers.get("referer")?.toLowerCase() ?? "";
  if (referer.includes("/site/mentoria") || referer.includes("/mentorias/")) {
    return "mentorias";
  }
  return "drakos";
}

/**
 * Canonical login path by auth context.
 *
 * This is part of the minimum auth/tenant isolation contract.
 */
export function resolveAuthsLoginPath(context: AuthsContext): string {
  if (context === "mentorias") return "/mentorias/auths/logins";
  if (context === "socialflow") return "/socialflow/auth";
  if (context === "bases") return "/bases/login";
  return "/drakos/auths/logins";
}
