
import { resolveSaasContext, listSaasDomains } from "@/lib/saas/repository";
import { JobRunner } from "@/lib/provisioning/job-runner"; // We can't access private methods easily, we'll verify via Job API if possible or DB check
import { run, queryOne } from "@/lib/db";
import { setGlobalEnv } from "@/lib/cf";
import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs";
import path from "path";

const execAsync = promisify(exec);

// --- Load Env Local ---
function loadEnv() {
    const envPath = path.resolve(process.cwd(), '.env.local');
    if (fs.existsSync(envPath)) {
        const content = fs.readFileSync(envPath, 'utf8');
        content.split('\n').forEach(line => {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) return;
            const [key, ...rest] = trimmed.split('=');
            if (key) {
                const val = rest.join('=').replace(/^"|"$/g, '').replace(/^'|'$/g, '');
                process.env[key.trim()] = val;
            }
        });
    }
}
loadEnv();

// --- Wrangler Proxy DB (Simplified) ---
function serialize(val: any): string {
    if (val === null || val === undefined) return 'NULL';
    if (typeof val === 'number') return String(val);
    if (typeof val === 'boolean') return val ? '1' : '0';
    if (typeof val === 'object') return `'${JSON.stringify(val).replace(/'/g, "''")}'`;
    return `'${String(val).replace(/'/g, "''")}'`;
}

function injectParams(sql: string, params: any[]): string {
    let i = 0;
    return sql.replace(/\?/g, () => {
        if (i >= params.length) return 'NULL';
        return serialize(params[i++]);
    });
}

class WranglerCurrentDb {
    prepare(sql: string) {
        return {
            bind: (...args: any[]) => {
                const finalSql = injectParams(sql, args).replace(/\n/g, ' ').replace(/\r/g, ' ');
                return {
                    all: async () => {
                        const cmd = `npx wrangler d1 execute drako_db_prod --local --json --command "${finalSql.replace(/"/g, '\\"')}"`;
                        try {
                            const { stdout } = await execAsync(cmd);
                            const json = JSON.parse(stdout);
                            const res = Array.isArray(json) ? json[0] : json;
                            return { results: res.results || [] };
                        } catch (e: any) {
                            return { results: [] };
                        }
                    },
                    run: async () => {
                        const cmd = `npx wrangler d1 execute drako_db_prod --local --json --command "${finalSql.replace(/"/g, '\\"')}"`;
                        try {
                            const { stdout } = await execAsync(cmd);
                            const json = JSON.parse(stdout);
                            const res = Array.isArray(json) ? json[0] : json;
                            return { success: res.success, meta: res.meta };
                        } catch (e: any) {
                            return { success: false };
                        }
                    },
                    first: async () => {
                        const cmd = `npx wrangler d1 execute drako_db_prod --local --json --command "${finalSql.replace(/"/g, '\\"')}"`;
                        try {
                            const { stdout } = await execAsync(cmd);
                            const json = JSON.parse(stdout);
                            const res = Array.isArray(json) ? json[0] : json;
                            return res.results?.[0] || null;
                        } catch (e: any) {
                            return null;
                        }
                    }
                };
            }
        };
    }
}

async function verifyIsolation() {
    console.log("🚀 Starting Phase 2 Check: Multi-Tenant Isolation");

    const env = { DRACO_DB: new WranglerCurrentDb() as any };
    setGlobalEnv(env as any);

    const tenantA = "tenant_A_" + Date.now();
    const tenantB = "tenant_B_" + Date.now();
    const saasA_Id = "saas_A_" + Date.now();

    console.log(`Creating SaaS for ${tenantA}...`);
    // 1. Setup SaaS A directly in DB (simulating existing)
    await run(
        `INSERT INTO saas (id, name, slug, status, tenant_id, created_at) VALUES (?, 'SaaS A', ?, 'active', ?, ?)`,
        saasA_Id, `slug-a-${Date.now()}`, tenantA, new Date().toISOString()
    );

    // 2. Test: Proper Access (A accessing A)
    try {
        console.log("TEST 1: Tenant A accessing SaaS A (Should Pass)");
        await resolveSaasContext({ tenantId: tenantA, saasId: saasA_Id, env: env as any });
        console.log("✅ Passed");
    } catch (e: any) {
        console.error("❌ FAILED: Valid access rejected", e.message);
        process.exit(1);
    }

    // 3. Test: Cross-Tenant Access (B accessing A)
    try {
        console.log("TEST 2: Tenant B accessing SaaS A (Should Fail)");
        await resolveSaasContext({ tenantId: tenantB, saasId: saasA_Id, env: env as any });
        console.error("❌ FAILED: Invalid access ALLOWED!");
        process.exit(1);
    } catch (e: any) {
        if (e.message.includes("SecurityError")) {
            console.log("✅ Passed: Blocked with SecurityError");
        } else {
            console.error("❌ FAILED: Unexpected error", e.message);
            process.exit(1);
        }
    }

    console.log("🎉 Phase 2 Isolation Verified.");
}

verifyIsolation().catch(e => {
    console.error(e);
    process.exit(1);
})
