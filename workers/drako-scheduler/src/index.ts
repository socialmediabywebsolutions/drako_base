import { RateLimiterDO } from "./rate-limiter-do";
import { runReaper } from "./reaper";
import { runReconciliation } from "./reconciliation";
import { processQueueBatch } from "./consumer";
import { setGlobalEnv, type DracoEnv } from "../../../src/lib/cf";
import { verifyRequest } from "../../../src/lib/security/internal-api";

export { RateLimiterDO };

export default {
    async fetch(request: Request, env: any, ctx: ExecutionContext): Promise<Response> {
        setGlobalEnv(env as DracoEnv);
        const url = new URL(request.url);
        const internalSecret = typeof env.INTERNAL_API_SECRET === "string" ? env.INTERNAL_API_SECRET.trim() : "";
        const isInternalRoute = url.pathname.startsWith("/internal/");

        // Security: Anti-Replay & Signature Check for Internal API (fail-closed).
        if (isInternalRoute) {
            if (!internalSecret || internalSecret.length < 16) {
                return new Response("Scheduler INTERNAL_API_SECRET misconfigured", { status: 503 });
            }
            if (!request.headers.get("x-drako-sig")) {
                return new Response("Missing signature", { status: 401 });
            }
            try {
                await verifyRequest(request, internalSecret, async (nonce) => {
                    // Call Security DO
                    const id = env.RATE_LIMITER.idFromName("SECURITY");
                    const stub = env.RATE_LIMITER.get(id);
                    const res = await stub.fetch(`http://security/check-nonce?nonce=${nonce}`);
                    return res.ok;
                });
            } catch (e: any) {
                return new Response(`Forbidden: ${e.message}`, { status: 403 });
            }
        }

        // Routing
        if (url.pathname.startsWith("/internal/rate-limit")) {
            const tenantId = url.searchParams.get("tenantId");
            if (!tenantId) return new Response("Missing tenantId", { status: 400 });

            const id = env.RATE_LIMITER.idFromName(tenantId);
            const stub = env.RATE_LIMITER.get(id);

            const doUrl = new URL(request.url);
            doUrl.pathname = "/check";
            return stub.fetch(new Request(doUrl.toString(), request));
        }

        return new Response("Scheduler Worker Active", { status: 200 });
    },

    async scheduled(event: ScheduledEvent, env: any, ctx: ExecutionContext) {
        setGlobalEnv(env as DracoEnv);
        console.log("Cron Event", event.cron);

        switch (event.cron) {
            case "*/5 * * * *":
                console.log("Running Job Reaper...");
                await runReaper(env);
                break;
            case "*/15 * * * *":
                console.log("Running Reconciliation...");
                await runReconciliation(env);
                break;
        }
    },

    async queue(batch: MessageBatch<any>, env: any, ctx: ExecutionContext) {
        setGlobalEnv(env as DracoEnv);
        await processQueueBatch(batch, env);
    }
};
