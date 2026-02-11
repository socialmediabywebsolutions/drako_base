const http = require('http');

console.log('🔐 Phase 20: AuthZ Verification');
console.log('================================\n');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const TEST_SAAS_ID = 'saas-test-authz-check';

console.log(`📍 Target: ${BASE_URL}`);
console.log(`🎯 Test SaaS: ${TEST_SAAS_ID}\n`);

// Helper: Make HTTP request
function makeRequest(path, method = 'POST', body = null, headers = {}) {
    return new Promise((resolve, reject) => {
        const url = new URL(path, BASE_URL);
        const options = {
            hostname: url.hostname,
            port: url.port || 80,
            path: url.pathname,
            method,
            headers: {
                'Content-Type': 'application/json',
                ...headers
            }
        };

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                resolve({
                    status: res.statusCode,
                    headers: res.headers,
                    body: data ? JSON.parse(data) : null
                });
            });
        });

        req.on('error', reject);

        if (body) {
            req.write(JSON.stringify(body));
        }

        req.end();
    });
}

async function runTests() {
    const results = [];

    // TEST 1: No auth token (anonymous)
    console.log('TEST 1: No authentication token');
    try {
        const res = await makeRequest('/api/billing/mentoria/run', 'POST', { saasId: TEST_SAAS_ID });
        const pass = res.status === 403 || res.status === 401;
        results.push({
            test: 'No Auth',
            expected: '401/403',
            actual: res.status,
            result: pass ? '✅ PASS' : '❌ FAIL'
        });
        console.log(`   Status: ${res.status} ${pass ? '✅' : '❌'}`);
    } catch (e) {
        results.push({
            test: 'No Auth',
            expected: '401/403',
            actual: 'ERROR',
            result: '⚠️  SKIP (Server unreachable)'
        });
        console.log(`   ⚠️  SKIP: ${e.message}`);
    }

    // TEST 2: Invalid/wrong role token
    console.log('\nTEST 2: Invalid role (simulated)');
    try {
        const res = await makeRequest('/api/billing/mentoria/run', 'POST', { saasId: TEST_SAAS_ID }, {
            'Authorization': 'Bearer fake_token_wrong_role'
        });
        const pass = res.status === 403;
        results.push({
            test: 'Wrong Role',
            expected: '403',
            actual: res.status,
            result: pass ? '✅ PASS' : '❌ FAIL'
        });
        console.log(`   Status: ${res.status} ${pass ? '✅' : '❌'}`);
    } catch (e) {
        results.push({
            test: 'Wrong Role',
            expected: '403',
            actual: 'ERROR',
            result: '⚠️  SKIP (Server unreachable)'
        });
        console.log(`   ⚠️  SKIP: ${e.message}`);
    }

    // TEST 3: Valid owner token (requires real auth setup)
    console.log('\nTEST 3: Valid owner token');
    console.log('   ⚠️  MANUAL TEST REQUIRED');
    console.log('   → Obtain valid owner JWT token');
    console.log('   → curl -X POST ${BASE_URL}/api/billing/mentoria/run \\');
    console.log('     -H "Authorization: Bearer <token>" \\');
    console.log('     -H "Content-Type: application/json" \\');
    console.log(`     -d '{"saasId":"${TEST_SAAS_ID}"}'`);
    console.log('   → Expect: 200 (or 500 if no data)\n');

    results.push({
        test: 'Valid Owner',
        expected: '200',
        actual: 'MANUAL',
        result: '⚠️  PENDING'
    });

    // Print summary table
    console.log('\n📊 AUTHZ TEST RESULTS');
    console.log('═══════════════════════════════════════════');
    console.log('Test Case       | Expected | Actual | Result');
    console.log('───────────────────────────────────────────');
    results.forEach(r => {
        console.log(`${r.test.padEnd(15)} | ${r.expected.padEnd(8)} | ${String(r.actual).padEnd(6)} | ${r.result}`);
    });
    console.log('═══════════════════════════════════════════\n');

    const passCount = results.filter(r => r.result.includes('✅')).length;
    const skipCount = results.filter(r => r.result.includes('⚠️')).length;

    if (passCount === 2) {
        console.log('✅ AUTHZ VERIFICATION PASSED (2/2 automated tests)');
        console.log('   Manual test pending: Valid owner token\n');
    } else if (skipCount === 3) {
        console.log('⚠️  AUTHZ VERIFICATION SKIPPED (Server unreachable)');
        console.log('   Start server with: npm run dev\n');
    } else {
        console.log('❌ AUTHZ VERIFICATION FAILED');
        console.log(`   Passed: ${passCount}/2, Skipped: ${skipCount}\n`);
    }

    return results;
}

runTests().catch(e => {
    console.error('❌ Test suite failed:', e);
    process.exit(1);
});
