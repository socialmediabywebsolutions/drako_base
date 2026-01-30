import { validateCatalog, getDefaultSwarmPlan } from "../src/lib/agents/registry";
import { AGENTS_CATALOG } from "../src/lib/agents/catalog";
import type { AgentVertical, PackId } from "../src/lib/agents/types";

async function runTests() {
    console.log("🚀 Starting Agent Catalog Validation Tests...");
    let failureCount = 0;

    // 1. Internal Registry Validation
    console.log("\n--- [1] Registry Integrity ---");
    const validation = validateCatalog();
    if (validation.valid) {
        console.log("✅ Catalog schema and basic rules pass.");
    } else {
        console.error("❌ Catalog validation failed:");
        validation.errors.forEach(err => console.error(`  - ${err}`));
        failureCount += validation.errors.length;
    }

    // 2. Naming Conventions (Non-negotiable)
    console.log("\n--- [2] Naming Conventions ---");
    for (const agent of AGENTS_CATALOG) {
        // Snake case plural slug check
        const isSnake = /^[a-z0-9]+(_[a-z0-9]+)*$/.test(agent.agent_id);
        if (!isSnake) {
            console.error(`❌ ${agent.agent_id}: agent_id must be plural snake_case.`);
            failureCount++;
        }
    }
    if (failureCount === 0) console.log("✅ Naming conventions consistent.");

    // 3. Vertical Swarm Plans
    console.log("\n--- [3] Default Swarm Plans ---");
    const verticals: AgentVertical[] = ["GENERIC", "SOCIAL_MARKETING", "REAL_ESTATE"];
    const packs: PackId[] = ["starter", "pro", "full"];

    for (const v of verticals) {
        for (const p of packs) {
            const plan = getDefaultSwarmPlan({ vertical: v, pack: p });
            if (plan.agent_ids.length === 0) {
                console.error(`❌ Empty swarm plan for ${v} x ${p}`);
                failureCount++;
            } else {
                console.log(`✅ ${v} x ${p}: ${plan.agent_ids.length} agents`);
            }
        }
    }

    // Final Outcome
    if (failureCount > 0) {
        console.error(`\n🛑 Tests failed with ${failureCount} errors.`);
        process.exit(1);
    } else {
        console.log("\n✨ All Agent Catalog tests passed!");
        process.exit(0);
    }
}

runTests().catch(err => {
    console.error(err);
    process.exit(1);
});
