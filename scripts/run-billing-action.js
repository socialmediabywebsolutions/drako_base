// scripts/run-billing-action.js
// Usage: node scripts/run-billing-action.js <sessionId> <saasId>

const { execSync } = require('child_process');

const [, , sessionId, saasId] = process.argv;

if (!sessionId || !saasId) {
    console.error('Usage: node scripts/run-billing-action.js <sessionId> <saasId>');
    process.exit(1);
}

function runSql(sql) {
    const safeSql = sql.replace(/"/g, '\\"');
    return execSync(`npx wrangler d1 execute drako_db_prod --local --command "${safeSql}"`, { encoding: 'utf-8' });
}

function runSqlJson(sql) {
    const safeSql = sql.replace(/"/g, '\\"');
    const res = execSync(`npx wrangler d1 execute drako_db_prod --local --command "${safeSql}" --json`, { encoding: 'utf-8' });
    try {
        // Find first '['
        const jsonStart = res.indexOf('[');
        if (jsonStart === -1) return [];
        const jsonStr = res.substring(jsonStart);
        return JSON.parse(jsonStr)[0].results;
    } catch (e) {
        return [];
    }
}

console.log(`⚡ Billing Session ${sessionId} for SaaS ${saasId}...`);

// 1. Get SaaS & Pricing Plan & Cycle Dates
const saas = runSqlJson(`SELECT pricing_plan_id, id, billing_cycle_start, billing_cycle_end, tenant_id FROM saas_instances WHERE id = '${saasId}'`)[0];

if (!saas.billing_cycle_start || !saas.billing_cycle_end) {
    console.error('Billing Cycle not initialized on SaaS Instance');
    process.exit(1);
}

const planId = saas?.pricing_plan_id || 'plan_mentoria_free';
const plan = runSqlJson(`SELECT * FROM mentoria_pricing_plans WHERE id = '${planId}'`)[0];

if (!plan) {
    console.error('Plan not found:', planId);
    process.exit(1);
}

console.log(`   -> Plan: ${plan.name} (Included: ${plan.included_sessions}, Overage: ${plan.price_per_session_major})`);
console.log(`   -> Cycle: ${saas.billing_cycle_start} to ${saas.billing_cycle_end}`);

// 2. Count Usage in Current Cycle
// Logic: Count 'completed' or 'billed' sessions strictly within [start, end)
// AND order to determine rank of THIS session.

const currentSession = runSqlJson(`SELECT created_at, completed_at FROM mentoria_sessions WHERE id = '${sessionId}'`)[0];
if (!currentSession.completed_at) {
    console.error('Session not completed');
    process.exit(1);
}

// Count sessions completed within the cycle, up to this session's completion time.
const rankRes = runSqlJson(`
    SELECT count(*) as c FROM mentoria_sessions 
    WHERE tenant_id = '${saas.tenant_id}' 
    AND status IN ('completed', 'billed') 
    AND completed_at >= '${saas.billing_cycle_start}' 
    AND completed_at < '${saas.billing_cycle_end}'
    AND completed_at <= '${currentSession.completed_at}'
`);
const rank = rankRes[0].c;

console.log(`   -> Session Rank (in Cycle): ${rank} (Plan Limit: ${plan.included_sessions})`);

let price = 0;
let eventType = 'SESSION_INCLUDED_CONSUMED';

const included = plan.included_sessions;
if (included !== -1 && rank > included) {
    price = plan.price_per_session_major;
    eventType = 'SESSION_OVERAGE_BILLED';
}

console.log(`   -> Price: ${price}, Event: ${eventType}`);

// 3. Update Session
runSql(`UPDATE mentoria_sessions SET status = 'billed', price_charged_major = ${price}, billed_at = datetime('now') WHERE id = '${sessionId}'`);

// 4. Update Economics
// Only add cost. Revenue is calculated from events/snapshots.
// MRR is fixed fee only.
runSql(`UPDATE saas_instances SET cost_est_major = cost_est_major + 600 WHERE id = '${saasId}'`);

// 5. Emit Event
const evtId = 'evt_' + Math.random().toString(36).substring(7);
const meta = JSON.stringify({
    sessionId,
    price,
    planId: plan.id,
    cycleStart: saas.billing_cycle_start,
    cycleEnd: saas.billing_cycle_end
});
const safeMeta = meta.replace(/'/g, "''");

runSql(`INSERT INTO economic_events (id, saas_id, tenant_id, event_type, amount_major, currency, metadata_json, created_at) VALUES ('${evtId}', '${saasId}', '${saas.tenant_id}', '${eventType}', ${price}, 'EUR', '${safeMeta}', datetime('now'))`);

console.log('   ✅ Billing Complete');
