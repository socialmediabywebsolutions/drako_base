
export async function runReaper(env: any) {
    const db = env.DRACO_DB;
    if (!db) {
        console.error("DRACO_DB not bound in Scheduler");
        return;
    }

    console.log("[Reaper] Checking for stale locks...");

    try {
        // 1. Find Stale Jobs (Running > 15m)
        // SQLite: strftime('%Y-%m-%dT%H:%M:%fZ','now', '-15 minutes')
        // Note: Our timestamps are ISO strings stored as TEXT.
        // D1/SQLite date functions work on ISO strings.

        const staleThreshold = new Date(Date.now() - 15 * 60 * 1000).toISOString();

        const { results } = await db.prepare(`
          SELECT job_id, retry_count, max_retries, current_state 
          FROM provisioning_jobs 
          WHERE execution_lock = 1 
          AND lock_acquired_at < ?
      `).bind(staleThreshold).all();

        if (!results || results.length === 0) {
            console.log("[Reaper] No stale locks found.");
            return;
        }

        console.log(`[Reaper] Found ${results.length} stale jobs.`);

        for (const job of results) {
            const { job_id, retry_count, max_retries } = job as any;

            if (retry_count < max_retries) {
                // Recover: Force Unlock & Increment Retry & INCREMENT VERSION (Zombie Fencing)
                console.log(`[Reaper] Recovering job ${job_id} (Attempt ${retry_count + 1}/${max_retries})`);
                await db.prepare(`
                  UPDATE provisioning_jobs 
                  SET execution_lock = 0, 
                      current_state = 'RETRYABLE_FAILED',
                      lock_acquired_at = NULL, 
                      lock_owner = NULL,
                      retry_count = retry_count + 1,
                      lock_version = lock_version + 1,
                      updated_at = ?
                  WHERE job_id = ?
                `).bind(new Date().toISOString(), job_id).run();
            } else {
                // Fail: Exceeded Retries
                console.error(`[Reaper] Failing job ${job_id} (Exceeded max retries)`);
                await db.prepare(`
                  UPDATE provisioning_jobs 
                  SET current_state = 'FAILED',
                      last_error = 'Reaper: Stale lock exceeded max retries',
                      execution_lock = 0, 
                      lock_acquired_at = NULL,
                      lock_owner = NULL,
                      lock_version = lock_version + 1,
                      updated_at = ?
                  WHERE job_id = ?
                `).bind(new Date().toISOString(), job_id).run();
            }
        }

    } catch (e: any) {
        console.error("[Reaper] Error:", e.message);
    }
}
