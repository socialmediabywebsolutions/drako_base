# P2-26 Quick Start — Smoke Validation

**Status:** Password rotated, ready for execution  
**Time required:** ~5-10 minutes for login validation  
**Risk:** LOW (canary only, reversible)

---

## STEP 1: Update Database Password (30 seconds)

**Copy and execute this command:**

```bash
wrangler d1 execute socialflows_auths_db --remote --command "\
UPDATE socialflow_credentials
SET 
  hash = 'YprIZHDxmZe+YGt+oneeRdleP9LA1K8QX40++GDs5U0=',
  salt = 'MnCI76W9RYVGCmnZ+ilgwg==',
  iterations = 100000,
  algo = 'PBKDF2-SHA256',
  updated_at = '2026-05-17T11:18:57.274Z'
WHERE user_id = (
  SELECT id FROM socialflow_users WHERE email = 'socialflow-canary-staff+p2-24f@drako.systems'
);
"
```

**Expected output:**
```
🌀 Executing on remote database socialflows_auths_db (...)
🚣 Executed 1 command in X.XXXms
```

✅ If you see this → password updated successfully  
❌ If error → check wrangler login, check database name

---

## STEP 2: Verify Update (30 seconds)

**Copy and execute:**

```bash
wrangler d1 execute socialflows_auths_db --remote --command "\
SELECT u.email, c.algo, c.iterations, datetime(c.updated_at) as updated
FROM socialflow_users u
JOIN socialflow_credentials c ON c.user_id = u.id
WHERE u.email = 'socialflow-canary-staff+p2-24f@drako.systems'
"
```

**Expected output:**
```
┌─────────────────────────────────────────────┬──────────────┬────────────┬─────────────────────┐
│ email                                        │ algo         │ iterations │ updated             │
├─────────────────────────────────────────────┼──────────────┼────────────┼─────────────────────┤
│ socialflow-canary-staff+p2-24f@drako.systems │ PBKDF2-SHA256│ 100000     │ 2026-05-17 11:18:57 │
└─────────────────────────────────────────────┴──────────────┴────────────┴─────────────────────┘
```

✅ Updated timestamp matches → database update confirmed

---

## STEP 3: Test Login in Browser (2 minutes)

### 3.1 Gate Bootstrap

**Open browser and navigate to:**

```
https://socialflow-canary.drako.systems/socialflow/auth?canaryGate=<SOCIALFLOW_CANARY_GATE_TOKEN>
```

**Replace `<SOCIALFLOW_CANARY_GATE_TOKEN>` with your actual gate token.**

**Expected:**
- Page loads (no 522, no 403)
- Redirects to login page
- Cookie `__Host-socialflow_canary_gate` set (check DevTools → Application → Cookies)

✅ If login form visible → gate bootstrap successful  
❌ If 403 → check gate token  
❌ If 522 → routes not attached yet (expected for P2-26)

---

### 3.2 Login

**Credentials:**
- Email: `socialflow-canary-staff+p2-24f@drako.systems`
- Password: `45x7u!PY-8jMaFG36nnTudXN`

**Click "Sign In" or "Login"**

**Expected:**
- Request to `/api/socialflow/auths/logins`
- Response: `200 { ok: true }`
- Cookie `__Host-socialflow_canary_session` set
- Redirect to `/socialflow` workspace

✅ If redirected to workspace → login successful  
❌ If "Invalid credentials" → re-check password (copy-paste carefully)  
❌ If 401/403 → database update may have failed

---

## STEP 4: Validate Access (3 minutes)

**Navigate to each route and check for 200 (not 522):**

### Currently Attached Routes (Should Work)

1. **Workspace**  
   URL: `https://socialflow-canary.drako.systems/socialflow`  
   Expected: ✅ 200 HTML, workspace UI

2. **Settings Account**  
   URL: `https://socialflow-canary.drako.systems/socialflow/settings/account`  
   Expected: ✅ 200 HTML, account settings

---

### NEW Routes (May Return 522 Until Attached)

3. **Profile** ← NEW (P2-26)  
   URL: `https://socialflow-canary.drako.systems/socialflow/profile`  
   Expected: ❓ 522 (route not attached yet) or ✅ 200 (if already attached)

4. **AI** ← NEW (P2-26)  
   URL: `https://socialflow-canary.drako.systems/socialflow/ai`  
   Expected: ❓ 522 (route not attached yet) or ✅ 200 (if already attached)

5. **Settings Team** ← NEW (P2-26)  
   URL: `https://socialflow-canary.drako.systems/socialflow/settings/team`  
   Expected: ❓ 522 (route not attached yet) or ✅ 200 (if already attached)

6. **Settings Ownership** ← NEW (P2-26)  
   URL: `https://socialflow-canary.drako.systems/socialflow/settings/ownership`  
   Expected: ❓ 522 (route not attached yet) or ✅ 200 (if already attached)

---

## Expected Results Summary

**After password rotation:**
- ✅ Database updated
- ✅ Login successful
- ✅ Session cookie set
- ✅ Workspace accessible
- ✅ Settings Account accessible

**NEW routes (522 expected until P2-26 route attach):**
- ❓ Profile → 522 (waiting for route attach)
- ❓ AI → 522 (waiting for route attach)
- ❓ Settings Team → 522 (waiting for route attach)
- ❓ Settings Ownership → 522 (waiting for route attach)

**This is CORRECT behavior before route attach.**

---

## What to Do After Login Validation

### If Login Successful → Proceed to Route Attach

**Next step:** Attach 4 missing routes in Cloudflare dashboard

**Reference:** `@docs/audits/P2-26-OPERATOR-EXECUTION-GUIDE.md:1-484`

**Routes to attach:**
1. `socialflow-canary.drako.systems/socialflow/profile*`
2. `socialflow-canary.drako.systems/socialflow/ai*`
3. `socialflow-canary.drako.systems/socialflow/settings/team*`
4. `socialflow-canary.drako.systems/socialflow/settings/ownership*`

**Expected timing:** ~10 minutes to attach all 4 routes

---

### If Login Failed → Troubleshoot

**Check:**
1. Database update successful? (STEP 2 verification)
2. Password copied correctly? (no extra spaces)
3. Email correct? `socialflow-canary-staff+p2-24f@drako.systems`
4. User status active? (run verification query)

**Re-run rotation if needed:**
```bash
node scripts/rotate-canary-staff-password.mjs
```

---

## Security Reminder

⚠️ **Temporary Password**

- Password: `45x7u!PY-8jMaFG36nnTudXN`
- Valid for: P2-26 smoke testing ONLY
- Rotate again: After P2-26 completion
- Storage: Secure password manager or delete after use
- Git: NEVER commit
- Logs: NEVER log in plaintext

---

## Full Documentation

**Detailed guides:**
- `@docs/audits/P2-26-STAFF-PASSWORD-ROTATION.md:1-364` — Full rotation audit
- `@docs/audits/P2-26-OPERATOR-EXECUTION-GUIDE.md:1-484` — Smoke execution guide
- `@docs/audits/P2-26-CANARY-INGRESS-PARITY-EXECUTION.md:1-716` — Complete audit

---

## Quick Checklist

- [ ] STEP 1: Database password updated
- [ ] STEP 2: Update verified
- [ ] STEP 3: Gate bootstrap successful
- [ ] STEP 3: Login successful
- [ ] STEP 3: Session cookie set
- [ ] STEP 4: Workspace accessible
- [ ] STEP 4: Settings Account accessible
- [ ] Ready for route attach (if 522 on new routes is expected)

---

## Next Actions

**After login validation:**

1. **If login works:**
   - Proceed to Cloudflare dashboard
   - Attach 4 missing UI routes
   - Execute full gated smoke
   - Document results

2. **If login fails:**
   - Troubleshoot (check database, password)
   - Re-run rotation if needed
   - Retry login

3. **After P2-26 completion:**
   - Rotate password again (new temporary)
   - Delete current password
   - Document final smoke results
   - Proceed to P2-27 OAuth human validation

---

**Total time:** ~10 minutes to validate login + session  
**Risk:** LOW (canary only, reversible, no production impact)  
**Ready:** Password rotated, database update command ready
