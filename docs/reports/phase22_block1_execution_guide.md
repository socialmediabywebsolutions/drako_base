# Block 1 Execution Guide

**Preview URL**: https://preview-phase22.drako-base-3.pages.dev

---

## Critical Tests to Execute NOW

Focus on **Test 1.5** and **Test 1.6**. These prove the Edge crypto engine is real.

---

## Test 1.5: JWT Manipulation (ADVERSARIAL)

### Goal
Prove that manipulated JWTs are REJECTED.

### Steps

1. **Login and capture valid JWT**
   ```
   1. Go to: https://preview-phase22.drako-base-3.pages.dev/auth/login
   2. Login with valid credentials
   3. Open DevTools (F12)
   4. Go to: Application → Cookies → drako-base-3.pages.dev
   5. Find: drako_session cookie
   6. Copy: JWT value
   ```

2. **Decode JWT**
   ```
   1. Go to: https://jwt.io
   2. Paste JWT into "Encoded" field
   3. View decoded payload
   4. Screenshot this (Evidence: jwt_flow/03_jwt_payload.png)
   ```

3. **Manipulate JWT**
   
   **Option A: Change tenantId**
   ```
   1. In jwt.io, modify the payload
   2. Change "tenantId": "xxx" to "tenantId": "HACKED"
   3. Copy the new encoded JWT (it will have invalid signature)
   ```

   **Option B: Manual manipulation**
   ```
   1. Take original JWT string
   2. Change last 10 characters to "MANIPULATED"
   3. This breaks the signature
   ```

4. **Set manipulated JWT as cookie**
   ```
   1. DevTools → Application → Cookies
   2. Double-click drako_session value
   3. Paste manipulated JWT
   4. Press Enter
   ```

5. **Attempt to access protected endpoint**
   ```
   1. Navigate to: https://preview-phase22.drako-base-3.pages.dev/api/health
   2. OR refresh any protected page
   ```

6. **Capture result**
   ```
   Expected: 401 or 403 status
   Expected: Error message about invalid signature
   Expected: Access DENIED
   
   Screenshot: jwt_flow/04_manipulated_jwt_denied.png
   - Show Network tab with 401/403
   - Show response body with error
   ```

### ⚠️ CRITICAL EVALUATION

**If status is 200 (OK)**:
- ❌ Signature verification is BROKEN
- ❌ Platform is NOT secure
- ❌ Production promotion BLOCKED

**If status is 401/403 (DENIED)**:
- ✅ Signature verification works
- ✅ Edge crypto engine is solid
- ✅ Continue to Test 1.6

---

## Test 1.6: Expired Token

### Goal
Prove that expired JWTs are REJECTED.

### Steps

1. **Get valid JWT**
   ```
   Same as Test 1.5 Step 1
   ```

2. **Decode and modify expiry**
   ```
   1. Go to jwt.io
   2. Paste JWT
   3. Find "exp": <timestamp>
   4. Change to past timestamp (e.g., exp: 1000000000)
   5. Copy new JWT
   ```

3. **Set expired JWT as cookie**
   ```
   DevTools → Application → Cookies
   Replace drako_session with expired JWT
   ```

4. **Attempt access**
   ```
   Navigate to /api/health
   ```

5. **Capture result**
   ```
   Expected: 401 or 403
   Expected: Error about expired token
   
   Screenshot: jwt_flow/05_expired_token_denied.png
   ```

### ⚠️ CRITICAL EVALUATION

**If status is 200 (OK)**:
- ❌ Expiry validation is BROKEN
- ❌ Tokens never expire
- ❌ Production promotion BLOCKED

**If status is 401/403 (DENIED)**:
- ✅ Expiry validation works
- ✅ Continue to Block 2

---

## What to Bring Back

When you complete these 2 tests, document:

```
Test 1.5: JWT Manipulation
- Original JWT (first 20 chars): eyJhbGciOiJSUzI1NiIsI...
- Modified Field: tenantId
- Original Value: tenant_xxx
- New Value: HACKED
- Status Code: 403
- Error Message: "Invalid signature"
- Result: DENIED ✅

Test 1.6: Expired Token
- Expired JWT (first 20 chars): eyJhbGciOiJSUzI1NiIsI...
- Expiry Timestamp: 1000000000 (2001-09-09)
- Current Time: 1770996000 (2026-02-13)
- Status Code: 401
- Error Message: "Token expired"
- Result: DENIED ✅
```

**If both tests show DENIED → Edge crypto engine is solid.**

**If either shows GRANTED → Platform is broken.**

---

**Start now. No more planning.**
