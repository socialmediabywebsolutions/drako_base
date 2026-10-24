const { execSync } = require('child_process');
const crypto = require('crypto');

console.log('🏭 Verifying MentorIA Billing Cycle Alignment (Phase 19.4)...');

const tenantId = 'mentoria-core';
const testSaaSId = 'saas-cycle-test-' + crypto.randomUUID().substring(0, 8);
const clientId = 'client-cycle-01';
const mentorId = 'mentor-cycle-01';

try {
    // 1. Setup Test SaaS Instance with Free Plan (1 Included)
    console.log('📝 Setting up Test SaaS with FREE Plan & Cycle Dates...');

    // Dates: Start = Yesterday, End = +30 days (Covering "Now")
    const now = new Date();
    const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1);
    const cycleEnd = new Date(yesterday); cycleEnd.setDate(yesterday.getDate() + 30);

    // Format YYYY-MM-DD
    const fmt = d => d.toISOString().split('T')[0];
    const startStr = fmt(yesterday);
    const endStr = fmt(cycleEnd);

    // Clean up previous test data
    console.log('   🧹 Cleaning up old test data...');
    try {
        execSync(`npx wrangler d1 execute drako_db_prod --local --command "DELETE FROM saas_instances WHERE slug = 'cycle-test'"`, { stdio: 'ignore' });
        execSync(`npx wrangler d1 execute drako_db_prod --local --command "DELETE FROM mentoria_sessions WHERE tenant_id = '${tenantId}'"`, { stdio: 'ignore' });
        execSync(`npx wrangler d1 execute drako_db_prod --local --command "DELETE FROM economic_events WHERE saas_id = (SELECT id FROM saas_instances WHERE slug = 'cycle-test') OR tenant_id = '${tenantId}'"`, { stdio: 'ignore' });
    } catch (e) {
        // Ignore if not exists
    }

    execSync(`npx wrangler d1 execute drako_db_prod --local --command "INSERT INTO saas_instances (id, tenant_id, name, slug, status, plan_tier, created_at, mrr_major, cost_est_major, pricing_plan_id, billing_cycle_start, billing_cycle_end, billing_anchor_day) VALUES ('${testSaaSId}', '${tenantId}', 'Cycle Test SaaS', 'cycle-test', 'active', 'mentoria_ia', datetime('now'), 0, 0, 'plan_mentoria_free', '${startStr}', '${endStr}', ${yesterday.getDate()})"`, { stdio: 'inherit' });

    // 2. Create 2 Sessions in Current Cycle
    // S1: Included
    // S2: Overage
    const s1 = crypto.randomUUID();
    const s2 = crypto.randomUUID();

    console.log('1️⃣ Inserting 2 Sessions in Current Cycle...');
    // S1 completed NOW
    // S2 completed NOW + 1 hour
    execSync(`npx wrangler d1 execute drako_db_prod --local --command "INSERT INTO mentoria_sessions (id, tenant_id, mentor_id, client_id, status, created_at, completed_at, duration_minutes, cost_est_major) VALUES ('${s1}', '${tenantId}', '${mentorId}', '${clientId}', 'completed', datetime('now'), datetime('now'), 60, 600), ('${s2}', '${tenantId}', '${mentorId}', '${clientId}', 'completed', datetime('now', '+1 hour'), datetime('now', '+2 hours'), 60, 600)"`, { stdio: 'inherit' });

    // Bill S1
    console.log('   -> Billing S1 (Expect: INCLUDED)...');
    execSync(`node scripts/run-billing-action.js ${s1} ${testSaaSId}`, { stdio: 'inherit' });

    // Verify S1 Price 0
    let res1 = execSync(`npx wrangler d1 execute drako_db_prod --local --command "SELECT price_charged_major FROM mentoria_sessions WHERE id='${s1}'" --json`).toString();
    if (JSON.parse(res1)[0].results[0].price_charged_major !== 0) throw new Error('S1 should be 0');

    // Bill S2
    console.log('   -> Billing S2 (Expect: OVERAGE)...');
    execSync(`node scripts/run-billing-action.js ${s2} ${testSaaSId}`, { stdio: 'inherit' });

    // Verify S2 Price > 0 (Free plan doesn't have price, but we assume default 0 or check event emission logic. 
    // Wait, prev verification verified Free=0 price_per_session.
    // We should update pricing plan to have a cost for verification or rely on event emission logic distinguishing.
    // Let's set a price for Free plan overage temporarily or use Pro plan?
    // User Requirement: "Crear SaaS MentorIA con plan Free (1 sesión incluida)".
    // If Free plan has 0 overage cost, S2 will be billed 0 but emitted as OVERAGE.
    // We check EVENT type.

    const eventsJson = execSync(`npx wrangler d1 execute drako_db_prod --local --command "SELECT event_type FROM economic_events WHERE saas_id='${testSaaSId}'" --json`).toString();
    const types = JSON.parse(eventsJson)[0].results.map(e => e.event_type);

    if (!types.includes('SESSION_INCLUDED_CONSUMED')) throw new Error('Missing SESSION_INCLUDED_CONSUMED');
    if (!types.includes('SESSION_OVERAGE_BILLED')) throw new Error('Missing SESSION_OVERAGE_BILLED');
    console.log('   ✅ Usage Correctly Billed (Included vs Overage)');


    // 3. Force Rollover
    console.log('2️⃣ Forcing Cycle Rollover...');
    // Wrapper script for rollover? We need `scripts/run-rollover.js` or modify `run-billing-action.js` to support it.
    // I will create `scripts/run-rollover.js` in execution step.
    execSync(`node scripts/run-rollover.js ${testSaaSId}`, { stdio: 'inherit' });

    // 4. Verify Snapshot
    console.log('3️⃣ Verifying Snapshot...');
    const snapRes = execSync(`npx wrangler d1 execute drako_db_prod --local --command "SELECT * FROM saas_economics_snapshots WHERE saas_id='${testSaaSId}'" --json`).toString();
    const snap = JSON.parse(snapRes)[0].results[0];

    if (!snap) throw new Error('Snapshot not found');
    console.log('   -> Snapshot:', snap);

    if (snap.included_sessions_used !== 1) throw new Error(`Snapshot Included Used should be 1, got ${snap.included_sessions_used}`);
    if (snap.overage_sessions !== 1) throw new Error(`Snapshot Overage should be 1, got ${snap.overage_sessions}`);
    // usage_revenue_major depend on plan price (0 for free default)

    // 5. Verify New Cycle Dates
    const saasRes = execSync(`npx wrangler d1 execute drako_db_prod --local --command "SELECT billing_cycle_start, billing_cycle_end FROM saas_instances WHERE id='${testSaaSId}'" --json`).toString();
    const saas = JSON.parse(saasRes)[0].results[0];

    console.log('   -> New Dates:', saas);
    if (saas.billing_cycle_start !== endStr) throw new Error(`New Start should be old End (${endStr}), got ${saas.billing_cycle_start}`);
    // End should be +1 month roughly.

    // 6. New Session in New Cycle
    console.log('4️⃣ New Session in New Cycle (Expect: INCLUDED)...');
    const s3 = crypto.randomUUID();
    // Completed NOW (which is effectively in the OLD cycle timeframe if we didn't wait? 
    // Wait. "New Session in New Cycle". 
    // We just moved the cycle dates FORWARD.
    // So "NOW" is likely in the PAST relative to the new cycle start?
    // Use `billing_cycle_start` logic: `billing_cycle_start <= completed_at`.
    // If we moved Start to today+29days, then "NOW" is NOT in the new cycle.
    // To test "New Cycle", we must insert a session with `completed_at` in the FUTURE (inside new cycle).

    const futureDate = new Date(cycleEnd); futureDate.setDate(futureDate.getDate() + 1); // +1 day into new cycle
    const futureIso = futureDate.toISOString();

    execSync(`npx wrangler d1 execute drako_db_prod --local --command "INSERT INTO mentoria_sessions (id, tenant_id, mentor_id, client_id, status, created_at, completed_at, duration_minutes, cost_est_major) VALUES ('${s3}', '${tenantId}', '${mentorId}', '${clientId}', 'completed', datetime('now'), '${futureIso}', 60, 600)"`, { stdio: 'inherit' });

    execSync(`node scripts/run-billing-action.js ${s3} ${testSaaSId}`, { stdio: 'inherit' });

    // Verify S3 Price 0 / Included Event
    // We need to check the event specifically for S3.
    // Actually, simply checking if ANY event for S3 is INCLUDED is enough? 
    // No, we already have INCLUDED events.
    // Check if TOTAL INCLUDED events = 2.

    const events2 = execSync(`npx wrangler d1 execute drako_db_prod --local --command "SELECT count(*) as c FROM economic_events WHERE saas_id='${testSaaSId}' AND event_type='SESSION_INCLUDED_CONSUMED'" --json`).toString();
    if (JSON.parse(events2)[0].results[0].c !== 2) throw new Error('Should be 2 Included sessions total (1 old cycle, 1 new cycle)');

    console.log('   ✅ Cycle Reset Confirmed (New session is Included)');
    console.log('🚀 BILLING CYCLE VERIFIED!');

} catch (e) {
    console.error(`❌ Verification Failed: ${e.message}`);
    process.exit(1);
}
