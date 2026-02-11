const { execSync } = require('child_process');

console.log('🏭 Verifying MentorIA Vertical Activation...');

try {
    // 1. Check SaaS Instance
    console.log('🔍 Checking SaaS Instance...');
    const saasJson = execSync('npx wrangler d1 execute drako_db_prod --command "SELECT * FROM saas_instances WHERE slug = \'mentoria\'" --json').toString();
    const saas = JSON.parse(saasJson)[0].results[0];

    if (saas.tenant_id !== 'mentoria-core') throw new Error('Tenant ID mismatch');
    if (saas.lifecycle_status !== 'active') throw new Error('Lifecycle status not active');
    console.log('✅ SaaS Instance OK');

    // 2. Check Departments
    console.log('🔍 Checking Departments...');
    const depsJson = execSync('npx wrangler d1 execute drako_db_prod --command "SELECT count(*) as count FROM departments WHERE tenant_id = \'mentoria-core\'" --json').toString();
    const depsCount = JSON.parse(depsJson)[0].results[0].count;

    if (depsCount < 3) throw new Error(`Missing Departments. Found ${depsCount}, expected 3+`);
    console.log('✅ Departments OK');

    // 3. Check Governance Events
    console.log('🔍 Checking Governance Events...');
    const eventsJson = execSync('npx wrangler d1 execute drako_db_prod --command "SELECT event_type FROM economic_events WHERE tenant_id = \'mentoria-core\'" --json').toString();
    const events = JSON.parse(eventsJson)[0].results.map(e => e.event_type);

    if (!events.includes('VERTICAL_CREATED')) throw new Error('Missing VERTICAL_CREATED event');
    if (!events.includes('FIRST_REVENUE')) throw new Error('Missing FIRST_REVENUE event');
    console.log('✅ Governance Events OK');

    console.log('🚀 FACTORY ACTIVATION VERIFIED!');

} catch (e) {
    console.error(`❌ Verification Failed: ${e.message}`);
    process.exit(1);
}
