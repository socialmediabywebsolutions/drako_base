const { execSync } = require('child_process');
const crypto = require('crypto');

const [, , tenantId, eventType, amountMajor, metadataJson] = process.argv;

if (!tenantId || !eventType) {
    console.error('Usage: node scripts/emit-governance-event.js <tenant_id> <event_type> <amount_major> <metadata_json>');
    process.exit(1);
}

const amount = parseInt(amountMajor || '0');
const metadata = metadataJson || '{}';
const id = crypto.randomUUID();

console.log(`📡 Emitting Event: ${eventType} for ${tenantId}...`);

try {

    // 1. Resolve SaaS ID
    const saasRes = execSync(`npx wrangler d1 execute drako_db_prod --local --command "SELECT id FROM saas_instances WHERE tenant_id = '${tenantId}'" --json`).toString();
    const saasId = JSON.parse(saasRes)[0].results[0]?.id;

    if (!saasId) {
        throw new Error(`SaaS Instance not found for tenant_id: ${tenantId}`);
    }

    // 2. Insert Event
    // Use JSON.stringify for arguments to handle quotes safely in command line is tricky, 
    // better to construct the SQL carefully.
    // metadata is a string which is already JSON.

    // Escape single quotes for SQL
    const safeMeta = metadata.replace(/'/g, "''");

    const sql = `INSERT INTO economic_events (id, saas_id, tenant_id, event_type, amount_major, currency, metadata_json, severity, message) VALUES ('${id}', '${saasId}', '${tenantId}', '${eventType}', ${amount}, 'EUR', '${safeMeta}', 'info', ' Governance Event')`;

    execSync(`npx wrangler d1 execute drako_db_prod --local --command "${sql}"`, { stdio: 'inherit' });

    console.log('✅ Event Emitted Successfully');

} catch (e) {
    console.error(`❌ Failed to emit event: ${e.message}`);
    process.exit(1);
}
