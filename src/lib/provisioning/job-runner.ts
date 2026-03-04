import { run, queryOne, queryAll } from "@/lib/db";

export type ProvisioningJobType = 'SAAS_PROVISIONING' | 'TENANT_ONBOARDING';

export type ProvisioningJobState =
    | 'CREATED'
    | 'RUNNING'
    | 'ACTIVE'
    | 'SUCCESS'
    | 'FAILED'
    | 'RETRYABLE_FAILED'
    | 'ROLLING_BACK'
    // SaaS Specific
    | 'SAAS_REGISTERED'
    | 'STRIPE_PRODUCT_CREATED'
    | 'DOMAINS_REGISTERED'
    // Tenant Specific
    | 'TENANT_CREATED'
    | 'SUBSCRIPTION_CREATED'
    | 'SUBSCRIPTION_CONFIRMED';

export type CanonicalProvisioningJobState =
    | 'CREATED'
    | 'RUNNING'
    | 'LOCKED'
    | 'SUCCESS'
    | 'FAILED';

export type JobStepRecord = {
    step: string;
    state: ProvisioningJobState;
    status: 'SUCCESS' | 'ERROR';
    timestamp: string;
    details?: string | null;
};

export class JobLockedError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'JobLockedError';
    }
}

export class StateMismatchError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'StateMismatchError';
    }
}

export class FencingTokenMismatchError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'FencingTokenMismatchError';
    }
}

export class JobRunner {

    static isTerminalState(state: string | null | undefined): boolean {
        return state === 'ACTIVE' || state === 'SUCCESS' || state === 'FAILED';
    }

    static toCanonicalState(state: string | null | undefined, executionLock: number | null | undefined): CanonicalProvisioningJobState {
        if (state === 'FAILED') return 'FAILED';
        if (state === 'ACTIVE' || state === 'SUCCESS') return 'SUCCESS';
        if (executionLock === 1) return 'LOCKED';
        if (state === 'CREATED') return 'CREATED';
        return 'RUNNING';
    }

    /**
     * Initializes a new job or returns existing one (Idempotent).
     */
    static async ensureJob(params: {
        jobId: string;
        type: ProvisioningJobType;
        entityId: string;
        correlationId: string;
        idempotencyKey: string;
        initialState: ProvisioningJobState;
        payload: any;
        tenantId: string;
        queue?: { send: (msg: any) => Promise<void> }; // Cloudflare Queue Binding
    }): Promise<{ jobId: string; created: boolean; state: ProvisioningJobState; entityId: string; payload: any }> {
        const now = new Date().toISOString();
        const payloadJson = JSON.stringify(params.payload);
        let inserted = false;

        try {
            const insertedOk = await run(
                `INSERT INTO provisioning_jobs (
                    job_id, type, entity_id, correlation_id, idempotency_key, current_state, payload_json, tenant_id, created_at, updated_at, execution_lock
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                params.jobId, params.type, params.entityId, params.correlationId, params.idempotencyKey, params.initialState, payloadJson, params.tenantId || 'unknown', now, now, 0
            );
            if (!insertedOk) {
                throw new Error("PROVISIONING_JOB_INSERT_FAILED");
            }
            inserted = true;

            // Cloudflare Queue Enqueue (Strict Hardening)
            if (params.queue) {
                await params.queue.send({
                    jobId: params.jobId,
                    type: params.type,
                    correlationId: params.correlationId,
                    tenantId: params.tenantId
                });
            } else {
                // Fail-Closed: Strict Mode requires Queue
                throw new Error("PROVISIONING_QUEUE binding missing. Cannot enqueue job.");
            }

            return { jobId: params.jobId, created: true, state: params.initialState, entityId: params.entityId, payload: params.payload };
        } catch (e: any) {
            if (inserted) {
                await run(`DELETE FROM provisioning_jobs WHERE job_id = ? AND current_state = ?`, params.jobId, params.initialState);
            }
            // Idempotency Check
            if (e.message?.includes('UNIQUE constraint failed')) {
                const existing = await queryOne<{ job_id: string; current_state: string; entity_id: string; payload_json: string }>(
                    `SELECT job_id, current_state, entity_id, payload_json FROM provisioning_jobs WHERE idempotency_key = ?`,
                    params.idempotencyKey
                );
                if (existing) {
                    return {
                        jobId: existing.job_id,
                        created: false,
                        state: existing.current_state as ProvisioningJobState,
                        entityId: existing.entity_id,
                        payload: JSON.parse(existing.payload_json)
                    };
                }
            }
            throw e;
        }
    }

    /**
     * Attempts to acquire an atomic execution lock.
     * Transitions State to RUNNING if not already.
     * Returns the Fencing Token (lock_version) and Owner ID.
     * Throws JobLockedError if already locked.
     */
    static async acquireLock(jobId: string, ownerId: string): Promise<{ lockVersion: number }> {
        // Atomic Update: Claim the lock, increment version
        await run(
            `UPDATE provisioning_jobs 
             SET execution_lock = 1, 
                 current_state = CASE WHEN current_state = 'CREATED' THEN 'RUNNING' ELSE current_state END,
                 lock_acquired_at = strftime('%Y-%m-%dT%H:%M:%fZ','now'),
                 updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now'),
                 lock_owner = ?,
                 lock_version = lock_version + 1
             WHERE job_id = ? 
               AND execution_lock = 0
               AND current_state NOT IN ('ACTIVE', 'SUCCESS', 'FAILED')`,
            ownerId,
            jobId
        );

        // Verify acquisition and get Token
        const job = await queryOne<{ lock_owner: string; lock_version: number; retry_count: number; max_retries: number; current_state: string; lock_acquired_at: string }>(
            `SELECT lock_owner, lock_version, retry_count, max_retries, current_state, lock_acquired_at FROM provisioning_jobs WHERE job_id = ?`,
            jobId
        );

        if (!job) throw new Error("Job not found");

        // Verify we are the owner
        if (job.lock_owner === ownerId && !JobRunner.isTerminalState(job.current_state)) {
            return { lockVersion: job.lock_version };
        }

        // If we failed to acquire (row not updated), check why
        if (JobRunner.isTerminalState(job.current_state)) {
            throw new Error(`Job ${jobId} is in terminal state: ${job.current_state}`);
        }

        // Stale Lock Check
        if (job.lock_acquired_at) {
            const lockTime = new Date(job.lock_acquired_at).getTime();
            const nowTime = Date.now();
            if (nowTime - lockTime > 15 * 60 * 1000) {
                // The Reaper should handle this generally, but if we are aggressive:
                // We don't force unlock here anymore. We let Reaper handle it or throw Locked.
                // Phase 3.1 Rule: Explicit Reaper responsibility.
            }
        }

        throw new JobLockedError(`Job ${jobId} is currently locked by ${job.lock_owner}.`);
    }

    static async updatePayload(jobId: string, partialPayload: Record<string, any>, token: { lockVersion: number; ownerId: string }): Promise<void> {
        // Read-Modify-Write with Fencing Token

        const job = await queryOne<{ payload_json: string }>(`SELECT payload_json FROM provisioning_jobs WHERE job_id = ?`, jobId);
        if (!job) throw new Error("Job not found");

        const currentPayload = JSON.parse(job.payload_json);
        const newPayload = { ...currentPayload, ...partialPayload };

        const success = await run(
            `UPDATE provisioning_jobs 
             SET payload_json = ? 
             WHERE job_id = ? 
               AND lock_version = ? 
               AND lock_owner = ? 
               AND execution_lock = 1`,
            JSON.stringify(newPayload),
            jobId,
            token.lockVersion,
            token.ownerId
        );

        if (!success) {
            throw new FencingTokenMismatchError(`Lost lock for job ${jobId} during payload update.`);
        }
    }

    static async releaseLock(jobId: string): Promise<void> {
        await run(
            `UPDATE provisioning_jobs SET execution_lock = 0, lock_acquired_at = NULL WHERE job_id = ?`,
            jobId
        );
    }

    static async forceUnlock(jobId: string): Promise<void> {
        await run(
            `UPDATE provisioning_jobs 
             SET execution_lock = 0, lock_acquired_at = NULL, retry_count = retry_count + 1 
             WHERE job_id = ?`,
            jobId
        );
    }

    static async transitionState(
        jobId: string,
        fromState: ProvisioningJobState,
        toState: ProvisioningJobState,
        token: { lockVersion: number; ownerId: string },
        details?: string
    ): Promise<void> {
        const historyEntry: JobStepRecord = {
            step: `TRANSITION_${fromState}_TO_${toState}`,
            state: toState,
            status: 'SUCCESS',
            timestamp: new Date().toISOString(),
            details
        };

        const success = await run(
            `UPDATE provisioning_jobs 
             SET current_state = ?, 
                 updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now'),
                 step_history_json = json_insert(COALESCE(step_history_json, '[]'), '$[' || json_array_length(COALESCE(step_history_json, '[]')) || ']', json(?))
             WHERE job_id = ? 
               AND current_state = ?
               AND lock_version = ?
               AND lock_owner = ?
               AND execution_lock = 1`,
            toState,
            JSON.stringify(historyEntry),
            jobId,
            fromState,
            token.lockVersion,
            token.ownerId
        );

        if (!success) {
            const current = await queryOne<{ current_state: string; lock_version: number }>(`SELECT current_state, lock_version FROM provisioning_jobs WHERE job_id = ?`, jobId);

            if (current?.lock_version !== token.lockVersion) {
                throw new FencingTokenMismatchError(`Lost lock for job ${jobId} during transition.`);
            }

            if (toState === 'ROLLING_BACK' && (current?.current_state === 'FAILED' || current?.current_state === 'ROLLING_BACK')) {
                return;
            }

            throw new StateMismatchError(`Failed to transition job ${jobId} from ${fromState} to ${toState}. Current state: ${current?.current_state}`);
        }
    }

    static async failJob(jobId: string, error: string, token?: { lockVersion: number; ownerId: string }): Promise<void> {
        const historyEntry: JobStepRecord = {
            step: 'FAILURE',
            state: 'FAILED',
            status: 'ERROR',
            timestamp: new Date().toISOString(),
            details: error
        };

        // If we have a token, we must respect it. If not (generic failure), we force fail.
        // Hardening: Enforce token if provided.
        // If no token provided, it implies a system-level failure (e.g. Reaper).

        let query = `UPDATE provisioning_jobs 
             SET current_state = 'FAILED', 
                 last_error = ?,
                 execution_lock = 0,
                 lock_acquired_at = NULL,
                 lock_owner = NULL,
                 updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now'),
                 step_history_json = json_insert(COALESCE(step_history_json, '[]'), '$[' || json_array_length(COALESCE(step_history_json, '[]')) || ']', json(?))
             WHERE job_id = ?`;

        const args: any[] = [error, JSON.stringify(historyEntry), jobId];

        if (token) {
            query += ` AND lock_version = ? AND lock_owner = ?`;
            args.push(token.lockVersion, token.ownerId);
        }

        await run(query, ...args);
    }

    static async completeJob(jobId: string, fromState: ProvisioningJobState, token: { lockVersion: number; ownerId: string }): Promise<void> {
        const historyEntry: JobStepRecord = {
            step: 'COMPLETION',
            state: 'SUCCESS',
            status: 'SUCCESS',
            timestamp: new Date().toISOString(),
            details: 'Job completed successfully'
        };

        const success = await run(
            `UPDATE provisioning_jobs 
             SET current_state = 'SUCCESS', 
                 execution_lock = 0, 
                 lock_acquired_at = NULL,
                 lock_owner = NULL,
                 updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now'),
                 step_history_json = json_insert(COALESCE(step_history_json, '[]'), '$[' || json_array_length(COALESCE(step_history_json, '[]')) || ']', json(?))
             WHERE job_id = ? 
               AND current_state = ?
               AND lock_version = ?
               AND lock_owner = ?`,
            JSON.stringify(historyEntry),
            jobId,
            fromState,
            token.lockVersion,
            token.ownerId
        );

        if (!success) {
            throw new FencingTokenMismatchError(`Failed to complete job ${jobId}: Token mismatch or invalid state.`);
        }
    }

    static async logRollback(jobId: string, step: string, details: string) {
        const entry = {
            step,
            timestamp: new Date().toISOString(),
            details
        };

        await run(
            `UPDATE provisioning_jobs
             SET rollback_history_json = json_insert(COALESCE(rollback_history_json, '[]'), '$[' || json_array_length(COALESCE(rollback_history_json, '[]')) || ']', json(?))
             WHERE job_id = ?`,
            JSON.stringify(entry),
            jobId
        );
    }
}
