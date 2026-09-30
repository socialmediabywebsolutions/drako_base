import { RateLimiterDO } from "./rate-limiter-do";
import { runReaper } from "./reaper";
import { runReconciliation } from "./reconciliation";
import { processQueueBatch } from "./consumer";
import { setGlobalEnv, type DracoEnv } from "../../../src/lib/cf";
import { verifyRequest } from "../../../src/lib/security/internal-api";

export { RateLimiterDO };

// Genera el artículo diario del Journal de drako.systems. La ruta valida el Bearer
// con verifyCronAuth (CRON_SECRET o INTERNAL_API_SECRET).
async function runDrakoJournal(env: any): Promise<void> {
    const token = (typeof env.CRON_SECRET === "string" && env.CRON_SECRET.trim())
        || (typeof env.INTERNAL_API_SECRET === "string" && env.INTERNAL_API_SECRET.trim())
        || "";
    if (!env.DRAKOS || !token) {
        console.error("DRAKO_JOURNAL_CRON_SKIPPED", { hasBinding: Boolean(env.DRAKOS), hasToken: Boolean(token) });
        return;
    }
    const response = await env.DRAKOS.fetch("https://drako.systems/api/cron/journal", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
    });
    const body = await response.text();
    if (!response.ok) {
        console.error("DRAKO_JOURNAL_CRON_FAILED", { status: response.status, body: body.slice(0, 500) });
        return;
    }
    console.log("DRAKO_JOURNAL_CRON_OK", body.slice(0, 300));
}

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
            case "0 9 * * 1-5":
                console.log("Running Drako Journal...");
                await runDrakoJournal(env);
                break;
        }
    },

    async queue(batch: MessageBatch<any>, env: any, ctx: ExecutionContext) {
        setGlobalEnv(env as DracoEnv);
        await processQueueBatch(batch, env);
    }
};
