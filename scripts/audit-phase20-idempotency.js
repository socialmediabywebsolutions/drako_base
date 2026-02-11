const { execSync } = require('child_process');
const crypto = require('crypto');

console.log('🔍 AUDIT POINT 2: Idempotency Reality Check');

const testId = 'audit-' + crypto.randomUUID().substring(0, 8);
const saasId = `saas-${testId}`;
const tenantId = 'mentoria-core';

// Helper to extract JSON
function parseJson(str) {
    const idx = str.indexOf('[');
    return idx >= 0 ? JSON.parse(str.substring(idx)) : [];
}

try {
    // 1. Create test SaaS with billing cycle
    const now = new Date();
    const start = new Date(now); start.setDate(now.getDate() - 10);
    const end = new Date(now); end.setDate(now.getDate() + 20);
    const fmt = d => d.toISOString().split('T')[0];

    console.log(`\n📝 Creating test SaaS: ${saasId}`);
    execSync(`npx wrangler d1 execute drako_db_prod --local --command "DELETE FROM saas_instances WHERE id='${saasId}'"`, { stdio: 'inherit' });
    execSync(`npx wrangler d1 execute drako_db_prod --local --command "DELETE FROM stripe_invoice_runs WHERE saas_id='${saasId}'"`, { stdio: 'inherit' });

    execSync(`npx wrangler d1 execute drako_db_prod --local --command "INSERT INTO saas_instances (id, tenant_id, name, slug, status, billing_cycle_start, billing_cycle_end, stripe_customer_id, mrr_major) VALUES ('${saasId}', '${tenantId}', 'Audit Test', '${testId}', 'active', '${fmt(start)}', '${fmt(end)}', 'cus_mock_audit', 1000)"`, { stdio: 'inherit' });

    // 2. Insert overage events (3000 total)
    console.log('\n📝 Inserting overage events (3000 total)...');
    execSync(`npx wrangler d1 execute drako_db_prod --local --command "INSERT INTO economic_events (id, saas_id, tenant_id, event_type, amount_major, currency, created_at) VALUES ('evt1_${testId}', '${saasId}', '${tenantId}', 'SESSION_OVERAGE_BILLED', 1500, 'EUR', datetime('now')), ('evt2_${testId}', '${saasId}', '${tenantId}', 'SESSION_OVERAGE_BILLED', 1500, 'EUR', datetime('now'))"`, { stdio: 'inherit' });

    // 3. Capture initial MRR
    const initialMrrStr = execSync(`npx wrangler d1 execute drako_db_prod --local --command "SELECT mrr_major FROM saas_instances WHERE id='${saasId}'" --json`).toString();
    const initialMrr = parseJson(initialMrrStr)[0].results[0].mrr_major;
    console.log(`\n💰 Initial MRR: ${initialMrr}`);

    // 4. Run invoicer 3 times
    console.log('\n🔄 Running invoicer 3x consecutively...');
    console.log('   RUN 1:');
    execSync(`npx tsx scripts/run-invoicer-cli.ts ${saasId}`, { stdio: 'inherit', env: { ...process.env, STRIPE_MODE: 'mock' } });

    console.log('   RUN 2:');
    execSync(`npx tsx scripts/run-invoicer-cli.ts ${saasId}`, { stdio: 'inherit', env: { ...process.env, STRIPE_MODE: 'mock' } });

    console.log('   RUN 3:');
    execSync(`npx tsx scripts/run-invoicer-cli.ts ${saasId}`, { stdio: 'inherit', env: { ...process.env, STRIPE_MODE: 'mock' } });

    // 5. Verify only 1 invoice run exists
    console.log('\n🔍 Verifying idempotency...');
    const runsStr = execSync(`npx wrangler d1 execute drako_db_prod --local --command "SELECT * FROM stripe_invoice_runs WHERE saas_id='${saasId}'" --json`).toString();
    const runs = parseJson(runsStr)[0].results;

    console.log(`   Runs found: ${runs.length}`);
    if (runs.length !== 1) {
        throw new Error(`❌ IDEMPOTENCY FAILED: Expected 1 run, found ${runs.length}`);
    }

    const run = runs[0];
    console.log(`   Status: ${run.status}`);
    console.log(`   Amount: ${run.usage_major}`);
    console.log(`   Invoice ID: ${run.stripe_invoice_id}`);

    // 6. Verify MRR unchanged
    console.log('\n🔍 Verifying MRR isolation...');
    const finalMrrStr = execSync(`npx wrangler d1 execute drako_db_prod --local --command "SELECT mrr_major FROM saas_instances WHERE id='${saasId}'" --json`).toString();
    const finalMrr = parseJson(finalMrrStr)[0].results[0].mrr_major;

    console.log(`   Initial MRR: ${initialMrr}`);
    console.log(`   Final MRR:   ${finalMrr}`);

    if (initialMrr !== finalMrr) {
        throw new Error(`❌ MRR ISOLATION FAILED: MRR changed from ${initialMrr} to ${finalMrr}. Overage must NOT touch MRR!`);
    }

    // 7. Verify USAGE_INVOICE_CREATED event
    const evtStr = execSync(`npx wrangler d1 execute drako_db_prod --local --command "SELECT * FROM economic_events WHERE saas_id='${saasId}' AND event_type='USAGE_INVOICE_CREATED'" --json`).toString();
    const events = parseJson(evtStr)[0].results;

    if (events.length !== 1) {
        throw new Error(`❌ EVENT CHECK FAILED: Expected 1 USAGE_INVOICE_CREATED event, found ${events.length}`);
    }

    console.log('\n✅ AUDIT POINT 2: PASS');
    console.log('   ✓ Idempotency verified (3 runs = 1 invoice)');
    console.log(`   ✓ MRR isolation verified (${initialMrr} → ${finalMrr})`);
    console.log('   ✓ Governance event emitted (USAGE_INVOICE_CREATED)');

} catch (e) {
    console.error(`\n❌ AUDIT FAILED: ${e.message}`);
    process.exit(1);
}
