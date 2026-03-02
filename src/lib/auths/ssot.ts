import { resolveAuthsContextFromRequest } from "@/lib/auths/contexts";
import { jsonError } from "@/lib/auths/http";
import type { AuthsContext } from "@/lib/auths/types";

const SAAS_SLUG_BY_CONTEXT: Record<AuthsContext, "drako" | "mentorias" | "campo_base"> = {
  drakos: "drako",
  mentorias: "mentorias",
  bases: "campo_base",
};

export function resolveSaasSlugForAuthContext(context: AuthsContext): "drako" | "mentorias" | "campo_base" {
  return SAAS_SLUG_BY_CONTEXT[context];
}

export function enforceAuthBoundary(params: {
  request: Request;
  expectedContext: AuthsContext;
  endpoint: string;
}) {
  const actualContext = resolveAuthsContextFromRequest(params.request);
  if (actualContext === params.expectedContext) {
    return { ok: true as const, context: actualContext };
  }

  const host =
    params.request.headers.get("x-drako-effective-host") ||
    params.request.headers.get("x-forwarded-host") ||
    params.request.headers.get("host") ||
    "unknown";

  console.error("AUTH_BOUNDARY_VIOLATION", {
    endpoint: params.endpoint,
    expectedContext: params.expectedContext,
    actualContext,
    host,
  });

  return {
    ok: false as const,
    context: actualContext,
    response: jsonError("HOST_CONTEXT_MISMATCH", `Invalid host for ${params.expectedContext} auth boundary.`, 403),
  };
}
