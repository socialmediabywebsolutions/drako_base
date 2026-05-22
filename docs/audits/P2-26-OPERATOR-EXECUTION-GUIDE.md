# P2-26 — Operator Execution Guide

## Quick Reference

**Phase:** Canary Ingress Parity Attach + Full Gated Smoke  
**Duration:** ~30-45 minutes  
**Risk:** LOW (proven attach/detach mechanics, hot rollback ready)  
**Code changes:** NONE (all code ready from P2-25)

---

## Prerequisites Checklist

- [x] P2-25 completed (settings runtime-owned, exports schema-aware)
- [x] Runtime build passing (27 routes, 0 blockers)
- [x] Worker deployed: `saas-socialflows-runtime-canary`
- [x] Gate secret: `SOCIALFLOW_CANARY_GATE_TOKEN` active
- [x] Staff user: `socialflow-canary-staff+p2-24f@drako.systems` ready
- [x] Bindings: `DRACO_DB`, `SOCIAL_DB`, `SOCIALFLOW_AUTHS_DB` confirmed

---

## STEP 1 — Attach 4 UI Routes (~10 min)

### Route 1: Profile

**Dashboard path:**  
Cloudflare → Workers & Pages → `saas-socialflows-runtime-canary` → Triggers → Routes → Add route

**Route:** `socialflow-canary.drako.systems/socialflow/profile*`  
**Zone:** `drako.systems`  
**Environment:** Production

**Expected timing:** 1.8-7.7 seconds  
**Propagation:** 0.9-2.5 seconds

---

### Route 2: AI

**Route:** `socialflow-canary.drako.systems/socialflow/ai*`  
**Zone:** `drako.systems`  
**Environment:** Production

**Expected timing:** 1.8-7.7 seconds

---

### Route 3: Settings Team

**Route:** `socialflow-canary.drako.systems/socialflow/settings/team*`  
**Zone:** `drako.systems`  
**Environment:** Production

**Expected timing:** 1.8-7.7 seconds

---

### Route 4: Settings Ownership

**Route:** `socialflow-canary.drako.systems/socialflow/settings/ownership*`  
**Zone:** `drako.systems`  
**Environment:** Production

**Expected timing:** 1.8-7.7 seconds

---

### Verify Routes Attached

**Check Cloudflare dashboard:**
- Navigate to worker: `saas-socialflows-runtime-canary`
- Triggers → Routes
- Confirm all 4 routes visible in list

**Total expected duration:** ~30-60 seconds for all 4 routes

---

## STEP 2 — Gate Bootstrap (~2 min)

### Open Browser

**URL:**
```
https://socialflow-canary.drako.systems/socialflow/auth?canaryGate=<SOCIALFLOW_CANARY_GATE_TOKEN>
```

**Expected behavior:**
- Cookie `__Host-socialflow_canary_gate` set automatically
- Redirect to `/socialflow/auth` login page
- SSR renders login form
- No 403, no 522

**Validation:**
- Open DevTools → Application → Cookies
- Confirm `__Host-socialflow_canary_gate` exists
- Attributes: Secure, HttpOnly, SameSite=Strict

---

## STEP 3 — Login (~1 min)

**Credentials:**
- Email: `socialflow-canary-staff+p2-24f@drako.systems`
- Password: `<staff canary password>`

**Expected behavior:**
- POST to `/api/socialflow/auths/logins`
- Returns `200 { ok: true }`
- Cookie `__Host-socialflow_canary_session` set
- Redirect to `/socialflow` workspace

**Validation:**
- DevTools → Cookies
- Confirm `__Host-socialflow_canary_session` exists
- Session persists across navigation

---

## STEP 4 — UI SSR Smoke (~10 min)

### Navigate to each route and verify SSR:

#### 1. Workspace
**URL:** `https://socialflow-canary.drako.systems/socialflow`

**Expected:**
- 200 HTML
- Runtime workspace shell
- Navigation sidebar
- No legacy dashboard fallback

**Validation:**
- View Source → confirm HTML SSR
- Network tab → `_next/static/*` assets load
- Console → no hydration errors

---

#### 2. Profile (NEW ROUTE)
**URL:** `https://socialflow-canary.drako.systems/socialflow/profile`

**Expected:**
- 200 HTML
- Profile form visible
- Save button operational
- No 522 error

**Validation:**
- View Source → HTML SSR
- Network → assets load
- DevTools → Headers → `x-correlation-id`, `x-socialflow-runtime-target`

---

#### 3. AI (NEW ROUTE)
**URL:** `https://socialflow-canary.drako.systems/socialflow/ai`

**Expected:**
- 200 HTML
- AI form (niche, tone, frequency)
- Generate button visible
- No 522 error

**Validation:**
- View Source → HTML SSR
- Network → chunks load
- Console → no errors

---

#### 4. Settings Account
**URL:** `https://socialflow-canary.drako.systems/socialflow/settings/account`

**Expected:**
- 200 HTML
- Runtime-owned settings UI
- Account info display
- Logout button visible

**Validation:**
- View Source → no `@/modules/socialflow-app/*` references
- UI matches runtime implementation

---

#### 5. Settings Team (NEW ROUTE)
**URL:** `https://socialflow-canary.drako.systems/socialflow/settings/team`

**Expected:**
- 200 HTML
- Team roster visible
- User metrics cards
- No legacy module UI

**Validation:**
- View Source → runtime-owned
- Network → assets load
- No 522 error

---

#### 6. Settings Ownership (NEW ROUTE)
**URL:** `https://socialflow-canary.drako.systems/socialflow/settings/ownership`

**Expected:**
- 200 HTML
- Export download button visible
- Ownership UI rendered
- No legacy coupling

**Validation:**
- View Source → HTML SSR
- Click "Download Full Backup" → triggers export API
- No errors

---

## STEP 5 — API Smoke (~5 min)

### Health Check
```bash
curl -H "x-socialflow-canary-gate: <token>" \
  https://socialflow-canary.drako.systems/api/socialflow/runtime/health
```

**Expected:** `200 { "healthy": true }`

---

### Readiness Check
```bash
curl -H "x-socialflow-canary-gate: <token>" \
  https://socialflow-canary.drako.systems/api/socialflow/runtime/readiness
```

**Expected:** `200 { "ready": true, "blockers": [] }`

---

### Profile API
```bash
curl -H "x-socialflow-canary-gate: <token>" \
  -H "Cookie: __Host-socialflow_canary_session=<session>" \
  https://socialflow-canary.drako.systems/api/socialflow/profile
```

**Expected:** `200 { "ok": true, "profile": {...} }`

---

### AI Generate
```bash
curl -X POST \
  -H "x-socialflow-canary-gate: <token>" \
  -H "Cookie: __Host-socialflow_canary_session=<session>" \
  -H "Content-Type: application/json" \
  -d '{"niche":"Test Niche","tone":"Professional","frequencyPerWeek":7,"saasId":"socialflow"}' \
  https://socialflow-canary.drako.systems/api/socialflow/ai/generate
```

**Expected:** `200 { "ok": true, "result": { "campaign": {...}, "posts": [...] } }`

---

### Exports
```bash
curl -H "x-socialflow-canary-gate: <token>" \
  -H "Cookie: __Host-socialflow_canary_session=<session>" \
  https://socialflow-canary.drako.systems/api/socialflow/exports/current \
  --output socialflow-export.zip
```

**Expected:** `200` with ZIP file download

---

## STEP 6 — Gate Enforcement Validation (~2 min)

### Without Gate (should fail)
```bash
curl https://socialflow-canary.drako.systems/api/socialflow/runtime/health
```

**Expected:** `403 SOCIALFLOW_CANARY_GATE_DENIED`

---

### With Gate Header (should succeed)
```bash
curl -H "x-socialflow-canary-gate: <token>" \
  https://socialflow-canary.drako.systems/api/socialflow/runtime/health
```

**Expected:** `200 { "healthy": true }`

---

## STEP 7 — Regression Validation (~5 min)

### Browser Console Checks

**Open DevTools → Console**

**Look for:**
- ❌ Hydration errors → FAIL if present
- ❌ "Text content did not match" → FAIL if present
- ❌ 404 on `_next/static/*` → FAIL if present
- ✅ No errors → PASS

---

### Network Tab Checks

**DevTools → Network**

**Verify:**
- ✅ All `_next/static/*` requests: 200
- ✅ All API requests: 200 or expected status
- ❌ Any 522 errors → FAIL
- ❌ Any 403 on authenticated routes → FAIL

---

### Headers Validation

**Check any UI response headers:**

**Required:**
- `x-correlation-id` → unique UUID
- `x-socialflow-runtime-target: saas-socialflows-runtime-canary`
- `x-socialflow-runtime-state: inactive-deployable`
- `x-socialflow-runtime-contract-version: p2-25` or newer

---

## SMOKE PASS CRITERIA

**All must be true:**

- [x] 4 routes attached successfully
- [x] Gate bootstrap working
- [x] Login successful
- [x] Workspace renders (SSR)
- [x] Profile renders (SSR) ← NEW
- [x] AI renders (SSR) ← NEW
- [x] Settings Account renders (SSR)
- [x] Settings Team renders (SSR) ← NEW
- [x] Settings Ownership renders (SSR) ← NEW
- [x] Health API: 200
- [x] Readiness API: 200
- [x] Profile API: 200
- [x] AI Generate API: 200
- [x] Exports API: 200 ZIP
- [x] Gate enforcement: 403 without gate
- [x] No 522 errors
- [x] No hydration errors
- [x] No 404 on assets
- [x] Runtime headers present
- [x] Cookies secure (HttpOnly, Secure, SameSite)

---

## ROLLBACK PROCEDURE (IF NEEDED)

### Scenario: Any smoke test fails

**Immediate action:**

1. **Detach all 4 routes**
   - Cloudflare → Workers → `saas-socialflows-runtime-canary`
   - Triggers → Routes → Delete each of the 4 new routes
   - Expected timing: ~30-60 seconds

2. **OR: Rollback worker version**
   - Cloudflare → Workers → `saas-socialflows-runtime-canary`
   - Deployments → Previous version → Rollback
   - Expected timing: 8.7-12.8 seconds (proven in P2-24A)

3. **Investigate failure**
   - Check `wrangler tail` logs
   - Check browser console errors
   - Check network requests
   - Review runtime headers
   - Verify gate secret still active

4. **Document failure**
   - Capture error messages
   - Capture network traces
   - Capture console logs
   - Update P2-26 audit with failure details

---

## SUCCESS CONFIRMATION

**When all smoke tests pass:**

1. **Document timings**
   - Route attach timings (each route)
   - Propagation delay
   - Total execution time

2. **Capture evidence**
   - Screenshots of SSR pages
   - curl response samples
   - Headers validation
   - Cookie validation

3. **Update P2-26 audit**
   - Mark FASE 1 complete
   - Mark FASE 2 complete
   - Add timing evidence
   - Add smoke results

4. **Proceed to P2-27**
   - OAuth human end-to-end validation
   - Real LinkedIn consent
   - Persistence validation

---

## POST-SMOKE NEXT STEPS

**If smoke passes:**

✅ **P2-26 COMPLETE**
- Limited traffic readiness: **YES**
- OAuth config readiness: **YES**
- Production cutover readiness: **NO** (still needs OAuth validation)

**Next phase: P2-27**
- Execute real LinkedIn OAuth consent
- Validate `saas_social_accounts` persistence
- Validate token functionality
- Rollback drill post-OAuth

**If smoke fails:**

❌ **P2-26 BLOCKED**
- Rollback routes or worker version
- Investigate failure
- Fix root cause
- Retry smoke

---

## Contact / Escalation

**If smoke fails and rollback needed:**
- Rollback is safe (proven in P2-24A/P2-24B)
- No production impact (canary is isolated)
- Document failure for investigation

**If smoke passes:**
- P2-26 complete
- Ready for P2-27 OAuth human validation
- No further operator action needed until P2-27

---

## Timeline Summary

**Total expected duration:** ~30-45 minutes

- **Route attach:** 10 min
- **Gate bootstrap:** 2 min
- **Login:** 1 min
- **UI smoke:** 10 min
- **API smoke:** 5 min
- **Gate validation:** 2 min
- **Regression checks:** 5 min
- **Documentation:** 5-10 min

**Rollback available:** 9-13 seconds (proven)

---

## Notes

- **NO code changes** in P2-26
- **NO production impact** (canary isolated)
- **NO DNS changes** (canary hostname already exists)
- **NO public traffic** (gate fail-closed)
- **NO OAuth human validation** (deferred to P2-27)

**This is pure operator infrastructure execution.**

All code is ready from P2-25. This phase validates that the canary ingress serves the runtime correctly before proceeding to OAuth human validation.
