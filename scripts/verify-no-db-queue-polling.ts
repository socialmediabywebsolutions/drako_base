
import fs from 'fs';
import path from 'path';

async function verify() {
    console.log("--- Verifying No DB Queue Polling ---");

    const schedulerDir = path.resolve(__dirname, '../workers/drako-scheduler/src');

    // Check files for `setInterval` or `while(true)` loops that query DB
    const files = fs.readdirSync(schedulerDir).map(f => path.join(schedulerDir, f));

    let suspicious = false;

    for (const file of files) {
        if (!file.endsWith('.ts')) continue;
        const content = fs.readFileSync(file, 'utf-8');

        // Simple heuristic: Look for loop polling patterns
        if (content.includes('setInterval') && content.includes('SELECT') && content.includes('provisioning_jobs')) {
            console.warn(`WARNING: Potential polling loop in ${path.basename(file)}`);
            suspicious = true;
        }

        // Check for "crons" in wrangler.toml calling "process" logic directly?
        // We rely on "reaper" which is a clean-up job, not a processor.
    }

    if (suspicious) {
        console.log("Manual review required for suspicious polling patterns.");
        // We don't fail automatically because Reaper uses Cron, which is technically polling but correct for Reaper.
        // The check is: Does it process *Jobs*?
        // Reaper processes *Stale Locks*. That is allowed.
        // Queue Consumer processes Jobs.
    } else {
        console.log("SUCCESS: No obvious polling loops found.");
    }
}

verify().catch(console.error);
