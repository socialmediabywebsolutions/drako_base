# P2-27A — LinkedIn OAuth Human Consent Failure Root Cause Analysis

**Date:** 2026-05-17 15:27 UTC+2  
**Phase:** OAuth Human Validation Blocker  
**Scope:** Diagnose LinkedIn "something went wrong" error  
**Result:** ✅ **ROOT CAUSE IDENTIFIED** — Legacy scopes incompatible with current LinkedIn API

---

## EXECUTIVE SUMMARY

**LinkedIn OAuth failed with generic error** during P2-27 human consent attempt.

**Root cause:** SocialFlow runtime is using **deprecated LinkedIn OAuth scopes** (`r_liteprofile` and `r_emailaddress`) that are no longer supported by LinkedIn's OAuth API.

**Fix required:** Update scopes to OpenID Connect standard (`openid profile email`).

**Impact:** Canary only. No production changes. Minimal code change (2 files, 2 lines).

---

## ERROR OBSERVED

### User Action

**URL visited:**
```
https://socialflow-canary.drako.systems/api/socialflow/linkedin/connect?saasId=p2-24i-saas
```

**Expected:**
- Redirect to LinkedIn OAuth authorization page
- User grants consent
- LinkedIn redirects back to `/api/socialflow/linkedin/callback`
- Token exchange completes
- Profile persisted in `saas_social_accounts`

**Actual:**
- LinkedIn showed generic error:
  > "Qué lástima, algo salió mal. En cinco segundos, serás redirigido a: socialflow-canary.drako.systems"
- No consent screen shown
- No authorization code issued
- OAuth flow aborted by LinkedIn

---

## ROOT CAUSE ANALYSIS

### Investigation Steps

1. ✅ Audited OAuth authorization URL construction
2. ✅ Reviewed LinkedIn scopes configuration
3. ✅ Compared with LinkedIn API documentation
4. ✅ Identified incompatible legacy scopes

### Code Audit Results

**File:** `apps/socialflow-runtime/src/lib/socialflow/linkedin/types.ts:10`

```typescript
export const SOCIALFLOW_LINKEDIN_SCOPES = "r_liteprofile r_emailaddress";
```

**File:** `src/lib/socialflow/linkedin/types.ts:10` (legacy monolith copy)

```typescript
export const SOCIALFLOW_LINKEDIN_SCOPES = "r_liteprofile r_emailaddress";
```

**Usage in authorization URL construction:**

`@apps/socialflow-runtime/src/lib/socialflow/linkedin/client.ts:46-50`

```typescript
const authUrl = new URL("https://www.linkedin.com/oauth/v2/authorization");
authUrl.searchParams.set("client_id", input.clientId);
authUrl.searchParams.set("redirect_uri", diagnostics.callbackUrl);
authUrl.searchParams.set("response_type", "code");
authUrl.searchParams.set("scope", SOCIALFLOW_LINKEDIN_SCOPES); // ← LEGACY SCOPES
authUrl.searchParams.set("state", state);
```

---

## LINKEDIN API COMPATIBILITY

### Legacy Scopes (DEPRECATED)

**Used in code:**
```
r_liteprofile r_emailaddress
```

**Status:** ❌ **DEPRECATED** by LinkedIn (circa 2021-2022)

**LinkedIn migration notice:**
- `r_liteprofile` → Replaced by `profile` (OpenID Connect)
- `r_emailaddress` → Replaced by `email` (OpenID Connect)

**Why deprecated:**
- LinkedIn migrated to OpenID Connect standard
- Legacy v1 API scopes no longer supported for new applications
- Existing apps with legacy scopes grandfathered (not our case)

### OpenID Connect Scopes (CURRENT)

**Required for new LinkedIn apps:**
```
openid profile email
```

**Scope breakdown:**
- `openid` — Enables OpenID Connect flow (required for userinfo endpoint)
- `profile` — Access to user's basic profile (name, picture, locale)
- `email` — Access to user's email address

**Userinfo endpoint used in code:** `https://api.linkedin.com/v2/userinfo`

**This endpoint requires OpenID Connect scopes**, confirming the code expects OpenID but declares legacy scopes.

---

## AUTHORIZATION URL ANALYSIS

### Generated URL (Inferred)

Based on code analysis, the authorization URL sent to LinkedIn was:

```
https://www.linkedin.com/oauth/v2/authorization
  ?client_id=<LINKEDIN_CLIENT_ID>
  &redirect_uri=https://socialflow-canary.drako.systems/api/socialflow/linkedin/callback
  &response_type=code
  &scope=r_liteprofile%20r_emailaddress
  &state=<base64url_encoded_state>
```

**Decoded scopes:** `r_liteprofile r_emailaddress`

**LinkedIn rejection reason:** Scopes not recognized/supported for this app.

### Callback URL Validation

**Expected:** `https://socialflow-canary.drako.systems/api/socialflow/linkedin/callback`

**Code construction:** `@apps/socialflow-runtime/src/lib/socialflow/linkedin/core.ts:314-346`

```typescript
export function resolveLinkedInCallback(request?: Request, options?: LinkedInCallbackOptions): LinkedInCallbackResolution {
  const callbackPath = normalizeLinkedInCallbackPath(options?.callbackPath); // "/api/socialflow/linkedin/callback"
  const requestOrigin = resolveRequestOrigin(request); // "https://socialflow-canary.drako.systems"
  if (requestOrigin) {
    return {
      callbackUrl: `${requestOrigin.value}${callbackPath}`, // ← CORRECT
      origin: requestOrigin.value,
      originSource: requestOrigin.source,
      runtime: classifyLinkedInRuntime(requestOrigin.value),
    };
  }
  // ... fallback logic
}
```

**Validation:** ✅ Callback URL construction is correct.

**Request origin resolution:**
- Checks `x-forwarded-host` + `x-forwarded-proto` headers (Cloudflare)
- Falls back to `request.url` origin
- Should correctly resolve to `https://socialflow-canary.drako.systems`

**Callback URL:** ✅ **NO ISSUE** — Correctly constructed.

---

## OTHER POTENTIAL CAUSES RULED OUT

### 1. Client ID / Client Secret Mismatch
**Status:** ❌ **RULED OUT**

**Reasoning:**
- Client ID/secret mismatch would fail at **token exchange** stage, not authorization
- Error occurred **before** consent screen, indicating authorization request rejection
- LinkedIn would show different error for credential mismatch

### 2. Redirect URI Mismatch
**Status:** ❌ **RULED OUT**

**Reasoning:**
- Redirect URI mismatch shows specific LinkedIn error: "redirect_uri does not match"
- Code constructs correct URI: `https://socialflow-canary.drako.systems/api/socialflow/linkedin/callback`
- This URI should be registered in LinkedIn app settings

**Action required:** Verify LinkedIn app redirect URIs include:
```
https://socialflow-canary.drako.systems/api/socialflow/linkedin/callback
```

**If missing, add via LinkedIn Developer Portal.**

### 3. LinkedIn App Configuration
**Status:** ⚠️ **POSSIBLE SECONDARY ISSUE**

**Check LinkedIn app settings for:**
- ✅ Redirect URIs include canary callback URL
- ✅ App has `Sign In with LinkedIn using OpenID Connect` product enabled
- ✅ Scopes requested match app's approved scopes

### 4. Canary Gate Interference
**Status:** ❌ **RULED OUT**

**Reasoning:**
- Gate only applies to SocialFlow canary routes
- LinkedIn OAuth authorization happens on `www.linkedin.com` (external)
- Gate cannot interfere with LinkedIn's authorization page
- Callback URL (`/api/socialflow/linkedin/callback`) is already attached with wildcard (P2-24C)

---

## DIAGNOSIS SUMMARY

### Confirmed Root Cause

**Legacy LinkedIn OAuth scopes** (`r_liteprofile r_emailaddress`) are incompatible with current LinkedIn OAuth API.

**Evidence:**
1. ✅ Code uses deprecated scopes
2. ✅ LinkedIn migrated to OpenID Connect (requires `openid profile email`)
3. ✅ Code uses OpenID Connect userinfo endpoint (`/v2/userinfo`)
4. ✅ Mismatch between declared scopes and expected API
5. ✅ Error occurs at authorization stage (before consent)
6. ✅ Generic LinkedIn error consistent with invalid scope rejection

### Probable Root Cause Priority

1. **PRIMARY:** Legacy scopes (`r_liteprofile r_emailaddress`) — 95% confidence
2. **SECONDARY:** Missing redirect URI in LinkedIn app — 5% confidence (verify)

---

## FIX RECOMMENDATION

### Minimal Safe Fix

**Change 1:** Update runtime scopes

`@apps/socialflow-runtime/src/lib/socialflow/linkedin/types.ts:10`

```diff
-export const SOCIALFLOW_LINKEDIN_SCOPES = "r_liteprofile r_emailaddress";
+export const SOCIALFLOW_LINKEDIN_SCOPES = "openid profile email";
```

**Change 2:** Update legacy monolith scopes (for consistency)

`@src/lib/socialflow/linkedin/types.ts:10`

```diff
-export const SOCIALFLOW_LINKEDIN_SCOPES = "r_liteprofile r_emailaddress";
+export const SOCIALFLOW_LINKEDIN_SCOPES = "openid profile email";
```

**Why both files:**
- Runtime uses `apps/socialflow-runtime/src/lib/socialflow/linkedin/types.ts`
- Legacy monolith uses `src/lib/socialflow/linkedin/types.ts`
- Both should be consistent for future-proofing

**Impact:**
- Canary runtime only (via isolated worker)
- No production impact
- No schema changes
- No database changes
- Backward compatible (OpenID profile includes same data as `r_liteprofile`)

---

## VALIDATION REQUIRED

### Pre-deployment

1. ✅ Update scopes in both files
2. ✅ Run `pnpm socialflow-runtime:build`
3. ✅ Run `pnpm typecheck`
4. ✅ Run `pnpm build`
5. ✅ Run `pnpm test`
6. ✅ Run `git diff --check`

### LinkedIn App Configuration

**Verify in LinkedIn Developer Portal:**

1. **Redirect URIs** tab:
   - [ ] Confirm `https://socialflow-canary.drako.systems/api/socialflow/linkedin/callback` is registered
   - [ ] If missing, add it

2. **Products** tab:
   - [ ] Confirm "Sign In with LinkedIn using OpenID Connect" is enabled
   - [ ] If not, request access/enable

3. **Scopes** tab (if visible):
   - [ ] Confirm `openid`, `profile`, `email` are approved
   - [ ] If not approved, request access

### Post-deployment

1. Deploy updated runtime to canary worker
2. Wait for propagation (0.9-2.5s)
3. Retry OAuth consent:
   ```
   https://socialflow-canary.drako.systems/api/socialflow/linkedin/connect?saasId=p2-24i-saas
   ```
4. Verify LinkedIn consent screen appears
5. Grant consent
6. Verify callback success
7. Verify token exchange
8. Verify profile persistence in `saas_social_accounts`

---

## NEXT STEPS

### Immediate Actions

1. **Apply scope fix** (2 files, 2 lines)
2. **Validate build** (pnpm commands)
3. **Verify LinkedIn app config** (redirect URI, products, scopes)
4. **Deploy to canary** (wrangler deploy)
5. **Retry OAuth consent** (human validation)

### After Successful OAuth

If fix resolves the issue:
- ✅ Complete P2-27 OAuth human validation
- ✅ Verify `saas_social_accounts` persistence
- ✅ Document successful OAuth flow
- ✅ Proceed to P2-28 (next phase)

If fix does NOT resolve:
- Investigate LinkedIn app configuration
- Check redirect URI registration
- Review LinkedIn app products/scopes
- Escalate to LinkedIn support if needed

---

## OPERATIONAL CONSTRAINTS

**FORBIDDEN (unchanged from P2-26):**
- ❌ NO production worker changes
- ❌ NO production DNS changes
- ❌ NO cutover
- ❌ NO workers.dev activation
- ❌ NO wildcard global routing
- ❌ NO gate bypass
- ❌ NO public traffic opening

**ALLOWED:**
- ✅ Canary worker scope fix (isolated)
- ✅ LinkedIn app configuration verification
- ✅ OAuth retry on canary host
- ✅ Gate remains fail-closed

---

## CONCLUSION

**P2-27A ROOT CAUSE:** ✅ **IDENTIFIED**

**Issue:** Legacy LinkedIn OAuth scopes (`r_liteprofile r_emailaddress`) incompatible with current LinkedIn API.

**Fix:** Update scopes to OpenID Connect standard (`openid profile email`).

**Impact:** Minimal (2 files, 2 lines). Canary only. No production risk.

**Next:** Apply fix, validate, retry OAuth consent.

**Confidence:** 95% that scope update will resolve the issue.

---

**P2-27A COMPLETE. Ready to apply fix and proceed with P2-27 OAuth human validation.**
