// scripts/verify-lifecycle.js
// Usage: node scripts/verify-lifecycle.js

const { spawn } = require('child_process');

const fs = require('fs');
const path = require('path');

async function runCommand(command, args, cwd) {
    return new Promise((resolve, reject) => {
        console.log(`> ${command} ${args.join(' ')}`);
        const proc = spawn(command, args, { cwd: cwd || process.cwd(), shell: true });
        let stdout = '';
        let stderr = '';
        proc.stdout.on('data', (d) => { stdout += d.toString(); }); // console.log(d.toString().trim()); // Silent stdout to keep clean
        proc.stderr.on('data', (d) => { stderr += d.toString(); console.error(d.toString().trim()); });
        proc.on('close', (code) => {
            if (code === 0) resolve(stdout);
            else reject(new Error(`Command failed with code ${code}`));
        });
    });
}

async function verify() {
    const tempSqlPath = path.join(__dirname, 'temp_verify.sql');
    try {
        console.log("=== STARTING LIFECYCLE VERIFICATION ===");

        const saasId = `test_lifecycle_${Date.now()}`;
        const tenantId = 'demo-tenant';

        // 1. Inject Test Instance in ACTIVE state
        const createSql = `
            INSERT INTO saas_instances (id, tenant_id, slug, name, status, lifecycle_status, past_due_since)
            VALUES ('${saasId}', '${tenantId}', '${saasId}', 'Lifecycle Test', 'active', 'active', NULL);
        `;
        fs.writeFileSync(tempSqlPath, createSql);
        await runCommand("npx", ["wrangler", "d1", "execute", "drako_db_prod", "--local", "--file", "scripts/temp_verify.sql"]);

        // 2. Force PAST_DUE state with timestamp 8 days ago
        const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();
        const updateSql = `
            UPDATE saas_instances 
            SET lifecycle_status = 'past_due', past_due_since = '${eightDaysAgo}'
            WHERE id = '${saasId}';
        `;
        fs.writeFileSync(tempSqlPath, updateSql);
        await runCommand("npx", ["wrangler", "d1", "execute", "drako_db_prod", "--local", "--file", "scripts/temp_verify.sql"]);
        console.log("✅ Injected PAST_DUE instance with 8 days delay.");

        // 3. Trigger Overseer Logic (Simulated via SQL)
        const logicSql = `
            UPDATE saas_instances
            SET lifecycle_status = 'paused', paused_at = datetime('now')
            WHERE id = '${saasId}' 
            AND lifecycle_status = 'past_due'
            AND (julianday('now') - julianday(past_due_since)) >= 7;
         `;
        fs.writeFileSync(tempSqlPath, logicSql);
        await runCommand("npx", ["wrangler", "d1", "execute", "drako_db_prod", "--local", "--file", "scripts/temp_verify.sql"]);

        // 4. Verify Result
        const verifySql = `SELECT id, lifecycle_status, past_due_since, paused_at FROM saas_instances WHERE id = '${saasId}'`;
        fs.writeFileSync(tempSqlPath, verifySql);
        const output = await runCommand("npx", ["wrangler", "d1", "execute", "drako_db_prod", "--local", "--file", "scripts/temp_verify.sql"]);

        if (output.includes("paused")) {
            console.log("✅ SUCCESS: Instance auto-paused after grace period.");
        } else {
            console.error("❌ FAILURE: Instance did NOT pause. Output:\n", output);
            throw new Error("Verification failed");
        }

        // Cleanup
        fs.writeFileSync(tempSqlPath, `DELETE FROM saas_instances WHERE id = '${saasId}'`);
        await runCommand("npx", ["wrangler", "d1", "execute", "drako_db_prod", "--local", "--file", "scripts/temp_verify.sql"]);

    } catch (e) {
        console.error("Verification crashed:", e);
        process.exit(1);
    } finally {
        if (fs.existsSync(tempSqlPath)) fs.unlinkSync(tempSqlPath);
    }
}

verify();
