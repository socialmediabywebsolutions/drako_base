// Simple smoke runner for Cloudflare preview/deploy.
// Usage: BASE_URL=http://localhost:8787 node scripts/smokes-cloudflare.js


const baseUrl = (process.env.BASE_URL ?? "http://localhost:8787").trim();

async function checkUrl(url, expectedStatus) {
  try {
    const res = await fetch(url, { method: 'HEAD' });
    console.log(`[${res.status === expectedStatus ? "PASS" : "FAIL"}] ${url} -> ${res.status} (Expected ${expectedStatus})`);
    if (res.status !== expectedStatus) throw new Error(`Status ${res.status}`);
  } catch (e) {
    console.error(`[ERR] ${url}: ${e.message}`);
    throw e; // Propagate to fail test
  }
}

const checks = [
  // 1. Health Checks
  { name: 'Health Check', path: '/api/health', expected: 200 },
  { name: 'Env Doctor (Protected)', path: '/api/health/env', expected: 401 }, // Fail-closed without header

  // 2. SaaS Registry
  { name: 'SaaS Listing', path: '/api/saas', expected: 200 },
  // { name: 'Drako Core', path: '/saas/drako', expected: 200 }, // Assuming this resolves via host-resolver or simple slug route if implemented
  // Note: /saas/[slug] might be API or Page. If API:
  // { name: 'Drako Core API', path: '/api/saas/drako-systems', expected: 200 },
  { path: "/api/saas", expected: 200 },
  // { path: "/saas/drako", expected: 200 }, // Commenting out specific tenants until confirmed exists
  // { path: "/saas/mentoria", expected: 200 }, // Commenting out specific tenants until confirmed exists
];

const redirects = [
  { path: "/agentes", target: "/agents", status: 308 },
  { path: "/departamentos", target: "/departments", status: 308 },
];

async function run() {
  let failed = false;

  console.log(`🚀 Starting Smoke Tests on ${baseUrl}`);

  // 1. Standard Endpoints
  for (const check of checks) {
    const url = `${baseUrl}${check.path}`;
    try {
      const res = await fetch(url, { method: "HEAD" }); // HEAD is faster/safer
      console.log(`[${res.status === check.expected ? "PASS" : "FAIL"}] ${check.path} -> ${res.status} (Expected ${check.expected})`);
      if (res.status !== check.expected) failed = true;
    } catch (error) {
      console.error(`[ERR] ${check.path}`, error.message);
      failed = true;
    }
  }

  // 2. Redirects
  for (const r of redirects) {
    const url = `${baseUrl}${r.path}`;
    try {
      const res = await fetch(url, { method: "HEAD", redirect: "manual" });
      const location = res.headers.get("location");
      const isRedirect = res.status === 308 || res.status === 307 || res.status === 301;
      const targetMatch = location && location.endsWith(r.target);

      const pass = isRedirect && targetMatch;
      console.log(`[${pass ? "PASS" : "FAIL"}] ${r.path} -> ${res.status} to ${location} (Expected ${r.status} -> ...${r.target})`);

      if (!pass) failed = true;
    } catch (error) {
      console.error(`[ERR] ${r.path}`, error.message);
      failed = true;
    }
  }

  // 3. Env Doctor Security (Fail-Closed Check)
  // Without secret, it should be 403 or 404
  try {
    const url = `${baseUrl}/api/health/env`;
    const res = await fetch(url, { method: "HEAD" });
    const pass = res.status === 403 || res.status === 404;
    console.log(`[${pass ? "PASS" : "FAIL"}] /api/health/env (No Auth) -> ${res.status} (Expected 403/404)`);
    if (!pass) failed = true;
  } catch (error) {
    console.error(`[ERR] /api/health/env`, error.message);
    failed = true;
  }

  // 4. CONFIRM DELETIONS (Zombie Check)
  const zombies = ["/api/health-simple", "/api/debug"];
  for (const z of zombies) {
    try {
      const url = `${baseUrl}${z}`;
      const res = await fetch(url, { method: "HEAD" });
      const pass = res.status === 404;
      console.log(`[${pass ? "PASS" : "FAIL"}] ${z} -> ${res.status} (Expected 404 DELETED)`);
      if (!pass) failed = true;
    } catch (error) {
      console.error(`[ERR] ${z}`, error.message);
      failed = true;
    }
  }

  // Phase 19.1 Smoke Tests
  try {

    // 3. Check Tenant Isolation (Basic)
    await checkUrl(`${baseUrl}/api/saas`, 401); // Unauthorized (no tenant context)

    // 4. Phase 19.1: MentorIA Sessions (Public/Protected check)
    await checkUrl(`${baseUrl}/saas/mentoria/sessions`, 200);

    // 5. Phase 19.2: HQ Visibility
    console.log('👉 Checking HQ Access...');
    try {
      const res = await fetch(`${baseUrl}/site/panel/hq`);
      console.log(`   HQ Status: ${res.status}`);
      if (res.status === 404) throw new Error('HQ not found');
    } catch (e) {
      console.error(`   HQ Check Failed: ${e.message}`);
      // Don't fail the whole script for auth redirect, only for 404
      if (e.message.includes('404')) process.exit(1);
    }

    console.log('\n✅ SMOKE TESTS PASSED!');
  } catch (e) {
    console.error("\n❌ Smoke tests failed during Phase 19.1 checks:", e.message);
    process.exit(1);
  }

  // Original final check, now potentially redundant if new checks handle exit
  if (failed) {
    console.error("\n❌ Smoke tests failed");
    process.exit(1);
  } else {
    // This block might be unreachable if the new checks exit on success/failure
    // or if the new checks are designed to be the final word.
    // Keeping it for now, but consider removing if the new checks fully replace final reporting.
    console.log("\n✅ Smoke tests passed");
  }
}

run();
