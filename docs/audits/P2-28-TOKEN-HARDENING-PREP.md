# P2-28 — Token Storage Hardening Preparation

**Phase:** Token Security Hardening  
**Status:** ⏳ **PENDING** (blocked by P2-27 security findings)  
**Priority:** **CRITICAL** — Required before limited traffic

---

## Context

P2-27 successfully validated LinkedIn OAuth flow end-to-end, but identified critical security issues with token storage and validation patterns.

**Blockers identified:**
1. ⚠️ OAuth tokens stored in plaintext in `auth_meta`
2. ⚠️ Tokens exposed during validation via `SELECT *`
3. ⚠️ No token encryption at rest
4. ⚠️ No safe debug output patterns enforced

**Cannot proceed to limited traffic without resolving these issues.**

---

## Security Findings from P2-27

### 1. Token Exposure Incident

**What happened:**
```sql
-- ❌ INSECURE query used during P2-27 validation
SELECT * FROM saas_social_accounts;
```

**Result:**
- Full `auth_meta` JSON exposed in terminal
- `accessToken` visible in plaintext
- `idToken` visible in plaintext

**Impact:**
- Tokens compromised (canary scope only)
- Pattern unsafe for production use

---

### 2. Plaintext Token Storage

**Current `auth_meta` structure:**
```json
{
  "accessToken": "<PLAINTEXT_BEARER_TOKEN>",
  "idToken": "<PLAINTEXT_JWT>",
  "expiresIn": 5183999,
  "scope": "email openid profile",
  "tokenType": "Bearer",
  "mode": "live",
  "profileId": "<PROFILE_ID>",
  "email": "<USER_EMAIL>",
  ...
}
```

**Risks:**
- Database export exposes all tokens
- Backup/restore exposes tokens
- Admin queries expose tokens
- Debug logs expose tokens
- No encryption at rest

---

## P2-28 Objectives

### 1. Encrypt Tokens at Rest (REQUIRED)

**Goal:** Encrypt `accessToken` and `idToken` in `auth_meta` before storage.

**Options:**

**Option A: Field-level encryption (recommended)**
```json
{
  "accessToken": "encrypted:AES256:<base64_ciphertext>",
  "idToken": "encrypted:AES256:<base64_ciphertext>",
  "expiresIn": 5183999,
  "scope": "email openid profile",
  ...
}
```

**Option B: Separate token table**
```sql
CREATE TABLE social_account_tokens (
  id INTEGER PRIMARY KEY,
  account_id INTEGER REFERENCES saas_social_accounts(id),
  token_type TEXT CHECK(token_type IN ('access', 'id', 'refresh')),
  encrypted_token TEXT NOT NULL,
  expires_at TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
```

**Option C: Full auth_meta encryption**
```sql
-- Encrypt entire JSON blob
UPDATE saas_social_accounts
SET auth_meta = encrypt_json(auth_meta, secret_key);
```

**Recommendation:** **Option A** (field-level) for balance of security and query flexibility.

---

### 2. Safe Debug Output (REQUIRED)

**Goal:** Prevent token exposure in logs, errors, and debug output.

**Implementation:**

**A. Token masking utility:**
```typescript
function maskToken(token: string | null | undefined): string {
  if (!token) return '<none>';
  if (token.length <= 8) return '***';
  return `${token.slice(0, 4)}...${token.slice(-4)}`;
}
```

**B. Safe logger:**
```typescript
function logSocialAccount(account: SocialAccount) {
  console.log({
    id: account.id,
    provider: account.provider,
    status: account.status,
    accessToken: maskToken(account.auth_meta.accessToken), // ✅ Masked
    idToken: maskToken(account.auth_meta.idToken), // ✅ Masked
    profileId: account.auth_meta.profileId,
    email: account.auth_meta.email,
  });
}
```

**C. SQL query guard:**
```typescript
// Intercept and block dangerous queries
function validateQuery(sql: string): void {
  if (sql.includes('SELECT *') && sql.includes('saas_social_accounts')) {
    throw new Error('SELECT * is forbidden on tables with sensitive data. Use explicit columns.');
  }
}
```

---

### 3. Token Lifecycle (OPTIONAL for P2-28)

**Token refresh flow:**
- Exchange refresh token for new access token
- Update `auth_meta` with new tokens
- Handle LinkedIn API errors

**Token expiration monitoring:**
- Check `expiresIn` timestamp
- Warn user before expiration
- Trigger refresh flow

**Token revocation:**
- Revoke tokens on disconnect
- Clean up database
- Notify user

---

### 4. Rollback Validation (REQUIRED)

**Goal:** Validate disconnect/cleanup flow.

**Test scenarios:**
1. User disconnects LinkedIn account
2. Verify `status` → `DISCONNECTED`
3. Verify tokens removed/encrypted
4. Verify reconnect flow works

---

## Safe Query Pattern (REQUIRED)

**For all future validations, ALWAYS use:**

```sql
-- ✅ SAFE: Extracts only non-sensitive fields
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
WHERE tenant_id = ?
ORDER BY created_at DESC
LIMIT 5;
```

**❌ FORBIDDEN:**
```sql
-- Never use this on tables with auth_meta
SELECT * FROM saas_social_accounts;
```

---

## Implementation Checklist

### Phase 1: Token Encryption (P2-28A)

- [ ] Design encryption key management
- [ ] Implement field-level encryption for `accessToken`
- [ ] Implement field-level encryption for `idToken`
- [ ] Update `persistRuntimeLinkedInConnection` to encrypt tokens
- [ ] Update token retrieval to decrypt tokens
- [ ] Test encryption/decryption round-trip
- [ ] Validate performance impact
- [ ] Document encryption architecture

---

### Phase 2: Safe Debug Output (P2-28B)

- [ ] Implement `maskToken()` utility
- [ ] Update all log statements to mask tokens
- [ ] Update error messages to mask tokens
- [ ] Add SQL query validator
- [ ] Test with various token formats
- [ ] Document safe logging patterns
- [ ] Update operator guidelines

---

### Phase 3: Validation & Testing (P2-28C)

- [ ] Test full OAuth flow with encryption
- [ ] Validate safe query returns expected data
- [ ] Test disconnect/reconnect flow
- [ ] Validate token cleanup on disconnect
- [ ] Run `pnpm socialflow-runtime:build`
- [ ] Run `pnpm typecheck`
- [ ] Run `pnpm test`
- [ ] Run `git diff --check`

---

### Phase 4: Documentation (P2-28D)

- [ ] Document encryption architecture
- [ ] Document safe query patterns
- [ ] Document token lifecycle
- [ ] Update operator guidelines
- [ ] Create rollback procedure
- [ ] Update P2-28 audit report

---

## Encryption Key Management

### Option 1: Cloudflare Worker Secret

**Pros:**
- Integrated with Workers platform
- Encrypted at rest by Cloudflare
- Easy rotation via wrangler

**Cons:**
- Single key for all tenants (less isolation)
- Key exposed in worker environment

**Implementation:**
```bash
wrangler secret put SOCIAL_TOKEN_ENCRYPTION_KEY --env canary
```

```typescript
const encryptionKey = env.SOCIAL_TOKEN_ENCRYPTION_KEY;
```

---

### Option 2: Per-Tenant Encryption Key

**Pros:**
- Better tenant isolation
- Key compromise affects single tenant only

**Cons:**
- More complex key management
- Slower encryption/decryption (key lookup)

**Implementation:**
```sql
CREATE TABLE tenant_encryption_keys (
  tenant_id TEXT PRIMARY KEY,
  encrypted_key TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
```

---

### Option 3: Cloudflare Workers KV

**Pros:**
- Distributed key storage
- Fast key retrieval
- Built-in encryption

**Cons:**
- Additional binding required
- KV consistency model (eventual)

---

**Recommendation:** **Option 1** (Worker Secret) for P2-28, migrate to per-tenant keys later if needed.

---

## Encryption Algorithm

**Recommended:** AES-256-GCM

**Why:**
- Industry standard
- Authenticated encryption (prevents tampering)
- Supported by Web Crypto API
- Fast performance

**Implementation:**
```typescript
import { webcrypto } from 'crypto';

async function encryptToken(token: string, key: CryptoKey): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const iv = webcrypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await webcrypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    data
  );
  // Return: iv + ciphertext as base64
  return `encrypted:AES256-GCM:${base64(iv)}:${base64(ciphertext)}`;
}

async function decryptToken(encrypted: string, key: CryptoKey): Promise<string> {
  const [prefix, algo, ivB64, ciphertextB64] = encrypted.split(':');
  if (prefix !== 'encrypted' || algo !== 'AES256-GCM') {
    throw new Error('Invalid encrypted token format');
  }
  const iv = base64Decode(ivB64);
  const ciphertext = base64Decode(ciphertextB64);
  const plaintext = await webcrypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    ciphertext
  );
  return new TextDecoder().decode(plaintext);
}
```

---

## Testing Strategy

### Unit Tests

```typescript
describe('Token Encryption', () => {
  it('should encrypt and decrypt access token', async () => {
    const original = 'AQV8n4YsOr_fake_token_12345';
    const key = await generateKey();
    const encrypted = await encryptToken(original, key);
    const decrypted = await decryptToken(encrypted, key);
    expect(decrypted).toBe(original);
    expect(encrypted).not.toContain(original);
  });

  it('should mask tokens in logs', () => {
    const token = 'AQV8n4YsOr_fake_token_12345';
    const masked = maskToken(token);
    expect(masked).toBe('AQV8...2345');
    expect(masked).not.toContain('fake_token');
  });

  it('should block SELECT * queries', () => {
    const sql = 'SELECT * FROM saas_social_accounts';
    expect(() => validateQuery(sql)).toThrow('SELECT * is forbidden');
  });
});
```

### Integration Tests

```typescript
describe('OAuth Flow with Encryption', () => {
  it('should persist encrypted tokens', async () => {
    const result = await persistRuntimeLinkedInConnection({
      tenantId: 'test-tenant',
      saasId: 'test-saas',
      token: { access_token: 'test-token', ... },
      profile: { sub: '12345', ... },
      identity: { profileId: '12345', ... },
    });
    
    // Query database with safe query
    const account = await db.query(SAFE_QUERY, [result.account.id]);
    
    // auth_meta should NOT contain plaintext token
    expect(account.auth_meta).toContain('encrypted:AES256-GCM:');
    expect(account.auth_meta).not.toContain('test-token');
  });
});
```

---

## Rollback Plan

**If encryption causes issues:**

1. **Revert code changes**
   ```bash
   git revert <commit_hash>
   ```

2. **Decrypt existing tokens** (if any encrypted)
   ```sql
   -- Migration to decrypt tokens
   UPDATE saas_social_accounts
   SET auth_meta = decrypt_auth_meta(auth_meta)
   WHERE json_extract(auth_meta, '$.accessToken') LIKE 'encrypted:%';
   ```

3. **Redeploy previous version**
   ```bash
   cd workers/socialflows-runtime-canary
   wrangler rollback
   ```

4. **Validate OAuth flow still works**

---

## Success Criteria

**P2-28 is complete when:**

1. ✅ OAuth tokens encrypted at rest in `auth_meta`
2. ✅ Safe query pattern validated (no token exposure)
3. ✅ Token masking implemented in logs/errors
4. ✅ SQL query guard prevents `SELECT *` on sensitive tables
5. ✅ Full OAuth flow tested with encryption
6. ✅ Disconnect/reconnect flow tested
7. ✅ All validation passed (build, typecheck, tests)
8. ✅ Documentation updated
9. ✅ Operator guidelines updated
10. ✅ Security review approved

---

## Next Phase After P2-28

**P2-29 — Limited Traffic Readiness**
- Multi-tenant validation
- Load testing
- API smoke validation
- Broader staff testing
- Production DNS strategy
- Cutover decision

**Prerequisites from P2-28:**
- ✅ Token encryption at rest
- ✅ Safe debug output
- ✅ Rollback validated

---

## Operator Actions Required

**Before starting P2-28:**

1. Review encryption key management options
2. Decide on encryption algorithm (recommend AES-256-GCM)
3. Set up encryption key (Worker Secret recommended)
4. Review safe query pattern
5. Plan testing scenarios

**Do NOT start limited traffic until P2-28 complete.**

---

## Conclusion

**P2-28 is CRITICAL** — Token security hardening is a blocker for limited traffic.

**Current state:**
- ⚠️ Tokens stored in plaintext
- ⚠️ Tokens exposed in validation
- ⚠️ No encryption at rest
- ⚠️ No safe debug patterns

**Required state:**
- ✅ Tokens encrypted at rest
- ✅ Safe query patterns enforced
- ✅ Token masking in logs
- ✅ SQL guards prevent exposure

**Cannot proceed to limited traffic without P2-28 completion.**

---

**P2-28 PREPARATION COMPLETE. Ready to begin implementation.**
