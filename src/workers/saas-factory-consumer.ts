
import { type MessageBatch, type Queue } from "@cloudflare/workers-types";
import { setGlobalEnv, type DracoEnv } from "@/lib/cf";
import {
    runSaasFactoryJob,
    type SaasFactoryJobMessage
} from "@/lib/saas-factory/create-saas";
import { queryOne, run } from "@/lib/db";

export interface Env extends DracoEnv {
    SAAS_FACTORY_QUEUE: Queue<SaasFactoryJobMessage>;
}

export default {
    async queue(batch: MessageBatch<SaasFactoryJobMessage>, env: Env): Promise<void> {
        setGlobalEnv(env);
        console.log(`[SaasFactoryWorker] Processing batch of ${batch.messages.length} messages`);

        for (const message of batch.messages) {
            try {
                const job = message.body;
                const { correlationId, saasSlug } = job;

                console.log(`[SaasFactoryWorker] Processing job ${correlationId} for SaaS: ${saasSlug}`);

                // 1. Idempotency Check (Audit Log)
                // Prompt: "Idempotencia por ... billing_audit_logs ... si ya procesado -> skip"
                // We check if "saas_factory.completed" exists for this correlationId
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
                // Prompt: "Verificar que holding_saas_registry NO contiene saasSlug"
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
                    message.ack();
                } else {
                    console.error(`[SaasFactoryWorker] Job failed: ${result.error}`);
                    // We DO NOT ack here, so it retries? 
                    // Prompt says "Rollback mínimo... Audit critical".
                    // runSaasFactoryJob already handles rollback and audit.
                    // If we retry, we might create chaos. 
                    // Better to dead-letter it or ack it as failed if we handled it.
                    // If runSaasFactoryJob returns failure, it means it caught the error and logged it.
                    // So we should ACK to prevent infinite loops of partial creation?
                    // "Si falla Stripe tras crear DB -> revertir DB... y auditar severity=critical"
                    // If we reverted, we are back to clean state. Retry might work?
                    // Fail-Closed implies we stop. 
                    // Let's ack it.
                    message.ack();
                }

            } catch (error) {
                console.error(`[SaasFactoryWorker] Unexpected error processing message ${message.id}`, error);
                // System validation failed?
                message.retry();
            }
        }
    }
};
