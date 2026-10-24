const { execSync } = require('child_process');

function runSql(sql) {
    try {
        const safeSql = sql.replace(/"/g, '\\"');
        console.log(`Executing: ${sql}`);
        execSync(`npx wrangler d1 execute drako_db_prod --local --command "${safeSql}"`, { stdio: 'inherit' });
    } catch (e) {
        if (e.message.includes('duplicate column name')) {
            console.log('   -> Column already exists, skipping.');
        } else {
            console.error('   -> Error:', e.message);
            // Don't exit, try next statements (best effort for "ADD COLUMN")
        }
    }
}

console.log('🔄 Applying Migration 0122 (Stripe Invoicing)...');

// 1. Create Table
runSql(`CREATE TABLE IF NOT EXISTS stripe_invoice_runs (
    id TEXT PRIMARY KEY,
    saas_id TEXT NOT NULL,
    tenant_id TEXT NOT NULL,
    cycle_start TEXT NOT NULL,
    cycle_end TEXT NOT NULL,
    status TEXT NOT NULL,
    stripe_invoice_id TEXT,
    usage_major INTEGER DEFAULT 0,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (saas_id) REFERENCES saas_instances(id)
)`);

runSql(`CREATE UNIQUE INDEX IF NOT EXISTS idx_stripe_invoice_runs_idempotency 
ON stripe_invoice_runs(saas_id, cycle_start, cycle_end)`);

// 2. Add Columns (Try individually)
runSql(`ALTER TABLE saas_instances ADD COLUMN stripe_customer_id TEXT`);
runSql(`ALTER TABLE saas_instances ADD COLUMN stripe_subscription_id TEXT`);
runSql(`ALTER TABLE saas_instances ADD COLUMN stripe_status TEXT`);

// 3. Audit
runSql(`INSERT INTO economic_events (id, saas_id, tenant_id, event_type, amount_major, currency, metadata_json, created_at)
VALUES (
    'evt_mig_0122_' || hex(randomblob(4)), 
    'system', 
    'system', 
    'MIGRATION_APPLIED', 
    0, 
    'EUR', 
    '{"migration": "0122_stripe_invoicing.sql", "description": "Added stripe_invoice_runs and saas_instances stripe fields"}', 
    datetime('now')
)`);

console.log('✅ Migration 0122 Applied.');
