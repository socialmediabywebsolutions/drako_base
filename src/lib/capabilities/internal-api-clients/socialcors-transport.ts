import { getCloudflareContextSafeSync } from "@/lib/cloudflare/runtime";

/**
 * Transporte del holding hacia el contrato interno de SocialCors (P6).
 *
 * Preferencia:
 * 1. fetchImpl explícito (tests).
 * 2. Service binding SOCIALCORS_INTERNAL (saas-drakos-prod → saas-socialflows-prod): la
 *    petición no pasa por la red pública ni por el WAF/Bot Fight Mode, que bloquea en
 *    silencio el tráfico Worker→dominio propio (mismo motivo que el binding SELF del cron).
 * 3. fetch global contra la base URL configurada (SOCIALFLOW_INTERNAL_API_BASE_URL…).
 */

export const SOCIALCORS_DEFAULT_INTERNAL_ORIGIN = "https://socialflows.drako.systems";

type FetchLike = typeof fetch;
type ServiceBinding = { fetch: FetchLike };

export type SocialCorsTransport = {
  baseUrl: string;
  fetchImpl: FetchLike;
  via: "explicit" | "service_binding" | "base_url";
};

function resolveServiceBinding(): ServiceBinding | null {
  const context = getCloudflareContextSafeSync() as { env?: Record<string, unknown> } | null;
  const binding = context?.env?.SOCIALCORS_INTERNAL as ServiceBinding | undefined;
  return binding && typeof binding.fetch === "function" ? binding : null;
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/$/, "");
}

export function resolveSocialCorsTransport(input: {
  baseUrl?: string;
  fetchImpl?: FetchLike;
  resolveFallbackBaseUrl: (input?: string) => string;
}): SocialCorsTransport {
  if (input.fetchImpl) {
    return { baseUrl: input.resolveFallbackBaseUrl(input.baseUrl), fetchImpl: input.fetchImpl, via: "explicit" };
  }

  const binding = resolveServiceBinding();
  if (binding) {
    // Con service binding el host solo sirve para el enrutado de Next dentro de SocialCors.
    const baseUrl = input.baseUrl?.trim()
      || process.env.SOCIALFLOW_INTERNAL_API_BASE_URL?.trim()
      || SOCIALCORS_DEFAULT_INTERNAL_ORIGIN;
    return {
      baseUrl: trimTrailingSlash(baseUrl),
      fetchImpl: ((url, init) => binding.fetch(url, init)) as FetchLike,
      via: "service_binding",
    };
  }

  return { baseUrl: input.resolveFallbackBaseUrl(input.baseUrl), fetchImpl: fetch, via: "base_url" };
}
