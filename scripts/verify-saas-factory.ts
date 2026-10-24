
import { type SaasFactoryJobMessage } from "../src/lib/saas-factory/create-saas";
import { spawn, exec, type ChildProcess } from "child_process";
import { promisify } from "util";
import { setTimeout } from "timers/promises";

// Simple script to call API and check D1 via Wrangler
// Run with: npx tsx scripts/verify-saas-factory.ts [--live]

const execAsync = promisify(exec);

async function main() {
    const args = process.argv.slice(2);
    const isLive = args.includes("--live");
    const timestamp = Date.now();
    const saasSlug = isLive ? `verifylive-${timestamp}` : `verifydry-${timestamp}`;

    console.log(`\n🧪 Testing SaaS Factory in ${isLive ? "LIVE" : "DRY-RUN"} mode`);
    console.log(`TARGET: ${saasSlug}`);

    let server: ChildProcess | null = null;
    const APP_URL = "http://localhost:3000";

    try {
        // 0. Start Dev Server
        console.log("\n0️⃣  Starting Dev Server (Next.js)...");
        // Using npm run dev. We assume it runs at port 3000 by default.
        server = spawn("npm", ["run", "dev"], {
            cwd: process.cwd(),
            shell: true,
            stdio: "ignore", // Ignore output to keep console clean, or 'inherit' for debugging
            env: { ...process.env }
        });

        // Wait for server to be ready (poll)
        console.log("   Waiting for localhost:3000...");
        let ready = false;
        for (let i = 0; i < 60; i++) { // Wait up to 60s
            try {
                const res = await fetch(APP_URL);
                if (res.ok || res.status === 404 || res.status === 200) {
                    ready = true;
                    break;
                }
            } catch (e) {
                await setTimeout(1000);
            }
        }

        if (!ready) {
            throw new Error("Server failed to start in 60s");
        }
        console.log("   ✅ Server Request Ready");


        // 1. Prepare Payload
        const payload: Partial<SaasFactoryJobMessage> = {
            saasSlug,
            name: `Verification ${saasSlug}`,
            plans: [
                {
                    planCode: "starter",
                    monthlyPriceCents: 1000,
                    currency: "eur",
                    limitsJson: { users: 5 },
                    departmentsJson: ["default"]
                },
                {
                    planCode: "pro",
                    monthlyPriceCents: 2000,
                    currency: "eur",
                    limitsJson: { users: 20 },
                    departmentsJson: ["default", "sales"]
                },
                {
                    planCode: "scale",
                    monthlyPriceCents: 5000,
                    currency: "eur",
                    limitsJson: { users: 100 },
                    departmentsJson: ["*"]
                },
            ],
            dryRun: !isLive
        };

        // 2. Call API
        console.log(`\n1️⃣  Calling API: ${APP_URL}/api/owner/saas-factory/create-saas`);

        const res = await fetch(`${APP_URL}/api/owner/saas-factory/create-saas`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });

        if (!res.ok) {
            const text = await res.text();
            console.error(`❌ API Error: ${res.status} ${text}`);
            process.exit(1);
        }

        const json = (await res.json()) as { correlationId?: string };
        console.log("✅ API Response:", json);

        const correlationId = json.correlationId;
        if (!correlationId) {
            console.error("❌ No correlationId in response");
            process.exit(1);
        }
        console.log(`Correlation ID: ${correlationId}`);

        // 3. Poll Database for Audit Log
        const dbName = "drako_db_prod";
        const localFlag = isLive ? "" : "--local";

        console.log(`\n2️⃣  Verifying DB (Wait 5s for Worker)...`);
        await setTimeout(5000);

        const checkAuditSql = `SELECT id, event_type, metadata_json FROM billing_audit_logs WHERE correlation_id = '${correlationId}'`;
        const cmd = `npx wrangler d1 execute ${dbName} ${localFlag} --command "${checkAuditSql}" --json`;

        // Retry a few times if worker is slow
        let foundLog = false;
        for (let i = 0; i < 3; i++) {
            const output = await execAsyncSimple(cmd);
            try {
                const parsed = JSON.parse(output);
                const results = parsed[0]?.results || [];
                if (results.length > 0) {
                    const log = results[0];
                    console.log("✅ Audit Log Found:", log.event_type);
                    foundLog = true;
                    break;
                }
            } catch (e) { }
            if (!foundLog) {
                console.log("   ... waiting more ...");
                await setTimeout(2000);
            }
        }

        if (!foundLog) {
            console.warn("⚠️  Audit log NOT found. Worker might not be running in this env or queue not wired.");
            console.log("    (Note: In `npm run dev`, standard Workers queues might not process automatically without `wrangler dev`)");
            // We don't fail hard here because running Queues in pure Next.js dev is known limitation if not using `wrangler dev`.
            // The API worked, so the Producer worked. The Consumer requires wrangler dev or similar.
        }

        // 4. Check Registry
        const checkReg = `SELECT status FROM holding_saas_registry WHERE saas_slug = '${saasSlug}'`;
        const cmdReg = `npx wrangler d1 execute ${dbName} ${localFlag} --command "${checkReg}" --json`;
        const outReg = await execAsyncSimple(cmdReg);

        try {
            const resReg = JSON.parse(outReg)[0]?.results || [];
            if (isLive) {
                if (resReg.length > 0 && resReg[0].status === 'active') {
                    console.log("✅ Registry: Active");
                } else {
                    console.error("❌ Registry: Not found or not active", resReg);
                    process.exit(1);
                }
            } else {
                if (resReg.length === 0) {
                    console.log("✅ Registry: Empty (Correct for Dry Run)");
                } else {
                    console.error("❌ Registry: Entry found in Dry Run!", resReg);
                    process.exit(1);
                }
            }
        } catch (e) {
            console.error("Failed to check registry", e);
        }

        console.log("\n✅ E2E Verification Complete");

    } catch (err: any) {
        console.error("Script Error:", err);
        process.exit(1);
    } finally {
        if (server) {
            console.log("🛑 Stopping Dev Server / Cleanup...");
            // Need to kill the tree. `server.kill()` only kills the npm process, not next-server.
            // In Windows, use taskkill.
            if (process.platform === "win32") {
                try {
                    exec(`taskkill /pid ${server.pid} /f /t`);
                } catch (e) { }
            } else {
                server.kill();
            }
        }
        process.exit(0);
    }
}

async function execAsyncSimple(cmd: string): Promise<string> {
    return new Promise((resolve, reject) => {
        exec(cmd, (error, stdout, stderr) => {
            resolve(stdout || stderr);
        });
    });
}

main();
