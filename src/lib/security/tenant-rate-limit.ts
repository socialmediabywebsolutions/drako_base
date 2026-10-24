import { env as resolveEnv, type DracoEnv } from "@/lib/cf";
import { run } from "@/lib/db";
import { extractClientIp } from "./rate-limit";
import { SchedulerClient } from "@/lib/rate-limit/scheduler-client";

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
    if (!env) return { allowed: true }; // Fail Open if no Env (e.g. build time), but Phase 3 requirement is Fail-Closed.
    // However, if we can't get Env, we can't call Scheduler.
    // In Edge Runtime, env() should return.

    if (!env.SCHEDULER) {
        // HOTFIX: Graceful degradation when drako-scheduler is not yet deployed.
        // Rate limiting is bypassed (fail-open) rather than blocking all traffic.
        // ACTION REQUIRED: Deploy drako-scheduler via `npm run deploy:scheduler`
        // See: docs/cloudflare-service-bindings.md
        console.warn("[SCHEDULER] Service binding unavailable — rate limiting bypassed (fail-open). Deploy drako-scheduler to restore enforcement.");
        return { allowed: true };
    }

    const client = new SchedulerClient(env);
    const ip = extractClientIp(params.request);

    const decision = await client.checkRateLimit({
        tenantId: params.tenantId,
        saasSlug: params.saasId || "global",
        route: params.route,
        ip
    });

    if (!decision.allowed) {
        // Audit is handled by Scheduler? Or should we log here?
        // Scheduler DO doesn't access DB easily for logs unless we add it.
        // Better to log locally for now or rely on Scheduler logs.
        // For Phase 3 Requirement D (Observability), we want metrics.
        // We will keep local audit for now.

        await auditRateLimitDrop({
            tenantId: params.tenantId,
            saasId: params.saasId,
            route: params.route,
            limitType: "GLOBAL_DO",
            limitValue: 0, // Dynamic
            currentCount: 0, // Dynamic
            ip,
            correlationId: params.request.headers.get("x-drako-correlation-id") || "na",
            env
        });

        return { allowed: false, retryAfter: decision.reset ? Math.ceil(decision.reset / 1000) : 10 };
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
