
import { provisionSaaS } from "@/lib/campamento-base/saas-factory-orchestrator";
import { queryOne, run } from "@/lib/db";
import { JobRunner } from "@/lib/provisioning/job-runner";
import { setGlobalEnv } from "@/lib/cf";
import { exec } from "child_process";
import { promisify } from "util";
import Stripe from "stripe";
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
                        const cmd = `npx wrangler d1 execute drako_db_prod --local --json --command "${finalSql.replace(/"/g, '\\"')}"`;
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
                        const cmd = `npx wrangler d1 execute drako_db_prod --local --json --command "${finalSql.replace(/"/g, '\\"')}"`;
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
                        const cmd = `npx wrangler d1 execute drako_db_prod --local --json --command "${finalSql.replace(/"/g, '\\"')}"`;
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

// --- STRICT VERIFICATION ---
async function verifyProvisioning() {
    console.log("🚀 Starting Phase 1 Sign-off Verification: STRICT REAL ROLLBACK");

    const STRIPE_KEY = process.env.STRIPE_SECRET_KEY;
    const CF_TOKEN = process.env.CLOUDFLARE_API_TOKEN || process.env.CF_API_TOKEN;
    const CF_ZONE = process.env.CLOUDFLARE_ZONE_ID || process.env.CF_ZONE_ID || process.env.CLOUDFLARE_ZONE || process.env.CF_ZONE;
    const CF_ACCOUNT = process.env.CLOUDFLARE_ACCOUNT_ID || process.env.CF_ACCOUNT_ID;

    // 1. Hard Requirements Check
    if (!STRIPE_KEY || STRIPE_KEY.includes('mock')) {
        console.error("❌ FATAL: Real STRIPE_SECRET_KEY required for Gate A.");
        process.exit(1);
    }
    if (!CF_TOKEN || CF_TOKEN.includes('mock')) {
        console.error("❌ FATAL: Real CLOUDFLARE_API_TOKEN required for Gate A.");
        process.exit(1);
    }
    if (!CF_ZONE || CF_ZONE.includes('mock')) {
        console.error("❌ FATAL: Real CLOUDFLARE_ZONE_ID required for Gate A.");
        process.exit(1);
    }
    if (!CF_ACCOUNT || CF_ACCOUNT.includes('mock')) {
        console.error("❌ FATAL: Real CLOUDFLARE_ACCOUNT_ID required for Gate A.");
        process.exit(1);
    }

    const env = {
        DRACO_DB: new WranglerCurrentDb() as any,
        SESSION_SECRET: process.env.SESSION_SECRET || "mock",
        DRACO_PROVISIONING_MODE: "live",
        CLOUDFLARE_API_TOKEN: CF_TOKEN,
        CLOUDFLARE_ACCOUNT_ID: CF_ACCOUNT,
        CLOUDFLARE_ZONE_ID: CF_ZONE,
        STRIPE_SECRET_KEY: STRIPE_KEY,
        APP_URL: "https://drako.systems",
        PROVISIONING_FAULT_AT: "CLOUDFLARE_AFTER_CREATE"
    };

    setGlobalEnv(env as any);

    const unique = Date.now();
    const ownerId = "owner_strict_" + unique;
    const blueprint = {
        ownerTenantId: ownerId,
        saasName: "Strict Rollback Test " + unique,
        proposedSlug: "strict-" + unique,
        proposedSubdomain: "strict-" + unique,
        verticalId: "EDUCATION",
        summary: "Strict Verification",
        targetAudience: "Testers",
        mainProblem: "Testing",
        mainGoal: "Verify",
        packsByDepartment: { marketing: "BASIC" },
        initialPricing: { currentMonthlyPrice: 10 },
        aiProfile: { tier: "COST_SAVER" },
        campamentoBaseProfile: {
            departmentsEnabled: [],
            packsByDepartment: {},
            ownerPricingIntent: "LOW_COST",
            aiProfile: { preferredTier: "COST_SAVER", strategy: "COST_OPTIMIZED" }
        },
        provisioning: {
            stripe: { taxProfile: "ES_AUTONOMO", billingInterval: "MONTHLY", currency: "EUR" },
            domains: { primarySubdomain: "strict-" + unique, primaryDomainType: "SUBDOMAIN_ONLY" },
            ai: { tier: "COST_SAVER", preferredProviders: [] }
        }
    };

    console.log(`\n🧪 Injecting Fault: ${env.PROVISIONING_FAULT_AT}`);
    console.log(`   SaaS Slug: ${blueprint.proposedSlug}`);

    // Run Provisioning
    const res = await provisionSaaS({
        ownerTenantId: ownerId,
        blueprint: blueprint as any,
        env: env as any,
    });

    if (res.status !== 'FAILED') {
        throw new Error(`❌ Expected FAILED status, got ${res.status}`);
    }

    // Check Job State
    const jobId = await queryOne<any>(
        `SELECT job_id, current_state, payload_json, rollback_history_json FROM provisioning_jobs WHERE idempotency_key = ?`,
        `prov_saas_${blueprint.proposedSlug}`
    );

    const payload = JSON.parse(jobId.payload_json);
    const history = jobId.rollback_history_json;

    console.log("\n🔍 Analyzing Evidence...");
    console.log(`Job ID: ${jobId.job_id}`);
    console.log(`Rollback History: ${history}`);

    // EVIDENCE 1: Stripe
    const stripe = new Stripe(STRIPE_KEY, { apiVersion: '2025-12-15.clover' });
    const product = await stripe.products.retrieve(payload.stripeProductId);

    console.log(`\n🧾 Stripe Evidence:`);
    console.log(`   ID: ${product.id}`);
    console.log(`   Active: ${product.active}`);
    console.log(`   Metadata:`, product.metadata);

    if (product.active) throw new Error("❌ Stripe Product still ACTIVE (Rollback Failed)");
    if (product.metadata.orphaned_by_rollback !== 'true') throw new Error("❌ Stripe Metadata missing 'orphaned_by_rollback'");
    console.log("✅ Stripe Rollback Verified");

    // EVIDENCE 2: Cloudflare (with Retry)
    console.log(`\n☁️ Cloudflare Evidence:`);
    const hostname = blueprint.provisioning.domains.primarySubdomain + ".drako.systems";
    console.log(`   Target Hostname: ${hostname}`);
    console.log(`   Target ID: ${payload.cloudflareHostnameId}`);

    let retries = 5;
    let verifiedDeleted = false;

    while (retries > 0) {
        const url = `https://api.cloudflare.com/client/v4/zones/${CF_ZONE}/custom_hostnames?hostname=${encodeURIComponent(hostname)}`;
        const cfRes = await fetch(url, { headers: { Authorization: `Bearer ${CF_TOKEN}` } });
        const json: any = await cfRes.json();

        const exists = json.result?.find((r: any) => r.id === payload.cloudflareHostnameId);

        if (!exists) {
            console.log(`   Attempt ${6 - retries}: Hostname NOT found in list.`);
            verifiedDeleted = true;
            break;
        } else {
            console.log(`   Attempt ${6 - retries}: Hostname STILL exists (status: ${exists.status}). Retrying in 2s...`);
            await new Promise(r => setTimeout(r, 2000));
            retries--;
        }
    }

    if (!verifiedDeleted) {
        throw new Error("❌ Cloudflare Hostname still exists after retries (Rollback Failed)");
    }
    console.log("✅ Cloudflare Rollback Verified");

    console.log("\n🎉 GATE A PASSED: Strict Real Rollback Confirmed.");
}

verifyProvisioning().catch(e => {
    console.error(e);
    process.exit(1);
});
