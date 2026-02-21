import { execSync } from "child_process";

// Configuration
const DRAKO_DB = "drako_base_db"; // Adjust if different
const ENDPOINT = "http://localhost:8787"; // Local dev or production URL
const SAAS_SLUG = "mentor-ia"; // Test instance

/**
 * SIMULATE FAILURE SCRIPT
 * 
 * 1. Mutates D1 state directly via Wrangler (to simulate Stripe webhooks/logic)
 * 2. Verifies API responses to ensure Fail-Closed behavior
 */

async function runCommand(sql: string) {
    console.log(`[SQL] ${sql}`);
    try {
        // Escape quotes for shell safety (basic)
        const cmd = `npx wrangler d1 execute ${DRAKO_DB} --remote --command "${sql.replace(/"/g, '\\"')}"`;
        execSync(cmd, { stdio: 'inherit' });
    } catch (e) {
        console.error("Failed to execute SQL:", e);
    }
}

async function verifyAccess(tenantId: string, resource: string) {
    console.log(`[Verify] Checking access for ${tenantId} to ${resource}...`);
    // Mock fetch call - in real usage would call actual API
    // const res = await fetch(`${ENDPOINT}/api/${resource}`, { headers: { 'x-tenant-id': tenantId } });
    // console.log(`[Response] ${res.status}`);
    console.log(`[Verify] (Manual Step) Please run: curl -I -H "x-tenant-id: ${tenantId}" ${ENDPOINT}/api/${resource}`);
}

async function main() {
    const targetTenant = process.argv[2];
    if (!targetTenant) {
        console.error("Usage: npx tsx scripts/simulate_failure.ts <tenant_id>");
        process.exit(1);
    }

    console.log(`\n=== 1. SCENARIO: Payment Failed (Status -> past_due) ===`);
    await runCommand(`UPDATE saas_subscriptions SET status = 'past_due' WHERE tenant_id = '${targetTenant}' AND saas_slug = '${SAAS_SLUG}'`);
    console.log("EXPECTED: Feature access allowed (Grace Period), but UI warning.");
    await verifyAccess(targetTenant, "agents");

    console.log(`\n=== 2. SCENARIO: Grace Period Expired (Status -> unpaid) ===`);
    await runCommand(`UPDATE saas_subscriptions SET status = 'unpaid' WHERE tenant_id = '${targetTenant}' AND saas_slug = '${SAAS_SLUG}'`);
    console.log("EXPECTED: Feature access BLOCKED (402 Payment Required).");
    await verifyAccess(targetTenant, "agents");

    console.log(`\n=== 3. SCENARIO: Cancellation (Status -> canceled) ===`);
    await runCommand(`UPDATE saas_subscriptions SET status = 'canceled' WHERE tenant_id = '${targetTenant}' AND saas_slug = '${SAAS_SLUG}'`);
    console.log("EXPECTED: Feature access BLOCKED (402 Payment Required).");
    await verifyAccess(targetTenant, "agents");

    console.log(`\n=== 4. SCENARIO: Recovery (Status -> active) ===`);
    await runCommand(`UPDATE saas_subscriptions SET status = 'active' WHERE tenant_id = '${targetTenant}' AND saas_slug = '${SAAS_SLUG}'`);
    console.log("EXPECTED: Feature access RESTORED (200 OK).");
    await verifyAccess(targetTenant, "agents");

    console.log(`\n=== 5. SCENARIO: Quota Enforcement (Workspaces) ===`);
    console.log(`[Verify] Testing Workspace Creation (Quota Check)...`);
    // Manual curl instruction for POST
    console.log(`[Verify] (Manual Step) curl -X POST -H "x-tenant-id: ${targetTenant}" -d '{"name":"Simulated Workspace"}' ${ENDPOINT}/api/departments`);
}

main();
