import { resolveAuthsContextFromPath, resolveAuthsContextFromRequest } from "@/lib/auths/contexts";
import { jsonError } from "@/lib/auths/http";
import type { AuthsContext, AuthsSaasSlug } from "@/lib/auths/types";

/**
 * Canonical auth boundary violation code for endpoint/context mismatches.
 */
export const AUTHS_BOUNDARY_MISMATCH_CODE = "HOST_CONTEXT_MISMATCH";

/**
 * Canonical SaaS slug mapping for auth contexts.
 *
 * This belongs to the minimum auth/tenant isolation contract.
 */
const SAAS_SLUG_BY_CONTEXT: Record<AuthsContext, AuthsSaasSlug> = {
  drakos: "drako",
  mentorias: "mentorias",
  socialflow: "socialflow",
  bases: "campo_base",
};

/**
 * Canonical SaaS slug lookup by auth context.
 */
export function resolveSaasSlugForAuthContext(context: AuthsContext): AuthsSaasSlug {
  return SAAS_SLUG_BY_CONTEXT[context];
}

/**
 * Canonical expected auth context lookup for known auth endpoints.
 *
 * Unknown endpoints intentionally return null instead of guessing.
 */
export function resolveExpectedAuthsContextForEndpoint(endpoint: string): AuthsContext | null {
  return resolveAuthsContextFromPath(endpoint);
}

export type AuthBoundaryValidation =
  | {
      ok: true;
      expectedContext: AuthsContext;
      actualContext: AuthsContext;
      host: string;
    }
  | {
      ok: false;
      expectedContext: AuthsContext;
      actualContext: AuthsContext;
      host: string;
      code: typeof AUTHS_BOUNDARY_MISMATCH_CODE;
    };

function resolveAuthBoundaryHost(request: Request): string {
  return (
    request.headers.get("x-drako-effective-host") ||
    request.headers.get("x-forwarded-host") ||
    request.headers.get("host") ||
    "unknown"
  );
}

/**
 * Canonical boundary validation between endpoint expectation and resolved
 * request auth context.
 *
 * This is the minimum reusable contract for host/path/context enforcement.
 * Runtime-specific response shaping stays outside this pure validation layer.
 */
export function validateAuthBoundary(params: {
  request: Request;
  expectedContext: AuthsContext;
}): AuthBoundaryValidation {
  const actualContext = resolveAuthsContextFromRequest(params.request);
  const host = resolveAuthBoundaryHost(params.request);
  if (actualContext === params.expectedContext) {
    return {
      ok: true,
      expectedContext: params.expectedContext,
      actualContext,
      host,
    };
  }
  return {
    ok: false,
    expectedContext: params.expectedContext,
    actualContext,
    host,
    code: AUTHS_BOUNDARY_MISMATCH_CODE,
  };
}

/**
 * Compatibility wrapper for current endpoint routes.
 *
 * This helper remains the current HTTP-facing API, but the canonized minimum
 * contract lives in resolveExpectedAuthsContextForEndpoint(...) and
 * validateAuthBoundary(...).
 */
export function enforceAuthBoundary(params: {
  request: Request;
  expectedContext: AuthsContext;
  endpoint: string;
}) {
  const validation = validateAuthBoundary({
    request: params.request,
    expectedContext: params.expectedContext,
  });
  if (validation.ok) {
    return { ok: true as const, context: validation.actualContext };
  }

  console.error("AUTH_BOUNDARY_VIOLATION", {
    endpoint: params.endpoint,
    expectedContext: validation.expectedContext,
    actualContext: validation.actualContext,
    host: validation.host,
  });

  return {
    ok: false as const,
    context: validation.actualContext,
    response: jsonError(
      validation.code,
      `Invalid host for ${validation.expectedContext} auth boundary.`,
      403,
    ),
  };
}
