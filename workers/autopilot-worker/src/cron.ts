import { AutopilotEnv } from "./index";

/**
 * Handle Scheduled Tasks
 * - Monthly Cost Reset: Idempotent reset of cost counters.
 */
export async function handleScheduledReset(env: AutopilotEnv): Promise<void> {
    const db = env.DRACO_DB;
    const now = new Date();
    const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`; // YYYY-MM

    // Idempotent Reset Query
    // Logic: If the stored 'current_month' is different from 'currentMonthKey' (or NULL),
    // it means we entered a new month. Reset cost to 0 and update month key.
    // We do this for all policies.

    // Note: D1 doesn't support RETURNING with UPDATE for multiple rows easily to log individually without loop.
    // For V1 Ops, we just execute the bulk update.

    const result: any = await db.prepare(`
        UPDATE ai_cost_policies 
        SET current_cost_usd = 0.0, 
            current_month = ?,
            updated_at = ? 
        WHERE current_month != ? OR current_month IS NULL
    `).bind(currentMonthKey, now.toISOString(), currentMonthKey).run();

    if (result.meta?.changes > 0) {
        console.log(`[CRON] Monthly Cost Reset executed. Updated ${result.meta.changes} policies to month ${currentMonthKey}.`);

        // Log System Event (Optional Table or Console)
        // We rely on the console log picked up by Infinity Ops tail.
        // "AI_COST_RESET" event.
    }
}
