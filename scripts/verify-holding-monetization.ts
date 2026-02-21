
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

async function main() {
    console.log("🔍 [CANON] Verifying Campamento Base Holding (Local D1 via Wrangler)...");

    try {
        // 1. Check Registry
        console.log("\n[1] Check Registry...");
        const registry = await runQuery("SELECT saas_slug, status FROM holding_saas_registry");
        console.log(registry);
        if (!registry.includes('drako') || !registry.includes('mentoria')) {
            throw new Error("Missing subsidiaries in registry!");
        }

        // 2. Check Plans
        console.log("\n[2] Check Plans...");
        const plans = await runQuery("SELECT * FROM saas_pricing_plans");
        console.log(plans);
        if (!plans.includes('starter') || !plans.includes('scale')) {
            console.error("DEBUG: Plans table dump above.");
            throw new Error("Missing Drako plans!");
        }

        // 3. Check Audit Logs Table
        console.log("\n[3] Check Audit Logs Schema...");
        // PRAGMA table_info is standard SQLite
        const schema = await runQuery("PRAGMA table_info(billing_audit_logs)");
        if (!schema.includes('payload_json')) {
            throw new Error("Audit logs missing 'payload_json' column!");
        }
        if (!schema.includes('stripe_event_id')) {
            throw new Error("Audit logs missing 'stripe_event_id' column!");
        }
        console.log("✅ Audit Logs Schema verified (payload_json + stripe_event_id).");

        console.log("\n✨ CANON VERIFICATION SUCCESSFUL ✨");
        console.log("The local database is correctly seeded and schema-compliant.");

    } catch (error: any) {
        console.error("\n❌ VERIFICATION FAILED:", error.message);
        if (error.stdout) console.log(error.stdout);
        if (error.stderr) console.error(error.stderr);
        process.exit(1);
    }
}

async function runQuery(sql: string): Promise<string> {
    const cmd = `npx wrangler d1 execute drako_db_prod --local --command "${sql}"`;
    const { stdout } = await execAsync(cmd);
    return stdout;
}

main().catch(console.error);
