import { jsonError } from "@/lib/socialflow/platform/auth/http";

// Equivalente de enforceAuthBoundary (src/lib/auths/ssot.ts) para los endpoints de auth
// de SocialCors. Reproduce la decisión de resolveAuthsContextFromRequest
// (src/lib/auths/contexts.ts) reducida a "¿es contexto socialflow?":
//   1. cabecera x-drako-saas-slug (el middleware de SocialCors la elimina si viene del cliente)
//   2. ruta de auth conocida
//   3. host (también cubre las rutas de workspace, que en el original resuelven por host)

const AUTH_PATH_CONTEXTS: Array<[prefix: string, context: string]> = [
  ["/api/drakos/auths", "drakos"],
  ["/api/mentorias/auths", "mentorias"],
  ["/api/socialflow/auths", "socialflow"],
  ["/api/bases", "bases"],
  ["/drakos/auths", "drakos"],
  ["/mentorias/auths", "mentorias"],
  ["/socialflow/auth", "socialflow"],
  ["/bases/", "bases"],
];

function normalizeHost(value: string): string {
  const raw = value.split(",")[0]?.trim().toLowerCase() ?? "";
  const host = raw.split(":")[0] ?? "";
  return host.startsWith("www.") ? host.slice(4) : host;
}

function resolveContextFromHost(hostname: string | null | undefined): string {
  const host = normalizeHost(hostname ?? "");
  if (!host) return "drakos";
  if (host === "base.drako.systems" || host === "bases.drako.systems" || host === "admin.drako.systems") return "bases";
  if (host === "mentoria.drako.systems" || host === "mentorias.drako.systems" || host.startsWith("mentoria.") || host.startsWith("mentorias.")) {
    return "mentorias";
  }
  if (host === "socialflow.drako.systems" || host.startsWith("socialflow.") || host.includes("socialflow")) return "socialflow";
  return "drakos";
}

export function resolveRequestAuthContext(request: Request): string {
  const saasSlug = (request.headers.get("x-drako-saas-slug") || "").trim().toLowerCase();
  if (saasSlug === "mentorias") return "mentorias";
  if (saasSlug === "socialflow") return "socialflow";
  if (saasSlug === "campo_base" || saasSlug === "bases") return "bases";

  let pathname = "/";
  let localOverrideHost: string | null = null;
  try {
    const url = new URL(request.url);
    pathname = url.pathname || "/";
    localOverrideHost = url.searchParams.get("__drako_host")?.trim() || null;
  } catch {
    /* sin URL válida: solo cuenta el host */
  }

  const pathContext = AUTH_PATH_CONTEXTS.find(([prefix]) => pathname.startsWith(prefix))?.[1];
  if (pathContext) return pathContext;

  return resolveContextFromHost(
    localOverrideHost
      || request.headers.get("x-drako-effective-host")
      || request.headers.get("x-forwarded-host")
      || request.headers.get("host"),
  );
}

export function enforceSocialFlowAuthBoundary(params: { request: Request; endpoint: string }) {
  const actualContext = resolveRequestAuthContext(params.request);
  if (actualContext === "socialflow") {
    return { ok: true as const, context: "socialflow" as const };
  }

  console.error("AUTH_BOUNDARY_VIOLATION", {
    endpoint: params.endpoint,
    expectedContext: "socialflow",
    actualContext,
    host:
      params.request.headers.get("x-drako-effective-host")
      || params.request.headers.get("x-forwarded-host")
      || params.request.headers.get("host")
      || "unknown",
  });

  return {
    ok: false as const,
    context: actualContext,
    response: jsonError("HOST_CONTEXT_MISMATCH", "Invalid host for socialflow auth boundary.", 403),
  };
}
