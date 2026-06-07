import { getCloudflareContextSafeSync } from "@/lib/cloudflare/runtime";
import type { InternalApiError } from "@/lib/capabilities/internal-api-types/socialflow";

type AuthFailure = {
  ok: false;
  status: 400 | 401 | 403;
  error: InternalApiError;
};

type AuthSuccess = {
  ok: true;
  requestId: string;
  tenantId: string | null;
};

export type InternalServiceTokenAuthResult = AuthFailure | AuthSuccess;

type ServiceTokenSource = {
  token: string | null;
};

function resolveCloudflareServiceToken(): ServiceTokenSource {
  const context = getCloudflareContextSafeSync() as { env?: Record<string, unknown> } | null;
  const env = context?.env;

  if (!env) {
    return { token: null };
  }

  const fromBinding =
    (typeof env.SOCIALFLOW_INTERNAL_SERVICE_TOKEN === "string" && env.SOCIALFLOW_INTERNAL_SERVICE_TOKEN)
    || (typeof env.INTERNAL_SERVICE_TOKEN === "string" && env.INTERNAL_SERVICE_TOKEN)
    || (typeof env.INTERNAL_API_SERVICE_TOKEN === "string" && env.INTERNAL_API_SERVICE_TOKEN)
    || null;

  return { token: fromBinding };
}

function resolveExpectedServiceToken(): string | null {
  const cloudflareToken = resolveCloudflareServiceToken().token;
  if (cloudflareToken) {
    return cloudflareToken;
  }

  const envToken =
    process.env.SOCIALFLOW_INTERNAL_SERVICE_TOKEN
    || process.env.INTERNAL_SERVICE_TOKEN
    || process.env.INTERNAL_API_SERVICE_TOKEN
    || null;

  if (envToken) {
    return envToken;
  }

  if (process.env.NODE_ENV === "test") {
    return process.env.SOCIALFLOW_INTERNAL_SERVICE_TOKEN_TEST
      || process.env.DRAKO_TEST_SERVICE_TOKEN
      || null;
  }

  return null;
}

function getBearerToken(headerValue: string | null): string | null {
  if (!headerValue) {
    return null;
  }

  const [scheme, token] = headerValue.split(" ");
  if (scheme !== "Bearer" || !token) {
    return null;
  }

  return token;
}

function buildError(
  status: 400 | 401 | 403,
  code: InternalApiError["code"],
  message: string,
  requestId?: string,
): AuthFailure {
  return {
    ok: false,
    status,
    error: {
      code,
      message,
      ...(requestId ? { requestId } : {}),
    },
  };
}

export function validateInternalServiceTokenRequest(request: Request): InternalServiceTokenAuthResult {
  const requestId = request.headers.get("X-Drako-Request-Id")?.trim();
  if (!requestId) {
    return buildError(400, "INTERNAL_API_BAD_REQUEST", "X-Drako-Request-Id is required");
  }

  const controlPlane = request.headers.get("X-Drako-Control-Plane")?.trim();
  if (controlPlane !== "campobase") {
    return buildError(403, "INTERNAL_API_FORBIDDEN", "X-Drako-Control-Plane must be campobase", requestId);
  }

  const bearerToken = getBearerToken(request.headers.get("Authorization"));
  if (!bearerToken) {
    return buildError(401, "INTERNAL_API_UNAUTHORIZED", "Authorization bearer token is required", requestId);
  }

  const expectedToken = resolveExpectedServiceToken();
  if (!expectedToken || bearerToken !== expectedToken) {
    return buildError(403, "INTERNAL_API_FORBIDDEN", "Invalid service token", requestId);
  }

  const tenantId = request.headers.get("X-Drako-Tenant-Id")?.trim() || null;

  return {
    ok: true,
    requestId,
    tenantId,
  };
}
