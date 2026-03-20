
import { processScheduledPosts } from "@/lib/social/scheduler";
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
        console.log("Loading .env.local...");
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

// --- Wrangler Proxy DB ---
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
                        const cmd = `npx wrangler d1 execute drako_db_prod --local --config wrangler.workers.toml --json --command "${finalSql.replace(/"/g, '\\"')}"`;
                        try {
                            const { stdout } = await execAsync(cmd);
                            const json = JSON.parse(stdout);
                            const res = Array.isArray(json) ? json[0] : json;
                            return { results: res.results || [] };
                        } catch (e: any) {
                            console.error("Wrangler Exec Failed:", e.message);
                            return { results: [] };
                        }
                    },
                    run: async () => {
                        const cmd = `npx wrangler d1 execute drako_db_prod --local --config wrangler.workers.toml --json --command "${finalSql.replace(/"/g, '\\"')}"`;
                        try {
                            const { stdout } = await execAsync(cmd);
                            const json = JSON.parse(stdout);
                            const res = Array.isArray(json) ? json[0] : json;
                            return { success: res.success, meta: res.meta };
                        } catch (e: any) {
                            console.error("Wrangler Exec Failed:", e.message);
                            return { success: false };
                        }
                    },
                    first: async () => {
                        const cmd = `npx wrangler d1 execute drako_db_prod --local --config wrangler.workers.toml --json --command "${finalSql.replace(/"/g, '\\"')}"`;
                        try {
                            const { stdout } = await execAsync(cmd);
                            const json = JSON.parse(stdout);
                            const res = Array.isArray(json) ? json[0] : json;
                            return res.results?.[0] || null;
                        } catch (e: any) {
                            console.error("Wrangler Exec Failed:", e.message);
                            return null;
                        }
                    }
                };
            }
        };
    }
}

async function runTest() {
    console.log("🚀 Starting SocialFlow Scheduler Test");

    const mockDb = new WranglerCurrentDb();
    
    // Mock Env
    setGlobalEnv({
        DRACO_DB: mockDb as any,
        SESSION_SECRET: "mock",
        // Add other necessary mocked bindings if needed
    } as any);

    const testId = `test_post_${Date.now()}`;
    const tenantId = "test_tenant_script";
    const saasId = "test_saas_script";
    const now = new Date();
    const past = new Date(now.getTime() - 1000 * 60 * 60).toISOString(); // 1 hour ago

    try {
        console.log("1. Creating test post in SCHEDULED state (in the past)...");
        await mockDb.prepare(`
            INSERT INTO saas_social_posts (
                id, tenant_id, saas_id, provider, content_type, title, body, status, scheduled_at, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
            testId, tenantId, saasId, "LINKEDIN", "FEED", "Script Test Post", "Testing from script", 
            "SCHEDULED", past, now.toISOString(), now.toISOString()
        ).run();

        console.log("2. Running Scheduler...");
        const logs = await processScheduledPosts();
        console.log("Scheduler Logs:", logs);

        console.log("3. Verifying Post Status...");
        const rawPost = await mockDb
            .prepare("SELECT status, posted_at FROM saas_social_posts WHERE id = ?")
            .bind(testId)
            .first();
        const post = rawPost as { status: string; posted_at: string } | null;

        if (post?.status === "PUBLISHED" && post.posted_at) {
            console.log("✅ SUCCESS: Post was published!");
            console.log(`   Status: ${post.status}`);
            console.log(`   PostedAt: ${post.posted_at}`);
        } else {
            console.error("❌ FAILURE: Post was NOT published.");
            console.log(`   Status: ${post?.status}`);
        }

    } catch (e) {
        console.error("Test Error:", e);
    } finally {
        console.log("4. Cleanup...");
        await mockDb.prepare("DELETE FROM saas_social_posts WHERE id = ?").bind(testId).run();
    }
}

runTest();
