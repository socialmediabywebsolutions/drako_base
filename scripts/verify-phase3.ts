
import { SchedulerClient } from "../src/lib/rate-limit/scheduler-client";
import { DracoEnv } from "@/lib/cf"; // Mock environment
import { checkTenantRateLimit } from "../src/lib/security/tenant-rate-limit";

// MOCK ENV for Verification
const MOCK_ENV: any = {
    SCHEDULER: {
        fetch: async (url: string) => {
            // Simulate Scheduler Response
            const u = new URL(url);
            const keys = u.searchParams.getAll("key");
            console.log(`[MockScheduler] Checking keys: ${keys.join(", ")}`);

            // Simple Logic: If IP is "blocked_ip", return false
            if (url.includes("blocked_ip")) {
                return new Response(JSON.stringify({ allowed: false, reason: "Simulated Block" }), { status: 200 });
            }
            // If IP is "error_ip", return 500
            if (url.includes("error_ip")) {
                return new Response("Internal Server Error", { status: 500 });
            }

            return new Response(JSON.stringify({ allowed: true, remaining: 99 }), { status: 200 });
        }
    },
    DRACO_DB: {
        prepare: () => ({ bind: () => ({ run: async () => { } }) }) // Mock DB for audit
    }
};

async function testRateLimit() {
    console.log("--- TEST 1: Allowed Request ---");
    const req1 = new Request("http://localhost/api/test");
    const res1 = await checkTenantRateLimit({
        tenantId: "tenant_1",
        route: "/api/test",
        request: req1,
        envOverride: MOCK_ENV
    });
    console.log("Result:", res1);
    if (!res1.allowed) throw new Error("TEST 1 FAILED: Should be allowed");

    console.log("\n--- TEST 2: Blocked Request (Simulated) ---");
    const req2 = new Request("http://localhost/api/test", { headers: { "x-forwarded-for": "blocked_ip" } });
    const res2 = await checkTenantRateLimit({
        tenantId: "tenant_1",
        route: "/api/test",
        request: req2,
        envOverride: MOCK_ENV
    });
    console.log("Result:", res2);
    if (res2.allowed) throw new Error("TEST 2 FAILED: Should be blocked");

    console.log("\n--- TEST 3: Scheduler Error (Fail Closed) ---");
    const req3 = new Request("http://localhost/api/test", { headers: { "x-forwarded-for": "error_ip" } });
    const res3 = await checkTenantRateLimit({
        tenantId: "tenant_1",
        route: "/api/test",
        request: req3,
        envOverride: MOCK_ENV
    });
    console.log("Result:", res3);
    if (res3.allowed) throw new Error("TEST 3 FAILED: Should fail closed on error");

    console.log("\n✅ Rate Limit Verification Passed");
}

async function main() {
    await testRateLimit();
    // In a real scenario, we would also invoke the Worker script directly or via `wrangler dev`.
    // Since we separated the worker, full integration test requires `wrangler dev` running.
    // This script verifies the CLIENT logic and Fail-Closed behavior.
}

main().catch(e => {
    console.error(e);
    process.exit(1);
});
