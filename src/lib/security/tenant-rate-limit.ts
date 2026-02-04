import { env as resolveEnv, type DracoEnv } from "@/lib/cf";
import { queryAll, run } from "@/lib/db";
import { consumeRateLimit, extractClientIp } from "./rate-limit";
import { generateCorrelationId } from "../correlation";

/**
 * Drako-Forge Steel v1.0.1 - Tenant Rate Limiting
 */

export type TenantPlan = "FREE" | "PRO" | "ENTERPRISE";

export interface RateLimitConfig {
    rpm: number;
    burst: number;
}

const PLAN_LIMITS: Record<TenantPlan, RateLimitConfig> = {
    FREE: { rpm: 60, burst: 10 },
    PRO: { rpm: 1000, burst: 50 },
    ENTERPRISE: { rpm: 5000, burst: 200 },
};

/**
 * Validates and consumes rate limit for a specific tenant and plan.
 */
export async function checkTenantRateLimit(params: {
    tenantId: string;
    saasId?: string;
    plan?: TenantPlan;
    route: string;
    request: Request;
    envOverride?: DracoEnv | null;
}): Promise<{ allowed: boolean; retryAfter?: number }> {
    const env = params.envOverride || resolveEnv();
    const plan = params.plan || "FREE";
    const limits = PLAN_LIMITS[plan];

    const correlationId = params.request.headers.get("x-drako-correlation-id") || generateCorrelationId();
    const ip = extractClientIp(params.request);
    const rpmKey = `ratelimit:rpm:${params.tenantId}:${params.route}`;

    // 1. Consume RPM Limit
    // Note: consumeRateLimit currently uses memory + D1. 
    // TODO: Integrate Durable Objects for higher performance.
    const rpmDecision = await consumeRateLimit({
        key: rpmKey,
        limit: limits.rpm,
        windowMs: 60_000,
        envOverride: env,
    });

    if (!rpmDecision.allowed) {
        await auditRateLimitDrop({
            tenantId: params.tenantId,
            saasId: params.saasId,
            route: params.route,
            limitType: "RPM",
            limitValue: limits.rpm,
            currentCount: rpmDecision.count,
            ip,
            correlationId,
            env,
        });

        return { allowed: false, retryAfter: 60 };
    }

    return { allowed: true };
}

/**
 * Persists a rate limit drop event to D1 for audit/observability.
 */
async function auditRateLimitDrop(params: {
    tenantId: string;
    saasId?: string;
    route: string;
    limitType: string;
    limitValue: number;
    currentCount: number;
    ip: string;
    correlationId: string;
    env: DracoEnv | null;
}) {
    if (!params.env?.DRACO_DB) return;

    const id = `drop_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    await run(
        `INSERT INTO rate_limit_audits (
      id, tenant_id, saas_id, route, limit_type, limit_value, current_count, ip, correlation_id, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        id,
        params.tenantId,
        params.saasId || null,
        params.route,
        params.limitType,
        params.limitValue,
        params.currentCount,
        params.ip,
        params.correlationId,
        new Date().toISOString()
    );
}
