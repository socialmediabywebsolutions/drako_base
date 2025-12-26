import { NextResponse } from "next/server";
import { resolveTenantId } from "@/lib/tenants/services";
import { recordCampamentoEvent } from "@/lib/empire/events";
import policy from "@/lib/security/public-endpoints-policy.json";
import { consumeRateLimit, extractClientIp, getPublicRateLimitConfig } from "@/lib/security/rate-limit";
import { env as resolveEnv } from "@/lib/cf";

const PUBLIC_TENANT_ID = "public";

type PublicEndpointPolicy = {
  publicOk: { route: string }[];
  mustAuth: { route: string }[];
};

function getPolicyRoutes() {
  const data = policy as PublicEndpointPolicy;
  return {
    publicOk: new Set(data.publicOk.map((entry) => entry.route)),
    mustAuth: new Set(data.mustAuth.map((entry) => entry.route)),
  };
}

function resolveCorrelationId(request: Request): string {
  return (
    request.headers.get("x-drako-correlation-id") ||
    request.headers.get("x-request-id") ||
    globalThis.crypto?.randomUUID?.() ||
    `corr_${Date.now()}_${Math.random().toString(16).slice(2, 10)}`
  );
}

function getEnvFlag(key: string): boolean {
  const cfEnv = resolveEnv();
  const fromEnv =
    cfEnv && typeof (cfEnv as Record<string, unknown>)[key] === "string"
      ? String((cfEnv as Record<string, unknown>)[key])
      : undefined;
  const raw = fromEnv ?? (typeof process !== "undefined" ? process.env[key] : undefined);
  if (!raw) return false;
  return raw !== "false";
}

export async function enforcePublicEndpointPolicy(params: {
  request: Request;
  route: string;
  tenantId?: string | null;
  saasId?: string | null;
  saasSlug?: string | null;
}): Promise<NextResponse | null> {
  const routes = getPolicyRoutes();
  const correlationId = resolveCorrelationId(params.request);
  const tenantId = params.tenantId ?? resolveTenantId(params.request) ?? PUBLIC_TENANT_ID;
  const ip = extractClientIp(params.request);

  if (routes.mustAuth.has(params.route) && getEnvFlag("DRACO_PUBLIC_LOCKDOWN_ENABLED")) {
    await recordCampamentoEvent({
      tenantId,
      saasId: params.saasId ?? null,
      type: "security.public_endpoint.lockdown_blocked",
      severity: "WARNING",
      source: "PUBLIC_ENDPOINT",
      message: `Blocked public access to ${params.route}`,
      metadata: { route: params.route, ip },
      correlationId,
    });
    return NextResponse.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401 });
  }

  const { enabled, rpm, burst, windowMs } = getPublicRateLimitConfig();
  if (!enabled) return null;

  const limit = Math.max(1, rpm + burst);
  const keyParts = [params.route, tenantId, ip].filter(Boolean).join(":");
  const decision = await consumeRateLimit({ key: keyParts, limit, windowMs });

  if (decision.allowed) return null;

  await recordCampamentoEvent({
    tenantId,
    saasId: params.saasId ?? null,
    type: "security.ratelimit.blocked",
    severity: "WARNING",
    source: "PUBLIC_ENDPOINT",
    message: `Rate limit blocked for ${params.route}`,
    metadata: {
      route: params.route,
      ip,
      limit: decision.limit,
      remaining: decision.remaining,
      resetAt: decision.resetAt,
    },
    correlationId,
  });

  return NextResponse.json(
    { ok: false, error: "RATE_LIMITED", retryAt: decision.resetAt },
    {
      status: 429,
      headers: {
        "Retry-After": Math.max(1, Math.ceil((new Date(decision.resetAt).getTime() - Date.now()) / 1000)).toString(),
      },
    },
  );
}
