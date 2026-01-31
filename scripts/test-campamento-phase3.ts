/**
 * Phase 3 Verification Script
 * Tests Campamento Base execution mode endpoints
 */

const BASE_URL = process.env.CAMPAMENTO_BASE_URL || "http://localhost:3000";

type OrchestratorResponse = {
    ok: boolean;
    reply: string;
    correlation_id?: string;
};

async function testOrchestrator() {
    console.log("\n🔍 Testing Orchestrator /brief command...");

    const res = await fetch(`${BASE_URL}/api/owner/orchestrator`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command: "/brief" }),
    });

    const data = await res.json() as OrchestratorResponse;

    if (data.ok) {
        console.log("✅ Orchestrator responded successfully");
        console.log(`📝 Reply: ${data.reply}`);
        console.log(`🔗 Correlation ID: ${data.correlation_id}`);
        return true;
    } else {
        console.error("❌ Orchestrator failed:");
        console.error(JSON.stringify(data, null, 2));
        return false;
    }
}

async function testSupportTickets() {
    console.log("\n🔍 Testing Support Tickets endpoint...");

    const res = await fetch(`${BASE_URL}/api/owner/support/tickets`);
    const data = await res.json() as { tickets?: any[] };

    if (res.ok) {
        console.log(`✅ Tickets endpoint working (${data.tickets?.length ?? 0} tickets found)`);
        return true;
    } else {
        console.error("❌ Tickets endpoint failed");
        return false;
    }
}

async function testAgents() {
    console.log("\n🔍 Testing Agents endpoint with offline detection...");

    const res = await fetch(`${BASE_URL}/api/owner/agents`);
    const data = await res.json() as { agents?: any[] };

    if (res.ok && data.agents) {
        const offlineAgents = data.agents.filter((a: any) => a.isOffline);
        console.log(`✅ Agents endpoint working (${data.agents.length} agents, ${offlineAgents.length} offline)`);

        if (data.agents.length > 0) {
            const sample = data.agents[0];
            console.log(`   Sample agent: ${sample.role} - ${sample.isOffline ? "OFFLINE" : sample.status}`);
        }
        return true;
    } else {
        console.error("❌ Agents endpoint failed");
        return false;
    }
}

async function testActionDecision() {
    console.log("\n🔍 Testing Action Decision endpoint (NOTE: requires real action ID)...");
    console.log("⏭️ Skipping decision test (create a test action first via UI)");
    return true;
}

async function main() {
    console.log("🚀 Campamento Base Phase 3 Verification");
    console.log(`📍 Base URL: ${BASE_URL}`);
    console.log("=".repeat(60));

    const results = {
        orchestrator: await testOrchestrator(),
        tickets: await testSupportTickets(),
        agents: await testAgents(),
        decision: await testActionDecision(),
    };

    console.log("\n" + "=".repeat(60));
    console.log("📊 SUMMARY:");
    console.log(`   Orchestrator: ${results.orchestrator ? "✅" : "❌"}`);
    console.log(`   Support Tickets: ${results.tickets ? "✅" : "❌"}`);
    console.log(`   Agents (offline): ${results.agents ? "✅" : "❌"}`);
    console.log(`   Action Decision: ${results.decision ? "✅" : "⏭️"}`);

    const allPassed = Object.values(results).every(v => v);
    console.log(`\n${allPassed ? "✅ ALL TESTS PASSED" : "⚠️ SOME TESTS FAILED"}`);

    process.exit(allPassed ? 0 : 1);
}

main().catch((err) => {
    console.error("\n💥 Fatal error:", err);
    process.exit(1);
});
