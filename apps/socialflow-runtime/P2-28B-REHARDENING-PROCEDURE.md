# P2-28B Token Rehardening Procedure

## Status

- ✅ Encryption secret added to `saas-socialflows-runtime-canary`
- ✅ Hardened code deployed (Version: `e83155f3-661a-488c-93d1-af42ba05cb02`)
- ✅ Readiness endpoint enhanced with `security.tokenEncryptionAvailable`
- ⏳ Existing LinkedIn row rehardening (PENDING)

## Step 1: Verify Runtime Readiness

Test the readiness endpoint to confirm encryption capabilities:

```bash
curl -H "x-socialflow-canary-gate: <GATE_TOKEN>" \
  https://socialflow-canary.drako.systems/api/socialflow/runtime/readiness
```

**Expected response:**
```json
{
  "ok": true,
  "security": {
    "tokenEncryptionAvailable": true
  },
  "blockers": []
}
```

## Step 2: Check Current LinkedIn Row Status

Execute this safe query against `saas_socialflows_prod_db`:

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
  CASE 
    WHEN json_extract(auth_meta, '$.accessToken') LIKE 'encrypted:v1:aes-gcm:%' THEN 1 
    ELSE 0 
  END AS access_token_encrypted,
  CASE 
    WHEN json_extract(auth_meta, '$.idToken') LIKE 'encrypted:v1:aes-gcm:%' THEN 1 
    ELSE 0 
  END AS id_token_encrypted,
  created_at,
  updated_at
FROM saas_social_accounts
WHERE tenant_id = 'tenant_socialflow_canary_staff'
  AND saas_id = 'p2-24i-saas'
  AND provider = 'LINKEDIN'
ORDER BY created_at DESC
LIMIT 5;
```

**Expected current state:**
- `access_token_encrypted` = **0** (plaintext)
- `id_token_encrypted` = **0** (plaintext)
- `status` = `CONNECTED_REAL`

## Step 3: Safe Rehardening Approach

**Recommended: Delete + Reconnect (SAFEST)**

This approach:
- ✅ Guarantees encrypted tokens
- ✅ Tests full OAuth flow with encryption
- ✅ No risky SQL UPDATEs
- ✅ Validates end-to-end encryption
- ⚠️  Requires human OAuth consent again

### 3a. Delete Old Row (Preserve for Rollback if Needed)

```sql
-- OPTIONAL: Keep old row as backup
-- Skip this step if you want to keep plaintext version for rollback testing

DELETE FROM saas_social_accounts
WHERE id = '<row_id_from_step2>'
  AND tenant_id = 'tenant_socialflow_canary_staff'
  AND saas_id = 'p2-24i-saas'
  AND provider = 'LINKEDIN';
```

### 3b. Create New LinkedIn Connection

1. Navigate to: `https://socialflow-canary.drako.systems/socialflow/settings/account?saasId=p2-24i-saas`
2. Click "Connect LinkedIn"
3. Complete OAuth flow
4. Verify connection shows as `CONNECTED_REAL`

### 3c. Verify New Tokens Are Encrypted

Re-run the query from Step 2.

**Expected new state:**
- `access_token_encrypted` = **1** (encrypted!)
- `id_token_encrypted` = **1** (encrypted!)
- `status` = `CONNECTED_REAL`
- `created_at` = new timestamp
- `last_error_code` = `null`

## Step 4: Validate Decrypt in Real Usage

Test that encrypted tokens can be decrypted and used:

### Option A: Account Validation API (if available)

```bash
curl -X POST -H "x-socialflow-canary-gate: <GATE_TOKEN>" \
  https://socialflow-canary.drako.systems/api/socialflow/accounts/validate
```

### Option B: Publishing Validation

Try publishing a test post to verify token decryption works.

### Option C: Safe Debug Output

Check `/socialflow/settings/account` page and verify:
- ✅ Account shows as connected
- ✅ No tokens visible in page source
- ✅ No tokens in network responses
- ✅ No tokens in browser console

## Step 5: API Token Leakage Audit

Check these endpoints for token exposure:

1. **Settings Account Page**
   - URL: `/socialflow/settings/account?saasId=p2-24i-saas`
   - Verify: No `accessToken` or `idToken` in HTML/JSON

2. **Health Endpoint**
   - URL: `/api/socialflow/runtime/health`
   - Verify: No tokens in response

3. **Readiness Endpoint**
   - URL: `/api/socialflow/runtime/readiness`
   - Verify: Only reports `tokenEncryptionAvailable`, no actual tokens

## Step 6: Safe Query Verification (Final Check)

Run this query to confirm encryption and no token leakage:

```sql
SELECT 
  id,
  tenant_id,
  saas_id,
  provider,
  status,
  CASE 
    WHEN json_extract(auth_meta, '$.accessToken') LIKE 'encrypted:v1:aes-gcm:%' THEN 'ENCRYPTED'
    WHEN json_extract(auth_meta, '$.accessToken') IS NOT NULL THEN 'PLAINTEXT'
    ELSE 'MISSING'
  END AS access_token_status,
  CASE 
    WHEN json_extract(auth_meta, '$.idToken') LIKE 'encrypted:v1:aes-gcm:%' THEN 'ENCRYPTED'
    WHEN json_extract(auth_meta, '$.idToken') IS NOT NULL THEN 'PLAINTEXT'
    ELSE 'MISSING'
  END AS id_token_status,
  LENGTH(json_extract(auth_meta, '$.accessToken')) AS access_token_length,
  SUBSTR(json_extract(auth_meta, '$.accessToken'), 1, 20) AS access_token_prefix,
  created_at,
  updated_at
FROM saas_social_accounts
WHERE tenant_id = 'tenant_socialflow_canary_staff'
  AND saas_id = 'p2-24i-saas'
  AND provider = 'LINKEDIN'
ORDER BY created_at DESC
LIMIT 1;
```

**Expected result:**
- `access_token_status` = `ENCRYPTED`
- `id_token_status` = `ENCRYPTED`
- `access_token_prefix` = `"encrypted:v1:aes-g"` (first 20 chars)
- `access_token_length` > 100 (encrypted tokens are longer)

## Step 7: Rollback Drill (Post-Success)

⚠️  **ONLY AFTER SUCCESSFUL VALIDATION**

Test that rollback doesn't destroy the encrypted row:

1. Note current worker version: `e83155f3-661a-488c-93d1-af42ba05cb02`
2. Deploy previous version (if available)
3. Verify LinkedIn row still exists
4. Verify tokens remain encrypted
5. Redeploy current version
6. Verify decrypt still works

## Safety Checklist

Before proceeding:
- [ ] Encryption secret confirmed present
- [ ] Hardened code deployed to canary only
- [ ] No production/wildcard routes active
- [ ] Readiness shows `tokenEncryptionAvailable: true`
- [ ] Safe queries prepared (no SELECT *)
- [ ] Backup plan: keep old row or screenshot

## Dictamen Criteria

- ✅ token-encryption-secret-present
- ✅ canary-deploy-hardened
- ⏳ existing-linkedin-row-rehardened (after Step 3)
- ⏳ access-token-encrypted (after Step 3)
- ⏳ id-token-encrypted (after Step 3)
- ⏳ safe-debug-output (after Step 4)
- ⏳ api-token-leakage: NO (after Step 5)
- ⏳ logs-token-leakage: NO (after Step 5)
- ⏳ decrypt-runtime-validation (after Step 4)
- ⏳ rollback-post-success (after Step 7)
- ⏳ limited-traffic-ready (only if all pass)
- ❌ production-cutover-ready: NO (always)
