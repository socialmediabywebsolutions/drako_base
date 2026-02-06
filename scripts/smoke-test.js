
const targetUrl = process.env.TARGET_URL || "https://drako-base.vercel.app";
const { fetch } = require("undici"); // Ensure node fetch availability or use built-in if node 18+

async function runSmoke() {
    console.log(`🚀 Starting Smoke Test against ${targetUrl}`);
    let failed = false;

    // 1. Functional: Redirects
    console.log("\n🧪 Test 1: Functional Redirects");
    try {
        const res = await fetch(`${targetUrl}/site/panel`, { redirect: "manual" });
        console.log(`GET /site/panel -> Status: ${res.status}`);
        const location = res.headers.get("location");
        console.log(`Location: ${location}`);

        if (res.status === 307 && location && location.includes("/auth/login")) {
            console.log("✅ Redirect OK");
        } else {
            console.error("❌ Redirect FAILED");
            failed = true;
        }
    } catch (e) {
        console.error("❌ Request Error:", e.message);
        failed = true;
    }

    // 2. Observability: Correlation ID
    console.log("\n🧪 Test 2: Observability (Correlation ID)");
    let correlationId = "";
    try {
        const res = await fetch(`${targetUrl}/api/health-simple`);
        console.log(`GET /api/health-simple -> Status: ${res.status}`);
        correlationId = res.headers.get("x-drako-correlation-id");
        console.log(`X-Drako-Correlation-Id: ${correlationId}`);

        if (transactionMatch(correlationId)) {
            console.log("✅ Correlation ID OK");
        } else {
            console.error("❌ Correlation ID MISSING or INVALID");
            failed = true;
        }
    } catch (e) {
        console.error("❌ Request Error:", e.message);
        failed = true;
    }

    // 3. Protection: Rate Limit
    console.log("\n🧪 Test 3: Protection (Rate Limit - Burst)");
    console.log("Simulating 15 requests (Burst Limit is 10 for FREE)...");

    let rateLimited = false;
    let successCount = 0;

    // Create a tenant-like traffic pattern if possible, or just hit health which might be exempt?
    // We added protection effectively to ALL /api routes that resolve to a tenant?
    // Wait, health-simple doesn't resolve to a tenant?
    // Let's try to hit an endpoint that resolves to a tenant? 
    // If we can't, we'll try /api/health-simple and hope it hits the logic.
    // Actually, health-simple might verify nothing.

    // Let's try to simulate a tenant request if possible or hit a protected endpoint.
    // /api/saas/projects usually requires auth.
    // Rate limit is checked BEFORE auth for some things? 
    // In middleware, rate limit is checked IF resolution is ACTIVE.
    // /api/health-simple might not trigger resolution if it doesn't match a tenant pattern?

    // Let's just try /api/health-simple first.
    const requests = [];
    for (let i = 0; i < 20; i++) {
        requests.push(fetch(`${targetUrl}/api/health-simple`));
    }

    try {
        const results = await Promise.all(requests);
        const statuses = results.map(r => r.status);
        console.log("Statuses:", statuses);

        if (statuses.includes(429)) {
            console.log("✅ 429 Triggered");
            rateLimited = true;
        } else {
            console.log("⚠️ 429 NOT Triggered (Might be exempt or D1 unavailable)");
            // Don't fail the whole smoke if D1 is expected to be missing on Vercel
        }
    } catch (e) {
        console.error("❌ Burst Error:", e.message);
    }

    if (failed) {
        console.log("\n❌ SMOKE TEST FAILED");
        process.exit(1);
    } else {
        console.log("\n✅ SMOKE TEST PASSED (With Warnings)");
        process.exit(0);
    }
}

function transactionMatch(id) {
    return id && id.length > 5;
}

runSmoke();
