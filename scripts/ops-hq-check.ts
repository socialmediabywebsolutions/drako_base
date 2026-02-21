// @ts-expect-error - better-sqlite3 might not be in devDependencies
import Database from "better-sqlite3";
import path from "path";

const DB_PATH = path.resolve(".wrangler/state/v3/d1/miniflare-D1DatabaseObject/7b4cb7df529c21aa5c5ec2b49c7161b9e0571f3014168065406c6414777d853e.sqlite");

async function run() {
    console.log("🦅 DRAKO OVERSEER: HQ SNAPSHOT");
    console.log("--------------------------------");

    let db;
    try {
        db = new Database(DB_PATH, { readonly: true });
    } catch (e) {
        // Fallback for different local setups or if file not found exactly there
        // utilizing a relative path common in this project structure
        try {
            // searching in standard .wrangler path
            const fs = await import('fs');
            const find = (dir: string): string | null => {
                if (!fs.existsSync(dir)) return null;
                const files = fs.readdirSync(dir);
                for (const f of files) {
                    const full = path.join(dir, f);
                    if (f.endsWith('.sqlite')) return full;
                    if (fs.statSync(full).isDirectory()) {
                        const res = find(full);
                        if (res) return res;
                    }
                }
                return null;
            };
            const found = find('.wrangler/state/v3/d1');
            if (found) {
                db = new Database(found, { readonly: true });
            } else {
                throw new Error("Local D1 SQLite file not found.");
            }
        } catch (err) {
            console.error("❌ DB Access Failed: " + err);
            return;
        }
    }

    // 1. Fetch SaaS Instances
    const instances = db.prepare("SELECT * FROM saas_instances ORDER BY created_at DESC").all() as any[];

    // 2. Aggregate Stats
    const total = instances.length;
    const active = instances.filter(i => i.status === 'active').length;
    const trials = instances.filter(i => i.status === 'trial_active').length;
    const archived = instances.filter(i => i.status === 'archived').length;

    // Financials
    const mrr = instances.reduce((acc, curr) => acc + (curr.mrr_eur || 0), 0);
    const burn = instances.reduce((acc, curr) => acc + (curr.cost_eur || 0), 0);
    const margin = mrr - burn;

    // Risk
    const critical = instances.filter(i => i.risk_level === 'critical').length;
    const high = instances.filter(i => i.risk_level === 'high').length;

    // Report
    console.log(`\n📊 EMPIRE METRICS`);
    console.log(`   Total Assets:   ${total}`);
    console.log(`   Active SaaS:    ${active}`);
    console.log(`   Trials:         ${trials}`);
    console.log(`   Archived:       ${archived}`);

    console.log(`\n💰 FINANCIALS (Monthly)`);
    console.log(`   MRR:            €${mrr.toFixed(2)}`);
    console.log(`   Burn Rate:      €${burn.toFixed(2)}`);
    console.log(`   Net Margin:     €${margin.toFixed(2)}`);

    console.log(`\n⚠️ RISK RADAR`);
    console.log(`   Critical Risks: ${critical}`);
    console.log(`   High Risks:     ${high}`);

    if (critical > 0 || high > 0) {
        console.log("\nACTION REQUIRED: Review Overseer Dashboard immediately.");
    } else {
        console.log("\n✅ STATUS: NOMINAL");
    }

    console.log("\n--------------------------------");
    console.log("End of Snapshot.");
}

run();
