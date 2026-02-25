import { normalizeHost } from "@/lib/hosts";
import type { AuthsContext } from "@/lib/auths/types";

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
  return "drakos";
}

export function resolveAuthsContextFromRequest(request: Request): AuthsContext {
  const effectiveHost = request.headers.get("x-drako-effective-host");
  const forwardedHost = request.headers.get("x-forwarded-host");
  const host = request.headers.get("host");
  try {
    const url = new URL(request.url);
    const localOverrideHost = url.searchParams.get("__drako_host");
    return resolveAuthsContextFromHost(localOverrideHost || effectiveHost || forwardedHost || host);
  } catch {
    return resolveAuthsContextFromHost(effectiveHost || forwardedHost || host);
  }
}

export function resolveLegacyAuthsContext(request: Request): AuthsContext {
  const fromHost = resolveAuthsContextFromRequest(request);
  if (fromHost !== "drakos") return fromHost;
  const referer = request.headers.get("referer")?.toLowerCase() ?? "";
  if (referer.includes("/site/mentoria") || referer.includes("/mentorias/")) {
    return "mentorias";
  }
  return "drakos";
}

export function resolveAuthsContextFromPath(pathname: string): AuthsContext | null {
  if (pathname.startsWith("/api/drakos/auths")) return "drakos";
  if (pathname.startsWith("/api/mentorias/auths")) return "mentorias";
  if (pathname.startsWith("/api/bases")) return "bases";
  return null;
}

export function resolveAuthsLoginPath(context: AuthsContext): string {
  if (context === "mentorias") return "/mentorias/auths/logins";
  if (context === "bases") return "/auth/login";
  return "/drakos/auths/logins";
}
