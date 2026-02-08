
// scripts/backfill-lifecycle.js
// Usage: node scripts/backfill-lifecycle.js

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

async function runCommand(command, args, cwd) {
    return new Promise((resolve, reject) => {
        console.log(`> ${command} ${args.join(' ')}`);
        const proc = spawn(command, args, { cwd: cwd || process.cwd(), shell: true });
        let stdout = '';
        let stderr = '';
        proc.stdout.on('data', (d) => { stdout += d.toString(); });
        proc.stderr.on('data', (d) => { stderr += d.toString(); console.error(d.toString().trim()); });
        proc.on('close', (code) => {
            if (code === 0) resolve(stdout);
            else reject(new Error(`Command failed with code ${code}`));
        });
    });
}

async function backfill() {
    const tempSqlPath = path.join(__dirname, 'temp_backfill.sql');
    try {
        console.log("=== STARTING LIFECYCLE BACKFILL ===");

        // 1. Set default 'active' for NULL lifecycle_status
        // Logic: if stripe_status is 'active' or NULL => 'active'
        // If stripe_status is 'past_due' => 'past_due'
        // If stripe_status is 'canceled' => 'archived'

        const sql = `
            -- 1. Default NULL to 'active' (Unsafe? No, safe for now as we are just enabling the feature)
            UPDATE saas_instances 
            SET lifecycle_status = 'active' 
            WHERE lifecycle_status IS NULL;

            -- 2. Correct based on Stripe Status if available
            UPDATE saas_instances 
            SET lifecycle_status = 'past_due', past_due_since = datetime('now')
            WHERE stripe_status = 'past_due' AND lifecycle_status != 'past_due';

            UPDATE saas_instances 
            SET lifecycle_status = 'active', past_due_since = NULL, paused_at = NULL
            WHERE stripe_status = 'active' AND lifecycle_status != 'active';

            -- 3. Archive canceled
            UPDATE saas_instances
            SET lifecycle_status = 'archived', archived_at = datetime('now'), retention_until = datetime('now', '+30 days')
            WHERE stripe_status = 'canceled' AND lifecycle_status != 'archived';

            -- 4. Audit Log
            INSERT INTO economic_events (id, tenant_id, saas_id, type, severity, message, created_at)
            SELECT 'evt_backfill_' || id, tenant_id, id, 'LIFECYCLE_BACKFILL', 'info', 'Backfilled lifecycle status', datetime('now')
            FROM saas_instances;
        `;

        fs.writeFileSync(tempSqlPath, sql);

        // Execute on REMOTE (PROD)
        console.log("Running backfill on REMOTE drako_db_prod...");
        await runCommand("npx", ["wrangler", "d1", "execute", "drako_db_prod", "--remote", "--file", "scripts/temp_backfill.sql"]);

        console.log("✅ Backfill Complete.");

    } catch (e) {
        console.error("Backfill failed:", e);
        process.exit(1);
    } finally {
        if (fs.existsSync(tempSqlPath)) fs.unlinkSync(tempSqlPath);
    }
}

backfill();
