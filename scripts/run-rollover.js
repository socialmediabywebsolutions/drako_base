
// scripts/run-rollover.js
// Usage: node scripts/run-rollover.js <saasId>

const { execSync } = require('child_process');

const [, , saasId] = process.argv;

if (!saasId) {
    console.error('Usage: node scripts/run-rollover.js <saasId>');
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
        return JSON.parse(res)[0].results;
    } catch (e) {
        return [];
    }
}

console.log(`🔄 Rolling Over Cycle for SaaS ${saasId}...`);

// 1. Get SaaS & Plan
const saas = runSqlJson(`SELECT * FROM saas_instances WHERE id = '${saasId}'`)[0];
if (!saas) process.exit(1);

const planId = saas.pricing_plan_id || 'plan_mentoria_free';
const plan = runSqlJson(`SELECT * FROM mentoria_pricing_plans WHERE id = '${planId}'`)[0];

// 2. Count Usage in Current Cycle (Strict Date Filter)
const startIso = saas.billing_cycle_start; // Assuming ISO string YYYY-MM-DD
const endIso = saas.billing_cycle_end;

// Note: Logic in `session-engine.ts` counts `completed_at`.
// Verify script uses sessions generated via insert.
// We count `completed` sessions strictly within [start, end)
// Wait, D1/SQLite dates are strings. 
// Cycle End is exclusive? "billing_cycle_start <= completed_at < billing_cycle_end".
// SQL: created_at >= start AND created_at < end.
// Verify script generated strict ISO strings.

const countRes = runSqlJson(`
    SELECT count(*) as c FROM mentoria_sessions 
    WHERE tenant_id = '${saas.tenant_id}' 
    AND status IN ('completed', 'billed')
    AND completed_at >= '${startIso}'
    AND completed_at < '${endIso}'
`);
const totalSessions = countRes[0].c;

console.log(`   -> Total Sessions in Cycle [${startIso} - ${endIso}): ${totalSessions}`);
console.log(`   -> Plan Limit: ${plan.included_sessions}`);

// 3. Metrics
const includedLimit = plan.included_sessions;
let includedUsed = 0;
let overageCount = 0;

if (includedLimit === -1) {
    includedUsed = totalSessions;
    overageCount = 0;
} else {
    if (totalSessions <= includedLimit) {
        includedUsed = totalSessions;
        overageCount = 0;
    } else {
        includedUsed = includedLimit;
        overageCount = totalSessions - includedLimit;
    }
}

// Revenue from Overage Events
// In real app, we sum `amount_major` from events.
// "usage_revenue_major = SUM(amount) of events SESSION_OVERAGE_BILLED within cycle".
// We need created_at of events to match cycle.
const revRes = runSqlJson(`
    SELECT sum(amount_major) as s FROM economic_events
    WHERE saas_id = '${saasId}'
    AND event_type = 'SESSION_OVERAGE_BILLED'
    AND created_at >= '${startIso}'
    AND created_at < '${endIso}'
`);
const usageRevenue = revRes[0].s || 0;
// Validation: overageCount * price_per_session should match?
// Yes, unless price changed mid-cycle. We trust the events.

console.log(`   -> Included: ${includedUsed}, Overage: ${overageCount}, Rev: ${usageRevenue}`);

// 4. Create Snapshot
// Fixed Fee from Plan (Snapshot rule)
const fixedFee = plan.monthly_fee_major;
const costEst = saas.cost_est_major; // Or explicit calc. Using Accumulated Cost.

const snapId = 'snap_' + Math.random().toString(36).substring(7);

runSql(`
    INSERT INTO saas_economics_snapshots (
        id, saas_id, tenant_id, cycle_start, cycle_end, 
        included_sessions_used, overage_sessions, usage_revenue_major, 
        fixed_fee_major, cost_est_major, created_at
    ) VALUES (
        '${snapId}', '${saasId}', '${saas.tenant_id}', '${startIso}', '${endIso}',
        ${includedUsed}, ${overageCount}, ${usageRevenue},
        ${fixedFee}, ${costEst}, datetime('now')
    )
`);

// 5. Advance Dates
// New Start = Old End
// New End = +1 Month from New Start
// Simplistic +30 days for node script or better logic?
// Verify script expects +1 Month logic? 
// "nuevo end = start + 1 mes".
// We parse the date.
const oldEnd = new Date(saas.billing_cycle_end);
const newStart = new Date(oldEnd); // Clone
const newEnd = new Date(newStart);
newEnd.setMonth(newEnd.getMonth() + 1);
// Handle overflow? JS setMonth handles it.

const fmt = d => d.toISOString().split('T')[0];
const newStartStr = fmt(newStart);
const newEndStr = fmt(newEnd);

console.log(`   -> Dates: ${newStartStr} to ${newEndStr}`);

runSql(`
    UPDATE saas_instances SET 
    billing_cycle_start = '${newStartStr}',
    billing_cycle_end = '${newEndStr}'
    WHERE id = '${saasId}'
`);

// 6. Emit Events
// BILLING_CYCLE_ROLLOVER
const evtId = 'evt_' + Math.random().toString(36).substring(7);
const meta = JSON.stringify({ oldStart: startIso, oldEnd: endIso, snapId });
const safeMeta = meta.replace(/'/g, "''");

runSql(`
    INSERT INTO economic_events (id, saas_id, tenant_id, event_type, severity, metadata_json, created_at)
    VALUES ('${evtId}', '${saasId}', '${saas.tenant_id}', 'BILLING_CYCLE_ROLLOVER', 'info', '${safeMeta}', datetime('now'))
`);

console.log('   ✅ Rollover Complete');
