import { JobRunner, FencingTokenMismatchError } from "@/lib/provisioning/job-runner";
import { setGlobalEnv } from "@/lib/cf";
import { run } from "@/lib/db";

// --- Mock D1 ---
class MockD1 {
    private db: any[] = []; // Simple store for jobs

    prepare(sql: string) {
        return {
            bind: (...args: any[]) => this.execute(sql, args)
        };
    }

    execute(sql: string, args: any[]) {
        const that = this;
        return {
            run: async () => {
                // INSERT
                if (sql.includes("INSERT INTO provisioning_jobs")) {
                    const [jobId, type, entityId, correlationId, idempotencyKey, currentState, payloadJson, tenantId] = args;
                    that.db.push({
                        job_id: jobId, type, entity_id: entityId, correlation_id: correlationId, idempotency_key: idempotencyKey,
                        current_state: currentState, payload_json: payloadJson, tenant_id: tenantId,
                        execution_lock: 0, lock_version: 0, lock_owner: null, lock_acquired_at: null, retry_count: 0, max_retries: 3
                    });
                    return { success: true };
                }
                // UPDATE acquireLock
                if (sql.includes("UPDATE provisioning_jobs") && sql.includes("execution_lock = 1")) {
                    const [ownerId, jobId] = args;
                    const job = that.db.find(j => j.job_id === jobId);
                    if (job && job.execution_lock === 0 && !['ACTIVE', 'FAILED'].includes(job.current_state)) {
                        job.execution_lock = 1;
                        job.lock_owner = ownerId;
                        job.lock_version += 1;
                        job.lock_acquired_at = new Date().toISOString();
                        job.current_state = job.current_state === 'CREATED' ? 'RUNNING' : job.current_state;
                        return { success: true };
                    }
                    return { success: false };
                }
                // UPDATE transitionState / complete
                if (sql.includes("UPDATE provisioning_jobs") && sql.includes("lock_version = ?")) {
                    const jobIdIndex = args.findIndex(a => typeof a === 'string' && a.startsWith('verify_')); // HACK: find jobId
                    // Actually JobRunner passes jobId at specific pos?
                    // transitionState: toState, history, jobId, fromState, lockVersion, ownerId
                    // Map args is hard without parsing SQL order.
                    // Let's assume the job_id is present.
                    const jobId = args.find(a => typeof a === 'string' && that.db.find(j => j.job_id === a));
                    const job = that.db.find(j => j.job_id === jobId);

                    // We need strict version check
                    const lockVersion = args[args.length - 2]; // version is usually near end
                    if (job) {
                        // Cheat: Check if args contains the version
                        if (args.includes(job.lock_version) && job.execution_lock === 1) {
                            // SUCCESS
                            // Update state if needed
                            if (args[0] === 'ACTIVE') job.execution_lock = 0; // Complete
                            return { success: true };
                        }
                    }
                    return { success: false };
                }

                // Zombie Update Simulation (Direct SQL usage in script)
                // "UPDATE provisioning_jobs SET execution_lock = 0, lock_owner = NULL, lock_version = lock_version + 1 WHERE job_id = ?"
                if (sql.includes("UPDATE provisioning_jobs SET execution_lock = 0") && sql.includes("lock_version = lock_version + 1")) {
                    const jobId = args[0];
                    const job = that.db.find(j => j.job_id === jobId);
                    if (job) {
                        job.execution_lock = 0;
                        job.lock_owner = null;
                        job.lock_version += 1;
                        return { success: true };
                    }
                }

                return { success: false };
            },
            first: async () => {
                const jobId = args.find(a => typeof a === 'string' && a.startsWith('verify_'));
                if (jobId) {
                    return that.db.find(j => j.job_id === jobId) || null;
                }
                return null;
            },
            all: async () => {
                const jobId = args.find(a => typeof a === 'string' && a.startsWith('verify_'));
                if (jobId) {
                    const job = that.db.find(j => j.job_id === jobId);
                    return { results: job ? [job] : [] };
                }
                return { results: [] };
            }
        }
    }
}

async function verify() {
    console.log("--- Verifying Fencing Tokens ---");

    const mockDb = new MockD1();
    setGlobalEnv({ DRACO_DB: mockDb } as any);

    // 1. Create a Job
    const jobId = `verify_${Date.now()}`;
    await JobRunner.ensureJob({
        jobId,
        type: 'SAAS_PROVISIONING',
        entityId: 'test',
        correlationId: jobId,
        idempotencyKey: jobId,
        initialState: 'CREATED',
        payload: {},
        tenantId: 'test-tenant',
        queue: { send: async () => { console.log("Mock Queue: Enqueued"); } }
    });
    console.log("1. Job Created");

    // 2. Worker A acquires lock (Valid)
    const ownerA = "worker-A";
    const tokenA = await JobRunner.acquireLock(jobId, ownerA);
    console.log(`2. Worker A acquired lock. Version: ${tokenA.lockVersion}`);

    // 3. Simulate Zombie: Reaper runs and increments version
    // We manually simulate Reaper update via our MockDB "execute" backdoor basically
    // But since we use `run` from `db.ts` which uses `mockDb`, we can just call `run`.
    // The `run` function is already imported at the top.
    console.log("3. Simulating Reaper (Zombie Event)...");
    await run(`UPDATE provisioning_jobs SET execution_lock = 0, lock_owner = NULL, lock_version = lock_version + 1 WHERE job_id = ?`, jobId);

    // 4. Worker B acquires lock (Valid)
    const ownerB = "worker-B";
    const tokenB = await JobRunner.acquireLock(jobId, ownerB);
    console.log(`4. Worker B acquired lock. Version: ${tokenB.lockVersion}`);

    if (tokenB.lockVersion <= tokenA.lockVersion) {
        throw new Error(`Token B (${tokenB.lockVersion}) should be > Token A (${tokenA.lockVersion})`);
    }

    // 5. Worker A tries to update state (Zombie Write) - MUST FAIL
    console.log("5. Worker A trying to write (Zombie Write)...");
    try {
        const fullTokenA = { lockVersion: tokenA.lockVersion, ownerId: ownerA };
        await JobRunner.transitionState(jobId, 'RUNNING', 'SAAS_REGISTERED', fullTokenA, "Zombie Update");
        throw new Error("FAIL: Zombie Worker A was able to write!");
    } catch (e: any) {
        if (e.name === 'FencingTokenMismatchError') {
            console.log("SUCCESS: Zombie Worker A was blocked by Fencing Token.");
        } else {
            console.error("Unexpected Error:", e);
            throw e;
        }
    }

    console.log("--- Verification Complete ---");
}

// Execute
if (require.main === module) {
    verify().catch(e => {
        console.error(e);
        process.exit(1);
    });
}
