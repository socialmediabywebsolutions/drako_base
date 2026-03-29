import { resolveAuthsContextFromRequest } from "@/lib/auths/contexts";
import { normalizeHost } from "@/lib/hosts";

const ALLOWED_AUTH_HOSTS = new Set([
  "drako.systems",
  "drakos.drako.systems",
  "mentoria.drako.systems",
  "mentorias.drako.systems",
  "socialflow.drako.systems",
  "base.drako.systems",
  "bases.drako.systems",
  "admin.drako.systems",
]);

function isAllowedAuthHost(host: string): boolean {
  if (ALLOWED_AUTH_HOSTS.has(host)) return true;
  if (host === "localhost" || host === "127.0.0.1") return true;
  if (host.endsWith(".localhost")) return true;
  return false;
}

function getCanonicalOriginForContext(context: "drakos" | "mentorias" | "socialflow" | "bases"): string {
  if (context === "mentorias") return "https://mentorias.drako.systems";
  if (context === "socialflow") return "https://socialflow.drako.systems";
  if (context === "bases") return "https://bases.drako.systems";
  return "https://drako.systems";
}

export function resolveAuthOriginFromRequest(request: Request): string {
  const forwardedHost = request.headers.get("x-forwarded-host");
  const host = request.headers.get("host");
  const effectiveHost = request.headers.get("x-drako-effective-host");
  const normalizedHost = normalizeHost(effectiveHost || forwardedHost || host || "");
  const forwardedProto = request.headers.get("x-forwarded-proto")?.trim();

  if (normalizedHost && isAllowedAuthHost(normalizedHost)) {
    const proto = forwardedProto === "http" || forwardedProto === "https" ? forwardedProto : "https";
    return `${proto}://${normalizedHost}`;
  }

  const context = resolveAuthsContextFromRequest(request);
  return getCanonicalOriginForContext(context);
}
