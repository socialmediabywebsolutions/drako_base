
import { JobRunner } from "../../../src/lib/provisioning/job-runner";
import { queryOne } from "../../../src/lib/db";
import { provisionSaaS } from "../../../src/lib/campamento-base/saas-factory-orchestrator";
import type { DracoEnv } from "../../../src/lib/cf";

interface Env {
    DRACO_DB: D1Database;
    RATE_LIMITER: DurableObjectNamespace;
}

interface MessageBody {
    jobId: string;
    type: string;
    correlationId: string;
}

export async function processQueueBatch(batch: MessageBatch<MessageBody>, env: Env) {
    console.log(`[Consumer] Processing batch of ${batch.messages.length} messages`);

    for (const msg of batch.messages) {
        const { jobId } = msg.body;
        const ownerId = `worker-${crypto.randomUUID()}`;

        try {
            console.log(`[Consumer] Processing Job ${jobId}`);

            // 1. Acquire Lock (Fencing Token)
            // If already locked or finished, check logic.
            // Queue ensures we get the message. Idempotency is key.

            const { lockVersion } = await JobRunner.acquireLock(jobId, ownerId);
            const token = { lockVersion, ownerId };

            // 2. Execute Steps (Real Logic)
            console.log(`[Consumer] Executing Job ${jobId} with token ${token.lockVersion}`);

            // Import dynamically or ensure imported at top

            // Load Job Payload
            const job = await queryOne<{ payload_json: string; tenant_id: string }>(
                "SELECT payload_json, tenant_id FROM provisioning_jobs WHERE job_id = ?",
                jobId
            );

            if (!job) {
                console.error(`[Consumer] Job ${jobId} not found in DB`);
                msg.ack();
                continue;
            }

            const blueprint = JSON.parse(job.payload_json);

            await provisionSaaS({
                env: env as unknown as DracoEnv, // Cast Env
                ownerTenantId: job.tenant_id,
                blueprint: blueprint,
                preAcquiredToken: token
            });

            // Note: provisionSaaS handles transitions and completion.
            // BUT: usage above is incomplete. 
            // `provisionSaaS` requires `ownerTenantId` and `blueprint`.
            // These are stored in `provisioning_jobs` (payload_json) and (tenant_id).
            // `JobRunner` already loaded the job to check lock? No, `acquireLock` checks it.
            // We need to LOAD the job details.

            // Fix: Load job first.

            // Acknowledge
            msg.ack();

        } catch (error: any) {
            console.error(`[Consumer] Failed Job ${jobId}:`, error);
            // If FencingTokenMismatch, we do NOT retry implicitly. We failed because we lost the lock.
            // Just ack (fail effectively) or dead letter?
            if (error.name === 'FencingTokenMismatchError') {
                // We lost the lock. Stop.
                msg.ack();
            } else {
                // Retry typical errors (network, etc)
                msg.retry({ delaySeconds: 10 });
            }
        }
    }
}
