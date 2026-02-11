const { execSync } = require('child_process');
const crypto = require('crypto');

console.log('🏭 Verifying MentorIA Invoicing (Phase 20)...');

const tenantId = 'mentoria-core';
const testSaaSId = 'saas-inv-test-' + crypto.randomUUID().substring(0, 8);
const clientId = 'client-inv-01';
const mentorId = 'mentor-inv-01';

try {
    // 1. Setup Data: SaaS + 2 Overage Sessions
    console.log('📝 Setting up Test SaaS & Overage Events...');

    const now = new Date();
    const cycleStart = new Date(now); cycleStart.setDate(now.getDate() - 15);
    const cycleEnd = new Date(now); cycleEnd.setDate(now.getDate() + 15);

    const fmt = d => d.toISOString().split('T')[0];
    const sStr = fmt(cycleStart);
    const eStr = fmt(cycleEnd);

    // Clean up
    try {
        execSync(`npx wrangler d1 execute drako_db_prod --local --command "DELETE FROM saas_instances WHERE id LIKE 'saas-inv-test-%'"`, { stdio: 'ignore' });
        execSync(`npx wrangler d1 execute drako_db_prod --local --command "DELETE FROM stripe_invoice_runs WHERE saas_id LIKE 'saas-inv-test-%'"`, { stdio: 'ignore' });
    } catch (e) { }

    // Mock Customer ID
    const custId = 'cus_mock_' + crypto.randomUUID().substring(0, 8);

    execSync(`npx wrangler d1 execute drako_db_prod --local --command "INSERT INTO saas_instances (id, tenant_id, name, slug, status, plan_tier, created_at, mrr_major, cost_est_major, pricing_plan_id, billing_cycle_start, billing_cycle_end, billing_anchor_day, stripe_customer_id) VALUES ('${testSaaSId}', '${tenantId}', 'Inv Test SaaS', 'inv-test', 'active', 'mentoria_ia', datetime('now'), 0, 0, 'plan_mentoria_free', '${sStr}', '${eStr}', ${now.getDate()}, '${custId}')"`, { stdio: 'inherit' });

    // Insert 2 Overage Events (Simulate Overages directly in Events table)
    // 1500 + 1500 = 3000
    const amt1 = 1500;
    const amt2 = 1500;

    // We insert events with created_at NOW (inside cycle)
    execSync(`npx wrangler d1 execute drako_db_prod --local --command "INSERT INTO economic_events (id, saas_id, tenant_id, event_type, amount_major, currency, created_at) VALUES ('evt_1_${testSaaSId}', '${testSaaSId}', '${tenantId}', 'SESSION_OVERAGE_BILLED', ${amt1}, 'EUR', datetime('now')), ('evt_2_${testSaaSId}', '${testSaaSId}', '${tenantId}', 'SESSION_OVERAGE_BILLED', ${amt2}, 'EUR', datetime('now'))"`, { stdio: 'inherit' });


    // 2. Run Invoicer (via script wrapper or verify logic)
    // We need a script to invoke the invoicer TS code. 
    // We will create 'scripts/run-invoicer-wrapper.ts' that calls MentoriaInvoicer
    console.log('🚀 Running Invoicer...');

    // Create wrapper on the fly? or file.
    // We'll Create `scripts/run-invoicer-cli.ts`
    // EXECUTION STEP: Ensure this file exists before running verification.
    execSync(`npx tsx scripts/run-invoicer-cli.ts ${testSaaSId}`, { stdio: 'inherit', env: { ...process.env, STRIPE_MODE: 'mock' } });


    // 3. Verify DB State
    console.log('🔍 Verifying DB State...');
    const runRes = execSync(`npx wrangler d1 execute drako_db_prod --local --command "SELECT * FROM stripe_invoice_runs WHERE saas_id='${testSaaSId}'" --json`).toString();
    // Parse json carefully
    const parse = (str) => {
        const idx = str.indexOf('[');
        return idx >= 0 ? JSON.parse(str.substring(idx)) : [];
    };

    const runs = parse(runRes)[0].results;
    if (runs.length !== 1) throw new Error(`Expected 1 run, got ${runs.length}`);

    const run = runs[0];
    console.log('   -> Run:', run);

    if (run.status !== 'invoiced') throw new Error(`Status should be invoiced, got ${run.status}`);
    if (run.usage_major !== 3000) throw new Error(`Usage should be 3000, got ${run.usage_major}`);
    if (!run.stripe_invoice_id || !run.stripe_invoice_id.startsWith('mock_inv_')) throw new Error('Invalid Mock Invoice ID');

    // 4. Verify Event
    const evtRes = execSync(`npx wrangler d1 execute drako_db_prod --local --command "SELECT * FROM economic_events WHERE saas_id='${testSaaSId}' AND event_type='USAGE_INVOICE_CREATED'" --json`).toString();
    const evts = parse(evtRes)[0].results;
    if (evts.length !== 1) throw new Error(`Expected 1 USAGE_INVOICE_CREATED event, got ${evts.length}`);
    console.log('   -> Invoice Event Found');

    // 5. Verify Idempotency
    console.log('🔄 Verifying Idempotency (Run Again)...');
    execSync(`npx tsx scripts/run-invoicer-cli.ts ${testSaaSId}`, { stdio: 'inherit', env: { ...process.env, STRIPE_MODE: 'mock' } });

    const runRes2 = execSync(`npx wrangler d1 execute drako_db_prod --local --command "SELECT count(*) as c FROM stripe_invoice_runs WHERE saas_id='${testSaaSId}'" --json`).toString();
    const count = parse(runRes2)[0].results[0].c;
    if (count !== 1) throw new Error(`Idempotency Failed: Found ${count} runs`);

    console.log('✅ VERIFICATION PASSED: Stripe Invoicing Logic works!');

} catch (e) {
    console.error(`❌ Verification Failed: ${e.message}`);
    process.exit(1);
}
