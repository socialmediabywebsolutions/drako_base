
import { run } from "@/lib/db";

async function main() {
    console.log("🌱 Seeding Canon Data...");

    // 1. Ensure Tables Exist (Idempotent Create - simplified for local fix)
    // We rely on migrations for prod, but for local verify if migrations failed, we can try to create if missing
    // or assume they exist from partial migration. 
    // Actually, if migration 0126 failed, tables might not exist.
    // Let's assume tables 'holding_saas_registry' etc MIGHT be missing if 0126 failed.
    // But error was 'saas_agents already exists' (0111). 0126 is much later. 
    // So 0126 likely NOT applied.

    // FORCE CREATE TABLES LOCALLY (Safe for verification context)
    await run(`CREATE TABLE IF NOT EXISTS holding_saas_registry (
        saas_slug TEXT PRIMARY KEY,
        display_name TEXT,
        status TEXT DEFAULT 'active',
        created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    )`);

    await run(`CREATE TABLE IF NOT EXISTS saas_pricing_plans (
        id TEXT PRIMARY KEY,
        saas_slug TEXT NOT NULL,
        plan_code TEXT NOT NULL,
        stripe_product_id TEXT,
        stripe_price_id TEXT,
        monthly_price_cents INTEGER NOT NULL DEFAULT 0,
        currency TEXT DEFAULT 'eur',
        limits_json TEXT NOT NULL DEFAULT '{}',
        departments_json TEXT NOT NULL DEFAULT '[]',
        features_json TEXT NOT NULL DEFAULT '{}',
        is_active BOOLEAN DEFAULT 1,
        created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
        UNIQUE(saas_slug, plan_code)
    )`);

    await run(`CREATE TABLE IF NOT EXISTS saas_subscriptions (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        saas_slug TEXT NOT NULL,
        plan_code TEXT NOT NULL,
        status TEXT DEFAULT 'active',
        stripe_customer_id TEXT,
        stripe_subscription_id TEXT,
        current_period_start TEXT,
        current_period_end TEXT,
        cancel_at_period_end INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
        updated_at TEXT,
        UNIQUE(tenant_id, saas_slug)
    )`);

    await run(`CREATE TABLE IF NOT EXISTS saas_usage_quotas (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        saas_slug TEXT NOT NULL,
        quota_key TEXT NOT NULL,
        limit_value INTEGER NOT NULL DEFAULT -1,
        current_value INTEGER DEFAULT 0,
        period_start TEXT,
        period_end TEXT,
        reset_at TEXT,
        created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
        UNIQUE(tenant_id, saas_slug, quota_key)
    )`);

    await run(`CREATE TABLE IF NOT EXISTS billing_audit_logs (
        id TEXT PRIMARY KEY,
        correlation_id TEXT,
        saas_slug TEXT,
        tenant_id TEXT,
        event_type TEXT,
        payload_json TEXT, 
        metadata_json TEXT,
        severity TEXT DEFAULT 'info',
        created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    )`);

    await run(`CREATE TABLE IF NOT EXISTS owner_events (
        id TEXT PRIMARY KEY,
        event_type TEXT,
        payload_json TEXT,
        created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    )`);

    console.log("✅ Tables ensured.");

    // 2. Seed Registry
    const subsidiaries = ['drako', 'mentoria', 'socialflow'];
    for (const slug of subsidiaries) {
        await run(
            `INSERT INTO holding_saas_registry (saas_slug, display_name, status) VALUES (?, ?, 'active') 
             ON CONFLICT(saas_slug) DO NOTHING`,
            slug, slug.charAt(0).toUpperCase() + slug.slice(1)
        );
    }
    console.log("✅ Registry seeded: Drako, Mentoria, SocialFlow.");

    // 3. Seed Plans
    const plans = [
        { code: 'starter', price: 2900, limits: { workspaces: 1, users: 5 } },
        { code: 'pro', price: 9900, limits: { workspaces: 5, users: 20 } },
        { code: 'scale', price: 29900, limits: { workspaces: 20, users: 100 } }
    ];

    for (const slug of subsidiaries) {
        for (const p of plans) {
            await run(
                `INSERT INTO saas_pricing_plans (id, saas_slug, plan_code, monthly_price_cents, limits_json, departments_json) 
                 VALUES (?, ?, ?, ?, ?, '[]') 
                 ON CONFLICT(saas_slug, plan_code) DO NOTHING`,
                `${slug}_${p.code}`, slug, p.code, p.price, JSON.stringify(p.limits)
            );
        }
    }
    console.log("✅ Plans seeded.");
}

main().catch(console.error);
