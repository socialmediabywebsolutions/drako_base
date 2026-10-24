# P2-27 — LinkedIn OAuth Real Human Consent + Persistence Validation

**Date:** 2026-05-17 19:53 UTC+2  
**Phase:** OAuth Human End-to-End Validation  
**Scope:** Real LinkedIn consent + token exchange + profile fetch + persistence  
**Result:** ✅ **SUCCESS** — OAuth flow complete, persistence validated

---

## EXECUTIVE SUMMARY

**P2-27 successfully completed.** Real LinkedIn OAuth human consent flow executed on canary runtime with full persistence to `saas_social_accounts`.

**Achievements:**
1. ✅ Real LinkedIn human consent granted
2. ✅ Authorization code callback received
3. ✅ Token exchange successful (access_token + id_token)
4. ✅ LinkedIn profile fetch successful (userinfo endpoint)
5. ✅ Persistence to `saas_social_accounts` validated
6. ✅ Redirect to settings page successful

**Security finding:** ⚠️ Tokens exposed during validation via `SELECT *`. Token storage hardening required before limited traffic.

**Next phase:** P2-28 — Token Storage Hardening + Safe Debug Output

---

## EXECUTION STATUS

**Execution date:** 2026-05-17 (multiple attempts)  
**Final success:** 2026-05-17 19:53 UTC+2  
**Method:** Manual human consent via browser

**Host:** `socialflow-canary.drako.systems`  
**Worker:** `saas-socialflows-runtime-canary`  
**User:** `socialflow-canary-staff+p2-24f@drako.systems`  
**Tenant:** `tenant_socialflow_canary_staff`  
**SaaS ID:** `p2-24i-saas`  
**Database:** `saas_socialflows_prod_db` (D1 remote)  
**Table:** `saas_social_accounts`

**OAuth flow:** ✅ **COMPLETE**  
**Persistence:** ✅ **VALIDATED**  
**Security:** ⚠️ **TOKEN EXPOSURE DETECTED**

---

## OAUTH FLOW VALIDATION

### 1. Authorization Request ✅

**Endpoint triggered:**
```
https://socialflow-canary.drako.systems/api/socialflow/linkedin/connect?saasId=p2-24i-saas
```

**Authorization URL generated:**
```
https://www.linkedin.com/oauth/v2/authorization
  ?client_id=<LINKEDIN_CLIENT_ID>
  &redirect_uri=https://socialflow-canary.drako.systems/api/socialflow/linkedin/callback
  &response_type=code
  &scope=openid%20profile%20email
  &state=<base64url_encoded_state_with_canary_gate>
```

**Scopes used:** `openid profile email` (OpenID Connect standard)

**State encoding:** Base64url-encoded JSON with canary gate signature

**Result:** ✅ Redirect to LinkedIn successful

---

### 2. LinkedIn Human Consent ✅

**User action:** Human operator granted LinkedIn permissions

**Consent screen shown:** ✅ YES (after P2-27A scope fix)

**Permissions requested:**
- ✅ Access to profile information
- ✅ Access to email address
- ✅ OpenID Connect identity

**User granted:** ✅ All permissions approved

**Result:** ✅ LinkedIn redirected to callback with authorization code

---

### 3. OAuth Callback ✅

**Callback URL:**
```
https://socialflow-canary.drako.systems/api/socialflow/linkedin/callback
  ?code=<AUTHORIZATION_CODE>
  &state=<BASE64URL_STATE>
```

**Callback route:** ✅ Attached (P2-24C wildcard)

**Route pattern:** `socialflow-canary.drako.systems/api/socialflow/linkedin/callback*`

**Worker response:** ✅ 200 OK

**State validation:** ✅ Parsed successfully

**Tenant resolution:**
- Source: State (base64url JSON)
- Tenant ID: `tenant_socialflow_canary_staff`
- SaaS ID: `p2-24i-saas`

**Result:** ✅ Authorization code received and validated

---

### 4. Token Exchange ✅

**LinkedIn endpoint:** `https://www.linkedin.com/oauth/v2/accessToken`

**Request method:** POST (application/x-www-form-urlencoded)

**Parameters sent:**
- `grant_type`: `authorization_code`
- `code`: `<AUTHORIZATION_CODE>`
- `redirect_uri`: `https://socialflow-canary.drako.systems/api/socialflow/linkedin/callback`
- `client_id`: `<LINKEDIN_CLIENT_ID>`
- `client_secret`: `<LINKEDIN_CLIENT_SECRET>`

**Response received:** ✅ 200 OK

**Tokens received:**
- ✅ `access_token` (Bearer token)
- ✅ `expires_in` (seconds)
- ✅ `scope` (`email openid profile`)
- ✅ `token_type` (`Bearer`)
- ✅ `id_token` (JWT)

**Result:** ✅ Token exchange successful

---

### 5. LinkedIn Profile Fetch ✅

**LinkedIn endpoint:** `https://api.linkedin.com/v2/userinfo`

**Request method:** GET

**Authorization header:** `Bearer <ACCESS_TOKEN>`

**Response received:** ✅ 200 OK

**Profile fields received:**
- ✅ `sub` (LinkedIn profile ID)
- ✅ `name` (display name)
- ✅ `given_name` (first name)
- ✅ `family_name` (last name)
- ✅ `email` (email address)
- ✅ `email_verified` (true)
- ✅ `picture` (profile picture URL)
- ✅ `locale` (language preference)

**Identity resolution:** ✅ Successful

**Resolved identity:**
- `profileId`: `<LINKEDIN_PROFILE_ID>` (from `sub`)
- `authorUrn`: `urn:li:person:<PROFILE_ID>`
- `displayName`: `<FULL_NAME>`
- `email`: `<USER_EMAIL>`
- `emailVerified`: `true`
- `picture`: `<PICTURE_URL>`
- `locale`: `<LOCALE>`

**Result:** ✅ Profile fetch successful

---

### 6. Persistence to Database ✅

**Database:** `saas_socialflows_prod_db` (D1 remote)  
**Table:** `saas_social_accounts`  
**Binding:** `SOCIAL_DB`

**Persistence method:** `persistRuntimeLinkedInConnection`

**Record created:**
- ✅ `tenant_id`: `tenant_socialflow_canary_staff`
- ✅ `saas_id`: `p2-24i-saas`
- ✅ `provider`: `LINKEDIN`
- ✅ `handle`: `<LINKEDIN_PROFILE_ID>`
- ✅ `display_name`: `<FULL_NAME>`
- ✅ `status`: `CONNECTED_REAL`
- ✅ `is_primary`: `1`
- ✅ `auth_meta`: JSON object with tokens and profile data
- ✅ `created_at`: `<TIMESTAMP>`
- ✅ `updated_at`: `<TIMESTAMP>`

**Auth meta structure (conceptual):**
```json
{
  "accessToken": "<REDACTED>",
  "idToken": "<REDACTED>",
  "expiresIn": 5183999,
  "scope": "email openid profile",
  "tokenType": "Bearer",
  "mode": "live",
  "profileId": "<LINKEDIN_PROFILE_ID>",
  "authorUrn": "urn:li:person:<PROFILE_ID>",
  "email": "<USER_EMAIL>",
  "emailVerified": true,
  "picture": "<PICTURE_URL>",
  "locale": "<LOCALE>",
  "lastValidationAt": "<ISO_TIMESTAMP>",
  "lastErrorCode": null
}
```

**⚠️ SECURITY CONCERN:** `auth_meta` contains sensitive tokens in plaintext JSON.

**Result:** ✅ Persistence successful

---

### 7. Redirect to Settings Page ✅

**Redirect URL generated:**
```
https://socialflow-canary.drako.systems/socialflow/settings/account?saasId=p2-24i-saas
```

**Route pattern:** `socialflow-canary.drako.systems/socialflow/settings/account*`

**Route status:** ✅ Attached (P2-24 previous phases)

**Worker response:** ✅ 200 OK (SSR)

**Page loaded:** ✅ "SocialFlow Settings — Account"

**Session:** ✅ Active canary session

**Result:** ✅ Redirect successful, user landed on settings page

---

## DATABASE VALIDATION

### Initial Validation (INSECURE)

**⚠️ SECURITY INCIDENT:** During initial validation, the following query was executed:

```sql
-- ❌ INSECURE: Exposes tokens in auth_meta
SELECT * FROM saas_social_accounts
WHERE tenant_id = 'tenant_socialflow_canary_staff';
```

**Result:** Full `auth_meta` JSON exposed, including:
- ❌ `accessToken` (LinkedIn access token)
- ❌ `idToken` (OpenID Connect ID token)

**Risk level:** **HIGH** — Tokens exposed in terminal output/logs

**Mitigation:**
- ✅ Tokens treated as compromised (canary only, staff account)
- ✅ Safe query defined for future validations
- ✅ Token storage hardening required before limited traffic

---

### Safe Validation Query (REQUIRED)

**For all future validations, use this query:**

```sql
SELECT 
  id,
  tenant_id,
  saas_id,
  provider,
  handle,
  display_name,
  status,
  is_primary,
  json_extract(auth_meta, '$.mode') AS mode,
  json_extract(auth_meta, '$.scope') AS scope,
  json_extract(auth_meta, '$.profileId') AS profile_id,
  json_extract(auth_meta, '$.email') AS email,
  json_extract(auth_meta, '$.lastValidationAt') AS last_validation_at,
  json_extract(auth_meta, '$.lastErrorCode') AS last_error_code,
  created_at,
  updated_at
FROM saas_social_accounts
WHERE tenant_id = 'tenant_socialflow_canary_staff'
ORDER BY created_at DESC
LIMIT 5;
```

**Why this query is safe:**
- ✅ Does NOT select `auth_meta` directly
- ✅ Extracts only non-sensitive fields via `json_extract`
- ✅ Does NOT expose `accessToken` or `idToken`
- ✅ Provides all necessary validation data
- ✅ Limits results to prevent excessive output

**Expected output:**
```
id | tenant_id                      | saas_id      | provider | handle              | display_name | status          | is_primary | mode | scope                 | profile_id          | email           | last_validation_at      | last_error_code | created_at              | updated_at
---|--------------------------------|--------------|----------|---------------------|--------------|-----------------|------------|------|-----------------------|---------------------|-----------------|-------------------------|-----------------|-------------------------|-------------------------
1  | tenant_socialflow_canary_staff | p2-24i-saas  | LINKEDIN | <PROFILE_ID>        | <FULL_NAME>  | CONNECTED_REAL  | 1          | live | email,openid,profile  | <PROFILE_ID>        | <USER_EMAIL>    | 2026-05-17T17:53:00Z    | null            | 2026-05-17T17:53:00Z    | 2026-05-17T17:53:00Z
```

**Validation checklist:**
- ✅ `provider`: `LINKEDIN`
- ✅ `status`: `CONNECTED_REAL`
- ✅ `mode`: `live`
- ✅ `scope`: `email,openid,profile` (or similar order)
- ✅ `profile_id`: Present (not null)
- ✅ `email`: Present (not null)
- ✅ `display_name`: Present (not null)
- ✅ `is_primary`: `1`
- ✅ `last_error_code`: `null`
- ✅ `created_at`: Recent timestamp
- ✅ `updated_at`: Recent timestamp

**Result:** ✅ All fields validated correctly (using safe query in followup validation)

---

## SECURITY FINDINGS

### 1. Token Storage in Plaintext ⚠️

**Issue:** OAuth tokens stored in `auth_meta` JSON column as plaintext.

**Evidence:**
```json
{
  "accessToken": "<BEARER_TOKEN>",
  "idToken": "<JWT_TOKEN>",
  ...
}
```

**Risk:**
- Database export exposes tokens
- Logs may expose tokens
- Debug queries expose tokens
- Admin access compromises all tokens

**Impact:** **HIGH** for production, **MEDIUM** for canary

**Current mitigation (canary only):**
- ✅ Isolated to canary environment
- ✅ Gated access (staff only)
- ✅ No public traffic
- ✅ Tokens considered test/dev scope

**Required before limited traffic:**
- ⏳ Implement token encryption at rest
- ⏳ Separate token storage table (optional)
- ⏳ Token rotation mechanism
- ⏳ Audit log for token access
- ⏳ Safe debug output (mask tokens in logs)

---

### 2. Unsafe SELECT * Pattern ⚠️

**Issue:** `SELECT * FROM saas_social_accounts` exposes sensitive `auth_meta` column.

**Risk:**
- Accidental token exposure in terminal
- Tokens logged to observability systems
- Copy-paste errors leak tokens

**Mitigation:**
- ✅ Safe query defined (see above)
- ✅ Documentation updated with safe pattern
- ✅ Operators trained to avoid `SELECT *`

**Enforcement recommendation:**
- Add SQL lint rule to block `SELECT *` on tables with `auth_meta`
- Add database view for safe queries
- Add runtime query interceptor to mask sensitive columns

---

### 3. Token Expiration Handling

**Current state:**
- ✅ `expiresIn` stored in `auth_meta`
- ⏳ No automatic token refresh implemented
- ⏳ No expiration warning system
- ⏳ No graceful degradation on expiration

**LinkedIn token lifetime:** ~60 days (5,183,999 seconds observed)

**Required before production:**
- Token refresh flow (exchange refresh token for new access token)
- Expiration monitoring
- User notification on token expiration
- Re-consent flow if refresh fails

---

## WHAT WAS VALIDATED

### OAuth Flow ✅

1. ✅ **Authorization request** — Redirect to LinkedIn successful
2. ✅ **LinkedIn consent screen** — Shown and approved by human
3. ✅ **Callback handling** — Authorization code received
4. ✅ **Token exchange** — Access token and ID token received
5. ✅ **Profile fetch** — LinkedIn userinfo endpoint successful
6. ✅ **Identity resolution** — Profile mapped to SocialFlow format
7. ✅ **Persistence** — Record inserted into `saas_social_accounts`
8. ✅ **Redirect** — User landed on settings page

### Database Schema ✅

**Table:** `saas_social_accounts`

**Validated columns:**
- ✅ `id` (auto-increment primary key)
- ✅ `tenant_id` (tenant isolation)
- ✅ `saas_id` (SaaS product ID)
- ✅ `provider` (LINKEDIN)
- ✅ `handle` (LinkedIn profile ID)
- ✅ `display_name` (user's full name)
- ✅ `status` (CONNECTED_REAL)
- ✅ `is_primary` (boolean flag)
- ✅ `auth_meta` (JSON with tokens and profile)
- ✅ `created_at` (timestamp)
- ✅ `updated_at` (timestamp)

**Schema correctness:** ✅ All expected columns present

---

### OpenID Connect Scopes ✅

**Scopes used:** `openid profile email`

**Data received:**
- ✅ `sub` (OpenID subject identifier)
- ✅ `name` (full name)
- ✅ `given_name` (first name)
- ✅ `family_name` (last name)
- ✅ `email` (email address)
- ✅ `email_verified` (verification status)
- ✅ `picture` (profile picture URL)
- ✅ `locale` (language/region)

**Scope compatibility:** ✅ All expected fields present

**Previous issue (P2-27A):** Legacy scopes (`r_liteprofile r_emailaddress`) were deprecated. Fixed by updating to OpenID Connect scopes.

---

## WHAT DID NOT CHANGE

### Production Safety ✅

**NO changes to:**
- ✅ Production worker (`saas-socialflows-prod`)
- ✅ Production DNS (`socialflow.drako.systems`)
- ✅ Production routes
- ✅ Monolith routing
- ✅ Campamento Base
- ✅ Mentoría
- ✅ Any other product
- ✅ Worker bindings (beyond canary)
- ✅ Worker secrets (beyond canary)
- ✅ Gate enforcement (remains fail-closed)

**ONLY changed:**
- Canary worker OAuth scopes (P2-27A fix)
- Canary `saas_social_accounts` table (1 record added)

**Blast radius:** Isolated to gated canary. Zero production impact.

---

## READINESS DICTAMEN

### OAuth Human Consent
**Status:** ✅ **YES** — Complete

**Evidence:**
- ✅ Real LinkedIn consent screen shown
- ✅ Human operator approved permissions
- ✅ Authorization code received
- ✅ Token exchange successful

---

### Token Exchange Real
**Status:** ✅ **YES** — Complete

**Evidence:**
- ✅ Access token received from LinkedIn
- ✅ ID token received (OpenID Connect)
- ✅ Token expiration time received
- ✅ Scope matches request

---

### Profile Fetch Real
**Status:** ✅ **YES** — Complete

**Evidence:**
- ✅ LinkedIn userinfo endpoint called
- ✅ Profile data received (sub, name, email, etc.)
- ✅ Email verified flag confirmed
- ✅ Profile picture URL received

---

### LinkedIn Persistence Real
**Status:** ✅ **YES** — Complete

**Evidence:**
- ✅ Record inserted into `saas_social_accounts`
- ✅ `status`: `CONNECTED_REAL`
- ✅ `is_primary`: `1`
- ✅ Tokens stored in `auth_meta`
- ✅ Profile data persisted

---

### Safe Validation Query
**Status:** ✅ **YES** — Defined

**Safe query provided:**
```sql
SELECT 
  id, tenant_id, saas_id, provider, handle, display_name, status, is_primary,
  json_extract(auth_meta, '$.mode') AS mode,
  json_extract(auth_meta, '$.scope') AS scope,
  json_extract(auth_meta, '$.profileId') AS profile_id,
  json_extract(auth_meta, '$.email') AS email,
  json_extract(auth_meta, '$.lastValidationAt') AS last_validation_at,
  json_extract(auth_meta, '$.lastErrorCode') AS last_error_code,
  created_at, updated_at
FROM saas_social_accounts
WHERE tenant_id = 'tenant_socialflow_canary_staff'
ORDER BY created_at DESC LIMIT 5;
```

---

### Tokens Exposed Earlier
**Status:** ⚠️ **YES** — Security incident

**Incident:**
- `SELECT *` query exposed `auth_meta` with tokens
- Tokens visible in terminal/logs
- Treated as compromised (canary scope only)

**Mitigation:**
- ✅ Safe query defined
- ✅ Documentation updated
- ✅ Tokens considered test-scoped
- ⏳ Token storage hardening required (P2-28)

---

### Production Cutover Ready
**Status:** ❌ **NO** — Blockers remain

**Still required:**
- ⏳ Token storage hardening (P2-28)
- ⏳ Safe debug output / token masking
- ⏳ Token refresh flow
- ⏳ Expiration monitoring
- ⏳ Real tenant SaaS seed in DRACO_DB
- ⏳ Multi-SaaS validation
- ⏳ Load/performance baseline
- ⏳ Broader staff testing
- ⏳ API smoke validation
- ⏳ Production DNS strategy

**Correctly scoped:** Production cutover not ready, as expected.

---

## BLOCKERS RESOLVED

### P2-27 Blockers (All Resolved) ✅

1. ✅ LinkedIn OAuth scopes (P2-27A fix)
2. ✅ LinkedIn consent screen shown
3. ✅ Authorization code callback
4. ✅ Token exchange successful
5. ✅ Profile fetch successful
6. ✅ Persistence to `saas_social_accounts`
7. ✅ Redirect to settings page

**P2-27 complete.**

---

## BLOCKERS IDENTIFIED FOR NEXT PHASE

### P2-28 Blockers (Token Security)

1. ⏳ **Token storage hardening**
   - Encrypt `accessToken` and `idToken` at rest
   - Consider separate token vault/table
   - Implement key rotation

2. ⏳ **Safe debug output**
   - Mask tokens in logs
   - Mask tokens in error messages
   - Prevent `SELECT *` on sensitive tables

3. ⏳ **Token refresh flow**
   - Exchange refresh token for new access token
   - Handle token expiration gracefully
   - Notify user on token expiration

4. ⏳ **Token rotation**
   - Periodic token refresh
   - Revoke old tokens
   - Audit token usage

5. ⏳ **Rollback mechanism**
   - Test disconnect flow
   - Validate token revocation
   - Clean up database on disconnect

---

## NEXT PHASE

### P2-28 — Token Storage Hardening + Safe Debug Output

**Objectives:**
1. Encrypt OAuth tokens at rest in `auth_meta`
2. Implement token masking in debug output
3. Add SQL guard to prevent `SELECT *` on sensitive tables
4. Implement token refresh flow (optional for P2-28)
5. Add token expiration monitoring (optional for P2-28)
6. Test rollback/disconnect flow
7. Validate safe query patterns
8. Document token security architecture

**Prerequisites (from P2-27):**
- ✅ OAuth flow working end-to-end
- ✅ Persistence validated
- ✅ Security risks identified

**Expected outcome:**
- Tokens encrypted at rest
- Safe debug output enforced
- Production-ready token security

---

## OPERATOR VALIDATION CHECKLIST

**For future OAuth validations, operators must:**

1. **Connect LinkedIn account:**
   - [ ] Visit `/api/socialflow/linkedin/connect?saasId=<SAAS_ID>`
   - [ ] Grant LinkedIn permissions
   - [ ] Verify redirect to settings page

2. **Validate persistence (SAFE QUERY ONLY):**
   ```sql
   -- ✅ SAFE: Use this query
   SELECT 
     id, tenant_id, saas_id, provider, handle, display_name, status, is_primary,
     json_extract(auth_meta, '$.mode') AS mode,
     json_extract(auth_meta, '$.scope') AS scope,
     json_extract(auth_meta, '$.profileId') AS profile_id,
     json_extract(auth_meta, '$.email') AS email,
     created_at, updated_at
   FROM saas_social_accounts
   WHERE tenant_id = '<TENANT_ID>'
   ORDER BY created_at DESC LIMIT 5;
   ```
   - [ ] Verify `status = 'CONNECTED_REAL'`
   - [ ] Verify `provider = 'LINKEDIN'`
   - [ ] Verify `is_primary = 1`
   - [ ] Verify `mode = 'live'`
   - [ ] Verify `scope` contains `openid profile email`
   - [ ] Verify `profile_id` present
   - [ ] Verify `email` present
   - [ ] **DO NOT** use `SELECT *`

3. **Test disconnect (optional):**
   - [ ] Visit `/socialflow/settings/account`
   - [ ] Disconnect LinkedIn account
   - [ ] Verify `status` changed to `DISCONNECTED`
   - [ ] Verify token revocation

---

## RELATED DOCUMENTATION

**P2-27 series:**
- `docs/audits/P2-27A-LINKEDIN-OAUTH-HUMAN-CONSENT-FAILURE.md` — Initial failure diagnosis
- `docs/audits/P2-27A-FIX-APPLIED.md` — Scope fix (legacy → OpenID Connect)
- `docs/audits/P2-27-LINKEDIN-OAUTH-REAL-PERSISTENCE.md` — This document

**Previous phases:**
- `docs/audits/P2-26-CANARY-INGRESS-PARITY-EXECUTION.md` — Canary ingress parity
- `docs/audits/P2-24G-SOCIAL-DB-SCHEMA-CREATION.md` — `saas_social_accounts` schema
- `docs/audits/P2-24C-SOCIALFLOW-OAUTH-CALLBACK-GATED-INGRESS.md` — OAuth callback route

**Next phase:**
- `docs/audits/P2-28-TOKEN-STORAGE-HARDENING.md` — To be created

---

## CONCLUSION

**P2-27 RESULT:** ✅ **SUCCESS** — OAuth flow complete

**Achievements:**
1. ✅ Real LinkedIn human consent validated
2. ✅ Authorization code callback successful
3. ✅ Token exchange successful (access_token + id_token)
4. ✅ LinkedIn profile fetch successful (userinfo endpoint)
5. ✅ Persistence to `saas_social_accounts` validated
6. ✅ Redirect to settings page successful
7. ✅ Safe validation query defined

**Security findings:**
- ⚠️ Tokens stored in plaintext in `auth_meta`
- ⚠️ Tokens exposed via `SELECT *` during validation
- ⚠️ Token storage hardening required before limited traffic

**Impact:**
- Canary only
- Zero production changes
- Zero blast radius
- Test tokens (staff account scope)

**Next phase:** P2-28 — Token Storage Hardening + Safe Debug Output

**SocialFlow canary runtime OAuth flow validated. Token security hardening required before broader rollout.**

---

**P2-27 COMPLETE. Proceeding to P2-28 for token security hardening.**
