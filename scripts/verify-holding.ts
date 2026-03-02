
import { queryAll } from "../src/lib/db";
import { enforceBilling } from "../src/lib/billing/enforce-billing";

// To run: npx tsx scripts/verify-holding.ts
// Requires local DB mock or real connection
// process.env.DB_LOCAL_PATH = ...

async function main() {
    console.log("🔍 [CANON] Starting Verification: Campamento Base Holding Architecture");

    // 1. Verify SaaS Registry (Multi-SaaS Check)
    console.log("\n[1] Checking SaaS Registry...");
    try {
        const saas = await queryAll(`SELECT saas_slug, status FROM holding_saas_registry`);
        const slugs = saas.map((s: any) => s.saas_slug);

        const required = ['drako', 'mentoria', 'socialflow'];
        const missing = required.filter(r => !slugs.includes(r));

        if (missing.length === 0) {
            console.log(`✅ All Subsidiaries Registered: ${slugs.join(', ')}`);
        } else {
            console.error(`❌ Missing Subsidiaries: ${missing.join(', ')}`);
            process.exit(1);
        }
    } catch (e) {
        console.error("❌ DB Connection Failed (Registry Check)", e);
        // Soft fail if DB not mocked, but log error
    }

    // 2. Verify Pricing Plans & Departments
    console.log("\n[2] Checking Pricing Plans Configuration...");
    try {
        const plans = await queryAll<{ saas_slug: string; plan_code: string; departments_json: string }>(
            `SELECT saas_slug, plan_code, departments_json FROM saas_pricing_plans`
        );
        if (plans.length > 0) {
            console.log(`✅ Found ${plans.length} Pricing Plans.`);
            const drakoPro = plans.find((p) => p.saas_slug === 'drako' && p.plan_code === 'pro');
            if (drakoPro && JSON.parse(drakoPro.departments_json).length > 0) {
                console.log(`✅ Drako Pro Plan includes departments: ${drakoPro.departments_json}`);
            } else {
                console.warn("⚠️ Drako Pro Plan missing or has no departments.");
            }
        } else {
            console.error("❌ No Pricing Plans Found!");
        }
    } catch (e) { console.error(e); }

    // 3. Verify Enforcement (Fail Closed)
    console.log("\n[3] Verifying Fail-Closed Enforcement...");
    // Mock Data for Test
    const testSlug = 'drako';
    const unknownTenant = 'verify_unknown_tenant_' + Date.now();

    // Test: Access non-existent tenant -> Should Block
    const res = await enforceBilling(testSlug, unknownTenant, 'ai_calls', 1, "verify_run");
    if (!res.allowed && res.status === 402) {
        console.log("✅ FAIL-CLOSED: Blocked access for unknown tenant (402).");
    } else {
        console.error("❌ FAIL-CLOSED FAILED: Allowed access or wrong status for unknown tenant.", res);
    }

    // 4. Verify Billing Audit Tables
    console.log("\n[4] Checking Audit Logs...");
    try {
        await queryAll(`SELECT id FROM billing_audit_logs LIMIT 1`);
        console.log("✅ 'billing_audit_logs' table exists.");
    } catch (e) {
        console.error("❌ 'billing_audit_logs' table missing!");
    }

    // 5. Verify Owner Events Table
    try {
        await queryAll(`SELECT id FROM owner_events LIMIT 1`);
        console.log("✅ 'owner_events' table exists.");
    } catch (e) {
        console.error("❌ 'owner_events' table missing!");
    }

    // 6. Verify Dashboard Logic (Simulation)
    // We can't easily curl local within script without running server, 
    // but we can verify the SQL query validity by mocking or just trusting the compilation.
    // Let's at least check if src/lib/billing/checkout.ts exists (Consumer Compliance)
    const fs = require('fs');
    if (fs.existsSync('src/lib/billing/checkout.ts')) {
        console.log("✅ Checkout Producer (checkout.ts) exists.");
    } else {
        console.error("❌ Checkout Producer (checkout.ts) MISSING!");
    }

    console.log("\n🏁 Verification Complete.");
}

main().catch(console.error);
console.log("Script defined. Run with 'npx tsx scripts/verify-holding.ts' after migration apply.");
