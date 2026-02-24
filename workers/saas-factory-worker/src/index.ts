/**
 * saas-factory-worker — Dedicated consumer for drako-saas-factory-queue
 *
 * This worker runs independently from the main OpenNext app (drako-base-3).
 * It consumes SaaS Factory job messages, performs idempotency checks,
 * and delegates execution to the shared runSaasFactoryJob library.
 */

import { type MessageBatch } from "@cloudflare/workers-types";
import { setGlobalEnv, type DracoEnv } from "../../../src/lib/cf";
import {
    runSaasFactoryJob,
    type SaasFactoryJobMessage
} from "../../../src/lib/saas-factory/create-saas";
import { queryOne, run } from "../../../src/lib/db";

export interface Env extends DracoEnv {
    SAAS_FACTORY_QUEUE: { send: (msg: any) => Promise<void> };
}

export default {
    /**
     * Health check endpoint
     */
    async fetch(request: Request, env: Env): Promise<Response> {
        const url = new URL(request.url);

        if (url.pathname === "/health") {
            return new Response(JSON.stringify({
                ok: true,
                worker: "saas-factory-worker",
                time: new Date().toISOString(),
                bindings: {
                    db: env.DRACO_DB ? "connected" : "missing",
                },
            }), {
                headers: { "Content-Type": "application/json" },
            });
        }

        return new Response("saas-factory-worker", { status: 200 });
    },

    /**
     * Queue consumer: processes SaaS Factory job messages
     */
    async queue(batch: MessageBatch<SaasFactoryJobMessage>, env: Env): Promise<void> {
        setGlobalEnv(env);
        console.log(`[SaasFactoryWorker] Processing batch of ${batch.messages.length} messages`);

        for (const message of batch.messages) {
            try {
                const job = message.body;
                const { correlationId, saasSlug } = job;

                console.log(`[SaasFactoryWorker] Processing job ${correlationId} for SaaS: ${saasSlug}`);

                // 1. Idempotency Check (Audit Log)
                const existingLog = await queryOne<{ id: string }>(
                    `SELECT id FROM billing_audit_logs 
                     WHERE correlation_id = ? AND event_type = 'saas_factory.completed'`,
                    correlationId
                );

                if (existingLog) {
                    console.log(`[SaasFactoryWorker] Skipped duplicate job ${correlationId}`);
                    message.ack();
                    continue;
                }

                // 2. Registry Pre-Flight Check (Idempotency)
                const existingSaas = await queryOne<{ saas_slug: string }>(
                    `SELECT saas_slug FROM holding_saas_registry WHERE saas_slug = ?`,
                    saasSlug
                );

                if (existingSaas) {
                    console.warn(`[SaasFactoryWorker] SaaS ${saasSlug} already exists. Skipping.`);
                    await run(
                        `INSERT INTO billing_audit_logs (id, saas_slug, event_type, severity, correlation_id, metadata_json)
                         VALUES (?, ?, ?, ?, ?, ?)`,
                        `warn_${correlationId}`, saasSlug, "saas_factory.skipped_exists", "WARNING", correlationId,
                        JSON.stringify({ reason: "SaaS already exists in registry" })
                    );
                    message.ack();
                    continue;
                }

                // 3. Execution (Fail-Closed)
                const result = await runSaasFactoryJob(job);

                if (result.success) {
                    console.log(`[SaasFactoryWorker] Job ${correlationId} completed successfully`);
                    message.ack();
                } else {
                    console.error(`[SaasFactoryWorker] Job failed: ${result.error}`);
                    // runSaasFactoryJob handles rollback and audit internally.
                    // ACK to prevent infinite retry loops after rollback.
                    message.ack();
                }

            } catch (error) {
                console.error(`[SaasFactoryWorker] Unexpected error processing message ${message.id}`, error);
                message.retry();
            }
        }
    }
};
