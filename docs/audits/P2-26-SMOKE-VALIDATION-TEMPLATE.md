# P2-26 — Smoke Validation Results Template

**Date:** ___________  
**Operator:** ___________  
**Worker:** `saas-socialflows-runtime-canary`  
**Version:** ___________

---

## FASE 1 — Route Attach Timings

### Route 1: Profile
- **Route:** `socialflow-canary.drako.systems/socialflow/profile*`
- **Attach started:** ___________ (timestamp)
- **Attach completed:** ___________ (timestamp)
- **Duration:** ___________ ms
- **Status:** [ ] SUCCESS  [ ] FAILED
- **Notes:** ___________

### Route 2: AI
- **Route:** `socialflow-canary.drako.systems/socialflow/ai*`
- **Attach started:** ___________ (timestamp)
- **Attach completed:** ___________ (timestamp)
- **Duration:** ___________ ms
- **Status:** [ ] SUCCESS  [ ] FAILED
- **Notes:** ___________

### Route 3: Settings Team
- **Route:** `socialflow-canary.drako.systems/socialflow/settings/team*`
- **Attach started:** ___________ (timestamp)
- **Attach completed:** ___________ (timestamp)
- **Duration:** ___________ ms
- **Status:** [ ] SUCCESS  [ ] FAILED
- **Notes:** ___________

### Route 4: Settings Ownership
- **Route:** `socialflow-canary.drako.systems/socialflow/settings/ownership*`
- **Attach started:** ___________ (timestamp)
- **Attach completed:** ___________ (timestamp)
- **Duration:** ___________ ms
- **Status:** [ ] SUCCESS  [ ] FAILED
- **Notes:** ___________

**Total attach duration:** ___________ (start to finish)  
**Propagation observed:** ___________ ms

---

## FASE 2 — UI SSR Validation

### Gate Bootstrap
- **URL:** `https://socialflow-canary.drako.systems/socialflow/auth?canaryGate=<token>`
- **Cookie set:** [ ] YES  [ ] NO
- **Cookie name:** `__Host-socialflow_canary_gate`
- **Cookie attributes:** [ ] Secure  [ ] HttpOnly  [ ] SameSite=Strict
- **Redirect to login:** [ ] YES  [ ] NO
- **Status:** [ ] PASS  [ ] FAIL
- **Notes:** ___________

### Login Flow
- **Email:** `socialflow-canary-staff+p2-24f@drako.systems`
- **Response status:** ___________
- **Session cookie:** [ ] YES  [ ] NO
- **Cookie name:** `__Host-socialflow_canary_session`
- **Redirect to workspace:** [ ] YES  [ ] NO
- **Status:** [ ] PASS  [ ] FAIL
- **Notes:** ___________

### UI Route 1: Workspace
- **URL:** `/socialflow`
- **Response status:** ___________
- **SSR rendered:** [ ] YES  [ ] NO
- **Assets loaded:** [ ] YES  [ ] NO
- **Hydration errors:** [ ] NONE  [ ] ERRORS
- **Runtime headers:** [ ] PRESENT  [ ] MISSING
- **Status:** [ ] PASS  [ ] FAIL
- **Notes:** ___________

### UI Route 2: Profile (NEW)
- **URL:** `/socialflow/profile`
- **Response status:** ___________
- **SSR rendered:** [ ] YES  [ ] NO
- **Assets loaded:** [ ] YES  [ ] NO
- **Hydration errors:** [ ] NONE  [ ] ERRORS
- **Form visible:** [ ] YES  [ ] NO
- **No 522 error:** [ ] CONFIRMED  [ ] FAILED
- **Status:** [ ] PASS  [ ] FAIL
- **Notes:** ___________

### UI Route 3: AI (NEW)
- **URL:** `/socialflow/ai`
- **Response status:** ___________
- **SSR rendered:** [ ] YES  [ ] NO
- **Assets loaded:** [ ] YES  [ ] NO
- **Hydration errors:** [ ] NONE  [ ] ERRORS
- **Form visible:** [ ] YES  [ ] NO
- **No 522 error:** [ ] CONFIRMED  [ ] FAILED
- **Status:** [ ] PASS  [ ] FAIL
- **Notes:** ___________

### UI Route 4: Settings Account
- **URL:** `/socialflow/settings/account`
- **Response status:** ___________
- **SSR rendered:** [ ] YES  [ ] NO
- **Runtime-owned UI:** [ ] CONFIRMED  [ ] LEGACY
- **No module imports:** [ ] CONFIRMED  [ ] DETECTED
- **Status:** [ ] PASS  [ ] FAIL
- **Notes:** ___________

### UI Route 5: Settings Team (NEW)
- **URL:** `/socialflow/settings/team`
- **Response status:** ___________
- **SSR rendered:** [ ] YES  [ ] NO
- **Assets loaded:** [ ] YES  [ ] NO
- **Team roster visible:** [ ] YES  [ ] NO
- **No 522 error:** [ ] CONFIRMED  [ ] FAILED
- **Status:** [ ] PASS  [ ] FAIL
- **Notes:** ___________

### UI Route 6: Settings Ownership (NEW)
- **URL:** `/socialflow/settings/ownership`
- **Response status:** ___________
- **SSR rendered:** [ ] YES  [ ] NO
- **Assets loaded:** [ ] YES  [ ] NO
- **Export button visible:** [ ] YES  [ ] NO
- **No 522 error:** [ ] CONFIRMED  [ ] FAILED
- **Status:** [ ] PASS  [ ] FAIL
- **Notes:** ___________

---

## FASE 2 — API Validation

### Health Check
- **Endpoint:** `/api/socialflow/runtime/health`
- **Response status:** ___________
- **Response body:** ___________
- **Status:** [ ] PASS  [ ] FAIL

### Readiness Check
- **Endpoint:** `/api/socialflow/runtime/readiness`
- **Response status:** ___________
- **Blockers count:** ___________
- **Blockers:** ___________
- **Status:** [ ] PASS  [ ] FAIL

### Profile API
- **Endpoint:** `/api/socialflow/profile`
- **Response status:** ___________
- **Profile returned:** [ ] YES  [ ] NO
- **Status:** [ ] PASS  [ ] FAIL

### AI Generate API
- **Endpoint:** `/api/socialflow/ai/generate`
- **Request:** `{"niche":"Test","tone":"Professional","frequencyPerWeek":7,"saasId":"socialflow"}`
- **Response status:** ___________
- **Campaign generated:** [ ] YES  [ ] NO
- **Posts count:** ___________
- **Status:** [ ] PASS  [ ] FAIL

### Exports API
- **Endpoint:** `/api/socialflow/exports/current`
- **Response status:** ___________
- **Content-Type:** ___________
- **ZIP size:** ___________ bytes
- **ZIP valid:** [ ] YES  [ ] NO
- **Status:** [ ] PASS  [ ] FAIL

---

## FASE 2 — Gate Enforcement

### Without Gate Header
- **Endpoint:** `/api/socialflow/runtime/health` (no header)
- **Response status:** ___________
- **Expected:** `403 SOCIALFLOW_CANARY_GATE_DENIED`
- **Status:** [ ] PASS  [ ] FAIL

### With Gate Header
- **Endpoint:** `/api/socialflow/runtime/health` (with header)
- **Response status:** ___________
- **Expected:** `200 { "healthy": true }`
- **Status:** [ ] PASS  [ ] FAIL

---

## FASE 2 — Headers Validation

### Runtime Headers
- **x-correlation-id:** [ ] PRESENT  [ ] MISSING
- **x-socialflow-runtime-target:** ___________
- **x-socialflow-runtime-state:** ___________
- **x-socialflow-runtime-contract-version:** ___________
- **Status:** [ ] PASS  [ ] FAIL

### Cookie Validation
- **Gate cookie:** `__Host-socialflow_canary_gate`
  - Secure: [ ] YES  [ ] NO
  - HttpOnly: [ ] YES  [ ] NO
  - SameSite: ___________
- **Session cookie:** `__Host-socialflow_canary_session`
  - Secure: [ ] YES  [ ] NO
  - HttpOnly: [ ] YES  [ ] NO
  - SameSite: ___________
- **Status:** [ ] PASS  [ ] FAIL

---

## FASE 2 — Regression Checks

### Hydration
- **Hydration errors:** [ ] NONE  [ ] ERRORS
- **Console errors:** [ ] NONE  [ ] ERRORS
- **Details:** ___________
- **Status:** [ ] PASS  [ ] FAIL

### Assets
- **All `_next/static/*`:** [ ] 200  [ ] ERRORS
- **Any 404s:** [ ] NO  [ ] YES
- **Details:** ___________
- **Status:** [ ] PASS  [ ] FAIL

### Legacy Detection
- **Dashboard fallback:** [ ] NONE  [ ] DETECTED
- **Module imports:** [ ] NONE  [ ] DETECTED
- **Details:** ___________
- **Status:** [ ] PASS  [ ] FAIL

### 522 Errors
- **Any 522 errors:** [ ] NO  [ ] YES
- **Details:** ___________
- **Status:** [ ] PASS  [ ] FAIL

---

## OVERALL SMOKE RESULT

**FASE 1 (Route Attach):** [ ] PASS  [ ] FAIL  
**FASE 2 (UI SSR):** [ ] PASS  [ ] FAIL  
**FASE 2 (API):** [ ] PASS  [ ] FAIL  
**FASE 2 (Gate):** [ ] PASS  [ ] FAIL  
**FASE 2 (Headers):** [ ] PASS  [ ] FAIL  
**FASE 2 (Regression):** [ ] PASS  [ ] FAIL

**P2-26 OVERALL:** [ ] PASS  [ ] FAIL

---

## READINESS STATUS

**Limited traffic ready:** [ ] YES  [ ] NO  
**OAuth human ready:** [ ] YES  [ ] NO  
**Production cutover ready:** [ ] YES  [ ] NO

---

## NEXT PHASE

**If smoke passed:**
- [ ] Proceed to P2-27 OAuth human end-to-end validation

**If smoke failed:**
- [ ] Rollback executed: [ ] YES  [ ] NO
- [ ] Rollback duration: ___________ ms
- [ ] Root cause: ___________
- [ ] Fix required: ___________
- [ ] Retry P2-26 after fix

---

## NOTES

___________________________________________
___________________________________________
___________________________________________
___________________________________________

---

## EVIDENCE

**Screenshots attached:**
- [ ] Gate bootstrap
- [ ] Login page
- [ ] Workspace
- [ ] Profile (NEW)
- [ ] AI (NEW)
- [ ] Settings Team (NEW)
- [ ] Settings Ownership (NEW)
- [ ] DevTools cookies
- [ ] DevTools headers
- [ ] Network tab (assets)

**curl outputs attached:**
- [ ] Health check
- [ ] Readiness check
- [ ] Profile API
- [ ] AI Generate API
- [ ] Exports API
- [ ] Gate enforcement test

---

**Completed by:** ___________  
**Date/Time:** ___________  
**Signature:** ___________
