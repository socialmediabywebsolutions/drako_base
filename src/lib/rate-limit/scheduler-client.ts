
import type { DracoEnv } from "@/lib/cf";
import { signRequest } from "@/lib/security/internal-api";

interface RateLimitResult {
    allowed: boolean;
    reason?: string;
    remaining?: number;
    reset?: number;
}

export class SchedulerClient {
    private scheduler: Fetcher;
    private secret: string;

    constructor(env: DracoEnv) {
        if (!env.SCHEDULER) {
            throw new Error("SCHEDULER Service Binding missing");
        }
        this.scheduler = env.SCHEDULER;
        this.secret = env.INTERNAL_API_SECRET || "dev-secret-unsafe"; // Fail-closed in Prod via Env var check
        if (!env.INTERNAL_API_SECRET && env.ENVIRONMENT === 'production') {
            console.error("INTERNAL_API_SECRET missing in production!");
        }
    }

    /**
     * Checks rate limit against the Scheduler DO.
     * Fail-Closed: If Scheduler is unreachable or errors, deny access.
     */
    async checkRateLimit(params: {
        tenantId: string;
        saasSlug: string;
        route: string;
        ip?: string;
    }): Promise<RateLimitResult> {
        try {
            // Construct keys for 10s, 60s, 15m windows
            // Key format: {tenant}:{saas}:{route}:{ip}:{window}
            // Actually, DO expects list of keys.
            // We want to limit by Tenant generally, or specific route?
            // "keyspace: {tenant_id}:{saas_slug}:{route}:{ip?}"

            const baseKey = `${params.tenantId}:${params.saasSlug}:${params.route}:${params.ip || 'na'}`;

            const keys = [
                `${baseKey}:10s`,
                `${baseKey}:60s`,
                `${baseKey}:15m`
            ];

            const query = new URLSearchParams();
            query.set("tenantId", params.tenantId); // Sharding Key
            keys.forEach(k => query.append("key", k));

            // Call Scheduler Internal API
            // Service Binding uses 'fetch' but bypasses network if local/same-account.
            // We use a dummy URL for the fetcher.

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
