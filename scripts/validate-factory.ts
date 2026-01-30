
/**
 * Factory Validation Script
 * Run with: npx tsx scripts/validate-factory.ts
 */

import { AGENTS_CATALOG } from "../src/lib/agents/catalog";
import { listAgents } from "../src/lib/agents/registry";
import { calculatePricing } from "../src/lib/billing/pricing";
import { InterviewOrchestrator } from "../src/lib/interviews/orchestrator";

async function runTests() {
    console.log("🏭 Starting Drako Factory Validation...\n");

    // 1. Validate Agent Catalog
    console.log("🔍 Checking Agent Catalog...");
    const agentCount = AGENTS_CATALOG.length;
    console.log(`   - Found ${agentCount} agents.`);

    if (agentCount < 30) {
        console.warn("   ⚠️ Warning: Agent count is low (expected >30).");
    } else {
        console.log("   ✅ Agent count OK.");
    }

    // Check for duplicates
    const ids = new Set<string>();
    let dups = 0;
    for (const agent of AGENTS_CATALOG) {
        if (ids.has(agent.agent_id)) {
            console.error(`   ❌ Duplicate ID found: ${agent.agent_id}`);
            dups++;
        }
        ids.add(agent.agent_id);
    }
    if (dups === 0) console.log("   ✅ Unique IDs OK.");

    // Check Helper
    const realEstateAgents = listAgents({ vertical: "REAL_ESTATE" });
    console.log(`   - Real Estate vertical has ${realEstateAgents.length} agents.`);
    if (realEstateAgents.length > 0) console.log("   ✅ Vertical filtering OK.");

    console.log("\n💰 Checking Pricing Engine...");
    // 2. Validate Pricing
    // Input: { tier: "PRO", vertical: "GENERIC", addons: ["dedicated_ip"], users: 5, estimatedTransactions: 500 }
    // PRO Base: 199.00 EUR (cents: 19900)
    // Included Seats: 3. Extra: 2 * 15.00 = 30.00 EUR (cents: 3000)
    // Addon dedicated_ip: 19.00 EUR (cents: 1900)
    // Usage: 500 * 0.10 = 50.00 EUR (cents: 5000)
    // Total Cents: 19900 + 3000 + 1900 + 5000 = 29800
    // Total EUR: 298.00

    const quote = calculatePricing({
        tier: "PRO",
        vertical: "GENERIC",
        addons: ["dedicated_ip"],
        users: 5,
        estimatedTransactions: 500
    });

    console.log("   - Calculated Quote for PRO + 2 extra seats + Dedicated IP + 500 tx:");
    console.log(`     Total: ${quote.totalMonthly} ${quote.currency}`);

    const expected = 298; // 298.00 EUR
    if (Math.abs(quote.totalMonthly - expected) < 0.01) {
        console.log("   ✅ Pricing Calculation Logic OK.");
    } else {
        console.error(`   ❌ Pricing Mismatch: Got ${quote.totalMonthly}, Expected ${expected}`);
    }

    console.log("\n️🗣️ Checking Interview Orchestrator (Reactive Gates)...");

    // Test A: Warmup (0 -> 1)
    const p1 = InterviewOrchestrator.calculateNextPhase(0, {}, 1);
    if (p1 === 1) console.log("   ✅ Phase 0->1 (Warmup) OK.");
    else console.error(`   ❌ Phase 0->1 Failed: Got ${p1}`);

    // Test B: Blocked Transition (1 -> 2) without data
    const p2_blocked = InterviewOrchestrator.calculateNextPhase(1, { identity: {} }, 2);
    if (p2_blocked === 1) console.log("   ✅ Phase 1->2 Blocked (No data) OK.");
    else console.error(`   ❌ Phase 1->2 Blocked Failed: Got ${p2_blocked}`);

    // Test C: Valid Transition (1 -> 2) with data
    const p2_ok = InterviewOrchestrator.calculateNextPhase(1, { identity: { name: "Acme", sector: "Software" } }, 2);
    if (p2_ok === 2) console.log("   ✅ Phase 1->2 Allowed (With data) OK.");
    else console.error(`   ❌ Phase 1->2 Allowed Failed: Got ${p2_ok}`);

    // Test D: Skip Prevention (1 -> 5) should cap at 2
    const p_skip = InterviewOrchestrator.calculateNextPhase(1, { identity: { name: "Acme", sector: "Software" } }, 5);
    if (p_skip === 2) console.log("   ✅ Phase Skip Prevention (Capped at 2) OK.");
    else console.error(`   ❌ Phase Skip Capping Failed: Got ${p_skip}`);

    // Test E: Skip Prevention (1 -> 5) without data should stay at 1
    const p_skip_no_data = InterviewOrchestrator.calculateNextPhase(1, { identity: {} }, 5);
    if (p_skip_no_data === 1) console.log("   ✅ Phase Skip Prevention (Stuck at 1) OK.");
    else console.error(`   ❌ Phase Skip Data Check Failed: Got ${p_skip_no_data}`);

    console.log("\n✅ Factory Validation Complete.");
}

runTests().catch(console.error);
