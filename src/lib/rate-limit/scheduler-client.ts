
import type { DracoEnv } from "@/lib/cf";
import { signRequest } from "@/lib/security/internal-api";

interface RateLimitResult {
    allowed: boolean;
    reason?: string;
    remaining?: number;
    reset?: number;
}

export class SchedulerClient {
    private scheduler: Fetcher | null;
    private secret: string;
    private degraded: boolean;

    constructor(env: DracoEnv) {
        if (!env.SCHEDULER) {
            console.warn("[SchedulerClient] SCHEDULER binding missing — client in degraded mode (fail-open)");
            this.scheduler = null;
            this.degraded = true;
        } else {
            this.scheduler = env.SCHEDULER;
            this.degraded = false;
        }
        this.secret = env.INTERNAL_API_SECRET || "dev-secret-unsafe";
        if (!env.INTERNAL_API_SECRET && env.ENVIRONMENT === 'production') {
            console.error("INTERNAL_API_SECRET missing in production!");
        }
    }

    /**
     * Checks rate limit against the Scheduler DO.
     * If scheduler is unavailable, degrades to fail-open (allows request).
     * If scheduler is reachable but errors, fails closed (denies request).
     */
    async checkRateLimit(params: {
        tenantId: string;
        saasSlug: string;
        route: string;
        ip?: string;
    }): Promise<RateLimitResult> {
        if (this.degraded || !this.scheduler) {
            return { allowed: true, reason: "scheduler_unavailable" };
        }

        try {
            const baseKey = `${params.tenantId}:${params.saasSlug}:${params.route}:${params.ip || 'na'}`;

            const keys = [
                `${baseKey}:10s`,
                `${baseKey}:60s`,
                `${baseKey}:15m`
            ];

            const query = new URLSearchParams();
            query.set("tenantId", params.tenantId);
            keys.forEach(k => query.append("key", k));

            const signedHeaders = await signRequest(null, this.secret);

            const response = await this.scheduler.fetch(`http://internal/internal/rate-limit/check?${query.toString()}`, {
                method: "GET",
                headers: {
                    ...signedHeaders
                }
            });

            if (!response.ok) {
                console.error(`[SchedulerClient] Error ${response.status}: ${await response.text()}`);
                return { allowed: false, reason: "Scheduler Error" }; // Fail Closed
            }

            return await response.json() as RateLimitResult;

        } catch (error: any) {
            console.error("[SchedulerClient] Exception:", error);
            return { allowed: false, reason: "Scheduler Unreachable" }; // Fail Closed
        }
    }
}
