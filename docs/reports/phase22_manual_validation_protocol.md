# 🛡️ Drako Security Certification Gate v1.0

**Type**: MANDATORY GOVERNANCE RULE  
**Applies To**: ALL production promotions  
**Status**: ⚠️ BLOCKING PHASE 22 PRODUCTION  
**Preview URL**: https://preview-phase22.drako-base-3.pages.dev  
**Created**: 2026-02-13  
**Version**: 1.0

---

## Critical Understanding

**Production readiness is NOT**:
- ❌ Successful build
- ❌ Clean deployment
- ❌ Code that looks correct
- ❌ Passing tests in isolation

**Production readiness IS**:
- ✅ Adversarial validation with real users
- ✅ Real multi-tenant isolation under attack
- ✅ Real performance under load
- ✅ Real audit trail of security events

**Current Status**: PREVIEW READY – AWAITING MANUAL SECURITY VALIDATION

---

## 🔒 Production Gate Rule

**THIS IS NOT A CHECKLIST. THIS IS A DEPLOYMENT BLOCKER.**

### Core Principle

```
NO PHASE MAY BE MARKED COMPLETE
UNTIL ADVERSARIAL VALIDATION IS EXECUTED
AND SIGNED
```

This is not optional. This is not "nice to have". This is **infrastructure governance**.

### Gate Requirements

Before ANY production promotion, the following MUST exist:

#### 1. Manual Validation Report (MANDATORY)

**File**: `docs/reports/phase22_manual_validation_results.md`

**Must Contain**:
- [ ] Validator name and signature
- [ ] Validation date and timestamp
- [ ] All 4 blocks completed with evidence
- [ ] Pass/Fail status for each test
- [ ] Security incidents discovered (if any)
- [ ] Performance metrics captured
- [ ] Final verdict: PRODUCTION READY or BLOCKED

**Without this file → Deployment is INVALID**

#### 2. Evidence Attachments (MANDATORY)

Evidence must be:
- **Screenshots** of browser DevTools (cookies, network timing, console)
- **SQL query results** from audit log verification
- **Performance data** (raw timings, not summaries)
- **Error screenshots** (401/403 responses, security events)

**Storage**: `docs/reports/phase22_evidence/`

**Format**:
```
phase22_evidence/
├── jwt_flow/
│   ├── 01_login_success.png
│   ├── 02_cookie_inspector.png
│   ├── 03_jwt_payload.png
│   ├── 04_manipulated_jwt_denied.png
│   └── 05_expired_token_denied.png
├── multi_tenant/
│   ├── 01_same_tenant_allowed.png
│   ├── 02_cross_tenant_denied.png
│   ├── 03_jwt_manipulation_denied.png
│   └── 04_audit_log_query.png
├── performance/
│   ├── 01_cold_start_timing.png
│   ├── 02_p50_p95_results.json
│   └── 03_bundle_size.png
└── audit_logs/
    ├── 01_cross_tenant_event.json
    ├── 02_invalid_jwt_event.json
    └── 03_audit_trail_query.png
```

**Without evidence → Validation report is INVALID**

#### 3. Validator Accountability (MANDATORY)

**Validator Information**:
```
Name: <full name>
Role: <role in organization>
Date: <YYYY-MM-DD HH:MM UTC>
Email: <email>
Signature: <digital signature or full name confirmation>
```

**Validator Declaration**:
```
I, <name>, certify that:
1. I have personally executed all 23 tests in this protocol
2. All evidence screenshots are authentic and unmodified
3. All audit log queries were run against the production database
4. All performance metrics were captured from live Edge workers
5. I take responsibility for the accuracy of this validation

Signed: <name>
Date: <date>
```

**Without validator signature → Validation is INVALID**

#### 4. Correlation IDs (MANDATORY)

For every security event tested, record:
```
Test: Cross-tenant access attempt
Correlation ID: <uuid>
Event ID: <uuid>
Timestamp: <ISO 8601>
Query to verify: SELECT * FROM campamento_events WHERE correlation_id = '<uuid>'
```

**Without correlation IDs → Audit trail is UNVERIFIABLE**

#### 5. Performance Baseline Storage (MANDATORY)

Store baseline metrics for future comparison:

**File**: `docs/metrics/phase22_baseline.json`

```json
{
  "phase": 22,
  "date": "2026-02-13",
  "deployment_id": "ed558dbb-e410-4ace-bb28-09659c9fbf50",
  "cold_start_ms": 45,
  "p50_ms": 8,
  "p95_ms": 35,
  "p99_ms": 50,
  "middleware_size_kb": 40.3,
  "worker_bundle_kb": 850,
  "sample_size": 20
}
```

**Without baseline → Future performance degradation is UNDETECTABLE**

### Gate Enforcement

**Deployment Command**:
```bash
# This command MUST fail if validation report does not exist
npm run deploy:production
```

**CI/CD Integration** (Future):
```yaml
# .github/workflows/deploy-production.yml
- name: Verify Security Gate
  run: |
    if [ ! -f "docs/reports/phase22_manual_validation_results.md" ]; then
      echo "BLOCKED: Security gate validation missing"
      exit 1
    fi
    if [ ! -d "docs/reports/phase22_evidence" ]; then
      echo "BLOCKED: Evidence directory missing"
      exit 1
    fi
    # Verify validator signature exists
    grep -q "Signed:" docs/reports/phase22_manual_validation_results.md || exit 1
```

### Why This Matters

**Without this gate**:
- ❌ Deployments happen based on "looks good"
- ❌ Security is theoretical, not proven
- ❌ Performance degradation goes unnoticed
- ❌ No accountability trail
- ❌ Multi-tenant faults discovered in production by customers

**With this gate**:
- ✅ Every deployment is adversarially validated
- ✅ Security is proven under attack
- ✅ Performance is baselined and tracked
- ✅ Named validator is accountable
- ✅ Audit trail is complete and verifiable

**This converts Drako from "app" to "infrastructure with governance".**

---

## Validation Requirements

Complete ALL 4 blocks before production promotion. No exceptions.

---

## 1️⃣ JWT REAL FLOW (OBLIGATORIO)

**Objective**: Verify end-to-end JWT authentication in production Edge environment.

### Test 1.1: Successful Login Flow

**Steps**:
1. Navigate to https://preview-phase22.drako-base-3.pages.dev/auth/login
2. Enter valid credentials
3. Submit login form
4. Inspect browser cookies (DevTools → Application → Cookies)

**Expected Results**:
- [ ] Cookie `drako_session` is present
- [ ] Cookie has `HttpOnly` flag set
- [ ] Cookie has `Secure` flag set (if HTTPS)
- [ ] Cookie has `SameSite=lax` or `SameSite=strict`

**Document**:
```
Cookie Name: drako_session
Value: <JWT_STRING>
HttpOnly: Yes/No
Secure: Yes/No
SameSite: <value>
Domain: <domain>
Path: /
Expires: <date>
```

### Test 1.2: JWT Payload Verification

**Steps**:
1. Copy JWT value from cookie
2. Decode at https://jwt.io (DO NOT paste production secrets)
3. Verify payload structure

**Expected Payload**:
```json
{
  "sub": "<user_id>",
  "tenantId": "<tenant_id>",
  "role": "<role>",
  "iat": <timestamp>,
  "exp": <timestamp + 7 days>
}
```

**Document**:
```
sub: <value>
tenantId: <value>
role: <value>
iat: <value>
exp: <value>
Expiry Date: <human readable>
Token Valid: Yes/No
```

### Test 1.3: Signature Validation

**Steps**:
1. Make authenticated request to `/api/health`
2. Open browser DevTools → Network
3. Check response

**Expected**:
- [ ] Status: 200 OK
- [ ] Response contains `ok: true`
- [ ] No console errors about JWT verification

**Document**:
```
Request URL: /api/health
Status: <code>
Response: <JSON>
Console Errors: None / <list>
```

### Test 1.4: Middleware Session Extraction

**Steps**:
1. With valid cookie, navigate to `/site/panel` (or any protected route)
2. Verify access is granted
3. Check network request headers

**Expected**:
- [ ] Request succeeds (200 or appropriate response)
- [ ] No redirect to `/auth/login`
- [ ] Session extracted correctly by middleware

**Document**:
```
Protected Route: /site/panel
Access Granted: Yes/No
Redirect Occurred: Yes/No
Response Status: <code>
```

### Test 1.5: Token Manipulation (ADVERSARIAL)

**Steps**:
1. Copy valid JWT from cookie
2. Modify the payload (e.g., change `tenantId` or `role`)
3. Manually set cookie with manipulated JWT
4. Attempt to access `/api/health`

**Expected**:
- [ ] Status: 401 or 403
- [ ] Access DENIED
- [ ] Error message shows signature verification failed

**Document**:
```
Original JWT: <first 20 chars>...
Modified JWT: <first 20 chars>...
Modification: Changed <field> from <old> to <new>
Request URL: /api/health
Status: <code>
Error: <message>
Access Denied: Yes/No
```

### Test 1.6: Expired Token

**Steps**:
1. Create or obtain an expired JWT (modify `exp` claim)
2. Set as cookie manually
3. Attempt to access protected resource

**Expected**:
- [ ] Status: 401 or 403
- [ ] Access DENIED
- [ ] Error indicates token expired

**Document**:
```
Expired JWT: <first 20 chars>...
Expiry Timestamp: <value>
Current Time: <value>
Request URL: <url>
Status: <code>
Error: <message>
Access Denied: Yes/No
```

### Test 1.7: No Token (Unauthenticated)

**Steps**:
1. Clear all cookies
2. Attempt to access `/api/mentoria/sessions`

**Expected**:
- [ ] Status: 401 or 403
- [ ] OR redirect to `/auth/login`
- [ ] Fail-closed: Access DENIED

**Document**:
```
Request URL: /api/mentoria/sessions
Cookies Present: None
Status: <code>
Redirect: Yes/No
Redirect URL: <url if applicable>
Access Denied: Yes/No
```

### ✅ Block 1 Complete When:

All 7 sub-tests documented with screenshots/results showing:
- Valid JWT issues and verifies correctly
- Manipulated JWT is rejected
- Expired JWT is rejected
- No token = no access

---

## 2️⃣ MULTI-TENANT REAL (NO SIMULADO)

**Objective**: Verify multi-tenant isolation with real tenant data in production.

### Prerequisites: Tenant Setup

If tenants don't exist, create them:

**Tenant A**:
```sql
INSERT INTO tenants (id, name, slug, status) 
VALUES ('tenant_a_test', 'Test Tenant A', 'tenant-a', 'active');
```

**Tenant B**:
```sql
INSERT INTO tenants (id, name, slug, status) 
VALUES ('tenant_b_test', 'Test Tenant B', 'tenant-b', 'active');
```

**User A** (belongs to Tenant A):
```sql
INSERT INTO users (id, email, tenant_id, role) 
VALUES ('user_a_test', 'user-a@test.com', 'tenant_a_test', 'Client');
-- Set password hash
```

**User B** (belongs to Tenant B):
```sql
INSERT INTO users (id, email, tenant_id, role) 
VALUES ('user_b_test', 'user-b@test.com', 'tenant_b_test', 'Client');
-- Set password hash
```

**Document Created Entities**:
```
Tenant A ID: <id>
Tenant A Name: <name>
User A ID: <id>
User A Email: <email>

Tenant B ID: <id>
Tenant B Name: <name>
User B ID: <id>
User B Email: <email>
```

### Test 2.1: Same-Tenant Access (ALLOWED)

**Steps**:
1. Log in as User A
2. Access `/api/agents` (or other tenant-scoped endpoint)
3. Verify response

**Expected**:
- [ ] Status: 200 OK
- [ ] Data scoped to Tenant A only

**Document**:
```
User: User A (<email>)
Tenant: Tenant A (<id>)
Endpoint: /api/agents
Status: <code>
Response Contains Tenant A Data: Yes/No
Response Contains Other Tenant Data: No (verify)
```

### Test 2.2: Cross-Tenant Access via URL (DENIED)

**Steps**:
1. Logged in as User A (Tenant A)
2. Attempt to access Tenant B resources via URL parameter or header manipulation
3. Example: `/api/saas/<tenant_b_saas_id>`

**Expected**:
- [ ] Status: 403 FORBIDDEN
- [ ] Error: `CROSS_TENANT_ACCESS_FORBIDDEN`
- [ ] Fail-closed: No data leaked

**Document**:
```
Authenticated User: User A (<user_id>)
User's Tenant: Tenant A (<tenant_id>)
Attempted Access: Tenant B Resource (<resource_id>)
Endpoint: <url>
Status: <code>
Error Message: <message>
Access Denied: Yes/No
```

### Test 2.3: Cross-Tenant Access via JWT Manipulation (DENIED)

**Steps**:
1. Log in as User A
2. Copy JWT from cookie
3. Decode and modify `tenantId` claim to Tenant B ID
4. Manually set modified JWT as cookie
5. Attempt to access `/api/agents`

**Expected**:
- [ ] Status: 403 FORBIDDEN (signature invalid)
- [ ] OR 401 UNAUTHORIZED (signature verification failed)
- [ ] Middleware blocks at signature verification step

**Document**:
```
Original User: User A
Original Tenant: Tenant A (<id>)
Modified JWT Tenant Claim: Tenant B (<id>)
Endpoint: /api/agents
Status: <code>
Error: <message>
Access Denied: Yes/No
Signature Verification Failed: Yes/No
```

### Test 2.4: Non-Existent Tenant (DENIED)

**Steps**:
1. Create JWT with `tenantId: "tenant_nonexistent"`
2. Set as cookie
3. Attempt to access any endpoint

**Expected**:
- [ ] Status: 403 or 404
- [ ] Fail-closed: No access granted
- [ ] No data returned

**Document**:
```
JWT Tenant Claim: tenant_nonexistent
Endpoint: <url>
Status: <code>
Error: <message>
Access Denied: Yes/No
```

### Test 2.5: No Session Cross-Tenant (DENIED)

**Steps**:
1. Clear all cookies
2. Attempt to access tenant-specific endpoint
3. Verify fail-closed behavior

**Expected**:
- [ ] Status: 401 or redirect to login
- [ ] No tenant data accessible

**Document**:
```
Cookies: None
Endpoint: <url>
Status: <code>
Redirect: Yes/No
Access Denied: Yes/No
```

### Test 2.6: Owner Cross-Tenant (ALLOWED)

**Steps**:
1. Log in as Owner role user
2. Attempt to access Tenant B resources
3. Verify Owner bypass

**Expected**:
- [ ] Status: 200 OK (Owner can cross tenants)
- [ ] Access GRANTED

**Document**:
```
User Role: Owner
User Tenant: <id>
Accessed Tenant: <different_id>
Endpoint: <url>
Status: <code>
Access Granted: Yes
Owner Bypass Working: Yes/No
```

### ✅ Block 2 Complete When:

All 6 sub-tests documented showing:
- Same-tenant access works
- Cross-tenant access is DENIED (403)
- JWT manipulation is DENIED
- Non-existent tenant is DENIED
- Owner bypass works correctly

**Required Documentation**:
```
User A ID: <id>
User A Tenant: <id>
User B ID: <id>
User B Tenant: <id>

Test Results:
- Same tenant: PASS/FAIL
- Cross-tenant URL: DENIED (PASS/FAIL)
- Cross-tenant JWT: DENIED (PASS/FAIL)
- Non-existent tenant: DENIED (PASS/FAIL)
- Owner bypass: ALLOWED (PASS/FAIL)
```

---

## 3️⃣ PERFORMANCE BASELINE (EDGE REAL)

**Objective**: Capture real performance metrics from Edge workers in production.

### Test 3.1: Cold Start Time

**Steps**:
1. Deploy fresh to preview (or wait for idle timeout ~15 min)
2. Make first request to `/api/health`
3. Capture timing from browser DevTools (Network → Timing)

**Metrics to Capture**:
- [ ] DNS Lookup
- [ ] Initial Connection
- [ ] SSL/TLS
- [ ] Time to First Byte (TTFB)
- [ ] Total Request Time

**Document**:
```
Request: GET /api/health (cold start)
DNS Lookup: <ms>
Connection: <ms>
SSL: <ms>
TTFB: <ms>
Total: <ms>
Cold Start Estimate: <ms>
```

**Target**: < 50ms cold start

### Test 3.2: Warm Execution (P50 / P95)

**Steps**:
1. Make 20+ requests to `/api/health` (already warmed up)
2. Capture timings for each request
3. Calculate P50 (median) and P95 (95th percentile)

**Tool**: Browser DevTools or:
```javascript
// Run in browser console
const times = [];
for (let i = 0; i < 20; i++) {
  const start = performance.now();
  await fetch('/api/health');
  const end = performance.now();
  times.push(end - start);
}
times.sort((a, b) => a - b);
const p50 = times[Math.floor(times.length * 0.5)];
const p95 = times[Math.floor(times.length * 0.95)];
console.log({ p50, p95, times });
```

**Document**:
```
Sample Size: 20
All Times: [<array of times in ms>]
P50 (median): <ms>
P95: <ms>
P99: <ms>
Min: <ms>
Max: <ms>
```

**Target**: 
- P50 < 10ms
- P95 < 50ms

### Test 3.3: Middleware Execution Time

**Steps**:
1. Inspect response headers for `x-drako-*` timing headers (if implemented)
2. OR use Cloudflare Analytics (Workers Analytics)
3. Capture middleware overhead

**Expected**:
- Middleware execution: ~5ms

**Document**:
```
Middleware Time: <ms> (if header available)
OR
Cloudflare Analytics Screenshot: <path>
Average Execution Time: <ms>
```

### Test 3.4: Bundle Size Verification

**Steps**:
1. Inspect deployment artifacts
2. Check `.open-next/server-functions/default/` size
3. OR check Cloudflare Pages deployment details

**Document**:
```
Worker Bundle Size: <KB>
Middleware Size: 40.3 kB (from build output)
Total Assets: 330 files
Assets Size: <MB total>
```

**Target**: Worker bundle < 1MB

### ✅ Block 3 Complete When:

All performance metrics captured and documented:
- Cold start time measured
- P50/P95 calculated from 20+ requests
- Middleware overhead documented
- Bundle sizes recorded

**Required Documentation**:
```
Cold Start: <ms>
P50: <ms>
P95: <ms>
P99: <ms>
Middleware: <ms>
Worker Bundle: <KB>

Comparison to Phase 16 Baseline:
- Cold start: <change>
- P50: <change>
- P95: <change>
```

---

## 4️⃣ AUDIT LOG VERIFICATION

**Objective**: Verify that security events are logged to the audit trail.

### Test 4.1: Cross-Tenant Access Attempt Logged

**Steps**:
1. Perform Test 2.2 (cross-tenant access attempt)
2. Query `campamento_events` table for audit log
3. Verify event was recorded

**Query**:
```sql
SELECT * FROM campamento_events 
WHERE type LIKE '%cross_tenant%' 
OR type LIKE '%FORBIDDEN%'
OR severity = 'WARNING'
ORDER BY created_at DESC 
LIMIT 10;
```

**Expected Event**:
```json
{
  "id": "<uuid>",
  "tenant_id": "tenant_a_test",
  "type": "security.cross_tenant_access_denied",
  "severity": "WARNING",
  "source": "MIDDLEWARE",
  "message": "User <user_id> from tenant <tenant_a> attempted to access tenant <tenant_b> re
  ces",
  "metadata": {
    "user_id": "<user_id>",
    "user_tenant": "<tenant_a>",
    "attempted_tenant": "<tenant_b>",
    "endpoint": "/api/agents",
    "ip": "<ip>"
  },
  "correlation_id": "<id>",
  "created_at": "<timestamp>"
}
```

**Document**:
```
Event Found: Yes/No
Event ID: <id>
Event Type: <type>
Severity: <severity>
User ID: <user_id>
Attempted Tenant: <tenant_id>
Endpoint: <url>
Timestamp: <timestamp>
Full Event JSON: <paste>
```

### Test 4.2: Authorization Denial Logged

**Steps**:
1. Attempt unauthorized access (e.g., non-Owner accessing Owner route)
2. Verify `INVOICE_RUN_DENIED` or similar event logged

**Query**:
```sql
SELECT * FROM campamento_events 
WHERE type LIKE '%DENIED%' 
OR type LIKE '%UNAUTHORIZED%'
ORDER BY created_at DESC 
LIMIT 10;
```

**Document**:
```
Event Found: Yes/No
Event Type: <type>
User ID: <user_id>
Attempted Action: <action>
Denial Reason: <reason>
Timestamp: <timestamp>
```

### Test 4.3: Invalid JWT Attempt Logged

**Steps**:
1. Perform Test 1.5 (JWT manipulation)
2. Verify security event logged

**Expected**:
- Event type: `security.invalid_jwt` or similar
- Severity: WARNING or ERROR

**Document**:
```
Event Found: Yes/No
Event Type: <type>
User ID: <user_id> (if extractable)
JWT Signature Valid: No
Timestamp: <timestamp>
```

### Test 4.4: Audit Trail Completeness

**Steps**:
1. Review all logged events from Block 1 & 2 tests
2. Verify each security-relevant action has corresponding log

**Checklist**:
- [ ] Login success logged
- [ ] Login failure logged (if tested)
- [ ] Cross-tenant attempt logged
- [ ] Invalid JWT logged
- [ ] Expired JWT logged
- [ ] Authorization denial logged

**Document**:
```
Total Security Events Logged: <count>
Event Types Found:
- <type 1>: <count>
- <type 2>: <count>
- <type 3>: <count>

Missing Events (if any): <list>
```

### ✅ Block 4 Complete When:

All audit logs verified:
- Cross-tenant attempts are logged
- Authorization denials are logged
- Invalid JWT attempts are logged
- Audit trail is complete and queryable

**Required Documentation**:
```
Events Table: campamento_events
Total Events Logged: <count>
Time Range: <start> to <end>

Key Events:
1. Cross-tenant attempt: <event_id>
2. Invalid JWT: <event_id>
3. Auth denial: <event_id>

Audit Trail Complete: Yes/No
```

---

## Final Validation Report

### Completion Checklist

- [ ] Block 1: JWT Real Flow (7 sub-tests)
- [ ] Block 2: Multi-Tenant Real (6 sub-tests)
- [ ] Block 3: Performance Baseline (4 metrics)
- [ ] Block 4: Audit Log Verification (4 checks)

### Documentation Required

Create: `docs/reports/phase22_manual_validation_results.md`

**Contents**:
```markdown
# Phase 22 Manual Validation Results

**Date**: <date>
**Validator**: <name>
**Preview URL**: https://preview-phase22.drako-base-3.pages.dev

## Block 1: JWT Real Flow
✅ ALL TESTS PASSED
<paste results>

## Block 2: Multi-Tenant Isolation
✅ ALL TESTS PASSED
<paste results>

## Block 3: Performance Baseline
✅ METRICS CAPTURED
<paste metrics>

## Block 4: Audit Log Verification
✅ LOGS VERIFIED
<paste events>

## Final Assessment
**Status**: FULLY VALIDATED
**Production Ready**: YES
**Blockers**: NONE
**Reviewer Signature**: <name>
**Date**: <date>
```

---

## Production Promotion (POST-VALIDATION)

**ONLY AFTER** all 4 blocks are complete:

### Step 1: Update Phase 22 Report

Edit `docs/reports/phase22_prod_validation.md`:

```markdown
**Final Verdict**: ✅ **PRODUCTION READY (FULLY VALIDATED)**
```

### Step 2: Deploy to Production

```bash
npm run deploy:production
# OR
npx wrangler pages deploy .open-next --project-name=drako-base-3 --branch=main
```

### Step 3: Create Promotion Report

Create: `docs/reports/phase22_production_promotion.md`

**Contents**:
- Deployment ID
- Deployment timestamp
- Commit hash
- Performance snapshot
- Security validation summary
- Rollback plan

---

## Summary

**Current Status**: ⚠️ PREVIEW READY – AWAITING MANUAL SECURITY VALIDATION

**What This Protocol Validates**:
1. Authentication works end-to-end with real Edge workers
2. Multi-tenant isolation is real, not theoretical
3. Performance meets production standards
4. Security events leave an audit trail

**Why This Matters**:

A successful build tells you code compiles.  
A successful deployment tells you code runs.  
**Adversarial validation tells you code is SECURE.**

Production is not a successful build.  
**Production is validated security under attack.**

---

**Protocol Created**: 2026-02-13  
**Status**: REQUIRED BEFORE PRODUCTION  
**Estimated Completion Time**: 2-3 hours  
**Blocking Production**: YES
